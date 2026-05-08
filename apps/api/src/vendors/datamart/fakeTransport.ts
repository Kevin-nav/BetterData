import type { VendorPurchaseInput } from "@betterdata/contracts";

import {
  toDataMartProviderCode,
  type DataMartPackagePayload
} from "./mapper";

const packages: Record<string, DataMartPackagePayload[]> = {
  YELLO: [
    { capacity: 1, mb: 1024, network: "YELLO", price: 4 },
    { capacity: 2, mb: 2048, network: "YELLO", price: 9 },
    { capacity: 5, mb: 5120, network: "YELLO", price: 23 }
  ],
  TELECEL: [
    { capacity: 1, mb: 1024, network: "TELECEL", price: 4.5 },
    { capacity: 5, mb: 5120, network: "TELECEL", price: 24 }
  ],
  AT_PREMIUM: [
    { capacity: 1, mb: 1024, network: "AT_PREMIUM", price: 4.25 },
    { capacity: 3, mb: 3072, network: "AT_PREMIUM", price: 13 }
  ]
};

const orderStatuses = new Map<string, string>();

export async function fakeDataMartListPackages(network?: string) {
  return {
    status: "success",
    pricingTier: "reseller",
    data: network ? { [network]: packages[network] ?? [] } : packages,
    rateLimit: rateLimit()
  };
}

export async function fakeDataMartPurchase(
  input: VendorPurchaseInput,
  idempotencyKey: string
) {
  const network = toDataMartProviderCode(input.network);
  const capacity = packageCapacity(input.packageId);
  const reference = `GN-${idempotencyKey.slice(0, 8).toUpperCase()}`;
  const orderStatus = input.recipientPhone.endsWith("99")
    ? "failed"
    : input.recipientPhone.endsWith("60")
      ? "processing"
      : "completed";

  orderStatuses.set(reference, orderStatus);

  return {
    status: "success",
    message: "Data bundle purchased successfully",
    request: {
      phoneNumber: input.recipientPhone,
      network,
      capacity,
      gateway: "wallet"
    },
    data: {
      purchaseId: `fake-${Date.now()}`,
      orderReference: reference,
      transactionReference: `TRX-${idempotencyKey}`,
      network,
      capacity: Number(capacity),
      price: packagePrice(network, Number(capacity)),
      balanceBefore: 1000,
      balanceAfter: 1000 - packagePrice(network, Number(capacity)),
      orderStatus,
      processingMethod: "betterdata_fake_datamart"
    },
    rateLimit: rateLimit()
  };
}

export async function fakeDataMartGetOrderStatus(reference: string) {
  return {
    status: "success",
    data: {
      orderId: `fake-${reference}`,
      reference,
      phoneNumber: "0551234567",
      network: "YELLO",
      capacity: 5,
      price: 23,
      orderStatus: orderStatuses.get(reference) ?? "processing",
      processingMethod: "betterdata_fake_datamart",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    rateLimit: rateLimit()
  };
}

export async function fakeDataMartGetBalance() {
  return {
    status: "success",
    data: {
      balance: 1000,
      currency: "GHS",
      user: {
        id: "fake-datamart-user",
        name: "Better Data Sandbox",
        email: "sandbox@betterdatagh.com"
      },
      timestamp: new Date().toISOString()
    },
    rateLimit: rateLimit()
  };
}

function rateLimit() {
  return {
    limit: 150,
    remaining: 149,
    resetInSeconds: 45
  };
}

function packageCapacity(packageId: string) {
  const match = packageId.match(/(\d+)gb/i);
  return match?.[1] ?? "1";
}

function packagePrice(network: string, capacity: number) {
  return packages[network]?.find((item) => item.capacity === capacity)?.price ?? 4;
}
