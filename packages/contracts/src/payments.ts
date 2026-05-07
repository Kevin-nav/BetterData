export type PaymentProvider = "paystack";

export type WalletTransactionType =
  | "top_up"
  | "purchase"
  | "refund"
  | "admin_credit"
  | "admin_debit";

export type WalletTransaction = {
  id: string;
  userId: string;
  type: WalletTransactionType;
  amountGhs: number;
  reference: string;
  createdAt: string;
};
