import type { FastifyInstance } from "fastify";
import { getRequiredEnv } from "@betterdata/config";
import { userFunctions } from "@betterdata/app-api";

import { createConvexHttpClient } from "../../convexClient";
import {
  verifyFirebaseToken
} from "../../integrations/firebase/auth";
import { resolveAdminScope } from "../../auth/adminAuth";

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
      };

      return {
        id: user.id,
        firebaseUid: firebaseUser.firebaseUid,
        email: user.email ?? firebaseUser.email,
        phone: user.phone ?? firebaseUser.phone,
        displayName: user.displayName ?? firebaseUser.displayName,
        role: user.role ?? "user",
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
}

function readBearerToken(value: string | undefined) {
  if (!value) {
    return null;
  }

  const match = /^Bearer\s+(.+)$/i.exec(value);
  return match?.[1]?.trim() ?? null;
}
