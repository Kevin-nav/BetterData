import type { DataPackage, VendorPackage } from "@betterdata/contracts";
import { getRequiredEnv } from "@betterdata/config";
import { makeFunctionReference } from "convex/server";
import type { FastifyInstance } from "fastify";
import type { FastifyRequest } from "fastify";

import { createConvexHttpClient } from "../../convexClient";
import { getOptionalRequestUser } from "../auth/requestUser";
import { getActiveDataVendor } from "../../vendors/activeVendor";
import { mapVendorErrorToHttp } from "../../vendors/errors";

type ConvexPackageRecord = {
  _id: string;
  vendorId: string;
  vendorPackageId: string;
  network: DataPackage["network"];
  name: string;
  sizeMb: number;
  providerCostGhs: number;
  customerPriceGhs: number;
  isAvailable: boolean;
};

export type ApiPricingRule = {
  _id: string;
  packageId?: string;
  mode: "percentage" | "fixed";
  value: number;
  isGlobal: boolean;
};

export type ApiPricingContext = {
  packages: Array<{
    _id: string;
    vendorId: string;
    vendorPackageId: string;
  }>;
  pricingRules: ApiPricingRule[];
  agentDiscountPercentage: number;
};

export async function registerPackageRoutes(server: FastifyInstance) {
  server.get("/data-packages", async (request, reply) => {
    const vendor = getActiveDataVendor();
    const user = await getOptionalRequestUserSafely(request, request.log);

    try {
      const packages = await vendor.listPackages();
      const pricingContext = await getPricingContextForApi(request.log);
      const applyAgentDiscount = user?.role === "agent";
      const apiPackages = packages.map(
        (item): DataPackage => {
          const pricing = resolveVendorPackageCustomerPricing(
            vendor.id,
            item,
            pricingContext,
            { applyAgentDiscount }
          );

          return {
            id: `${vendor.id}:${item.vendorPackageId}`,
            vendorId: vendor.id,
            vendorPackageId: item.vendorPackageId,
            network: item.network,
            name: item.name,
            sizeMb: item.sizeMb,
            costGhs: item.costGhs,
            customerPriceGhs: pricing.customerPriceGhs,
            ...(pricing.agentDiscountPercentage > 0
              ? {
                  baseCustomerPriceGhs: pricing.baseCustomerPriceGhs,
                  agentPriceGhs: pricing.customerPriceGhs,
                  agentDiscountPercentage: pricing.agentDiscountPercentage
                }
              : {}),
            isAvailable: item.isAvailable
          };
        }
      ).sort(compareDataPackages);

      await syncVendorPackagesForFinancials(vendor.id, apiPackages, request.log);

      return {
        vendor: {
          id: vendor.id,
          displayName: vendor.displayName
        },
        packages: apiPackages
      };
    } catch (error) {
      request.log.error({ error, vendorId: vendor.id }, "Vendor package listing failed");
      const fallback = await listConvexPackageFallback({
        applyAgentDiscount: user?.role === "agent"
      });

      if (fallback.length > 0) {
        return {
          vendor: {
            id: vendor.id,
            displayName: vendor.displayName
          },
          source: "fallback",
          packages: fallback
        };
      }

      const mapped = mapVendorErrorToHttp(error);

      if (mapped.retryAfterSeconds !== undefined) {
        reply.header("Retry-After", String(mapped.retryAfterSeconds));
      }

      return reply.code(mapped.statusCode).send({
        message: mapped.message,
        vendorId: vendor.id
      });
    }
  });
}

async function syncVendorPackagesForFinancials(
  vendorId: string,
  packages: DataPackage[],
  log: { warn: (obj: Record<string, unknown>, msg: string) => void }
) {
  if (!process.env.CONVEX_URL || !process.env.BETTERDATA_SERVICE_SECRET) {
    return;
  }

  try {
    const upsertFromVendorForApi = makeFunctionReference<"mutation">(
      "packages:upsertFromVendorForApi"
    );
    const convex = createConvexHttpClient();

    await convex.mutation(upsertFromVendorForApi, {
      serviceSecret: getRequiredEnv("BETTERDATA_SERVICE_SECRET"),
      vendorId,
      packages: packages.map((pkg) => ({
        vendorPackageId: pkg.vendorPackageId,
        network: pkg.network,
        name: pkg.name,
        sizeMb: pkg.sizeMb,
        providerCostGhs: pkg.costGhs,
        customerPriceGhs: pkg.customerPriceGhs,
        isAvailable: pkg.isAvailable
      }))
    });
  } catch (error) {
    log.warn({ error, vendorId }, "Unable to sync vendor packages for financial snapshots");
  }
}

export function resolveVendorPackageCustomerPriceGhs(
  vendorId: string,
  item: Pick<VendorPackage, "vendorPackageId" | "costGhs">,
  pricingContext: ApiPricingContext | null,
  options: { applyAgentDiscount?: boolean } = {}
) {
  return resolveVendorPackageCustomerPricing(
    vendorId,
    item,
    pricingContext,
    options
  ).customerPriceGhs;
}

export function resolveVendorPackageCustomerPricing(
  vendorId: string,
  item: Pick<VendorPackage, "vendorPackageId" | "costGhs">,
  pricingContext: ApiPricingContext | null,
  options: { applyAgentDiscount?: boolean } = {}
) {
  const baseCost = item.costGhs;

  if (pricingContext === null) {
    const customerPriceGhs = roundGhs(baseCost);
    return {
      baseCustomerPriceGhs: customerPriceGhs,
      customerPriceGhs,
      agentDiscountPercentage: 0
    };
  }

  const packageRecord = pricingContext.packages.find(
    (pkg) => pkg.vendorId === vendorId && pkg.vendorPackageId === item.vendorPackageId
  );
  const packageRule =
    packageRecord === undefined
      ? undefined
      : pricingContext.pricingRules.find(
          (rule) => !rule.isGlobal && rule.packageId === packageRecord._id
        );
  const globalRule = pricingContext.pricingRules.find((rule) => rule.isGlobal);
  const rule = packageRule ?? globalRule;

  if (rule === undefined) {
    const customerPriceGhs = roundGhs(baseCost);
    return {
      baseCustomerPriceGhs: customerPriceGhs,
      customerPriceGhs,
      agentDiscountPercentage: 0
    };
  }

  const computed =
    rule.mode === "percentage"
      ? baseCost * (1 + rule.value / 100)
      : baseCost + rule.value;
  const baseCustomerPriceGhs = roundGhs(computed);

  const agentDiscountPercentage = options.applyAgentDiscount
    ? pricingContext.agentDiscountPercentage
    : 0;
  const discounted = computed * (1 - agentDiscountPercentage / 100);

  return {
    baseCustomerPriceGhs,
    customerPriceGhs: roundGhs(Math.max(discounted, 0)),
    agentDiscountPercentage
  };
}

function compareDataPackages(a: DataPackage, b: DataPackage) {
  const networkOrder: Record<DataPackage["network"], number> = {
    mtn: 0,
    telecel: 1,
    airteltigo: 2
  };

  return networkOrder[a.network] - networkOrder[b.network] || a.sizeMb - b.sizeMb;
}

export function mapConvexFallbackPackages(
  packages: ConvexPackageRecord[],
  pricingContext: ApiPricingContext | null = null,
  options: { applyAgentDiscount?: boolean } = {}
): DataPackage[] {
  return packages.map((item) => {
    const pricing =
      pricingContext === null
        ? {
            baseCustomerPriceGhs: item.customerPriceGhs,
            customerPriceGhs: item.customerPriceGhs,
            agentDiscountPercentage: 0
          }
        : resolveVendorPackageCustomerPricing(
            item.vendorId,
            {
              vendorPackageId: item.vendorPackageId,
              costGhs: item.providerCostGhs
            },
            pricingContext,
            options
          );

    return {
      id: item._id,
      vendorId: item.vendorId,
      vendorPackageId: item.vendorPackageId,
      network: item.network,
      name: item.name,
      sizeMb: item.sizeMb,
      costGhs: item.providerCostGhs,
      customerPriceGhs: pricing.customerPriceGhs,
      ...(pricing.agentDiscountPercentage > 0
        ? {
            baseCustomerPriceGhs: pricing.baseCustomerPriceGhs,
            agentPriceGhs: pricing.customerPriceGhs,
            agentDiscountPercentage: pricing.agentDiscountPercentage
          }
        : {}),
      isAvailable: item.isAvailable
    };
  }).sort(compareDataPackages);
}

async function listConvexPackageFallback(options: { applyAgentDiscount?: boolean } = {}) {
  if (!process.env.CONVEX_URL || !process.env.BETTERDATA_SERVICE_SECRET) {
    return [];
  }

  const listAvailableForApi = makeFunctionReference<"query">(
    "packages:listAvailableForApi"
  );
  const convex = createConvexHttpClient();
  const packages = (await convex.query(listAvailableForApi, {
    serviceSecret: getRequiredEnv("BETTERDATA_SERVICE_SECRET")
  })) as ConvexPackageRecord[];
  const pricingContext = await getPricingContextForApi();

  return mapConvexFallbackPackages(packages, pricingContext, options);
}

export async function getPricingContextForApi(log?: {
  warn: (obj: Record<string, unknown>, msg: string) => void;
}) {
  if (!process.env.CONVEX_URL || !process.env.BETTERDATA_SERVICE_SECRET) {
    return null;
  }

  try {
    const getPricingContext = makeFunctionReference<"query">(
      "packages:getPricingContextForApi"
    );
    const convex = createConvexHttpClient();

    return (await convex.query(getPricingContext, {
      serviceSecret: getRequiredEnv("BETTERDATA_SERVICE_SECRET")
    })) as ApiPricingContext;
  } catch (error) {
    log?.warn({ error }, "Convex pricing context unavailable; using vendor base prices");
    return null;
  }
}

function roundGhs(value: number) {
  return Math.round(value * 100) / 100;
}

async function getOptionalRequestUserSafely(
  request: FastifyRequest,
  log: { warn: (obj: Record<string, unknown>, msg: string) => void }
) {
  try {
    return await getOptionalRequestUser(request, createConvexHttpClient());
  } catch (error) {
    log.warn({ error }, "Unable to resolve optional package-listing user; using public prices");
    return null;
  }
}
