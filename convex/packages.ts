import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireServiceSecret } from "./serviceAuth";
import { readNumberConfig } from "./platformConfig";

const network = v.union(v.literal("mtn"), v.literal("telecel"), v.literal("airteltigo"));

export const list = query({
  args: {
    network: v.optional(network)
  },
  handler: async (ctx, args) => {
    const network = args.network;

    if (network !== undefined) {
      return await ctx.db
        .query("dataPackages")
        .withIndex("by_network", (q) => q.eq("network", network))
        .collect();
    }

    return await ctx.db.query("dataPackages").collect();
  }
});

export const listAvailable = query({
  args: {
    network: v.optional(network)
  },
  handler: async (ctx, args) => {
    const network = args.network;
    const packages =
      network !== undefined
        ? await ctx.db
            .query("dataPackages")
            .withIndex("by_network", (q) => q.eq("network", network))
            .filter((q) => q.eq(q.field("isAvailable"), true))
            .collect()
        : await ctx.db
            .query("dataPackages")
            .filter((q) => q.eq(q.field("isAvailable"), true))
            .collect();

    return packages;
  }
});

export const listAvailableForApi = query({
  args: {
    serviceSecret: v.string()
  },
  handler: async (ctx, args) => {
    requireServiceSecret(args.serviceSecret);

    return await ctx.db
      .query("dataPackages")
      .filter((q) => q.eq(q.field("isAvailable"), true))
      .collect();
  }
});

export const getPricingContextForApi = query({
  args: {
    serviceSecret: v.string()
  },
  handler: async (ctx, args) => {
    requireServiceSecret(args.serviceSecret);

    const [packages, pricingRules, agentDiscountPercentage] = await Promise.all([
      ctx.db.query("dataPackages").collect(),
      ctx.db
        .query("pricingRules")
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect(),
      readNumberConfig(ctx, "agentDiscountPercentage")
    ]);

    return {
      packages: packages.map((pkg) => ({
        _id: pkg._id,
        vendorId: pkg.vendorId,
        vendorPackageId: pkg.vendorPackageId
      })),
      pricingRules: pricingRules.map((rule) => ({
        _id: rule._id,
        packageId: rule.packageId,
        mode: rule.mode,
        value: rule.value,
        isGlobal: rule.isGlobal
      })),
      agentDiscountPercentage: agentDiscountPercentage ?? 0
    };
  }
});

export const upsertFromVendorForApi = mutation({
  args: {
    serviceSecret: v.string(),
    vendorId: v.string(),
    packages: v.array(v.object({
      vendorPackageId: v.string(),
      network,
      name: v.string(),
      sizeMb: v.number(),
      providerCostGhs: v.number(),
      customerPriceGhs: v.number(),
      isAvailable: v.boolean(),
      vendorRaw: v.optional(v.any())
    }))
  },
  handler: async (ctx, args) => {
    requireServiceSecret(args.serviceSecret);
    const now = Date.now();
    let upserted = 0;

    for (const pkg of args.packages) {
      const existing = await ctx.db
        .query("dataPackages")
        .withIndex("by_vendor_package_id", (q) =>
          q.eq("vendorId", args.vendorId).eq("vendorPackageId", pkg.vendorPackageId)
        )
        .first();
      const patch = {
        vendorId: args.vendorId,
        vendorPackageId: pkg.vendorPackageId,
        network: pkg.network,
        name: pkg.name,
        sizeMb: pkg.sizeMb,
        providerCostGhs: pkg.providerCostGhs,
        customerPriceGhs: pkg.customerPriceGhs,
        isAvailable: pkg.isAvailable,
        providerUpdatedAt: now,
        ...(pkg.vendorRaw !== undefined ? { vendorRaw: pkg.vendorRaw } : {})
      };

      if (existing === null) {
        await ctx.db.insert("dataPackages", patch);
      } else {
        await ctx.db.patch(existing._id, patch);
      }

      upserted += 1;
    }

    return { upserted };
  }
});
