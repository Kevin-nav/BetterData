import { createHmac } from "node:crypto";

import { getRequiredEnv } from "@betterdata/config";

export function hashForTelemetry(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  return createHmac("sha256", getRequiredEnv("TELEMETRY_HASH_SECRET"))
    .update(normalizeTelemetryValue(value))
    .digest("hex");
}

export function hashAnalyticsId(namespace: string, value: string | undefined) {
  if (!value) {
    return undefined;
  }

  return hashForTelemetry(`${namespace}:${value}`);
}

function normalizeTelemetryValue(value: string) {
  return value.trim().toLowerCase();
}
