import type { OrderStore } from "../orders/orderStore";
import type { OpsAlertInput } from "../ops/opsAlerts";
import { incrementMetric } from "../observability/metrics";
import { QUEUE_NAMES, type PurchaseJob, type QueueMessage, type QueueProvider } from "../queue";
import { emitAppTelemetry } from "../telemetry/appTelemetry";
import type { DataVendor } from "../vendors/types";
import { DataMartHttpError, DataMartNetworkError } from "../vendors/datamart/transport";
import { isLowVendorBalanceError, vendorPayloadIndicatesLowBalance } from "../vendors/errors";
import {
  extractVendorBalanceGhs,
  recordVendorBalanceSnapshotSafely
} from "../vendors/vendorBalance";

export type PurchaseWorkerOptions = {
  queue: QueueProvider;
  orderStore: OrderStore;
  vendor: DataVendor;
  maxAttempts?: number;
  retryDelayMs?: number;
  createOpsAlert?: (alert: OpsAlertInput) => Promise<boolean>;
  logger?: Pick<Console, "error">;
};

const lowBalanceRetryWindowMs = 60 * 60 * 1000;
const lowBalanceRetryDelayMs = 5 * 60 * 1000;

export async function startPurchaseWorker(options: PurchaseWorkerOptions) {
  return await options.queue.consume<PurchaseJob>(
    QUEUE_NAMES.purchaseRequested,
    async (message) => {
      await processPurchaseMessage(message, options);
    }
  );
}

export async function processPurchaseMessage(
  message: QueueMessage<PurchaseJob>,
  options: PurchaseWorkerOptions
) {
  const maxAttempts = options.maxAttempts ?? 5;
  const retryDelayMs = options.retryDelayMs ?? 30_000;
  const job = message.job;

  try {
    const existing = await options.orderStore.getByReference(job.orderReference);

    if (
      existing?.vendorOrderReference !== undefined &&
      existing.status !== "failed" &&
      existing.status !== "refunded"
    ) {
      await message.ack();
      return;
    }

    const result = await options.vendor.purchase({
      packageId: job.packageId,
      network: job.network,
      recipientPhone: job.recipientPhone,
      idempotencyKey: job.idempotencyKey
    });
    await recordPurchaseResponseBalance(options.vendor.id, result.raw, job.orderReference);

    if (result.status === "failed" && vendorPayloadIndicatesLowBalance(result.raw)) {
      await handleLowVendorBalance({
        options,
        job,
        existing,
        vendorRaw: result.raw
      });
      await message.ack();
      return;
    }

    await options.orderStore.recordVendorResult(job.orderReference, {
      vendorOrderReference: result.vendorOrderReference,
      vendorRaw: result.raw,
      status: result.status
    });

    if (result.status === "completed") {
      await incrementMetric("purchase.success");
    } else if (result.status === "failed") {
      await incrementMetric("purchase.failure");
      await reportFulfillmentTerminalStatus({
        options,
        job,
        status: result.status,
        vendorOrderReference: result.vendorOrderReference,
        vendorRaw: result.raw
      });
    } else if (result.status === "refunded") {
      await incrementMetric("purchase.refunded");
      await reportFulfillmentTerminalStatus({
        options,
        job,
        status: result.status,
        vendorOrderReference: result.vendorOrderReference,
        vendorRaw: result.raw
      });
    } else {
      await incrementMetric("purchase.processing");
      await options.queue.enqueue(QUEUE_NAMES.statusRefresh, {
        kind: "status-refresh",
        orderReference: job.orderReference,
        vendorId: job.vendorId,
        vendorOrderReference: result.vendorOrderReference,
        attempt: 0,
        createdAt: new Date().toISOString()
      });
    }

    await message.ack();
  } catch (error) {
    if (isLowVendorBalanceError(error)) {
      try {
        const existing = await options.orderStore.getByReference(job.orderReference);
        await handleLowVendorBalance({
          options,
          job,
          existing,
          vendorRaw: {
            vendorId: job.vendorId,
            workerError: serializeError(error)
          }
        });
        await message.ack();
        return;
      } catch (lowBalanceHandlingError) {
        options.logger?.error(
          {
            error: lowBalanceHandlingError,
            orderReference: job.orderReference,
            vendorId: job.vendorId
          },
          "Purchase worker failed to persist low balance retry state"
        );
      }
    }

    if (isRetryableVendorError(error) && message.attempts + 1 < maxAttempts) {
      await incrementMetric("purchase.retry");
      await message.retry(retryDelayMs);
      return;
    }

    await incrementMetric("purchase.dead_letter");
    emitAppTelemetry({
      name: "data_purchase.worker_failed",
      attributes: {
        "order.reference": job.orderReference,
        "vendor.id": job.vendorId,
        "queue.attempts": message.attempts + 1
      },
      recipientPhone: job.recipientPhone,
      error
    });
    try {
      await options.orderStore.recordOrderFailure(job.orderReference, {
        status: "failed",
        vendorRaw: {
          vendorId: job.vendorId,
          workerError: serializeError(error)
        }
      });
    } catch (persistenceError) {
      options.logger?.error(
        {
          error: persistenceError,
          orderReference: job.orderReference,
          vendorId: job.vendorId
        },
        "Purchase worker failed to persist terminal order failure"
      );
    }

    await options.createOpsAlert?.({
      severity: "critical",
      category: "fulfillment",
      reference: job.orderReference,
      message: "Data purchase fulfillment failed before reaching the vendor.",
      metadata: {
        vendorId: job.vendorId,
        packageId: job.packageId,
        network: job.network,
        workerError: serializeError(error)
      },
      retryable: true,
      retryAction: "fulfill_order"
    });

    await message.deadLetter(
      error instanceof Error ? error.message : "Unknown purchase worker failure."
    );
  }
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack
    };
  }

  return {
    message: String(error)
  };
}

function isRetryableVendorError(error: unknown) {
  if (error instanceof DataMartNetworkError) {
    return true;
  }

  if (error instanceof DataMartHttpError) {
    return (
      error.statusCode === 409 ||
      error.statusCode === 429 ||
      error.statusCode >= 500
    );
  }

  return false;
}

async function handleLowVendorBalance(input: {
  options: PurchaseWorkerOptions;
  job: PurchaseJob;
  existing: Awaited<ReturnType<OrderStore["getByReference"]>>;
  vendorRaw?: unknown;
}) {
  const now = Date.now();
  const deadlineAt =
    input.existing?.balanceRetryDeadlineAt ?? now + lowBalanceRetryWindowMs;

  await input.options.orderStore.recordBalanceRetry(input.job.orderReference, {
    deadlineAt,
    ...(input.vendorRaw !== undefined ? { vendorRaw: input.vendorRaw } : {})
  });

  if (now >= deadlineAt) {
    await handleExpiredLowBalanceRetry(input);
    return;
  }

  await incrementMetric("purchase.low_balance_retry");
  emitAppTelemetry({
    name: "data_purchase.vendor_balance_retry",
    attributes: {
      "order.reference": input.job.orderReference,
      "vendor.id": input.job.vendorId,
      "package.id": input.job.packageId,
      "retry.deadline_at": deadlineAt
    },
    recipientPhone: input.job.recipientPhone
  });

  await input.options.createOpsAlert?.({
    severity: "warning",
    category: "fulfillment",
    reference: input.job.orderReference,
    message: "Data purchase is waiting for vendor wallet balance before retrying fulfillment.",
    metadata: {
      vendorId: input.job.vendorId,
      packageId: input.job.packageId,
      network: input.job.network,
      balanceRetryDeadlineAt: deadlineAt,
      vendorRaw: input.vendorRaw
    },
    retryable: true,
    retryAction: "fulfill_order",
    retryStatus: "queued",
    nextRetryAt: Math.min(now + lowBalanceRetryDelayMs, deadlineAt)
  });
}

async function handleExpiredLowBalanceRetry(input: {
  options: PurchaseWorkerOptions;
  job: PurchaseJob;
  existing: Awaited<ReturnType<OrderStore["getByReference"]>>;
  vendorRaw?: unknown;
}) {
  await incrementMetric("purchase.low_balance_timeout");

  if (input.existing?.userId) {
    const refund = await input.options.orderStore.refundToWallet(input.job.orderReference, {
      notes: "Automatic wallet refund after vendor balance retry timeout"
    });

    await input.options.createOpsAlert?.({
      severity: "warning",
      category: "fulfillment",
      reference: input.job.orderReference,
      message: refund.refunded
        ? "Data purchase was automatically refunded to the customer's wallet after vendor balance stayed low."
        : "Data purchase refund was already recorded after vendor balance stayed low.",
      metadata: {
        vendorId: input.job.vendorId,
        packageId: input.job.packageId,
        network: input.job.network,
        refund,
        vendorRaw: input.vendorRaw
      }
    });
    return;
  }

  await input.options.orderStore.recordOrderFailure(input.job.orderReference, {
    status: "failed",
    vendorRaw: {
      vendorId: input.job.vendorId,
      lowBalanceRetryExpired: true,
      vendorRaw: input.vendorRaw
    }
  });

  await input.options.createOpsAlert?.({
    severity: "critical",
    category: "fulfillment",
    reference: input.job.orderReference,
    message:
      "Guest data purchase could not be fulfilled after vendor balance retry timeout and needs manual refund or fulfillment.",
    metadata: {
      vendorId: input.job.vendorId,
      packageId: input.job.packageId,
      network: input.job.network,
      vendorRaw: input.vendorRaw
    }
  });
}

async function recordPurchaseResponseBalance(
  vendorId: string,
  payload: unknown,
  orderReference: string
) {
  const balanceGhs = extractVendorBalanceGhs(payload);

  if (balanceGhs === null) {
    return;
  }

  await recordVendorBalanceSnapshotSafely({
    vendorId,
    balanceGhs,
    source: "purchase_response",
    metadata: { orderReference }
  });
}

async function reportFulfillmentTerminalStatus(input: {
  options: PurchaseWorkerOptions;
  job: PurchaseJob;
  status: "failed" | "refunded";
  vendorOrderReference: string;
  vendorRaw?: unknown;
}) {
  input.options.logger?.error(
    {
      orderReference: input.job.orderReference,
      vendorId: input.job.vendorId,
      vendorOrderReference: input.vendorOrderReference,
      status: input.status
    },
    "Data purchase vendor returned terminal fulfillment status"
  );

  emitAppTelemetry({
    name: "data_purchase.fulfillment_terminal",
    attributes: {
      "order.reference": input.job.orderReference,
      "vendor.id": input.job.vendorId,
      "vendor.order_reference": input.vendorOrderReference,
      "fulfillment.status": input.status,
      "package.id": input.job.packageId,
      "network": input.job.network
    },
    recipientPhone: input.job.recipientPhone
  });

  await input.options.createOpsAlert?.({
    severity: input.status === "failed" ? "critical" : "warning",
    category: "fulfillment",
    reference: input.job.orderReference,
    message:
      input.status === "failed"
        ? "Paid data purchase failed at the vendor and needs refund or manual fulfillment review."
        : "Paid data purchase was refunded by the vendor and needs customer credit/refund review.",
    metadata: {
      vendorId: input.job.vendorId,
      vendorOrderReference: input.vendorOrderReference,
      packageId: input.job.packageId,
      network: input.job.network,
      vendorRaw: input.vendorRaw
    },
    retryable: input.status === "failed",
    ...(input.status === "failed" ? { retryAction: "fulfill_order" as const } : {})
  });
}
