import assert from "node:assert/strict";

process.env.TELEMETRY_HASH_SECRET = "test-secret";

const { hashForTelemetry, hashAnalyticsId } = await import("./hash");

const a = hashForTelemetry(" 0241234567 ");
const b = hashForTelemetry("0241234567");
const c = hashAnalyticsId("recipient", "0241234567");
const d = hashAnalyticsId("payment", "0241234567");

assert.equal(a, b);
assert.notEqual(c, d);
assert.equal(c?.length, 64);

console.log("hash checks passed");
