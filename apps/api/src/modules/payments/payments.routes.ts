import {
  opsAlertFunctions,
  paymentFunctions,
  platformConfigFunctions
} from "@betterdata/app-api";
import { getRequiredEnv } from "@betterdata/config";
import type {
  CreatePaymentIntentRequest,
  CreatePaymentIntentResponse,
  PaymentIntentStatusResponse,
  PaymentPurpose
} from "@betterdata/contracts";
import type { FastifyInstance } from "fastify";
import { ConvexHttpClient } from "convex/browser";

import {
  buildPaystackReference,
  initializeMobileMoneyPayment,
  getPaystackPaymentSessionTimeout,
  verifyPaystackSignature,
  verifyPaystackTransaction
} from "../../integrations/paystack/client";
import { getActiveDataVendor } from "../../vendors/activeVendor";
import { emitPaymentTelemetry } from "../../telemetry/paymentTelemetry";
import {
  getOptionalRequestUser,
  requireRequestUser,
  resolvePaystackEmail
} from "../auth/requestUser";
import { getNextRetryAt, isFinalRetryFailure } from "./retryPolicy";

declare module "fastify" {
  interface FastifyRequest {
    rawBody?: string | Buffer;
  }

  interface FastifyContextConfig {
    rawBody?: boolean;
  }
}

type PreparedPaymentIntent = {
  provider: "paystack";
  purpose: PaymentPurpose;
  reference: string;
  amountGhs: number;
  currency: "GHS";
  metadata: Record<string, unknown>;
};

type PaystackWebhookBody = {
  event?: string;
  data?: {
    reference?: string;
  };
};

type PaymentIntentRecord = {
  purpose: PaymentPurpose;
  providerReference: string;
  purposeMetadata: unknown;
};

type RetryableOpsAlert = {
  _id: string;
  reference?: string;
  retryAction?: "verify_payment" | "fulfill_order" | "credit_wallet" | "complete_agent_application";
  retryCount: number;
};

export async function registerPaymentRoutes(server: FastifyInstance) {
  server.post<{ Body: CreatePaymentIntentRequest }>(
    "/payments/intents",
    async (request, reply) => {
      try {
        validatePaymentIntentRequest(request.body);

        const reference = buildPaystackReference(request.body.purpose);
        const convex = createConvexClient();
        const user =
          request.body.purpose === "data_purchase"
            ? await getOptionalRequestUser(request, convex)
            : await requireRequestUser(request, convex);
        const customerEmail = resolvePaystackEmail(user, reference);
        const prepared = (await convex.mutation(paymentFunctions.prepareIntent, {
          ...serviceArgs(),
          request: {
            ...request.body,
            ...(user !== null ? { userId: user.id } : {}),
            customerEmail
          },
          providerReference: reference
        })) as PreparedPaymentIntent;

        const callbackUrl = buildPaymentCallbackUrl(prepared.reference);
        const checkout = await initializeMobileMoneyPayment({
          email: customerEmail,
          amountGhs: prepared.amountGhs,
          reference: prepared.reference,
          metadata: {
            ...prepared.metadata,
            purpose: prepared.purpose
          },
          ...(callbackUrl !== undefined ? { callbackUrl } : {})
        });

        emitPaymentTelemetry({
          name: "payment.intent.initialized",
          paymentReference: prepared.reference,
          purpose: prepared.purpose,
          status: "initialized",
          amountGhs: prepared.amountGhs,
          currency: "GHS",
          ...(user?.id !== undefined ? { userId: user.id } : {}),
          ...(request.body.purpose === "data_purchase"
            ? { recipientPhone: request.body.recipientPhone }
            : {})
        });

        await convex.mutation(paymentFunctions.markInitialized, {
          ...serviceArgs(),
          providerReference: prepared.reference,
          providerAccessCode: checkout.accessCode,
          providerAuthorizationUrl: checkout.authorizationUrl
        });

        return reply.code(201).send({
          provider: "paystack",
          purpose: prepared.purpose,
          reference: prepared.reference,
          authorizationUrl: checkout.authorizationUrl,
          accessCode: checkout.accessCode,
          amountGhs: prepared.amountGhs,
          currency: "GHS",
          status: "initialized"
        } satisfies CreatePaymentIntentResponse);
      } catch (error) {
        request.log.warn({ error }, "Payment intent creation failed");

        return reply.code(400).send({
          message: error instanceof Error ? error.message : "Payment intent creation failed."
        });
      }
    }
  );

  server.get<{ Params: { reference: string } }>(
    "/payments/intents/:reference",
    async (request, reply) => {
      const convex = createConvexClient();
      const status = (await convex.query(paymentFunctions.getPublicStatus, {
        providerReference: request.params.reference
      })) as PaymentIntentStatusResponse | null;

      if (status === null) {
        return reply.code(404).send({
          message: "Payment intent not found."
        });
      }

      return status;
    }
  );

  server.post<{ Body: PaystackWebhookBody }>(
    "/webhooks/paystack",
    { config: { rawBody: true } },
    async (request, reply) => {
      const rawBody = request.rawBody;
      const signature = request.headers["x-paystack-signature"];

      if (
        rawBody === undefined ||
        Array.isArray(signature) ||
        !verifyPaystackSignature(
          rawBody,
          getRequiredEnv("PAYSTACK_SECRET_KEY"),
          signature
        )
      ) {
        emitPaymentTelemetry({
          name: "payment.webhook.signature_failed",
          status: "failed",
          errorCode: "paystack_signature_invalid"
        });
        request.log.warn("Invalid Paystack webhook signature");
        await createOpsAlertSafely(createConvexClient(), {
          severity: "warning",
          category: "security",
          message: "Invalid Paystack webhook signature.",
          metadata: {
            path: request.url,
            event: "paystack_signature_invalid"
          }
        });
        return reply.code(400).send({ received: false });
      }

      const reference = request.body.data?.reference;
      const eventType = request.body.event ?? "unknown";

      if (reference === undefined) {
        emitPaymentTelemetry({
          name: "payment.webhook.missing_reference",
          status: "failed",
          errorCode: "paystack_reference_missing"
        });
        await createOpsAlertSafely(createConvexClient(), {
          severity: "warning",
          category: "webhook",
          message: "Paystack webhook did not include a reference.",
          metadata: {
            eventType
          }
        });
        return reply.code(400).send({
          received: false,
          message: "Paystack webhook did not include a reference."
        });
      }

      try {
        const convex = createConvexClient();

        await convex.mutation(paymentFunctions.recordProviderEvent, {
          ...serviceArgs(),
          providerReference: reference,
          eventType,
          payload: request.body
        });

        const verified = await verifyPaystackTransaction(reference);
        emitPaymentTelemetry({
          name: "payment.paystack.verified",
          paymentReference: reference,
          status: verified.status,
          amountGhs: verified.amountGhs,
          amountPesewas: verified.amountPesewas,
          currency: verified.currency,
          ...(verified.customer?.phone !== undefined
            ? { payerPhone: verified.customer.phone }
            : {})
        });

        if (verified.reference !== reference) {
          await createOpsAlertSafely(convex, {
            severity: "critical",
            category: "payment",
            reference,
            message: "Verified Paystack reference did not match webhook reference.",
            metadata: {
              verifiedReference: verified.reference
            }
          });
          throw new Error("Verified Paystack reference did not match webhook reference.");
        }

        if (verified.status === "success" && verified.currency === "GHS") {
          await convex.mutation(paymentFunctions.completeSucceededIntent, {
            ...serviceArgs(),
            providerReference: reference,
            amountGhs: verified.amountGhs,
            amountPesewas: verified.amountPesewas,
            currency: "GHS",
            ...(verified.customer?.phone !== undefined
              ? { paystackPayerPhone: verified.customer.phone }
              : {}),
            providerPayload: verified
          });

          await fulfillPaidDataPurchase(convex, reference);
          emitPaymentTelemetry({
            name: "payment.intent.completed",
            paymentReference: reference,
            status: "succeeded",
            amountGhs: verified.amountGhs,
            amountPesewas: verified.amountPesewas,
            currency: verified.currency,
            ...(verified.customer?.phone !== undefined
              ? { payerPhone: verified.customer.phone }
              : {})
          });
        } else {
          await convex.mutation(paymentFunctions.markFailed, {
            ...serviceArgs(),
            providerReference: reference,
            status: verified.status === "abandoned" ? "abandoned" : "failed",
            failureReason: `Paystack verification status: ${verified.status}`
          });
          emitPaymentTelemetry({
            name: "payment.intent.failed",
            paymentReference: reference,
            status: verified.status,
            errorCode: "paystack_status_not_success"
          });
        }

        return { received: true };
      } catch (error) {
        request.log.error({ error, reference }, "Paystack webhook processing failed");
        emitPaymentTelemetry({
          name: "payment.webhook.processing_failed",
          paymentReference: reference,
          status: "failed",
          errorCode: "paystack_webhook_processing_failed",
          errorMessage: error instanceof Error ? error.message : "Unknown error"
        });
        const nextRetryAt = getNextRetryAt("internal_completion", 0);
        await createOpsAlertSafely(createConvexClient(), {
          severity: "warning",
          category: "payment",
          reference,
          message: "Paystack webhook processing failed.",
          metadata: {
            errorMessage: error instanceof Error ? error.message : "Unknown error"
          },
          retryable: true,
          retryAction: "verify_payment",
          retryStatus: "queued",
          ...(nextRetryAt !== null ? { nextRetryAt } : {})
        });

        return reply.code(500).send({
          received: false,
          message: "Paystack webhook processing failed."
        });
      }
    }
  );

  server.post("/internal/payments/retries/run", async (request, reply) => {
    requireInternalServiceRequest(request.headers);
    const convex = createConvexClient();
    const alerts = (await convex.query(opsAlertFunctions.listDueRetries, {
      ...serviceArgs(),
      now: Date.now()
    })) as RetryableOpsAlert[];
    const results = [];

    for (const alert of alerts) {
      const result = await processRetryAlert(convex, alert);
      results.push(result);
    }

    return { processed: results.length, results };
  });

  server.get("/internal/payments/diagnostics/paystack-timeout", async (request) => {
    requireInternalServiceRequest(request.headers);

    const convex = createConvexClient();
    const configuredTimeout = (await convex.query(
      platformConfigFunctions.getNumberConfig,
      {
        key: "paymentIntentExpirySeconds"
      }
    )) as number | null;
    const paystackTimeout = await getPaystackPaymentSessionTimeout();
    const matches = configuredTimeout === paystackTimeout;

    if (!matches) {
      await createOpsAlertSafely(convex, {
        severity: "warning",
        category: "config",
        message: "Paystack payment session timeout does not match Convex config.",
        metadata: {
          configuredTimeout,
          paystackTimeout
        }
      });
    }

    return {
      configuredTimeout,
      paystackTimeout,
      matches
    };
  });
}

async function processRetryAlert(convex: ConvexHttpClient, alert: RetryableOpsAlert) {
  if (alert.reference === undefined || alert.retryAction === undefined) {
    return { alertId: alert._id, status: "skipped", reason: "missing retry metadata" };
  }

  await convex.mutation(opsAlertFunctions.markRetryRunning, {
    ...serviceArgs(),
    alertId: alert._id
  });

  try {
    switch (alert.retryAction) {
      case "verify_payment":
        await verifyAndCompletePayment(convex, alert.reference);
        break;
      case "fulfill_order":
        await fulfillPaidDataPurchase(convex, alert.reference);
        break;
      case "credit_wallet":
        await creditWalletHandler(convex, alert.reference);
        break;
      case "complete_agent_application":
        await completeAgentApplicationHandler(convex, alert.reference);
        break;
      default:
        throw new Error(`Unsupported payment retry action: ${alert.retryAction}.`);
    }

    await convex.mutation(opsAlertFunctions.markRetrySucceeded, {
      ...serviceArgs(),
      alertId: alert._id
    });

    return { alertId: alert._id, status: "succeeded" };
  } catch (error) {
    const retryKind =
      alert.retryAction === "fulfill_order" ? "data_fulfillment" : "internal_completion";
    const nextRetryAt = getNextRetryAt(retryKind, alert.retryCount + 1);
    const finalFailure = nextRetryAt === null || isFinalRetryFailure(retryKind, alert.retryCount + 1);

    await convex.mutation(opsAlertFunctions.markRetryFailed, {
      ...serviceArgs(),
      alertId: alert._id,
      finalFailure,
      message: error instanceof Error ? error.message : "Payment retry failed.",
      ...(nextRetryAt !== null ? { nextRetryAt } : {})
    });

    return {
      alertId: alert._id,
      status: "failed",
      finalFailure,
      errorMessage: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

async function creditWalletHandler(convex: ConvexHttpClient, reference: string) {
  await verifyAndCompletePayment(convex, reference);
}

async function completeAgentApplicationHandler(
  convex: ConvexHttpClient,
  reference: string
) {
  await verifyAndCompletePayment(convex, reference);
}

async function verifyAndCompletePayment(
  convex: ConvexHttpClient,
  reference: string
) {
  const verified = await verifyPaystackTransaction(reference);

  if (verified.reference !== reference) {
    throw new Error("Verified Paystack reference did not match retry reference.");
  }

  if (verified.status !== "success" || verified.currency !== "GHS") {
    throw new Error(`Paystack retry verification status: ${verified.status}.`);
  }

  await convex.mutation(paymentFunctions.completeSucceededIntent, {
    ...serviceArgs(),
    providerReference: reference,
    amountGhs: verified.amountGhs,
    amountPesewas: verified.amountPesewas,
    currency: "GHS",
    ...(verified.customer?.phone !== undefined
      ? { paystackPayerPhone: verified.customer.phone }
      : {}),
    providerPayload: verified
  });

  await fulfillPaidDataPurchase(convex, reference);
}

async function fulfillPaidDataPurchase(
  convex: ConvexHttpClient,
  providerReference: string
) {
  const intent = (await convex.query(paymentFunctions.getByProviderReference, {
    ...serviceArgs(),
    providerReference
  })) as PaymentIntentRecord | null;

  if (intent?.purpose !== "data_purchase") {
    return;
  }

  const existingOrder = (await convex.query(
    paymentFunctions.getDataPurchaseOrderByPaymentReference,
    {
      ...serviceArgs(),
      providerReference
    }
  )) as { vendorOrderReference?: string } | null;

  if (existingOrder?.vendorOrderReference !== undefined) {
    return;
  }

  const metadata = asRecord(intent.purposeMetadata);
  const packageId = metadata.vendorPackageId ?? metadata.packageId;
  const network = metadata.network;
  const recipientPhone = metadata.recipientPhone;

  if (
    typeof packageId !== "string" ||
    !isNetworkCode(network) ||
    typeof recipientPhone !== "string"
  ) {
    throw new Error("Paid data purchase metadata is invalid for fulfillment.");
  }

  const vendor = getActiveDataVendor();
  try {
    const result = await vendor.purchase({
      packageId,
      network,
      recipientPhone,
      idempotencyKey: providerReference
    });

    await convex.mutation(paymentFunctions.markDataPurchaseFulfilled, {
      ...serviceArgs(),
      providerReference,
      vendorId: vendor.id,
      vendorOrderReference: result.vendorOrderReference,
      status: result.status,
      ...(result.raw !== undefined ? { vendorRaw: result.raw } : {})
    });
    emitPaymentTelemetry({
      name: "payment.fulfillment.succeeded",
      paymentReference: providerReference,
      status: result.status,
      vendorId: vendor.id,
      vendorOrderReference: result.vendorOrderReference,
      recipientPhone
    });
  } catch (error) {
    emitPaymentTelemetry({
      name: "payment.fulfillment.failed",
      paymentReference: providerReference,
      status: "failed",
      vendorId: vendor.id,
      recipientPhone,
      errorCode: "vendor_fulfillment_failed",
      errorMessage: error instanceof Error ? error.message : "Unknown error"
    });
    const nextRetryAt = getNextRetryAt("data_fulfillment", 0);
    await createOpsAlertSafely(convex, {
      severity: "warning",
      category: "fulfillment",
      reference: providerReference,
      message: "Vendor fulfillment failed after successful payment.",
      metadata: {
        vendorId: vendor.id,
        errorMessage: error instanceof Error ? error.message : "Unknown error"
      },
      retryable: true,
      retryAction: "fulfill_order",
      retryStatus: "queued",
      ...(nextRetryAt !== null ? { nextRetryAt } : {})
    });
    throw error;
  }
}

function validatePaymentIntentRequest(body: CreatePaymentIntentRequest) {
  if (!body || typeof body !== "object") {
    throw new Error("Payment intent request body is required.");
  }

  if (body.purpose === "data_purchase" && !body.confirmRecipientIsCorrect) {
    throw new Error("Recipient number confirmation is required.");
  }

  if (body.purpose === "wallet_top_up" && body.amountGhs <= 0) {
    throw new Error("Wallet top-up amount must be greater than zero.");
  }
}

function createConvexClient() {
  return new ConvexHttpClient(getRequiredEnv("CONVEX_URL"));
}

function buildPaymentCallbackUrl(reference: string) {
  const appUrl = process.env.PUBLIC_APP_URL;

  if (!appUrl) {
    return undefined;
  }

  return `${appUrl.replace(/\/+$/, "")}/payments/${encodeURIComponent(reference)}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function isNetworkCode(value: unknown): value is "mtn" | "telecel" | "airteltigo" {
  return value === "mtn" || value === "telecel" || value === "airteltigo";
}

async function createOpsAlertSafely(
  convex: ConvexHttpClient,
  alert: {
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
  }
) {
  try {
    await convex.mutation(opsAlertFunctions.create, {
      ...serviceArgs(),
      ...alert
    });
  } catch {
    // Avoid masking payment/webhook responses when alert persistence fails.
  }
}

function serviceArgs() {
  return {
    serviceSecret: getRequiredEnv("BETTERDATA_SERVICE_SECRET")
  };
}

function requireInternalServiceRequest(
  headers: Record<string, string | string[] | undefined>
) {
  const provided = headers["x-betterdata-service-secret"];

  if (Array.isArray(provided) || provided !== getRequiredEnv("BETTERDATA_SERVICE_SECRET")) {
    throw new Error("Service authorization failed.");
  }
}
