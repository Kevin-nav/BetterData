"use client";

import * as React from "react";
import { AlertCircle, RotateCw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Distinguishes loading / error / empty states for a Convex `useQuery` result.
 *
 * In Convex react hooks, `undefined` means "still loading", so pass the raw
 * hook return as `result` (or its alias `queryResult`). Render-time throws
 * (including Convex errors) are NOT caught by this component — wrap the tree
 * in {@link ConvexQueryErrorBoundary}, exported from this same module.
 *
 * Usage:
 * ```tsx
 * const data = useQuery(convexApi.admin.listAgents);
 * return (
 *   <ConvexQueryBoundary result={data} isEmpty={(d) => d.length === 0}>
 *     {(agents) => <AgentList agents={agents} />}
 *   </ConvexQueryBoundary>
 * );
 * ```
 */
export type ConvexQueryBoundaryProps = {
  /** Possibly-undefined return value of a Convex `useQuery(...)`. */
  result?: unknown;
  /** Alias for `result`, matching the hook-result naming used elsewhere. */
  queryResult?: unknown;
  /**
   * Explicit error to render instead of children. Render-time throws are
   * handled separately by ConvexQueryErrorBoundary.
   */
  error?: unknown;
  /** Render callback receiving the resolved (non-loading) data. */
  children: (data: unknown) => React.ReactNode;
  /** Return true when the loaded data counts as empty. */
  isEmpty?: (data: unknown) => boolean;
  /** Minimum height applied to whichever state is rendered (px). */
  minHeight?: number;
  /** Number of skeleton rows shown while loading. Default 3. */
  skeletonRows?: number;
  /** Heading used for the error state. */
  errorMessage?: string;
  /** Message shown when `isEmpty` returns true. */
  emptyMessage?: string;
};

const SKELETON_WIDTHS = ["w-full", "w-11/12", "w-10/12", "w-9/12", "w-full", "w-8/12"] as const;

export function ConvexQueryBoundary({
  result,
  queryResult,
  error,
  children,
  isEmpty,
  minHeight,
  skeletonRows = 3,
  errorMessage,
  emptyMessage = "No records found.",
}: ConvexQueryBoundaryProps) {
  const data = result !== undefined ? result : queryResult;

  if (error !== undefined) {
    return (
      <QueryStateShell minHeight={minHeight}>
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>{errorMessage ?? "Failed to load"}</AlertTitle>
          {hasErrorDetail(error) ? (
            <AlertDescription>{describeError(error)}</AlertDescription>
          ) : null}
        </Alert>
      </QueryStateShell>
    );
  }

  if (data === undefined) {
    return (
      <QueryStateShell minHeight={minHeight}>
        <LoadingSkeleton rows={skeletonRows} />
      </QueryStateShell>
    );
  }

  if (isEmpty?.(data)) {
    return (
      <QueryStateShell minHeight={minHeight}>
        <div className="flex items-center justify-center rounded-md border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      </QueryStateShell>
    );
  }

  return <QueryStateShell minHeight={minHeight}>{children(data)}</QueryStateShell>;
}

function QueryStateShell({
  minHeight,
  children,
}: {
  minHeight?: number | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full" style={minHeight !== undefined ? { minHeight } : undefined}>
      {children}
    </div>
  );
}

function LoadingSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-2 py-1" aria-hidden="true">
      {Array.from({ length: Math.max(rows, 1) }, (_, index) => (
        <Skeleton key={index} className={`h-4 ${SKELETON_WIDTHS[index % SKELETON_WIDTHS.length]}`} />
      ))}
    </div>
  );
}

function hasErrorDetail(error: unknown): boolean {
  if (error === null || error === undefined) return false;
  if (typeof error === "string") return error.length > 0;
  return true;
}

function describeError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return "An unexpected error occurred while loading data.";
}

type ConvexQueryErrorBoundaryProps = {
  children: React.ReactNode;
  /** Heading for the inline error alert. */
  errorMessage?: string;
  /** Called after the Retry button resets the boundary (e.g. refetch triggers). */
  onRetry?: () => void;
};

type ConvexQueryErrorBoundaryState = {
  hasError: boolean;
  error: unknown;
  /** Incremented on retry; used as a key to remount the subtree. */
  resetKey: number;
};

/**
 * Catches render-time throws from the subtree — including errors thrown by
 * Convex react hooks while reading query results — and renders an inline
 * destructive alert with a Retry button instead of crashing the page.
 *
 * Wrap page sections (not individual fields):
 * ```tsx
 * <ConvexQueryErrorBoundary errorMessage="Could not load agents">
 *   <AgentsSection />
 * </ConvexQueryErrorBoundary>
 * ```
 */
export class ConvexQueryErrorBoundary extends React.Component<
  ConvexQueryErrorBoundaryProps,
  ConvexQueryErrorBoundaryState
> {
  override state: ConvexQueryErrorBoundaryState = {
    hasError: false,
    error: undefined,
    resetKey: 0,
  };

  static getDerivedStateFromError(error: unknown): Partial<ConvexQueryErrorBoundaryState> {
    return { hasError: true, error };
  }

  override componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    console.error("[ConvexQueryErrorBoundary]", error, info.componentStack);
  }

  private readonly handleRetry = (): void => {
    this.props.onRetry?.();
    this.setState((prev) => ({ hasError: false, error: undefined, resetKey: prev.resetKey + 1 }));
  };

  override render(): React.ReactNode {
    if (!this.state.hasError) {
      // Keying on resetKey remounts the subtree after a retry so hooks run again.
      return <React.Fragment key={this.state.resetKey}>{this.props.children}</React.Fragment>;
    }

    const message = this.props.errorMessage ?? "Something went wrong";

    return (
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>{message}</AlertTitle>
        <AlertDescription>
          <p className="break-words">{describeError(this.state.error)}</p>
          <Button variant="outline" size="sm" onClick={this.handleRetry}>
            <RotateCw aria-hidden="true" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
}
