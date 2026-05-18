import assert from "node:assert/strict";

import { createLocalQueueProvider } from "./localQueue";
import { QUEUE_NAMES, type PurchaseJob } from "./types";

const queue = createLocalQueueProvider();
const job: PurchaseJob = {
  kind: "purchase",
  orderReference: "BD-123",
  packageId: "datamart:yello-5gb",
  network: "mtn",
  recipientPhone: "0551234567",
  paymentMethod: "wallet",
  vendorId: "datamart",
  idempotencyKey: "idem-1",
  attempt: 0,
  createdAt: new Date(0).toISOString()
};

await queue.enqueue(QUEUE_NAMES.purchaseRequested, job);
assert.equal(await queue.getDepth(QUEUE_NAMES.purchaseRequested), 1);

let consumed = 0;
const stop = await queue.consume(QUEUE_NAMES.purchaseRequested, async (message) => {
  consumed += 1;
  assert.equal(message.job.kind, "purchase");
  assert.equal(message.job.orderReference, "BD-123");
  await message.ack();
});

await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(consumed, 1);
assert.equal(await queue.getDepth(QUEUE_NAMES.purchaseRequested), 0);
await stop();

await queue.enqueue(QUEUE_NAMES.purchaseRequested, job);
const stopDeadLetter = await queue.consume(
  QUEUE_NAMES.purchaseRequested,
  async (message) => {
    await message.deadLetter("test failure");
  }
);
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(await queue.getDepth(QUEUE_NAMES.purchaseDead), 1);
await stopDeadLetter();
