import type {
  DataVendorId,
  VendorBalance,
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
  normalizeWebhook?(
    payload: unknown,
    headers: Record<string, string>
  ): Promise<VendorWebhookEvent>;
};
