import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { requireServiceSecret } from "./serviceAuth";

const OUTAGE_ACTIVE_KEY = "purchaseOutageActive";
const OUTAGE_UPDATED_AT_KEY = "purchaseOutageUpdatedAt";
const DEFAULT_OUTAGE_ACTIVE = true;

export const getStatus = query({
  args: {},
  handler: async (ctx) => {
    const activeConfig = await ctx.db
      .query("platformConfig")
      .withIndex("by_key", (q) => q.eq("key", OUTAGE_ACTIVE_KEY))
      .first();
    const updatedConfig = await ctx.db
      .query("platformConfig")
      .withIndex("by_key", (q) => q.eq("key", OUTAGE_UPDATED_AT_KEY))
      .first();

    return {
      isActive:
        typeof activeConfig?.value === "boolean"
          ? activeConfig.value
          : DEFAULT_OUTAGE_ACTIVE,
      updatedAt:
        typeof updatedConfig?.value === "number"
          ? updatedConfig.value
          : null,
      message:
        "Data purchases are temporarily unavailable while we resolve a service issue. Purchases already made will still be delivered; only new purchases are paused. We will be back up very soon."
    };
  }
});

export const setStatusByService = mutation({
  args: {
    serviceSecret: v.string(),
    isActive: v.boolean()
  },
  handler: async (ctx, args) => {
    requireServiceSecret(args.serviceSecret);

    await upsertPlatformConfig(ctx, OUTAGE_ACTIVE_KEY, args.isActive);
    await upsertPlatformConfig(ctx, OUTAGE_UPDATED_AT_KEY, Date.now());

    return { isActive: args.isActive };
  }
});

export const subscribe = mutation({
  args: {
    email: v.string()
  },
  handler: async (ctx, args) => {
    const email = args.email.trim();
    const normalizedEmail = normalizeEmail(email);

    if (!isValidEmail(normalizedEmail)) {
      throw new Error("Enter a valid email address.");
    }

    const existing = await ctx.db
      .query("purchaseOutageSubscribers")
      .withIndex("by_normalized_email", (q) => q.eq("normalizedEmail", normalizedEmail))
      .first();
    const now = Date.now();

    if (existing !== null) {
      await ctx.db.patch(existing._id, {
        email,
        updatedAt: now
      });

      return { id: existing._id, email: existing.email, alreadySubscribed: true };
    }

    const id = await ctx.db.insert("purchaseOutageSubscribers", {
      email,
      normalizedEmail,
      createdAt: now,
      updatedAt: now
    });

    return { id, email, alreadySubscribed: false };
  }
});

export const listRestorationRecipients = query({
  args: {
    serviceSecret: v.string()
  },
  handler: async (ctx, args) => {
    requireServiceSecret(args.serviceSecret);

    const subscribers = await ctx.db
      .query("purchaseOutageSubscribers")
      .withIndex("by_notified_at", (q) => q.eq("notifiedAt", undefined))
      .collect();
    const users = await ctx.db.query("users").collect();
    const recipients = new Map<
      string,
      {
        email: string;
        userId?: string;
        displayName?: string;
        subscriberId?: string;
        source: "account" | "subscriber";
      }
    >();

    for (const subscriber of subscribers) {
      recipients.set(subscriber.normalizedEmail, {
        email: subscriber.email,
        subscriberId: subscriber._id,
        source: "subscriber"
      });
    }

    for (const user of users) {
      if (typeof user.email !== "string" || !isValidEmail(normalizeEmail(user.email))) {
        continue;
      }

      const normalizedEmail = normalizeEmail(user.email);
      const existingSubscriberId = recipients.get(normalizedEmail)?.subscriberId;
      const recipient: {
        email: string;
        userId: string;
        displayName?: string;
        subscriberId?: string;
        source: "account";
      } = {
        email: user.email,
        userId: user._id,
        ...(user.displayName !== undefined ? { displayName: user.displayName } : {}),
        source: "account"
      };

      if (existingSubscriberId !== undefined) {
        recipient.subscriberId = existingSubscriberId;
      }

      recipients.set(normalizedEmail, recipient);
    }

    return Array.from(recipients.values());
  }
});

export const markSubscribersNotifiedByService = mutation({
  args: {
    serviceSecret: v.string(),
    emails: v.array(v.string())
  },
  handler: async (ctx, args) => {
    requireServiceSecret(args.serviceSecret);

    const now = Date.now();
    const normalizedEmails = Array.from(new Set(args.emails.map(normalizeEmail)));
    let updated = 0;

    for (const normalizedEmail of normalizedEmails) {
      const subscriber = await ctx.db
        .query("purchaseOutageSubscribers")
        .withIndex("by_normalized_email", (q) => q.eq("normalizedEmail", normalizedEmail))
        .first();

      if (subscriber === null || subscriber.notifiedAt !== undefined) {
        continue;
      }

      await ctx.db.patch(subscriber._id, {
        notifiedAt: now,
        updatedAt: now
      });
      updated += 1;
    }

    return { updated };
  }
});

async function upsertPlatformConfig(
  ctx: MutationCtx,
  key: string,
  value: string | number | boolean
) {
  const existing = await ctx.db
    .query("platformConfig")
    .withIndex("by_key", (q) => q.eq("key", key))
    .first();

  if (existing === null) {
    await ctx.db.insert("platformConfig", { key, value });
    return;
  }

  await ctx.db.patch(existing._id, { value });
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
