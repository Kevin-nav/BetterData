import {
  createUpstashRedisClient,
  resolveUpstashRedisConfig,
  type UpstashRedisClient
} from "../redis/upstash";

export type MetricsSnapshot = Record<string, number>;

export type MetricsBackend = {
  increment(name: string, amount: number): Promise<void>;
  get(name: string): Promise<number>;
  snapshot(): Promise<MetricsSnapshot>;
  resetForTests(): Promise<void>;
};

const METRICS_KEY = "metrics:counters";

let backend: MetricsBackend = createMemoryMetricsBackend();

export async function incrementMetric(name: string, amount = 1) {
  await backend.increment(name, amount);
}

export async function getMetric(name: string) {
  return await backend.get(name);
}

export async function snapshotMetrics() {
  return await backend.snapshot();
}

export async function resetMetricsForTests() {
  await backend.resetForTests();
}

export function setMetricsBackend(nextBackend: MetricsBackend) {
  backend = nextBackend;
}

export function configureMetricsFromEnv(env: NodeJS.ProcessEnv = process.env) {
  const config = resolveUpstashRedisConfig(env);

  if (config) {
    setMetricsBackend(
      createUpstashMetricsBackend(createUpstashRedisClient({ config }))
    );
    return;
  }

  if (env.NODE_ENV === "production") {
    throw new Error(
      "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required in production for shared metrics."
    );
  }

  setMetricsBackend(createMemoryMetricsBackend());
}

export function createMemoryMetricsBackend(): MetricsBackend {
  const counters = new Map<string, number>();

  return {
    async increment(name, amount) {
      counters.set(name, (counters.get(name) ?? 0) + amount);
    },

    async get(name) {
      return counters.get(name) ?? 0;
    },

    async snapshot() {
      return Object.fromEntries(counters.entries());
    },

    async resetForTests() {
      counters.clear();
    }
  };
}

export function createUpstashMetricsBackend(
  redis: Pick<
    UpstashRedisClient,
    "hashIncrementByFloat" | "hashGetNumber" | "hashGetAllNumbers" | "del"
  >
): MetricsBackend {
  return {
    async increment(name, amount) {
      await redis.hashIncrementByFloat(METRICS_KEY, name, amount);
    },

    async get(name) {
      return await redis.hashGetNumber(METRICS_KEY, name);
    },

    async snapshot() {
      return await redis.hashGetAllNumbers(METRICS_KEY);
    },

    async resetForTests() {
      await redis.del(METRICS_KEY);
    }
  };
}
