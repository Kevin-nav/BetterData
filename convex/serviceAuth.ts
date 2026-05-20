import { ConvexError } from "convex/values";

export function requireServiceSecret(serviceSecret: string) {
  const expected = process.env.BETTERDATA_SERVICE_SECRET;

  if (!expected || serviceSecret !== expected) {
    throw new ConvexError({
      code: "service_auth_failed",
      reason: expected ? "mismatch" : "missing"
    });
  }
}
