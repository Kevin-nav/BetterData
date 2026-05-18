import type { PurchaseRequest } from "@betterdata/contracts";

export type PaymentSafetyResult =
  | {
      ok: true;
      paymentStatus: "verified";
    }
  | {
      ok: false;
      statusCode: 402 | 409;
      message: string;
    };

export function verifyPurchasePaymentSafety(
  body: PurchaseRequest,
  env: NodeJS.ProcessEnv = process.env
): PaymentSafetyResult {
  if (body.paymentMethod === "wallet") {
    if (env.ALLOW_UNVERIFIED_WALLET_ORDERS === "true") {
      return { ok: true, paymentStatus: "verified" };
    }

    return {
      ok: false,
      statusCode: 409,
      message: "Verified wallet debit is required before vendor purchase."
    };
  }

  if (env.ALLOW_UNVERIFIED_PAYSTACK_ORDERS === "true") {
    return { ok: true, paymentStatus: "verified" };
  }

  return {
    ok: false,
    statusCode: 402,
    message: "Verified Paystack payment is required before vendor purchase."
  };
}
