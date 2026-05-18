import type { FastifyRequest } from "fastify";

import {
  type AuthenticatedUser,
  verifyFirebaseToken
} from "../../integrations/firebase/auth";

export async function getOptionalRequestUser(request: FastifyRequest) {
  const token = readBearerToken(request);

  if (token === null) {
    return null;
  }

  return await verifyFirebaseToken(token);
}

export async function requireRequestUser(request: FastifyRequest) {
  const user = await getOptionalRequestUser(request);

  if (user === null) {
    throw new Error("Authentication is required.");
  }

  return user;
}

export function resolvePaystackEmail(
  user: AuthenticatedUser | null,
  reference: string
) {
  if (user?.email) {
    return user.email;
  }

  const prefix = user === null ? "guest" : "user";
  return `${prefix}+${reference}@betterdatagh.com`;
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
