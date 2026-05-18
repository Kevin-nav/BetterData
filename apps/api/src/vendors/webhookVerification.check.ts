import assert from "node:assert/strict";

import { verifyDataVendorWebhook } from "./webhookVerification";

assert.deepEqual(
  verifyDataVendorWebhook({}, { NODE_ENV: "development" }),
  { ok: true }
);
assert.deepEqual(
  verifyDataVendorWebhook({}, { NODE_ENV: "production" }),
  {
    ok: false,
    statusCode: 500,
    message: "Webhook verification is not configured."
  }
);
assert.deepEqual(
  verifyDataVendorWebhook(
    { "x-betterdata-webhook-secret": "secret" },
    { NODE_ENV: "production", WEBHOOK_SECRET: "secret" }
  ),
  { ok: true }
);
assert.deepEqual(
  verifyDataVendorWebhook(
    { "x-betterdata-webhook-secret": "bad" },
    { NODE_ENV: "production", WEBHOOK_SECRET: "secret" }
  ),
  {
    ok: false,
    statusCode: 401,
    message: "Invalid webhook credentials."
  }
);
