import { getRequiredEnv } from "@betterdata/config";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

let sdk: NodeSDK | null = null;

export async function setupTelemetry() {
  if (!shouldEnableTelemetry()) {
    return;
  }

  getRequiredEnv("TELEMETRY_HASH_SECRET");

  const exporter = new OTLPTraceExporter({
    url: process.env.HONEYCOMB_OTLP_ENDPOINT ?? "https://api.honeycomb.io/v1/traces",
    headers: {
      "x-honeycomb-team": getRequiredEnv("HONEYCOMB_API_KEY"),
      "x-honeycomb-dataset": process.env.HONEYCOMB_DATASET ?? "betterdata-api"
    }
  });

  sdk = new NodeSDK({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: "betterdata-api"
    }),
    traceExporter: exporter
  });

  await sdk.start();
}

export async function shutdownTelemetry() {
  await sdk?.shutdown();
  sdk = null;
}

function shouldEnableTelemetry() {
  return process.env.NODE_ENV !== "development" && Boolean(process.env.HONEYCOMB_API_KEY);
}
