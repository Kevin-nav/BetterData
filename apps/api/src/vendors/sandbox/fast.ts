import type { DataVendor } from "../types";
import { SIMULATED_PACKAGES } from "../simulation/packages";
import { createSimulatedOrder, getSimulatedOrder } from "../simulation/store";

export function createSandboxFastVendor(): DataVendor {
  return {
    id: "sandbox-fast",
    displayName: "Sandbox Fast",

    async listPackages() {
      return SIMULATED_PACKAGES;
    },

    async purchase(input) {
      const order = createSimulatedOrder(input, {
        prefix: "SFX",
        initialStatus: "completed"
      });

      return {
        vendorOrderReference: order.reference,
        status: order.status,
        estimatedDeliverySeconds: 0,
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
