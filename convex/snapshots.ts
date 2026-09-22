import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { diffFields, fallbackPlainLanguage } from "./lib/diff";

export const markPolled = internalMutation({
  args: {
    caseId: v.id("cases"),
    error: v.optional(v.string()),
    simulateStep: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const patch: {
      lastPolledAt: number;
      lastError?: string;
      simulateStep?: number;
    } = { lastPolledAt: Date.now() };
    patch.lastError = args.error;
    if (args.simulateStep !== undefined) patch.simulateStep = args.simulateStep;
    await ctx.db.patch(args.caseId, patch);
  },
});

export const recordSnapshot = internalMutation({
  args: {
    caseId: v.id("cases"),
    source: v.union(v.literal("firecrawl"), v.literal("simulate")),
    statusTitle: v.string(),
    description: v.string(),
    formType: v.optional(v.string()),
    eventDate: v.optional(v.string()),
    contentHash: v.string(),
    rawMarkdown: v.string(),
    simulateStep: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const watched = await ctx.db.get(args.caseId);
    if (!watched) throw new Error("Case not found.");

    const existing = await ctx.db
      .query("statusSnapshots")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .collect();
    existing.sort((a, b) => b.fetchedAt - a.fetchedAt);
    const previous = existing[0] ?? null;

    await ctx.db.patch(args.caseId, {
      lastPolledAt: Date.now(),
      lastError: undefined,
      lastStatusTitle: args.statusTitle,
      simulateStep: args.simulateStep ?? watched.simulateStep,
    });

    if (previous && previous.contentHash === args.contentHash) {
      return { changed: false, diffId: null };
    }

    const snapshotId = await ctx.db.insert("statusSnapshots", {
      caseId: args.caseId,
      fetchedAt: Date.now(),
      source: args.source,
      statusTitle: args.statusTitle,
      description: args.description,
      formType: args.formType,
      eventDate: args.eventDate,
      contentHash: args.contentHash,
      rawMarkdown: args.rawMarkdown,
    });

    if (!previous) {
      return { changed: false, diffId: null, snapshotId };
    }

    const after = {
      statusTitle: args.statusTitle,
      description: args.description,
      formType: args.formType,
      eventDate: args.eventDate,
    };
    const before = {
      statusTitle: previous.statusTitle,
      description: previous.description,
      formType: previous.formType,
      eventDate: previous.eventDate,
    };
    const changedFields = diffFields(before, after);
    if (changedFields.length === 0) {
      return { changed: false, diffId: null, snapshotId };
    }

    const diffId = await ctx.db.insert("statusDiffs", {
      caseId: args.caseId,
      fromSnapshotId: previous._id,
      toSnapshotId: snapshotId,
      changedFields,
      beforeTitle: previous.statusTitle,
      afterTitle: args.statusTitle,
      beforeDescription: previous.description,
      afterDescription: args.description,
      plainLanguage: fallbackPlainLanguage(before, after),
      createdAt: Date.now(),
      simulated: args.source === "simulate",
    });

    await ctx.scheduler.runAfter(0, internal.explain.explainDiff, { diffId });
    return { changed: true, diffId, snapshotId };
  },
});

export const setPlainLanguage = internalMutation({
  args: { diffId: v.id("statusDiffs"), plainLanguage: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.diffId, { plainLanguage: args.plainLanguage });
    await ctx.scheduler.runAfter(0, internal.mail.notifyDiff, {
      diffId: args.diffId,
    });
  },
});

export const setMailStatus = internalMutation({
  args: {
    diffId: v.id("statusDiffs"),
    mailStatus: v.string(),
    notifiedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.diffId, {
      mailStatus: args.mailStatus,
      notifiedAt: args.notifiedAt,
    });
  },
});

export const listDueCaseIds = internalMutation({
  args: {},
  handler: async (ctx) => {
    const staleBefore = Date.now() - 8 * 60 * 1000;
    const batchCap = 6;
    const due = [];
    // [paused, lastPolledAt]: missing lastPolledAt sorts first, then oldest.
    const rows = await ctx.db
      .query("cases")
      .withIndex("by_paused_polled", (q) => q.eq("paused", false))
      .take(50);
    for (const row of rows) {
      if (row.lastPolledAt !== undefined && row.lastPolledAt >= staleBefore) {
        break;
      }
      due.push(row);
      if (due.length >= batchCap) break;
    }
    for (const [i, row] of due.entries()) {
      await ctx.scheduler.runAfter(i * 25_000, internal.poll.fetchCase, {
        caseId: row._id,
      });
    }
    return due.length;
  },
});
