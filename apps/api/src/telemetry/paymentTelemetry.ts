import { trace } from "@opentelemetry/api";

import { hashForTelemetry } from "./hash";

const tracer = trace.getTracer("betterdata-payments");

export type PaymentTelemetryEvent = {
  name: string;
  paymentReference?: string;
  purpose?: string;
  status?: string;
  amountGhs?: number;
  amountPesewas?: number;
  currency?: string;
  vendorId?: string;
  vendorOrderReference?: string;
  userId?: string;
  recipientPhone?: string;
  payerPhone?: string;
  errorCode?: string;
  errorMessage?: string;
};

export function emitPaymentTelemetry(event: PaymentTelemetryEvent) {
  tracer.startActiveSpan(event.name, (span) => {
    addString(span, "payment.reference", event.paymentReference);
    addString(span, "payment.purpose", event.purpose);
    addString(span, "payment.status", event.status);
    addNumber(span, "payment.amount_ghs", event.amountGhs);
    addNumber(span, "payment.amount_pesewas", event.amountPesewas);
    addString(span, "payment.currency", event.currency);
    addString(span, "vendor.id", event.vendorId);
    addString(span, "vendor.order_reference", event.vendorOrderReference);
    addString(span, "user.hash", hashForTelemetry(event.userId));
    addString(span, "recipient_phone.hash", hashForTelemetry(event.recipientPhone));
    addString(span, "payer_phone.hash", hashForTelemetry(event.payerPhone));
    addString(span, "error.code", event.errorCode);
    addString(span, "error.message", event.errorMessage);
    span.end();
  });
}

function addString(span: { setAttribute(name: string, value: string): void }, name: string, value: string | undefined) {
  if (value !== undefined) {
    span.setAttribute(name, value);
  }
}

function addNumber(span: { setAttribute(name: string, value: number): void }, name: string, value: number | undefined) {
  if (value !== undefined) {
    span.setAttribute(name, value);
  }
}
