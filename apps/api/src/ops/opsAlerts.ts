import { opsAlertFunctions } from "@betterdata/app-api";
import { getRequiredEnv } from "@betterdata/config";

import { createConvexHttpClient } from "../convexClient";
import { sendBroadcastEmail } from "../integrations/resend/client";

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

type OpsAlertCreateResult = {
  alertId: string;
  created: boolean;
};

export async function createOpsAlertSafely(alert: OpsAlertInput) {
  try {
    const convex = createConvexHttpClient();
    const result = (await convex.mutation(opsAlertFunctions.create, {
      serviceSecret: getRequiredEnv("BETTERDATA_SERVICE_SECRET"),
      ...alert
    })) as OpsAlertCreateResult | string;

    if (shouldEmailOpsAlert(result)) {
      await sendOpsAlertEmailSafely(alert);
    }

    return true;
  } catch {
    return false;
  }
}

function shouldEmailOpsAlert(result: OpsAlertCreateResult | string) {
  return typeof result === "string" || result.created;
}

export async function sendOpsAlertEmailSafely(alert: OpsAlertInput) {
  const recipients = getOpsAlertRecipients();

  if (recipients.length === 0) {
    return false;
  }

  try {
    await sendBroadcastEmail(
      recipients,
      `[BetterData ${alert.severity.toUpperCase()}] ${alert.category} alert`,
      buildOpsAlertEmailHtml(alert)
    );
    return true;
  } catch {
    return false;
  }
}

function getOpsAlertRecipients() {
  const configured = process.env.OPS_ALERT_EMAILS ?? "nchorkevin@gmail.com";

  return configured
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
}

function buildOpsAlertEmailHtml(alert: OpsAlertInput) {
  const rows: Array<[string, string]> = [
    ["Severity", alert.severity],
    ["Category", alert.category],
    ["Reference", alert.reference ?? "N/A"],
    ["Retryable", alert.retryable === true ? "Yes" : "No"],
    ["Retry action", alert.retryAction ?? "N/A"]
  ];

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
      <h2 style="margin:0 0 12px">BetterData Ops Alert</h2>
      <p>${escapeHtml(alert.message)}</p>
      <table style="border-collapse:collapse;margin-top:16px">
        ${rows
          .map(
            ([label, value]) => `
              <tr>
                <td style="padding:6px 12px;border:1px solid #e5e7eb;font-weight:700">${escapeHtml(label)}</td>
                <td style="padding:6px 12px;border:1px solid #e5e7eb">${escapeHtml(value)}</td>
              </tr>
            `
          )
          .join("")}
      </table>
    </div>
  `;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
