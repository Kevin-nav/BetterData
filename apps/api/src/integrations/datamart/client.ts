import type { DataPackage, PurchaseRequest } from "@betterdata/contracts";

export type DataMartClient = {
  listPackages(): Promise<DataPackage[]>;
  purchase(input: PurchaseRequest, idempotencyKey: string): Promise<{ reference: string }>;
  getOrderStatus(reference: string): Promise<string>;
  getBalance(): Promise<{ balanceGhs: number }>;
};

export function createDataMartClient(): DataMartClient {
  return {
    async listPackages() {
      return [];
    },
    async purchase() {
      throw new Error("DataMartGH purchase integration is not implemented yet.");
    },
    async getOrderStatus() {
      throw new Error("DataMartGH order status integration is not implemented yet.");
    },
    async getBalance() {
      throw new Error("DataMartGH balance integration is not implemented yet.");
    }
  };
}
