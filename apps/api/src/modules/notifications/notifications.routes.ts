import type { FastifyInstance } from "fastify";
import { requireRequestUser } from "../auth/requestUser";
import { notificationFunctions } from "@betterdata/app-api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { createConvexHttpClient } from "../../convexClient";
import { getRequiredEnv } from "@betterdata/config";

export async function registerNotificationRoutes(server: FastifyInstance) {
  const convex = createConvexHttpClient();
  const serviceSecret = getRequiredEnv("BETTERDATA_SERVICE_SECRET");

  // GET /notifications
  server.get("/notifications", async (request, reply) => {
    let user;
    try {
      user = await requireRequestUser(request, convex);
    } catch (error) {
      return reply.code(401).send({ message: "Authentication is required." });
    }

    try {
      const notifications = await convex.query(notificationFunctions.listForUser, {
        serviceSecret,
        userId: user.id as Id<"users">
      });

      return {
        notifications: notifications.map((n) => ({
          id: n.id,
          title: n.title,
          body: n.body,
          type: n.type,
          referenceId: n.referenceId,
          readAt: n.readAt,
          createdAt: n.createdAt,
          source: n.source
        }))
      };
    } catch (error) {
      request.log.error({ error, userId: user.id }, "Failed to fetch notifications");
      return reply.code(500).send({ message: "Unable to retrieve notifications." });
    }
  });

  // PATCH /notifications/:id/read
  server.patch<{ Params: { id: string } }>("/notifications/:id/read", async (request, reply) => {
    let user;
    try {
      user = await requireRequestUser(request, convex);
    } catch (error) {
      return reply.code(401).send({ message: "Authentication is required." });
    }

    try {
      await convex.mutation(notificationFunctions.markRead, {
        serviceSecret,
        userId: user.id as Id<"users">,
        notificationId: request.params.id
      });

      return { success: true };
    } catch (error) {
      request.log.error({ error, userId: user.id, notificationId: request.params.id }, "Failed to mark notification as read");
      return reply.code(500).send({ message: "Unable to update notification." });
    }
  });

  // POST /notifications/read-all
  server.post("/notifications/read-all", async (request, reply) => {
    let user;
    try {
      user = await requireRequestUser(request, convex);
    } catch (error) {
      return reply.code(401).send({ message: "Authentication is required." });
    }

    try {
      await convex.mutation(notificationFunctions.markAllRead, {
        serviceSecret,
        userId: user.id as Id<"users">
      });

      return { success: true };
    } catch (error) {
      request.log.error({ error, userId: user.id }, "Failed to mark all notifications as read");
      return reply.code(500).send({ message: "Unable to update notifications." });
    }
  });

  // DELETE /notifications/:id
  server.delete<{ Params: { id: string } }>("/notifications/:id", async (request, reply) => {
    let user;
    try {
      user = await requireRequestUser(request, convex);
    } catch (error) {
      return reply.code(401).send({ message: "Authentication is required." });
    }

    try {
      await convex.mutation(notificationFunctions.deleteNotification, {
        serviceSecret,
        userId: user.id as Id<"users">,
        notificationId: request.params.id
      });

      return { success: true };
    } catch (error) {
      request.log.error({ error, userId: user.id, notificationId: request.params.id }, "Failed to delete notification");
      return reply.code(500).send({ message: "Unable to delete notification." });
    }
  });
}
