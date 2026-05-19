import type { NetworkCode, PurchaseRequest } from "@betterdata/contracts";

const NETWORKS = new Set<NetworkCode>(["mtn", "telecel", "airteltigo"]);
const PAYMENT_METHODS = new Set(["paystack_momo", "wallet"]);

export type OrderValidationResult =
  | { ok: true; value: PurchaseRequest }
  | { ok: false; message: string };

export function validatePurchaseRequest(body: unknown): OrderValidationResult {
  if (!isRecord(body)) {
    return invalid("Request body must be a JSON object.");
  }

  const packageId = readString(body.packageId);
  const network = readString(body.network);
  const recipientPhone = readString(body.recipientPhone);
  const paymentMethod = readString(body.paymentMethod);

  if (!packageId || !isValidPackageId(packageId)) {
    return invalid("A valid packageId is required.");
  }

  if (!network || !NETWORKS.has(network as NetworkCode)) {
    return invalid("A valid network is required.");
  }

  const normalizedPhone = normalizeGhanaPhoneNumber(recipientPhone);

  if (!normalizedPhone) {
    return invalid("A valid Ghana recipient phone number is required.");
  }

  if (body.confirmRecipientIsCorrect !== true) {
    return invalid("Recipient number confirmation is required.");
  }

  if (!paymentMethod || !PAYMENT_METHODS.has(paymentMethod)) {
    return invalid("A valid paymentMethod is required.");
  }

  return {
    ok: true,
    value: {
      packageId,
      network: network as NetworkCode,
      recipientPhone: normalizedPhone,
      confirmRecipientIsCorrect: true,
      paymentMethod: paymentMethod as PurchaseRequest["paymentMethod"],
      ...(typeof body.savedNumberId === "string" && body.savedNumberId.trim()
        ? { savedNumberId: body.savedNumberId.trim() }
        : {})
    }
  };
}

export function normalizeGhanaPhoneNumber(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const digits = value.replace(/\D/g, "");

  if (/^0[235]\d{8}$/.test(digits)) {
    return digits;
  }

  if (/^233[235]\d{8}$/.test(digits)) {
    return `0${digits.slice(3)}`;
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : undefined;
}

function isValidPackageId(value: string) {
  return /^[a-z0-9][a-z0-9:_-]{1,80}$/i.test(value);
}

function invalid(message: string): OrderValidationResult {
  return { ok: false, message };
}
