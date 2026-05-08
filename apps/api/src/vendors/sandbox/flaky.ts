import type { DataVendor } from "../types";
import { SIMULATED_PACKAGES } from "../simulation/packages";
import { createSimulatedOrder, getSimulatedOrder } from "../simulation/store";

export function createSandboxFlakyVendor(): DataVendor {
  return {
    id: "sandbox-flaky",
    displayName: "Sandbox Flaky",

    async listPackages() {
      return SIMULATED_PACKAGES;
    },

    async purchase(input) {
      const shouldFail = input.recipientPhone.endsWith("99");
      const options = {
        prefix: shouldFail ? "SFL" : "SFS",
        initialStatus: "processing" as const
      };

      const order = createSimulatedOrder(
        input,
        shouldFail
          ? { ...options, failAfterMs: 2 * 60 * 1000 }
          : { ...options, completeAfterMs: 2 * 60 * 1000 }
      );

      return {
        vendorOrderReference: order.reference,
        status: order.status,
        estimatedDeliverySeconds: 120,
        raw: order
      };
    },

    async getOrderStatus(reference) {
      return getSimulatedOrder(reference)?.status ?? "failed";
    },

    async getBalance() {
      return { balanceGhs: 250 };
    }
  };
}
