"use node";

import { v } from "convex/values";
import { Firecrawl } from "firecrawl";
import { internalAction, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { parseUscisStatus, snapshotHash } from "./lib/parseStatus";
import { SIMULATE_LADDER, type SimulatedStatus } from "./lib/simulateLadder";

function fillReceiptScript(receiptNumber: string): string {
  const value = JSON.stringify(receiptNumber);
  return `(() => { const el = document.getElementById("receipt_number"); if (!el) return; const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set; setter.call(el, ${value}); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); })();`;
}

function firecrawlClient(): Firecrawl {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  return apiKey ? new Firecrawl({ apiKey }) : new Firecrawl();
}

async function fetchPublicUscisStatus(receiptNumber: string) {
  const firecrawl = firecrawlClient();
  const doc = await firecrawl.scrape("https://egov.uscis.gov/", {
    formats: ["markdown", "html"],
    waitFor: 1500,
    timeout: 90_000,
    actions: [
      { type: "wait", milliseconds: 2000 },
      { type: "executeJavascript", script: fillReceiptScript(receiptNumber) },
      { type: "wait", milliseconds: 800 },
      { type: "click", selector: "button[name=initCaseSearch]" },
      { type: "wait", milliseconds: 7000 },
    ],
  });
  const parsed = parseUscisStatus({
    markdown: doc.markdown,
    html: doc.html,
  });
  return {
    ...parsed,
    rawMarkdown: doc.markdown ?? doc.html ?? "",
  };
}

type ApplySimulationResult =
  | { skipped: true }
  | { ok: true; title: string; step: number };

async function applySimulation(
  ctx: ActionCtx,
  caseId: Id<"cases">,
  refreshOnly: boolean,
): Promise<ApplySimulationResult> {
  const watched: Doc<"cases"> | null = await ctx.runQuery(
    internal.cases.getInternal,
    { caseId },
  );
  if (!watched) return { skipped: true as const };

  const hasSnapshot = Boolean(watched.lastStatusTitle);
  const step: number = refreshOnly
    ? Math.min(watched.simulateStep, SIMULATE_LADDER.length - 1)
    : hasSnapshot
      ? Math.min(watched.simulateStep + 1, SIMULATE_LADDER.length - 1)
      : 0;

  const status: SimulatedStatus = SIMULATE_LADDER[step] ?? SIMULATE_LADDER[0];
  const description = status.description.replaceAll(
    "DEMO000000001",
    watched.receiptNumber,
  );
  const parsed: {
    statusTitle: string;
    description: string;
    formType?: string;
    eventDate?: string;
    lookupOk: true;
  } = {
    statusTitle: status.statusTitle,
    description,
    formType: status.formType,
    eventDate: status.eventDate,
    lookupOk: true,
  };
  await ctx.runMutation(internal.snapshots.recordSnapshot, {
    caseId,
    source: "simulate",
    statusTitle: parsed.statusTitle,
    description: parsed.description,
    formType: parsed.formType,
    eventDate: parsed.eventDate,
    contentHash: snapshotHash(parsed),
    rawMarkdown: `SIMULATED\n## ${parsed.statusTitle}\n\n${parsed.description}`,
    simulateStep: step,
  });
  return { ok: true as const, title: parsed.statusTitle, step };
}

export const fetchCase = internalAction({
  args: { caseId: v.id("cases") },
  handler: async (ctx, args) => {
    const watched = await ctx.runQuery(internal.cases.getInternal, {
      caseId: args.caseId,
    });
    if (!watched || watched.paused) return { skipped: true as const };

    try {
      const parsed = await fetchPublicUscisStatus(watched.receiptNumber);
      if (!parsed.lookupOk) {
        await ctx.runMutation(internal.snapshots.markPolled, {
          caseId: args.caseId,
          error:
            parsed.error === "still-on-landing-form"
              ? "The public Case Status Online page did not return a status. The Check Status form stayed on screen (often a WAF/captcha). Try Check again, or use DEMO simulate."
              : `Could not parse a public status (${parsed.error ?? "unknown"}).`,
        });
        return { ok: false as const, error: parsed.error };
      }
      await ctx.runMutation(internal.snapshots.recordSnapshot, {
        caseId: args.caseId,
        source: "firecrawl",
        statusTitle: parsed.statusTitle,
        description: parsed.description,
        formType: parsed.formType,
        eventDate: parsed.eventDate,
        contentHash: snapshotHash(parsed),
        rawMarkdown: parsed.rawMarkdown,
      });
      return { ok: true as const, title: parsed.statusTitle };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Firecrawl fetch failed.";
      await ctx.runMutation(internal.snapshots.markPolled, {
        caseId: args.caseId,
        error: message,
      });
      return { ok: false as const, error: message };
    }
  },
});

export const advanceSimulation = internalAction({
  args: {
    caseId: v.id("cases"),
    refreshOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<ApplySimulationResult> => {
    return await applySimulation(ctx, args.caseId, args.refreshOnly ?? false);
  },
});
