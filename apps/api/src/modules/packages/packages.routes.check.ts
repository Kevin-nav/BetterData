import assert from "node:assert/strict";

import {
  mapConvexFallbackPackages,
  resolveVendorPackageCustomerPriceGhs,
  type ApiPricingContext
} from "./packages.routes";

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

assert.deepEqual(
  mapConvexFallbackPackages(
    [
      {
        _id: "pkg_mtn_2gb",
        vendorId: "datamart",
        vendorPackageId: "dm_2gb",
        network: "mtn",
        name: "2GB",
        sizeMb: 2048,
        providerCostGhs: 8,
        customerPriceGhs: 8,
        isAvailable: true
      }
    ],
    {
      packages: [
        {
          _id: "pkg_mtn_2gb",
          vendorId: "datamart",
          vendorPackageId: "dm_2gb"
        }
      ],
      pricingRules: [
        {
          _id: "rule_package",
          packageId: "pkg_mtn_2gb",
          mode: "fixed",
          value: 3,
          isGlobal: false
        }
      ],
      agentDiscountPercentage: 0
    }
  ),
  [
    {
      id: "pkg_mtn_2gb",
      vendorId: "datamart",
      vendorPackageId: "dm_2gb",
      network: "mtn",
      name: "2GB",
      sizeMb: 2048,
      costGhs: 8,
      customerPriceGhs: 11,
      isAvailable: true
    }
  ]
);

const pricingContext: ApiPricingContext = {
  packages: [
    {
      _id: "pkg_mtn_1gb",
      vendorId: "datamart",
      vendorPackageId: "dm_1gb"
    },
    {
      _id: "pkg_mtn_2gb",
      vendorId: "datamart",
      vendorPackageId: "dm_2gb"
    }
  ],
  pricingRules: [
    {
      _id: "rule_global",
      mode: "percentage",
      value: 25,
      isGlobal: true
    },
    {
      _id: "rule_package",
      packageId: "pkg_mtn_2gb",
      mode: "fixed",
      value: 3,
      isGlobal: false
    }
  ],
  agentDiscountPercentage: 20
};

assert.equal(
  resolveVendorPackageCustomerPriceGhs(
    "datamart",
    { vendorPackageId: "dm_1gb", costGhs: 4 },
    pricingContext,
    { applyAgentDiscount: true }
  ),
  4
);

assert.equal(
  resolveVendorPackageCustomerPriceGhs(
    "datamart",
    { vendorPackageId: "dm_2gb", costGhs: 8 },
    pricingContext,
    { applyAgentDiscount: true }
  ),
  8.8
);

assert.equal(
  resolveVendorPackageCustomerPriceGhs(
    "datamart",
    { vendorPackageId: "dm_2gb", costGhs: 8 },
    pricingContext
  ),
  11
);

assert.equal(
  resolveVendorPackageCustomerPriceGhs(
    "sandbox-fast",
    { vendorPackageId: "dm_1gb", costGhs: 4 },
    pricingContext
  ),
  5
);

assert.equal(
  resolveVendorPackageCustomerPriceGhs(
    "datamart",
    { vendorPackageId: "dm_1gb", costGhs: 4.234 },
    null
  ),
  4.23
);
