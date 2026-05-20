import type { DataPackage } from "@betterdata/contracts";
import { getRequiredEnv } from "@betterdata/config";
import { makeFunctionReference } from "convex/server";
import type { FastifyInstance } from "fastify";

import { createConvexHttpClient } from "../../convexClient";
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

export async function registerPackageRoutes(server: FastifyInstance) {
  server.get("/data-packages", async (request, reply) => {
    const vendor = getActiveDataVendor();

    try {
      const packages = await vendor.listPackages();

      return {
        vendor: {
          id: vendor.id,
          displayName: vendor.displayName
        },
        packages: packages.map(
          (item): DataPackage => ({
            id: `${vendor.id}:${item.vendorPackageId}`,
            vendorId: vendor.id,
            vendorPackageId: item.vendorPackageId,
            network: item.network,
            name: item.name,
            sizeMb: item.sizeMb,
            costGhs: item.costGhs,
            customerPriceGhs: item.costGhs,
            isAvailable: item.isAvailable
          })
        ).sort(compareDataPackages)
      };
    } catch (error) {
      request.log.error({ error, vendorId: vendor.id }, "Vendor package listing failed");
      const fallback = await listConvexPackageFallback();

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

function compareDataPackages(a: DataPackage, b: DataPackage) {
  const networkOrder: Record<DataPackage["network"], number> = {
    mtn: 0,
    telecel: 1,
    airteltigo: 2
  };

  return networkOrder[a.network] - networkOrder[b.network] || a.sizeMb - b.sizeMb;
}

export function mapConvexFallbackPackages(
  packages: ConvexPackageRecord[]
): DataPackage[] {
  return packages.map((item) => ({
    id: item._id,
    vendorId: item.vendorId,
    vendorPackageId: item.vendorPackageId,
    network: item.network,
    name: item.name,
    sizeMb: item.sizeMb,
    costGhs: item.providerCostGhs,
    customerPriceGhs: item.customerPriceGhs,
    isAvailable: item.isAvailable
  })).sort(compareDataPackages);
}

async function listConvexPackageFallback() {
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

  return mapConvexFallbackPackages(packages);
}
