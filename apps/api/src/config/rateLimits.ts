export type RateLimitConfig = {
  global: { max: number; timeWindow: string };
  ordersCreate: { max: number; timeWindow: string };
  orderStatus: { max: number; timeWindow: string };
  admin: { max: number; timeWindow: string };
  webhook: { max: number; timeWindow: string };
};

export function resolveRateLimitConfig(
  env: NodeJS.ProcessEnv = process.env
): RateLimitConfig {
  return {
    global: {
      max: readPositiveInt(env.API_RATE_LIMIT_GLOBAL_MAX, 300),
      timeWindow: env.API_RATE_LIMIT_GLOBAL_WINDOW ?? "1 minute"
    },
    ordersCreate: {
      max: readPositiveInt(env.API_RATE_LIMIT_ORDERS_CREATE_MAX, 20),
      timeWindow: env.API_RATE_LIMIT_ORDERS_CREATE_WINDOW ?? "1 minute"
    },
    orderStatus: {
      max: readPositiveInt(env.API_RATE_LIMIT_ORDER_STATUS_MAX, 60),
      timeWindow: env.API_RATE_LIMIT_ORDER_STATUS_WINDOW ?? "1 minute"
    },
    admin: {
      max: readPositiveInt(env.API_RATE_LIMIT_ADMIN_MAX, 120),
      timeWindow: env.API_RATE_LIMIT_ADMIN_WINDOW ?? "1 minute"
    },
    webhook: {
      max: readPositiveInt(env.API_RATE_LIMIT_WEBHOOK_MAX, 120),
      timeWindow: env.API_RATE_LIMIT_WEBHOOK_WINDOW ?? "1 minute"
    }
  };
}

function readPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
