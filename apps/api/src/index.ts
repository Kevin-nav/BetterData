import { Readable } from "node:stream";

import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";

import { isOriginAllowed } from "./config/origins";
import { resolveRateLimitConfig } from "./config/rateLimits";
import { registerAdminRoutes } from "./modules/admin/admin.routes";
import { registerAuthRoutes } from "./modules/auth/auth.routes";
import { registerHealthRoutes } from "./modules/health/health.routes";
import { registerVendorSimulationRoutes } from "./modules/dev/vendor-simulation.routes";
import { registerOrderRoutes } from "./modules/orders/orders.routes";
import { registerPackageRoutes } from "./modules/packages/packages.routes";
import { registerPaymentRoutes } from "./modules/payments/payments.routes";
import { registerSavedNumberRoutes } from "./modules/saved-numbers/savedNumbers.routes";
import { registerWalletRoutes } from "./modules/wallet/wallet.routes";
import { registerNotificationRoutes } from "./modules/notifications/notifications.routes";
import { configureMetricsFromEnv } from "./observability/metrics";
import { emitAppTelemetry } from "./telemetry/appTelemetry";
import { setupTelemetry, shutdownTelemetry } from "./telemetry/setup";

await setupTelemetry({ serviceName: "betterdata-api" });
emitAppTelemetry({
  name: "app.startup",
  attributes: {
    "service.name": "betterdata-api",
    "deployment.environment": process.env.NODE_ENV ?? "unknown"
  }
});

const server = Fastify({
  logger: true
});
const rateLimits = resolveRateLimitConfig();
configureMetricsFromEnv();

await server.register(helmet);
await server.register(cors, {
  origin: (origin, callback) => {
    callback(null, isOriginAllowed(origin));
  }
});
await server.register(rateLimit, {
  global: true,
  max: rateLimits.global.max,
  timeWindow: rateLimits.global.timeWindow,
  errorResponseBuilder: () => ({
    message: "Too many requests. Try again shortly."
  })
});
server.addHook("preParsing", async (request, _reply, payload) => {
  const config = request.routeOptions.config as { rawBody?: boolean } | undefined;

  if (config?.rawBody !== true) {
    return payload;
  }

  const chunks: Buffer[] = [];

  for await (const chunk of payload) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const rawBody = Buffer.concat(chunks);
  (request as typeof request & { rawBody?: Buffer }).rawBody = rawBody;
  const replay = Readable.from(rawBody) as Readable & {
    receivedEncodedLength?: number;
  };
  replay.receivedEncodedLength = rawBody.length;

  return replay;
});

await registerHealthRoutes(server);
await registerAuthRoutes(server);
await registerPackageRoutes(server);
await registerOrderRoutes(server);
await registerPaymentRoutes(server);
await registerSavedNumberRoutes(server);
await registerWalletRoutes(server);
await registerNotificationRoutes(server);
await registerAdminRoutes(server);
await registerVendorSimulationRoutes(server);

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "0.0.0.0";

const shutdown = async () => {
  await server.close();
  await shutdownTelemetry();
};

process.once("SIGINT", () => {
  void shutdown().then(() => process.exit(0));
});

process.once("SIGTERM", () => {
  void shutdown().then(() => process.exit(0));
});

await server.listen({ port, host });
