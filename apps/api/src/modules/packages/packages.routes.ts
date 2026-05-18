import type { DataPackage } from "@betterdata/contracts";
import type { FastifyInstance } from "fastify";

import { getActiveDataVendor } from "../../vendors/activeVendor";
import { mapVendorErrorToHttp } from "../../vendors/errors";

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
        )
      };
    } catch (error) {
      request.log.error({ error, vendorId: vendor.id }, "Vendor package listing failed");
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
