import assert from "node:assert/strict";

import {
  createUpstashRedisClient,
  resolveUpstashRedisConfig,
  type UpstashFetch
} from "./upstash";

assert.equal(resolveUpstashRedisConfig({}), null);
assert.throws(
  () => resolveUpstashRedisConfig({ UPSTASH_REDIS_REST_URL: "https://example" }),
  /UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN/
);

const config = resolveUpstashRedisConfig({
  UPSTASH_REDIS_REST_URL: "https://example.upstash.io/",
  UPSTASH_REDIS_REST_TOKEN: "token",
  UPSTASH_REDIS_KEY_PREFIX: "test",
  UPSTASH_REDIS_REQUEST_TIMEOUT_MS: "2500"
});

assert.deepEqual(config, {
  restUrl: "https://example.upstash.io",
  restToken: "token",
  keyPrefix: "test",
  requestTimeoutMs: 2500
});

const commands: unknown[] = [];
const fakeFetch: UpstashFetch = async (_url, init) => {
  commands.push(JSON.parse(String(init?.body)));

  return new Response(JSON.stringify({ result: "4" }), { status: 200 });
};
const client = createUpstashRedisClient({
  config: config!,
  fetch: fakeFetch
});

await client.hashIncrementByFloat("metrics", "purchase.success", 2);
assert.equal(await client.hashGetNumber("metrics", "purchase.success"), 4);
assert.deepEqual(commands, [
  ["HINCRBYFLOAT", "test:metrics", "purchase.success", "2"],
  ["HGET", "test:metrics", "purchase.success"]
]);

const timeoutClient = createUpstashRedisClient({
  config: { ...config!, requestTimeoutMs: 1 },
  fetch: async (_url, init) =>
    await new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        reject(new DOMException("aborted", "AbortError"));
      });
    })
});
await assert.rejects(
  timeoutClient.command(["GET", "test:key"]),
  /Upstash Redis command timed out/
);
