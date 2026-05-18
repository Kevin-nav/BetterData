import { randomUUID } from "node:crypto";

import type { NetworkCode, OrderStatus, PurchaseRequest } from "@betterdata/contracts";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

import type { DataVendor } from "../vendors/types";

export type StoredOrder = {
  reference: string;
  packageId: string;
  vendorId: string;
  vendorPackageId?: string;
  vendorOrderReference?: string;
  vendorRaw?: unknown;
  network: NetworkCode;
  recipientPhone: string;
  amountGhs: number;
  paymentMethod: PurchaseRequest["paymentMethod"];
  paymentStatus: "pending" | "verified" | "failed" | "refunded";
  status: OrderStatus;
  idempotencyKey: string;
};

export type CreateOrderIntentInput = {
  body: PurchaseRequest;
  vendor: DataVendor;
  idempotencyKey: string;
};

export type OrderStore = {
  createIntent(input: CreateOrderIntentInput): Promise<StoredOrder>;
  getByReference(reference: string): Promise<StoredOrder | null>;
  recordVendorResult(
    reference: string,
    result: {
      vendorOrderReference: string;
      vendorRaw?: unknown;
      status: OrderStatus;
    }
  ): Promise<void>;
};

export function createOrderStore(env: NodeJS.ProcessEnv = process.env): OrderStore {
  if (env.CONVEX_URL) {
    return createConvexOrderStore(env.CONVEX_URL);
  }

  return createMemoryOrderStore();
}

export function createMemoryOrderStore(): OrderStore {
  const orders = new Map<string, StoredOrder>();

  return {
    async createIntent(input) {
      const order = buildStoredOrder(input);
      orders.set(order.reference, order);

      return order;
    },

    async getByReference(reference) {
      return orders.get(reference) ?? null;
    },

    async recordVendorResult(reference, result) {
      const order = orders.get(reference);

      if (!order) {
        throw new Error(`Order ${reference} was not found.`);
      }

      orders.set(reference, {
        ...order,
        vendorOrderReference: result.vendorOrderReference,
        ...(result.vendorRaw !== undefined ? { vendorRaw: result.vendorRaw } : {}),
        status: result.status
      });
    }
  };
}

function createConvexOrderStore(convexUrl: string): OrderStore {
  const client = new ConvexHttpClient(convexUrl);
  const createIntent = makeFunctionReference<"mutation">("orders:createIntent");
  const getByReferenceForApi = makeFunctionReference<"query">(
    "orders:getByReferenceForApi"
  );
  const recordVendorResult = makeFunctionReference<"mutation">(
    "orders:recordVendorResult"
  );

  return {
    async createIntent(input) {
      const order = buildStoredOrder(input);

      await client.mutation(createIntent, {
        reference: order.reference,
        packageId: order.packageId,
        vendorId: order.vendorId,
        ...(order.vendorPackageId ? { vendorPackageId: order.vendorPackageId } : {}),
        network: order.network,
        recipientPhone: order.recipientPhone,
        amountGhs: order.amountGhs,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        idempotencyKey: order.idempotencyKey,
        confirmRecipientIsCorrect: true
      });

      return order;
    },

    async getByReference(reference) {
      const order = await client.query(getByReferenceForApi, { reference });

      return order ? mapConvexOrder(order as Partial<StoredOrder>) : null;
    },

    async recordVendorResult(reference, result) {
      await client.mutation(recordVendorResult, {
        reference,
        vendorOrderReference: result.vendorOrderReference,
        vendorRaw: result.vendorRaw,
        status: result.status
      });
    }
  };
}

function buildStoredOrder(input: CreateOrderIntentInput): StoredOrder {
  const vendorPackageId = vendorPackageIdFrom(input.body.packageId);

  return {
    reference: createOrderReference(),
    packageId: input.body.packageId,
    vendorId: input.vendor.id,
    ...(vendorPackageId ? { vendorPackageId } : {}),
    network: input.body.network,
    recipientPhone: input.body.recipientPhone,
    amountGhs: 0,
    paymentMethod: input.body.paymentMethod,
    paymentStatus: "pending",
    status: "pending",
    idempotencyKey: input.idempotencyKey
  };
}

function vendorPackageIdFrom(packageId: string) {
  return packageId.includes(":") ? packageId.split(":").at(-1) : packageId;
}

function mapConvexOrder(order: Partial<StoredOrder>): StoredOrder {
  return {
    reference: requiredString(order.reference, "reference"),
    packageId: requiredString(order.packageId, "packageId"),
    vendorId: requiredString(order.vendorId, "vendorId"),
    ...(order.vendorPackageId ? { vendorPackageId: order.vendorPackageId } : {}),
    ...(order.vendorOrderReference
      ? { vendorOrderReference: order.vendorOrderReference }
      : {}),
    ...(order.vendorRaw !== undefined ? { vendorRaw: order.vendorRaw } : {}),
    network: order.network as NetworkCode,
    recipientPhone: requiredString(order.recipientPhone, "recipientPhone"),
    amountGhs: typeof order.amountGhs === "number" ? order.amountGhs : 0,
    paymentMethod: order.paymentMethod ?? "wallet",
    paymentStatus: order.paymentStatus ?? "pending",
    status: order.status ?? "pending",
    idempotencyKey: requiredString(order.idempotencyKey, "idempotencyKey")
  };
}

function createOrderReference() {
  return `BD-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || !value) {
    throw new Error(`Order ${field} is missing.`);
  }

  return value;
}
