"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { convexApi } from "@betterdata/app-api";
import { DataTable, type ColumnDef } from "../../components/DataTable";
import { SearchFilter, type FilterSpec } from "../../components/SearchFilter";
import { StatusBadge } from "../../components/StatusBadge";
import { Modal } from "../../components/Modal";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { useToast } from "../../components/Toast";

interface DataPackageWithPricing {
  _id: string;
  vendorId: string;
  vendorPackageId: string;
  network: "mtn" | "telecel" | "airteltigo";
  name: string;
  sizeMb: number;
  providerCostGhs: number;
  customerPriceGhs: number;
  isAvailable: boolean;
  computedPriceGhs: number;
  activeRule: {
    _id: string;
    mode: "percentage" | "fixed";
    value: number;
    isGlobal: boolean;
  } | null;
}

type PricingRule = {
  _id: string;
  packageId?: string;
  mode: "percentage" | "fixed";
  value: number;
  isGlobal: boolean;
  isActive: boolean;
};

type PaymentConfig = {
  agentDiscountPercentage?: number;
  firstPurchaseDiscountGhs?: number;
};

export default function PricingPage() {
  const { showToast } = useToast();
  // Query for packages and rules
  const packages = useQuery(convexApi.admin.listDataPackagesWithPricing, {}) as
    | DataPackageWithPricing[]
    | undefined;
  const pricingRules = useQuery(convexApi.admin.listPricingRules, {}) as
    | PricingRule[]
    | undefined;
  const config = useQuery(convexApi.platformConfig.listPaymentConfig) as
    | PaymentConfig
    | undefined;

  // Mutations
  const upsertPricingRule = useMutation(convexApi.admin.upsertPricingRule);
  const deletePricingRule = useMutation(convexApi.admin.deletePricingRule);
  const setNumberConfig = useMutation(convexApi.platformConfig.setNumberConfig);

  // Search & Filter state
  const [search, setSearch] = useState("");
  const [networkFilter, setNetworkFilter] = useState("");
  const [overrideFilter, setOverrideFilter] = useState("");

  // Edit config states
  const [editingAgentDiscount, setEditingAgentDiscount] = useState(false);
  const [agentDiscountVal, setAgentDiscountVal] = useState("");
  const [editingFirstPurchase, setEditingFirstPurchase] = useState(false);
  const [firstPurchaseVal, setFirstPurchaseVal] = useState("");

  // Global markup rule states
  const [isGlobalModalOpen, setIsGlobalModalOpen] = useState(false);
  const [globalMode, setGlobalMode] = useState<"percentage" | "fixed">(
    "percentage",
  );
  const [globalValue, setGlobalValue] = useState("");
  const [globalActive, setGlobalActive] = useState(true);

  // Package override states
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [selectedPkg, setSelectedPkg] = useState<DataPackageWithPricing | null>(
    null,
  );
  const [overrideMode, setOverrideMode] = useState<"percentage" | "fixed">(
    "percentage",
  );
  const [overrideValue, setOverrideValue] = useState("");
  const [overrideActive, setOverrideActive] = useState(true);

  // Pending override removal awaiting confirmation in the ConfirmDialog
  const [removeTarget, setRemoveTarget] =
    useState<DataPackageWithPricing | null>(null);

  // Operations states
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize values when config or rules change
  const agentDiscountPercentage = config?.agentDiscountPercentage ?? 0;
  const firstPurchaseDiscountGhs = config?.firstPurchaseDiscountGhs ?? 0;

  const globalRule = pricingRules?.find((r) => r.isGlobal);

  useEffect(() => {
    if (globalRule) {
      setGlobalMode(globalRule.mode as "percentage" | "fixed");
      setGlobalValue(String(globalRule.value));
      setGlobalActive(globalRule.isActive);
    }
  }, [globalRule]);

  // Formatter helpers
  const formatSize = (mb: number) => {
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1).replace(/\.0$/, "")} GB`;
    }
    return `${mb} MB`;
  };

  const formatNetwork = (net: string) => {
    if (net === "mtn") return "MTN";
    if (net === "telecel") return "Telecel";
    if (net === "airteltigo") return "AirtelTigo";
    return net.toUpperCase();
  };

  // Handlers
  const handleSaveAgentDiscount = async () => {
    const num = Number(agentDiscountVal);
    if (isNaN(num) || num < 0 || num > 100) {
      showToast(
        "Please enter a valid percentage between 0 and 100.",
        "warning",
      );
      return;
    }
    try {
      setSubmitting(true);
      await setNumberConfig({ key: "agentDiscountPercentage", value: num });
      setEditingAgentDiscount(false);
      showToast("Agent discount updated successfully.", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to update agent discount", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveFirstPurchase = async () => {
    const num = Number(firstPurchaseVal);
    if (isNaN(num) || num < 0) {
      showToast("Please enter a valid amount.", "warning");
      return;
    }
    try {
      setSubmitting(true);
      await setNumberConfig({ key: "firstPurchaseDiscountGhs", value: num });
      setEditingFirstPurchase(false);
      showToast("First-purchase discount updated successfully.", "success");
    } catch (err: any) {
      showToast(
        err.message || "Failed to update first-purchase discount",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveGlobalRule = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(globalValue);
    if (isNaN(val) || val < 0) {
      setError("Please enter a valid positive number.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await upsertPricingRule({
        isGlobal: true,
        mode: globalMode,
        value: val,
        isActive: globalActive,
      });
      setIsGlobalModalOpen(false);
      showToast("Global markup rule saved successfully.", "success");
    } catch (err: any) {
      setError(err.message || "Failed to save global rule");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenOverride = (pkg: DataPackageWithPricing) => {
    setSelectedPkg(pkg);
    if (pkg.activeRule && !pkg.activeRule.isGlobal) {
      setOverrideMode(pkg.activeRule.mode);
      setOverrideValue(String(pkg.activeRule.value));
      setOverrideActive(true);
    } else {
      setOverrideMode("fixed");
      setOverrideValue("2.0");
      setOverrideActive(true);
    }
    setError(null);
    setIsOverrideModalOpen(true);
  };

  const handleSaveOverrideRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPkg) return;

    const val = Number(overrideValue);
    if (isNaN(val) || val < 0) {
      setError("Please enter a valid positive number.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await upsertPricingRule({
        packageId: selectedPkg._id as any,
        isGlobal: false,
        mode: overrideMode,
        value: val,
        isActive: overrideActive,
      });
      setIsOverrideModalOpen(false);
      setSelectedPkg(null);
      showToast(
        `Custom pricing override for "${selectedPkg.name}" saved successfully.`,
        "success",
      );
    } catch (err: any) {
      setError(err.message || "Failed to save override rule");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveOverride = async (pkg: DataPackageWithPricing) => {
    if (!pkg.activeRule || pkg.activeRule.isGlobal) return;

    try {
      setSubmitting(true);
      await deletePricingRule({ ruleId: pkg.activeRule._id as any });
      showToast(
        `Pricing override for "${pkg.name}" removed successfully.`,
        "success",
      );
      setRemoveTarget(null);
    } catch (err: any) {
      showToast(err.message || "Failed to remove override", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Filtering list
  const filteredPackages = packages?.filter((pkg) => {
    const matchesSearch =
      pkg.name.toLowerCase().includes(search.toLowerCase()) ||
      pkg.network.toLowerCase().includes(search.toLowerCase());

    const matchesNetwork = !networkFilter || pkg.network === networkFilter;

    let matchesOverride = true;
    if (overrideFilter === "custom") {
      matchesOverride = !!pkg.activeRule && !pkg.activeRule.isGlobal;
    } else if (overrideFilter === "global") {
      matchesOverride = !!pkg.activeRule && pkg.activeRule.isGlobal;
    } else if (overrideFilter === "none") {
      matchesOverride = !pkg.activeRule;
    }

    return matchesSearch && matchesNetwork && matchesOverride;
  });

  const filters: FilterSpec[] = [
    {
      key: "network",
      label: "Network",
      value: networkFilter,
      onChange: setNetworkFilter,
      options: [
        { value: "mtn", label: "MTN" },
        { value: "telecel", label: "Telecel" },
        { value: "airteltigo", label: "AirtelTigo" },
      ],
    },
    {
      key: "override",
      label: "Rule Status",
      value: overrideFilter,
      onChange: setOverrideFilter,
      options: [
        { value: "custom", label: "Custom Override" },
        { value: "global", label: "Global Rule Only" },
        { value: "none", label: "No Rule / Default" },
      ],
    },
  ];

  const columns: ColumnDef<DataPackageWithPricing>[] = [
    {
      key: "name",
      header: "Package Name",
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: "var(--text)" }}>
            {row.name}
          </div>
          <div
            className="text-xs text-muted"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {row.vendorPackageId}
          </div>
        </div>
      ),
    },
    {
      key: "network",
      header: "Network",
      render: (row) => (
        <span
          className="badge"
          style={{
            fontWeight: 600,
            textTransform: "uppercase",
            background:
              row.network === "mtn"
                ? "rgba(251, 191, 36, 0.15)"
                : row.network === "telecel"
                  ? "rgba(239, 68, 68, 0.15)"
                  : "rgba(59, 130, 246, 0.15)",
            color:
              row.network === "mtn"
                ? "rgb(217, 119, 6)"
                : row.network === "telecel"
                  ? "rgb(220, 38, 38)"
                  : "rgb(37, 99, 235)",
          }}
        >
          {formatNetwork(row.network)}
        </span>
      ),
    },
    {
      key: "sizeMb",
      header: "Size",
      render: (row) => <span>{formatSize(row.sizeMb)}</span>,
    },
    {
      key: "providerCostGhs",
      header: "Cost Price",
      hiddenOnMobile: true,
      render: (row) => (
        <span className="font-mono">GHS {row.providerCostGhs.toFixed(2)}</span>
      ),
    },
    {
      key: "customerPriceGhs",
      header: "Base Price",
      hiddenOnMobile: true,
      render: (row) => (
        <span className="font-mono text-muted">
          GHS {row.customerPriceGhs.toFixed(2)}
        </span>
      ),
    },
    {
      key: "rule",
      header: "Applied Rule",
      hiddenOnMobile: true,
      render: (row) => {
        if (!row.activeRule) {
          return <span className="text-muted text-sm">No Markup (Cost)</span>;
        }
        const badgeStatus = row.activeRule.isGlobal ? "neutral" : "success";
        const ruleLabel = row.activeRule.isGlobal
          ? "Global Rule"
          : "Custom Override";
        const ruleVal =
          row.activeRule.mode === "percentage"
            ? `+${row.activeRule.value}%`
            : `+GHS ${row.activeRule.value.toFixed(2)}`;

        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <StatusBadge status={badgeStatus} label={ruleLabel} />
            <span
              className="font-mono text-xs text-muted"
              style={{ fontWeight: 500 }}
            >
              {ruleVal}
            </span>
          </div>
        );
      },
    },
    {
      key: "computedPriceGhs",
      header: "Customer Price",
      render: (row) => (
        <strong
          style={{ color: "var(--text)", fontFamily: "var(--font-mono)" }}
        >
          GHS {row.computedPriceGhs.toFixed(2)}
        </strong>
      ),
    },
    {
      key: "agentPriceGhs",
      header: "Agent Price",
      hiddenOnMobile: true,
      render: (row) => {
        const agentPrice =
          row.computedPriceGhs * (1 - agentDiscountPercentage / 100);
        return (
          <span
            className="font-mono text-sm"
            style={{ color: "var(--primary)", fontWeight: 600 }}
          >
            GHS {agentPrice.toFixed(2)}
          </span>
        );
      },
    },
    {
      key: "actions",
      header: "Actions",
      render: (row) => {
        const hasCustomOverride = row.activeRule && !row.activeRule.isGlobal;
        return (
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <button
              onClick={() => handleOpenOverride(row)}
              className="btn btn-secondary btn-sm"
            >
              {hasCustomOverride ? "Edit Rule" : "Override"}
            </button>
            {hasCustomOverride && (
              <button
                onClick={() => setRemoveTarget(row)}
                className="btn btn-ghost btn-sm text-danger"
                style={{ color: "var(--danger)" }}
              >
                Reset
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <div className="page-header" style={{ marginBottom: "var(--space-6)" }}>
        <div>
          <h1 className="page-title">Pricing Configuration</h1>
          <p className="page-subtitle">
            Configure markups, override prices per package, and manage user
            discount tiers
          </p>
        </div>
      </div>

      {/* Configurations Overview Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "var(--space-6)",
          marginBottom: "var(--space-6)",
        }}
      >
        {/* Global Markup Card */}
        <div className="card">
          <div className="card-header">
            <div>
              <span className="card-header-subtitle">Global Setup</span>
              <h3 className="card-header-title">Retail Markup</h3>
            </div>
          </div>
          <div
            className="card-body"
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              height: "calc(100% - 65px)",
            }}
          >
            <div>
              <p
                style={{
                  margin: "0 0 var(--space-4) 0",
                  fontSize: "var(--font-size-sm)",
                  color: "var(--text-muted)",
                }}
              >
                Applied globally to packages without a specific override rule.
                Computed from provider cost.
              </p>
              {globalRule ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: "var(--space-2)",
                    margin: "var(--space-2) 0",
                  }}
                >
                  <span
                    style={{
                      fontSize: "var(--font-size-3xl)",
                      fontWeight: 700,
                      color: "var(--text)",
                    }}
                  >
                    {globalRule.mode === "percentage"
                      ? `${globalRule.value}%`
                      : `GHS ${globalRule.value.toFixed(2)}`}
                  </span>
                  <span className="text-muted text-sm">
                    (
                    {globalRule.mode === "percentage"
                      ? "Percentage"
                      : "Fixed Amount"}
                    )
                  </span>
                </div>
              ) : (
                <div
                  style={{
                    margin: "var(--space-4) 0",
                    fontWeight: 600,
                    color: "var(--text-muted)",
                  }}
                >
                  No Global Rule Configured
                </div>
              )}
            </div>
            <div style={{ marginTop: "var(--space-4)" }}>
              <button
                className="btn btn-secondary"
                style={{ width: "100%" }}
                onClick={() => {
                  if (globalRule) {
                    setGlobalMode(globalRule.mode as "percentage" | "fixed");
                    setGlobalValue(String(globalRule.value));
                    setGlobalActive(globalRule.isActive);
                  } else {
                    setGlobalMode("percentage");
                    setGlobalValue("10");
                    setGlobalActive(true);
                  }
                  setError(null);
                  setIsGlobalModalOpen(true);
                }}
              >
                {globalRule ? "Edit Global Rule" : "Configure Markup"}
              </button>
            </div>
          </div>
        </div>

        {/* Agent Discount Card */}
        <div className="card">
          <div className="card-header">
            <div>
              <span className="card-header-subtitle">Agent Setup</span>
              <h3 className="card-header-title">Agent Discount</h3>
            </div>
          </div>
          <div
            className="card-body"
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              height: "calc(100% - 65px)",
            }}
          >
            <div>
              <p
                style={{
                  margin: "0 0 var(--space-4) 0",
                  fontSize: "var(--font-size-sm)",
                  color: "var(--text-muted)",
                }}
              >
                The discount percentage agents receive on all bundle purchases
                relative to the calculated customer price.
              </p>
              {editingAgentDiscount ? (
                <div
                  style={{
                    display: "flex",
                    gap: "var(--space-2)",
                    alignItems: "center",
                    margin: "var(--space-2) 0",
                  }}
                >
                  <input
                    type="number"
                    className="input"
                    value={agentDiscountVal}
                    onChange={(e) => setAgentDiscountVal(e.target.value)}
                    style={{ width: "90px" }}
                    placeholder="%"
                    min="0"
                    max="100"
                    disabled={submitting}
                    autoFocus
                  />
                  <span style={{ fontSize: "var(--font-size-sm)" }}>%</span>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleSaveAgentDiscount}
                    disabled={submitting}
                  >
                    Save
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setEditingAgentDiscount(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: "var(--space-2)",
                    margin: "var(--space-2) 0",
                  }}
                >
                  <span
                    style={{
                      fontSize: "var(--font-size-3xl)",
                      fontWeight: 700,
                      color: "var(--text)",
                    }}
                  >
                    {agentDiscountPercentage}%
                  </span>
                  <span className="text-muted text-sm">Discount</span>
                </div>
              )}
            </div>
            <div style={{ marginTop: "var(--space-4)" }}>
              {!editingAgentDiscount && (
                <button
                  className="btn btn-secondary"
                  style={{ width: "100%" }}
                  onClick={() => {
                    setAgentDiscountVal(String(agentDiscountPercentage));
                    setEditingAgentDiscount(true);
                  }}
                >
                  Edit Agent Discount
                </button>
              )}
            </div>
          </div>
        </div>

        {/* First-purchase Discount Card */}
        <div className="card">
          <div className="card-header">
            <div>
              <span className="card-header-subtitle">Welcome Promo</span>
              <h3 className="card-header-title">First Purchase Discount</h3>
            </div>
          </div>
          <div
            className="card-body"
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              height: "calc(100% - 65px)",
            }}
          >
            <div>
              <p
                style={{
                  margin: "0 0 var(--space-4) 0",
                  fontSize: "var(--font-size-sm)",
                  color: "var(--text-muted)",
                }}
              >
                A welcome flat discount automatically applied to a new user's
                first bundle purchase.
              </p>
              {editingFirstPurchase ? (
                <div
                  style={{
                    display: "flex",
                    gap: "var(--space-2)",
                    alignItems: "center",
                    margin: "var(--space-2) 0",
                  }}
                >
                  <input
                    type="number"
                    className="input"
                    value={firstPurchaseVal}
                    onChange={(e) => setFirstPurchaseVal(e.target.value)}
                    style={{ width: "110px" }}
                    placeholder="GHS"
                    min="0"
                    disabled={submitting}
                    autoFocus
                  />
                  <span style={{ fontSize: "var(--font-size-sm)" }}>GHS</span>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleSaveFirstPurchase}
                    disabled={submitting}
                  >
                    Save
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setEditingFirstPurchase(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: "var(--space-2)",
                    margin: "var(--space-2) 0",
                  }}
                >
                  <span
                    style={{
                      fontSize: "var(--font-size-3xl)",
                      fontWeight: 700,
                      color: "var(--text)",
                    }}
                  >
                    GHS {firstPurchaseDiscountGhs.toFixed(2)}
                  </span>
                  <span className="text-muted text-sm">Credit</span>
                </div>
              )}
            </div>
            <div style={{ marginTop: "var(--space-4)" }}>
              {!editingFirstPurchase && (
                <button
                  className="btn btn-secondary"
                  style={{ width: "100%" }}
                  onClick={() => {
                    setFirstPurchaseVal(String(firstPurchaseDiscountGhs));
                    setEditingFirstPurchase(true);
                  }}
                >
                  Edit Promo Discount
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Packages Table Card */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-header-title">
              Data Packages Markup Overrides
            </h3>
          </div>
        </div>
        <div className="card-body">
          <SearchFilter
            placeholder="Search by package name or network..."
            search={search}
            onSearchChange={setSearch}
            filters={filters}
            onClear={() => {
              setSearch("");
              setNetworkFilter("");
              setOverrideFilter("");
            }}
          />

          <DataTable
            columns={columns}
            data={filteredPackages ?? []}
            isLoading={packages === undefined}
            emptyStateTitle="No packages found"
            emptyStateDescription="Try adjusting your filters or search query."
            rowKey={(row) => row._id}
          />
        </div>
      </div>

      {/* Global Rule Modal */}
      <Modal
        isOpen={isGlobalModalOpen}
        onClose={() => setIsGlobalModalOpen(false)}
        title="Configure Global Retail Markup"
      >
        <form onSubmit={handleSaveGlobalRule}>
          {error && (
            <div
              style={{
                color: "var(--danger)",
                background: "var(--danger-light)",
                padding: "var(--space-3)",
                borderRadius: "var(--radius-md)",
                fontSize: "var(--font-size-sm)",
                marginBottom: "var(--space-4)",
                fontWeight: 500,
              }}
            >
              {error}
            </div>
          )}

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-4)",
            }}
          >
            <div className="form-group">
              <label className="form-label">Markup Type</label>
              <div style={{ display: "flex", gap: "var(--space-4)" }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                    fontSize: "var(--font-size-sm)",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="globalMode"
                    value="percentage"
                    checked={globalMode === "percentage"}
                    onChange={() => setGlobalMode("percentage")}
                  />
                  Percentage (%)
                </label>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                    fontSize: "var(--font-size-sm)",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="globalMode"
                    value="fixed"
                    checked={globalMode === "fixed"}
                    onChange={() => setGlobalMode("fixed")}
                  />
                  Fixed Amount (GHS)
                </label>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="globalValue">
                Markup Value ({globalMode === "percentage" ? "%" : "GHS"})
              </label>
              <input
                id="globalValue"
                type="number"
                step="any"
                className="input"
                value={globalValue}
                onChange={(e) => setGlobalValue(e.target.value)}
                required
                min="0"
                placeholder={
                  globalMode === "percentage" ? "e.g. 10" : "e.g. 5.00"
                }
              />
              <span className="form-hint">
                {globalMode === "percentage"
                  ? "Calculated as: Cost Price * (1 + markup% / 100)"
                  : "Calculated as: Cost Price + markup GHS"}
              </span>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2)",
                marginTop: "var(--space-2)",
              }}
            >
              <input
                id="globalActive"
                type="checkbox"
                checked={globalActive}
                onChange={(e) => setGlobalActive(e.target.checked)}
              />
              <label
                className="form-label"
                htmlFor="globalActive"
                style={{ cursor: "pointer" }}
              >
                Enable this markup rule
              </label>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "var(--space-3)",
              marginTop: "var(--space-6)",
              borderTop: "1px solid var(--border)",
              paddingTop: "var(--space-4)",
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsGlobalModalOpen(false)}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? "Saving..." : "Save Rule"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Package Specific Override Modal */}
      <Modal
        isOpen={isOverrideModalOpen}
        onClose={() => {
          setIsOverrideModalOpen(false);
          setSelectedPkg(null);
        }}
        title={`Custom Markup Override — ${selectedPkg?.name ?? ""}`}
      >
        <form onSubmit={handleSaveOverrideRule}>
          {error && (
            <div
              style={{
                color: "var(--danger)",
                background: "var(--danger-light)",
                padding: "var(--space-3)",
                borderRadius: "var(--radius-md)",
                fontSize: "var(--font-size-sm)",
                marginBottom: "var(--space-4)",
                fontWeight: 500,
              }}
            >
              {error}
            </div>
          )}

          {selectedPkg && (
            <div
              style={{
                background: "var(--bg-inset)",
                padding: "var(--space-4)",
                borderRadius: "var(--radius-md)",
                marginBottom: "var(--space-4)",
                fontSize: "var(--font-size-sm)",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "var(--space-3)",
              }}
            >
              <div>
                <span className="text-muted text-xs block">Provider Cost</span>
                <span style={{ fontWeight: 600, color: "var(--text)" }}>
                  GHS {selectedPkg.providerCostGhs.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-muted text-xs block">Default Price</span>
                <span style={{ fontWeight: 600, color: "var(--text)" }}>
                  GHS {selectedPkg.customerPriceGhs.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-4)",
            }}
          >
            <div className="form-group">
              <label className="form-label">Markup Override Type</label>
              <div style={{ display: "flex", gap: "var(--space-4)" }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                    fontSize: "var(--font-size-sm)",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="overrideMode"
                    value="percentage"
                    checked={overrideMode === "percentage"}
                    onChange={() => setOverrideMode("percentage")}
                  />
                  Percentage (%)
                </label>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                    fontSize: "var(--font-size-sm)",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="overrideMode"
                    value="fixed"
                    checked={overrideMode === "fixed"}
                    onChange={() => setOverrideMode("fixed")}
                  />
                  Fixed Amount (GHS)
                </label>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="overrideValue">
                Markup Value ({overrideMode === "percentage" ? "%" : "GHS"})
              </label>
              <input
                id="overrideValue"
                type="number"
                step="any"
                className="input"
                value={overrideValue}
                onChange={(e) => setOverrideValue(e.target.value)}
                required
                min="0"
                placeholder={
                  overrideMode === "percentage" ? "e.g. 15" : "e.g. 4.50"
                }
              />
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2)",
                marginTop: "var(--space-2)",
              }}
            >
              <input
                id="overrideActive"
                type="checkbox"
                checked={overrideActive}
                onChange={(e) => setOverrideActive(e.target.checked)}
              />
              <label
                className="form-label"
                htmlFor="overrideActive"
                style={{ cursor: "pointer" }}
              >
                Enable override for this package
              </label>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "var(--space-3)",
              marginTop: "var(--space-6)",
              borderTop: "1px solid var(--border)",
              paddingTop: "var(--space-4)",
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setIsOverrideModalOpen(false);
                setSelectedPkg(null);
              }}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? "Saving..." : "Save Override"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
        title="Remove custom pricing override?"
        description={
          removeTarget
            ? `"${removeTarget.name}" will fall back to the global retail markup (or cost price if none is set).`
            : undefined
        }
        confirmLabel="Remove Override"
        destructive
        loading={submitting}
        onConfirm={() => {
          if (removeTarget) void handleRemoveOverride(removeTarget);
        }}
      />
    </div>
  );
}
