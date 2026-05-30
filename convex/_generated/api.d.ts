/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as adminConfig from "../adminConfig.js";
import type * as emails from "../emails.js";
import type * as http from "../http.js";
import type * as notifications from "../notifications.js";
import type * as opsAlerts from "../opsAlerts.js";
import type * as orders from "../orders.js";
import type * as packages from "../packages.js";
import type * as payments from "../payments.js";
import type * as platformConfig from "../platformConfig.js";
import type * as savedNumbers from "../savedNumbers.js";
import type * as serviceAuth from "../serviceAuth.js";
import type * as users from "../users.js";
import type * as vendorBalances from "../vendorBalances.js";
import type * as wallet from "../wallet.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  adminConfig: typeof adminConfig;
  emails: typeof emails;
  http: typeof http;
  notifications: typeof notifications;
  opsAlerts: typeof opsAlerts;
  orders: typeof orders;
  packages: typeof packages;
  payments: typeof payments;
  platformConfig: typeof platformConfig;
  savedNumbers: typeof savedNumbers;
  serviceAuth: typeof serviceAuth;
  users: typeof users;
  vendorBalances: typeof vendorBalances;
  wallet: typeof wallet;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
