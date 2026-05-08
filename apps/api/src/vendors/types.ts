import type { IncomingHttpHeaders } from "node:http";

import type {
  DataVendorId,
  VendorBalance,
  VendorDeliveryTracker,
  VendorOrderStatus,
  VendorPackage,
  VendorPurchaseInput,
  VendorPurchaseResult,
  VendorWebhookEvent
} from "@betterdata/contracts";

export type DataVendor = {
  id: DataVendorId;
  displayName: string;
  listPackages(): Promise<VendorPackage[]>;
  purchase(input: VendorPurchaseInput): Promise<VendorPurchaseResult>;
  getOrderStatus(reference: string): Promise<VendorOrderStatus>;
  getBalance(): Promise<VendorBalance>;
  getDeliveryTracker?(): Promise<VendorDeliveryTracker>;
  normalizeWebhook?(
    payload: unknown,
    headers: IncomingHttpHeaders
  ): Promise<VendorWebhookEvent>;
};
