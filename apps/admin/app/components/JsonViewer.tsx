"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";

export type JsonViewerProps = {
  /** Any JSON-serializable value: objects, arrays, primitives, null, undefined. */
  value: unknown;
  /** Max height of the scrollable pre block in px. Default 320. */
  maxHeight?: number;
  /** Optional label rendered above the pre block. */
  label?: string;
};

export function JsonViewer({ value, maxHeight = 320, label }: JsonViewerProps) {
  const [copied, setCopied] = React.useState(false);

  const text = React.useMemo(() => safeStringify(value), [value]);
  const isCopyable = text !== null;

  const handleCopy = React.useCallback(async () => {
    if (text === null) return;
    const succeeded = await copyToClipboard(text);
    if (succeeded) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }
  }, [text]);

  return (
    <div className="w-full">
      <div className="mb-1 flex items-center justify-between gap-2">
        {label ? (
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
        ) : (
          <span />
        )}
        {isCopyable ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={() => {
              void handleCopy();
            }}
            aria-label={copied ? "Copied" : "Copy JSON"}
          >
            {copied ? (
              <Check className="size-3.5 text-[var(--success)]" aria-hidden="true" />
            ) : (
              <Copy className="size-3.5" aria-hidden="true" />
            )}
            <span className="text-xs">{copied ? "Copied" : "Copy"}</span>
          </Button>
        ) : null}
      </div>
      <pre
        className="overflow-auto rounded-md border border-border bg-muted/50 p-3 text-xs leading-relaxed"
        style={{
          fontFamily: "var(--font-mono)",
          maxHeight,
        }}
      >
        {text ?? String(value)}
      </pre>
    </div>
  );
}

/** JSON.stringify with stable key order and indentation; returns null when the value cannot be stringified (falls back to String()). */
function safeStringify(value: unknown): string | null {
  if (value === undefined) return "undefined";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    try {
      return String(value);
    } catch {
      return null;
    }
  }
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to legacy path below.
  }

  try {
    if (
      typeof document !== "undefined" &&
      typeof document.execCommand === "function"
    ) {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      return ok;
    }
  } catch {
    return false;
  }

  return false;
}
