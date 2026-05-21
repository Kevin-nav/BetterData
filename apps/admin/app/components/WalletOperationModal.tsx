"use client";

import React, { useState } from "react";
import { useMutation } from "convex/react";
import { convexApi } from "@betterdata/app-api";
import { Modal } from "./Modal";

type WalletOperationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userDisplayName?: string;
  currentBalance: number;
  onSuccess?: () => void;
};

export function WalletOperationModal({
  isOpen,
  onClose,
  userId,
  userDisplayName = "User",
  currentBalance,
  onSuccess,
}: WalletOperationModalProps) {
  const creditWallet = useMutation(convexApi.admin.creditWallet);
  const debitWallet = useMutation(convexApi.admin.debitWallet);

  // States
  const [operationType, setOperationType] = useState<"credit" | "debit">("credit");
  const [amountString, setAmountString] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Derived Values
  const amountVal = parseFloat(amountString);
  const isValidAmount = !isNaN(amountVal) && amountVal > 0;
  const newBalance =
    operationType === "credit"
      ? currentBalance + (isValidAmount ? amountVal : 0)
      : currentBalance - (isValidAmount ? amountVal : 0);

  const isFormValid = isValidAmount && notes.trim().length >= 3;

  const handleClose = () => {
    if (isSubmitting) return;
    setAmountString("");
    setNotes("");
    setError(null);
    setShowConfirmation(false);
    onClose();
  };

  const handleConfirmStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;
    if (operationType === "debit" && amountVal > currentBalance) {
      setError("Cannot debit more than the current wallet balance.");
      return;
    }
    setError(null);
    setShowConfirmation(true);
  };

  const handleSubmit = async () => {
    if (!isFormValid) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const mutationArgs = {
        userId: userId as any,
        amountGhs: amountVal,
        notes: notes.trim(),
      };

      if (operationType === "credit") {
        await creditWallet(mutationArgs);
      } else {
        await debitWallet(mutationArgs);
      }

      setAmountString("");
      setNotes("");
      setShowConfirmation(false);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Wallet operation failed:", err);
      setError(err.message || "An error occurred while performing the wallet operation.");
      setShowConfirmation(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`${operationType === "credit" ? "Credit" : "Debit"} Wallet — ${userDisplayName}`}
      footer={
        showConfirmation ? (
          <>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={isSubmitting}
              onClick={() => setShowConfirmation(false)}
            >
              Back
            </button>
            <button
              type="button"
              className={operationType === "credit" ? "btn btn-primary" : "btn btn-danger"}
              disabled={isSubmitting}
              onClick={handleSubmit}
            >
              {isSubmitting
                ? "Processing..."
                : `Confirm ${operationType === "credit" ? "Credit" : "Debit"}`}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={isSubmitting}
              onClick={handleClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!isFormValid || isSubmitting}
              onClick={handleConfirmStep}
            >
              Continue
            </button>
          </>
        )
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {error && (
          <div
            className="badge badge-danger"
            style={{
              padding: "var(--space-3)",
              borderRadius: "var(--radius-md)",
              fontSize: "var(--font-size-sm)",
              width: "100%",
            }}
          >
            {error}
          </div>
        )}

        {showConfirmation ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <p>Please confirm the following wallet adjustment:</p>
            <div
              style={{
                background: "var(--bg-inset)",
                padding: "var(--space-4)",
                borderRadius: "var(--radius-md)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-3)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="text-muted">Account:</span>
                <span style={{ fontWeight: 600 }}>{userDisplayName}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="text-muted">Operation:</span>
                <span
                  style={{
                    fontWeight: 600,
                    color: operationType === "credit" ? "var(--success)" : "var(--danger)",
                    textTransform: "capitalize",
                  }}
                >
                  {operationType}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="text-muted">Amount:</span>
                <span style={{ fontWeight: 700 }}>GHS {amountVal.toFixed(2)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="text-muted">New Balance:</span>
                <span style={{ fontWeight: 700, color: "var(--primary)" }}>
                  GHS {newBalance.toFixed(2)}
                </span>
              </div>
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: "var(--space-2)" }}>
                <span className="text-muted" style={{ display: "block", marginBottom: "var(--space-1)" }}>
                  Reason:
                </span>
                <p style={{ margin: 0, fontSize: "var(--font-size-sm)", fontStyle: "italic" }}>
                  {notes}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleConfirmStep} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            {/* Operation Selector Toggle */}
            <div className="form-group">
              <span className="form-label">Operation Type</span>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "var(--space-2)",
                  background: "var(--bg-inset)",
                  padding: "4px",
                  borderRadius: "var(--radius-md)",
                }}
              >
                <button
                  type="button"
                  onClick={() => setOperationType("credit")}
                  style={{
                    padding: "var(--space-2)",
                    borderRadius: "var(--radius-sm)",
                    border: "none",
                    fontWeight: 600,
                    cursor: "pointer",
                    background: operationType === "credit" ? "var(--bg-surface)" : "transparent",
                    color: operationType === "credit" ? "var(--success)" : "var(--text-muted)",
                    boxShadow: operationType === "credit" ? "var(--shadow-xs)" : "none",
                    transition: "all var(--transition-fast)",
                  }}
                >
                  Credit (+)
                </button>
                <button
                  type="button"
                  onClick={() => setOperationType("debit")}
                  style={{
                    padding: "var(--space-2)",
                    borderRadius: "var(--radius-sm)",
                    border: "none",
                    fontWeight: 600,
                    cursor: "pointer",
                    background: operationType === "debit" ? "var(--bg-surface)" : "transparent",
                    color: operationType === "debit" ? "var(--danger)" : "var(--text-muted)",
                    boxShadow: operationType === "debit" ? "var(--shadow-xs)" : "none",
                    transition: "all var(--transition-fast)",
                  }}
                >
                  Debit (-)
                </button>
              </div>
            </div>

            {/* Balances Info */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "var(--space-4)",
                background: "var(--bg-inset)",
                padding: "var(--space-3)",
                borderRadius: "var(--radius-md)",
                fontSize: "var(--font-size-sm)",
              }}
            >
              <div>
                <span className="text-muted" style={{ display: "block", fontSize: "var(--font-size-xs)" }}>
                  Current Balance
                </span>
                <strong>GHS {currentBalance.toFixed(2)}</strong>
              </div>
              <div>
                <span className="text-muted" style={{ display: "block", fontSize: "var(--font-size-xs)" }}>
                  Preview Balance
                </span>
                <strong style={{ color: "var(--primary)" }}>
                  GHS {newBalance.toFixed(2)}
                </strong>
              </div>
            </div>

            {/* Amount Input */}
            <div className="form-group">
              <label className="form-label" htmlFor="amount">
                Amount (GHS)
              </label>
              <input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                className="input"
                placeholder="0.00"
                value={amountString}
                onChange={(e) => setAmountString(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            {/* Notes / Reason Input */}
            <div className="form-group">
              <label className="form-label" htmlFor="reason">
                Reason / Explanation (Mandatory)
              </label>
              <textarea
                id="reason"
                className="textarea"
                rows={3}
                required
                placeholder="Provide a detailed reason for this adjustment (minimum 3 characters)..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isSubmitting}
              />
              <span className="text-muted" style={{ fontSize: "var(--font-size-xs)", marginTop: "2px", display: "block" }}>
                This action is audited and will be logged permanently.
              </span>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
