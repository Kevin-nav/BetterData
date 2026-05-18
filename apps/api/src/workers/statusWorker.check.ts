import assert from "node:assert/strict";

import { createMemoryOrderStore } from "../orders/orderStore";
import { createLocalQueueProvider } from "../queue/localQueue";
import { QUEUE_NAMES, type StatusRefreshJob } from "../queue/types";
import { DataMartHttpError } from "../vendors/datamart/transport";
import type { DataVendor } from "../vendors/types";
import { startStatusWorker } from "./statusWorker";

const vendor: DataVendor = {
  id: "datamart",
  displayName: "DataMartGH",
  async listPackages() {
    return [];
  },
  async purchase() {
    throw new Error("not used");
  },
  async getOrderStatus() {
    return "completed";
  },
  async getBalance() {
    return { balanceGhs: 100 };
  }
};

const queue = createLocalQueueProvider();
const orderStore = createMemoryOrderStore();
const order = await orderStore.createIntent({
  body: {
    packageId: "datamart:yello-5gb",
    network: "mtn",
    recipientPhone: "0551234567",
    confirmRecipientIsCorrect: true,
    paymentMethod: "wallet"
  },
  vendor,
  idempotencyKey: "idem-status"
});
const job: StatusRefreshJob = {
  kind: "status-refresh",
  orderReference: order.reference,
  vendorId: vendor.id,
  vendorOrderReference: "GN-STATUS",
  attempt: 0,
  createdAt: new Date(0).toISOString()
};

const stop = await startStatusWorker({ queue, orderStore, vendor });
await queue.enqueue(QUEUE_NAMES.statusRefresh, job);
await new Promise((resolve) => setTimeout(resolve, 0));

const updated = await orderStore.getByReference(order.reference);
assert.equal(updated?.status, "completed");
assert.equal(updated?.vendorOrderReference, "GN-STATUS");
assert.equal(await queue.getDepth(QUEUE_NAMES.statusRefresh), 0);
await stop();

const retryQueue = createLocalQueueProvider();
let retryAttempts = 0;
const retryVendor: DataVendor = {
  ...vendor,
  async getOrderStatus() {
    retryAttempts += 1;
    if (retryAttempts === 1) {
      throw new DataMartHttpError("rate limited", 429, {});
    }

    return "processing";
  }
};
const stopRetry = await startStatusWorker({
  queue: retryQueue,
  orderStore,
  vendor: retryVendor,
  retryDelayMs: 1
});
await retryQueue.enqueue(QUEUE_NAMES.statusRefresh, job);
await new Promise((resolve) => setTimeout(resolve, 5));
assert.equal(retryAttempts, 2);
assert.equal(await retryQueue.getDepth(QUEUE_NAMES.statusRefresh), 0);
await stopRetry();

const deadQueue = createLocalQueueProvider();
const deadVendor: DataVendor = {
  ...vendor,
  async getOrderStatus() {
    throw new DataMartHttpError("bad reference", 400, {});
  }
};
const stopDead = await startStatusWorker({
  queue: deadQueue,
  orderStore,
  vendor: deadVendor,
  maxAttempts: 1
});
await deadQueue.enqueue(QUEUE_NAMES.statusRefresh, job);
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(await deadQueue.getDepth(QUEUE_NAMES.purchaseDead), 1);
assert.equal(await deadQueue.getDepth(QUEUE_NAMES.statusRefresh), 0);
await stopDead();
