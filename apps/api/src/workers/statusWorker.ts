import type { OrderStore } from "../orders/orderStore";
import { QUEUE_NAMES, type QueueProvider, type StatusRefreshJob } from "../queue";
import type { DataVendor } from "../vendors/types";

export async function startStatusWorker(options: {
  queue: QueueProvider;
  orderStore: OrderStore;
  vendor: DataVendor;
}) {
  return await options.queue.consume<StatusRefreshJob>(
    QUEUE_NAMES.statusRefresh,
    async (message) => {
      const status = await options.vendor.getOrderStatus(
        message.job.vendorOrderReference
      );

      await options.orderStore.recordVendorResult(message.job.orderReference, {
        vendorOrderReference: message.job.vendorOrderReference,
        status
      });

      await message.ack();
    }
  );
}
