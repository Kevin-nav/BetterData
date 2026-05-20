import { randomUUID } from "node:crypto";

import type { VendorBalance, VendorDeliveryTracker, VendorPackage } from "@betterdata/contracts";

import {
  createUpstashRedisClient,
  resolveUpstashRedisConfig,
  type UpstashRedisClient
} from "../../redis/upstash";
import type { DataMartConfig } from "./config";

export type DataMartCache = {
  getPackages(): Promise<VendorPackage[] | null>;
  setPackages(value: VendorPackage[]): Promise<void>;
  getOrRefreshPackages(
    refresh: () => Promise<VendorPackage[]>
  ): Promise<VendorPackage[] | null>;
  getBalance(): Promise<VendorBalance | null>;
  setBalance(value: VendorBalance): Promise<void>;
  getDeliveryTracker(): Promise<VendorDeliveryTracker | null>;
  setDeliveryTracker(value: VendorDeliveryTracker): Promise<void>;
};

export function createDataMartCache(
  config: Pick<
    DataMartConfig,
    | "packagesCacheTtlSeconds"
    | "balanceCacheTtlSeconds"
    | "deliveryTrackerCacheTtlSeconds"
  >,
  env: NodeJS.ProcessEnv = process.env
): DataMartCache {
  const redisConfig = resolveUpstashRedisConfig(env);

  if (!redisConfig) {
    return createNoopDataMartCache();
  }

  return createUpstashDataMartCache(
    createUpstashRedisClient({ config: redisConfig }),
    config
  );
}

export function createUpstashDataMartCache(
  redis: Pick<
    UpstashRedisClient,
    "getJson" | "setJson" | "acquireLock" | "releaseLock"
  >,
  config: Pick<
    DataMartConfig,
    | "packagesCacheTtlSeconds"
    | "balanceCacheTtlSeconds"
    | "deliveryTrackerCacheTtlSeconds"
  >
): DataMartCache {
  return {
    async getPackages() {
      return await redis.getJson<VendorPackage[]>("datamart:packages");
    },

    async setPackages(value) {
      await redis.setJson(
        "datamart:packages",
        value,
        config.packagesCacheTtlSeconds
      );
    },

    async getOrRefreshPackages(refresh) {
      const cached = await redis.getJson<VendorPackage[]>("datamart:packages");

      if (cached) {
        return cached;
      }

      const owner = randomUUID();
      const lockKey = "datamart:packages:refresh";
      const locked = await redis.acquireLock(lockKey, owner, 30);

      if (!locked) {
        return await redis.getJson<VendorPackage[]>("datamart:packages");
      }

      try {
        const packages = await refresh();
        await redis.setJson(
          "datamart:packages",
          packages,
          config.packagesCacheTtlSeconds
        );

        return packages;
      } finally {
        await redis.releaseLock(lockKey, owner);
      }
    },

    async getBalance() {
      return await redis.getJson<VendorBalance>("datamart:balance");
    },

    async setBalance(value) {
      await redis.setJson("datamart:balance", value, config.balanceCacheTtlSeconds);
    },

    async getDeliveryTracker() {
      return await redis.getJson<VendorDeliveryTracker>(
        "datamart:delivery-tracker"
      );
    },

    async setDeliveryTracker(value) {
      await redis.setJson(
        "datamart:delivery-tracker",
        value,
        config.deliveryTrackerCacheTtlSeconds
      );
    }
  };
}

function createNoopDataMartCache(): DataMartCache {
  return {
    async getPackages() {
      return null;
    },
    async setPackages() {},
    async getOrRefreshPackages(refresh) {
      return await refresh();
    },
    async getBalance() {
      return null;
    },
    async setBalance() {},
    async getDeliveryTracker() {
      return null;
    },
    async setDeliveryTracker() {}
  };
}
