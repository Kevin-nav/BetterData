import { SpanStatusCode, trace } from "@opentelemetry/api";

import { hashForTelemetry } from "./hash";

const tracer = trace.getTracer("betterdata-app");

export type AppTelemetryEvent = {
  name: string;
  attributes?: Record<string, string | number | boolean | undefined>;
  error?: unknown;
  userId?: string;
  recipientPhone?: string;
};

export function emitAppTelemetry(event: AppTelemetryEvent) {
  try {
    tracer.startActiveSpan(event.name, (span) => {
      for (const [key, value] of Object.entries(event.attributes ?? {})) {
        if (value !== undefined) {
          span.setAttribute(key, value);
        }
      }

      addString(span, "user.hash", safeHashForTelemetry(event.userId));
      addString(span, "recipient_phone.hash", safeHashForTelemetry(event.recipientPhone));

      if (event.error !== undefined) {
        span.recordException(toError(event.error));
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: event.error instanceof Error ? event.error.message : String(event.error)
        });
      }

      span.end();
    });
  } catch {
    // Observability must never interrupt payment or fulfillment flows.
  }
}

function addString(span: { setAttribute(name: string, value: string): void }, name: string, value: string | undefined) {
  if (value !== undefined) {
    span.setAttribute(name, value);
  }
}

function toError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error));
}

function safeHashForTelemetry(value: string | undefined) {
  try {
    return hashForTelemetry(value);
  } catch {
    return undefined;
  }
}
