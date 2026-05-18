import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

import { verifyDataVendorWebhook } from "./webhookVerification";

assert.deepEqual(
  verifyDataVendorWebhook({}, "{}", { NODE_ENV: "development" }),
  {
    ok: false,
    statusCode: 500,
    message: "Webhook verification is not configured."
  }
);
assert.deepEqual(
  verifyDataVendorWebhook({}, "{}", {
    NODE_ENV: "development",
    WEBHOOK_ALLOW_INSECURE: "true"
  }),
  { ok: true }
);
assert.deepEqual(
  verifyDataVendorWebhook({}, "{}", { NODE_ENV: "production" }),
  {
    ok: false,
    statusCode: 500,
    message: "Webhook verification is not configured."
  }
);
assert.deepEqual(
  verifyDataVendorWebhook(
    { "x-betterdata-webhook-secret": "secret" },
    "{}",
    { NODE_ENV: "production", WEBHOOK_SECRET: "secret" }
  ),
  { ok: true }
);
assert.deepEqual(
  verifyDataVendorWebhook(
    { "x-betterdata-webhook-secret": "bad" },
    "{}",
    { NODE_ENV: "production", WEBHOOK_SECRET: "secret" }
  ),
  {
    ok: false,
    statusCode: 401,
    message: "Invalid webhook credentials."
  }
);

const timestamp = String(Date.now());
const rawBody = JSON.stringify({ data: { orderReference: "GN-1" } });
const rawBodyBuffer = Buffer.from(rawBody);
const signature = createHmac("sha256", "hmac-secret")
  .update(Buffer.concat([Buffer.from(`${timestamp}.`), rawBodyBuffer]))
  .digest("hex");

assert.deepEqual(
  verifyDataVendorWebhook(
    { "x-signature": signature, "x-timestamp": timestamp },
    rawBodyBuffer,
    { NODE_ENV: "production", WEBHOOK_HMAC_SECRET: "hmac-secret" }
  ),
  { ok: true }
);
assert.equal(
  verifyDataVendorWebhook(
    { "x-signature": "bad", "x-timestamp": timestamp },
    rawBody,
    { NODE_ENV: "production", WEBHOOK_HMAC_SECRET: "hmac-secret" }
  ).ok,
  false
);
