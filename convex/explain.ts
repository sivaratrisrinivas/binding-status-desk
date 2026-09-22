import { v } from "convex/values";
import { internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { fallbackPlainLanguage } from "./lib/diff";

const DISCLAIMER =
  "This is a plain-language restatement of public Case Status Online text. It is not legal advice, not a prediction, and not affiliated with USCIS.";

export const explainDiff = internalAction({
  args: { diffId: v.id("statusDiffs") },
  handler: async (ctx, args) => {
    const diff = await ctx.runQuery(internal.explain.getDiff, {
      diffId: args.diffId,
    });
    if (!diff) return;

    const fallback = fallbackPlainLanguage(
      diff.beforeTitle
        ? {
            statusTitle: diff.beforeTitle,
            description: diff.beforeDescription ?? "",
          }
        : null,
      {
        statusTitle: diff.afterTitle,
        description: diff.afterDescription,
      },
    );

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      await ctx.runMutation(internal.snapshots.setPlainLanguage, {
        diffId: args.diffId,
        plainLanguage: fallback,
      });
      return;
    }

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content:
                "You restate a change on the public USCIS Case Status Online website for a worried family member. You are not a lawyer. Never give legal advice. Never say what someone should file, argue, or expect. Never predict approval or denial. Never claim affiliation with USCIS. Stay under 70 words. End with: Not legal advice.",
            },
            {
              role: "user",
              content: JSON.stringify({
                beforeHeading: diff.beforeTitle,
                afterHeading: diff.afterTitle,
                beforeDescription: diff.beforeDescription,
                afterDescription: diff.afterDescription,
                changedFields: diff.changedFields,
              }),
            },
          ],
        }),
      });
      if (!response.ok) {
        throw new Error(`OpenAI HTTP ${response.status}`);
      }
      const body = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const text = body.choices?.[0]?.message?.content?.trim();
      await ctx.runMutation(internal.snapshots.setPlainLanguage, {
        diffId: args.diffId,
        plainLanguage: text && text.length > 0 ? `${text}\n\n${DISCLAIMER}` : fallback,
      });
    } catch {
      await ctx.runMutation(internal.snapshots.setPlainLanguage, {
        diffId: args.diffId,
        plainLanguage: fallback,
      });
    }
  },
});

export const getDiff = internalQuery({
  args: { diffId: v.id("statusDiffs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.diffId);
  },
});
