import assert from "node:assert/strict";

import { resolveRateLimitConfig } from "./rateLimits";

const defaults = resolveRateLimitConfig({});

assert.equal(defaults.global.max, 300);
assert.equal(defaults.ordersCreate.max, 20);
assert.equal(defaults.orderStatus.max, 60);
assert.equal(defaults.admin.max, 120);
assert.equal(defaults.webhook.max, 120);

const custom = resolveRateLimitConfig({
  API_RATE_LIMIT_GLOBAL_MAX: "100",
  API_RATE_LIMIT_GLOBAL_WINDOW: "30 seconds",
  API_RATE_LIMIT_ORDERS_CREATE_MAX: "5",
  API_RATE_LIMIT_ORDER_STATUS_MAX: "12",
  API_RATE_LIMIT_ADMIN_MAX: "40",
  API_RATE_LIMIT_WEBHOOK_MAX: "80"
});

assert.equal(custom.global.max, 100);
assert.equal(custom.global.timeWindow, "30 seconds");
assert.equal(custom.ordersCreate.max, 5);
assert.equal(custom.orderStatus.max, 12);
assert.equal(custom.admin.max, 40);
assert.equal(custom.webhook.max, 80);
