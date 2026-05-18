import assert from "node:assert/strict";

import { createMemoryOrderStore } from "./orderStore";

const store = createMemoryOrderStore();
const order = await store.createIntent({
  body: {
    packageId: "datamart:yello-5gb",
    network: "mtn",
    recipientPhone: "0551234567",
    confirmRecipientIsCorrect: true,
    paymentMethod: "wallet"
  },
  vendor: {
    id: "datamart",
    displayName: "DataMartGH",
    async listPackages() {
      return [];
    },
    async purchase() {
      throw new Error("not used");
    },
    async getOrderStatus() {
      return "processing";
    },
    async getBalance() {
      return { balanceGhs: 0 };
    }
  },
  idempotencyKey: "idem-1"
});

assert.match(order.reference, /^BD-/);
assert.equal(order.vendorPackageId, "yello-5gb");
assert.equal(order.status, "pending");

await store.recordVendorResult(order.reference, {
  vendorOrderReference: "GN-123",
  status: "processing",
  vendorRaw: { ok: true }
});

const updated = await store.getByReference(order.reference);
assert.equal(updated?.vendorOrderReference, "GN-123");
assert.equal(updated?.status, "processing");
