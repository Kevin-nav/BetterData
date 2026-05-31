import type { FastifyInstance } from "fastify";
import { getRequiredEnv } from "@betterdata/config";
import { userFunctions, platformConfigFunctions } from "@betterdata/app-api";

import { createConvexHttpClient } from "../../convexClient";
import { sendWelcomeEmail } from "../../integrations/resend/client";
import {
  verifyFirebaseToken
} from "../../integrations/firebase/auth";
import { resolveAdminScope } from "../../auth/adminAuth";
import { hashAnalyticsId } from "../../telemetry/hash";
import { normalizeGhanaPhoneNumber } from "../orders/orderValidation";

export async function registerAuthRoutes(server: FastifyInstance) {
  /**
   * POST /auth/session
   *
   * Accepts a Firebase ID token via Authorization header, verifies it server-side,
   * syncs the user to Convex (find-or-create), and returns the user profile.
   */
  server.post("/auth/session", async (request, reply) => {
    const token = readBearerToken(request.headers.authorization);

    if (!token) {
      return reply.code(401).send({ message: "Authorization token is required." });
    }

    let firebaseUser;

    try {
      firebaseUser = await verifyFirebaseToken(token);
    } catch (error) {
      request.log.warn({ error }, "Firebase token verification failed");
      return reply.code(401).send({ message: "Invalid or expired token." });
    }

    const convex = createConvexHttpClient();

    try {
      const user = (await convex.mutation(userFunctions.findOrCreateFromFirebase, {
        serviceSecret: getRequiredEnv("BETTERDATA_SERVICE_SECRET"),
        firebaseUid: firebaseUser.firebaseUid,
        ...(firebaseUser.email !== undefined ? { email: firebaseUser.email } : {}),
        ...(firebaseUser.phone !== undefined ? { phone: firebaseUser.phone } : {}),
        ...(firebaseUser.displayName !== undefined
          ? { displayName: firebaseUser.displayName }
          : {})
      })) as {
        id: string;
        firebaseUid?: string;
        email?: string;
        phone?: string;
        displayName?: string;
        role?: string;
        isNew?: boolean;
      };

      if (user.isNew && user.email) {
        sendWelcomeEmail({
          userId: user.id,
          email: user.email,
          displayName: user.displayName ?? firebaseUser.displayName
        });
      }

      return {
        id: user.id,
        firebaseUid: firebaseUser.firebaseUid,
        email: user.email ?? firebaseUser.email,
        phone: user.phone ?? firebaseUser.phone,
        displayName: user.displayName ?? firebaseUser.displayName,
        role: user.role ?? "user",
        analyticsUserHash: hashAnalyticsId("user", user.id),
        adminScope: resolveAdminScope(firebaseUser, user.role, process.env)
      };
    } catch (error) {
      request.log.error({ error }, "Failed to sync user to Convex");
      return reply.code(500).send({ message: "Unable to create session." });
    }
  });

  /**
   * GET /auth/me
   *
   * Returns the current user profile. Used by the frontend on page load
   * to re-check auth state and get the latest user data.
   */
  server.get("/auth/me", async (request, reply) => {
    const token = readBearerToken(request.headers.authorization);

    if (!token) {
      return reply.code(401).send({ message: "Authorization token is required." });
    }

    let firebaseUser;

    try {
      firebaseUser = await verifyFirebaseToken(token);
    } catch (error) {
      request.log.warn({ error }, "Firebase token verification failed");
      return reply.code(401).send({ message: "Invalid or expired token." });
    }

    const convex = createConvexHttpClient();

    try {
      const user = await convex.query(userFunctions.getByFirebaseUid, {
        serviceSecret: getRequiredEnv("BETTERDATA_SERVICE_SECRET"),
        firebaseUid: firebaseUser.firebaseUid
      });

      if (!user) {
        return reply.code(404).send({ message: "User not found." });
      }

      return {
        id: user._id,
        firebaseUid: user.firebaseUid,
        email: user.email,
        phone: user.phone,
        displayName: user.displayName,
        role: user.role,
        analyticsUserHash: hashAnalyticsId("user", user._id),
        adminScope: resolveAdminScope(firebaseUser, user.role, process.env),
        walletBalanceGhs: user.walletBalanceGhs,
        firstPurchaseDiscountUsed: user.firstPurchaseDiscountUsed,
        isSuspended: user.isSuspended
      };
    } catch (error) {
      request.log.error({ error }, "Failed to fetch user profile");
      return reply.code(500).send({ message: "Unable to fetch profile." });
    }
  });

  /**
   * PATCH /auth/me/phone
   *
   * Updates the authenticated user's phone number.
   * Used by the agent application flow to ensure a phone is on file.
   */
  server.patch<{ Body: { phone?: string } }>("/auth/me/phone", async (request, reply) => {
    const token = readBearerToken(request.headers.authorization);

    if (!token) {
      return reply.code(401).send({ message: "Authorization token is required." });
    }

    let firebaseUser;

    try {
      firebaseUser = await verifyFirebaseToken(token);
    } catch (error) {
      request.log.warn({ error }, "Firebase token verification failed");
      return reply.code(401).send({ message: "Invalid or expired token." });
    }

    const rawPhone = request.body?.phone;

    if (typeof rawPhone !== "string" || !rawPhone.trim()) {
      return reply.code(400).send({ message: "Phone number is required." });
    }

    const normalizedPhone = normalizeGhanaPhoneNumber(rawPhone);

    if (!normalizedPhone) {
      return reply.code(400).send({ message: "A valid Ghana phone number is required." });
    }

    const convex = createConvexHttpClient();

    try {
      const result = await convex.mutation(userFunctions.updatePhone, {
        serviceSecret: getRequiredEnv("BETTERDATA_SERVICE_SECRET"),
        firebaseUid: firebaseUser.firebaseUid,
        phone: normalizedPhone
      });

      return result;
    } catch (error) {
      request.log.error({ error }, "Failed to update phone");
      return reply.code(500).send({ message: "Unable to update phone number." });
    }
  });

  /**
   * GET /auth/me/agent-application
   *
   * Returns the current user's agent application status, or null if none exists.
   */
  server.get("/auth/me/agent-application", async (request, reply) => {
    const token = readBearerToken(request.headers.authorization);

    if (!token) {
      return reply.code(401).send({ message: "Authorization token is required." });
    }

    let firebaseUser;

    try {
      firebaseUser = await verifyFirebaseToken(token);
    } catch (error) {
      request.log.warn({ error }, "Firebase token verification failed");
      return reply.code(401).send({ message: "Invalid or expired token." });
    }

    const convex = createConvexHttpClient();

    try {
      const application = await convex.query(userFunctions.getAgentApplicationStatus, {
        serviceSecret: getRequiredEnv("BETTERDATA_SERVICE_SECRET"),
        firebaseUid: firebaseUser.firebaseUid
      });

      return application ?? null;
    } catch (error) {
      request.log.error({ error }, "Failed to fetch agent application status");
      return reply.code(500).send({ message: "Unable to fetch application status." });
    }
  });

  /**
   * GET /config/agent-pricing
   *
   * Public endpoint returning the current agent onboarding fee and discount percentage.
   * No authentication required — used by the public agent program page.
   */
  server.get("/config/agent-pricing", async (request, reply) => {
    const convex = createConvexHttpClient();

    try {
      const [agentOnboardingFeeGhs, agentDiscountPercentage] = await Promise.all([
        convex.query(platformConfigFunctions.getNumberConfig, {
          key: "agentOnboardingFeeGhs"
        }) as Promise<number | null>,
        convex.query(platformConfigFunctions.getNumberConfig, {
          key: "agentDiscountPercentage"
        }) as Promise<number | null>
      ]);

      return {
        agentOnboardingFeeGhs: agentOnboardingFeeGhs ?? 0,
        agentDiscountPercentage: agentDiscountPercentage ?? 0
      };
    } catch (error) {
      request.log.error({ error }, "Failed to fetch agent pricing config");
      return reply.code(500).send({ message: "Unable to fetch pricing configuration." });
    }
  });
}

function readBearerToken(value: string | undefined) {
  if (!value) {
    return null;
  }

  const match = /^Bearer\s+(.+)$/i.exec(value);
  return match?.[1]?.trim() ?? null;
}
