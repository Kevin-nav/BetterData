import assert from "node:assert/strict";

import { createSandboxDelayedVendor } from "../sandbox/delayed";
import { createSandboxFastVendor } from "../sandbox/fast";
import { createSandboxFlakyVendor } from "../sandbox/flaky";

const fast = createSandboxFastVendor();
const fastOrder = await fast.purchase({
  packageId: "mtn-1gb",
  network: "mtn",
  recipientPhone: "0551234567",
  idempotencyKey: "fast-1"
});
assert.equal(fastOrder.status, "completed");

const delayed = createSandboxDelayedVendor();
const delayed30 = await delayed.purchase({
  packageId: "mtn-1gb",
  network: "mtn",
  recipientPhone: "0551234567",
  idempotencyKey: "delay-30"
});
assert.equal(delayed30.status, "processing");
assert.equal(delayed30.estimatedDeliverySeconds, 30 * 60);

const delayed60 = await delayed.purchase({
  packageId: "mtn-1gb",
  network: "mtn",
  recipientPhone: "0551234560",
  idempotencyKey: "delay-60"
});
assert.equal(delayed60.status, "processing");
assert.equal(delayed60.estimatedDeliverySeconds, 60 * 60);

const flaky = createSandboxFlakyVendor();
const flakyOrder = await flaky.purchase({
  packageId: "mtn-1gb",
  network: "mtn",
  recipientPhone: "0551234599",
  idempotencyKey: "flaky-1"
});
assert.equal(flakyOrder.status, "processing");
