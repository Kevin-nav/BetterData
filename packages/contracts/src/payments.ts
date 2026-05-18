export type PaymentProvider = "paystack";

export type PaymentPurpose =
  | "data_purchase"
  | "wallet_top_up"
  | "agent_application_fee";

export type PaymentIntentStatus =
  | "pending"
  | "initialized"
  | "succeeded"
  | "failed"
  | "abandoned";

export type CreatePaymentIntentRequest =
  | {
      purpose: "data_purchase";
      userId?: string;
      packageId: string;
      network: "mtn" | "telecel" | "airteltigo";
      recipientPhone: string;
      customerEmail: string;
      confirmRecipientIsCorrect: true;
      savedNumberId?: string;
      guestContactPhone?: string;
    }
  | {
      purpose: "wallet_top_up";
      userId: string;
      customerEmail: string;
      amountGhs: number;
    }
  | {
      purpose: "agent_application_fee";
      userId: string;
      customerEmail: string;
    };

export type CreatePaymentIntentResponse = {
  provider: PaymentProvider;
  purpose: PaymentPurpose;
  reference: string;
  authorizationUrl: string;
  accessCode: string;
  amountGhs: number;
  currency: "GHS";
  status: PaymentIntentStatus;
};

export type PaymentIntentStatusResponse = {
  reference: string;
  purpose: PaymentPurpose;
  amountGhs: number;
  currency: "GHS";
  status: PaymentIntentStatus;
};

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
