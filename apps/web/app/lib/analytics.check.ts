import assert from "node:assert/strict";

import { buildWebAnalyticsProperties, shouldEnableSessionReplay } from "./analytics";

assert.equal(shouldEnableSessionReplay(0.1, 0.05), true);
assert.equal(shouldEnableSessionReplay(0.1, 0.5), false);

assert.deepEqual(
  buildWebAnalyticsProperties({
    role: "agent",
    environment: "production",
    amount_ghs: 10,
    raw_phone: "0241234567"
  }),
  {
    platform: "web",
    role: "agent",
    environment: "production",
    amount_ghs: 10
  }
);

console.log("web analytics checks passed");
