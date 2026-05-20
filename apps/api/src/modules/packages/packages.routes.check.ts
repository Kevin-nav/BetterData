import assert from "node:assert/strict";

import { mapConvexFallbackPackages } from "./packages.routes";

assert.deepEqual(
  mapConvexFallbackPackages([
    {
      _id: "pkg_123",
      vendorId: "datamart",
      vendorPackageId: "dm_123",
      network: "mtn",
      name: "1GB",
      sizeMb: 1024,
      providerCostGhs: 4,
      customerPriceGhs: 5,
      isAvailable: true
    }
  ]),
  [
    {
      id: "pkg_123",
      vendorId: "datamart",
      vendorPackageId: "dm_123",
      network: "mtn",
      name: "1GB",
      sizeMb: 1024,
      costGhs: 4,
      customerPriceGhs: 5,
      isAvailable: true
    }
  ]
);
