import type { OrderStore } from "../orders/orderStore";
import { incrementMetric } from "../observability/metrics";
import { QUEUE_NAMES, type PurchaseJob, type QueueMessage, type QueueProvider } from "../queue";
import type { DataVendor } from "../vendors/types";
import { DataMartHttpError, DataMartNetworkError } from "../vendors/datamart/transport";

export type PurchaseWorkerOptions = {
  queue: QueueProvider;
  orderStore: OrderStore;
  vendor: DataVendor;
  maxAttempts?: number;
  retryDelayMs?: number;
  logger?: Pick<Console, "error">;
};

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

    if (existing?.vendorOrderReference !== undefined) {
      await message.ack();
      return;
    }

    const result = await options.vendor.purchase({
      packageId: job.packageId,
      network: job.network,
      recipientPhone: job.recipientPhone,
      idempotencyKey: job.idempotencyKey
    });

    await options.orderStore.recordVendorResult(job.orderReference, {
      vendorOrderReference: result.vendorOrderReference,
      vendorRaw: result.raw,
      status: result.status
    });

    if (result.status === "completed") {
      await incrementMetric("purchase.success");
    } else if (result.status === "failed") {
      await incrementMetric("purchase.failure");
    } else if (result.status === "refunded") {
      await incrementMetric("purchase.refunded");
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
    if (isRetryableVendorError(error) && message.attempts + 1 < maxAttempts) {
      await incrementMetric("purchase.retry");
      await message.retry(retryDelayMs);
      return;
    }

    await incrementMetric("purchase.dead_letter");
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
