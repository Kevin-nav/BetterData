import type {
  CreatePaymentIntentRequest,
  CreatePaymentIntentResponse,
  DataPackage,
  PaymentIntentStatusResponse,
  PurchaseRequest,
  WalletTransactionType,
  VendorOrderStatus,
  Order
} from "@betterdata/contracts";

type FetchLike = typeof fetch;

export type BetterDataApiClientOptions = {
  baseUrl: string;
  fetch?: FetchLike;
  headers?: HeadersInit;
};

export type ListDataPackagesResponse = {
  vendor: {
    id: string;
    displayName: string;
  };
  packages: DataPackage[];
};

export type ListOrdersResponse = {
  orders: Order[];
};

export type WalletTransaction = {
  id: string;
  type: WalletTransactionType;
  amountGhs: number;
  reference: string;
  description: string;
  createdAt: number;
};

export type WalletSummaryResponse = {
  balanceGhs: number;
  transactions: WalletTransaction[];
};



export type CreateOrderResponse = {
  reference: string;
  vendorId: string;
  status: VendorOrderStatus;
  vendorOrderReference?: string;
  estimatedDeliverySeconds?: number;
};

export type OrderStatusResponse = {
  reference: string;
  vendorId: string;
  status: VendorOrderStatus;
};

export type AdminOverviewResponse = {
  revenue: {
    dailyGhs: number;
    weeklyGhs: number;
    monthlyGhs: number;
  };
  vendorBalanceGhs: number | null;
  vendor: {
    id: string;
    displayName: string;
    balanceGhs: number | null;
    balanceStatus: "healthy" | "low" | "critical" | "unknown";
    checkedAt: string;
  };
  queue?: {
    purchaseDepth: number;
    deadLetterDepth: number;
  };
  metrics?: Record<string, number>;
  pendingAgentApplications: number;
};

export type AdminOrderSummary = {
  reference: string;
  vendorId: string;
  vendorOrderReference?: string;
  network: string;
  recipientPhone: string;
  paymentMethod: string;
  paymentStatus: string;
  status: string;
  createdAt?: string;
};

export type AdminOrdersResponse = {
  orders: AdminOrderSummary[];
};

export type SessionUser = {
  id: string;
  firebaseUid: string;
  email?: string;
  phone?: string;
  displayName?: string;
  role: string;
  adminScope?: "admin" | "superadmin" | null;
};

export type UserProfile = SessionUser & {
  walletBalanceGhs: number;
  firstPurchaseDiscountUsed: boolean;
  isSuspended: boolean;
};

export type BetterDataApiClient = {
  createSession: (token: string) => Promise<SessionUser>;
  getMe: (token: string) => Promise<UserProfile>;
  listDataPackages: () => Promise<ListDataPackagesResponse>;
  listOrders: (token: string) => Promise<ListOrdersResponse>;
  getWalletSummary: (token: string) => Promise<WalletSummaryResponse>;
  createOrder: (body: PurchaseRequest, token?: string) => Promise<CreateOrderResponse>;
  getOrderStatus: (reference: string) => Promise<OrderStatusResponse>;
  createPaymentIntent: (
    body: CreatePaymentIntentRequest,
    token?: string
  ) => Promise<CreatePaymentIntentResponse>;
  getPaymentIntentStatus: (
    reference: string
  ) => Promise<PaymentIntentStatusResponse>;
  getAdminOverview: () => Promise<AdminOverviewResponse>;
  listAdminOrders: () => Promise<AdminOrdersResponse>;
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
    const headers = new Headers(init?.headers);
    const defaultHeaders = new Headers(options.headers);

    defaultHeaders.forEach((value: string, key: string) => {
      if (!headers.has(key)) {
        headers.set(key, value);
      }
    });

    if (init?.body && !headers.get("content-type")) {
      headers.set("content-type", "application/json");
    }

    const response = await fetcher(`${baseUrl}${path}`, {
      ...init,
      headers
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
    createSession: (token) =>
      request<SessionUser>("/auth/session", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      }),
    getMe: (token) =>
      request<UserProfile>("/auth/me", {
        headers: { Authorization: `Bearer ${token}` }
      }),
    listDataPackages: () => request<ListDataPackagesResponse>("/data-packages"),
    listOrders: (token) =>
      request<ListOrdersResponse>("/orders", {
        headers: { Authorization: `Bearer ${token}` }
      }),
    getWalletSummary: (token) =>
      request<WalletSummaryResponse>("/wallet", {
        headers: { Authorization: `Bearer ${token}` }
      }),
    createOrder: (body, token) =>
      request<CreateOrderResponse>("/orders", {
        method: "POST",
        ...(token !== undefined ? { headers: { Authorization: `Bearer ${token}` } } : {}),
        body: JSON.stringify(body)
      }),
    getOrderStatus: (reference) =>
      request<OrderStatusResponse>(
        `/orders/${encodeURIComponent(reference)}/status`
      ),
    createPaymentIntent: (body, token) =>
      request<CreatePaymentIntentResponse>("/payments/intents", {
        method: "POST",
        ...(token !== undefined ? { headers: { Authorization: `Bearer ${token}` } } : {}),
        body: JSON.stringify(body)
      }),
    getPaymentIntentStatus: (reference) =>
      request<PaymentIntentStatusResponse>(
        `/payments/intents/${encodeURIComponent(reference)}`
      ),
    getAdminOverview: () => request<AdminOverviewResponse>("/admin/overview"),
    listAdminOrders: () => request<AdminOrdersResponse>("/admin/orders")
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
