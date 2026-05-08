import type { DataPackage } from "@betterdata/contracts";
import type { FastifyInstance } from "fastify";

import { getActiveDataVendor } from "../../vendors/activeVendor";

export async function registerPackageRoutes(server: FastifyInstance) {
  server.get("/data-packages", async () => {
    const vendor = getActiveDataVendor();
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
      )
    };
  });
}
