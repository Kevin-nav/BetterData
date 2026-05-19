"use client";

import {
  createBetterDataApiClient,
} from "@betterdata/api-client";
import type { DataPackage, NetworkCode } from "@betterdata/contracts";
import { useState, useEffect } from "react";
import Link from "next/link";

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

/* ── Network Detection ── */
const NETWORK_PREFIXES: Record<string, NetworkCode> = {
  "024": "mtn", "054": "mtn", "055": "mtn",
  "059": "mtn", "025": "mtn", "053": "mtn",
  "020": "telecel", "050": "telecel",
  "027": "airteltigo", "057": "airteltigo",
  "026": "airteltigo", "056": "airteltigo",
};

function detectNetwork(phone: string): NetworkCode | null {
  const cleaned = phone.replace(/\D/g, "");
  const prefix = cleaned.substring(0, 3);
  return NETWORK_PREFIXES[prefix] ?? null;
}

const NETWORK_NAMES: Record<NetworkCode, string> = {
  mtn: "MTN",
  telecel: "Telecel",
  airteltigo: "AirtelTigo",
};

/* ── Package Helpers ── */
const VALID_SIZES_GB = [1, 2, 3, 4, 5, 6, 8, 10, 15, 20, 25, 30, 40, 50];

function suggestSizes(input: number) {
  let lower: number | null = null;
  let higher: number | null = null;
  for (const size of VALID_SIZES_GB) {
    if (size < input) lower = size;
    if (size > input && higher === null) higher = size;
  }
  return { lower, higher };
}

function formatPackageSize(sizeMb: number) {
  if (sizeMb >= 1024) {
    return `${Number(sizeMb / 1024).toLocaleString("en-GH", {
      maximumFractionDigits: 1,
    })}GB`;
  }
  return `${sizeMb}MB`;
}

function formatSizeGb(sizeMb: number) {
  return sizeMb >= 1024 ? `${(sizeMb / 1024).toFixed(0)}GB` : `${sizeMb / 1024}GB`;
}

function readApiError(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message || fallback;
  return fallback;
}

/* ── Page Component ── */
type Mode = "single" | "bulk";
type PayMethod = "momo" | "wallet";

export default function BuyPage() {
  /* State */
  const [network, setNetwork] = useState<NetworkCode>("mtn");
  const [mode, setMode] = useState<Mode>("single");
  const [packages, setPackages] = useState<DataPackage[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(true);
  const [packageError, setPackageError] = useState("");
  const [loadKey, setLoadKey] = useState(0);
  const [selectedPkgId, setSelectedPkgId] = useState("");
  const [phone, setPhone] = useState("");
  const [recipientConfirmed, setRecipientConfirmed] = useState(false);
  const [payMethod, setPayMethod] = useState<PayMethod>("momo");
  const [submitting, setSubmitting] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [promoDismissed, setPromoDismissed] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [navScrolled, setNavScrolled] = useState(false);

  /* Derived */
  const networkPkgs = packages.filter((p) => p.network === network && p.isAvailable);
  const selectedPkg = networkPkgs.find((p) => p.id === selectedPkgId) ?? null;
  const detectedNet = phone.replace(/\D/g, "").length >= 3 ? detectNetwork(phone) : null;

  /* Theme init */
  useEffect(() => {
    const saved = document.documentElement.getAttribute("data-theme");
    if (saved === "dark" || saved === "light") setTheme(saved);
    else if (window.matchMedia("(prefers-color-scheme: dark)").matches) setTheme("dark");
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  };

  /* Navbar scroll */
  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* Promo dismissed */
  useEffect(() => {
    if (localStorage.getItem("promo-dismissed") === "1") setPromoDismissed(true);
  }, []);

  /* Fetch packages */
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        setPackagesLoading(true);
        setPackageError("");
        const data = await getApi().listDataPackages();
        if (!controller.signal.aborted) setPackages(data.packages);
      } catch (err) {
        if (!controller.signal.aborted) setPackageError(readApiError(err, "Unable to load packages."));
      } finally {
        if (!controller.signal.aborted) setPackagesLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [loadKey]);

  /* Auto-select first package when network changes */
  useEffect(() => {
    const first = packages.find((p) => p.network === network && p.isAvailable);
    setSelectedPkgId(first?.id ?? "");
  }, [network, packages]);

  /* URL param: ?network= */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const net = params.get("network");
    if (net === "mtn" || net === "telecel" || net === "airteltigo") setNetwork(net);
  }, []);

  const retryLoad = () => { setPackageError(""); setLoadKey((k) => k + 1); };
  const dismissPromo = () => { setPromoDismissed(true); localStorage.setItem("promo-dismissed", "1"); };

  /* ── Icon Components ── */
  const SunIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
  const MoonIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
  const CheckSmall = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
  );
  const LockSmall = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
  );

  return (
    <main className="buy-page">
      {/* ── Navbar ── */}
      <nav className={`navbar${navScrolled ? " scrolled" : ""}`}>
        <div className="nav-inner">
          <Link href="/" className="logo">
            <div className="logo-dot" />
            Better Data
          </Link>
          <div className="nav-actions">
            <Link href="/login" className="nav-link">Log In</Link>
            <Link href="/signup" className="btn btn-primary">Sign Up</Link>
            <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === "light" ? <MoonIcon /> : <SunIcon />}
            </button>
          </div>
        </div>
      </nav>

      <div className="container">
        {/* ── Promo Banner ── */}
        {!promoDismissed && (
          <div className="promo-banner" style={{ marginTop: 32 }}>
            <p>Create a free account and get a <strong>discount</strong> on your first purchase! Agents get discounted rates on every bundle.</p>
            <Link href="/signup">Sign Up</Link>
            <button className="promo-close" onClick={dismissPromo} aria-label="Dismiss">&times;</button>
          </div>
        )}

        {/* ── Header ── */}
        <div className="buy-header">
          <div className="buy-breadcrumb">
            <Link href="/">Home</Link>
            <span className="sep">/</span>
            <span>Buy Data</span>
          </div>
          <h1 className="buy-title">Buy Data Bundles</h1>
          <p className="buy-subtitle">Choose your network and package below</p>
        </div>

        {/* ── Network Tabs ── */}
        {mode === "single" && (
          <div className="network-tabs">
            {(["mtn", "telecel", "airteltigo"] as const).map((net) => (
              <button
                key={net}
                className="network-tab"
                data-network={net}
                data-active={network === net}
                onClick={() => setNetwork(net)}
              >
                <span className="tab-dot" />
                {NETWORK_NAMES[net]}
              </button>
            ))}
          </div>
        )}

        {/* ── Mode Toggle ── */}
        <div className="mode-toggle">
          <button className="mode-toggle-btn" data-active={mode === "single"} onClick={() => setMode("single")}>
            Single
          </button>
          <button className="mode-toggle-btn" data-active={mode === "bulk"} onClick={() => setMode("bulk")}>
            Bulk
          </button>
        </div>

        {/* ── Main Layout ── */}
        <div className="buy-layout">
          <section className="buy-catalog">
            {mode === "single" ? (
              /* ── Package Grid ── */
              <div className="catalog-grid">
                {packagesLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="pkg-skeleton" />
                  ))
                ) : packageError ? (
                  <div className="catalog-empty">
                    <p>{packageError}</p>
                    <button onClick={retryLoad}>Retry</button>
                  </div>
                ) : networkPkgs.length === 0 ? (
                  <div className="catalog-empty">No packages available for this network.</div>
                ) : (
                  networkPkgs.map((pkg) => {
                    const sizeGb = pkg.sizeMb / 1024;
                    const perGb = pkg.customerPriceGhs / sizeGb;
                    const isPopular = pkg.sizeMb === 5120 || pkg.sizeMb === 10240;
                    const isBestValue = pkg.sizeMb === 10240 || pkg.sizeMb === 15360;
                    return (
                      <div
                        key={pkg.id}
                        className="pkg-card"
                        data-selected={selectedPkgId === pkg.id}
                        onClick={() => {
                          setSelectedPkgId(pkg.id);
                          setSheetOpen(true);
                        }}
                      >
                        {isPopular && !isBestValue && <span className="pkg-badge pkg-badge--popular">Popular</span>}
                        {isBestValue && <span className="pkg-badge pkg-badge--value">Best Value</span>}
                        <div className="pkg-card-check"><CheckSmall /></div>
                        <div className="pkg-card-size">{formatPackageSize(pkg.sizeMb)}</div>
                        <div className="pkg-card-price">GHS {pkg.customerPriceGhs.toFixed(2)}</div>
                        <div className="pkg-card-value">GHS {perGb.toFixed(2)}/GB</div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              /* ── Bulk Mode Placeholder (Smart Pill coming next) ── */
              <div style={{ padding: 40, textAlign: "center", color: "var(--text-secondary)" }}>
                Smart Pill input — coming next
              </div>
            )}
          </section>
          <aside className="checkout-panel">
            <div className="checkout-title">
              <span className="icon"><LockSmall /></span>
              Checkout
            </div>

            {/* Package Summary */}
            <div className="checkout-section">
              <div className="checkout-section-label">Selected Package</div>
              {selectedPkg ? (
                <div className="checkout-pkg-summary">
                  <span className={`network-badge network-badge--${network}`}>
                    <span className="badge-dot" />
                    {NETWORK_NAMES[network]}
                  </span>
                  <span className="pkg-size">{formatPackageSize(selectedPkg.sizeMb)}</span>
                  <span className="pkg-price">GHS {selectedPkg.customerPriceGhs.toFixed(2)}</span>
                </div>
              ) : (
                <div className="checkout-pkg-empty">Select a package to continue</div>
              )}
            </div>

            {/* Phone Input */}
            <div className="checkout-section">
              <div className="checkout-section-label">Recipient Phone</div>
              <input
                type="tel"
                className="text-input"
                placeholder="e.g. 054 123 4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              {detectedNet && (
                <div style={{ marginTop: 6 }}>
                  <span className={`network-badge network-badge--${detectedNet}`}>
                    <span className="badge-dot" />
                    {NETWORK_NAMES[detectedNet]}
                  </span>
                </div>
              )}
              {detectedNet && detectedNet !== network && (
                <div className="network-mismatch">
                  <span>This looks like a {NETWORK_NAMES[detectedNet]} number</span>
                  <button onClick={() => setNetwork(detectedNet)}>Switch</button>
                </div>
              )}
            </div>

            {/* Payment Method */}
            <div className="checkout-section">
              <div className="checkout-section-label">Payment Method</div>
              <div className="pay-method-row">
                <div className="pay-method-opt" data-active={payMethod === "momo"} onClick={() => setPayMethod("momo")}>
                  Mobile Money
                  <small>via Paystack</small>
                </div>
                <div className="pay-method-opt" data-active={payMethod === "wallet"} onClick={() => setPayMethod("wallet")}>
                  Wallet
                  <small>Balance: --</small>
                </div>
              </div>
            </div>

            {/* Confirm */}
            <label className="buy-confirm-row">
              <input type="checkbox" checked={recipientConfirmed} onChange={(e) => setRecipientConfirmed(e.target.checked)} />
              <span>I have checked the recipient number and accept responsibility for wrong-number purchases.</span>
            </label>

            {/* Pay Button */}
            <button
              className="btn btn-primary btn-lg btn-full"
              style={{ marginTop: 18 }}
              disabled={submitting || !selectedPkg || !recipientConfirmed || !phone.trim()}
            >
              {submitting
                ? "Processing..."
                : selectedPkg
                  ? `Pay GHS ${selectedPkg.customerPriceGhs.toFixed(2)} with ${payMethod === "momo" ? "MoMo" : "Wallet"}`
                  : "Select a package"}
            </button>

            {orderError && <div className="order-message order-error">{orderError}</div>}

            <div className="buy-widget-footer">
              <LockSmall />
              <span>Secured by Paystack Mobile Money</span>
            </div>
          </aside>
        </div>
      </div>

      {/* ── Mobile Bottom Sheet ── */}
      <div className="bottom-sheet-overlay" data-open={sheetOpen && selectedPkg !== null} onClick={() => setSheetOpen(false)} />
      <div className="bottom-sheet" data-open={sheetOpen && selectedPkg !== null}>
        <div className="sheet-handle" />
        {selectedPkg && (
          <>
            <div className="checkout-title">
              <span className="icon"><LockSmall /></span>
              Checkout
            </div>
            <div className="checkout-section">
              <div className="checkout-pkg-summary">
                <span className={`network-badge network-badge--${network}`}>
                  <span className="badge-dot" />
                  {NETWORK_NAMES[network]}
                </span>
                <span className="pkg-size">{formatPackageSize(selectedPkg.sizeMb)}</span>
                <span className="pkg-price">GHS {selectedPkg.customerPriceGhs.toFixed(2)}</span>
              </div>
            </div>
            <div className="checkout-section">
              <div className="checkout-section-label">Recipient Phone</div>
              <input type="tel" className="text-input" placeholder="e.g. 054 123 4567" value={phone} onChange={(e) => setPhone(e.target.value)} />
              {detectedNet && (
                <div style={{ marginTop: 6 }}>
                  <span className={`network-badge network-badge--${detectedNet}`}><span className="badge-dot" />{NETWORK_NAMES[detectedNet]}</span>
                </div>
              )}
              {detectedNet && detectedNet !== network && (
                <div className="network-mismatch">
                  <span>This looks like a {NETWORK_NAMES[detectedNet]} number</span>
                  <button onClick={() => setNetwork(detectedNet)}>Switch</button>
                </div>
              )}
            </div>
            <div className="checkout-section">
              <div className="checkout-section-label">Payment Method</div>
              <div className="pay-method-row">
                <div className="pay-method-opt" data-active={payMethod === "momo"} onClick={() => setPayMethod("momo")}>Mobile Money<small>via Paystack</small></div>
                <div className="pay-method-opt" data-active={payMethod === "wallet"} onClick={() => setPayMethod("wallet")}>Wallet<small>Balance: --</small></div>
              </div>
            </div>
            <label className="buy-confirm-row">
              <input type="checkbox" checked={recipientConfirmed} onChange={(e) => setRecipientConfirmed(e.target.checked)} />
              <span>I have checked the recipient number and accept responsibility for wrong-number purchases.</span>
            </label>
            <button className="btn btn-primary btn-lg btn-full" style={{ marginTop: 18 }} disabled={submitting || !recipientConfirmed || !phone.trim()}>
              {submitting ? "Processing..." : `Pay GHS ${selectedPkg.customerPriceGhs.toFixed(2)} with ${payMethod === "momo" ? "MoMo" : "Wallet"}`}
            </button>
            {orderError && <div className="order-message order-error">{orderError}</div>}
            <div className="buy-widget-footer"><LockSmall /><span>Secured by Paystack Mobile Money</span></div>
          </>
        )}
      </div>

      {/* ── Footer ── */}
      <footer className="footer">
        <div className="container">
          <div className="footer-bottom" style={{ marginTop: 0, paddingTop: 0, borderTop: "none" }}>
            &copy; {new Date().getFullYear()} Better Data. All rights reserved.
          </div>
        </div>
      </footer>
    </main>
  );
}
