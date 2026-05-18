import assert from "node:assert/strict";

import { createMemoryOrderStore } from "../orders/orderStore";
import { createLocalQueueProvider } from "../queue/localQueue";
import { QUEUE_NAMES, type PurchaseJob } from "../queue/types";
import type { DataVendor } from "../vendors/types";
import { startPurchaseWorker } from "./purchaseWorker";

const queue = createLocalQueueProvider();
const orderStore = createMemoryOrderStore();
const vendor: DataVendor = {
  id: "datamart",
  displayName: "DataMartGH",
  async listPackages() {
    return [];
  },
  async purchase(input) {
    return {
      vendorOrderReference: `GN-${input.idempotencyKey}`,
      status: "processing",
      raw: { ok: true }
    };
  },
  async getOrderStatus() {
    return "processing";
  },
  async getBalance() {
    return { balanceGhs: 100 };
  }
};

const order = await orderStore.createIntent({
  body: {
    packageId: "datamart:yello-5gb",
    network: "mtn",
    recipientPhone: "0551234567",
    confirmRecipientIsCorrect: true,
    paymentMethod: "wallet"
  },
  vendor,
  idempotencyKey: "idem-worker"
});

const stop = await startPurchaseWorker({
  queue,
  orderStore,
  vendor,
  retryDelayMs: 1
});

const job: PurchaseJob = {
  kind: "purchase",
  orderReference: order.reference,
  packageId: order.packageId,
  network: order.network,
  recipientPhone: order.recipientPhone,
  paymentMethod: order.paymentMethod,
  vendorId: order.vendorId,
  idempotencyKey: order.idempotencyKey,
  attempt: 0,
  createdAt: new Date(0).toISOString()
};

await queue.enqueue(QUEUE_NAMES.purchaseRequested, job);
await new Promise((resolve) => setTimeout(resolve, 0));

const updated = await orderStore.getByReference(order.reference);
assert.equal(updated?.vendorOrderReference, "GN-idem-worker");
assert.equal(updated?.status, "processing");

await stop();

const failingQueue = createLocalQueueProvider();
const failingOrderStore = createMemoryOrderStore();
const failingOrder = await failingOrderStore.createIntent({
  body: {
    packageId: "datamart:yello-5gb",
    network: "mtn",
    recipientPhone: "0551234567",
    confirmRecipientIsCorrect: true,
    paymentMethod: "wallet"
  },
  vendor,
  idempotencyKey: "idem-failing-worker"
});
const failingVendor: DataVendor = {
  ...vendor,
  async purchase() {
    throw new Error("permanent vendor failure");
  }
};
const stopFailing = await startPurchaseWorker({
  queue: failingQueue,
  orderStore: failingOrderStore,
  vendor: failingVendor,
  maxAttempts: 1,
  logger: console
});

await failingQueue.enqueue(QUEUE_NAMES.purchaseRequested, {
  ...job,
  orderReference: failingOrder.reference,
  idempotencyKey: failingOrder.idempotencyKey
});
await new Promise((resolve) => setTimeout(resolve, 0));

const failed = await failingOrderStore.getByReference(failingOrder.reference);
assert.equal(failed?.status, "failed");
assert.deepEqual(
  (failed?.vendorRaw as { workerError?: { message?: string } }).workerError?.message,
  "permanent vendor failure"
);
assert.equal(await failingQueue.getDepth(QUEUE_NAMES.purchaseDead), 1);
await stopFailing();
