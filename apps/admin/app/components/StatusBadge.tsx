import React from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_VARIANTS: Record<
  string,
  React.ComponentProps<typeof Badge>["variant"]
> = {
  // Order / payment / email statuses
  completed: "success",
  verified: "success",
  processing: "info",
  pending: "warning",
  failed: "destructive",
  refunded: "destructive",
  initialized: "outline",
  abandoned: "outline",

  // Ops alert severities
  info: "info",
  warning: "warning",
  critical: "destructive",

  // Agent application statuses
  approved: "success",
  rejected: "destructive",

  // Generic
  success: "success",
  neutral: "outline",
};

export function StatusBadge({
  status,
  label,
}: {
  status: string;
  label?: string;
}) {
  const variant = STATUS_VARIANTS[status] ?? "outline";
  return (
    <Badge
      variant={variant}
      className={cn(variant === "outline" && "bg-muted text-muted-foreground")}
    >
      {label ?? status}
    </Badge>
  );
}
