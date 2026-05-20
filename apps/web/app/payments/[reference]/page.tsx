"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useParams } from "next/navigation";

function PaymentsRedirectContent() {
  const router = useRouter();
  const params = useParams();
  const reference = params?.reference;

  useEffect(() => {
    if (reference) {
      router.replace(`/buy/confirmation?reference=${encodeURIComponent(reference as string)}`);
    } else {
      router.replace("/buy");
    }
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
