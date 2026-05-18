import type {
  VendorPackage,
  VendorPurchaseInput,
  VendorPurchaseResult
} from "@betterdata/contracts";

import type { DataVendor } from "../types";
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
      }
    | undefined;

  function getRuntime() {
    if (!runtime) {
      const config = resolveDataMartConfig();
      const transport = createDataMartTransport({ config });
      runtime = {
        transport,
        dispatcher: createDataMartPurchaseDispatcher({ transport, config })
      };
    }

    return runtime;
  }

  return {
    id: "datamart",
    displayName: "DataMartGH",

    async listPackages(): Promise<VendorPackage[]> {
      const response = await getRuntime().transport.listPackages();
      const body = response.body as { data?: Parameters<typeof mapDataMartPackageGroups>[0] };

      return mapDataMartPackageGroups(body.data ?? {});
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
      const response = await getRuntime().transport.getBalance();

      return mapDataMartBalanceResponse(
        response.body as Parameters<typeof mapDataMartBalanceResponse>[0]
      );
    },

    async getDeliveryTracker() {
      const response = await getRuntime().transport.getDeliveryTracker();

      return mapDataMartDeliveryTrackerResponse(
        response.body as Parameters<typeof mapDataMartDeliveryTrackerResponse>[0]
      );
    },

    async normalizeWebhook(payload) {
      return mapDataMartWebhook(payload);
    }
  };
}
