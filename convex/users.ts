import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

import { requireServiceSecret } from "./serviceAuth";
import { isBootstrapSuperadmin } from "./adminConfig";

export const findOrCreateFromFirebase = mutation({
  args: {
    serviceSecret: v.string(),
    firebaseUid: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    displayName: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    requireServiceSecret(args.serviceSecret);
    const bootstrapRole = isBootstrapSuperadmin(args.email)
      ? { role: "superadmin" as const }
      : {};

    const existing = await ctx.db
      .query("users")
      .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", args.firebaseUid))
      .first();

    if (existing !== null) {
      const updates = {
        ...(args.email !== undefined && existing.email !== args.email
          ? { email: args.email }
          : {}),
        ...(args.phone !== undefined && existing.phone !== args.phone
          ? { phone: args.phone }
          : {}),
        ...(args.displayName !== undefined && existing.displayName !== args.displayName
          ? { displayName: args.displayName }
          : {}),
        ...(bootstrapRole.role === "superadmin" && existing.role !== "superadmin"
          ? bootstrapRole
          : {})
      };

      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(existing._id, updates);
      }

      return {
        id: existing._id,
        firebaseUid: existing.firebaseUid,
        email: args.email ?? existing.email,
        phone: args.phone ?? existing.phone,
        displayName: args.displayName ?? existing.displayName,
        role: bootstrapRole.role ?? existing.role
      };
    }

    const userId = await ctx.db.insert("users", {
      firebaseUid: args.firebaseUid,
      ...(args.email !== undefined ? { email: args.email } : {}),
      ...(args.phone !== undefined ? { phone: args.phone } : {}),
      ...(args.displayName !== undefined ? { displayName: args.displayName } : {}),
      role: bootstrapRole.role ?? "user",
      isSuspended: false,
      walletBalanceGhs: 0,
      firstPurchaseDiscountUsed: false
    });

    return {
      id: userId,
      firebaseUid: args.firebaseUid,
      email: args.email,
      phone: args.phone,
      displayName: args.displayName,
      role: bootstrapRole.role ?? "user"
    };
  }
});

export const getByFirebaseUid = query({
  args: {
    serviceSecret: v.string(),
    firebaseUid: v.string()
  },
  handler: async (ctx, args) => {
    requireServiceSecret(args.serviceSecret);

    return await ctx.db
      .query("users")
      .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", args.firebaseUid))
      .first();
  }
});

export const updatePhone = mutation({
  args: {
    serviceSecret: v.string(),
    firebaseUid: v.string(),
    phone: v.string()
  },
  handler: async (ctx, args) => {
    requireServiceSecret(args.serviceSecret);

    const user = await ctx.db
      .query("users")
      .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", args.firebaseUid))
      .first();

    if (user === null) {
      throw new Error("User not found.");
    }

    await ctx.db.patch(user._id, { phone: args.phone });

    return { phone: args.phone };
  }
});

export const getAgentApplicationStatus = query({
  args: {
    serviceSecret: v.string(),
    firebaseUid: v.string()
  },
  handler: async (ctx, args) => {
    requireServiceSecret(args.serviceSecret);

    const user = await ctx.db
      .query("users")
      .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", args.firebaseUid))
      .first();

    if (user === null) {
      return null;
    }

    const application = await ctx.db
      .query("agentApplications")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (application === null) {
      return null;
    }

    return {
      status: application.status,
      ...(application.paymentReference !== undefined
        ? { paymentReference: application.paymentReference }
        : {})
    };
  }
});
