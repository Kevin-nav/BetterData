import type {
  FastifyReply,
  FastifyRequest,
  preHandlerHookHandler
} from "fastify";

import {
  verifyFirebaseToken,
  type AuthenticatedUser
} from "../integrations/firebase/auth";

export type VerifyToken = (token: string) => Promise<AuthenticatedUser>;

export function createRequireAdmin(options?: {
  verifyToken?: VerifyToken;
  env?: NodeJS.ProcessEnv;
}): preHandlerHookHandler {
  const verifyToken = options?.verifyToken ?? verifyFirebaseToken;
  const env = options?.env ?? process.env;

  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (isValidAdminApiKey(request.headers["x-admin-api-key"], env)) {
      return;
    }

    const token = readBearerToken(request.headers.authorization);

    if (!token) {
      return reply.code(401).send({ message: "Admin authentication is required." });
    }

    let user: AuthenticatedUser;

    try {
      user = await verifyToken(token);
    } catch (error) {
      request.log.warn({ error }, "Admin token verification failed");

      return reply.code(401).send({ message: "Admin authentication is invalid." });
    }

    if (!isAdminUser(user, env)) {
      return reply.code(403).send({ message: "Admin access is required." });
    }
  };
}

export function isValidAdminApiKey(
  value: string | string[] | undefined,
  env: NodeJS.ProcessEnv = process.env
) {
  const configured = env.ADMIN_API_KEY;

  if (!configured) {
    return false;
  }

  const provided = Array.isArray(value) ? value[0] : value;

  return provided === configured;
}

export function isAdminUser(
  user: AuthenticatedUser,
  env: NodeJS.ProcessEnv = process.env
) {
  if (user.claims?.admin === true || user.claims?.role === "admin") {
    return true;
  }

  if (env.ADMIN_FIREBASE_UIDS) {
    const uids = readCsv(env.ADMIN_FIREBASE_UIDS);

    if (uids.includes(user.id)) {
      return true;
    }
  }

  if (user.email && env.ADMIN_EMAILS) {
    const emails = readCsv(env.ADMIN_EMAILS).map((email) => email.toLowerCase());

    if (emails.includes(user.email.toLowerCase())) {
      return true;
    }
  }

  return false;
}

export function readBearerToken(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const match = value.match(/^Bearer\s+(.+)$/i);

  return match?.[1]?.trim();
}

function readCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
