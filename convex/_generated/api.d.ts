/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as cases from "../cases.js";
import type * as crons from "../crons.js";
import type * as explain from "../explain.js";
import type * as http from "../http.js";
import type * as mail from "../mail.js";
import type * as poll from "../poll.js";
import type * as snapshots from "../snapshots.js";
import type * as staticHosting from "../staticHosting.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  cases: typeof cases;
  crons: typeof crons;
  explain: typeof explain;
  http: typeof http;
  mail: typeof mail;
  poll: typeof poll;
  snapshots: typeof snapshots;
  staticHosting: typeof staticHosting;
}>;

export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
export declare const components: {
  staticHosting: any;
};
