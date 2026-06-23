import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireServiceSecret } from "./serviceAuth";
import { paginationOptsValidator } from "convex/server";

export const logSentEmail = mutation({
  args: {
    serviceSecret: v.string(),
    userId: v.optional(v.id("users")),
    toEmail: v.string(),
    subject: v.string(),
    type: v.union(
      v.literal("welcome"),
      v.literal("first_purchase"),
      v.literal("wallet_top_up"),
      v.literal("agent_application_received"),
      v.literal("agent_application_approved"),
      v.literal("reengagement"),
      v.literal("purchase_restored"),
      v.literal("broadcast"),
      v.literal("manual")
    ),
    status: v.union(v.literal("sent"), v.literal("failed")),
    errorMessage: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    requireServiceSecret(args.serviceSecret);

    await ctx.db.insert("sentEmails", {
      toEmail: args.toEmail,
      subject: args.subject,
      type: args.type,
      status: args.status,
      sentAt: Date.now(),
      ...(args.userId !== undefined ? { userId: args.userId } : {}),
      ...(args.errorMessage !== undefined ? { errorMessage: args.errorMessage } : {})
    });
  }
});

export const listSentEmails = query({
  args: {
    paginationOpts: paginationOptsValidator,
    type: v.optional(
      v.union(
        v.literal("welcome"),
        v.literal("first_purchase"),
        v.literal("wallet_top_up"),
        v.literal("agent_application_received"),
        v.literal("agent_application_approved"),
        v.literal("reengagement"),
        v.literal("purchase_restored"),
        v.literal("broadcast"),
        v.literal("manual")
      )
    ),
    search: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Unauthorized.");
    }
    const admin = await ctx.db
      .query("users")
      .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", identity.subject))
      .first();

    if (admin === null || (admin.role !== "admin" && admin.role !== "superadmin")) {
      throw new Error("Unauthorized.");
    }

    let q: any = ctx.db.query("sentEmails");

    if (args.type) {
      const typeFilter = args.type;
      q = q.withIndex("by_type_and_sent_at", (q: any) => q.eq("type", typeFilter));
      if (args.search) {
        const searchStr = args.search.trim();
        q = q.filter((f: any) =>
          f.or(
            f.eq(f.field("toEmail"), searchStr),
            f.eq(f.field("subject"), searchStr)
          )
        );
      }
    } else if (args.search) {
      const searchStr = args.search.trim();
      if (searchStr.includes("@")) {
        q = q.withIndex("by_to_email_and_sent_at", (q: any) => q.eq("toEmail", searchStr));
      } else {
        q = q.withIndex("by_subject_and_sent_at", (q: any) => q.eq("subject", searchStr));
      }
    } else {
      q = q.withIndex("by_sent_at");
    }

    return await q.order("desc").paginate(args.paginationOpts);
  }
});

export const listSentEmailsByService = query({
  args: {
    serviceSecret: v.string(),
    paginationOpts: paginationOptsValidator,
    type: v.optional(v.string()),
    search: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    requireServiceSecret(args.serviceSecret);

    let q: any = ctx.db.query("sentEmails");

    if (args.type) {
      const typeFilter = args.type as any;
      q = q.withIndex("by_type_and_sent_at", (q: any) => q.eq("type", typeFilter));
      if (args.search) {
        const searchStr = args.search.trim();
        q = q.filter((f: any) =>
          f.or(
            f.eq(f.field("toEmail"), searchStr),
            f.eq(f.field("subject"), searchStr)
          )
        );
      }
    } else if (args.search) {
      const searchStr = args.search.trim();
      if (searchStr.includes("@")) {
        q = q.withIndex("by_to_email_and_sent_at", (q: any) => q.eq("toEmail", searchStr));
      } else {
        q = q.withIndex("by_subject_and_sent_at", (q: any) => q.eq("subject", searchStr));
      }
    } else {
      q = q.withIndex("by_sent_at");
    }

    return await q.order("desc").paginate(args.paginationOpts);
  }
});
