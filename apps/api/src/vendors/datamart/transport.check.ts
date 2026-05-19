import assert from "node:assert/strict";

import type { DataMartConfig } from "./config";
import {
  createDataMartTransport,
  DataMartHttpError,
  type DataMartFetch
} from "./transport";

const config: DataMartConfig = {
  baseUrl: "https://example.com/api",
  apiKey: "api-key",
  requestTimeoutMs: 1000,
  retryCount: 1,
  purchaseBatchWindowMs: 5000,
  purchaseBurstWindowMs: 30000,
  purchaseBurstThreshold: 20,
  lowRateLimitRemainingThreshold: 20,
  packagesCacheTtlSeconds: 300,
  balanceCacheTtlSeconds: 30,
  deliveryTrackerCacheTtlSeconds: 60
};

const calls: Array<{ url: string; init: RequestInit }> = [];
const fetchOk: DataMartFetch = async (url, init) => {
  calls.push({ url: String(url), init: init ?? {} });

  return new Response(
    JSON.stringify({
      status: "success",
      data: {},
      rateLimit: { limit: 150, remaining: 149, resetInSeconds: 45 }
    }),
    { status: 200 }
  );
};

const transport = createDataMartTransport({ config, fetch: fetchOk });

await transport.listPackages("YELLO");
assert.equal(calls[0]?.url, "https://example.com/api/data-packages?network=YELLO");
assert.equal((calls[0]?.init.headers as Record<string, string>)["X-API-Key"], "api-key");

await transport.purchase(
  {
    phoneNumber: "0551234567",
    network: "YELLO",
    capacity: "5",
    gateway: "wallet"
  },
  "idem-1"
);
assert.equal(calls[1]?.url, "https://example.com/api/purchase");
assert.equal(calls[1]?.init.method, "POST");
assert.equal(
  (calls[1]?.init.headers as Record<string, string>)["X-Idempotency-Key"],
  "idem-1"
);
assert.equal(
  calls[1]?.init.body,
  JSON.stringify({
    phoneNumber: "0551234567",
    network: "YELLO",
    capacity: "5",
    gateway: "wallet"
  })
);

await transport.bulkPurchase(
  {
    orders: [
      {
        phoneNumber: "0551234567",
        network: "YELLO",
        capacity: "5",
        ref: "ref-1"
      }
    ]
  },
  "batch-1"
);
assert.equal(calls[2]?.url, "https://example.com/api/bulk-purchase");
assert.equal(
  (calls[2]?.init.headers as Record<string, string>)["X-Idempotency-Key"],
  "batch-1"
);

const headerTransport = createDataMartTransport({
  config,
  fetch: async () =>
    new Response(JSON.stringify({ status: "success" }), {
      status: 200,
      headers: {
        "X-RateLimit-Limit": "120",
        "X-RateLimit-Remaining": "12",
        "X-RateLimit-Reset": "9"
      }
    })
});
const headerResponse = await headerTransport.getBalance();
assert.deepEqual(headerResponse.rateLimit, {
  limit: 120,
  remaining: 12,
  resetInSeconds: 9
});

const errorTransport = createDataMartTransport({
  config,
  fetch: async () =>
    new Response(JSON.stringify({ status: "error", message: "Rate limited" }), {
      status: 429
    })
});
await assert.rejects(
  () => errorTransport.getBalance(),
  (error) =>
    error instanceof DataMartHttpError &&
    error.statusCode === 429 &&
    error.message === "Rate limited"
);

let attempts = 0;
const retryTransport = createDataMartTransport({
  config,
  fetch: async () => {
    attempts += 1;

    if (attempts === 1) {
      return new Response(JSON.stringify({ message: "temporary" }), { status: 500 });
    }

    return new Response(JSON.stringify({ status: "success" }), { status: 200 });
  }
});

await retryTransport.getBalance();
assert.equal(attempts, 2);
