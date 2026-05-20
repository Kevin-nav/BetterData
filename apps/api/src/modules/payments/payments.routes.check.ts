import assert from "node:assert/strict";

import {
  buildPaidDataPurchaseJob,
  buildPaidDataPurchaseJobFromIntent
} from "./payments.routes";

const job = buildPaidDataPurchaseJob({
  providerReference: "BDP_data_purchase_123",
  packageId: "pkg_123",
  vendorPackageId: "dm_123",
  network: "mtn",
  recipientPhone: "0551234567",
  vendorId: "datamart"
});

assert.equal(job.kind, "purchase");
assert.equal(job.orderReference, "BDP_data_purchase_123");
assert.equal(job.idempotencyKey, "BDP_data_purchase_123");
assert.equal(job.packageId, "dm_123");
assert.equal(job.paymentMethod, "paystack_momo");
assert.equal(job.attempt, 0);

const jobFromIntent = buildPaidDataPurchaseJobFromIntent("BDP_ref", {
  purpose: "data_purchase",
  providerReference: "BDP_ref",
  purposeMetadata: {
    packageId: "pkg_123",
    vendorPackageId: "dm_123",
    network: "mtn",
    recipientPhone: "0551234567",
    vendorId: "datamart"
  }
});

assert.equal(jobFromIntent?.vendorId, "datamart");
assert.equal(jobFromIntent?.packageId, "dm_123");

assert.equal(
  buildPaidDataPurchaseJobFromIntent("BDP_wallet", {
    purpose: "wallet_top_up",
    providerReference: "BDP_wallet",
    purposeMetadata: {}
  }),
  null
);
