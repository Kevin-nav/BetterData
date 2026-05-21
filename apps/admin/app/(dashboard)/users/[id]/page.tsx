"use client";

import { use, useState } from "react";
import { useQuery, useMutation, usePaginatedQuery } from "convex/react";
import Link from "next/link";
import { convexApi } from "@betterdata/app-api";
import { useAdminAuth } from "../../../lib/auth";
import { StatusBadge } from "../../../components/StatusBadge";
import { Modal } from "../../../components/Modal";
import { DataTable, type ColumnDef } from "../../../components/DataTable";
import { WalletOperationModal } from "../../../components/WalletOperationModal";
import { useToast } from "../../../components/Toast";

type UserDetailPageProps = {
  params: Promise<{ id: string }>;
};

type WalletTxRow = {
  _id: string;
  type: "top_up" | "purchase" | "refund" | "admin_credit" | "admin_debit";
  amountGhs: number;
  reference: string;
  notes?: string;
  _creationTime: number;
};

type OrderRow = {
  _id: string;
  reference: string;
  network: "mtn" | "telecel" | "airteltigo";
  recipientPhone: string;
  amountGhs: number;
  paymentMethod: "paystack_momo" | "wallet";
  paymentStatus: "pending" | "verified" | "failed" | "refunded";
  status: "pending" | "processing" | "completed" | "failed" | "refunded";
  _creationTime: number;
};

type SavedNumberRow = {
  _id: string;
  label: string;
  phone: string;
  network?: "mtn" | "telecel" | "airteltigo";
};

export default function UserDetailPage({ params }: UserDetailPageProps) {
  const { id } = use(params);
  const auth = useAdminAuth();
  const { showToast } = useToast();

  // Queries
  const user = useQuery(convexApi.admin.getUser, { userId: id as any });
  const orders = useQuery(convexApi.admin.getUserOrders, { userId: id as any });
  const savedNumbers = useQuery(convexApi.admin.getUserSavedNumbers, { userId: id as any });

  const {
    results: transactions,
    status: txStatus,
    loadMore: loadMoreTx,
  } = usePaginatedQuery(
    convexApi.admin.listWalletTransactions,
    { userId: id as any },
    { initialNumItems: 10 }
  );

  // Mutations
  const suspendUser = useMutation(convexApi.admin.suspendUser);
  const unsuspendUser = useMutation(convexApi.admin.unsuspendUser);
  const promoteToAdmin = useMutation(convexApi.admin.promoteToAdmin);
  const demoteFromAdmin = useMutation(convexApi.admin.demoteFromAdmin);

  // UI States
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isSuspendModalOpen, setIsSuspendModalOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [actionRole, setActionRole] = useState<"promote" | "demote" | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  if (user === undefined) {
    return (
      <div style={{ padding: "var(--space-6)" }}>
        <div className="skeleton skeleton-heading" style={{ marginBottom: "var(--space-4)" }} />
        <div className="skeleton skeleton-card" style={{ height: "300px" }} />
      </div>
    );
  }

  if (user === null) {
    return (
      <div className="card" style={{ padding: "var(--space-6)", textAlign: "center" }}>
        <h2 className="card-header-title" style={{ color: "var(--danger)" }}>User Not Found</h2>
        <p className="text-muted" style={{ margin: "var(--space-4) 0" }}>
          We couldn't find a user with ID: <strong>{id}</strong>
        </p>
        <Link href="/users" className="btn btn-secondary">
          Back to Users
        </Link>
      </div>
    );
  }

  const isSuperadmin = auth.scope === "superadmin";
  const userHasAdminAccess = user.role === "admin" || user.role === "superadmin";

  const handleSuspendToggle = async () => {
    setIsSubmitting(true);
    try {
      if (user.isSuspended) {
        await unsuspendUser({ userId: user._id });
        showToast("User has been successfully reactivated.", "success");
      } else {
        await suspendUser({ userId: user._id });
        showToast("User has been successfully suspended.", "success");
      }
      setIsSuspendModalOpen(false);
    } catch (err: any) {
      console.error("Suspend toggle failed:", err);
      showToast(err.message || "Failed to update suspension status.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRoleChange = async () => {
    if (!actionRole) return;
    setIsSubmitting(true);
    try {
      if (actionRole === "promote") {
        await promoteToAdmin({ userId: user._id });
        showToast("User has been successfully promoted to Admin.", "success");
      } else {
        await demoteFromAdmin({ userId: user._id });
        showToast("User has been demoted to standard user role.", "success");
      }
      setIsRoleModalOpen(false);
      setActionRole(null);
    } catch (err: any) {
      console.error("Role change failed:", err);
      showToast(err.message || "Failed to change user role.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Columns for Wallet Transactions
  const txColumns: ColumnDef<WalletTxRow>[] = [
    {
      key: "type",
      header: "Type",
      render: (row) => {
        const labels: Record<string, string> = {
          top_up: "Top Up",
          purchase: "Bundle Purchase",
          refund: "Refund Credit",
          admin_credit: "Admin Credit",
          admin_debit: "Admin Debit",
        };
        const statusMap: Record<string, string> = {
          top_up: "verified",
          purchase: "neutral",
          refund: "completed",
          admin_credit: "completed",
          admin_debit: "failed",
        };
        return <StatusBadge status={statusMap[row.type] || "neutral"} label={labels[row.type] || row.type} />;
      },
    },
    {
      key: "amountGhs",
      header: "Amount",
      render: (row) => {
        const isDeduction = row.type === "purchase" || row.type === "admin_debit";
        return (
          <span style={{ color: isDeduction ? "var(--danger)" : "var(--success)", fontWeight: 700 }}>
            {isDeduction ? "-" : "+"} GHS {row.amountGhs.toFixed(2)}
          </span>
        );
      },
    },
    {
      key: "reference",
      header: "Reference",
      render: (row) => <span className="font-mono text-sm">{row.reference}</span>,
    },
    {
      key: "notes",
      header: "Notes",
      render: (row) => <span className="text-muted text-sm">{row.notes || "—"}</span>,
    },
    {
      key: "_creationTime",
      header: "Date & Time",
      render: (row) => (
        <span className="text-muted text-sm">{new Date(row._creationTime).toLocaleString()}</span>
      ),
    },
  ];

  // Columns for Orders
  const orderColumns: ColumnDef<OrderRow>[] = [
    {
      key: "reference",
      header: "Reference",
      render: (row) => (
        <Link href={`/orders/${row.reference}`} className="font-mono" style={{ fontWeight: 600, color: "var(--primary)" }}>
          {row.reference}
        </Link>
      ),
    },
    {
      key: "network",
      header: "Network",
      render: (row) => <span style={{ textTransform: "uppercase", fontWeight: 500 }}>{row.network}</span>,
    },
    {
      key: "recipientPhone",
      header: "Recipient",
      render: (row) => <span className="font-mono">{row.recipientPhone}</span>,
    },
    {
      key: "amountGhs",
      header: "Amount",
      render: (row) => <strong>GHS {row.amountGhs.toFixed(2)}</strong>,
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "_creationTime",
      header: "Date",
      render: (row) => (
        <span className="text-muted text-sm">{new Date(row._creationTime).toLocaleDateString()}</span>
      ),
    },
  ];

  const hasMoreTx = txStatus === "CanLoadMore";
  const isLoadingMoreTx = txStatus === "LoadingMore";

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "var(--space-6)",
        }}
      >
        <div>
          <div style={{ marginBottom: "var(--space-2)" }}>
            <Link href="/users" className="btn btn-secondary btn-sm" style={{ paddingLeft: 0, border: "none", background: "none" }}>
              &larr; Back to Users
            </Link>
          </div>
          <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            {user.displayName || "User details"}
            <span className="font-mono text-muted text-sm" style={{ fontWeight: "normal" }}>
              #{user._id}
            </span>
          </h1>
        </div>

        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          {/* Superadmin actions */}
          {isSuperadmin && (
            <>
              {!userHasAdminAccess ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setActionRole("promote");
                    setIsRoleModalOpen(true);
                  }}
                >
                  Promote to Admin
                </button>
              ) : user.role === "admin" ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setActionRole("demote");
                    setIsRoleModalOpen(true);
                  }}
                >
                  Demote Admin
                </button>
              ) : (
                <button type="button" className="btn btn-secondary" disabled>
                  Superadmin Protected
                </button>
              )}
            </>
          )}

          <button
            type="button"
            className={user.isSuspended ? "btn btn-primary" : "btn btn-danger"}
            onClick={() => setIsSuspendModalOpen(true)}
          >
            {user.isSuspended ? "Reactivate User" : "Suspend User"}
          </button>
        </div>
      </div>



      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "var(--space-6)", alignItems: "start" }}>
        {/* Left Column: User details */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          {/* Card: Account details */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-header-title">Account Details</h2>
            </div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              <div>
                <span className="text-muted text-sm" style={{ display: "block" }}>Display Name</span>
                <strong style={{ fontSize: "var(--font-size-base)" }}>{user.displayName || "N/A"}</strong>
              </div>
              <div>
                <span className="text-muted text-sm" style={{ display: "block" }}>Email</span>
                <span>{user.email || "N/A"}</span>
              </div>
              <div>
                <span className="text-muted text-sm" style={{ display: "block" }}>Phone Number</span>
                <span className="font-mono">{user.phone || "N/A"}</span>
              </div>
              <div>
                <span className="text-muted text-sm" style={{ display: "block" }}>Role</span>
                <span
                  className="badge"
                  style={{
                    textTransform: "capitalize",
                    fontWeight: 600,
                    background: userHasAdminAccess ? "var(--danger-light)" : user.role === "agent" ? "var(--primary-light)" : "var(--bg-inset)",
                    color: userHasAdminAccess ? "var(--danger)" : user.role === "agent" ? "var(--primary)" : "var(--text-secondary)",
                  }}
                >
                  {user.role}
                </span>
              </div>
              <div>
                <span className="text-muted text-sm" style={{ display: "block" }}>Firebase UID</span>
                <span className="font-mono text-xs text-muted" style={{ wordBreak: "break-all" }}>{user.firebaseUid || "N/A"}</span>
              </div>
              <div>
                <span className="text-muted text-sm" style={{ display: "block" }}>Status</span>
                <StatusBadge
                  status={user.isSuspended ? "failed" : "completed"}
                  label={user.isSuspended ? "Suspended" : "Active"}
                />
              </div>
              <div>
                <span className="text-muted text-sm" style={{ display: "block" }}>First Purchase Discount Used</span>
                <span>{user.firstPurchaseDiscountUsed ? "Yes" : "No"}</span>
              </div>
              {user.deviceFingerprint && (
                <div>
                  <span className="text-muted text-sm" style={{ display: "block" }}>Device Fingerprint</span>
                  <span className="font-mono text-xs text-muted" style={{ wordBreak: "break-all" }}>{user.deviceFingerprint}</span>
                </div>
              )}
              <div>
                <span className="text-muted text-sm" style={{ display: "block" }}>Joined</span>
                <span className="text-muted">{new Date(user._creationTime).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Card: Wallet balance */}
          <div className="card">
            <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 className="card-header-title">Wallet</h2>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setIsWalletModalOpen(true)}
              >
                Adjust Balance
              </button>
            </div>
            <div className="card-body">
              <span className="text-muted text-sm" style={{ display: "block", marginBottom: "var(--space-1)" }}>Current Balance</span>
              <div style={{ fontSize: "var(--font-size-3xl)", fontWeight: 800, color: "var(--primary)" }}>
                GHS {user.walletBalanceGhs.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Card: Saved Numbers */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-header-title">Saved Numbers ({savedNumbers?.length || 0})</h2>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              {!savedNumbers || savedNumbers.length === 0 ? (
                <div style={{ padding: "var(--space-4)", textAlign: "center" }} className="text-muted italic">
                  No saved numbers found.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {savedNumbers.map((num) => (
                    <div
                      key={num._id}
                      style={{
                        padding: "var(--space-3) var(--space-4)",
                        borderBottom: "1px solid var(--border)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "var(--font-size-sm)" }}>{num.label}</div>
                        <div className="font-mono text-xs text-muted">{num.phone}</div>
                      </div>
                      {num.network && (
                        <span
                          className="badge font-mono"
                          style={{
                            textTransform: "uppercase",
                            fontSize: "10px",
                          }}
                        >
                          {num.network}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Transactions & Order History */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          {/* Wallet Transaction History */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-header-title">Wallet Transactions</h2>
            </div>
            <div className="card-body">
              <DataTable
                columns={txColumns}
                data={transactions as WalletTxRow[]}
                isLoading={txStatus === "LoadingFirstPage"}
                emptyStateTitle="No transactions"
                emptyStateDescription="This user has no wallet transactions yet."
                rowKey={(row) => row._id}
              />

              {hasMoreTx && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    marginTop: "var(--space-4)",
                  }}
                >
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={isLoadingMoreTx}
                    onClick={() => loadMoreTx(10)}
                  >
                    {isLoadingMoreTx ? "Loading..." : "Load More"}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* User Orders */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-header-title">Purchase History ({orders?.length || 0})</h2>
            </div>
            <div className="card-body">
              <DataTable
                columns={orderColumns}
                data={orders as OrderRow[]}
                isLoading={orders === undefined}
                emptyStateTitle="No orders"
                emptyStateDescription="This user has not placed any orders yet."
                rowKey={(row) => row._id}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Wallet Operation Modal */}
      <WalletOperationModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        userId={user._id}
        userDisplayName={user.displayName || "User"}
        currentBalance={user.walletBalanceGhs}
        onSuccess={() => {
          showToast("Wallet balance adjusted successfully.", "success");
        }}
      />

      {/* Suspend Confirmation Modal */}
      <Modal
        isOpen={isSuspendModalOpen}
        onClose={() => {
          if (!isSubmitting) setIsSuspendModalOpen(false);
        }}
        title={user.isSuspended ? "Reactivate account" : "Suspend account"}
        footer={
          <>
            <button
              className="btn btn-secondary"
              disabled={isSubmitting}
              onClick={() => setIsSuspendModalOpen(false)}
            >
              Cancel
            </button>
            <button
              className={user.isSuspended ? "btn btn-primary" : "btn btn-danger"}
              disabled={isSubmitting}
              onClick={handleSuspendToggle}
            >
              {isSubmitting ? "Updating..." : user.isSuspended ? "Confirm Reactivation" : "Confirm Suspension"}
            </button>
          </>
        }
      >
        <p>
          Are you sure you want to {user.isSuspended ? "reactivate" : "suspend"}{" "}
          <strong>{user.displayName || "this user"}</strong> ({user.email || "no email"})?
        </p>
        {!user.isSuspended && (
          <p className="text-muted" style={{ fontSize: "var(--font-size-sm)", marginTop: "var(--space-2)" }}>
            Suspended users cannot log in, check out bundles, or perform any operations on the platform.
          </p>
        )}
      </Modal>

      {/* Role Management Confirmation Modal (Superadmin Only) */}
      <Modal
        isOpen={isRoleModalOpen}
        onClose={() => {
          if (!isSubmitting) {
            setIsRoleModalOpen(false);
            setActionRole(null);
          }
        }}
        title={actionRole === "promote" ? "Promote User to Admin" : "Demote Admin User"}
        footer={
          <>
            <button
              className="btn btn-secondary"
              disabled={isSubmitting}
              onClick={() => {
                setIsRoleModalOpen(false);
                setActionRole(null);
              }}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              disabled={isSubmitting}
              onClick={handleRoleChange}
            >
              {isSubmitting ? "Updating..." : "Confirm Action"}
            </button>
          </>
        }
      >
        {actionRole === "promote" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <p>
              Are you sure you want to promote <strong>{user.displayName || "this user"}</strong> to <strong>Admin</strong>?
            </p>
            <p className="text-muted" style={{ fontSize: "var(--font-size-sm)" }}>
              Admin users have write and management capabilities across the control panel, including managing pricing, refunding orders, and viewing audit logs.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <p>
              Are you sure you want to demote admin <strong>{user.displayName || "this user"}</strong> back to a regular user?
            </p>
            <p className="text-muted" style={{ fontSize: "var(--font-size-sm)" }}>
              This will strip the user of all admin capabilities immediately.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
