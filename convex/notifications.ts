import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { requireServiceSecret } from "./serviceAuth";

type NotificationType =
  | "order_status"
  | "wallet_update"
  | "announcement"
  | "agent_update"
  | "account_alert";

type NotificationListItem = {
  id: string;
  title: string;
  body: string;
  type: NotificationType;
  referenceId?: string;
  readAt?: number;
  createdAt: number;
  source: "notification" | "announcement";
};

const NOTIFICATION_LIMIT = 50;
const MAX_TITLE_LENGTH = 120;
const MAX_BODY_LENGTH = 500;

export async function createNotification(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    title: string;
    body: string;
    type: Exclude<NotificationType, "announcement">;
    referenceId?: string;
    dedupeKey?: string;
  }
) {
  const title = compactText(args.title, MAX_TITLE_LENGTH);
  const body = compactText(args.body, MAX_BODY_LENGTH);

  if (args.dedupeKey !== undefined) {
    const existing = await ctx.db
      .query("notifications")
      .withIndex("by_user_dedupe", (q) =>
        q.eq("userId", args.userId).eq("dedupeKey", args.dedupeKey)
      )
      .first();

    if (existing !== null) {
      return existing._id;
    }
  }

  return await ctx.db.insert("notifications", {
    userId: args.userId,
    title,
    body,
    type: args.type,
    ...(args.referenceId !== undefined ? { referenceId: args.referenceId } : {}),
    ...(args.dedupeKey !== undefined ? { dedupeKey: args.dedupeKey } : {}),
    createdAt: Date.now()
  });
}

export async function broadcastAnnouncement(
  _ctx: MutationCtx,
  _args: {
    announcementId: Id<"announcements">;
    title: string;
    body: string;
    audience: "all" | "users" | "agents";
  }
) {
  // Announcements are materialized for each user at read time by listForUser.
  // Per-user read/dismiss state is stored only after interaction.
  return { delivered: 0 };
}

export const listForUser = query({
  args: {
    serviceSecret: v.string(),
    userId: v.id("users")
  },
  handler: async (ctx, args): Promise<NotificationListItem[]> => {
    requireServiceSecret(args.serviceSecret);

    const user = await ctx.db.get(args.userId);
    if (user === null) {
      throw new Error("User not found.");
    }

    const personal = await ctx.db
      .query("notifications")
      .withIndex("by_user_created", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(NOTIFICATION_LIMIT);

    const announcements = await listAnnouncementItems(ctx, user);
    return [
      ...personal.map(toNotificationListItem),
      ...announcements
    ]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, NOTIFICATION_LIMIT);
  }
});

export const markRead = mutation({
  args: {
    serviceSecret: v.string(),
    userId: v.id("users"),
    notificationId: v.string()
  },
  handler: async (ctx, args) => {
    requireServiceSecret(args.serviceSecret);

    const announcementId = parseAnnouncementNotificationId(args.notificationId);
    if (announcementId !== null) {
      await upsertAnnouncementState(ctx, args.userId, announcementId, {
        readAt: Date.now()
      });
      return;
    }

    const notification = await ctx.db.get(args.notificationId as Id<"notifications">);
    if (notification === null) {
      throw new Error("Notification not found.");
    }

    if (notification.userId !== args.userId) {
      throw new Error("Unauthorized.");
    }

    if (notification.readAt === undefined) {
      await ctx.db.patch(notification._id, { readAt: Date.now() });
    }
  }
});

export const markAllRead = mutation({
  args: {
    serviceSecret: v.string(),
    userId: v.id("users")
  },
  handler: async (ctx, args) => {
    requireServiceSecret(args.serviceSecret);

    const user = await ctx.db.get(args.userId);
    if (user === null) {
      throw new Error("User not found.");
    }

    const unreadNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_user_read", (q) =>
        q.eq("userId", args.userId).eq("readAt", undefined)
      )
      .collect();

    const now = Date.now();
    for (const notification of unreadNotifications) {
      await ctx.db.patch(notification._id, { readAt: now });
    }

    const announcements = await listAudienceAnnouncements(ctx, user);
    for (const announcement of announcements) {
      const state = await getAnnouncementState(ctx, args.userId, announcement._id);
      if (state?.readAt === undefined && state?.dismissedAt === undefined) {
        await upsertAnnouncementState(ctx, args.userId, announcement._id, {
          readAt: now
        });
      }
    }
  }
});

export const deleteNotification = mutation({
  args: {
    serviceSecret: v.string(),
    userId: v.id("users"),
    notificationId: v.string()
  },
  handler: async (ctx, args) => {
    requireServiceSecret(args.serviceSecret);

    const announcementId = parseAnnouncementNotificationId(args.notificationId);
    if (announcementId !== null) {
      const now = Date.now();
      await upsertAnnouncementState(ctx, args.userId, announcementId, {
        readAt: now,
        dismissedAt: now
      });
      return;
    }

    const notification = await ctx.db.get(args.notificationId as Id<"notifications">);
    if (notification === null) {
      throw new Error("Notification not found.");
    }

    if (notification.userId !== args.userId) {
      throw new Error("Unauthorized.");
    }

    await ctx.db.delete(notification._id);
  }
});

async function listAnnouncementItems(
  ctx: QueryCtx,
  user: Doc<"users">
): Promise<NotificationListItem[]> {
  const announcements = await listAudienceAnnouncements(ctx, user);
  const items: NotificationListItem[] = [];

  for (const announcement of announcements) {
    const state = await getAnnouncementState(ctx, user._id, announcement._id);
    if (state?.dismissedAt !== undefined) {
      continue;
    }

    items.push({
      id: announcementNotificationId(announcement._id),
      title: compactText(announcement.title, MAX_TITLE_LENGTH),
      body: compactText(announcement.body, MAX_BODY_LENGTH),
      type: "announcement",
      referenceId: announcement._id,
      ...(state?.readAt !== undefined ? { readAt: state.readAt } : {}),
      createdAt: announcement.sentAt ?? announcement._creationTime,
      source: "announcement"
    });
  }

  return items;
}

async function listAudienceAnnouncements(ctx: QueryCtx | MutationCtx, user: Doc<"users">) {
  const audiences: Array<"all" | "users" | "agents"> = ["all"];

  if (user.role === "agent") {
    audiences.push("agents");
  } else if (user.role === "user") {
    audiences.push("users");
  }

  const batches = await Promise.all(
    audiences.map((audience) =>
      ctx.db
        .query("announcements")
        .withIndex("by_audience", (q) => q.eq("audience", audience))
        .order("desc")
        .take(NOTIFICATION_LIMIT)
    )
  );

  return batches.flat().sort((a, b) => {
    const left = a.sentAt ?? a._creationTime;
    const right = b.sentAt ?? b._creationTime;
    return right - left;
  });
}

async function getAnnouncementState(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  announcementId: Id<"announcements">
) {
  return await ctx.db
    .query("announcementNotificationStates")
    .withIndex("by_user_announcement", (q) =>
      q.eq("userId", userId).eq("announcementId", announcementId)
    )
    .first();
}

async function upsertAnnouncementState(
  ctx: MutationCtx,
  userId: Id<"users">,
  announcementId: Id<"announcements">,
  updates: { readAt?: number; dismissedAt?: number }
) {
  const announcement = await ctx.db.get(announcementId);
  if (announcement === null) {
    throw new Error("Announcement not found.");
  }

  const user = await ctx.db.get(userId);
  if (user === null || !canSeeAnnouncement(user, announcement)) {
    throw new Error("Unauthorized.");
  }

  const existing = await getAnnouncementState(ctx, userId, announcementId);
  const now = Date.now();

  if (existing !== null) {
    await ctx.db.patch(existing._id, {
      ...updates,
      updatedAt: now
    });
    return;
  }

  await ctx.db.insert("announcementNotificationStates", {
    userId,
    announcementId,
    ...updates,
    createdAt: now,
    updatedAt: now
  });
}

function toNotificationListItem(notification: Doc<"notifications">): NotificationListItem {
  return {
    id: notification._id,
    title: notification.title,
    body: notification.body,
    type: notification.type,
    ...(notification.referenceId !== undefined
      ? { referenceId: notification.referenceId }
      : {}),
    ...(notification.readAt !== undefined ? { readAt: notification.readAt } : {}),
    createdAt: notification.createdAt,
    source: "notification"
  };
}

function announcementNotificationId(id: Id<"announcements">) {
  return `announcement:${id}`;
}

function parseAnnouncementNotificationId(value: string): Id<"announcements"> | null {
  return value.startsWith("announcement:")
    ? (value.slice("announcement:".length) as Id<"announcements">)
    : null;
}

function canSeeAnnouncement(user: Doc<"users">, announcement: Doc<"announcements">) {
  return (
    announcement.audience === "all" ||
    (announcement.audience === "agents" && user.role === "agent") ||
    (announcement.audience === "users" && user.role === "user")
  );
}

function compactText(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
}
