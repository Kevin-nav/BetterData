import type {
  VendorPackage,
  VendorPurchaseInput,
  VendorPurchaseResult
} from "@betterdata/contracts";

import type { DataVendor } from "../types";
import { createDataMartCache, type DataMartCache } from "./cache";
import { resolveDataMartConfig } from "./config";
import {
  mapDataMartBalanceResponse,
  mapDataMartDeliveryTrackerResponse,
  mapDataMartPackageGroups,
  mapDataMartStatusResponse,
  mapDataMartWebhook
} from "./mapper";
import { createDataMartPurchaseDispatcher } from "./purchaseDispatcher";
import { createDataMartTransport, type DataMartTransport } from "./transport";

export function createDataMartVendor(): DataVendor {
  let runtime:
    | {
        transport: DataMartTransport;
        dispatcher: ReturnType<typeof createDataMartPurchaseDispatcher>;
        cache: DataMartCache;
      }
    | undefined;

  function getRuntime() {
    if (!runtime) {
      const config = resolveDataMartConfig();
      const transport = createDataMartTransport({ config });
      runtime = {
        transport,
        dispatcher: createDataMartPurchaseDispatcher({ transport, config }),
        cache: createDataMartCache(config)
      };
    }

    return runtime;
  }

  return {
    id: "datamart",
    displayName: "DataMartGH",

    async listPackages(): Promise<VendorPackage[]> {
      const runtime = getRuntime();
      const cached = await runtime.cache.getPackages();

      if (cached) {
        return cached;
      }

      const response = await runtime.transport.listPackages();
      const body = response.body as { data?: Parameters<typeof mapDataMartPackageGroups>[0] };
      const packages = mapDataMartPackageGroups(body.data ?? {});

      await runtime.cache.setPackages(packages);

      return packages;
    },

    async purchase(input: VendorPurchaseInput): Promise<VendorPurchaseResult> {
      const result = await getRuntime().dispatcher.purchase(input);

      return {
        ...result,
        estimatedDeliverySeconds: result.status === "processing" ? 30 * 60 : 0
      };
    },

    async getOrderStatus(reference: string) {
      const response = await getRuntime().transport.getOrderStatus(reference);

      return mapDataMartStatusResponse(
        response.body as Parameters<typeof mapDataMartStatusResponse>[0]
      );
    },

    async getBalance() {
      const runtime = getRuntime();
      const cached = await runtime.cache.getBalance();

      if (cached) {
        return cached;
      }

      const response = await runtime.transport.getBalance();
      const balance = mapDataMartBalanceResponse(
        response.body as Parameters<typeof mapDataMartBalanceResponse>[0]
      );

      await runtime.cache.setBalance(balance);

      return balance;
    },

    async getDeliveryTracker() {
      const runtime = getRuntime();
      const cached = await runtime.cache.getDeliveryTracker();

      if (cached) {
        return cached;
      }

      const response = await runtime.transport.getDeliveryTracker();
      const tracker = mapDataMartDeliveryTrackerResponse(
        response.body as Parameters<typeof mapDataMartDeliveryTrackerResponse>[0]
      );

      await runtime.cache.setDeliveryTracker(tracker);

      return tracker;
    },

    async normalizeWebhook(payload) {
      return mapDataMartWebhook(payload);
    }
  };
}
