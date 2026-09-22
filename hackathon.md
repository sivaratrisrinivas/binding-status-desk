# Binding Status Desk — All Gas Hackathon

## One-liner
Paste your USCIS receipt number; we watch the public case status and show only what changed, in plain language.

## Problem
People refresh egov.uscis.gov and guess what a status change means. Noise, anxiety, no timeline of diffs.

## Approach
- Firecrawl fetches public case status
- Convex stores cases + status snapshots + diffs
- OpenAI explains diffs in plain language (explicitly not legal advice)
- AgentMail notifies on real changes
- Live on *.convex.site

## Constraints
Everyday app, not a developer tool. No legal advice claims. Real Firecrawl / AgentMail / OpenAI / Convex depth.
