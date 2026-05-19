import { createHmac } from "node:crypto";
import assert from "node:assert/strict";

import {
  buildPaystackReference,
  ghsToPesewas,
  verifyPaystackSignature
} from "./client";

assert.equal(ghsToPesewas(10), 1000);
assert.equal(ghsToPesewas(10.5), 1050);
assert.throws(() => ghsToPesewas(0), /greater than zero/);
assert.throws(() => ghsToPesewas(-1), /greater than zero/);
assert.throws(() => ghsToPesewas(0.001), /too small after conversion: 0 pesewas/);

const rawBody = JSON.stringify({
  event: "charge.success",
  data: {
    reference: "bd-test-reference"
  }
});
const secret = "paystack-webhook-secret";
const signature = createHmac("sha512", secret).update(rawBody).digest("hex");

assert.equal(verifyPaystackSignature(rawBody, secret, signature), true);
assert.equal(verifyPaystackSignature(rawBody, secret, "bad-signature"), false);
assert.equal(verifyPaystackSignature(rawBody, secret, undefined), false);

const reference = buildPaystackReference("wallet_top_up");

assert.match(reference, /^[a-zA-Z0-9.\-=]+$/);
assert.match(reference, /^bd-wallet-top-up-/);
