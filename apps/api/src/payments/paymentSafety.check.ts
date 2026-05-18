import assert from "node:assert/strict";

import { verifyPurchasePaymentSafety } from "./paymentSafety";

const base = {
  packageId: "datamart:yello-5gb",
  network: "mtn" as const,
  recipientPhone: "0551234567",
  confirmRecipientIsCorrect: true as const
};

assert.deepEqual(
  verifyPurchasePaymentSafety({ ...base, paymentMethod: "wallet" }, {}),
  {
    ok: false,
    statusCode: 409,
    message: "Verified wallet debit is required before vendor purchase."
  }
);
assert.deepEqual(
  verifyPurchasePaymentSafety(
    { ...base, paymentMethod: "wallet" },
    { ALLOW_UNVERIFIED_WALLET_ORDERS: "true" }
  ),
  { ok: true, paymentStatus: "verified" }
);
assert.deepEqual(
  verifyPurchasePaymentSafety({ ...base, paymentMethod: "paystack_momo" }, {}),
  {
    ok: false,
    statusCode: 402,
    message: "Verified Paystack payment is required before vendor purchase."
  }
);
assert.deepEqual(
  verifyPurchasePaymentSafety(
    { ...base, paymentMethod: "paystack_momo" },
    { ALLOW_UNVERIFIED_PAYSTACK_ORDERS: "true" }
  ),
  { ok: true, paymentStatus: "verified" }
);
