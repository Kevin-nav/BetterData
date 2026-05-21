import type { FastifyInstance } from "fastify";
import { savedNumberFunctions } from "@betterdata/app-api";
import { getRequiredEnv } from "@betterdata/config";
import type { Id } from "../../../../../convex/_generated/dataModel";

import { createConvexHttpClient } from "../../convexClient";
import { requireRequestUser } from "../auth/requestUser";
import { normalizeGhanaPhoneNumber } from "../orders/orderValidation";

const NETWORKS = new Set(["mtn", "telecel", "airteltigo"]);

type SaveSavedNumberBody = {
  label?: unknown;
  phone?: unknown;
  network?: unknown;
};

export async function registerSavedNumberRoutes(server: FastifyInstance) {
  server.get("/saved-numbers", async (request, reply) => {
    const convex = createConvexHttpClient();

    try {
      const user = await requireRequestUser(request, convex);
      const numbers = await convex.query(savedNumberFunctions.listForUserForApi, {
        ...serviceArgs(),
        userId: user.id as Id<"users">
      });

      return {
        numbers: numbers.map((number) => ({
          id: number._id,
          userId: number.userId,
          label: number.label,
          phone: number.phone,
          ...(number.network !== undefined ? { network: number.network } : {}),
          createdAt: number._creationTime
        }))
      };
    } catch (error) {
      request.log.warn({ error }, "Saved numbers list failed");
      return reply.code(401).send({ message: "Authentication is required." });
    }
  });

  server.post<{ Body: SaveSavedNumberBody }>("/saved-numbers", async (request, reply) => {
    const convex = createConvexHttpClient();

    try {
      const user = await requireRequestUser(request, convex);
      const parsed = parseSavedNumberBody(request.body ?? {});
      const savedNumber = await convex.mutation(savedNumberFunctions.saveForUserForApi, {
        ...serviceArgs(),
        userId: user.id as Id<"users">,
        ...parsed
      });

      if (savedNumber === null) {
        throw new Error("Saved number was not persisted.");
      }

      return reply.code(201).send({
        id: savedNumber._id,
        userId: savedNumber.userId,
        label: savedNumber.label,
        phone: savedNumber.phone,
        ...(savedNumber.network !== undefined ? { network: savedNumber.network } : {}),
        createdAt: savedNumber._creationTime
      });
    } catch (error) {
      request.log.warn({ error }, "Saved number create failed");
      return reply.code(isValidationError(error) ? 400 : 401).send({
        message: readErrorMessage(error, "Unable to save number.")
      });
    }
  });

  server.delete<{ Params: { id: string } }>("/saved-numbers/:id", async (request, reply) => {
    const convex = createConvexHttpClient();

    try {
      const user = await requireRequestUser(request, convex);
      const result = await convex.mutation(savedNumberFunctions.deleteForUserForApi, {
        ...serviceArgs(),
        userId: user.id as Id<"users">,
        savedNumberId: request.params.id as Id<"savedNumbers">
      });

      return result;
    } catch (error) {
      request.log.warn({ error }, "Saved number delete failed");
      return reply.code(401).send({ message: "Unable to delete saved number." });
    }
  });
}

function parseSavedNumberBody(body: SaveSavedNumberBody) {
  const label = typeof body.label === "string" ? body.label.trim() : "";
  const phone = normalizeGhanaPhoneNumber(body.phone);

  if (!label) {
    throw new Error("A saved number label is required.");
  }

  if (label.length > 60) {
    throw new Error("Saved number label must be 60 characters or fewer.");
  }

  if (!phone) {
    throw new Error("A valid Ghana recipient phone number is required.");
  }

  const network = typeof body.network === "string" && NETWORKS.has(body.network)
    ? body.network as "mtn" | "telecel" | "airteltigo"
    : undefined;

  return {
    label,
    phone,
    ...(network !== undefined ? { network } : {})
  };
}

function serviceArgs() {
  return {
    apiSecret: getRequiredEnv("CONVEX_API_SECRET")
  };
}

function isValidationError(error: unknown) {
  return error instanceof Error && !error.message.toLowerCase().includes("auth");
}

function readErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}
