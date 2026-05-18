import assert from "node:assert/strict";

import { classifyVendorBalance } from "./admin.routes";

assert.equal(classifyVendorBalance(null), "unknown");
assert.equal(classifyVendorBalance(49), "critical");
assert.equal(classifyVendorBalance(50), "critical");
assert.equal(classifyVendorBalance(51), "low");
assert.equal(classifyVendorBalance(200), "low");
assert.equal(classifyVendorBalance(201), "healthy");

assert.equal(
  classifyVendorBalance(75, {
    VENDOR_BALANCE_CRITICAL_GHS: "100",
    VENDOR_BALANCE_LOW_GHS: "500"
  }),
  "critical"
);

assert.equal(
  classifyVendorBalance(300, {
    VENDOR_BALANCE_CRITICAL_GHS: "100",
    VENDOR_BALANCE_LOW_GHS: "500"
  }),
  "low"
);
