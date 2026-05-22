import assert from "node:assert/strict";

import { createMemoryOrderStore, type StoredOrder } from "../orders/orderStore";
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
const updated = await waitForOrder(order.reference, (current) =>
  current !== null &&
  current.status === "completed" &&
  current.vendorOrderReference === "GN-STATUS"
);
assert.equal(updated?.status, "completed");
assert.equal(updated?.vendorOrderReference, "GN-STATUS");
await waitFor(async () => (await queue.getDepth(QUEUE_NAMES.statusRefresh)) === 0);
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
  maxAttempts: 2,
  retryDelayMs: 1
});
await retryQueue.enqueue(QUEUE_NAMES.statusRefresh, job);
await waitFor(() => retryAttempts === 2);
await waitFor(
  async () => (await retryQueue.getDepth(QUEUE_NAMES.statusRefresh)) === 0
);
await stopRetry();

const failedStatusQueue = createLocalQueueProvider();
const failedStatusAlerts: Array<{
  reference: string | undefined;
  retryAction: string | undefined;
  retryable: boolean | undefined;
}> = [];
const failedStatusVendor: DataVendor = {
  ...vendor,
  async getOrderStatus() {
    return "failed";
  }
};
const stopFailedStatus = await startStatusWorker({
  queue: failedStatusQueue,
  orderStore,
  vendor: failedStatusVendor,
  async createOpsAlert(alert) {
    failedStatusAlerts.push({
      reference: alert.reference,
      retryAction: alert.retryAction,
      retryable: alert.retryable
    });
    return true;
  },
  logger: { error() {} }
});
await failedStatusQueue.enqueue(QUEUE_NAMES.statusRefresh, job);
await waitForOrder(order.reference, (current) => current?.status === "failed");
await waitFor(() => failedStatusAlerts.length === 1);
assert.deepEqual(failedStatusAlerts[0], {
  reference: order.reference,
  retryAction: "fulfill_order",
  retryable: true
});
await stopFailedStatus();

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
await waitFor(
  async () => (await deadQueue.getDepth(QUEUE_NAMES.purchaseDead)) === 1
);
await waitFor(
  async () => (await deadQueue.getDepth(QUEUE_NAMES.statusRefresh)) === 0
);
await stopDead();

async function waitForOrder(
  reference: string,
  predicate: (
    order: StoredOrder | null
  ) => boolean,
  timeoutMs = 1000
): Promise<StoredOrder> {
  let latest: StoredOrder | null = null;

  await waitFor(async () => {
    latest = await orderStore.getByReference(reference);
    return predicate(latest);
  }, timeoutMs);

  assert.ok(latest);
  return latest;
}

async function waitFor(
  predicate: () => boolean | Promise<boolean>,
  timeoutMs = 1000,
  intervalMs = 5
) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await predicate()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error("Timed out waiting for status worker condition.");
}
