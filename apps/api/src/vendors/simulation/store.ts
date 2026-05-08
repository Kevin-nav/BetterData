import type {
  VendorOrderStatus,
  VendorPurchaseInput
} from "@betterdata/contracts";

export type SimulatedOrder = {
  reference: string;
  input: VendorPurchaseInput;
  status: VendorOrderStatus;
  createdAt: number;
  updatedAt: number;
  completeAfterMs?: number;
  failAfterMs?: number;
};

const orders = new Map<string, SimulatedOrder>();

export function createSimulatedOrder(
  input: VendorPurchaseInput,
  options: {
    prefix: string;
    initialStatus: VendorOrderStatus;
    completeAfterMs?: number;
    failAfterMs?: number;
  }
) {
  const now = Date.now();
  const reference = `${options.prefix}-${now}-${Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase()}`;

  const order: SimulatedOrder = {
    reference,
    input,
    status: options.initialStatus,
    createdAt: now,
    updatedAt: now
  };

  if (options.completeAfterMs !== undefined) {
    order.completeAfterMs = options.completeAfterMs;
  }

  if (options.failAfterMs !== undefined) {
    order.failAfterMs = options.failAfterMs;
  }

  orders.set(reference, order);
  return materializeSimulatedOrder(order);
}

export function getSimulatedOrder(reference: string) {
  const order = orders.get(reference);
  return order ? materializeSimulatedOrder(order) : undefined;
}

export function setSimulatedOrderStatus(
  reference: string,
  status: VendorOrderStatus
) {
  const order = orders.get(reference);
  if (!order) {
    return undefined;
  }

  order.status = status;
  order.updatedAt = Date.now();
  return materializeSimulatedOrder(order);
}

export function listSimulatedOrders() {
  return Array.from(orders.values()).map(materializeSimulatedOrder);
}

function materializeSimulatedOrder(order: SimulatedOrder): SimulatedOrder {
  const elapsed = Date.now() - order.createdAt;

  if (
    order.status === "processing" &&
    order.failAfterMs &&
    elapsed >= order.failAfterMs
  ) {
    order.status = "failed";
    order.updatedAt = Date.now();
  }

  if (
    order.status === "processing" &&
    order.completeAfterMs &&
    elapsed >= order.completeAfterMs
  ) {
    order.status = "completed";
    order.updatedAt = Date.now();
  }

  return { ...order };
}
