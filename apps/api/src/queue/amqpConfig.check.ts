import assert from "node:assert/strict";

import { resolveAmqpQueueConfig, shouldUseAmqpQueue } from "./amqpConfig";
import { QUEUE_NAMES } from "./types";

assert.equal(shouldUseAmqpQueue({ QUEUE_PROVIDER: "amqp" }), true);
assert.equal(shouldUseAmqpQueue({ QUEUE_PROVIDER: "local" }), false);

const config = resolveAmqpQueueConfig({
  CLOUDAMQP_URL: "amqps://example",
  QUEUE_PREFETCH: "10"
});

assert.equal(config.url, "amqps://example");
assert.equal(config.prefetch, 10);
assert.equal(config.queues.purchaseRequested, QUEUE_NAMES.purchaseRequested);

assert.throws(
  () => resolveAmqpQueueConfig({ QUEUE_PROVIDER: "amqp" }),
  /CLOUDAMQP_URL/
);
