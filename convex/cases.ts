import { v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { isValidReceipt, normalizeReceipt } from "./lib/receipt";

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export const getInternal = internalQuery({
  args: { caseId: v.id("cases") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.caseId);
  },
});

export const getByReceipt = query({
  args: { receiptNumber: v.string() },
  handler: async (ctx, args) => {
    const receiptNumber = normalizeReceipt(args.receiptNumber);
    if (!isValidReceipt(receiptNumber)) return null;
    return await ctx.db
      .query("cases")
      .withIndex("by_receipt", (q) => q.eq("receiptNumber", receiptNumber))
      .unique();
  },
});

export const latestSnapshot = query({
  args: { caseId: v.id("cases") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("statusSnapshots")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .collect();
    rows.sort((a, b) => b.fetchedAt - a.fetchedAt);
    return rows[0] ?? null;
  },
});

export const diffsForCase = query({
  args: { caseId: v.id("cases") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("statusDiffs")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .collect();
    rows.sort((a, b) => b.createdAt - a.createdAt);
    return rows;
  },
});

export const watch = mutation({
  args: {
    receiptNumber: v.string(),
    notifyEmail: v.optional(v.string()),
    simulate: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const receiptNumber = normalizeReceipt(args.receiptNumber);
    if (!isValidReceipt(receiptNumber)) {
      throw new Error(
        "Use a 13-character USCIS receipt number (three letters and ten numbers). Skip dashes.",
      );
    }
    const notifyEmail = args.notifyEmail?.trim()
      ? args.notifyEmail.trim()
      : undefined;
    if (notifyEmail && !isEmail(notifyEmail)) {
      throw new Error("That email address does not look valid.");
    }

    const existing = await ctx.db
      .query("cases")
      .withIndex("by_receipt", (q) => q.eq("receiptNumber", receiptNumber))
      .unique();

    const now = Date.now();
    let caseId = existing?._id;
    if (existing) {
      await ctx.db.patch(existing._id, {
        notifyEmail,
        paused: false,
        simulate: args.simulate ?? existing.simulate,
        lastError: undefined,
      });
    } else {
      caseId = await ctx.db.insert("cases", {
        receiptNumber,
        notifyEmail,
        createdAt: now,
        simulate: args.simulate ?? false,
        simulateStep: 0,
        paused: false,
      });
    }

    await ctx.scheduler.runAfter(0, internal.poll.fetchCase, { caseId: caseId! });
    return { caseId: caseId!, receiptNumber };
  },
});

export const pause = mutation({
  args: { caseId: v.id("cases") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.caseId, { paused: true });
  },
});

export const pollNow = mutation({
  args: { caseId: v.id("cases") },
  handler: async (ctx, args) => {
    const watched = await ctx.db.get(args.caseId);
    if (!watched) throw new Error("Case not found.");
    await ctx.db.patch(args.caseId, { lastError: undefined, paused: false });
    await ctx.scheduler.runAfter(0, internal.poll.fetchCase, {
      caseId: args.caseId,
    });
  },
});

export const simulateNext = mutation({
  args: { caseId: v.id("cases") },
  handler: async (ctx, args) => {
    const watched = await ctx.db.get(args.caseId);
    if (!watched) throw new Error("Case not found.");
    await ctx.db.patch(args.caseId, { simulate: true, lastError: undefined });
    await ctx.scheduler.runAfter(0, internal.poll.advanceSimulation, {
      caseId: args.caseId,
    });
  },
});
