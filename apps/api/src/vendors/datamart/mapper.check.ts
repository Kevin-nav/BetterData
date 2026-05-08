import assert from "node:assert/strict";

import {
  fromDataMartProviderCode,
  mapDataMartStatus,
  toDataMartProviderCode
} from "./mapper";

assert.equal(toDataMartProviderCode("mtn"), "YELLO");
assert.equal(toDataMartProviderCode("telecel"), "TELECEL");
assert.equal(toDataMartProviderCode("airteltigo"), "AT_PREMIUM");

assert.equal(fromDataMartProviderCode("YELLO"), "mtn");
assert.equal(fromDataMartProviderCode("TELECEL"), "telecel");
assert.equal(fromDataMartProviderCode("AT_PREMIUM"), "airteltigo");

assert.equal(mapDataMartStatus("success"), "completed");
assert.equal(mapDataMartStatus("completed"), "completed");
assert.equal(mapDataMartStatus("failed"), "failed");
assert.equal(mapDataMartStatus("refunded"), "refunded");
assert.equal(mapDataMartStatus("pending"), "processing");
