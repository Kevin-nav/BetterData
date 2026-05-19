import assert from "node:assert/strict";

import { createDataMartCache, createUpstashDataMartCache } from "./cache";

const calls: unknown[] = [];
const cache = createUpstashDataMartCache(
  {
    async getJson(key) {
      calls.push(["get", key]);
      return (key === "datamart:packages" ? [{ id: "pkg-1" }] : null) as never;
    },
    async setJson(key, value, ttlSeconds) {
      calls.push(["set", key, value, ttlSeconds]);
    }
  },
  {
    packagesCacheTtlSeconds: 120,
    balanceCacheTtlSeconds: 15,
    deliveryTrackerCacheTtlSeconds: 45
  }
);

assert.deepEqual(await cache.getPackages(), [{ id: "pkg-1" }]);
await cache.setBalance({ balanceGhs: 50 });
await cache.setDeliveryTracker({
  message: "ok",
  scanner: { active: true, waiting: false, waitSeconds: 0 },
  stats: { checked: 1, delivered: 1, partial: 0, pending: 0, failed: 0 }
});
assert.deepEqual(calls, [
  ["get", "datamart:packages"],
  ["set", "datamart:balance", { balanceGhs: 50 }, 15],
  [
    "set",
    "datamart:delivery-tracker",
    {
      message: "ok",
      scanner: { active: true, waiting: false, waitSeconds: 0 },
      stats: { checked: 1, delivered: 1, partial: 0, pending: 0, failed: 0 }
    },
    45
  ]
]);

const noop = createDataMartCache(
  {
    packagesCacheTtlSeconds: 120,
    balanceCacheTtlSeconds: 15,
    deliveryTrackerCacheTtlSeconds: 45
  },
  {}
);
assert.equal(await noop.getPackages(), null);
