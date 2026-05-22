"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useParams } from "next/navigation";
import { createBetterDataApiClient } from "@betterdata/api-client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const apiClient = createBetterDataApiClient({ baseUrl: API_BASE_URL });

function PaymentsRedirectContent() {
  const router = useRouter();
  const params = useParams();
  const reference = params?.reference;

  useEffect(() => {
    let active = true;

    async function routeByPaymentPurpose(paymentReference: string) {
      try {
        const status = await apiClient.getPaymentIntentStatus(paymentReference);
        if (!active) return;

        if (status.purpose === "wallet_top_up") {
          router.replace(`/dashboard/wallet?topup=${encodeURIComponent(paymentReference)}`);
          return;
        }

        if (status.purpose === "agent_application_fee") {
          router.replace(`/dashboard/agent?ref=${encodeURIComponent(paymentReference)}`);
          return;
        }

        router.replace(`/buy/confirmation?reference=${encodeURIComponent(paymentReference)}`);
      } catch {
        if (active) {
          router.replace(`/buy/confirmation?reference=${encodeURIComponent(paymentReference)}`);
        }
      }
    }

    if (typeof reference === "string" && reference) {
      void routeByPaymentPurpose(reference);
    } else {
      router.replace("/buy");
    }

    return () => {
      active = false;
    };
  }, [reference, router]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "var(--bg-root)", color: "var(--text)" }}>
      <div className="w-16 h-16 border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin mb-4" />
      <p style={{ fontWeight: 500, opacity: 0.8 }}>Verifying payment transaction...</p>
    </div>
  );
}

export default function PaymentsRedirectPage() {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "var(--bg-root)", color: "var(--text)" }}>
        <div className="w-16 h-16 border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin mb-4" />
        <p style={{ fontWeight: 500, opacity: 0.8 }}>Loading redirect...</p>
      </div>
    }>
      <PaymentsRedirectContent />
    </Suspense>
  );
}
