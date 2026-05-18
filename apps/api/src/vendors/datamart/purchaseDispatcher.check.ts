import assert from "node:assert/strict";

import type { DataMartConfig } from "./config";
import {
  createDataMartPurchaseDispatcher,
  DataMartBatchError,
  type Scheduler
} from "./purchaseDispatcher";
import type {
  DataMartBulkPurchaseRequest,
  DataMartPurchaseRequest,
  DataMartResponse,
  DataMartTransport
} from "./transport";

const config: DataMartConfig = {
  baseUrl: "https://example.com/api",
  apiKey: "api-key",
  requestTimeoutMs: 1000,
  retryCount: 1,
  purchaseBatchWindowMs: 5000,
  purchaseBurstWindowMs: 30000,
  purchaseBurstThreshold: 1,
  lowRateLimitRemainingThreshold: 2
};

function input(idempotencyKey: string, packageId = "datamart:yello-5gb") {
  return {
    packageId,
    network: "mtn" as const,
    recipientPhone: "0551234567",
    idempotencyKey
  };
}

function createManualScheduler(): Scheduler & {
  advance(ms: number): void;
  runAll(): void;
} {
  let now = 0;
  const timers = new Map<unknown, { callback: () => void; runAt: number }>();
  let nextId = 0;

  return {
    setTimeout(callback, delayMs) {
      const id = nextId;
      nextId += 1;
      timers.set(id, { callback, runAt: now + delayMs });
      return id;
    },
    clearTimeout(handle) {
      timers.delete(handle);
    },
    now() {
      return now;
    },
    advance(ms) {
      now += ms;
      this.runAll();
    },
    runAll() {
      const due = [...timers.entries()].filter(([, timer]) => timer.runAt <= now);

      for (const [id, timer] of due) {
        timers.delete(id);
        timer.callback();
      }
    }
  };
}

const immediateCalls: DataMartPurchaseRequest[] = [];
const immediateTransport: DataMartTransport = {
  async purchase(request): Promise<DataMartResponse<unknown>> {
    immediateCalls.push(request);
    return {
      body: {
        data: {
          orderReference: "GN-SINGLE",
          orderStatus: "completed"
        }
      },
      rateLimit: { remaining: 100 }
    };
  },
  async bulkPurchase() {
    throw new Error("bulkPurchase should not be called");
  },
  async listPackages() {
    return { body: {} };
  },
  async getOrderStatus() {
    return { body: {} };
  },
  async getBalance() {
    return { body: {} };
  },
  async getDeliveryTracker() {
    return { body: {} };
  }
};

const immediateDispatcher = createDataMartPurchaseDispatcher({
  transport: immediateTransport,
  config
});
const immediate = await immediateDispatcher.purchase(input("single-1"));
assert.equal(immediate.vendorOrderReference, "GN-SINGLE");
assert.equal(immediateCalls[0]?.capacity, "5");
assert.equal(immediateCalls[0]?.network, "YELLO");

const scheduler = createManualScheduler();
const bulkCalls: DataMartBulkPurchaseRequest[] = [];
const bulkTransport: DataMartTransport = {
  async purchase(request): Promise<DataMartResponse<unknown>> {
    return {
      body: {
        data: {
          orderReference: `GN-${request.phoneNumber}`,
          orderStatus: "completed"
        }
      },
      rateLimit: { remaining: 100 }
    };
  },
  async bulkPurchase(request): Promise<DataMartResponse<unknown>> {
    bulkCalls.push(request);
    return {
      body: {
        data: {
          results: request.orders.map((order) => ({
            ref: order.ref,
            orderReference: `BULK-${order.ref}`,
            status: "queued"
          }))
        }
      },
      rateLimit: { remaining: 80 }
    };
  },
  async listPackages() {
    return { body: {} };
  },
  async getOrderStatus() {
    return { body: {} };
  },
  async getBalance() {
    return { body: {} };
  },
  async getDeliveryTracker() {
    return { body: {} };
  }
};

const bulkDispatcher = createDataMartPurchaseDispatcher({
  transport: bulkTransport,
  config,
  scheduler
});

await bulkDispatcher.purchase(input("burst-1"));
const burst2 = bulkDispatcher.purchase(input("burst-2"));
const burst3 = bulkDispatcher.purchase(input("burst-3"));
scheduler.advance(5000);

const [burst2Result, burst3Result] = await Promise.all([burst2, burst3]);
assert.equal(bulkCalls.length, 1);
assert.equal(bulkCalls[0]?.orders.length, 2);
assert.equal(burst2Result.vendorOrderReference, "BULK-burst-2");
assert.equal(burst2Result.status, "processing");
assert.equal(burst3Result.vendorOrderReference, "BULK-burst-3");

const lowRateScheduler = createManualScheduler();
let lowRateSingleCalls = 0;
let lowRateBulkCalls = 0;
const lowRateTransport: DataMartTransport = {
  async purchase(): Promise<DataMartResponse<unknown>> {
    lowRateSingleCalls += 1;
    return {
      body: {
        data: {
          orderReference: "LOW-FIRST",
          orderStatus: "completed"
        }
      },
      rateLimit: { remaining: 1, resetInSeconds: 1 }
    };
  },
  async bulkPurchase(request): Promise<DataMartResponse<unknown>> {
    lowRateBulkCalls += 1;
    return {
      body: {
        data: {
          results: request.orders.map((order) => ({
            ref: order.ref,
            orderReference: `LOW-${order.ref}`,
            status: "queued"
          }))
        }
      },
      rateLimit: { remaining: 10 }
    };
  },
  async listPackages() {
    return { body: {} };
  },
  async getOrderStatus() {
    return { body: {} };
  },
  async getBalance() {
    return { body: {} };
  },
  async getDeliveryTracker() {
    return { body: {} };
  }
};
const lowRateDispatcher = createDataMartPurchaseDispatcher({
  transport: lowRateTransport,
  config,
  scheduler: lowRateScheduler
});

await lowRateDispatcher.purchase(input("low-1"));
const low2 = lowRateDispatcher.purchase(input("low-2"));
lowRateScheduler.advance(5000);
assert.equal((await low2).vendorOrderReference, "LOW-low-2");
assert.equal(lowRateSingleCalls, 1);
assert.equal(lowRateBulkCalls, 1);

const missingScheduler = createManualScheduler();
const missingDispatcher = createDataMartPurchaseDispatcher({
  transport: {
    ...bulkTransport,
    async bulkPurchase(): Promise<DataMartResponse<unknown>> {
      return {
        body: {
          data: {
            results: []
          }
        }
      };
    }
  },
  config: { ...config, purchaseBurstThreshold: 0 },
  scheduler: missingScheduler
});
const missing = missingDispatcher.purchase(input("missing-1"));
missingScheduler.advance(5000);
await assert.rejects(missing, DataMartBatchError);
