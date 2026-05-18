import type { FastifyRequest } from "fastify";
import type { ConvexHttpClient } from "convex/browser";
import { userFunctions } from "@betterdata/app-api";
import { getRequiredEnv } from "@betterdata/config";

import {
  type AuthenticatedUser,
  verifyFirebaseToken
} from "../../integrations/firebase/auth";

export type ResolvedRequestUser = AuthenticatedUser & {
  id: string;
  firebaseUid: string;
  role?: string;
};

export async function getOptionalRequestUser(
  request: FastifyRequest,
  convex: ConvexHttpClient
) {
  const token = readBearerToken(request);

  if (token === null) {
    return null;
  }

  return await resolveConvexUser(await verifyFirebaseToken(token), convex);
}

export async function requireRequestUser(
  request: FastifyRequest,
  convex: ConvexHttpClient
) {
  const user = await getOptionalRequestUser(request, convex);

  if (user === null) {
    throw new Error("Authentication is required.");
  }

  return user;
}

export function resolvePaystackEmail(
  user: ResolvedRequestUser | null,
  reference: string
) {
  if (user?.email) {
    return user.email;
  }

  const prefix = user === null ? "guest" : "user";
  return `${prefix}+${reference}@betterdatagh.com`;
}

async function resolveConvexUser(
  firebaseUser: AuthenticatedUser,
  convex: ConvexHttpClient
): Promise<ResolvedRequestUser> {
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
    ...firebaseUser,
    id: user.id,
    firebaseUid: firebaseUser.firebaseUid,
    ...(user.email !== undefined ? { email: user.email } : {}),
    ...(user.phone !== undefined ? { phone: user.phone } : {}),
    ...(user.displayName !== undefined ? { displayName: user.displayName } : {}),
    ...(user.role !== undefined ? { role: user.role } : {})
  };
}

function readBearerToken(request: FastifyRequest) {
  const authorization = request.headers.authorization;

  if (authorization === undefined) {
    return null;
  }

  const match = /^Bearer\s+(.+)$/i.exec(authorization);

  if (match?.[1] === undefined) {
    return null;
  }

  return match[1];
}
