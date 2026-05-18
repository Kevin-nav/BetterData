export type UpstashFetch = typeof fetch;

export type UpstashRedisClient = {
  command<T = unknown>(command: string[]): Promise<T>;
  getJson<T>(key: string): Promise<T | null>;
  setJson(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
  hashIncrementByFloat(key: string, field: string, amount: number): Promise<void>;
  hashGetNumber(key: string, field: string): Promise<number>;
  hashGetAllNumbers(key: string): Promise<Record<string, number>>;
};

export type UpstashRedisConfig = {
  restUrl: string;
  restToken: string;
  keyPrefix: string;
};

export function resolveUpstashRedisConfig(
  env: NodeJS.ProcessEnv = process.env
): UpstashRedisConfig | null {
  const restUrl = env.UPSTASH_REDIS_REST_URL;
  const restToken = env.UPSTASH_REDIS_REST_TOKEN;

  if (!restUrl && !restToken) {
    return null;
  }

  if (!restUrl || !restToken) {
    throw new Error(
      "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set together."
    );
  }

  return {
    restUrl: restUrl.replace(/\/+$/, ""),
    restToken,
    keyPrefix: env.UPSTASH_REDIS_KEY_PREFIX ?? "betterdata"
  };
}

export function createUpstashRedisClient(options: {
  config: UpstashRedisConfig;
  fetch?: UpstashFetch;
}): UpstashRedisClient {
  const fetchImpl = options.fetch ?? fetch;

  async function command<T = unknown>(redisCommand: string[]) {
    const response = await fetchImpl(options.config.restUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.config.restToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(redisCommand)
    });

    if (!response.ok) {
      throw new Error(`Upstash Redis command failed with HTTP ${response.status}.`);
    }

    const body = (await response.json()) as {
      result?: T;
      error?: string;
    };

    if (body.error) {
      throw new Error(`Upstash Redis command failed: ${body.error}`);
    }

    return body.result as T;
  }

  function key(name: string) {
    return `${options.config.keyPrefix}:${name}`;
  }

  return {
    command,

    async getJson<T>(name: string) {
      const value = await command<string | null>(["GET", key(name)]);

      return value === null ? null : (JSON.parse(value) as T);
    },

    async setJson(name: string, value: unknown, ttlSeconds: number) {
      await command(["SET", key(name), JSON.stringify(value), "EX", String(ttlSeconds)]);
    },

    async del(name: string) {
      await command(["DEL", key(name)]);
    },

    async hashIncrementByFloat(name: string, field: string, amount: number) {
      await command(["HINCRBYFLOAT", key(name), field, String(amount)]);
    },

    async hashGetNumber(name: string, field: string) {
      return parseNumber(await command<string | null>(["HGET", key(name), field]));
    },

    async hashGetAllNumbers(name: string) {
      const values = await command<Record<string, string> | string[] | null>([
        "HGETALL",
        key(name)
      ]);

      if (values === null) {
        return {};
      }

      if (Array.isArray(values)) {
        const snapshot: Record<string, number> = {};

        for (let index = 0; index < values.length; index += 2) {
          const field = values[index];
          if (field !== undefined) {
            snapshot[field] = parseNumber(values[index + 1]);
          }
        }

        return snapshot;
      }

      return Object.fromEntries(
        Object.entries(values).map(([field, value]) => [field, parseNumber(value)])
      );
    }
  };
}

function parseNumber(value: unknown) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}
