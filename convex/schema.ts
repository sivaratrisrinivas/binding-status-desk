import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  cases: defineTable({
    receiptNumber: v.string(),
    notifyEmail: v.optional(v.string()),
    createdAt: v.number(),
    lastPolledAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    lastStatusTitle: v.optional(v.string()),
    simulate: v.boolean(),
    simulateStep: v.number(),
    paused: v.boolean(),
  })
    .index("by_receipt", ["receiptNumber"])
    .index("by_paused_polled", ["paused", "lastPolledAt"]),

  statusSnapshots: defineTable({
    caseId: v.id("cases"),
    fetchedAt: v.number(),
    source: v.union(v.literal("firecrawl"), v.literal("simulate")),
    statusTitle: v.string(),
    description: v.string(),
    formType: v.optional(v.string()),
    eventDate: v.optional(v.string()),
    contentHash: v.string(),
    rawMarkdown: v.string(),
  }).index("by_case", ["caseId"]),

  statusDiffs: defineTable({
    caseId: v.id("cases"),
    fromSnapshotId: v.optional(v.id("statusSnapshots")),
    toSnapshotId: v.id("statusSnapshots"),
    changedFields: v.array(v.string()),
    beforeTitle: v.optional(v.string()),
    afterTitle: v.string(),
    beforeDescription: v.optional(v.string()),
    afterDescription: v.string(),
    plainLanguage: v.string(),
    createdAt: v.number(),
    simulated: v.boolean(),
    notifiedAt: v.optional(v.number()),
    mailStatus: v.optional(v.string()),
  }).index("by_case", ["caseId"]),

  inboundMail: defineTable({
    eventId: v.string(),
    receivedAt: v.number(),
    handled: v.string(),
    receiptNumber: v.optional(v.string()),
  }).index("by_eventId", ["eventId"]),

  rateLimits: defineTable({
    key: v.string(),
    windowStart: v.number(),
    count: v.number(),
  }).index("by_key", ["key"]),
});
