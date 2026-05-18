import { Readable } from "node:stream";

import { paymentFunctions } from "@betterdata/app-api";
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
  verifyPaystackSignature,
  verifyPaystackTransaction
} from "../../integrations/paystack/client";
import { getActiveDataVendor } from "../../vendors/activeVendor";
import {
  getOptionalRequestUser,
  requireRequestUser,
  resolvePaystackEmail
} from "../auth/requestUser";

declare module "fastify" {
  interface FastifyRequest {
    rawBody?: string;
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

export async function registerPaymentRoutes(server: FastifyInstance) {
  server.addHook("preParsing", async (request, _reply, payload) => {
    if (request.url.split("?")[0] !== "/webhooks/paystack") {
      return payload;
    }

    const chunks: Buffer[] = [];

    for await (const chunk of payload) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    const rawBody = Buffer.concat(chunks);
    request.rawBody = rawBody.toString("utf8");

    return Readable.from(rawBody);
  });

  server.post<{ Body: CreatePaymentIntentRequest }>(
    "/payments/intents",
    async (request, reply) => {
      try {
        validatePaymentIntentRequest(request.body);

        const reference = buildPaystackReference(request.body.purpose);
        const user =
          request.body.purpose === "data_purchase"
            ? await getOptionalRequestUser(request)
            : await requireRequestUser(request);
        const customerEmail = resolvePaystackEmail(user, reference);
        const convex = createConvexClient();
        const prepared = (await convex.mutation(paymentFunctions.prepareIntent, {
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

        await convex.mutation(paymentFunctions.markInitialized, {
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
    async (request, reply) => {
      const rawBody = request.rawBody;
      const signature = request.headers["x-paystack-signature"];

      if (
        typeof rawBody !== "string" ||
        Array.isArray(signature) ||
        !verifyPaystackSignature(
          rawBody,
          getRequiredEnv("PAYSTACK_WEBHOOK_SECRET"),
          signature
        )
      ) {
        request.log.warn("Invalid Paystack webhook signature");
        return reply.code(400).send({ received: false });
      }

      const reference = request.body.data?.reference;
      const eventType = request.body.event ?? "unknown";

      if (reference === undefined) {
        return reply.code(400).send({
          received: false,
          message: "Paystack webhook did not include a reference."
        });
      }

      try {
        const convex = createConvexClient();

        await convex.mutation(paymentFunctions.recordProviderEvent, {
          providerReference: reference,
          eventType,
          payload: request.body
        });

        const verified = await verifyPaystackTransaction(reference);

        if (verified.reference !== reference) {
          throw new Error("Verified Paystack reference did not match webhook reference.");
        }

        if (verified.status === "success" && verified.currency === "GHS") {
          await convex.mutation(paymentFunctions.completeSucceededIntent, {
            providerReference: reference,
            amountGhs: verified.amountGhs,
            currency: "GHS",
            providerPayload: verified
          });

          await fulfillPaidDataPurchase(convex, reference);
        } else {
          await convex.mutation(paymentFunctions.markFailed, {
            providerReference: reference,
            status: verified.status === "abandoned" ? "abandoned" : "failed",
            failureReason: `Paystack verification status: ${verified.status}`
          });
        }

        return { received: true };
      } catch (error) {
        request.log.error({ error, reference }, "Paystack webhook processing failed");

        return reply.code(500).send({
          received: false,
          message: "Paystack webhook processing failed."
        });
      }
    }
  );
}

async function fulfillPaidDataPurchase(
  convex: ConvexHttpClient,
  providerReference: string
) {
  const intent = (await convex.query(paymentFunctions.getByProviderReference, {
    providerReference
  })) as PaymentIntentRecord | null;

  if (intent?.purpose !== "data_purchase") {
    return;
  }

  const existingOrder = (await convex.query(
    paymentFunctions.getDataPurchaseOrderByPaymentReference,
    {
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
  const result = await vendor.purchase({
    packageId,
    network,
    recipientPhone,
    idempotencyKey: providerReference
  });

  await convex.mutation(paymentFunctions.markDataPurchaseFulfilled, {
    providerReference,
    vendorId: vendor.id,
    vendorOrderReference: result.vendorOrderReference,
    status: result.status,
    ...(result.raw !== undefined ? { vendorRaw: result.raw } : {})
  });
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
