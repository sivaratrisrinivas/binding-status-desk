# Hackathon log

- **Project:** Binding Status Desk
- **Event:** Convex All Gas Hackathon (OpenAI, Firecrawl, AgentMail)
- **What it does:** Paste a USCIS receipt number; watch the public Case Status Online page; show a live Convex timeline of diffs only, with a plain-language restatement that is explicitly not legal advice.
- **Live app:** not deployed
- **Repo:** https://github.com/sivaratrisrinivas/binding-status-desk
- **Frontend:** Convex static hosting
- **Convex deployment:** not deployed
- **Components:** @convex-dev/static-hosting
- **Convex features:** schema, tables, indexes, queries, mutations, actions, HTTP actions, crons, scheduled functions
- **Auth:** none
- **AI models:** gpt-4o-mini
- **Started:** 2026-09-22T03:00:08Z
- **Last updated:** 2026-09-22T05:40:00Z

## Log

### 2026-09-22 - b92152e
Placeholder README for the Binding Status Desk immigration wedge.

### 2026-09-22 - d09e541
Placeholder `hackathon.md` for the All Gas / vibeapps submission.

### 2026-09-22 - fb4836e
Spiked public USCIS Case Status Online. Naive HTTP GET to `https://egov.uscis.gov/` is Cloudflare 403. Firecrawl scrape of the landing page returns the receipt form (`#receipt_number`, disabled `button[name=initCaseSearch]`). Firecrawl Interact was Forbidden on the keyless tier. Scrape+actions with a native HTMLInputElement value setter, `input`/`change` events, and a click on Check Status returned usable status text for `IOE0900000001` (`h2#landing-page-header` = “Card Was Delivered To Me By The Post Office”, following paragraph with date August 10, 2015). No permit-desk fallback: Firecrawl returned status text. Documented in `docs/spike-uscis.md`.

Built the Convex app: `cases`, `statusSnapshots`, `statusDiffs`, `inboundMail` (`convex/schema.ts`); public watch/poll/simulate mutations and live queries (`convex/cases.ts`); snapshot + diff engine (`convex/snapshots.ts`, `convex/lib/diff.ts`, `convex/lib/parseStatus.ts`); Firecrawl Node action (`convex/poll.ts`); OpenAI restatement action labeled not legal advice (`convex/explain.ts`); AgentMail send, inbound webhook, and inbox poll (`convex/mail.ts`, `convex/http.ts`); 10-minute status cron and 5-minute mail cron (`convex/crons.ts`); Vite UI with one paste-receipt flow and a clearly labeled DEMO simulate ladder (`src/App.tsx`); static hosting component (`convex/convex.config.ts`). Live `*.convex.site` URL is still blocked on Convex login / deploy key.

## Secrets still needed

- `FIRECRAWL_API_KEY` — live fetches from Convex (spike used Firecrawl keyless CLI)
- `OPENAI_API_KEY` — LLM restatements (deterministic fallback exists)
- `AGENTMAIL_API_KEY`, `AGENTMAIL_INBOX_ID`, `AGENTMAIL_WEBHOOK_SECRET` — real mail
- Convex captain auth: `npx convex login` (open https://dashboard.convex.dev/auth) or `CONVEX_DEPLOY_KEY`, then `npm run deploy`

## How to demo (once deployed)

1. Open the `*.convex.site` URL.
2. Paste `IOE0900000001` and press Watch this receipt (real Firecrawl path).
3. Press **DEMO: simulate a change** to force a labeled fake diff.
4. Optional: add an email so AgentMail fires on the next real or simulated diff.

### 2026-09-22 - captain decisions
Captain locked: DEMO simulate is one-shot (`simulateNext` does not set `simulate:true`; Firecrawl cron stays eligible). AgentMail webhook returns 401 when `AGENTMAIL_WEBHOOK_SECRET` is unset (local and prod). Public watch/pollNow/simulateNext stay keyless with a light per-receipt and global rate limit (`convex/lib/rateLimit.ts`, `rateLimits` table).
