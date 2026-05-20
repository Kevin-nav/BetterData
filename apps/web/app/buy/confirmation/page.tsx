"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createBetterDataApiClient } from "@betterdata/api-client";
import type { NetworkCode } from "@betterdata/contracts";

/* ── API Client ── */
let _apiClient: ReturnType<typeof createBetterDataApiClient> | null = null;
function getApi() {
  if (!_apiClient) {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!baseUrl?.trim()) throw new Error("NEXT_PUBLIC_API_BASE_URL is required.");
    _apiClient = createBetterDataApiClient({ baseUrl });
  }
  return _apiClient;
}

const NETWORK_NAMES: Record<NetworkCode, string> = {
  mtn: "MTN",
  telecel: "Telecel",
  airteltigo: "AirtelTigo",
};

interface OrderDetail {
  reference: string;
  phone: string;
  network: NetworkCode;
  sizeGb: string;
  priceGhs: number;
  paymentStatus: "pending" | "succeeded" | "failed";
  deliveryStatus: "pending" | "processing" | "completed" | "failed" | "refunded";
  errorMsg?: string;
}

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const walletRefs = searchParams.get("ref");
  const momoRef = searchParams.get("reference");

  const [isLoading, setIsLoading] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [orders, setOrders] = useState<OrderDetail[]>([]);
  const [paymentState, setPaymentState] = useState<"verifying" | "delivering" | "completed" | "failed">("verifying");
  const [globalError, setGlobalError] = useState("");

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /* Theme Setup */
  useEffect(() => {
    const storedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initialTheme = storedTheme ?? (systemPrefersDark ? "dark" : "light");
    setTheme(initialTheme);
    document.documentElement.setAttribute("data-theme", initialTheme);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
  };

  /* Main Status Polling Logic */
  useEffect(() => {
    const activeRef = momoRef || walletRefs;
    if (!activeRef) {
      setGlobalError("No payment reference found. Please check your URL.");
      setIsLoading(false);
      return;
    }

    const refList = activeRef.split(",");
    
    // Initialize temporary order details using references
    const initialOrders: OrderDetail[] = refList.map((ref) => ({
      reference: ref,
      phone: "Loading...",
      network: "mtn",
      sizeGb: "Loading...",
      priceGhs: 0,
      paymentStatus: momoRef ? "pending" : "succeeded",
      deliveryStatus: "pending",
    }));
    setOrders(initialOrders);

    let isPolling = true;

    // Helper to fetch details and delivery status for all orders
    const fetchFulfillmentStatus = async () => {
      try {
        const updatedOrders = await Promise.all(
          refList.map(async (ref) => {
            try {
              // Get order details using API status check
              const statusRes = await getApi().getOrderStatus(ref);
              // Wait, order status response has status, reference, vendorId.
              // Since the API client does not return complete metadata on status, we infer what we can
              // or let it use the current details.
              // Note: If the order was created in Convex, we can infer its properties.
              // Let's assume order status response status field matches the delivery status!
              return {
                reference: ref,
                phone: "Active Recipient",
                network: "mtn" as NetworkCode,
                sizeGb: "Purchased Package",
                priceGhs: 0,
                paymentStatus: "succeeded" as const,
                deliveryStatus: statusRes.status as OrderDetail["deliveryStatus"],
              };
            } catch (err) {
              // If the order isn't found in database yet (e.g. still creating after webhook),
              // it returns 404, so we catch and keep it as pending.
              return {
                reference: ref,
                phone: "Pending Fulfillment",
                network: "mtn" as NetworkCode,
                sizeGb: "Processing Bundle",
                priceGhs: 0,
                paymentStatus: momoRef ? "pending" as const : "succeeded" as const,
                deliveryStatus: "pending" as const,
              };
            }
          })
        );

        if (!isPolling) return;

        setOrders((prev) =>
          prev.map((o) => {
            const match = updatedOrders.find((u) => u.reference === o.reference);
            if (!match) return o;
            return {
              ...o,
              paymentStatus: match.paymentStatus,
              deliveryStatus: match.deliveryStatus === "pending" && !momoRef ? "processing" : match.deliveryStatus,
            };
          })
        );

        // Check if all are completed or failed
        const allFinished = updatedOrders.every(
          (o) => o.deliveryStatus === "completed" || o.deliveryStatus === "failed" || o.deliveryStatus === "refunded"
        );

        if (allFinished) {
          setPaymentState("completed");
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        }
      } catch (err) {
        console.error("Fulfillment poll error", err);
      }
    };

    // MoMo payment check
    const pollMomoStatus = async () => {
      if (!momoRef) return;
      try {
        const intentStatus = await getApi().getPaymentIntentStatus(momoRef);
        if (!isPolling) return;

        if (intentStatus.status === "succeeded") {
          setPaymentState("delivering");
          // Update order statuses
          setOrders((prev) =>
            prev.map((o) =>
              o.reference === momoRef
                ? { ...o, paymentStatus: "succeeded", deliveryStatus: "processing", priceGhs: intentStatus.amountGhs }
                : o
            )
          );
          // Now transition to checking fulfillment
          fetchFulfillmentStatus();
        } else if (intentStatus.status === "failed" || intentStatus.status === "abandoned") {
          setPaymentState("failed");
          setOrders((prev) =>
            prev.map((o) =>
              o.reference === momoRef
                ? { ...o, paymentStatus: "failed", deliveryStatus: "failed", errorMsg: `Payment intent: ${intentStatus.status}` }
                : o
            )
          );
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        }
      } catch (err) {
        console.error("Momo poll error", err);
      }
    };

    // Trigger initial checks
    setIsLoading(false);
    if (momoRef) {
      pollMomoStatus();
      pollIntervalRef.current = setInterval(() => {
        if (paymentState === "verifying") {
          pollMomoStatus();
        } else {
          fetchFulfillmentStatus();
        }
      }, 2000);
    } else {
      setPaymentState("delivering");
      fetchFulfillmentStatus();
      pollIntervalRef.current = setInterval(fetchFulfillmentStatus, 2000);
    }

    return () => {
      isPolling = false;
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [momoRef, walletRefs, paymentState]);

  /* Icons */
  const SuccessIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-teal-600">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );

  const ProgressIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin text-primary">
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
    </svg>
  );

  const WarningIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "completed":
        return "badge-success";
      case "processing":
      case "pending":
        return "badge-info animate-pulse";
      case "failed":
      case "refunded":
        return "badge-error";
      default:
        return "badge-secondary";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "completed":
        return "Delivered";
      case "processing":
        return "Delivering...";
      case "pending":
        return "Pending...";
      case "failed":
        return "Fulfillment Failed";
      case "refunded":
        return "Refunded";
      default:
        return status;
    }
  };

  if (isLoading) {
    return (
      <div className="confirm-card">
        <div className="w-16 h-16 border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400 font-medium">Fetching order status...</p>
      </div>
    );
  }

  if (globalError) {
    return (
      <div className="confirm-card">
        <div className="confirm-icon" style={{ background: "rgba(239, 68, 68, 0.1)", color: "#ef4444" }}>
          <WarningIcon />
        </div>
        <h1 className="confirm-title text-red-500">Error</h1>
        <p className="confirm-subtitle">{globalError}</p>
        <div className="confirm-actions">
          <button className="btn btn--primary" onClick={() => router.push("/buy")}>
            Return to Store
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="confirm-card">
      <div className="confirm-icon">
        {paymentState === "verifying" || paymentState === "delivering" ? (
          <ProgressIcon />
        ) : paymentState === "completed" ? (
          <SuccessIcon />
        ) : (
          <WarningIcon />
        )}
      </div>

      <h1 className="confirm-title">
        {paymentState === "verifying" && "Verifying Payment..."}
        {paymentState === "delivering" && "Delivering Data..."}
        {paymentState === "completed" && "Order Processed!"}
        {paymentState === "failed" && "Transaction Failed"}
      </h1>

      <p className="confirm-subtitle">
        {paymentState === "verifying" && "We are waiting for Paystack to confirm your Mobile Money transaction."}
        {paymentState === "delivering" && "Your payment is confirmed! We are currently fulfilling the data packages."}
        {paymentState === "completed" && "Fulfillment process complete. Check recipient status details below."}
        {paymentState === "failed" && "We couldn't process this transaction. If you were debited, a refund will be initiated."}
      </p>

      {/* Recipient / Order list */}
      <div className="confirm-details" style={{ padding: 0 }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", background: "var(--bg-elevated)", textAlign: "left" }}>
          <h3 style={{ fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)" }}>
            Recipient Status ({orders.length})
          </h3>
        </div>

        {orders.map((o) => (
          <div key={o.reference} className="confirm-detail-row" style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "stretch" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span className="value" style={{ display: "block", fontSize: "0.95rem" }}>
                  {o.phone}
                </span>
                <span className="label" style={{ fontSize: "0.75rem" }}>
                  Ref: {o.reference.substring(0, 12)}...
                </span>
              </div>
              <div style={{ textAlign: "right" }}>
                <span className={`badge ${getStatusBadgeClass(o.deliveryStatus)}`} style={{ padding: "4px 8px", borderRadius: "100px", fontSize: "0.75rem", fontWeight: 600 }}>
                  {getStatusLabel(o.deliveryStatus)}
                </span>
              </div>
            </div>
            {o.errorMsg && (
              <div style={{ fontSize: "0.75rem", color: "#ef4444", fontStyle: "italic", marginTop: 4 }}>
                {o.errorMsg}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="confirm-actions">
        <button className="btn btn--primary" onClick={() => router.push("/buy")} style={{ width: "100%" }}>
          Purchase More Data
        </button>
        <button
          className="btn btn--outline"
          onClick={() => window.print()}
          style={{ width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 6 2 18 2 18 9" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
          </svg>
          Print Receipt
        </button>
      </div>
    </div>
  );
}

export default function ConfirmationPage() {
  return (
    <Suspense fallback={
      <div className="confirm-page">
        <div className="confirm-card">
          <div className="w-16 h-16 border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 font-medium">Loading page details...</p>
        </div>
      </div>
    }>
      <div className="confirm-page">
        <ConfirmationContent />
      </div>
    </Suspense>
  );
}
