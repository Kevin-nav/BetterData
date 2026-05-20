import type { FastifyInstance } from "fastify";
import { requireRequestUser } from "../auth/requestUser";
import { walletFunctions } from "@betterdata/app-api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { createConvexHttpClient } from "../../convexClient";

export async function registerWalletRoutes(server: FastifyInstance) {
  server.get("/wallet", async (request, reply) => {
    const convex = createConvexHttpClient();

    let user;
    try {
      user = await requireRequestUser(request, convex);
    } catch (error) {
      return reply.code(401).send({ message: "Authentication is required." });
    }

    try {
      const summary = await convex.query(walletFunctions.summary, {
        userId: user.id as Id<"users">
      });

      return {
        balanceGhs: summary.balanceGhs,
        transactions: summary.transactions.map((tx) => ({
          id: tx._id,
          type: tx.type,
          amountGhs: tx.amountGhs,
          reference: tx.reference,
          description: tx.notes ?? formatWalletTransactionDescription(tx.type),
          createdAt: tx._creationTime
        }))
      };
    } catch (error) {
      request.log.error({ error, userId: user.id }, "Failed to get wallet summary");
      return reply.code(500).send({ message: "Unable to retrieve wallet data." });
    }
  });
}

function formatWalletTransactionDescription(type: string) {
  switch (type) {
    case "top_up":
      return "Wallet top-up";
    case "purchase":
      return "Data purchase";
    case "refund":
      return "Refund";
    case "admin_credit":
      return "Admin credit";
    case "admin_debit":
      return "Admin debit";
    default:
      return "Wallet transaction";
  }
}
