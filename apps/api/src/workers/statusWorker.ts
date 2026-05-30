import type { OrderStore } from "../orders/orderStore";
import type { OpsAlertInput } from "../ops/opsAlerts";
import { sendFirstPurchaseEmail } from "../integrations/resend/client";
import { QUEUE_NAMES, type QueueProvider, type StatusRefreshJob } from "../queue";
import { emitAppTelemetry } from "../telemetry/appTelemetry";
import { DataMartHttpError, DataMartNetworkError } from "../vendors/datamart/transport";
import type { DataVendor } from "../vendors/types";

export async function startStatusWorker(options: {
  queue: QueueProvider;
  orderStore: OrderStore;
  vendor: DataVendor;
  maxAttempts?: number;
  retryDelayMs?: number;
  createOpsAlert?: (alert: OpsAlertInput) => Promise<boolean>;
  logger?: Pick<Console, "error">;
}) {
  const maxAttempts = options.maxAttempts ?? 48;
  const retryDelayMs = options.retryDelayMs ?? 5 * 60_000;

  return await options.queue.consume<StatusRefreshJob>(
    QUEUE_NAMES.statusRefresh,
    async (message) => {
      try {
        const status = await options.vendor.getOrderStatus(
          message.job.vendorOrderReference
        );

        const recordResult = await options.orderStore.recordVendorResult(message.job.orderReference, {
          vendorOrderReference: message.job.vendorOrderReference,
          status
        });

        if (recordResult?.isFirstPurchase && recordResult?.email) {
          sendFirstPurchaseEmail({
            userId: recordResult.userId,
            email: recordResult.email,
            displayName: recordResult.displayName,
            reference: message.job.orderReference,
            amountGhs: recordResult.amountGhs,
            recipientPhone: recordResult.recipientPhone,
            network: recordResult.network
          });
        }

        if (status === "processing" && message.attempts + 1 < maxAttempts) {
          await message.retry(retryDelayMs);
          return;
        }

        if (status === "failed" || status === "refunded") {
          await reportStatusRefreshTerminalStatus({
            options,
            job: message.job,
            status
          });
        }

        await message.ack();
      } catch (error) {
        if (isRetryableVendorError(error) && message.attempts + 1 < maxAttempts) {
          await message.retry(retryDelayMs);
          return;
        }

        emitAppTelemetry({
          name: "data_purchase.status_refresh_failed",
          attributes: {
            "order.reference": message.job.orderReference,
            "vendor.id": message.job.vendorId,
            "vendor.order_reference": message.job.vendorOrderReference,
            "queue.attempts": message.attempts + 1
          },
          error
        });

        options.logger?.error(
          {
            error,
            orderReference: message.job.orderReference,
            vendorId: message.job.vendorId,
            vendorOrderReference: message.job.vendorOrderReference
          },
          "Status refresh worker failed terminally"
        );

        await message.deadLetter(
          error instanceof Error
            ? error.message
            : "Unknown status worker failure."
        );
      }
    }
  );
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

async function reportStatusRefreshTerminalStatus(input: {
  options: {
    createOpsAlert?: (alert: OpsAlertInput) => Promise<boolean>;
    logger?: Pick<Console, "error">;
  };
  job: StatusRefreshJob;
  status: "failed" | "refunded";
}) {
  input.options.logger?.error(
    {
      orderReference: input.job.orderReference,
      vendorId: input.job.vendorId,
      vendorOrderReference: input.job.vendorOrderReference,
      status: input.status
    },
    "Data purchase status refresh returned terminal fulfillment status"
  );

  emitAppTelemetry({
    name: "data_purchase.status_refresh_terminal",
    attributes: {
      "order.reference": input.job.orderReference,
      "vendor.id": input.job.vendorId,
      "vendor.order_reference": input.job.vendorOrderReference,
      "fulfillment.status": input.status
    }
  });

  await input.options.createOpsAlert?.({
    severity: input.status === "failed" ? "critical" : "warning",
    category: "fulfillment",
    reference: input.job.orderReference,
    message:
      input.status === "failed"
        ? "Paid data purchase later failed at the vendor and needs refund or manual fulfillment review."
        : "Paid data purchase was later refunded by the vendor and needs customer credit/refund review.",
    metadata: {
      vendorId: input.job.vendorId,
      vendorOrderReference: input.job.vendorOrderReference
    },
    retryable: input.status === "failed",
    ...(input.status === "failed" ? { retryAction: "fulfill_order" as const } : {})
  });
}
