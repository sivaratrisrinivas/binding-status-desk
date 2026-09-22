# Binding Status Desk

Paste a USCIS receipt number. Watch the public Case Status Online page. See a live timeline of **diffs only**, with a plain-language restatement of each change.

This is **plain-language status watching, not legal advice**. It is not affiliated with USCIS or the Department of Homeland Security. It does not file forms, predict outcomes, or tell anyone what to do.

Everyday app for the Convex All Gas hackathon (OpenAI, Firecrawl, AgentMail).

## What it does

1. You paste a 13-character USCIS receipt number (skip dashes).
2. A Convex action uses **Firecrawl** to fill the public form at [egov.uscis.gov](https://egov.uscis.gov/) and read the status heading + description.
3. Convex stores `cases`, `statusSnapshots`, and `statusDiffs`. Unchanged polls are silent.
4. When the public text actually changes, **OpenAI** writes a short restatement labeled not legal advice.
5. **AgentMail** emails you on real diffs, and can start a watch if you email a receipt number to the desk inbox.
6. **DEMO simulate** is a clearly labeled fake status ladder so judges can see diffs without waiting on a real receipt.

## Spike result (USCIS, not a permit fallback)

Naive HTTP to `https://egov.uscis.gov/` is **Cloudflare 403**. Firecrawl scrape + form actions **does** return usable public status text. Details: [`docs/spike-uscis.md`](docs/spike-uscis.md).

Public sample used in the spike: `IOE0900000001` → heading *Card Was Delivered To Me By The Post Office*.

## Stack

- Vite + React frontend on **Convex static hosting** (`*.convex.site`)
- Convex schema, queries, mutations, Node actions, HTTP actions, crons, scheduler
- Firecrawl scrape actions against Case Status Online
- OpenAI `gpt-4o-mini` for plain-language diffs
- AgentMail send + webhook (`/api/agentmail/webhook`) + inbox poll cron

## Local development

```bash
npm install
npx convex login
npx convex dev          # writes .env.local with VITE_CONVEX_URL
npm run dev             # Vite on localhost
```

Parser tests (no network):

```bash
npm run test:parse
```

## Environment variables

Set these on the Convex deployment (`npx convex env set NAME value` or Dashboard → Settings → Environment Variables). Do not commit secrets.

| Name | Required for | Notes |
| --- | --- | --- |
| `FIRECRAWL_API_KEY` | Live USCIS fetches from Convex | Official Firecrawl key (`fc-…`). The CLI spike used the keyless tier; Convex outbound IPs may need a real key. |
| `OPENAI_API_KEY` | LLM restatements | If missing, diffs still store a deterministic restatement. Model: `gpt-4o-mini`. |
| `AGENTMAIL_API_KEY` | Outbound + inbound mail | `am_…` from [AgentMail](https://www.agentmail.to/docs/quickstart). |
| `AGENTMAIL_INBOX_ID` | Mail | Inbox used to send and list messages. |
| `AGENTMAIL_WEBHOOK_SECRET` | Signed inbound webhook | Svix `whsec_…`. If unset, the webhook still accepts POSTs so you can test; set this before sharing the URL. |

Frontend build:

| Name | Notes |
| --- | --- |
| `VITE_CONVEX_URL` | Set automatically by `npx convex dev` and `npx @convex-dev/static-hosting deploy`. |

## Deploy to `*.convex.site`

```bash
npx convex login
npx convex env set FIRECRAWL_API_KEY fc-…
npx convex env set OPENAI_API_KEY sk-…
npx convex env set AGENTMAIL_API_KEY am-…
npx convex env set AGENTMAIL_INBOX_ID …
npx convex env set AGENTMAIL_WEBHOOK_SECRET whsec_…
npm run deploy
```

`npm run deploy` runs `@convex-dev/static-hosting deploy`: backend push + Vite build with `VITE_CONVEX_URL` + upload of `dist/` to the Convex site.

Point AgentMail’s webhook at:

```
https://<deployment>.convex.site/api/agentmail/webhook
```

Subscribe to `message.received`.

If this Cloud Agent cannot complete `npx convex login`, a human must open [https://dashboard.convex.dev/auth](https://dashboard.convex.dev/auth), paste the device token, or set `CONVEX_DEPLOY_KEY` and re-run `npm run deploy`. Do not invent a live URL.

## DEMO simulate

Check **DEMO simulate mode** before watching, or press **DEMO: simulate a change** on a watched receipt. Simulated rows are labeled in the timeline. They are not USCIS results.

## Out of scope

Legal advice, form filing, scraping behind login, claiming an official USCIS partnership.
