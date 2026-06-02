"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createBetterDataApiClient } from "@betterdata/api-client";
import type {
  NetworkCode,
  OrderStatus,
  PaymentIntentStatus,
  PaymentIntentStatusResponse
} from "@betterdata/contracts";
import {
  findGuestPurchase,
  updateGuestPurchase,
  type GuestPurchaseRecord
} from "../guestPurchases";
import { formatReceiptDate } from "./receiptFormatting";

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
  airteltigo: "AirtelTigo"
};

const DATA_MB_PER_GB = 1000;
const SUPPORT_EMAIL = "support@betterdatagh.com";

type ReceiptState = {
  reference: string;
  packageId?: string;
  network?: NetworkCode;
  recipientPhone?: string;
  sizeMb?: number;
  amountGhs?: number;
  paymentStatus: PaymentIntentStatus;
  deliveryStatus: OrderStatus | "pending";
  failureReason?: string;
  createdAt?: number;
};

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const reference = searchParams.get("reference") ?? searchParams.get("ref") ?? "";
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [receipt, setReceipt] = useState<ReceiptState | null>(null);
  const [localRecord, setLocalRecord] = useState<GuestPurchaseRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [globalError, setGlobalError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!reference) {
      setGlobalError("No payment reference found. Please check your URL.");
      setIsLoading(false);
      return;
    }

    setLocalRecord(findGuestPurchase(reference));
  }, [reference]);

  useEffect(() => {
    if (!reference) return;
    let active = true;

    async function refresh() {
      try {
        const payment = await getApi().getPaymentIntentStatus(reference);
        const next = await buildReceiptState(payment, localRecord);

        if (!active) return;
        setReceipt(next);
        setIsLoading(false);
        updateGuestPurchase(reference, compactGuestPurchasePatch({
          packageId: next.packageId ?? localRecord?.packageId,
          network: next.network ?? localRecord?.network,
          recipientPhone: next.recipientPhone ?? localRecord?.recipientPhone,
          sizeMb: next.sizeMb ?? localRecord?.sizeMb,
          amountGhs: next.amountGhs ?? localRecord?.amountGhs,
          paymentStatus: next.paymentStatus,
          deliveryStatus: next.deliveryStatus
        }));

        if (isTerminal(next)) {
          stopPolling();
        }
      } catch (error) {
        if (!active) return;
        setGlobalError(readApiError(error, "Unable to fetch purchase status."));
        setIsLoading(false);
      }
    }

    void refresh();
    pollRef.current = setInterval(refresh, 3000);

    return () => {
      active = false;
      stopPolling();
    };
  }, [reference, localRecord]);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  const pageState = useMemo(() => resolvePageState(receipt), [receipt]);

  if (isLoading) {
    return (
      <div className="confirm-card">
        <div className="confirm-icon"><ProgressIcon /></div>
        <h1 className="confirm-title">Checking Purchase...</h1>
        <p className="confirm-subtitle">We are fetching the latest payment and delivery status.</p>
      </div>
    );
  }

  if (globalError || !receipt) {
    return (
      <div className="confirm-card">
        <div className="confirm-icon confirm-icon--failed"><WarningIcon /></div>
        <h1 className="confirm-title">Unable to Load Receipt</h1>
        <p className="confirm-subtitle">{globalError || "This purchase could not be found."}</p>
        <div className="confirm-actions no-print">
          <button className="btn btn--primary" onClick={() => router.push("/buy")}>
            Return to Store
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="confirm-card receipt-card">
      <div className="receipt-brand-header">
        <Link href="/" className="logo">
          <div className="logo-dot" />
          Better Data
        </Link>
        <div className="receipt-timestamp">
          {mounted && receipt ? formatReceiptDate(receipt.createdAt, localRecord?.createdAt, true) : ""}
        </div>
      </div>

      <div className="receipt-status-section">
        <div className={`confirm-icon confirm-icon--${pageState.kind}`}>
          {pageState.kind === "completed" ? <SuccessIcon /> : pageState.kind === "failed" ? <WarningIcon /> : <ProgressIcon />}
        </div>
        <h1 className="confirm-title">{pageState.title}</h1>
        <p className="confirm-subtitle">{pageState.subtitle}</p>
      </div>

      <div className="receipt-tear-divider">
        <span className="receipt-tear-notch receipt-tear-notch--left"></span>
        <span className="receipt-tear-line"></span>
        <span className="receipt-tear-notch receipt-tear-notch--right"></span>
      </div>

      <div className="receipt-summary">
        <div>
          <span className="label">Network</span>
          <strong>{receipt.network ? NETWORK_NAMES[receipt.network] : "Pending"}</strong>
        </div>
        <div>
          <span className="label">Package</span>
          <strong>{receipt.sizeMb ? formatPackageSize(receipt.sizeMb) : "Data bundle"}</strong>
        </div>
        <div>
          <span className="label">Recipient</span>
          <strong>{formatPhone(receipt.recipientPhone)}</strong>
        </div>
        <div>
          <span className="label">Amount</span>
          <strong>{formatGhs(receipt.amountGhs)}</strong>
        </div>
      </div>

      <div className="confirm-details receipt-details">
        <ReceiptRow label="Payment" value={formatStatus(receipt.paymentStatus)} />
        <ReceiptRow label="Delivery" value={formatStatus(receipt.deliveryStatus)} />
        <ReceiptRow label="Reference" value={receipt.reference} />
        {receipt.failureReason && <ReceiptRow label="Reason" value={receipt.failureReason} />}
      </div>

      <div className="receipt-footer">
        <div className="receipt-barcode" aria-hidden="true" />
        <p className="receipt-footer-text">Thank you for buying from Better Data!</p>
        <p className="receipt-support-text">For support: {SUPPORT_EMAIL}</p>
      </div>

      <div className="confirm-actions no-print">
        <button className="btn btn--primary" onClick={() => router.push("/buy")} style={{ width: "100%" }}>
          Purchase More Data
        </button>
        {pageState.kind === "failed" && receipt.paymentStatus === "succeeded" && (
          <a className="btn btn--outline" href={buildSupportHref(receipt)} style={{ width: "100%" }}>
            Contact Support
          </a>
        )}
        <button className="btn btn--outline" onClick={() => window.print()} style={{ width: "100%" }}>
          Print Receipt
        </button>
      </div>
    </div>
  );
}

async function buildReceiptState(
  payment: PaymentIntentStatusResponse,
  localRecord: GuestPurchaseRecord | null
): Promise<ReceiptState> {
  let deliveryStatus: ReceiptState["deliveryStatus"] = localRecord?.deliveryStatus ?? "pending";

  if (payment.status === "succeeded") {
    try {
      const order = await getApi().getOrderStatus(payment.reference);
      deliveryStatus = order.status;
    } catch {
      deliveryStatus = "pending";
    }
  }

  const recordTime = localRecord?.createdAt ? new Date(localRecord.createdAt).getTime() : undefined;
  const createdAt = payment.createdAt ?? (recordTime && !isNaN(recordTime) ? recordTime : undefined);

  return {
    reference: payment.reference,
    paymentStatus: payment.status,
    deliveryStatus,
    ...(createdAt ? { createdAt } : {}),
    ...defined("packageId", payment.dataPurchase?.packageId ?? localRecord?.packageId),
    ...defined("network", payment.dataPurchase?.network ?? localRecord?.network),
    ...defined("recipientPhone", payment.dataPurchase?.recipientPhone ?? localRecord?.recipientPhone),
    ...defined("sizeMb", payment.dataPurchase?.sizeMb ?? localRecord?.sizeMb),
    ...defined("amountGhs", payment.amountGhs ?? localRecord?.amountGhs),
    ...(payment.failureReason ? { failureReason: payment.failureReason } : {})
  };
}

function compactGuestPurchasePatch(patch: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined)
  ) as Partial<Omit<GuestPurchaseRecord, "reference" | "createdAt">>;
}

function defined<TKey extends string, TValue>(key: TKey, value: TValue | undefined) {
  return value === undefined ? {} : { [key]: value } as Record<TKey, TValue>;
}

function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="confirm-detail-row">
      <span className="label">{label}</span>
      <span className="value">{value}</span>
    </div>
  );
}

function resolvePageState(receipt: ReceiptState | null) {
  if (!receipt) {
    return {
      kind: "processing" as const,
      title: "Checking Purchase...",
      subtitle: "We are fetching the latest payment and delivery status."
    };
  }

  if (receipt.paymentStatus === "failed" || receipt.paymentStatus === "abandoned") {
    return {
      kind: "failed" as const,
      title: "Payment Not Completed",
      subtitle: receipt.failureReason || "Paystack did not complete this Mobile Money payment."
    };
  }

  if (receipt.deliveryStatus === "completed") {
    return {
      kind: "completed" as const,
      title: "Data Delivered",
      subtitle: "Your payment was confirmed and the data order has been completed."
    };
  }

  if (receipt.deliveryStatus === "failed" || receipt.deliveryStatus === "refunded") {
    return {
      kind: "failed" as const,
      title: "Delivery Needs Attention",
      subtitle: "Your payment was confirmed, but delivery did not complete. Please contact support with this reference before paying again."
    };
  }

  return {
    kind: "processing" as const,
    title: "Delivering Data...",
    subtitle: "Your payment is confirmed. We are currently fulfilling the data package."
  };
}

function isTerminal(receipt: ReceiptState) {
  return (
    receipt.paymentStatus === "failed" ||
    receipt.paymentStatus === "abandoned" ||
    receipt.deliveryStatus === "completed" ||
    receipt.deliveryStatus === "failed" ||
    receipt.deliveryStatus === "refunded"
  );
}

function formatPackageSize(sizeMb: number | undefined) {
  if (typeof sizeMb !== "number" || isNaN(sizeMb)) {
    return "Data bundle";
  }
  if (sizeMb >= DATA_MB_PER_GB) {
    return `${Number(sizeMb / DATA_MB_PER_GB).toLocaleString("en-GH", {
      maximumFractionDigits: 1
    })}GB`;
  }
  return `${sizeMb}MB`;
}

function formatPhone(phone: string | undefined) {
  if (typeof phone !== "string") return "Pending";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  return phone;
}

function formatGhs(amount: number | undefined) {
  return typeof amount === "number" ? `GHS ${amount.toFixed(2)}` : "Pending";
}

function formatStatus(status: string) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildSupportHref(receipt: ReceiptState) {
  const subject = `Delivery issue for ${receipt.reference}`;
  const body = [
    `Reference: ${receipt.reference}`,
    `Payment: ${formatStatus(receipt.paymentStatus)}`,
    `Delivery: ${formatStatus(receipt.deliveryStatus)}`,
    `Network: ${receipt.network ? NETWORK_NAMES[receipt.network] : "Pending"}`,
    `Package: ${receipt.sizeMb ? formatPackageSize(receipt.sizeMb) : "Data bundle"}`,
    `Recipient: ${receipt.recipientPhone ?? "Pending"}`,
    `Amount: ${formatGhs(receipt.amountGhs)}`
  ].join("\n");

  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function readApiError(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function SuccessIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function ProgressIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
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
}

function WarningIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

export default function ConfirmationPage() {
  return (
    <Suspense fallback={
      <div className="confirm-page">
        <div className="confirm-card">
          <div className="confirm-icon"><ProgressIcon /></div>
          <p className="confirm-subtitle">Loading receipt...</p>
        </div>
      </div>
    }>
      <div className="confirm-page">
        <ConfirmationContent />
      </div>
    </Suspense>
  );
}
