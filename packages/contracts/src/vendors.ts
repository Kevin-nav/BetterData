import type { NetworkCode } from "./networks";

export type DataVendorId =
  | "datamart"
  | "sandbox-fast"
  | "sandbox-delayed"
  | "sandbox-flaky";

export type VendorOrderStatus =
  | "processing"
  | "completed"
  | "failed"
  | "refunded";

export type VendorErrorCode =
  | "vendor_unavailable"
  | "package_unavailable"
  | "insufficient_vendor_balance"
  | "duplicate_request"
  | "invalid_recipient"
  | "unknown_vendor_error";

export type VendorPackage = {
  vendorPackageId: string;
  network: NetworkCode;
  name: string;
  sizeMb: number;
  costGhs: number;
  isAvailable: boolean;
  raw?: unknown;
};

export type VendorPurchaseInput = {
  packageId: string;
  network: NetworkCode;
  recipientPhone: string;
  idempotencyKey: string;
};

export type VendorPurchaseResult = {
  vendorOrderReference: string;
  status: VendorOrderStatus;
  estimatedDeliverySeconds?: number;
  raw?: unknown;
};

export type VendorBalance = {
  balanceGhs: number;
  raw?: unknown;
};

export type VendorWebhookEvent = {
  vendorOrderReference: string;
  status: VendorOrderStatus;
  raw?: unknown;
};

export type VendorDeliveryTracker = {
  message: string;
  scanner: {
    active: boolean;
    waiting: boolean;
    waitSeconds: number;
  };
  stats: {
    checked: number;
    delivered: number;
    partial: number;
    pending: number;
    failed: number;
  };
  raw?: unknown;
};
