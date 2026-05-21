import type {
  FastifyReply,
  FastifyRequest,
  preHandlerHookHandler
} from "fastify";
import { getAdminScopeForRole, getRequiredEnv, type AdminScope } from "@betterdata/config";
import { userFunctions } from "@betterdata/app-api";

import {
  verifyFirebaseToken,
  type AuthenticatedUser
} from "../integrations/firebase/auth";
import { createConvexHttpClient } from "../convexClient";

export type AdminPrincipal = AuthenticatedUser & {
  adminScope: AdminScope;
  convexUserId?: string;
  role?: string;
};

export type VerifyToken = (token: string) => Promise<AuthenticatedUser>;
export type ResolveAdminProfile = (
  user: AuthenticatedUser
) => Promise<{ id?: string; role?: string } | null>;

declare module "fastify" {
  interface FastifyRequest {
    adminUser?: AdminPrincipal;
  }
}

export function createRequireAdmin(options?: {
  verifyToken?: VerifyToken;
  resolveAdminProfile?: ResolveAdminProfile;
  env?: NodeJS.ProcessEnv;
}): preHandlerHookHandler {
  const verifyToken = options?.verifyToken ?? verifyFirebaseToken;
  const resolveAdminProfile =
    options?.resolveAdminProfile ?? createConvexAdminProfileResolver();
  const env = options?.env ?? process.env;

  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (isValidAdminApiKey(request.headers["x-admin-api-key"], env)) {
      request.adminUser = { id: "api-key", firebaseUid: "api-key", adminScope: "superadmin" };
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

    const profile = await resolveAdminProfile(user);
    const scope = resolveAdminScope(user, profile?.role, env);

    if (!scope) {
      return reply.code(403).send({ message: "Admin access is required." });
    }

    request.adminUser = {
      ...user,
      adminScope: scope,
      ...(profile?.id ? { convexUserId: profile.id } : {}),
      ...(profile?.role ? { role: profile.role } : {})
    };
  };
}

export function resolveAdminScope(
  user: AuthenticatedUser,
  role: string | undefined,
  env: NodeJS.ProcessEnv = process.env
): AdminScope | null {
  const roleScope = getAdminScopeForRole(role);

  if (roleScope) {
    return roleScope;
  }

  if (user.claims?.superadmin === true || user.claims?.role === "superadmin") {
    return "superadmin";
  }

  if (user.email && isEmailInCsv(user.email, env.ADMIN_SUPERADMIN_EMAILS)) {
    return "superadmin";
  }

  if (isAdminUser(user, env)) {
    return "admin";
  }

  return null;
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

function isEmailInCsv(email: string, value: string | undefined) {
  if (!value) {
    return false;
  }

  const normalizedEmail = email.trim().toLowerCase();
  return readCsv(value)
    .map((entry) => entry.toLowerCase())
    .includes(normalizedEmail);
}

function createConvexAdminProfileResolver(): ResolveAdminProfile {
  return async (user) => {
    const convex = createConvexHttpClient();
    const profile = await convex.query(userFunctions.getByFirebaseUid, {
      serviceSecret: getRequiredEnv("BETTERDATA_SERVICE_SECRET"),
      firebaseUid: user.firebaseUid
    });

    if (!profile) {
      return null;
    }

    return {
      id: profile._id,
      role: profile.role
    };
  };
}
