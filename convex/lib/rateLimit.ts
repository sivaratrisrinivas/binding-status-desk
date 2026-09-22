import type { MutationCtx } from "../_generated/server";

export const RATE_WINDOW_MS = 10 * 60 * 1000;
export const WATCH_PER_RECEIPT = 3;
export const POLL_PER_CASE = 3;
export const SIMULATE_PER_CASE = 10;
export const FIRECRAWL_GLOBAL = 20;

const RATE_LIMIT_MESSAGE =
  "This public demo is rate-limited so Firecrawl quota is not burned. Try again in a few minutes.";

export async function consumeRateLimit(
  ctx: MutationCtx,
  key: string,
  limit: number,
  windowMs = RATE_WINDOW_MS,
): Promise<void> {
  const now = Date.now();
  const row = await ctx.db
    .query("rateLimits")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  if (!row || now - row.windowStart >= windowMs) {
    if (row) {
      await ctx.db.patch(row._id, { windowStart: now, count: 1 });
    } else {
      await ctx.db.insert("rateLimits", { key, windowStart: now, count: 1 });
    }
    return;
  }
  if (row.count >= limit) {
    throw new Error(RATE_LIMIT_MESSAGE);
  }
  await ctx.db.patch(row._id, { count: row.count + 1 });
}
