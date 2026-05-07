import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import Fastify from "fastify";

import { registerAdminRoutes } from "./modules/admin/admin.routes";
import { registerHealthRoutes } from "./modules/health/health.routes";
import { registerOrderRoutes } from "./modules/orders/orders.routes";
import { registerPackageRoutes } from "./modules/packages/packages.routes";
import { registerWalletRoutes } from "./modules/wallet/wallet.routes";

const server = Fastify({
  logger: true
});

await server.register(helmet);
await server.register(cors, {
  origin: true
});

await registerHealthRoutes(server);
await registerPackageRoutes(server);
await registerOrderRoutes(server);
await registerWalletRoutes(server);
await registerAdminRoutes(server);

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "0.0.0.0";

await server.listen({ port, host });
