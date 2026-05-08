import type { DataVendor } from "../types";
import { SIMULATED_PACKAGES } from "../simulation/packages";
import { createSimulatedOrder, getSimulatedOrder } from "../simulation/store";

const THIRTY_MINUTES_MS = 30 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

export function createSandboxDelayedVendor(): DataVendor {
  return {
    id: "sandbox-delayed",
    displayName: "Sandbox Delayed",

    async listPackages() {
      return SIMULATED_PACKAGES;
    },

    async purchase(input) {
      const longDelay = input.recipientPhone.endsWith("60");
      const completeAfterMs = longDelay ? ONE_HOUR_MS : THIRTY_MINUTES_MS;
      const order = createSimulatedOrder(input, {
        prefix: longDelay ? "SD60" : "SD30",
        initialStatus: "processing",
        completeAfterMs
      });

      return {
        vendorOrderReference: order.reference,
        status: order.status,
        estimatedDeliverySeconds: completeAfterMs / 1000,
        raw: order
      };
    },

    async getOrderStatus(reference) {
      return getSimulatedOrder(reference)?.status ?? "failed";
    },

    async getBalance() {
      return { balanceGhs: 10000 };
    }
  };
}
