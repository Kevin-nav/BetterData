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
  timeoutMs?: number;
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

type PaystackTimeoutResponse = {
  status: boolean;
  message: string;
  data?: {
    payment_session_timeout?: number;
    timeout?: number;
  };
};

export function ghsToPesewas(amountGhs: number) {
  if (!Number.isFinite(amountGhs) || amountGhs <= 0) {
    throw new Error("Paystack amount must be greater than zero.");
  }

  const pesewas = Math.round(amountGhs * 100);

  if (pesewas < 1) {
    throw new Error(
      `Paystack amount is too small after conversion: ${pesewas} pesewas.`
    );
  }

  return pesewas;
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

export async function getPaystackPaymentSessionTimeout(
  options: PaystackClientOptions = {}
) {
  const response = await paystackRequest<PaystackTimeoutResponse>(
    "/integration/payment_session_timeout",
    { method: "GET" },
    options
  );

  const timeout =
    response.data?.payment_session_timeout ?? response.data?.timeout;

  if (!response.status || typeof timeout !== "number") {
    throw new Error(response.message || "Paystack timeout lookup failed.");
  }

  return timeout;
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
  const timeoutMs = resolvePaystackRequestTimeoutMs(options.timeoutMs);
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${secretKey}`);
  headers.set("content-type", "application/json");
  const url = `${baseUrl}${path}`;

  const response = await withTimeout(
    fetcher(url, {
      ...init,
      headers
    }),
    timeoutMs,
    url
  );

  let responseText = "";
  let parsed: TResponse;

  try {
    responseText = await response.text();
    parsed = responseText ? (JSON.parse(responseText) as TResponse) : ({} as TResponse);
  } catch (error) {
    const message = buildPaystackParseErrorMessage({
      url,
      status: response.status,
      responseText,
      error
    });

    if (response.ok) {
      throw new Error(message);
    }

    parsed = { message } as TResponse;
  }

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

function resolvePaystackRequestTimeoutMs(configuredTimeoutMs: number | undefined) {
  const parsed = configuredTimeoutMs ?? Number(process.env.PAYSTACK_REQUEST_TIMEOUT_MS ?? 15000);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 15000;
  }

  return parsed;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, url: string) {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          reject(new Error(`Paystack request timed out after ${timeoutMs}ms for ${url}.`));
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }
}

function buildPaystackParseErrorMessage(input: {
  url: string;
  status: number;
  responseText: string;
  error: unknown;
}) {
  const errorMessage =
    input.error instanceof Error ? input.error.message : String(input.error);
  const body = input.responseText.length > 0 ? input.responseText : "<empty>";

  return `Paystack response parsing failed for ${input.url} with HTTP ${input.status}. Body: ${body}. Parse error: ${errorMessage}`;
}
