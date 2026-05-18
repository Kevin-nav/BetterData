import { opsAlertFunctions, platformConfigFunctions } from "@betterdata/app-api";
import { getRequiredEnv } from "@betterdata/config";
import { ConvexHttpClient } from "convex/browser";
import type { FastifyInstance } from "fastify";

export async function registerAdminRoutes(server: FastifyInstance) {
  server.get("/admin/overview", async () => ({
    revenue: { dailyGhs: 0, weeklyGhs: 0, monthlyGhs: 0 },
    vendorBalanceGhs: 0,
    pendingAgentApplications: 0
  }));

  server.get("/admin/payment-ops", async (request, reply) => {
    const provided = request.headers["x-betterdata-service-secret"];

    if (
      Array.isArray(provided) ||
      provided !== getRequiredEnv("BETTERDATA_SERVICE_SECRET")
    ) {
      return reply.code(401).send({ message: "Unauthorized." });
    }

    const convex = new ConvexHttpClient(getRequiredEnv("CONVEX_URL"));
    const [config, alerts] = await Promise.all([
      convex.query(platformConfigFunctions.listPaymentConfig, {}),
      convex.query(opsAlertFunctions.listOpen, {
        serviceSecret: getRequiredEnv("BETTERDATA_SERVICE_SECRET")
      })
    ]);

    return {
      config,
      alerts
    };
  });

  server.patch<{
    Body: { key: string; value: number };
  }>("/admin/payment-config", async (request, reply) => {
    if (!isAuthorizedServiceRequest(request.headers)) {
      return reply.code(401).send({ message: "Unauthorized." });
    }

    if (!isPaymentConfigKey(request.body.key) || !Number.isFinite(request.body.value)) {
      return reply.code(400).send({ message: "Invalid payment config." });
    }

    const convex = new ConvexHttpClient(getRequiredEnv("CONVEX_URL"));
    await convex.mutation(platformConfigFunctions.setNumberConfigByService, {
      serviceSecret: getRequiredEnv("BETTERDATA_SERVICE_SECRET"),
      key: request.body.key,
      value: request.body.value
    });

    return { updated: true };
  });

  server.post<{ Params: { alertId: string } }>(
    "/admin/ops-alerts/:alertId/acknowledge",
    async (request, reply) => {
      if (!isAuthorizedServiceRequest(request.headers)) {
        return reply.code(401).send({ message: "Unauthorized." });
      }

      const convex = new ConvexHttpClient(getRequiredEnv("CONVEX_URL"));
      await convex.mutation(opsAlertFunctions.acknowledge, {
        serviceSecret: getRequiredEnv("BETTERDATA_SERVICE_SECRET"),
        alertId: request.params.alertId
      });

      return { updated: true };
    }
  );

  server.post<{ Params: { alertId: string } }>(
    "/admin/ops-alerts/:alertId/resolve",
    async (request, reply) => {
      if (!isAuthorizedServiceRequest(request.headers)) {
        return reply.code(401).send({ message: "Unauthorized." });
      }

      const convex = new ConvexHttpClient(getRequiredEnv("CONVEX_URL"));
      await convex.mutation(opsAlertFunctions.resolve, {
        serviceSecret: getRequiredEnv("BETTERDATA_SERVICE_SECRET"),
        alertId: request.params.alertId
      });

      return { updated: true };
    }
  );
}

function isAuthorizedServiceRequest(headers: Record<string, string | string[] | undefined>) {
  const provided = headers["x-betterdata-service-secret"];
  return !Array.isArray(provided) && provided === getRequiredEnv("BETTERDATA_SERVICE_SECRET");
}

function isPaymentConfigKey(value: string) {
  return (
    value === "minimumWalletTopUpGhs" ||
    value === "maximumWalletTopUpGhs" ||
    value === "agentOnboardingFeeGhs" ||
    value === "firstPurchaseDiscountGhs" ||
    value === "agentDiscountPercentage" ||
    value === "paymentIntentExpirySeconds"
  );
}
