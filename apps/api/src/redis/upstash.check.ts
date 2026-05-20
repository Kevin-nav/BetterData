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

const lockCommands: unknown[] = [];
const lockClient = createUpstashRedisClient({
  config: config!,
  fetch: async (_url, init) => {
    const command = JSON.parse(String(init?.body)) as string[];
    lockCommands.push(command);

    if (command[0] === "SET") {
      return new Response(JSON.stringify({ result: "OK" }), { status: 200 });
    }

    if (command[0] === "GET") {
      return new Response(JSON.stringify({ result: "owner-1" }), { status: 200 });
    }

    return new Response(JSON.stringify({ result: 1 }), { status: 200 });
  }
});

assert.equal(
  await lockClient.acquireLock("datamart:packages:refresh", "owner-1", 30),
  true
);
await lockClient.releaseLock("datamart:packages:refresh", "owner-1");
assert.deepEqual(lockCommands, [
  [
    "SET",
    "test:datamart:packages:refresh",
    "owner-1",
    "NX",
    "EX",
    "30"
  ],
  ["GET", "test:datamart:packages:refresh"],
  ["DEL", "test:datamart:packages:refresh"]
]);

const missedLockClient = createUpstashRedisClient({
  config: config!,
  fetch: async () =>
    new Response(JSON.stringify({ result: null }), { status: 200 })
});
assert.equal(await missedLockClient.acquireLock("lock", "owner-2", 5), false);

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
