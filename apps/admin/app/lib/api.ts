/**
 * Base URL for the BetterData backend API.
 *
 * Reads `NEXT_PUBLIC_API_BASE_URL` when configured; falls back to the local
 * development server. Intended for client-side fetch helpers that talk to the
 * REST API outside of Convex.
 */
export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
}
