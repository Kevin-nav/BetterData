import assert from "node:assert/strict";

import { orderLogFields } from "./logFields";
import {
  createMemoryMetricsBackend,
  createUpstashMetricsBackend,
  configureMetricsFromEnv,
  getMetric,
  incrementMetric,
  resetMetricsForTests,
  setMetricsBackend,
  snapshotMetrics
} from "./metrics";

assert.deepEqual(orderLogFields({ orderReference: "BD-1", attempt: 2 }), {
  orderReference: "BD-1",
  attempt: 2
});

setMetricsBackend(createMemoryMetricsBackend());
await resetMetricsForTests();
await incrementMetric("purchase.success");
await incrementMetric("purchase.success", 2);
assert.equal(await getMetric("purchase.success"), 3);
assert.deepEqual(await snapshotMetrics(), { "purchase.success": 3 });

const calls: string[] = [];
setMetricsBackend({
  async increment(name, amount) {
    calls.push(`increment:${name}:${amount}`);
  },
  async get(name) {
    calls.push(`get:${name}`);
    return 7;
  },
  async snapshot() {
    calls.push("snapshot");
    return { shared: 7 };
  },
  async resetForTests() {
    calls.push("reset");
  }
});
await incrementMetric("shared", 3);
assert.equal(await getMetric("shared"), 7);
assert.deepEqual(await snapshotMetrics(), { shared: 7 });
await resetMetricsForTests();
assert.deepEqual(calls, [
  "increment:shared:3",
  "get:shared",
  "snapshot",
  "reset"
]);

const redisCalls: unknown[] = [];
const upstashBackend = createUpstashMetricsBackend({
  async hashIncrementByFloat(key, field, amount) {
    redisCalls.push(["hincr", key, field, amount]);
  },
  async hashGetNumber(key, field) {
    redisCalls.push(["hget", key, field]);
    return 9;
  },
  async hashGetAllNumbers(key) {
    redisCalls.push(["hgetall", key]);
    return { shared: 9 };
  },
  async del(key) {
    redisCalls.push(["del", key]);
  }
});

setMetricsBackend(upstashBackend);
await incrementMetric("shared", 4);
assert.equal(await getMetric("shared"), 9);
assert.deepEqual(await snapshotMetrics(), { shared: 9 });
await resetMetricsForTests();
assert.deepEqual(redisCalls, [
  ["hincr", "metrics:counters", "shared", 4],
  ["hget", "metrics:counters", "shared"],
  ["hgetall", "metrics:counters"],
  ["del", "metrics:counters"]
]);

assert.throws(
  () => configureMetricsFromEnv({ NODE_ENV: "production" }),
  /UPSTASH_REDIS_REST_URL/
);
setMetricsBackend(createMemoryMetricsBackend());
