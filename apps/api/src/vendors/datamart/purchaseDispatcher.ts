import { randomUUID } from "node:crypto";

import type {
  VendorPurchaseInput,
  VendorPurchaseResult
} from "@betterdata/contracts";

import type { DataMartConfig } from "./config";
import { mapDataMartBulkPurchaseResponse, mapDataMartPurchaseResponse, toDataMartProviderCode } from "./mapper";
import type { DataMartRateLimit, DataMartTransport } from "./transport";

export type Scheduler = {
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
  now(): number;
};

type QueueItem = {
  input: VendorPurchaseInput;
  resolve: (result: VendorPurchaseResult) => void;
  reject: (error: unknown) => void;
};

export class DataMartBatchError extends Error {
  constructor(
    message: string,
    readonly raw?: unknown
  ) {
    super(message);
    this.name = "DataMartBatchError";
  }
}

export function createDataMartPurchaseDispatcher(options: {
  transport: DataMartTransport;
  config: DataMartConfig;
  scheduler?: Scheduler;
}) {
  const scheduler = options.scheduler ?? realScheduler;
  const purchaseTimestamps: number[] = [];
  const queue: QueueItem[] = [];
  let latestRateLimit: DataMartRateLimit | undefined;
  let flushTimer: unknown;

  async function purchase(input: VendorPurchaseInput): Promise<VendorPurchaseResult> {
    const now = scheduler.now();
    recordPurchaseAttempt(purchaseTimestamps, now, options.config.purchaseBurstWindowMs);

    if (shouldQueue(purchaseTimestamps, latestRateLimit, options.config)) {
      return enqueue(input);
    }

    const response = await options.transport.purchase(
      toSinglePurchaseRequest(input),
      input.idempotencyKey
    );
    latestRateLimit = response.rateLimit;

    return mapDataMartPurchaseResponse(response.body as Parameters<typeof mapDataMartPurchaseResponse>[0]);
  }

  function enqueue(input: VendorPurchaseInput): Promise<VendorPurchaseResult> {
    const promise = new Promise<VendorPurchaseResult>((resolve, reject) => {
      queue.push({ input, resolve, reject });
    });

    if (queue.length >= 50) {
      void flush();
      return promise;
    }

    scheduleFlush();

    return promise;
  }

  function scheduleFlush() {
    if (flushTimer !== undefined) {
      return;
    }

    const delayMs =
      latestRateLimit?.remaining === 0 && latestRateLimit.resetInSeconds
        ? Math.max(options.config.purchaseBatchWindowMs, latestRateLimit.resetInSeconds * 1000)
        : options.config.purchaseBatchWindowMs;

    flushTimer = scheduler.setTimeout(() => {
      flushTimer = undefined;
      void flush();
    }, delayMs);
  }

  async function flush() {
    if (flushTimer !== undefined) {
      scheduler.clearTimeout(flushTimer);
      flushTimer = undefined;
    }

    const batch = queue.splice(0, 50);

    if (batch.length === 0) {
      return;
    }

    try {
      const response = await options.transport.bulkPurchase(
        {
          orders: batch.map((item) => ({
            phoneNumber: item.input.recipientPhone,
            network: toDataMartProviderCode(item.input.network),
            capacity: packageCapacity(item.input.packageId),
            ref: item.input.idempotencyKey
          }))
        },
        randomUUID()
      );
      latestRateLimit = response.rateLimit;

      const mapped = mapDataMartBulkPurchaseResponse(
        response.body as Parameters<typeof mapDataMartBulkPurchaseResponse>[0]
      );

      for (const item of batch) {
        const result = mapped.get(item.input.idempotencyKey);

        if (!result) {
          item.reject(
            new DataMartBatchError(
              `DataMart bulk response did not include result for ${item.input.idempotencyKey}.`,
              response.body
            )
          );
          continue;
        }

        item.resolve({
          ...result,
          estimatedDeliverySeconds: result.status === "processing" ? 30 * 60 : 0
        });
      }
    } catch (error) {
      for (const item of batch) {
        item.reject(error);
      }
    } finally {
      if (queue.length > 0) {
        scheduleFlush();
      }
    }
  }

  return {
    purchase,
    flush
  };
}

function shouldQueue(
  purchaseTimestamps: number[],
  latestRateLimit: DataMartRateLimit | undefined,
  config: DataMartConfig
) {
  if (
    latestRateLimit?.remaining !== undefined &&
    latestRateLimit.remaining <= config.lowRateLimitRemainingThreshold
  ) {
    return true;
  }

  return purchaseTimestamps.length > config.purchaseBurstThreshold;
}

function recordPurchaseAttempt(
  purchaseTimestamps: number[],
  now: number,
  burstWindowMs: number
) {
  const cutoff = now - burstWindowMs;

  while (
    purchaseTimestamps.length > 0 &&
    purchaseTimestamps[0] !== undefined &&
    purchaseTimestamps[0] < cutoff
  ) {
    purchaseTimestamps.shift();
  }

  purchaseTimestamps.push(now);
}

function toSinglePurchaseRequest(input: VendorPurchaseInput) {
  return {
    phoneNumber: input.recipientPhone,
    network: toDataMartProviderCode(input.network),
    capacity: packageCapacity(input.packageId),
    gateway: "wallet" as const
  };
}

export function packageCapacity(packageId: string) {
  const match = packageId.match(/(\d+(?:\.\d+)?)gb/i);

  if (!match?.[1]) {
    throw new Error(`Invalid DataMart packageId capacity: ${packageId}`);
  }

  return match[1];
}

const realScheduler: Scheduler = {
  setTimeout(callback, delayMs) {
    return setTimeout(callback, delayMs);
  },
  clearTimeout(handle) {
    clearTimeout(handle as NodeJS.Timeout);
  },
  now() {
    return Date.now();
  }
};
