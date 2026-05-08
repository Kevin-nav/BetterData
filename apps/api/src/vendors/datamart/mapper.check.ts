import assert from "node:assert/strict";

import {
  fromDataMartProviderCode,
  mapDataMartPackage,
  mapDataMartPurchaseResponse,
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
assert.equal(mapDataMartStatus("waiting"), "processing");
assert.equal(mapDataMartStatus("processing"), "processing");

const mappedPackage = mapDataMartPackage({
  capacity: 5,
  mb: 5120,
  network: "YELLO",
  price: 23
});

assert.equal(mappedPackage?.vendorPackageId, "yello-5gb");
assert.equal(mappedPackage?.network, "mtn");
assert.equal(mappedPackage?.name, "MTN 5GB");
assert.equal(mappedPackage?.sizeMb, 5120);
assert.equal(mappedPackage?.costGhs, 23);

const purchase = mapDataMartPurchaseResponse({
  data: {
    orderReference: "GN-AB12CD34",
    orderStatus: "completed"
  }
});

assert.equal(purchase.vendorOrderReference, "GN-AB12CD34");
assert.equal(purchase.status, "completed");
