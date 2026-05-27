"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { convexApi } from "@betterdata/app-api";

const CONFIG_METADATA = [
  {
    key: "minimumWalletTopUpGhs",
    label: "Minimum Wallet Top-up",
    description: "The minimum amount in GHS that a user can top up their wallet with.",
    suffix: "GHS",
  },
  {
    key: "maximumWalletTopUpGhs",
    label: "Maximum Wallet Top-up",
    description: "The maximum amount in GHS that a user can top up their wallet with.",
    suffix: "GHS",
  },
  {
    key: "agentOnboardingFeeGhs",
    label: "Agent Onboarding Fee",
    description: "The flat fee in GHS charged to users who apply to become agents.",
    suffix: "GHS",
  },
  {
    key: "firstPurchaseDiscountGhs",
    label: "First-purchase Discount",
    description: "A welcome discount in GHS applied automatically to a user's first purchase.",
    suffix: "GHS",
  },
  {
    key: "agentDiscountPercentage",
    label: "Agent Discount Percentage",
    description: "The percentage discount agents receive on all data bundle purchases.",
    suffix: "%",
    min: 0,
    max: 100,
  },
  {
    key: "paymentIntentExpirySeconds",
    label: "Payment Intent Expiry",
    description: "How long in seconds a mobile money payment intent remains valid before expiring.",
    suffix: "seconds",
    min: 1,
  },
] as const;

type ConfigKey = (typeof CONFIG_METADATA)[number]["key"];

export function PaymentConfigEditor() {
  const config = useQuery(convexApi.platformConfig.listPaymentConfig);
  const setNumberConfig = useMutation(convexApi.platformConfig.setNumberConfig);

  const [editingKey, setEditingKey] = useState<ConfigKey | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successKey, setSuccessKey] = useState<ConfigKey | null>(null);

  // Clear success notification after 3 seconds
  useEffect(() => {
    if (successKey) {
      const timer = setTimeout(() => setSuccessKey(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successKey]);

  if (config === undefined) {
    return (
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-header-title">Platform Configuration</div>
          </div>
        </div>
        <div className="card-body">
          <div className="skeleton" style={{ height: "16px", marginBottom: "var(--space-4)" }} />
          <div className="skeleton" style={{ height: "16px", marginBottom: "var(--space-4)" }} />
          <div className="skeleton" style={{ height: "16px" }} />
        </div>
      </div>
    );
  }

  const handleStartEdit = (key: ConfigKey, value: number | null | undefined) => {
    setEditingKey(key);
    setEditValue(value !== null && value !== undefined ? String(value) : "");
    setError(null);
    setSuccessKey(null);
  };

  const handleCancelEdit = () => {
    setEditingKey(null);
    setEditValue("");
    setError(null);
  };

  const handleSave = async (key: ConfigKey) => {
    const numericValue = Number(editValue);

    if (isNaN(numericValue) || editValue.trim() === "") {
      setError("Please enter a valid number.");
      return;
    }

    const meta = CONFIG_METADATA.find((m) => m.key === key);
    if (meta) {
      if ("min" in meta && meta.min !== undefined && numericValue < meta.min) {
        setError(`Value must be at least ${meta.min}.`);
        return;
      }
      if ("max" in meta && meta.max !== undefined && numericValue > meta.max) {
        setError(`Value cannot exceed ${meta.max}.`);
        return;
      }
    }

    // Additional cross-field validation
    if (key === "minimumWalletTopUpGhs") {
      const maxVal = config.maximumWalletTopUpGhs;
      if (maxVal !== null && maxVal !== undefined && numericValue > maxVal) {
        setError("Minimum top-up cannot exceed maximum top-up.");
        return;
      }
    } else if (key === "maximumWalletTopUpGhs") {
      const minVal = config.minimumWalletTopUpGhs;
      if (minVal !== null && minVal !== undefined && numericValue < minVal) {
        setError("Maximum top-up cannot be less than minimum top-up.");
        return;
      }
    }

    setSaving(true);
    setError(null);

    try {
      await setNumberConfig({ key, value: numericValue });
      setSuccessKey(key);
      setEditingKey(null);
    } catch (err: any) {
      console.error("Failed to update config:", err);
      setError(err?.message || "Failed to update configuration. Make sure you are authorized.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-header-subtitle">Settings</div>
          <div className="card-header-title">Platform Configuration</div>
        </div>
      </div>

      <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        {CONFIG_METADATA.map(({ key, label, description, suffix }) => {
          const currentValue = config[key as keyof typeof config] as number | null | undefined;
          const isEditing = editingKey === key;

          return (
            <div
              key={key}
              className="config-item-row"
            >
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: 0, fontSize: "var(--font-size-base)", fontWeight: 600 }}>{label}</h4>
                <p style={{ margin: "var(--space-1) 0 0 0", fontSize: "var(--font-size-sm)", color: "var(--text-muted)" }}>
                  {description}
                </p>
                {isEditing && error && (
                  <div style={{ color: "var(--danger)", fontSize: "var(--font-size-xs)", marginTop: "var(--space-2)", fontWeight: 500 }}>
                    {error}
                  </div>
                )}
                {successKey === key && (
                  <div style={{ color: "var(--success)", fontSize: "var(--font-size-xs)", marginTop: "var(--space-2)", fontWeight: 500 }}>
                    Updated successfully!
                  </div>
                )}
              </div>

              <div className="config-item-actions">
                {isEditing ? (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
                      <input
                        type="number"
                        className="input"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        disabled={saving}
                        style={{ width: "120px", height: "36px" }}
                        autoFocus
                      />
                      {suffix && (
                        <span style={{ fontSize: "var(--font-size-sm)", color: "var(--text-muted)", marginLeft: "var(--space-1)" }}>
                          {suffix}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleSave(key)}
                      disabled={saving}
                      className="btn btn-primary"
                      style={{ height: "36px", padding: "0 var(--space-3)" }}
                    >
                      {saving ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      disabled={saving}
                      className="btn btn-ghost"
                      style={{ height: "36px", padding: "0 var(--space-3)" }}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: "var(--font-size-base)", fontWeight: 600, color: "var(--text)" }}>
                      {currentValue !== null && currentValue !== undefined
                        ? `${currentValue}${suffix ? ` ${suffix}` : ""}`
                        : "—"}
                    </span>
                    <button
                      onClick={() => handleStartEdit(key, currentValue)}
                      className="btn btn-secondary"
                      style={{ height: "32px", padding: "0 var(--space-3)" }}
                    >
                      Edit
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
