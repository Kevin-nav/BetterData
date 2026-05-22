import { opsAlertFunctions } from "@betterdata/app-api";
import { getRequiredEnv } from "@betterdata/config";

import { createConvexHttpClient } from "../convexClient";

export type OpsAlertInput = {
  severity: "info" | "warning" | "critical";
  category: "payment" | "webhook" | "fulfillment" | "config" | "security";
  reference?: string;
  message: string;
  metadata?: Record<string, unknown>;
  retryable?: boolean;
  retryAction?:
    | "verify_payment"
    | "fulfill_order"
    | "credit_wallet"
    | "complete_agent_application";
  retryStatus?: "not_started" | "queued" | "running" | "succeeded" | "failed";
  nextRetryAt?: number;
};

export async function createOpsAlertSafely(alert: OpsAlertInput) {
  try {
    const convex = createConvexHttpClient();
    await convex.mutation(opsAlertFunctions.create, {
      serviceSecret: getRequiredEnv("BETTERDATA_SERVICE_SECRET"),
      ...alert
    });
    return true;
  } catch {
    return false;
  }
}
