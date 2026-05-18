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
  paymentStatus?: StoredOrder["paymentStatus"];
};

export type OrderStore = {
  createIntent(input: CreateOrderIntentInput): Promise<StoredOrder>;
  getByReference(reference: string): Promise<StoredOrder | null>;
  listOrders(): Promise<StoredOrder[]>;
  recordVendorResult(
    reference: string,
    result: {
      vendorOrderReference: string;
      vendorRaw?: unknown;
      status: OrderStatus;
    }
  ): Promise<void>;
  recordOrderFailure(
    reference: string,
    failure: {
      status: "failed";
      vendorRaw: unknown;
    }
  ): Promise<void>;
};

export function createOrderStore(env: NodeJS.ProcessEnv = process.env): OrderStore {
  if (env.CONVEX_URL) {
    return createConvexOrderStore(env.CONVEX_URL);
  }

  if (env.NODE_ENV === "production") {
    throw new Error("CONVEX_URL is required for production order persistence.");
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

    async listOrders() {
      return [...orders.values()].reverse();
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
    },

    async recordOrderFailure(reference, failure) {
      const order = orders.get(reference);

      if (!order) {
        throw new Error(`Order ${reference} was not found.`);
      }

      orders.set(reference, {
        ...order,
        vendorRaw: failure.vendorRaw,
        status: failure.status
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
  const listForApi = makeFunctionReference<"query">("orders:listForApi");
  const recordVendorResult = makeFunctionReference<"mutation">(
    "orders:recordVendorResult"
  );
  const recordFailureForApi = makeFunctionReference<"mutation">(
    "orders:recordFailureForApi"
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

    async listOrders() {
      const orders = await client.query(listForApi, {});

      return Array.isArray(orders)
        ? orders.map((order) => mapConvexOrder(order as Partial<StoredOrder>))
        : [];
    },

    async recordVendorResult(reference, result) {
      await client.mutation(recordVendorResult, {
        reference,
        vendorOrderReference: result.vendorOrderReference,
        vendorRaw: result.vendorRaw,
        status: result.status
      });
    },

    async recordOrderFailure(reference, failure) {
      await client.mutation(recordFailureForApi, {
        reference,
        vendorRaw: failure.vendorRaw,
        status: failure.status
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
    paymentStatus: input.paymentStatus ?? "pending",
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
  return `BD-${randomUUID().toUpperCase()}`;
}

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || !value) {
    throw new Error(`Order ${field} is missing.`);
  }

  return value;
}
