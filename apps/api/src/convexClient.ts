import { getRequiredEnv } from "@betterdata/config";
import { ConvexHttpClient } from "convex/browser";

export function createConvexHttpClient() {
  return new ConvexHttpClient(normalizeConvexUrl(getRequiredEnv("CONVEX_URL")));
}

export function normalizeConvexUrl(url: string) {
  return url.trim().replace(/\/+$/, "");
}
