"use client";

import {
  createBetterDataApiClient,
} from "@betterdata/api-client";
import type { DataPackage, NetworkCode } from "@betterdata/contracts";
import { useState, useEffect, useRef } from "react";
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
const DATA_MB_PER_GB = 1000;

function formatPackageSize(sizeMb: number) {
  if (sizeMb >= DATA_MB_PER_GB) {
    return `${Number(sizeMb / DATA_MB_PER_GB).toLocaleString("en-GH", {
      maximumFractionDigits: 1,
    })}GB`;
  }
  return `${sizeMb}MB`;
}

function formatSizeGb(sizeMb: number) {
  return sizeMb >= DATA_MB_PER_GB
    ? `${(sizeMb / DATA_MB_PER_GB).toFixed(0)}GB`
    : `${sizeMb / DATA_MB_PER_GB}GB`;
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

  /* Bulk Mode State */
  interface BulkPill {
    id: string;
    phone: string;
    network: NetworkCode;
    sizeMb: number;
    priceGhs: number;
    packageId: string;
    isValid: boolean;
    error?: string | undefined;
  }
  const [bulkPills, setBulkPills] = useState<BulkPill[]>([]);
  const [pendingPillId, setPendingPillId] = useState<string | null>(null);
  const [bulkInputVal, setBulkInputVal] = useState("");
  const [bulkInputPhase, setBulkInputPhase] = useState<"phone" | "gb">("phone");
  const [tempPhone, setTempPhone] = useState("");
  const [tempNetwork, setTempNetwork] = useState<NetworkCode | null>(null);
  const [suggestedSizesState, setSuggestedSizesState] = useState<{ lower: number | null; higher: number | null }>({ lower: null, higher: null });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const bulkInputRef = useRef<HTMLInputElement>(null);

  /* Derived */
  const networkPkgs = packages
    .filter((p) => p.network === network && p.isAvailable)
    .sort((a, b) => a.sizeMb - b.sizeMb);
  const selectedPkg = networkPkgs.find((p) => p.id === selectedPkgId) ?? null;
  const detectedNet = phone.replace(/\D/g, "").length >= 3 ? detectNetwork(phone) : null;
  const mtnCount = bulkPills.filter((p) => p.network === "mtn").length;
  const telecelCount = bulkPills.filter((p) => p.network === "telecel").length;
  const atCount = bulkPills.filter((p) => p.network === "airteltigo").length;
  const invalidCount = bulkPills.filter((p) => !p.isValid).length;
  const totalCostGhs = bulkPills.reduce((total, p) => total + (p.isValid ? p.priceGhs : 0), 0);

  // Bulk helper to find package ID by network & size in GB.
  const findPackageByGb = (net: NetworkCode, gb: number): DataPackage | null => {
    return packages.find(p => {
      if (p.network !== net || !p.isAvailable) return false;
      return Math.abs(p.sizeMb / DATA_MB_PER_GB - gb) < 0.05;
    }) ?? null;
  };

  // Helper to suggest sizes dynamically from actual database packages
  const suggestSizesForNetwork = (net: NetworkCode, input: number) => {
    const netPkgs = packages.filter(p => p.network === net && p.isAvailable);
    const sizes = Array.from(
      new Set(
        netPkgs.map(p => {
          return Math.round((p.sizeMb / DATA_MB_PER_GB) * 2) / 2;
        })
      )
    ).sort((a, b) => a - b);

    let lower: number | null = null;
    let higher: number | null = null;
    for (const size of sizes) {
      if (size < input) lower = size;
      if (size > input && higher === null) higher = size;
    }
    return { lower, higher };
  };

  const getActiveNetwork = (): NetworkCode | null => {
    if (pendingPillId) {
      const p = bulkPills.find(pill => pill.id === pendingPillId);
      if (p) return p.network;
    }
    return tempNetwork;
  };

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

  const handleSinglePay = async () => {
    if (!selectedPkg || !phone.trim() || !recipientConfirmed) return;
    setSubmitting(true);
    setOrderError("");

    try {
      if (payMethod === "wallet") {
        const res = await getApi().createOrder({
          packageId: selectedPkg.id,
          network,
          recipientPhone: phone.trim(),
          confirmRecipientIsCorrect: true,
          paymentMethod: "wallet",
        });
        window.location.href = `/buy/confirmation?ref=${res.reference}`;
      } else {
        const res = await getApi().createPaymentIntent({
          purpose: "data_purchase",
          packageId: selectedPkg.id,
          network,
          recipientPhone: phone.trim(),
          confirmRecipientIsCorrect: true,
        });
        window.location.href = res.authorizationUrl;
      }
    } catch (err) {
      setOrderError(readApiError(err, "Payment submission failed"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGbSubmit = (gb: number) => {
    const targetNetwork = getActiveNetwork();
    if (!targetNetwork) return;

    if (packagesLoading || packageError || packages.length === 0) {
      const error = packagesLoading
        ? "Data packages are still loading. Try again in a moment."
        : packageError || "Data packages are not loaded. Retry package loading first.";

      if (pendingPillId) {
        setBulkPills((prev) =>
          prev.map((p) => (p.id === pendingPillId ? { ...p, error } : p))
        );
      }
      setShowSuggestions(false);
      return;
    }

    const pkg = findPackageByGb(targetNetwork, gb);
    if (pkg) {
      if (pendingPillId) {
        setBulkPills((prev) =>
          prev.map((p) =>
            p.id === pendingPillId
              ? {
                  ...p,
                  sizeMb: pkg.sizeMb,
                  priceGhs: pkg.customerPriceGhs,
                  packageId: pkg.id,
                  isValid: true,
                  error: undefined,
                }
              : p
          )
        );
        setPendingPillId(null);
      } else {
        const newPill: BulkPill = {
          id: Math.random().toString(36).substring(2, 9),
          phone: tempPhone,
          network: targetNetwork,
          sizeMb: pkg.sizeMb,
          priceGhs: pkg.customerPriceGhs,
          packageId: pkg.id,
          isValid: true,
        };
        setBulkPills((prev) => [...prev, newPill]);
      }
      setBulkInputVal("");
      setBulkInputPhase("phone");
      setTempPhone("");
      setTempNetwork(null);
      setShowSuggestions(false);
      setSheetOpen(true);
    } else {
      const { lower, higher } = suggestSizesForNetwork(targetNetwork, gb);
      setSuggestedSizesState({ lower, higher });
      setShowSuggestions(true);

      if (pendingPillId) {
        setBulkPills((prev) =>
          prev.map((p) =>
            p.id === pendingPillId
              ? {
                  ...p,
                  error: `Invalid size (${gb}GB). Try ${lower ? lower + "GB" : ""}${lower && higher ? "/" : ""}${higher ? higher + "GB" : ""}`,
                }
              : p
          )
        );
      }
    }
  };

  const handleBulkInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setBulkInputVal(val);

    if (bulkInputPhase === "phone") {
      const cleaned = val.replace(/\D/g, "");
      const detected = detectNetwork(cleaned);
      setTempNetwork(detected);

      if (cleaned.length === 10) {
        if (detected) {
          const pId = Math.random().toString(36).substring(2, 9);
          const newPill: BulkPill = {
            id: pId,
            phone: cleaned,
            network: detected,
            sizeMb: 0,
            priceGhs: 0,
            packageId: "",
            isValid: false,
            error: "Enter GB size...",
          };
          setBulkPills((prev) => [...prev, newPill]);
          setPendingPillId(pId);
          setTempPhone(cleaned);
          setBulkInputPhase("gb");
          setBulkInputVal("");
          setShowSuggestions(false);
        }
      }
    }
  };

  const handleBulkInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === " " || e.key === ",") {
      e.preventDefault();
      if (bulkInputPhase === "phone") {
        const cleaned = bulkInputVal.replace(/\D/g, "");
        const detected = detectNetwork(cleaned);
        if (cleaned.length === 10 && detected) {
          const pId = Math.random().toString(36).substring(2, 9);
          const newPill: BulkPill = {
            id: pId,
            phone: cleaned,
            network: detected,
            sizeMb: 0,
            priceGhs: 0,
            packageId: "",
            isValid: false,
            error: "Enter GB size...",
          };
          setBulkPills((prev) => [...prev, newPill]);
          setPendingPillId(pId);
          setTempPhone(cleaned);
          setBulkInputPhase("gb");
          setBulkInputVal("");
          setShowSuggestions(false);
        } else if (bulkInputVal.trim() !== "") {
          const newPill: BulkPill = {
            id: Math.random().toString(36).substring(2, 9),
            phone: bulkInputVal,
            network: detected || "mtn",
            sizeMb: 0,
            priceGhs: 0,
            packageId: "",
            isValid: false,
            error: !detected ? "Unknown network prefix" : "Must be 10 digits",
          };
          setBulkPills((prev) => [...prev, newPill]);
          setBulkInputVal("");
          setSheetOpen(true);
        }
      } else {
        const valNum = parseFloat(bulkInputVal);
        if (!isNaN(valNum)) {
          handleGbSubmit(valNum);
        }
      }
    } else if (e.key === "Backspace" && bulkInputVal === "") {
      if (bulkInputPhase === "gb") {
        setBulkInputPhase("phone");
        if (pendingPillId) {
          setBulkPills((prev) => prev.filter((p) => p.id !== pendingPillId));
          setPendingPillId(null);
        }
        setBulkInputVal(tempPhone);
        setTempPhone("");
        setTempNetwork(null);
        setShowSuggestions(false);
      } else if (bulkPills.length > 0) {
        const lastPill = bulkPills[bulkPills.length - 1];
        setBulkPills((prev) => prev.slice(0, -1));
        if (lastPill) {
          // If the last pill was deleted, put its value back to edit it!
          setBulkInputPhase("gb");
          setPendingPillId(lastPill.id);
          setTempPhone(lastPill.phone);
          setTempNetwork(lastPill.network);
          setBulkInputVal(lastPill.isValid ? (lastPill.sizeMb / DATA_MB_PER_GB).toString() : "");
          // Re-insert it as a pending pill so it can be updated
          setBulkPills((prev) => [
            ...prev,
            {
              ...lastPill,
              isValid: false,
              error: "Enter GB size...",
            }
          ]);
        }
      }
    } else if (e.key === "Escape") {
      if (bulkInputPhase === "gb") {
        setBulkInputPhase("phone");
        if (pendingPillId) {
          setBulkPills((prev) => prev.filter((p) => p.id !== pendingPillId));
          setPendingPillId(null);
        }
        setBulkInputVal("");
        setTempPhone("");
        setTempNetwork(null);
        setShowSuggestions(false);
      }
    }
  };

  const handleBulkInputPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData("text");
    if (!pastedText) return;

    const lines = pastedText.split(/\r?\n/);
    const newPills: BulkPill[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;
      const parts = line.split(/[,\s\t;]+/);
      const phonePart = parts[0]?.trim() || "";
      const gbPart = parts[1]?.trim() || "";

      const cleanedPhone = phonePart.replace(/\D/g, "");
      const detected = detectNetwork(cleanedPhone);
      const gbVal = parseFloat(gbPart);

      if (cleanedPhone.length === 10 && detected && !isNaN(gbVal)) {
        const pkg = findPackageByGb(detected, gbVal);
        if (pkg) {
          newPills.push({
            id: Math.random().toString(36).substring(2, 9),
            phone: cleanedPhone,
            network: detected,
            sizeMb: pkg.sizeMb,
            priceGhs: pkg.customerPriceGhs,
            packageId: pkg.id,
            isValid: true,
          });
          continue;
        }
      }

      newPills.push({
        id: Math.random().toString(36).substring(2, 9),
        phone: phonePart || "Empty",
        network: detected || "mtn",
        sizeMb: isNaN(gbVal) ? 0 : gbVal * DATA_MB_PER_GB,
        priceGhs: 0,
        packageId: "",
        isValid: false,
        error: !detected
          ? "Unknown network prefix"
          : cleanedPhone.length !== 10
            ? "Phone number must be 10 digits"
            : `Size ${gbPart || "empty"}GB not available`,
      });
    }

    if (newPills.length > 0) {
      setBulkPills((prev) => [...prev, ...newPills]);
      setSheetOpen(true);
    }
  };

  const removePill = (id: string) => {
    setBulkPills((prev) => prev.filter((p) => p.id !== id));
    if (id === pendingPillId) {
      setPendingPillId(null);
      setBulkInputPhase("phone");
      setBulkInputVal("");
      setTempPhone("");
      setTempNetwork(null);
      setShowSuggestions(false);
    }
  };

  const clearAllPills = () => {
    setBulkPills([]);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/);
      const newPills: BulkPill[] = [];

      for (const line of lines) {
        if (!line.trim()) continue;
        const parts = line.split(/[,\s\t;]+/);
        const phonePart = parts[0]?.trim() || "";
        const gbPart = parts[1]?.trim() || "";

        const cleanedPhone = phonePart.replace(/\D/g, "");
        const detected = detectNetwork(cleanedPhone);
        const gbVal = parseFloat(gbPart);

        if (cleanedPhone.length === 10 && detected && !isNaN(gbVal)) {
          const pkg = findPackageByGb(detected, gbVal);
          if (pkg) {
            newPills.push({
              id: Math.random().toString(36).substring(2, 9),
              phone: cleanedPhone,
              network: detected,
              sizeMb: pkg.sizeMb,
              priceGhs: pkg.customerPriceGhs,
              packageId: pkg.id,
              isValid: true,
            });
            continue;
          }
        }

        newPills.push({
          id: Math.random().toString(36).substring(2, 9),
          phone: phonePart || "Empty",
          network: detected || "mtn",
          sizeMb: isNaN(gbVal) ? 0 : gbVal * DATA_MB_PER_GB,
          priceGhs: 0,
          packageId: "",
          isValid: false,
          error: !detected
            ? "Unknown network prefix"
            : cleanedPhone.length !== 10
              ? "Phone number must be 10 digits"
              : `Size ${gbPart || "empty"}GB not available`,
        });
      }

      if (newPills.length > 0) {
        setBulkPills((prev) => [...prev, ...newPills]);
        setSheetOpen(true);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleBulkPay = async () => {
    if (bulkPills.length === 0) return;
    const hasErrors = bulkPills.some((p) => !p.isValid);
    if (hasErrors) {
      setOrderError("Please remove or correct the entries with errors before paying.");
      return;
    }

    setSubmitting(true);
    setOrderError("");

    try {
      if (payMethod === "wallet") {
        const promises = bulkPills.map((pill) =>
          getApi().createOrder({
            packageId: pill.packageId,
            network: pill.network,
            recipientPhone: pill.phone,
            confirmRecipientIsCorrect: true,
            paymentMethod: "wallet",
          })
        );
        const results = await Promise.all(promises);
        const refs = results.map((r) => r.reference).join(",");
        window.location.href = `/buy/confirmation?ref=${refs}`;
      } else {
        setOrderError("Bulk checkout via Mobile Money is only supported for authenticated agents. Please Log In or Sign Up, or use Wallet payment.");
      }
    } catch (err) {
      setOrderError(readApiError(err, "Bulk payment submission failed"));
    } finally {
      setSubmitting(false);
    }
  };

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
                    const sizeGb = pkg.sizeMb / DATA_MB_PER_GB;
                    const perGb = pkg.customerPriceGhs / sizeGb;
                    const isPopular = pkg.sizeMb === 5000 || pkg.sizeMb === 10000;
                    const isBestValue = pkg.sizeMb === 10000 || pkg.sizeMb === 15000;
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
              /* ── Smart Pill Bulk Entry ── */
              <div className="bulk-pill-workspace">
                {packageError && (
                  <div className="catalog-empty" style={{ marginBottom: 16 }}>
                    <p>{packageError}</p>
                    <button onClick={retryLoad}>Retry</button>
                  </div>
                )}
                <div
                  className="pill-input-container"
                  onClick={() => bulkInputRef.current?.focus()}
                  style={{ position: "relative" }}
                >
                  {bulkPills.map((pill) => (
                    <div
                      key={pill.id}
                      className={`pill ${pill.isValid ? "pill--valid" : "pill--error"}`}
                    >
                      <span className={`pill-dot pill-dot--${pill.network}`} />
                      <span className="pill-phone">
                        {pill.phone.substring(0, 3)} {pill.phone.substring(3, 6)} {pill.phone.substring(6)}
                      </span>
                      {pill.isValid ? (
                        <>
                          <span className="pill-size">{formatPackageSize(pill.sizeMb)}</span>
                          <span className="pill-price">GHS {pill.priceGhs.toFixed(2)}</span>
                        </>
                      ) : (
                        <span className="pill-error-msg">{pill.error || "Error"}</span>
                      )}
                      <button
                        className="pill-remove"
                        onClick={(e) => {
                          e.stopPropagation();
                          removePill(pill.id);
                        }}
                      >
                        &times;
                      </button>
                    </div>
                  ))}

                  <div style={{ display: "inline-flex", flexDirection: "column", position: "relative", flex: 1, minWidth: 180 }}>
                    <input
                      ref={bulkInputRef}
                      type="text"
                      className="pill-active-input"
                      value={bulkInputVal}
                      onChange={handleBulkInputChange}
                      onKeyDown={handleBulkInputKeyDown}
                      onPaste={handleBulkInputPaste}
                      placeholder={
                        bulkPills.length === 0
                          ? "Enter phone number..."
                          : bulkInputPhase === "gb"
                            ? "Enter GB size..."
                            : "Add recipient phone..."
                      }
                    />

                    {/* GB Suggestion Dropdown */}
                    {bulkInputPhase === "gb" && showSuggestions && (() => {
                      const activeNet = getActiveNetwork();
                      if (!activeNet) return null;
                      return (
                        <div className="gb-suggestion">
                          <div className="gb-suggestion-label">Available package sizes:</div>
                          {suggestedSizesState.lower && (
                            <div
                              className="gb-suggestion-opt"
                              onClick={() => handleGbSubmit(suggestedSizesState.lower!)}
                            >
                              <span>{suggestedSizesState.lower}GB</span>
                              <span className="opt-price">
                                GHS {findPackageByGb(activeNet, suggestedSizesState.lower)?.customerPriceGhs.toFixed(2)}
                              </span>
                            </div>
                          )}
                          {suggestedSizesState.higher && (
                            <div
                              className="gb-suggestion-opt"
                              onClick={() => handleGbSubmit(suggestedSizesState.higher!)}
                            >
                              <span>{suggestedSizesState.higher}GB</span>
                              <span className="opt-price">
                                GHS {findPackageByGb(activeNet, suggestedSizesState.higher)?.customerPriceGhs.toFixed(2)}
                              </span>
                            </div>
                          )}
                          {!suggestedSizesState.lower && !suggestedSizesState.higher && (
                            <div className="gb-suggestion-label" style={{ fontStyle: "italic", fontWeight: "normal" }}>
                              No matching packages. Maximum 50GB.
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  <div className="pill-phase-label">
                    {bulkInputPhase === "phone" ? (
                      tempNetwork ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          Detected:
                          <span className={`network-badge network-badge--${tempNetwork}`}>
                            <span className="badge-dot" />
                            {NETWORK_NAMES[tempNetwork]}
                          </span>
                        </span>
                      ) : (
                        "Enter 10-digit phone number"
                      )
                    ) : (() => {
                      const activeNet = getActiveNetwork();
                      return (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          Recipient: <strong>{tempPhone}</strong>
                          {activeNet && (
                            <span className={`network-badge network-badge--${activeNet}`}>
                              <span className="badge-dot" />
                              {NETWORK_NAMES[activeNet]}
                            </span>
                          )}
                          &rarr; Enter data size (GB)
                        </span>
                      );
                    })()}
                  </div>
                </div>

                {/* GB Quick-Select Chips */}
                {bulkInputPhase === "gb" && (() => {
                  const activeNet = getActiveNetwork();
                  if (!activeNet) return null;
                  return (
                    <div style={{ marginTop: 12 }}>
                      <div className="checkout-section-label" style={{ fontSize: "0.72rem" }}>
                        Quick-Select Data Size
                      </div>
                      <div className="gb-chips">
                        {packages
                          .filter((pkg) => pkg.network === activeNet && pkg.isAvailable)
                          .sort((a, b) => a.sizeMb - b.sizeMb)
                          .map((pkg) => {
                            const gb = pkg.sizeMb / DATA_MB_PER_GB;
                            return (
                              <button
                                key={pkg.id}
                                className="gb-chip"
                                onClick={() => handleGbSubmit(gb)}
                              >
                                {formatPackageSize(pkg.sizeMb)} (GHS {pkg.customerPriceGhs.toFixed(2)})
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  );
                })()}

                {/* Actions and File Upload */}
                <div className="pill-actions">
                  <div>
                    {bulkPills.length} {bulkPills.length === 1 ? "recipient" : "recipients"}
                  </div>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <label className="pill-upload-link" htmlFor="bulk-file-upload">
                      Upload CSV/Text
                    </label>
                    <input
                      type="file"
                      id="bulk-file-upload"
                      accept=".csv,.txt"
                      style={{ display: "none" }}
                      onChange={handleFileUpload}
                    />
                    {bulkPills.length > 0 && (
                      <button onClick={clearAllPills}>Clear All</button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
          <aside className="checkout-panel">
            <div className="checkout-title">
              <span className="icon"><LockSmall /></span>
              Checkout
            </div>

            {mode === "single" ? (
              <>
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
                  onClick={handleSinglePay}
                >
                  {submitting
                    ? "Processing..."
                    : selectedPkg
                      ? `Pay GHS ${selectedPkg.customerPriceGhs.toFixed(2)} with ${payMethod === "momo" ? "MoMo" : "Wallet"}`
                      : "Select a package"}
                </button>
              </>
            ) : (
              <>
                {/* Bulk Checkout Summary */}
                <div className="checkout-section">
                  <div className="checkout-section-label">Order Summary</div>
                  {bulkPills.length === 0 ? (
                    <div className="checkout-pkg-empty">Add recipients to see order summary</div>
                  ) : (
                    <div className="checkout-pkg-summary" style={{ flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", width: "100%", fontWeight: 600 }}>
                        <span>Total Recipients</span>
                        <span>{bulkPills.length}</span>
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", width: "100%" }}>
                        {mtnCount > 0 && <span style={{ marginRight: 10 }}>MTN: {mtnCount}</span>}
                        {telecelCount > 0 && <span style={{ marginRight: 10 }}>Telecel: {telecelCount}</span>}
                        {atCount > 0 && <span>AirtelTigo: {atCount}</span>}
                      </div>
                      {invalidCount > 0 && (
                        <div style={{ color: "#ef4444", fontSize: "0.78rem", fontWeight: 600, marginTop: 4 }}>
                          &bull; {invalidCount} {invalidCount === 1 ? "entry needs" : "entries need"} attention
                        </div>
                      )}
                      <div style={{ borderTop: "1px solid var(--border)", width: "100%", marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 600 }}>Total Cost</span>
                        <span className="pkg-price">GHS {totalCostGhs.toFixed(2)}</span>
                      </div>
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
                  <span>I have checked the recipient numbers and accept responsibility for wrong-number purchases.</span>
                </label>

                {/* Pay Button */}
                <button
                  className="btn btn-primary btn-lg btn-full"
                  style={{ marginTop: 18 }}
                  disabled={submitting || bulkPills.length === 0 || invalidCount > 0 || !recipientConfirmed}
                  onClick={handleBulkPay}
                >
                  {submitting
                    ? "Processing..."
                    : bulkPills.length > 0
                      ? `Pay GHS ${totalCostGhs.toFixed(2)} for ${bulkPills.length} ${bulkPills.length === 1 ? "bundle" : "bundles"} with ${payMethod === "momo" ? "MoMo" : "Wallet"}`
                      : "Add recipients to pay"}
                </button>
              </>
            )}

            {orderError && <div className="order-message order-error">{orderError}</div>}

            <div className="buy-widget-footer">
              <LockSmall />
              <span>Secured by Paystack Mobile Money</span>
            </div>
          </aside>
        </div>
      </div>

      {/* ── Mobile Bottom Sheet ── */}
      <div
        className="bottom-sheet-overlay"
        data-open={sheetOpen && (mode === "single" ? selectedPkg !== null : bulkPills.length > 0)}
        onClick={() => setSheetOpen(false)}
      />
      <div
        className="bottom-sheet"
        data-open={sheetOpen && (mode === "single" ? selectedPkg !== null : bulkPills.length > 0)}
      >
        <div className="sheet-handle" />
        {mode === "single" ? (
          selectedPkg && (
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
              <button className="btn btn-primary btn-lg btn-full" style={{ marginTop: 18 }} disabled={submitting || !recipientConfirmed || !phone.trim()} onClick={handleSinglePay}>
                {submitting ? "Processing..." : `Pay GHS ${selectedPkg.customerPriceGhs.toFixed(2)} with ${payMethod === "momo" ? "MoMo" : "Wallet"}`}
              </button>
              {orderError && <div className="order-message order-error">{orderError}</div>}
              <div className="buy-widget-footer"><LockSmall /><span>Secured by Paystack Mobile Money</span></div>
            </>
          )
        ) : (
          bulkPills.length > 0 && (
            <>
              <div className="checkout-title">
                <span className="icon"><LockSmall /></span>
                Checkout Summary
              </div>
              <div className="checkout-section">
                <div className="checkout-pkg-summary" style={{ flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", width: "100%", fontWeight: 600 }}>
                    <span>Total Recipients</span>
                    <span>{bulkPills.length}</span>
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", width: "100%" }}>
                    {mtnCount > 0 && <span style={{ marginRight: 10 }}>MTN: {mtnCount}</span>}
                    {telecelCount > 0 && <span style={{ marginRight: 10 }}>Telecel: {telecelCount}</span>}
                    {atCount > 0 && <span>AirtelTigo: {atCount}</span>}
                  </div>
                  {invalidCount > 0 && (
                    <div style={{ color: "#ef4444", fontSize: "0.78rem", fontWeight: 600, marginTop: 4 }}>
                      &bull; {invalidCount} {invalidCount === 1 ? "entry needs" : "entries need"} attention
                    </div>
                  )}
                  <div style={{ borderTop: "1px solid var(--border)", width: "100%", marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 600 }}>Total Cost</span>
                    <span className="pkg-price">GHS {totalCostGhs.toFixed(2)}</span>
                  </div>
                </div>
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
                <span>I have checked the recipient numbers and accept responsibility for wrong-number purchases.</span>
              </label>
              <button className="btn btn-primary btn-lg btn-full" style={{ marginTop: 18 }} disabled={submitting || bulkPills.length === 0 || invalidCount > 0 || !recipientConfirmed} onClick={handleBulkPay}>
                {submitting ? "Processing..." : `Pay GHS ${totalCostGhs.toFixed(2)} for ${bulkPills.length} bundles with ${payMethod === "momo" ? "MoMo" : "Wallet"}`}
              </button>
              {orderError && <div className="order-message order-error">{orderError}</div>}
              <div className="buy-widget-footer"><LockSmall /><span>Secured by Paystack Mobile Money</span></div>
            </>
          )
        )}
      </div>

      {/* Floating Bulk Cart Button for Mobile */}
      {mode === "bulk" && bulkPills.length > 0 && !sheetOpen && (
        <button
          className="btn btn-primary"
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 40,
            boxShadow: "var(--shadow-lg)",
            borderRadius: "var(--radius-full)",
            padding: "12px 24px",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
          onClick={() => setSheetOpen(true)}
        >
          <span>View Order Summary ({bulkPills.length})</span>
          <strong>GHS {totalCostGhs.toFixed(2)}</strong>
        </button>
      )}

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
