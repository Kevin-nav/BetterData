import type { DataPackage, PurchaseRequest, VendorOrderStatus } from "@betterdata/contracts";

type FetchLike = typeof fetch;

export type BetterDataApiClientOptions = {
  baseUrl: string;
  fetch?: FetchLike;
};

export type ListDataPackagesResponse = {
  vendor: {
    id: string;
    displayName: string;
  };
  packages: DataPackage[];
};

export type CreateOrderResponse = {
  reference: string;
  vendorId: string;
  status: VendorOrderStatus;
  estimatedDeliverySeconds?: number;
};

export type OrderStatusResponse = {
  reference: string;
  vendorId: string;
  status: VendorOrderStatus;
};

export type BetterDataApiClient = {
  listDataPackages: () => Promise<ListDataPackagesResponse>;
  createOrder: (body: PurchaseRequest) => Promise<CreateOrderResponse>;
  getOrderStatus: (reference: string) => Promise<OrderStatusResponse>;
};

export class ApiClientError extends Error {
  readonly status: number;
  readonly responseText: string;

  constructor(message: string, status: number, responseText: string) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.responseText = responseText;
  }
}

export function createBetterDataApiClient(
  options: BetterDataApiClientOptions
): BetterDataApiClient {
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const fetcher = options.fetch ?? globalThis.fetch;

  if (!fetcher) {
    throw new Error("A fetch implementation is required for Better Data API calls.");
  }

  async function request<TResponse>(
    path: string,
    init?: RequestInit
  ): Promise<TResponse> {
    const response = await fetcher(`${baseUrl}${path}`, {
      ...init,
      headers: {
        ...(init?.body ? { "content-type": "application/json" } : undefined),
        ...init?.headers
      }
    });

    if (!response.ok) {
      const responseText = await response.text();
      throw new ApiClientError(
        readErrorMessage(responseText) ?? `Better Data API request failed with ${response.status}.`,
        response.status,
        responseText
      );
    }

    return (await response.json()) as TResponse;
  }

  return {
    listDataPackages: () => request<ListDataPackagesResponse>("/data-packages"),
    createOrder: (body) =>
      request<CreateOrderResponse>("/orders", {
        method: "POST",
        body: JSON.stringify(body)
      }),
    getOrderStatus: (reference) =>
      request<OrderStatusResponse>(
        `/orders/${encodeURIComponent(reference)}/status`
      )
  };
}

function readErrorMessage(responseText: string) {
  if (!responseText) {
    return undefined;
  }

  try {
    const data = JSON.parse(responseText) as { message?: string };
    return data.message;
  } catch {
    return undefined;
  }
}
