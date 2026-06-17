import assert from "node:assert/strict";

import { isClosedAmqpError, retryQueueFor } from "./amqpQueue";
import { createQueueProvider } from "./index";
import { createLocalQueueProvider } from "./localQueue";
import { QUEUE_NAMES, type PurchaseJob, type StatusRefreshJob } from "./types";

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

await waitFor(() => consumed === 1);
await waitFor(
  async () => (await queue.getDepth(QUEUE_NAMES.purchaseRequested)) === 0
);
await stop();

await queue.enqueue(QUEUE_NAMES.purchaseRequested, job);
const stopDeadLetter = await queue.consume(
  QUEUE_NAMES.purchaseRequested,
  async (message) => {
    await message.deadLetter("test failure");
  }
);
await waitFor(async () => (await queue.getDepth(QUEUE_NAMES.purchaseDead)) === 1);
await stopDeadLetter();

await queue.enqueue(QUEUE_NAMES.purchaseRequested, job);
let throwingAttempts = 0;
const stopThrowing = await queue.consume(
  QUEUE_NAMES.purchaseRequested,
  async (message) => {
    throwingAttempts += 1;

    if (throwingAttempts === 1) {
      throw new Error("consumer failed before ack");
    }

    assert.equal(message.attempts, 1);
    await message.ack();
  }
);
await waitFor(() => throwingAttempts === 2);
await waitFor(
  async () => (await queue.getDepth(QUEUE_NAMES.purchaseRequested)) === 0
);
await stopThrowing();

await queue.enqueue(QUEUE_NAMES.purchaseRequested, job);
let retriedAttempts = 0;
const stopRetry = await queue.consume(
  QUEUE_NAMES.purchaseRequested,
  async (message) => {
    if (message.attempts === 0) {
      await message.retry(1);
      return;
    }

    retriedAttempts = message.attempts;
    await message.ack();
  }
);
await waitFor(() => retriedAttempts === 1);
await waitFor(
  async () => (await queue.getDepth(QUEUE_NAMES.purchaseRequested)) === 0
);
await stopRetry();

const statusJob: StatusRefreshJob = {
  kind: "status-refresh",
  orderReference: "BD-123",
  vendorId: "datamart",
  vendorOrderReference: "GN-123",
  attempt: 0,
  createdAt: new Date(0).toISOString()
};

assert.equal(
  retryQueueFor(QUEUE_NAMES.statusRefresh),
  QUEUE_NAMES.statusRefreshRetry
);
assert.equal(retryQueueFor(QUEUE_NAMES.purchaseRequested), QUEUE_NAMES.purchaseRetry);
await queue.enqueue(QUEUE_NAMES.statusRefresh, statusJob);
assert.equal(await queue.getDepth(QUEUE_NAMES.statusRefresh), 1);

assert.equal(isClosedAmqpError(new Error("Channel closed")), true);
assert.equal(isClosedAmqpError(new Error("Connection closed by broker")), true);
assert.equal(isClosedAmqpError(new Error("ordinary publish failure")), false);

const previousNodeEnv = process.env.NODE_ENV;
const previousQueueProvider = process.env.QUEUE_PROVIDER;
process.env.NODE_ENV = "production";
process.env.QUEUE_PROVIDER = "local";
try {
  await assert.rejects(createQueueProvider(), /QUEUE_PROVIDER=amqp/);
} finally {
  if (previousNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = previousNodeEnv;
  }
  if (previousQueueProvider === undefined) {
    delete process.env.QUEUE_PROVIDER;
  } else {
    process.env.QUEUE_PROVIDER = previousQueueProvider;
  }
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

  throw new Error("Timed out waiting for queue condition.");
}
