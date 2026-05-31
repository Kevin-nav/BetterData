import assert from "node:assert/strict";

import {
  ANALYTICS_EVENTS,
  normalizeAnalyticsProperties,
  type AnalyticsEventName
} from "./analytics";

assert.equal(ANALYTICS_EVENTS.includes("payment_started"), true);

const eventName: AnalyticsEventName = "order_completed";
assert.equal(eventName, "order_completed");

const normalized = normalizeAnalyticsProperties({
  environment: "production",
  platform: "web",
  role: "agent",
  amount_ghs: 12,
  empty: "",
  missing: undefined,
  raw_phone_number: "0241234567"
});

assert.deepEqual(normalized, {
  environment: "production",
  platform: "web",
  role: "agent",
  amount_ghs: 12
});

console.log("analytics contract checks passed");
