export type MarkupMode = "percentage" | "fixed";

export type PricingRule = {
  id: string;
  packageId?: string;
  mode: MarkupMode;
  value: number;
  isGlobal: boolean;
};

export type DiscountConfig = {
  firstPurchaseDiscountGhs: number;
  agentDiscountPercentage: number;
  minimumWalletTopUpGhs: number;
  maximumWalletTopUpGhs: number;
  agentOnboardingFeeGhs: number;
  paymentIntentExpirySeconds: number;
};
