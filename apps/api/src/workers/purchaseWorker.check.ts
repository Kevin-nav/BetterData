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
