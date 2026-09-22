import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { findReceiptInText, isValidReceipt, normalizeReceipt } from "./lib/receipt";
import { inboundMessageDedupeId } from "./lib/inboundEvent";

const DISCLAIMER =
  "Plain-language status watching of the public USCIS Case Status Online page. Not legal advice. Not affiliated with USCIS or DHS.";

function inboxId(): string | undefined {
  return process.env.AGENTMAIL_INBOX_ID;
}

function apiKey(): string | undefined {
  return process.env.AGENTMAIL_API_KEY;
}

export const notifyDiff = internalAction({
  args: { diffId: v.id("statusDiffs") },
  handler: async (ctx, args) => {
    const key = apiKey();
    const inbox = inboxId();
    const diff = await ctx.runQuery(internal.mail.getDiffWithCase, {
      diffId: args.diffId,
    });
    if (!diff) return;
    if (!diff.notifyEmail) {
      await ctx.runMutation(internal.snapshots.setMailStatus, {
        diffId: args.diffId,
        mailStatus: "skipped-no-email",
      });
      return;
    }
    if (!key || !inbox) {
      await ctx.runMutation(internal.snapshots.setMailStatus, {
        diffId: args.diffId,
        mailStatus: "skipped-missing-agentmail-env",
      });
      return;
    }

    const subject = `Public status change for ${diff.receiptNumber}`;
    const text = [
      `The public Case Status Online page changed for receipt ${diff.receiptNumber}.`,
      "",
      diff.beforeTitle
        ? `Previous public heading: ${diff.beforeTitle}`
        : "No previous public heading on file.",
      `Current public heading: ${diff.afterTitle}`,
      "",
      "Plain-language restatement:",
      diff.plainLanguage,
      "",
      DISCLAIMER,
      diff.simulated ? "This particular row was created by DEMO simulate mode." : "",
    ]
      .filter((line) => line !== "")
      .join("\n");

    try {
      const response = await fetch(
        `https://api.agentmail.to/v0/inboxes/${encodeURIComponent(inbox)}/messages/send`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: diff.notifyEmail,
            subject,
            text,
          }),
        },
      );
      if (!response.ok) {
        const body = await response.text();
        throw new Error(`AgentMail HTTP ${response.status}: ${body.slice(0, 200)}`);
      }
      await ctx.runMutation(internal.snapshots.setMailStatus, {
        diffId: args.diffId,
        mailStatus: "sent",
        notifiedAt: Date.now(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "send failed";
      await ctx.runMutation(internal.snapshots.setMailStatus, {
        diffId: args.diffId,
        mailStatus: `error:${message.slice(0, 180)}`,
      });
    }
  },
});

export const ingestInbound = internalAction({
  args: {
    eventId: v.string(),
    subject: v.optional(v.string()),
    text: v.optional(v.string()),
    fromEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const combined = `${args.subject ?? ""}\n${args.text ?? ""}`;
    const found = findReceiptInText(combined);
    const handled = await ctx.runMutation(internal.mail.recordInbound, {
      eventId: args.eventId,
      receiptNumber: found ?? undefined,
    });
    if (!handled.fresh) return { duplicate: true as const };

    if (!found || !isValidReceipt(found)) {
      if (args.fromEmail) {
        await sendDeskMail(
          args.fromEmail,
          "We could not find a receipt number",
          `I looked for a 13-character USCIS receipt number (three letters and ten numbers) in your message and did not find one.\n\n${DISCLAIMER}`,
        );
      }
      return { ok: false as const, reason: "no-receipt" };
    }

    await ctx.runMutation(internal.mail.watchFromMail, {
      receiptNumber: found,
      notifyEmail: args.fromEmail,
    });

    if (args.fromEmail) {
      await sendDeskMail(
        args.fromEmail,
        `Watching public status for ${found}`,
        `I started watching the public Case Status Online page for ${found}. I will email you only if that public text actually changes.\n\n${DISCLAIMER}`,
      );
    }
    return { ok: true as const, receiptNumber: found };
  },
});

export const pollInbox = internalAction({
  args: {},
  handler: async (ctx) => {
    const key = apiKey();
    const inbox = inboxId();
    if (!key || !inbox) return { skipped: true as const };

    const response = await fetch(
      `https://api.agentmail.to/v0/inboxes/${encodeURIComponent(inbox)}/messages?limit=10`,
      { headers: { Authorization: `Bearer ${key}` } },
    );
    if (!response.ok) {
      return { ok: false as const, status: response.status };
    }
    const body = (await response.json()) as {
      messages?: {
        message_id?: string;
        messageId?: string;
        subject?: string;
        extracted_text?: string;
        extractedText?: string;
        text?: string;
        from?: string | string[];
      }[];
    };
    const messages = body.messages ?? [];
    for (const message of messages) {
      const eventId = inboundMessageDedupeId({
        messageId: message.messageId,
        message_id: message.message_id,
      });
      if (!eventId) continue;
      const from = Array.isArray(message.from) ? message.from[0] : message.from;
      await ctx.runAction(internal.mail.ingestInbound, {
        eventId,
        subject: message.subject,
        text: message.extracted_text ?? message.extractedText ?? message.text,
        fromEmail: from,
      });
    }
    return { ok: true as const, count: messages.length };
  },
});

async function sendDeskMail(to: string, subject: string, text: string) {
  const key = apiKey();
  const inbox = inboxId();
  if (!key || !inbox) return;
  await fetch(
    `https://api.agentmail.to/v0/inboxes/${encodeURIComponent(inbox)}/messages/send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ to, subject, text }),
    },
  );
}

export const getDiffWithCase = internalQuery({
  args: { diffId: v.id("statusDiffs") },
  handler: async (ctx, args) => {
    const diff = await ctx.db.get(args.diffId);
    if (!diff) return null;
    const watched = await ctx.db.get(diff.caseId);
    if (!watched) return null;
    return {
      ...diff,
      receiptNumber: watched.receiptNumber,
      notifyEmail: watched.notifyEmail,
    };
  },
});

export const recordInbound = internalMutation({
  args: {
    eventId: v.string(),
    receiptNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("inboundMail")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .unique();
    if (existing) return { fresh: false };
    await ctx.db.insert("inboundMail", {
      eventId: args.eventId,
      receivedAt: Date.now(),
      handled: args.receiptNumber ? "watch" : "no-receipt",
      receiptNumber: args.receiptNumber,
    });
    return { fresh: true };
  },
});

export const watchFromMail = internalMutation({
  args: {
    receiptNumber: v.string(),
    notifyEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const receiptNumber = normalizeReceipt(args.receiptNumber);
    const existing = await ctx.db
      .query("cases")
      .withIndex("by_receipt", (q) => q.eq("receiptNumber", receiptNumber))
      .unique();
    let caseId = existing?._id;
    if (existing) {
      await ctx.db.patch(existing._id, {
        notifyEmail: args.notifyEmail ?? existing.notifyEmail,
        paused: false,
      });
    } else {
      caseId = await ctx.db.insert("cases", {
        receiptNumber,
        notifyEmail: args.notifyEmail,
        createdAt: Date.now(),
        simulate: false,
        simulateStep: 0,
        paused: false,
      });
    }
    await ctx.scheduler.runAfter(0, internal.poll.fetchCase, { caseId: caseId! });
    return { caseId };
  },
});
