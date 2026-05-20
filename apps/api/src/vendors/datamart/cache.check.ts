import assert from "node:assert/strict";

import { createDataMartCache, createUpstashDataMartCache } from "./cache";

const calls: unknown[] = [];
const cache = createUpstashDataMartCache(
  {
    async acquireLock(key, owner, ttlSeconds) {
      calls.push(["lock", key, owner, ttlSeconds]);
      return true;
    },
    async releaseLock(key, owner) {
      calls.push(["unlock", key, owner]);
    },
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
assert.deepEqual(
  await cache.getOrRefreshPackages(async () => {
    throw new Error("Cached packages should not refresh.");
  }),
  [{ id: "pkg-1" }]
);
await cache.setBalance({ balanceGhs: 50 });
await cache.setDeliveryTracker({
  message: "ok",
  scanner: { active: true, waiting: false, waitSeconds: 0 },
  stats: { checked: 1, delivered: 1, partial: 0, pending: 0, failed: 0 }
});
assert.deepEqual(calls, [
  ["get", "datamart:packages"],
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

const refreshCalls: unknown[] = [];
const refreshCache = createUpstashDataMartCache(
  {
    async acquireLock(key, owner, ttlSeconds) {
      refreshCalls.push(["lock", key, typeof owner, ttlSeconds]);
      return true;
    },
    async releaseLock(key, owner) {
      refreshCalls.push(["unlock", key, typeof owner]);
    },
    async getJson(key) {
      refreshCalls.push(["get", key]);
      return null;
    },
    async setJson(key, value, ttlSeconds) {
      refreshCalls.push(["set", key, value, ttlSeconds]);
    }
  },
  {
    packagesCacheTtlSeconds: 120,
    balanceCacheTtlSeconds: 15,
    deliveryTrackerCacheTtlSeconds: 45
  }
);
assert.deepEqual(
  await refreshCache.getOrRefreshPackages(async () => [
    {
      vendorPackageId: "pkg-2",
      network: "mtn",
      name: "1GB",
      sizeMb: 1024,
      costGhs: 5,
      isAvailable: true
    }
  ]),
  [
    {
      vendorPackageId: "pkg-2",
      network: "mtn",
      name: "1GB",
      sizeMb: 1024,
      costGhs: 5,
      isAvailable: true
    }
  ]
);
assert.deepEqual(refreshCalls, [
  ["get", "datamart:packages"],
  ["lock", "datamart:packages:refresh", "string", 30],
  [
    "set",
    "datamart:packages",
    [
      {
        vendorPackageId: "pkg-2",
        network: "mtn",
        name: "1GB",
        sizeMb: 1024,
        costGhs: 5,
        isAvailable: true
      }
    ],
    120
  ],
  ["unlock", "datamart:packages:refresh", "string"]
]);

const lockedCache = createUpstashDataMartCache(
  {
    async acquireLock() {
      return false;
    },
    async releaseLock() {},
    async getJson() {
      return null;
    },
    async setJson() {
      throw new Error("Locked refresh should not write cache.");
    }
  },
  {
    packagesCacheTtlSeconds: 120,
    balanceCacheTtlSeconds: 15,
    deliveryTrackerCacheTtlSeconds: 45
  }
);
assert.equal(
  await lockedCache.getOrRefreshPackages(async () => {
    throw new Error("Locked refresh should not call DataMart.");
  }),
  null
);

const noop = createDataMartCache(
  {
    packagesCacheTtlSeconds: 120,
    balanceCacheTtlSeconds: 15,
    deliveryTrackerCacheTtlSeconds: 45
  },
  {}
);
assert.equal(await noop.getPackages(), null);
assert.deepEqual(await noop.getOrRefreshPackages(async () => []), []);
