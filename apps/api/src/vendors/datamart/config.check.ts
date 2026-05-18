import assert from "node:assert/strict";

import { resolveDataMartConfig } from "./config";

const config = resolveDataMartConfig({
  DATAMART_API_KEY: "test-key"
});

assert.equal(config.baseUrl, "https://api.datamartgh.shop/api/developer");
assert.equal(config.apiKey, "test-key");
assert.equal(config.requestTimeoutMs, 15000);
assert.equal(config.retryCount, 1);
assert.equal(config.purchaseBatchWindowMs, 5000);
assert.equal(config.purchaseBurstWindowMs, 30000);
assert.equal(config.purchaseBurstThreshold, 20);
assert.equal(config.lowRateLimitRemainingThreshold, 20);
assert.equal(config.packagesCacheTtlSeconds, 300);
assert.equal(config.balanceCacheTtlSeconds, 30);
assert.equal(config.deliveryTrackerCacheTtlSeconds, 60);

const customized = resolveDataMartConfig({
  DATAMART_API_KEY: "test-key",
  DATAMART_BASE_URL: "https://example.com/api/",
  DATAMART_REQUEST_TIMEOUT_MS: "2000",
  DATAMART_RETRY_COUNT: "2",
  DATAMART_PURCHASE_BATCH_WINDOW_MS: "1000",
  DATAMART_PURCHASE_BURST_WINDOW_MS: "15000",
  DATAMART_PURCHASE_BURST_THRESHOLD: "5",
  DATAMART_LOW_RATE_LIMIT_REMAINING_THRESHOLD: "7",
  DATAMART_PACKAGES_CACHE_TTL_SECONDS: "120",
  DATAMART_BALANCE_CACHE_TTL_SECONDS: "15",
  DATAMART_DELIVERY_TRACKER_CACHE_TTL_SECONDS: "45"
});

assert.equal(customized.baseUrl, "https://example.com/api");
assert.equal(customized.requestTimeoutMs, 2000);
assert.equal(customized.retryCount, 2);
assert.equal(customized.purchaseBatchWindowMs, 1000);
assert.equal(customized.purchaseBurstWindowMs, 15000);
assert.equal(customized.purchaseBurstThreshold, 5);
assert.equal(customized.lowRateLimitRemainingThreshold, 7);
assert.equal(customized.packagesCacheTtlSeconds, 120);
assert.equal(customized.balanceCacheTtlSeconds, 15);
assert.equal(customized.deliveryTrackerCacheTtlSeconds, 45);

assert.throws(
  () => resolveDataMartConfig({}),
  /DATAMART_API_KEY is required/
);
