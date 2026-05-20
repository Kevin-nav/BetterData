import assert from "node:assert/strict";

import {
  fromDataMartProviderCode,
  mapDataMartBulkPurchaseResponse,
  mapDataMartPackage,
  mapDataMartPackageGroups,
  mapDataMartPurchaseResponse,
  mapDataMartStatus,
  toDataMartProviderCode
} from "./mapper";

assert.equal(toDataMartProviderCode("mtn"), "YELLO");
assert.equal(toDataMartProviderCode("telecel"), "TELECEL");
assert.equal(toDataMartProviderCode("airteltigo"), "AT_PREMIUM");

assert.equal(fromDataMartProviderCode("YELLO"), "mtn");
assert.equal(fromDataMartProviderCode(" yello "), "mtn");
assert.equal(fromDataMartProviderCode("TELECEL"), "telecel");
assert.equal(fromDataMartProviderCode("AT_PREMIUM"), "airteltigo");
assert.equal(fromDataMartProviderCode("at_premium"), "airteltigo");

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

const mappedStringPackage = mapDataMartPackage({
  capacity: "1",
  mb: "1000",
  network: "YELLO",
  price: "4"
});

assert.equal(mappedStringPackage?.vendorPackageId, "yello-1gb");
assert.equal(mappedStringPackage?.network, "mtn");
assert.equal(mappedStringPackage?.name, "MTN 1GB");
assert.equal(mappedStringPackage?.sizeMb, 1000);
assert.equal(mappedStringPackage?.costGhs, 4);
assert.equal(
  mapDataMartPackage({
    capacity: 5,
    network: "YELLO",
    price: 23
  }),
  undefined
);
assert.equal(
  mapDataMartPackage({
    capacity: 5,
    mb: 5120,
    network: "YELLO"
  }),
  undefined
);
assert.equal(
  mapDataMartPackage({
    capacity: " ",
    mb: "5120",
    network: "YELLO",
    price: "23"
  }),
  undefined
);
assert.equal(
  mapDataMartPackage({
    capacity: "5",
    mb: "",
    network: "YELLO",
    price: "23"
  }),
  undefined
);
assert.equal(
  mapDataMartPackage({
    capacity: 5,
    mb: "unknown",
    network: "YELLO",
    price: "23"
  }),
  undefined
);
assert.equal(
  mapDataMartPackage({
    capacity: 5,
    mb: "5120",
    network: "YELLO",
    price: "unknown"
  }),
  undefined
);

const mappedGroupedPackages = mapDataMartPackageGroups({
  YELLO: [{ capacity: "1", mb: "1000", price: "4" }],
  unknown: [{ capacity: "1", mb: "1000", price: "4" }]
});

assert.equal(mappedGroupedPackages.length, 1);
assert.equal(mappedGroupedPackages[0]?.network, "mtn");
assert.equal(mappedGroupedPackages[0]?.sizeMb, 1000);

const purchase = mapDataMartPurchaseResponse({
  data: {
    orderReference: "GN-AB12CD34",
    orderStatus: "completed"
  }
});

assert.equal(purchase.vendorOrderReference, "GN-AB12CD34");
assert.equal(purchase.status, "completed");

const bulk = mapDataMartBulkPurchaseResponse({
  status: "success",
  data: {
    results: [
      {
        ref: "idem-1",
        orderReference: "MY-001",
        status: "queued"
      },
      {
        ref: "idem-2",
        orderReference: "MY-002",
        status: "completed"
      },
      {
        ref: "missing-reference",
        status: "queued"
      }
    ],
    validationErrors: [{ index: 3, message: "Invalid phone" }]
  }
});

assert.equal(bulk.size, 2);
assert.equal(bulk.get("idem-1")?.vendorOrderReference, "MY-001");
assert.equal(bulk.get("idem-1")?.status, "processing");
assert.equal(bulk.get("idem-2")?.status, "completed");
