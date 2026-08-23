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

export type AgentPricingConfig = {
  agentOnboardingFeeGhs: number;
  agentDiscountPercentage: number;
};

/**
 * Applies an active markup rule to a package's provider cost.
 *
 * Percentage rules are additive margins (cost * (1 + value/100)); fixed rules
 * add the value directly. When no rule applies the provider cost is returned
 * unchanged.
 */
export function computeCustomerPriceGhs(
  providerCostGhs: number,
  rule: Pick<PricingRule, "mode" | "value"> | null | undefined
): number {
  if (!rule) {
    return providerCostGhs;
  }

  return rule.mode === "percentage"
    ? providerCostGhs * (1 + rule.value / 100)
    : providerCostGhs + rule.value;
}

/**
 * Applies the agent discount percentage to a customer price, e.g. a 10%
 * discount turns GHS 5.00 into GHS 4.50.
 */
export function computeAgentPriceGhs(
  customerPriceGhs: number,
  agentDiscountPercentage: number
): number {
  return customerPriceGhs * (1 - agentDiscountPercentage / 100);
}
