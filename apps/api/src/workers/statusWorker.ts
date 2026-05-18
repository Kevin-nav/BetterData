import type { OrderStore } from "../orders/orderStore";
import { QUEUE_NAMES, type QueueProvider, type StatusRefreshJob } from "../queue";
import { DataMartHttpError, DataMartNetworkError } from "../vendors/datamart/transport";
import type { DataVendor } from "../vendors/types";

export async function startStatusWorker(options: {
  queue: QueueProvider;
  orderStore: OrderStore;
  vendor: DataVendor;
  maxAttempts?: number;
  retryDelayMs?: number;
}) {
  const maxAttempts = options.maxAttempts ?? 5;
  const retryDelayMs = options.retryDelayMs ?? 30_000;

  return await options.queue.consume<StatusRefreshJob>(
    QUEUE_NAMES.statusRefresh,
    async (message) => {
      try {
        const status = await options.vendor.getOrderStatus(
          message.job.vendorOrderReference
        );

        await options.orderStore.recordVendorResult(message.job.orderReference, {
          vendorOrderReference: message.job.vendorOrderReference,
          status
        });

        await message.ack();
      } catch (error) {
        if (isRetryableVendorError(error) && message.attempts + 1 < maxAttempts) {
          await message.retry(retryDelayMs);
          return;
        }

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
