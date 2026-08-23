import { describe, expect, it } from "vitest";

import {
  computeAgentPriceGhs,
  computeCustomerPriceGhs,
  type PricingRule,
} from "../src/pricing";

function rule(mode: PricingRule["mode"], value: number): PricingRule {
  return { id: "rule_1", mode, value, isGlobal: false };
}

describe("computeCustomerPriceGhs", () => {
  it("returns the provider cost when no rule applies", () => {
    expect(computeCustomerPriceGhs(5, null)).toBe(5);
    expect(computeCustomerPriceGhs(5, undefined)).toBe(5);
  });

  it("applies percentage markup additively", () => {
    expect(computeCustomerPriceGhs(10, rule("percentage", 20))).toBeCloseTo(
      12,
      10,
    );
    expect(computeCustomerPriceGhs(7.5, rule("percentage", 100))).toBeCloseTo(
      15,
      10,
    );
  });

  it("applies zero percentage markup unchanged", () => {
    expect(computeCustomerPriceGhs(3.33, rule("percentage", 0))).toBe(3.33);
  });

  it("adds fixed markup directly", () => {
    expect(computeCustomerPriceGhs(10, rule("fixed", 1.5))).toBe(11.5);
    expect(computeCustomerPriceGhs(4, rule("fixed", 0))).toBe(4);
  });
});

describe("computeAgentPriceGhs", () => {
  it("reduces the customer price by the discount percentage", () => {
    expect(computeAgentPriceGhs(5, 10)).toBeCloseTo(4.5, 10);
    expect(computeAgentPriceGhs(20, 25)).toBeCloseTo(15, 10);
  });

  it("keeps the price intact at zero discount", () => {
    expect(computeAgentPriceGhs(9.99, 0)).toBe(9.99);
  });

  it("yields zero at a full discount", () => {
    expect(computeAgentPriceGhs(8, 100)).toBe(0);
  });
});
