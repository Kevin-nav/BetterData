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
      packageId: string;
      network: "mtn" | "telecel" | "airteltigo";
      recipientPhone: string;
      confirmRecipientIsCorrect: true;
      savedNumberId?: string;
    }
  | {
      purpose: "wallet_top_up";
      amountGhs: number;
    }
  | {
      purpose: "agent_application_fee";
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
  failureReason?: string;
  dataPurchase?: {
    packageId: string;
    vendorPackageId?: string;
    network: "mtn" | "telecel" | "airteltigo";
    recipientPhone: string;
    sizeMb?: number;
  };
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

export type OpsAlertSeverity = "info" | "warning" | "critical";
export type OpsAlertStatus = "open" | "acknowledged" | "resolved";
export type OpsAlertCategory =
  | "payment"
  | "webhook"
  | "fulfillment"
  | "config"
  | "security";
export type OpsAlertRetryAction =
  | "verify_payment"
  | "fulfill_order"
  | "credit_wallet"
  | "complete_agent_application";
export type OpsAlertRetryStatus =
  | "not_started"
  | "queued"
  | "running"
  | "succeeded"
  | "failed";
