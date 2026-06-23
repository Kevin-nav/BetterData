import type {
  CreatePaymentIntentRequest,
  CreatePaymentIntentResponse,
  DataPackage,
  PaymentIntentStatusResponse,
  PurchaseRequest,
  SavedNumber,
  WalletTransactionType,
  VendorOrderStatus,
  Order,
  AgentPricingConfig,
  AgentApplicationStatus
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

export type ListSavedNumbersResponse = {
  numbers: SavedNumber[];
};

export type SaveSavedNumberRequest = {
  label: string;
  phone: string;
  network?: SavedNumber["network"];
};

export type Notification = {
  id: string;
  title: string;
  body: string;
  type: "order_status" | "wallet_update" | "announcement" | "agent_update" | "account_alert";
  referenceId?: string;
  readAt?: number;
  createdAt: number;
  source?: "notification" | "announcement";
};

export type ListNotificationsResponse = {
  notifications: Notification[];
};

export type PurchaseOutageStatusResponse = {
  isActive: boolean;
  updatedAt: number | null;
  message: string;
};

export type PurchaseOutageSubscribeResponse = {
  id: string;
  email: string;
  alreadySubscribed: boolean;
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
    balanceHistory?: Array<{
      balanceGhs: number;
      source: string;
      createdAt: number;
    }>;
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
  analyticsUserHash?: string;
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
  listDataPackages: (token?: string) => Promise<ListDataPackagesResponse>;
  listOrders: (token: string) => Promise<ListOrdersResponse>;
  listSavedNumbers: (token: string) => Promise<ListSavedNumbersResponse>;
  saveSavedNumber: (
    body: SaveSavedNumberRequest,
    token: string
  ) => Promise<SavedNumber>;
  deleteSavedNumber: (id: string, token: string) => Promise<{ deleted: boolean }>;
  getWalletSummary: (token: string) => Promise<WalletSummaryResponse>;
  listNotifications: (token: string) => Promise<ListNotificationsResponse>;
  markNotificationRead: (id: string, token: string) => Promise<{ success: boolean }>;
  markAllNotificationsRead: (token: string) => Promise<{ success: boolean }>;
  deleteNotification: (id: string, token: string) => Promise<{ success: boolean }>;
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
  getAgentPricingConfig: () => Promise<AgentPricingConfig>;
  updatePhone: (phone: string, token: string) => Promise<{ phone: string }>;
  getMyAgentApplication: (token: string) => Promise<AgentApplicationStatus | null>;
  getPurchaseOutageStatus: () => Promise<PurchaseOutageStatusResponse>;
  subscribeToPurchaseOutage: (email: string) => Promise<PurchaseOutageSubscribeResponse>;
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
    listDataPackages: (token) =>
      request<ListDataPackagesResponse>("/data-packages", {
        ...(token !== undefined ? { headers: { Authorization: `Bearer ${token}` } } : {})
      }),
    listOrders: (token) =>
      request<ListOrdersResponse>("/orders", {
        headers: { Authorization: `Bearer ${token}` }
      }),
    listSavedNumbers: (token) =>
      request<ListSavedNumbersResponse>("/saved-numbers", {
        headers: { Authorization: `Bearer ${token}` }
      }),
    saveSavedNumber: (body, token) =>
      request<SavedNumber>("/saved-numbers", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      }),
    deleteSavedNumber: (id, token) =>
      request<{ deleted: boolean }>(`/saved-numbers/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      }),
    getWalletSummary: (token) =>
      request<WalletSummaryResponse>("/wallet", {
        headers: { Authorization: `Bearer ${token}` }
      }),
    listNotifications: (token) =>
      request<ListNotificationsResponse>("/notifications", {
        headers: { Authorization: `Bearer ${token}` }
      }),
    markNotificationRead: (id, token) =>
      request<{ success: boolean }>(`/notifications/${encodeURIComponent(id)}/read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      }),
    markAllNotificationsRead: (token) =>
      request<{ success: boolean }>("/notifications/read-all", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }),
    deleteNotification: (id, token) =>
      request<{ success: boolean }>(`/notifications/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
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
    listAdminOrders: () => request<AdminOrdersResponse>("/admin/orders"),
    getAgentPricingConfig: () =>
      request<AgentPricingConfig>("/config/agent-pricing"),
    updatePhone: (phone, token) =>
      request<{ phone: string }>("/auth/me/phone", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ phone })
      }),
    getMyAgentApplication: (token) =>
      request<AgentApplicationStatus | null>("/auth/me/agent-application", {
        headers: { Authorization: `Bearer ${token}` }
      }),
    getPurchaseOutageStatus: () =>
      request<PurchaseOutageStatusResponse>("/purchase-outage"),
    subscribeToPurchaseOutage: (email) =>
      request<PurchaseOutageSubscribeResponse>("/purchase-outage/subscribers", {
        method: "POST",
        body: JSON.stringify({ email })
      })
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
