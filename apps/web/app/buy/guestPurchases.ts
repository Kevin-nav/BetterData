import type { NetworkCode, PaymentIntentStatus } from "@betterdata/contracts";

export const GUEST_PURCHASES_KEY = "betterdata:guest-purchases:v1";

export type GuestPurchaseRecord = {
  reference: string;
  packageId: string;
  network: NetworkCode;
  recipientPhone: string;
  sizeMb?: number;
  amountGhs: number;
  paymentStatus: PaymentIntentStatus;
  deliveryStatus?: "pending" | "processing" | "completed" | "failed" | "refunded";
  createdAt: string;
  updatedAt: string;
};

export function readGuestPurchases() {
  if (typeof window === "undefined") {
    return [] as GuestPurchaseRecord[];
  }

  try {
    const raw = window.localStorage.getItem(GUEST_PURCHASES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isGuestPurchaseRecord).slice(0, 20);
  } catch {
    return [];
  }
}

export function upsertGuestPurchase(record: GuestPurchaseRecord) {
  if (typeof window === "undefined") {
    return;
  }

  const existing = readGuestPurchases();
  const next = [
    record,
    ...existing.filter((item) => item.reference !== record.reference)
  ].slice(0, 20);

  window.localStorage.setItem(GUEST_PURCHASES_KEY, JSON.stringify(next));
}

export function updateGuestPurchase(
  reference: string,
  patch: Partial<Omit<GuestPurchaseRecord, "reference" | "createdAt">>
) {
  const existing = readGuestPurchases();
  const current = existing.find((item) => item.reference === reference);
  if (!current) return;

  upsertGuestPurchase({
    ...current,
    ...patch,
    updatedAt: new Date().toISOString()
  });
}

export function findGuestPurchase(reference: string) {
  return readGuestPurchases().find((item) => item.reference === reference) ?? null;
}

function isGuestPurchaseRecord(value: unknown): value is GuestPurchaseRecord {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Partial<GuestPurchaseRecord>;
  return (
    typeof record.reference === "string" &&
    typeof record.packageId === "string" &&
    isNetworkCode(record.network) &&
    typeof record.recipientPhone === "string" &&
    typeof record.amountGhs === "number" &&
    typeof record.paymentStatus === "string" &&
    typeof record.createdAt === "string" &&
    typeof record.updatedAt === "string"
  );
}

function isNetworkCode(value: unknown): value is NetworkCode {
  return value === "mtn" || value === "telecel" || value === "airteltigo";
}
