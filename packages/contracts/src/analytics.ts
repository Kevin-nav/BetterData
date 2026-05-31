export const ANALYTICS_EVENTS = [
  "package_list_viewed",
  "package_selected",
  "network_selected",
  "network_mismatch_detected",
  "network_mismatch_switch_clicked",
  "recipient_entered",
  "recipient_confirmed",
  "payment_method_selected",
  "payment_started",
  "wallet_insufficient_balance_shown",
  "saved_number_selected",
  "saved_number_prompt_shown",
  "saved_number_prompt_saved",
  "saved_number_prompt_skipped",
  "bulk_recipient_added",
  "bulk_recipient_removed",
  "bulk_entry_error_shown",
  "bulk_file_upload_started",
  "bulk_file_upload_parsed",
  "purchase_error_shown",
  "agent_apply_viewed",
  "agent_application_payment_started",
  "payment_intent_created",
  "payment_succeeded",
  "payment_failed",
  "wallet_debited",
  "wallet_topup_succeeded",
  "order_created",
  "order_completed",
  "order_failed",
  "order_refunded",
  "agent_application_started",
  "agent_application_paid",
  "agent_application_approved",
  "agent_application_rejected",
  "agent_purchase_completed"
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

export type AnalyticsPrimitive = string | number | boolean;

export type AnalyticsProperties = Record<string, AnalyticsPrimitive | null | undefined>;

const FORBIDDEN_PROPERTY_PATTERNS = [
  /email/i,
  /name/i,
  /phone/i,
  /token/i,
  /authorization/i,
  /paystack.*reference/i,
  /vendor.*reference/i,
  /raw/i,
  /payload/i
];

export function normalizeAnalyticsProperties(input: AnalyticsProperties): Record<string, AnalyticsPrimitive> {
  const output: Record<string, AnalyticsPrimitive> = {};

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    if (FORBIDDEN_PROPERTY_PATTERNS.some((pattern) => pattern.test(key))) {
      continue;
    }

    output[key] = value;
  }

  return output;
}
