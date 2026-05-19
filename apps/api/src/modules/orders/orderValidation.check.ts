import assert from "node:assert/strict";

import {
  normalizeGhanaPhoneNumber,
  validatePurchaseRequest
} from "./orderValidation";

assert.equal(normalizeGhanaPhoneNumber("0551234567"), "0551234567");
assert.equal(normalizeGhanaPhoneNumber("+233 55 123 4567"), "0551234567");
assert.equal(normalizeGhanaPhoneNumber("12345"), undefined);

const valid = validatePurchaseRequest({
  packageId: "datamart:yello-5gb",
  network: "mtn",
  recipientPhone: "+233 55 123 4567",
  confirmRecipientIsCorrect: true,
  paymentMethod: "wallet"
});

assert.equal(valid.ok, true);
if (valid.ok) {
  assert.equal(valid.value.recipientPhone, "0551234567");
}

assert.deepEqual(validatePurchaseRequest(undefined), {
  ok: false,
  message: "Request body must be a JSON object."
});
assert.equal(
  validatePurchaseRequest({
    packageId: "bad package!",
    network: "mtn",
    recipientPhone: "0551234567",
    confirmRecipientIsCorrect: true,
    paymentMethod: "wallet"
  }).ok,
  false
);
assert.equal(
  validatePurchaseRequest({
    packageId: "datamart:yello-5gb",
    network: "vodafone",
    recipientPhone: "0551234567",
    confirmRecipientIsCorrect: true,
    paymentMethod: "wallet"
  }).ok,
  false
);
assert.equal(
  validatePurchaseRequest({
    packageId: "datamart:yello-5gb",
    network: "mtn",
    recipientPhone: "12345",
    confirmRecipientIsCorrect: true,
    paymentMethod: "wallet"
  }).ok,
  false
);
assert.equal(
  validatePurchaseRequest({
    packageId: "datamart:yello-5gb",
    network: "mtn",
    recipientPhone: "0551234567",
    confirmRecipientIsCorrect: false,
    paymentMethod: "wallet"
  }).ok,
  false
);
assert.equal(
  validatePurchaseRequest({
    packageId: "datamart:yello-5gb",
    network: "mtn",
    recipientPhone: "0551234567",
    confirmRecipientIsCorrect: true,
    paymentMethod: "cash"
  }).ok,
  false
);
