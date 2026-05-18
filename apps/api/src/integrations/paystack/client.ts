import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import type { PaymentPurpose } from "@betterdata/contracts";
import { getRequiredEnv } from "@betterdata/config";

export type PaystackPaymentIntent = {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
};

export type InitializePaystackPaymentInput = {
  email: string;
  amountGhs: number;
  reference: string;
  callbackUrl?: string;
  metadata: Record<string, unknown>;
};

export type VerifiedPaystackTransaction = {
  reference: string;
  status: "success" | "failed" | "abandoned" | string;
  amountGhs: number;
  amountPesewas: number;
  currency: string;
  paidAt?: string;
  channel?: string;
  customer?: {
    email?: string;
    phone?: string;
  };
};

export type PaystackClientOptions = {
  secretKey?: string;
  baseUrl?: string;
  fetch?: typeof fetch;
};

type PaystackInitializeResponse = {
  status: boolean;
  message: string;
  data?: {
    authorization_url?: string;
    access_code?: string;
    reference?: string;
  };
};

type PaystackVerifyResponse = {
  status: boolean;
  message: string;
  data?: {
    reference?: string;
    status?: string;
    amount?: number;
    currency?: string;
    paid_at?: string | null;
    channel?: string | null;
    customer?: {
      email?: string | null;
      phone?: string | null;
    };
  };
};

export function ghsToPesewas(amountGhs: number) {
  if (!Number.isFinite(amountGhs) || amountGhs <= 0) {
    throw new Error("Paystack amount must be greater than zero.");
  }

  return Math.round(amountGhs * 100);
}

export function buildPaystackReference(purpose: PaymentPurpose) {
  const normalizedPurpose = purpose.replace(/[^a-zA-Z0-9.-=]/g, "-");
  const id = randomUUID().replace(/-/g, "");
  return `bd-${normalizedPurpose}-${id}`;
}

export function verifyPaystackSignature(
  rawBody: string | Buffer,
  secret: string,
  signature: string | undefined
) {
  if (!signature || !secret) {
    return false;
  }

  const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const signatureBuffer = Buffer.from(signature, "hex");

  if (expectedBuffer.length !== signatureBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, signatureBuffer);
}

export async function initializeMobileMoneyPayment(
  input: InitializePaystackPaymentInput,
  options: PaystackClientOptions = {}
): Promise<PaystackPaymentIntent> {
  const response = await paystackRequest<PaystackInitializeResponse>(
    "/transaction/initialize",
    {
      method: "POST",
      body: JSON.stringify({
        amount: ghsToPesewas(input.amountGhs),
        email: input.email,
        currency: "GHS",
        reference: input.reference,
        channels: ["mobile_money"],
        metadata: input.metadata,
        ...(input.callbackUrl !== undefined ? { callback_url: input.callbackUrl } : {})
      })
    },
    options
  );

  const data = response.data;

  if (
    !response.status ||
    data?.authorization_url === undefined ||
    data.access_code === undefined ||
    data.reference === undefined
  ) {
    throw new Error(response.message || "Paystack transaction initialization failed.");
  }

  return {
    authorizationUrl: data.authorization_url,
    accessCode: data.access_code,
    reference: data.reference
  };
}

export async function verifyPaystackTransaction(
  reference: string,
  options: PaystackClientOptions = {}
): Promise<VerifiedPaystackTransaction> {
  const response = await paystackRequest<PaystackVerifyResponse>(
    `/transaction/verify/${encodeURIComponent(reference)}`,
    { method: "GET" },
    options
  );

  const data = response.data;

  if (
    !response.status ||
    data?.reference === undefined ||
    data.status === undefined ||
    data.amount === undefined ||
    data.currency === undefined
  ) {
    throw new Error(response.message || "Paystack transaction verification failed.");
  }

  const customer: VerifiedPaystackTransaction["customer"] = {};

  if (data.customer?.email) {
    customer.email = data.customer.email;
  }

  if (data.customer?.phone) {
    customer.phone = data.customer.phone;
  }

  return {
    reference: data.reference,
    status: data.status,
    amountGhs: data.amount / 100,
    amountPesewas: data.amount,
    currency: data.currency,
    ...(data.paid_at !== null && data.paid_at !== undefined ? { paidAt: data.paid_at } : {}),
    ...(data.channel !== null && data.channel !== undefined ? { channel: data.channel } : {}),
    ...(Object.keys(customer).length > 0 ? { customer } : {})
  };
}

async function paystackRequest<TResponse>(
  path: string,
  init: RequestInit,
  options: PaystackClientOptions
) {
  const fetcher = options.fetch ?? globalThis.fetch;

  if (!fetcher) {
    throw new Error("A fetch implementation is required for Paystack API calls.");
  }

  const secretKey = options.secretKey ?? getRequiredEnv("PAYSTACK_SECRET_KEY");
  const baseUrl = options.baseUrl ?? "https://api.paystack.co";
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${secretKey}`);
  headers.set("content-type", "application/json");

  const response = await fetcher(`${baseUrl}${path}`, {
    ...init,
    headers
  });

  const responseText = await response.text();
  const parsed = responseText ? (JSON.parse(responseText) as TResponse) : ({} as TResponse);

  if (!response.ok) {
    const message =
      typeof parsed === "object" &&
      parsed !== null &&
      "message" in parsed &&
      typeof parsed.message === "string"
        ? parsed.message
        : `Paystack request failed with ${response.status}.`;
    throw new Error(message);
  }

  return parsed;
}
