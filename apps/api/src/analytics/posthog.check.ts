import assert from "node:assert/strict";

import { buildPostHogEvent, isPostHogEnabled } from "./posthog";

assert.equal(isPostHogEnabled({ POSTHOG_PROJECT_API_KEY: "" }), false);
assert.equal(isPostHogEnabled({ POSTHOG_PROJECT_API_KEY: "phc_test", POSTHOG_DISABLED: "true" }), false);
assert.equal(isPostHogEnabled({ POSTHOG_PROJECT_API_KEY: "phc_test" }), true);
assert.equal(isPostHogEnabled({ POSTHOG_PROJECT_TOKEN: "phc_test" }), true);

const event = buildPostHogEvent({
  distinctId: "user_hash",
  event: "payment_succeeded",
  properties: {
    environment: "production",
    platform: "web",
    amount_ghs: 20,
    raw_phone: "0241234567",
    payment_hash: "payment_hash"
  }
});

assert.deepEqual(event, {
  distinctId: "user_hash",
  event: "payment_succeeded",
  properties: {
    environment: "production",
    platform: "web",
    amount_ghs: 20,
    payment_hash: "payment_hash"
  }
});

console.log("posthog helper checks passed");
