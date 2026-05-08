import type {
  VendorPackage,
  VendorPurchaseInput,
  VendorPurchaseResult
} from "@betterdata/contracts";

import type { DataVendor } from "../types";
import {
  mapDataMartPackage,
  mapDataMartStatus,
  toDataMartProviderCode,
  type DataMartPackagePayload
} from "./mapper";

export function createDataMartVendor(): DataVendor {
  const baseUrl = process.env.DATAMART_BASE_URL;
  const apiKey = process.env.DATAMART_API_KEY;

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    if (!baseUrl || !apiKey) {
      throw new Error("DataMart vendor is not configured.");
    }

    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        ...(init?.headers ?? {})
      }
    });

    if (!response.ok) {
      throw new Error(`DataMart request failed: ${response.status}`);
    }

    return (await response.json()) as T;
  }

  return {
    id: "datamart",
    displayName: "DataMartGH",

    async listPackages(): Promise<VendorPackage[]> {
      const response = await request<{ packages?: unknown[] }>("/data-packages");

      return (response.packages ?? [])
        .map((item) => mapDataMartPackage(item as DataMartPackagePayload))
        .filter((item): item is VendorPackage => Boolean(item));
    },

    async purchase(input: VendorPurchaseInput): Promise<VendorPurchaseResult> {
      const response = await request<{ reference?: string; status?: string }>(
        "/purchase",
        {
          method: "POST",
          headers: {
            "x-idempotency-key": input.idempotencyKey
          },
          body: JSON.stringify({
            package_id: input.packageId,
            network: toDataMartProviderCode(input.network),
            recipient_phone: input.recipientPhone
          })
        }
      );

      if (!response.reference) {
        throw new Error("DataMart purchase response did not include a reference.");
      }

      return {
        vendorOrderReference: response.reference,
        status: mapDataMartStatus(response.status ?? "processing"),
        raw: response
      };
    },

    async getOrderStatus(reference: string) {
      const response = await request<{ status?: string }>(
        `/order-status/${reference}`
      );

      return mapDataMartStatus(response.status ?? "processing");
    },

    async getBalance() {
      const response = await request<{ balance?: number }>("/balance");

      return {
        balanceGhs: response.balance ?? 0,
        raw: response
      };
    }
  };
}
