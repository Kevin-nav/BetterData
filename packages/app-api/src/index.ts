import { api } from "../../../convex/_generated/api";

export const convexApi = api;
export const orderFunctions = api.orders;
export const packageFunctions = api.packages;
export const walletFunctions = api.wallet;
export const paymentFunctions = (api as any).payments;
export const platformConfigFunctions = (api as any).platformConfig;
