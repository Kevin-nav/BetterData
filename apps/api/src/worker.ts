import { createOrderStore } from "./orders/orderStore";
import { createQueueProvider } from "./queue";
import { getActiveDataVendor } from "./vendors/activeVendor";
import { startPurchaseWorker } from "./workers/purchaseWorker";
import { startStatusWorker } from "./workers/statusWorker";

const queue = await createQueueProvider();
const orderStore = createOrderStore();
const vendor = getActiveDataVendor();

await startPurchaseWorker({ queue, orderStore, vendor });
await startStatusWorker({ queue, orderStore, vendor });

console.log("Better Data worker started.");
