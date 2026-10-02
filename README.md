# Pattern Up

**AI SEO / GEO content-automation SaaS.** Create, post and engage everywhere — on autopilot.

> Product: [patternup.io](https://patternup.io)

## Plans (binding)

| Plan | Price | Notes |
|------|-------|-------|
| Signal | $29/mo | 1 brand, drafts only, no X link posts, 10 searches/article |
| Compound | $99/mo | Homepage tier, approved API send, X link posts capped at 8/mo |
| Network | $299/mo | Up to 5 brands, programmatic + exchange |
| Extra brand | $49/mo | Compound add-on |

Early access stays free until `BILLING_ENABLED` is flipped in `src/lib/plans.ts`. No $10 publishing plan. No $499 service SKU.

## This repository

Public marketing previously lived here alone. Application plan-limits + usage UI now land in-repo:

- `src/lib/plans.ts` — catalog, caps, hard enforcement
- `src/pages/UsagePage.tsx` — `/app/usage` so Signal cannot silently look like Compound
- `internal/repo-map.md` (agent store) — map of live private app vs brief

### Develop

```bash
npm install
npm run test
npm run dev
```

Open `/app/usage` for the usage page.

### Stack match

Vite + React + TypeScript, aligned with the live Pattern Up SPA. Wire `usage_counters` + Stripe subscription to replace the demo workspace state in `src/lib/usage.ts` when the private app source is linked.
