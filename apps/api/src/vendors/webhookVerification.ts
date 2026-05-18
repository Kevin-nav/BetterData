import { timingSafeEqual } from "node:crypto";

export type WebhookVerificationResult =
  | { ok: true }
  | { ok: false; statusCode: 401 | 500; message: string };

export function verifyDataVendorWebhook(
  headers: Record<string, string>,
  env: NodeJS.ProcessEnv = process.env
): WebhookVerificationResult {
  const secret = env.WEBHOOK_SECRET;

  if (!secret) {
    if (env.NODE_ENV === "production") {
      return {
        ok: false,
        statusCode: 500,
        message: "Webhook verification is not configured."
      };
    }

    return { ok: true };
  }

  const provided =
    headers["x-betterdata-webhook-secret"] ??
    headers["x-webhook-secret"] ??
    headers["x-datamart-webhook-secret"];

  if (!provided || !safeEqual(provided, secret)) {
    return {
      ok: false,
      statusCode: 401,
      message: "Invalid webhook credentials."
    };
  }

  return { ok: true };
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}
