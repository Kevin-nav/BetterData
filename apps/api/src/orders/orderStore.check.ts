import assert from "node:assert/strict";

import { createMemoryOrderStore } from "./orderStore";
import { createOrderStore } from "./orderStore";

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
assert.match(
  order.reference,
  /^BD-[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/
);
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

await store.recordOrderFailure(order.reference, {
  status: "failed",
  vendorRaw: {
    enqueueError: {
      message: "queue unavailable"
    },
    vendorId: "datamart"
  }
});

const failed = await store.getByReference(order.reference);
assert.equal(failed?.status, "failed");
assert.deepEqual(failed?.vendorRaw, {
  enqueueError: {
    message: "queue unavailable"
  },
  vendorId: "datamart"
});

assert.throws(
  () => createOrderStore({ NODE_ENV: "production" }),
  /CONVEX_URL is required/
);
