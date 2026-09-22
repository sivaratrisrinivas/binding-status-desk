import { v } from "convex/values";
import { internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { fallbackPlainLanguage } from "./lib/diff";

const DISCLAIMER =
  "This is a plain-language restatement of public Case Status Online text. It is not legal advice, not a prediction, and not affiliated with USCIS.";

const SYSTEM_PROMPT =
  "You restate a change on the public USCIS Case Status Online website for a worried family member. You are not a lawyer. Never give legal advice. Never say what someone should file, argue, or expect. Never predict approval or denial. Never claim affiliation with USCIS. Stay under 70 words. End with: Not legal advice.";

// Groq retired llama-3.1-8b-instant for free/developer on 2026-08-16.
const GROQ_MODEL = "openai/gpt-oss-20b";

type ChatProvider = {
  url: string;
  apiKey: string;
  model: string;
  errorLabel: string;
};

function resolveProvider(): ChatProvider | null {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    return {
      url: "https://api.openai.com/v1/chat/completions",
      apiKey: openaiKey,
      model: "gpt-4o-mini",
      errorLabel: "OpenAI",
    };
  }
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    return {
      url: "https://api.groq.com/openai/v1/chat/completions",
      apiKey: groqKey,
      model: GROQ_MODEL,
      errorLabel: "Groq",
    };
  }
  return null;
}

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

    const provider = resolveProvider();
    if (!provider) {
      await ctx.runMutation(internal.snapshots.setPlainLanguage, {
        diffId: args.diffId,
        plainLanguage: fallback,
      });
      return;
    }

    try {
      const response = await fetch(provider.url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: provider.model,
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content: SYSTEM_PROMPT,
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
        throw new Error(`${provider.errorLabel} HTTP ${response.status}`);
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
