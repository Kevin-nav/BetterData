export type DataMartConfig = {
  baseUrl: string;
  apiKey: string;
  requestTimeoutMs: number;
  retryCount: number;
  purchaseBatchWindowMs: number;
  purchaseBurstWindowMs: number;
  purchaseBurstThreshold: number;
  lowRateLimitRemainingThreshold: number;
};

const DEFAULT_BASE_URL = "https://api.datamartgh.shop/api/developer";

export function resolveDataMartConfig(
  env: NodeJS.ProcessEnv = process.env
): DataMartConfig {
  const apiKey = env.DATAMART_API_KEY;

  if (!apiKey) {
    throw new Error("DATAMART_API_KEY is required when datamart is active.");
  }

  return {
    baseUrl: trimTrailingSlash(env.DATAMART_BASE_URL ?? DEFAULT_BASE_URL),
    apiKey,
    requestTimeoutMs: readPositiveInt(env.DATAMART_REQUEST_TIMEOUT_MS, 15000),
    retryCount: readPositiveInt(env.DATAMART_RETRY_COUNT, 1),
    purchaseBatchWindowMs: readPositiveInt(
      env.DATAMART_PURCHASE_BATCH_WINDOW_MS,
      5000
    ),
    purchaseBurstWindowMs: readPositiveInt(
      env.DATAMART_PURCHASE_BURST_WINDOW_MS,
      30000
    ),
    purchaseBurstThreshold: readPositiveInt(
      env.DATAMART_PURCHASE_BURST_THRESHOLD,
      20
    ),
    lowRateLimitRemainingThreshold: readPositiveInt(
      env.DATAMART_LOW_RATE_LIMIT_REMAINING_THRESHOLD,
      20
    )
  };
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function readPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
