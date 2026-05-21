"use client";

import { useState } from "react";
import { usePaginatedQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { convexApi } from "@betterdata/app-api";
import { DataTable, type ColumnDef } from "../../components/DataTable";
import { SearchFilter, type FilterSpec } from "../../components/SearchFilter";
import { StatusBadge } from "../../components/StatusBadge";

// Helper types matching database schema
type OrderType = {
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

export default function AdminOrdersPage() {
  const router = useRouter();

  // Search & Filter State
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [networkFilter, setNetworkFilter] = useState("");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("");

  // Convex Paginated Query
  const queryArgs: {
    status?: string;
    network?: "mtn" | "telecel" | "airteltigo";
    paymentMethod?: "paystack_momo" | "wallet";
    search?: string;
  } = {};
  if (statusFilter) queryArgs.status = statusFilter;
  if (networkFilter) queryArgs.network = networkFilter as any;
  if (paymentMethodFilter) queryArgs.paymentMethod = paymentMethodFilter as any;
  if (search) queryArgs.search = search;

  const {
    results: orders,
    status,
    loadMore,
  } = usePaginatedQuery(
    convexApi.admin.listOrders,
    queryArgs,
    { initialNumItems: 25 }
  );

  const isLoading = status === "LoadingFirstPage";
  const isLoadingMore = status === "LoadingMore";
  const hasMore = status === "CanLoadMore";

  // Filter Specs
  const filters: FilterSpec[] = [
    {
      key: "status",
      label: "Status",
      value: statusFilter,
      onChange: setStatusFilter,
      options: [
        { value: "pending", label: "Pending" },
        { value: "processing", label: "Processing" },
        { value: "completed", label: "Completed" },
        { value: "failed", label: "Failed" },
        { value: "refunded", label: "Refunded" },
      ],
    },
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
      key: "paymentMethod",
      label: "Payment Method",
      value: paymentMethodFilter,
      onChange: setPaymentMethodFilter,
      options: [
        { value: "paystack_momo", label: "Paystack MoMo" },
        { value: "wallet", label: "Wallet" },
      ],
    },
  ];

  const handleClearFilters = () => {
    setStatusFilter("");
    setNetworkFilter("");
    setPaymentMethodFilter("");
    setSearch("");
  };

  // DataTable Columns
  const columns: ColumnDef<OrderType>[] = [
    {
      key: "reference",
      header: "Reference",
      render: (row) => (
        <span className="font-mono" style={{ fontWeight: 600, color: "var(--primary)" }}>
          {row.reference}
        </span>
      ),
    },
    {
      key: "network",
      header: "Network",
      render: (row) => (
        <span style={{ textTransform: "uppercase", fontWeight: 500 }}>{row.network}</span>
      ),
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
      key: "paymentMethod",
      header: "Payment Method",
      render: (row) => (
        <span style={{ fontSize: "var(--font-size-sm)" }}>
          {row.paymentMethod === "paystack_momo" ? "Paystack" : "Wallet"}
        </span>
      ),
    },
    {
      key: "paymentStatus",
      header: "Payment",
      render: (row) => <StatusBadge status={row.paymentStatus} />,
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "_creationTime",
      header: "Date & Time",
      render: (row) => (
        <span className="text-muted text-sm">
          {new Date(row._creationTime).toLocaleString()}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header" style={{ marginBottom: "var(--space-6)" }}>
        <div>
          <h1 className="page-title">Orders</h1>
          <p className="page-subtitle">View and manage all customer and agent data bundle orders</p>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <SearchFilter
            placeholder="Search by reference or recipient phone number..."
            search={search}
            onSearchChange={setSearch}
            filters={filters}
            onClear={handleClearFilters}
          />

          <DataTable
            columns={columns}
            data={orders as OrderType[]}
            isLoading={isLoading}
            emptyStateTitle="No orders found"
            emptyStateDescription="Try adjusting your filters or search query."
            onRowClick={(row) => router.push(`/orders/${row.reference}`)}
            rowKey={(row) => row._id}
          />

          {hasMore && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginTop: "var(--space-4)",
              }}
            >
              <button
                className="btn btn-secondary"
                disabled={isLoadingMore}
                onClick={() => loadMore(25)}
              >
                {isLoadingMore ? "Loading..." : "Load More"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
