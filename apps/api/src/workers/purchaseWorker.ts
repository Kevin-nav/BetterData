import type { OrderStore } from "../orders/orderStore";
import { QUEUE_NAMES, type PurchaseJob, type QueueMessage, type QueueProvider } from "../queue";
import type { DataVendor } from "../vendors/types";
import { DataMartHttpError, DataMartNetworkError } from "../vendors/datamart/transport";

export type PurchaseWorkerOptions = {
  queue: QueueProvider;
  orderStore: OrderStore;
  vendor: DataVendor;
  maxAttempts?: number;
  retryDelayMs?: number;
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

    await message.ack();
  } catch (error) {
    if (isRetryableVendorError(error) && message.attempts + 1 < maxAttempts) {
      await message.retry(retryDelayMs);
      return;
    }

    await message.deadLetter(
      error instanceof Error ? error.message : "Unknown purchase worker failure."
    );
  }
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
