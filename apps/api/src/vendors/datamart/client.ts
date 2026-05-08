import type {
  VendorPackage,
  VendorPurchaseInput,
  VendorPurchaseResult
} from "@betterdata/contracts";

import type { DataVendor } from "../types";
import {
  fakeDataMartGetBalance,
  fakeDataMartGetOrderStatus,
  fakeDataMartListPackages,
  fakeDataMartPurchase
} from "./fakeTransport";
import {
  mapDataMartBalanceResponse,
  mapDataMartPackageGroups,
  mapDataMartPurchaseResponse,
  mapDataMartStatusResponse,
  mapDataMartWebhook
} from "./mapper";

export function createDataMartVendor(): DataVendor {
  return {
    id: "datamart",
    displayName: "DataMartGH",

    async listPackages(): Promise<VendorPackage[]> {
      const response = await fakeDataMartListPackages();

      return mapDataMartPackageGroups(response.data);
    },

    async purchase(input: VendorPurchaseInput): Promise<VendorPurchaseResult> {
      const response = await fakeDataMartPurchase(input, input.idempotencyKey);
      const result = mapDataMartPurchaseResponse(response);

      return {
        ...result,
        estimatedDeliverySeconds: result.status === "processing" ? 30 * 60 : 0
      };
    },

    async getOrderStatus(reference: string) {
      const response = await fakeDataMartGetOrderStatus(reference);

      return mapDataMartStatusResponse(response);
    },

    async getBalance() {
      const response = await fakeDataMartGetBalance();

      return mapDataMartBalanceResponse(response);
    },

    async normalizeWebhook(payload) {
      return mapDataMartWebhook(payload);
    }
  };
}
