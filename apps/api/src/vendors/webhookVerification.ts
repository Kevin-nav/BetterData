import { timingSafeEqual } from "node:crypto";
import { createHmac } from "node:crypto";

export type WebhookVerificationResult =
  | { ok: true }
  | { ok: false; statusCode: 401 | 500; message: string };

export function verifyDataVendorWebhook(
  headers: Record<string, string>,
  rawBody: string,
  env: NodeJS.ProcessEnv = process.env
): WebhookVerificationResult {
  const hmacSecret = env.WEBHOOK_HMAC_SECRET;

  if (hmacSecret) {
    const signature = headers["x-signature"] ?? headers["x-betterdata-signature"];
    const timestamp = headers["x-timestamp"];

    if (!signature || !timestamp || !isFreshTimestamp(timestamp)) {
      return {
        ok: false,
        statusCode: 401,
        message: "Invalid webhook signature."
      };
    }

    const expected = createHmac("sha256", hmacSecret)
      .update(`${timestamp}.${rawBody}`)
      .digest("hex");

    return safeEqual(signature, expected)
      ? { ok: true }
      : {
          ok: false,
          statusCode: 401,
          message: "Invalid webhook signature."
        };
  }

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

function isFreshTimestamp(value: string) {
  const timestamp = Number(value);

  if (!Number.isFinite(timestamp)) {
    return false;
  }

  return Math.abs(Date.now() - timestamp) <= 5 * 60 * 1000;
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}
