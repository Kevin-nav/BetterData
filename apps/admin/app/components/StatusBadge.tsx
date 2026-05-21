const STATUS_CLASSES: Record<string, string> = {
  completed: "badge status-completed",
  processing: "badge status-processing",
  pending: "badge status-pending",
  failed: "badge status-failed",
  refunded: "badge status-refunded",
  verified: "badge status-verified",
  initialized: "badge status-initialized",
  abandoned: "badge status-abandoned",

  // Ops alert severities
  info: "badge badge-info",
  warning: "badge badge-warning",
  critical: "badge badge-danger",

  // Agent application statuses
  approved: "badge badge-success",
  rejected: "badge badge-danger",

  // Generic
  success: "badge badge-success",
  neutral: "badge badge-neutral",
};

export function StatusBadge({
  status,
  label,
}: {
  status: string;
  label?: string;
}) {
  const className = STATUS_CLASSES[status] ?? "badge badge-neutral";
  return <span className={className}>{label ?? status}</span>;
}
