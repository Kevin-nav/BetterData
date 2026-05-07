import type { DataMartNetworkCode } from "./networks";

export const ORDER_STATUSES = [
  "pending",
  "processing",
  "completed",
  "failed",
  "refunded"
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type PurchaseRequest = {
  packageId: string;
  network: DataMartNetworkCode;
  recipientPhone: string;
  confirmRecipientIsCorrect: true;
  paymentMethod: "paystack_momo" | "wallet";
  savedNumberId?: string;
};

export type Order = {
  id: string;
  reference: string;
  status: OrderStatus;
  packageId: string;
  network: DataMartNetworkCode;
  recipientPhone: string;
  amountGhs: number;
  createdAt: string;
  updatedAt: string;
};

export type DataMartWebhookEvent =
  | "order.created"
  | "order.completed"
  | "order.failed"
  | "order.refunded";
