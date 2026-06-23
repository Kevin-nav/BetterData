import { purchaseOutageFunctions } from "@betterdata/app-api";
import { getRequiredEnv } from "@betterdata/config";
import type { FastifyInstance } from "fastify";

import { createConvexHttpClient } from "../../convexClient";
import { sendPurchaseRestoredEmail } from "../../integrations/resend/client";

type PurchaseOutageStatus = {
  isActive: boolean;
  updatedAt: number | null;
  message: string;
};

type RestorationRecipient = {
  email: string;
  userId?: string;
  displayName?: string;
  subscriberId?: string;
  source: "account" | "subscriber";
};

export async function registerPurchaseOutageRoutes(server: FastifyInstance) {
  server.get("/purchase-outage", async () => {
    return await getPurchaseOutageStatus();
  });

  server.post<{ Body: { email?: string } }>(
    "/purchase-outage/subscribers",
    async (request, reply) => {
      const email = request.body?.email;

      if (typeof email !== "string" || !isValidEmail(email)) {
        return reply.code(400).send({ message: "Enter a valid email address." });
      }

      const convex = createConvexHttpClient();
      const result = await convex.mutation(purchaseOutageFunctions.subscribe, {
        email
      });

      return reply.code(201).send(result);
    }
  );

  server.post("/internal/purchase-outage/notify-restored", async (request) => {
    requireInternalServiceRequest(request.headers);

    const convex = createConvexHttpClient();
    await convex.mutation(purchaseOutageFunctions.setStatusByService, {
      ...serviceArgs(),
      isActive: false
    });

    const recipients = (await convex.query(
      purchaseOutageFunctions.listRestorationRecipients,
      serviceArgs()
    )) as RestorationRecipient[];
    let successCount = 0;
    let failureCount = 0;
    const successfulSubscriberEmails: string[] = [];

    for (const recipient of recipients) {
      const result = await sendPurchaseRestoredEmail({
        email: recipient.email,
        ...(recipient.userId !== undefined ? { userId: recipient.userId } : {}),
        ...(recipient.displayName !== undefined ? { displayName: recipient.displayName } : {})
      });

      if (result.status === "sent") {
        successCount += 1;
        if (recipient.subscriberId !== undefined || recipient.source === "subscriber") {
          successfulSubscriberEmails.push(recipient.email);
        }
      } else {
        failureCount += 1;
      }
    }

    if (successfulSubscriberEmails.length > 0) {
      await convex.mutation(purchaseOutageFunctions.markSubscribersNotifiedByService, {
        ...serviceArgs(),
        emails: successfulSubscriberEmails
      });
    }

    return {
      attempted: recipients.length,
      successCount,
      failureCount
    };
  });
}

export async function getPurchaseOutageStatus() {
  const convex = createConvexHttpClient();
  return (await convex.query(
    purchaseOutageFunctions.getStatus,
    {}
  )) as PurchaseOutageStatus;
}

export async function assertDataPurchasesAvailable() {
  const status = await getPurchaseOutageStatus();

  if (status.isActive) {
    const error = new Error(
      "Data purchases are temporarily unavailable. We will be back up very soon."
    );
    error.name = "PurchaseOutageError";
    throw error;
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

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
