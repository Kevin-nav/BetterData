import { anyApi } from "convex/server";
import type { api as generatedApi } from "../../../convex/_generated/api";

const api = anyApi as unknown as typeof generatedApi;

export const convexApi = api;
export const adminFunctions = api.admin;
export const orderFunctions = api.orders;
export const packageFunctions = api.packages;
export const walletFunctions = api.wallet;
export const paymentFunctions = api.payments;
export const platformConfigFunctions = api.platformConfig;
export const opsAlertFunctions = api.opsAlerts;
export const userFunctions = api.users;
