import assert from "node:assert/strict";

import { createMemoryOrderStore } from "../orders/orderStore";
import { createLocalQueueProvider } from "../queue/localQueue";
import { QUEUE_NAMES, type PurchaseJob } from "../queue/types";
import type { DataVendor } from "../vendors/types";
import { processPurchaseMessage, startPurchaseWorker } from "./purchaseWorker";

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
const updated = await waitForOrder(orderStore, order.reference, (current) =>
  current?.vendorOrderReference === "GN-idem-worker" &&
  current.status === "processing"
);
assert.equal(updated?.vendorOrderReference, "GN-idem-worker");
assert.equal(updated?.status, "processing");
await waitForCondition(
  async () => (await queue.getDepth(QUEUE_NAMES.statusRefresh)) === 1
);
assert.equal(await queue.getDepth(QUEUE_NAMES.statusRefresh), 1);

await stop();

const terminalQueue = createLocalQueueProvider();
const terminalOrderStore = createMemoryOrderStore();
const terminalOrder = await terminalOrderStore.createIntent({
  body: {
    packageId: "datamart:yello-1gb",
    network: "mtn",
    recipientPhone: "0557654321",
    confirmRecipientIsCorrect: true,
    paymentMethod: "paystack_momo"
  },
  vendor,
  idempotencyKey: "idem-terminal-vendor"
});
const terminalAlerts: Array<{
  reference: string | undefined;
  retryAction: string | undefined;
  retryable: boolean | undefined;
}> = [];
const terminalStop = await startPurchaseWorker({
  queue: terminalQueue,
  orderStore: terminalOrderStore,
  vendor: {
    ...vendor,
    async purchase(input) {
      return {
        vendorOrderReference: `GN-${input.idempotencyKey}`,
        status: "failed",
        raw: { status: "failed", reason: "vendor rejected order" }
      };
    }
  },
  async createOpsAlert(alert) {
    terminalAlerts.push({
      reference: alert.reference,
      retryAction: alert.retryAction,
      retryable: alert.retryable
    });
    return true;
  },
  logger: { error() {} }
});
await terminalQueue.enqueue(QUEUE_NAMES.purchaseRequested, {
  ...job,
  orderReference: terminalOrder.reference,
  packageId: terminalOrder.packageId,
  idempotencyKey: terminalOrder.idempotencyKey
});
const terminalFailed = await waitForOrder(
  terminalOrderStore,
  terminalOrder.reference,
  (current) => current?.status === "failed"
);
assert.equal(terminalFailed?.status, "failed");
await waitForCondition(() => terminalAlerts.length === 1);
assert.deepEqual(terminalAlerts[0], {
  reference: terminalOrder.reference,
  retryAction: "fulfill_order",
  retryable: true
});
await terminalStop();

const alreadyFulfilledOrderStore = createMemoryOrderStore();
const alreadyFulfilledOrder = await alreadyFulfilledOrderStore.createIntent({
  body: {
    packageId: "datamart:yello-5gb",
    network: "mtn",
    recipientPhone: "0551234567",
    confirmRecipientIsCorrect: true,
    paymentMethod: "paystack_momo"
  },
  vendor,
  idempotencyKey: "idem-already-fulfilled"
});
await alreadyFulfilledOrderStore.recordVendorResult(alreadyFulfilledOrder.reference, {
  vendorOrderReference: "GN-already-done",
  status: "processing"
});
let duplicateVendorCalls = 0;
let duplicateAcked = false;
await processPurchaseMessage(
  {
    id: "duplicate-message",
    queue: QUEUE_NAMES.purchaseRequested,
    attempts: 0,
    job: {
      ...job,
      orderReference: alreadyFulfilledOrder.reference,
      idempotencyKey: alreadyFulfilledOrder.idempotencyKey
    },
    async ack() {
      duplicateAcked = true;
    },
    async retry() {
      throw new Error("Duplicate fulfilled order should not retry.");
    },
    async deadLetter() {
      throw new Error("Duplicate fulfilled order should not dead-letter.");
    }
  },
  {
    queue,
    orderStore: alreadyFulfilledOrderStore,
    vendor: {
      ...vendor,
      async purchase(input) {
        duplicateVendorCalls += 1;
        return await vendor.purchase(input);
      }
    }
  }
);
assert.equal(duplicateVendorCalls, 0);
assert.equal(duplicateAcked, true);

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
const failed = await waitForOrder(
  failingOrderStore,
  failingOrder.reference,
  (current) => current?.status === "failed"
);
assert.equal(failed?.status, "failed");
assert.deepEqual(
  (failed?.vendorRaw as { workerError?: { message?: string } }).workerError?.message,
  "permanent vendor failure"
);
await waitForCondition(
  async () => (await failingQueue.getDepth(QUEUE_NAMES.purchaseDead)) === 1
);
assert.equal(await failingQueue.getDepth(QUEUE_NAMES.purchaseDead), 1);
await stopFailing();

async function waitForOrder(
  store: ReturnType<typeof createMemoryOrderStore>,
  reference: string,
  predicate: (
    order: Awaited<ReturnType<ReturnType<typeof createMemoryOrderStore>["getByReference"]>>
  ) => boolean,
  timeoutMs = 1000
) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const order = await store.getByReference(reference);

    if (predicate(order)) {
      return order;
    }

    await new Promise((resolve) => setTimeout(resolve, 5));
  }

  throw new Error(`Timed out waiting for order ${reference}.`);
}

async function waitForCondition(
  predicate: () => boolean | Promise<boolean>,
  timeoutMs = 1000
) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await predicate()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 5));
  }

  throw new Error("Timed out waiting for condition.");
}
