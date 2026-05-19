import type { DataMartConfig } from "./config";

export type DataMartRateLimit = {
  limit?: number;
  remaining?: number;
  resetInSeconds?: number;
};

export type DataMartResponse<T> = {
  body: T;
  rateLimit?: DataMartRateLimit;
};

export type DataMartPurchaseRequest = {
  phoneNumber: string;
  network: string;
  capacity: string;
  gateway: "wallet";
};

export type DataMartBulkPurchaseRequest = {
  orders: Array<{
    phoneNumber: string;
    network: string;
    capacity: string;
    ref?: string;
  }>;
};

export type DataMartFetch = typeof fetch;

export class DataMartHttpError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly body: unknown,
    readonly rateLimit?: DataMartRateLimit
  ) {
    super(message);
    this.name = "DataMartHttpError";
  }
}

export class DataMartNetworkError extends Error {
  constructor(
    message: string,
    readonly cause: unknown
  ) {
    super(message);
    this.name = "DataMartNetworkError";
  }
}

export type DataMartTransport = {
  listPackages(network?: string): Promise<DataMartResponse<unknown>>;
  purchase(
    input: DataMartPurchaseRequest,
    idempotencyKey: string
  ): Promise<DataMartResponse<unknown>>;
  bulkPurchase(
    input: DataMartBulkPurchaseRequest,
    idempotencyKey: string
  ): Promise<DataMartResponse<unknown>>;
  getOrderStatus(reference: string): Promise<DataMartResponse<unknown>>;
  getBalance(): Promise<DataMartResponse<unknown>>;
  getDeliveryTracker(): Promise<DataMartResponse<unknown>>;
};

export function createDataMartTransport(options: {
  config: DataMartConfig;
  fetch?: DataMartFetch;
}): DataMartTransport {
  const fetchImpl = options.fetch ?? fetch;

  return {
    listPackages(network?: string) {
      const query = network ? `?network=${encodeURIComponent(network)}` : "";
      return request({
        config: options.config,
        fetchImpl,
        method: "GET",
        path: `/data-packages${query}`
      });
    },

    purchase(input, idempotencyKey) {
      return request({
        config: options.config,
        fetchImpl,
        method: "POST",
        path: "/purchase",
        body: input,
        idempotencyKey
      });
    },

    bulkPurchase(input, idempotencyKey) {
      return request({
        config: options.config,
        fetchImpl,
        method: "POST",
        path: "/bulk-purchase",
        body: input,
        idempotencyKey
      });
    },

    getOrderStatus(reference) {
      return request({
        config: options.config,
        fetchImpl,
        method: "GET",
        path: `/order-status/${encodeURIComponent(reference)}`
      });
    },

    getBalance() {
      return request({
        config: options.config,
        fetchImpl,
        method: "GET",
        path: "/balance"
      });
    },

    getDeliveryTracker() {
      return request({
        config: options.config,
        fetchImpl,
        method: "GET",
        path: "/delivery-tracker"
      });
    }
  };
}

async function request(options: {
  config: DataMartConfig;
  fetchImpl: DataMartFetch;
  method: "GET" | "POST";
  path: string;
  body?: unknown;
  idempotencyKey?: string;
}): Promise<DataMartResponse<unknown>> {
  let attempt = 0;
  let lastError: unknown;

  while (attempt <= options.config.retryCount) {
    try {
      return await requestOnce(options);
    } catch (error) {
      lastError = error;

      if (!shouldRetry(error) || attempt >= options.config.retryCount) {
        throw error;
      }
    }

    attempt += 1;
  }

  throw lastError;
}

async function requestOnce(options: {
  config: DataMartConfig;
  fetchImpl: DataMartFetch;
  method: "GET" | "POST";
  path: string;
  body?: unknown;
  idempotencyKey?: string;
}): Promise<DataMartResponse<unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.config.requestTimeoutMs);
  const rawBody = options.body === undefined ? undefined : JSON.stringify(options.body);

  try {
    const init: RequestInit = {
      method: options.method,
      headers: requestHeaders(options.config.apiKey, options.idempotencyKey),
      signal: controller.signal
    };

    if (rawBody !== undefined) {
      init.body = rawBody;
    }

    const response = await options.fetchImpl(
      `${options.config.baseUrl}${options.path}`,
      init
    );

    const body = await readJsonBody(response);
    const rateLimit = extractRateLimit(body, response.headers);

    if (!response.ok) {
      throw new DataMartHttpError(
        dataMartErrorMessage(body, response.status),
        response.status,
        body,
        rateLimit
      );
    }

    return {
      body,
      ...(rateLimit ? { rateLimit } : {})
    };
  } catch (error) {
    if (error instanceof DataMartHttpError) {
      throw error;
    }

    throw new DataMartNetworkError("DataMart request failed.", error);
  } finally {
    clearTimeout(timeout);
  }
}

function requestHeaders(apiKey: string, idempotencyKey?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-API-Key": apiKey
  };

  if (idempotencyKey) {
    headers["X-Idempotency-Key"] = idempotencyKey;
  }

  return headers;
}

async function readJsonBody(response: Response) {
  const text = await response.text();

  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function extractRateLimit(body: unknown, headers: Headers): DataMartRateLimit | undefined {
  const bodyRateLimit =
    typeof body === "object" && body !== null && "rateLimit" in body
      ? (body as { rateLimit?: unknown }).rateLimit
      : undefined;

  const limit = readNumber(
    readHeader(headers, "X-RateLimit-Limit") ?? readRateLimitField(bodyRateLimit, "limit")
  );
  const remaining = readNumber(
    readHeader(headers, "X-RateLimit-Remaining") ??
      readRateLimitField(bodyRateLimit, "remaining")
  );
  const resetInSeconds = readNumber(
    readHeader(headers, "X-RateLimit-Reset") ??
      readRateLimitField(bodyRateLimit, "resetInSeconds")
  );

  if (limit === undefined && remaining === undefined && resetInSeconds === undefined) {
    return undefined;
  }

  return {
    ...(limit !== undefined ? { limit } : {}),
    ...(remaining !== undefined ? { remaining } : {}),
    ...(resetInSeconds !== undefined ? { resetInSeconds } : {})
  };
}

function readHeader(headers: Headers, name: string) {
  return headers.get(name) ?? headers.get(name.toLowerCase());
}

function readRateLimitField(rateLimit: unknown, field: keyof DataMartRateLimit) {
  if (typeof rateLimit !== "object" || rateLimit === null || !(field in rateLimit)) {
    return undefined;
  }

  return (rateLimit as DataMartRateLimit)[field];
}

function readNumber(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : undefined;
}

function dataMartErrorMessage(body: unknown, statusCode: number) {
  if (typeof body === "object" && body !== null && "message" in body) {
    const message = (body as { message?: unknown }).message;

    if (typeof message === "string" && message) {
      return message;
    }
  }

  return `DataMart request failed with HTTP ${statusCode}.`;
}

function shouldRetry(error: unknown) {
  if (error instanceof DataMartNetworkError) {
    return true;
  }

  return error instanceof DataMartHttpError && error.statusCode >= 500;
}
