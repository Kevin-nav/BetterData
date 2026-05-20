"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/AuthContext";
import BuyContent from "./BuyContent";

export default function BuyPage() {
  const router = useRouter();
  const { loading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.replace("/dashboard/buy");
    }
  }, [loading, isAuthenticated, router]);

  // While loading or if authenticated (about to redirect), show loading
  if (loading || isAuthenticated) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-root)" }}>
        <div className="pkg-skeleton" style={{ width: "60px", height: "60px", borderRadius: "50%", animation: "pulse-dot 1.2s infinite" }} />
      </div>
    );
  }

  return <BuyContent standalone />;
}
