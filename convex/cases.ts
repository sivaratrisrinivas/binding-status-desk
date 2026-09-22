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
    const row = await ctx.db
      .query("cases")
      .withIndex("by_receipt", (q) => q.eq("receiptNumber", receiptNumber))
      .unique();
    if (!row) return null;
    // Public projection: omit notifyEmail and other private watcher fields.
    return {
      _id: row._id,
      receiptNumber: row.receiptNumber,
      createdAt: row.createdAt,
      lastPolledAt: row.lastPolledAt,
      lastError: row.lastError,
      lastStatusTitle: row.lastStatusTitle,
      simulate: row.simulate,
      simulateStep: row.simulateStep,
      paused: row.paused,
    };
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
    const row = rows[0];
    if (!row) return null;
    return {
      statusTitle: row.statusTitle,
      description: row.description,
      formType: row.formType,
      eventDate: row.eventDate,
      source: row.source,
      fetchedAt: row.fetchedAt,
    };
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

    // TODO(ask-user): public watch/pollNow/simulateNext quota / auth for shared demo
    const now = Date.now();
    let caseId = existing?._id;
    if (existing) {
      const patch: {
        paused: boolean;
        simulate: boolean;
        lastError?: string;
        notifyEmail?: string;
      } = {
        paused: false,
        simulate: args.simulate ?? existing.simulate,
        lastError: undefined,
      };
      // Only attach email when this case has none. Never clear or replace
      // another watcher's notifyEmail on the shared global-by-receipt row.
      if (notifyEmail && !existing.notifyEmail) {
        patch.notifyEmail = notifyEmail;
      }
      await ctx.db.patch(existing._id, patch);
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
    // TODO(ask-user): sticky simulate:true vs one-shot ladder
    await ctx.db.patch(args.caseId, { simulate: true, lastError: undefined });
    await ctx.scheduler.runAfter(0, internal.poll.advanceSimulation, {
      caseId: args.caseId,
    });
  },
});
