# PatternUp repo map (Order step 1)

Mapped: 2026-10-02 against GitHub checkout `chikoshire/pattern-up`, live product [patternup.io](https://patternup.io), and product brief `docs/project-context.md`.

## Verdict

**GitHub checkout is not the application source.** It is a public showcase README only (“Source private by design”). The running product is a separate Vite + React + Supabase + Stripe SPA deployed on Vercel/Cloudflare. Private app source is **not** linked to this Cloud Agent environment, so Order step 2 lands plan-limits + usage code in this repo as the git-tracked product surface to merge once the private app is connected.

## What the GitHub repo has

| Path | Status |
|------|--------|
| `/workspace/README.md` | Showcase narrative + link to `pattern-up-app.vercel.app` |
| App source (`src/`, `supabase/`, etc.) | **Missing** |
| Auth / billing / agent runner code | **Missing** |

Branch at map time: `main` @ `b29a4fa` — single commit, no app history.

## Live product stack (from deployed `patternup.io` bundle)

| Layer | What exists |
|-------|-------------|
| Frontend | Vite SPA, React, React Router, TanStack Query, Radix UI, Tailwind-style tokens |
| Auth | Supabase Auth (`localStorage` session, `persistSession`, `/auth` + signup tabs) |
| Data | Supabase project ref embedded in bundle: `zzvqivfthlikwkcqthba` (DNS NXDOMAIN from this environment; not in Supabase MCP project list) |
| Older/staging URL | `pattern-up-app.vercel.app` still ships an older bundle pointing at Orbit project `ahwgejxbmympgnumkoby` (`tuxx-orbit`, inactive) |
| Billing | Stripe Checkout via edge `create-checkout` / `customer-portal` / `check-subscription`; client catalog still **Starter $89 / Growth $179 / Scale $299** |
| Agent runner | Large set of Supabase Edge Functions invoked from the client (content, audit, social, Reddit, Unipile, GSC, etc.) |

### App routes that exist in production

`/app`, `/app/dashboard`, `/app/audit`, `/app/content`, `/app/composer`, `/app/schedule`, `/app/social`, `/app/engagement`, `/app/reddit`, `/app/voice`, `/app/accounts`, `/app/agents`, `/app/analytics`, `/app/backlinks`, `/app/networking`, `/app/prospects`, `/app/ideas`, `/app/viral`, `/app/carousels`, `/app/trending`, `/app/tools`, `/app/settings/*`, `/app/x-agent`, `/app/linkedin-agent`, plus public `/pricing`, `/auth`, `/reddit-agent`, `/seo-vs-geo`, blog/case-study surfaces.

**No `/app/usage` route** — usage is a Settings → Billing panel (“Usage this month”), not a dedicated page.

### Supabase tables referenced by the client (concrete)

`workspaces`, `workspace_members`, `sites`, `profiles`, `user_roles`, `personas`, `persona_workspaces`, `articles`, `article_settings`, `audits`, `audit_issues`, `geo_audits`, `geo_audit_results`, `social_accounts`, `social_posts`, `channel_posts`, `cms_connections`, `reddit_keywords`, `reddit_mentions`, `usage_counters`, `backlinks`, `backlink_credits`, `backlink_exchange_queue`, `seed_network_sites`, `seed_backlinks`, `engagement_*`, `unipile_accounts`, `notifications`, `affiliates`, `carousels`, `post_ideas`, `viral_*`, and related analytics snapshot tables.

`usage_counters` columns used by client: `workspace_id`, `period` (`YYYY-MM`), `articles`, `images`, `slideshows`, `videos`, `dataforseo_queries`.

### Edge functions the client calls (agent / publish / billing)

Content & SEO: `generate-content`, `regenerate-article`, `generate-content-plan`, `generate-programmatic-seo`, `run-audit`, `run-geo-audit`, `cms-publish`, `recycle-evergreen`, `fetch-gsc-analytics`, `learn-from-analytics`, `scan-brand-website`, `verify-site-ownership`.

Social / engage: `social-oauth-start`, `social-publish`, `generate-social-post`, `generate-social-reply`, `generate-tiktok-slideshow`, `generate-carousel`, `carousel-publish`, Reddit (`reddit-scrape`, `generate-reddit-reply`, `reddit-comment`, `seed-reddit-monitoring`, `suggest-subreddits`, `find-google-ranking-threads`), Unipile (`unipile-*` connect/pull/comment/react/network).

Billing: `check-subscription`, `create-checkout`, `customer-portal`, `language-addon-checkout`.

Other: `ai-assist`, `support-chat`, `build-playbook`, `backlink-matching`, `seed-backlinks`, affiliate/viral tools.

## Area-by-area vs product brief

### Audit

- **Works in product:** `/app/audit`, `run-audit`, `run-geo-audit`, `audits` / `geo_audits` tables, dashboard “latest audit score”.
- **Gap:** Brief wants self-serve audit → growth plan → visibility score driving plan actions from product events. Growth plan UI exists as marketing + in-app content plan generation; not clearly wired as the Signal/Compound/Network entitlement gate.

### Plan (growth plan / entitlements)

- **Works:** Client `PLAN_CONFIG`-style object with `starter` / `growth` / `scale` / `early_access`. Helpers: `getPlanLimits(tier)`, unlimited check. Default tier **`early_access`** with effectively unlimited limits. Settings Billing tab shows meters for articles / AI images / slideshows and copy: “You’re on early access — generation is unlimited while billing is being set up.” Stripe price IDs exist for starter/growth/scale.
- **Gaps vs brief:**
  - Wrong SKUs/prices: Starter $89 / Growth $179 / Scale $299 — **not** Signal $29 / Compound $99 / Network $299.
  - Limits tracked: `brands`, `articlesPerMonth`, `imagesPerMonth`, `slideshowsPerMonth` only.
  - Missing caps: web searches/article (10 on Signal), X link posts (0 Signal / 8 Compound), citation query budgets, social draft/week caps, Network 5-brand + programmatic, **extra brand $49**.
  - Language add-on checkout exists; **no extra-brand $49 SKU**.
  - No $10 publishing plan in live catalog (good), but also no explicit ban of agency/$499 service SKU in code.
  - Billing UI still says “Billing & plans are coming soon” under the usage meters.

### Publish

- **Works:** `cms-publish`, `cms_connections`, `social-publish`, schedule/composer routes, carousels/TikTok slideshow generators.
- **Gaps / safety:** Unipile credential connect (`unipile-connect-credentials`) implies cloud-held social sessions — conflicts with brief “official APIs only / no stealth browsers / no social logins in cloud browsers.” `social-oauth-start` is the preferred OAuth path and should be the only send path going forward. No evidence of stealth browser in the PatternUp client bundle; Orbit project separately has `kernel-browser` (not PatternUp).

### Personas

- **Works:** `personas`, `persona_workspaces`, `sites.persona_id`, `/app/voice` (“Brand Voice”), brand types include brand / personal / AI influencer.
- **Gaps:** Brief: Signal & Compound = one persona; Network = one per brand. No hard plan-gated persona/brand counts matching Signal/Compound/Network (current brand limits are 1/3/12 on starter/growth/scale).

### Reddit

- **Works:** `/app/reddit`, public `/reddit-agent`, scrape/reply/comment edge functions, `reddit_keywords` / `reddit_mentions`.
- **Gaps:** Brief wants Reddit in the engagement approval queue with plan gating; current surface is a full Reddit agent, not clearly draft-only on Signal.

### Auth

- **Works:** Supabase email auth at `/auth`; workspace membership; site/brand switching; “all brands” view.
- **Gaps:** Private source + active PatternUp Supabase project not available to this agent for schema/RLS verification. MCP org has Orbit (`ahwgejxbmympgnumkoby`) and other products, not `zzvqivfthlikwkcqthba`.

### Billing

- **Works:** Stripe product/price IDs for three paid tiers; checkout + portal functions; early_access free default; usage counter read for meters.
- **Gaps:** Prices/names wrong vs brief; extra brand $49 missing; no enforcement that Signal cannot silently consume Compound-level work beyond soft meters under unlimited early access; no dedicated Usage page; billing management UI unfinished.

### Agent runner

- **Works:** Specialized edge functions for audit → content → images/carousels → social/Reddit → measure (GSC/analytics/playbook). Matches the brief’s “specialized short steps” direction more than a single general agent.
- **Gaps:** No first-class approval queue pipeline yet (Order step 3+). Programmatic SEO function exists (`generate-programmatic-seo`) but must be Network-gated. Citation monitor / llms.txt / schema-on-publish not confirmed as complete product surfaces.

## Gaps summary (priority for Order step 2)

1. Replace Starter/Growth/Scale with **Signal / Compound / Network** (+ **extra brand $49**); keep early_access free until billing flag on.
2. Expand limits beyond articles/images/slideshows: **searches, X link posts, brands, citation/social draft caps**.
3. Enforce caps in product code (client + edge), not meter-only under unlimited early access.
4. Add dedicated **Usage page** so Signal cannot silently look like Compound.
5. **Blocker:** private application repo not checked out; cannot patch Lovable/private source or deploy to patternup.io from this environment alone.

## Sources for this map

- Git checkout `/workspace` (`chikoshire/pattern-up`)
- Deployed JS: `https://patternup.io/assets/index-D6pS28VT.js` and older `pattern-up-app.vercel.app` bundle
- Supabase MCP: org projects list (PatternUp ref not present / not manageable here)
- Product brief: `/cursor/stores/self/docs/project-context.md`
