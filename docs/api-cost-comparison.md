# PatternUp API cost comparison (Gemini stack vs xAI Grok + X pay-per-use)

**Date:** 2026-10-02  
**Scope:** Decision doc before wiring new providers. Traced from live PatternUp edge functions on Supabase `zzvqivfthlikwkcqthba` (patternup.io). GitHub `chikoshire/pattern-up` is showcase-only; source of truth for models is `_shared/ai.ts` and the generators below.  
**No live customer account was run.** Quality notes use recorded prompts in those functions as fixtures.

---

## 1. Providers already in the product (traced)

| Role | Provider / model in code | Where called | Notes / price assumptions in code |
|------|--------------------------|--------------|-----------------------------------|
| **Draft (article)** | **Google `gemini-2.5-flash`** (default via `GEMINI_MODEL`) | `generate-content`, `daily-article-generator`, `regenerate-article` → `_shared/ai.ts` `geminiChat` | No $/token comments. Env: `GOOGLE_API_KEY` / `GEMINI_API_KEY`. |
| **Draft fallback text** | **OpenAI `gpt-4o-mini`** (or `OPENAI_MODEL`) | Same `geminiChat` — **preferred when `OPENAI_API_KEY` is set** | Comment: “when Gemini credits are unavailable.” |
| **Research / article web search** | **Not implemented on the article path** | `daily-article-generator` / `generate-content` invent stats from the model; no Serper/Tavily/DataForSEO HTTP calls | `usage_counters.dataforseo_queries` exists as a meter **with no caller** found. |
| **Images (articles / plan)** | **Google `gemini-3.1-flash-image-preview`** (“Nano Banana 2”) | `daily-article-generator`, `generate-content-plan` → `geminiImage` | Default `GEMINI_IMAGE_MODEL`. Code generates **4 images** per daily article. |
| **Images (LinkedIn composer)** | **OpenAI `gpt-image-1`** | `generate-linkedin-image` | Requires `OPENAI_API_KEY`; 1024×1024. |
| **Reply drafts** | **Gemini** (same `geminiChat`) | `generate-social-reply`, `generate-reddit-reply` | JSON of 3 reply options. |
| **Channel drafts** | Gemini; optional **Hugging Face `Qwen/Qwen2.5-7B-Instruct`** first if `HUGGINGFACE_API_KEY` / `HF_API_TOKEN` set | `generate-social-post` | HF tried first when key present; else Gemini. |
| **GEO citation check** | Gemini simulating an assistant | `run-geo-audit` | Does **not** call ChatGPT / Perplexity / Claude APIs — one Gemini answer per prompt, string-match brand. |
| **Search Console** | Google Search Console API | `fetch-gsc-analytics`, OAuth scopes `webmasters.readonly` | Free with user OAuth; refresh via `GOOGLE_CLIENT_ID` / `SECRET`. |
| **YouTube embed lookup** | YouTube Data API v3 search | `_shared/youtube.ts` when `include_youtube` | Fail-soft; 1 search, picks first embeddable. |
| **Social send** | Official APIs | `social-publish` | X `api.twitter.com/2/tweets`; LinkedIn UGC; Facebook/IG Graph; Bluesky AT Proto. **No $0.015 / $0.20 shown in code today.** |
| **Engagement / viral** | Unipile; SociaVault | `unipile-*`, `viral-search` | LinkedIn search via Unipile; X viral via `api.sociavault.com`. |
| **Site crawl / audit** | Direct HTTP fetch | `run-audit`, `scan-brand-website` | No paid SEO API on this path. |

**Unused / dormant (present but not driving article cost):** DataForSEO meter with no edge caller; HF social path only if key configured; OpenAI text only if `OPENAI_API_KEY` set (then it **replaces** Gemini for `geminiChat`).

---

## 2. Traced job paths (tokens / images / searches)

### A. Article path — `daily-article-generator` (real code)

1. Load `article_settings` + `sites` (brand voice, language, YouTube flag).  
2. **Images first:** 4× `geminiImage` (hero 16:9 + 3 inline).  
3. **One** `geminiChat` draft: HTML, **2000–2500 words**, keyword 8–10×, FAQ + CTA.  
4. Optional YouTube search (1 API call).  
5. Heuristic SEO score; if &lt; 95, **full regenerate** up to **2 more times** (images + text again).  
6. Meter `articles` / `images`; optional `cms-publish`.

| Resource | Count from code | Token estimate (from prompt + word targets) |
|----------|-----------------|-----------------------------------------------|
| Text calls (happy path) | 1 | Input ~1.5–2.5k (system + brand voice + image HTML). Output ~2.7–3.3k (~2–2.5k words). |
| Text worst case | 3 | Up to ~3× above if SEO retries fire. |
| Images | **4** (not 1) | — |
| Web searches | **0** | Research step not wired. |
| YouTube | 0–1 | — |

**Signal-shaped job (product brief, not yet enforced in this function):** ~1200 words, **1** image, ≤10 searches. Estimates below price that shape separately from “as coded.”

### B. Social draft path — `generate-social-post` (+ reply)

1. Resolve site / article / persona; optional `getOrDeriveBrandVoice` (extra Gemini call on cache miss).  
2. Assemble persona context / playbook.  
3. Build platform prompt (article title/keyword/meta only — **does not paste full article body** unless adapt mode `source_content` ≤6k chars).  
4. HF if keyed, else Gemini; sanitize to platform max length.

| Resource | Count | Token estimate |
|----------|-------|----------------|
| Channel draft | 1 chat / platform | Input ~0.8–2k; output ≤~750 tokens (LinkedIn 3k chars) / ~70 (X). |
| Reply draft (`generate-social-reply`) | 1 chat → 3 options | Input ~1–1.5k (post paste ≤1500 chars + voice); output ~0.4–0.8k JSON. |
| Images | 0 on this path | LinkedIn media uses separate `generate-linkedin-image`. |

---

## 3. Unit rates used

### Current stack (published rates; code has no embedded $ table)

| Item | Rate |
|------|------|
| Gemini 2.5 Flash | **$0.30 / M input**, **$2.50 / M output** ([Google AI pricing](https://ai.google.dev/gemini-api/docs/pricing)) |
| Gemini 3.1 Flash Image (Nano Banana 2) @ ~1K | **~$0.067 / image** |
| gpt-4o-mini (if OpenAI preferred) | **$0.15 / M in**, **$0.60 / M out** |
| gpt-image-1 1024² (LinkedIn path) | ~**$0.011–$0.167** by quality tier |

### xAI / SpaceXAI (assignment rates)

| Item | Rate |
|------|------|
| grok-4.7 (&lt;200k prompt) | **$2 / M in**, **$6 / M out** (incl. reasoning) |
| Cached input (&lt;200k) | **$0.50 / M** |
| Web search | **$5 / 1k calls** → **$0.005 / call** |
| grok-imagine-image (Signal) | **$0.02** |
| grok-imagine-image-2.0 (Compound/Network ok) | **$0.04** (1K low) … **$0.08** (2K medium) |
| Base URL | `https://api.x.ai/v1` (OpenAI SDK compatible) |

### Official X API pay-per-use (assignment; show on approval card)

| Action | Rate | Plan rule |
|--------|------|-----------|
| Post | **$0.015** | Signal: allowed (no link) |
| Post with URL | **$0.20** | Signal: **banned**; Compound: **cap 8 / mo** |
| Read | **$0.005** | Engagement pulls |

X send cost must appear on the approval card, not be buried in subscription. Code today posts via OAuth and does **not** surface these amounts.

---

## 4. Cost: Signal article (~1200 words, 1 image, ≤10 searches)

Assumptions: 2.0k input + 1.8k output tokens for one draft; 10 web searches only on Grok (or a future research step); stay &lt;200k prompt.

| Stack | Text | Images | Searches | **Total / article** |
|-------|------|--------|----------|---------------------|
| **Current Gemini** (Signal-shaped) | 2.0k×$0.30/M + 1.8k×$2.50/M ≈ **$0.005** | 1 × $0.067 ≈ **$0.067** | 0 in code (**$0**) | **~$0.07** |
| Current if OpenAI text preferred | ≈ **$0.001** | same $0.067 | $0 | **~$0.07** |
| **Grok-4.7 + imagine $0.02** | 2.0k×$2 + 1.8k×$6 / M ≈ **$0.015** | **$0.02** | 10 × $0.005 = **$0.05** | **~$0.085** |
| As-coded daily job (4 imgs, 2–2.5k words, 0 search) | ≈ **$0.009** | 4 × $0.067 ≈ **$0.27** | $0 | **~$0.28** (retries can 2–3×) |

**Verdict for Signal:** Current Gemini (or gpt-4o-mini) text is **already cheaper** than grok-4.7. Image is the only line where Grok’s $0.02 beats Nano Banana (~$0.067). All-in stays far under the **$12–$18 / article** budget for a $29 plan either way.

---

## 5. Cost: Compound day (longer article, 3 images, channel + reply drafts)

Assumptions: one longer draft (~2.5k words ≈ 3.3k out, 2.5k in); 3 article images; 5 channel drafts (X, LinkedIn, Bluesky, Reddit, TikTok caption); 3 reply drafts; optional 1 brand-voice derive.

| Line | Current (Gemini) | Grok-4.7 + $0.04 images |
|------|------------------|-------------------------|
| Article text | ≈ **$0.009** | ≈ **$0.025** |
| Article images ×3 | 3 × $0.067 ≈ **$0.20** | 3 × $0.04 = **$0.12** |
| Channel drafts ×5 | ≈ **$0.01** | ≈ **$0.04** |
| Reply drafts ×3 | ≈ **$0.01** | ≈ **$0.03** |
| **AI subtotal** | **~$0.23** | **~$0.22** |
| X posts (example day: 1 plain + 0 links) | **$0.015** shown at approve | same |
| X link posts (monthly, not daily) | up to 8 × **$0.20** = $1.60 / mo | same |

Near-parity on a Compound day only because **image savings** offset Grok’s much higher text rates. Text-heavy days (many replies, regenerations, GEO audits) favor **keeping Gemini**.

---

## 6. Quality fixture check (recorded prompts — no live run)

Fixtures: system/user prompts in `generate-content` (SEO mandatories, JSON score mode) and `daily-article-generator` (HTML structure, brand voice block, 2k–2.5k words).

| Dimension | On switch to grok-4.7 | Notes |
|-----------|----------------------|--------|
| **Tone / brand voice** | Risk of drift | Current prompts stress “match vocabulary and rhythm exactly”; Grok often more conversational — needs A/B on persona fixtures before any default flip. |
| **Tools / research** | Grok web search is a real gain **vs today’s article path** | Today: **zero** web searches on draft — citations are model-invented. Adding ≤10 Grok searches (or Gemini grounding later) improves honesty more than swapping the writer alone. |
| **Latency** | Likely worse / more variable | Flash-class Gemini + short prompts; grok-4.7 includes reasoning tokens in output price. |
| **Structured output** | Possible regression | Score / reply JSON paths use `json: true` / mime JSON on Gemini; must re-validate Grok JSON reliability behind the same interface. |
| **Citation quality** | Better **only if** search tool is wired | Swapping draft model without search does not fix empty research. |

---

## 7. Recommendation: **KEEP** (with optional later image split)

| Component | Decision | Why |
|-----------|----------|-----|
| Article / social / reply **text** | **Keep Gemini 2.5 Flash** (`geminiChat`); keep OpenAI mini as existing env override | Already ~10× cheaper input and ~2.4× cheaper output than grok-4.7; Signal $29 margin is comfortable. |
| Article **images** | **Keep Nano Banana for now**; optional later split to **grok-imagine-image @ $0.02** for Signal | Only clear Grok win on unit price; not enough alone to rewire this pass. |
| LinkedIn composer images | **Keep gpt-image-1** | Separate path; already cheap at low tier. |
| Research / web search | **Unused today** — design next as a **capped research step** (≤10), summarize pages between agent steps; evaluate Grok search **or** Gemini grounding then | Do not default to Grok just for search. |
| X distribution | **Keep official X OAuth** already in `social-publish`; **add approval-card cost UI** ($0.015 / $0.20) + Signal link ban + Compound 8/mo | Pay-per-use is product UX, not a model switch. |
| DataForSEO / HF | Leave dormant unless product needs them | Meter without caller; HF is optional social fallback. |

**Do not switch everything to Grok.**  
**Do not wire grok-4.7 behind the model interface in this pass** — comparison does **not** warrant it: current stack is cheaper for Signal text, close only when counting Compound images, and fixture prompts are SEO-structure-sensitive.

**Next small product moves (out of scope here):** enforce Signal caps (1 image, ~1200 words, ≤10 searches) in `daily-article-generator`; show X costs on approve; add research step with page summaries under 200k prompt tokens.

---

## 8. Source map (for auditors)

| Artifact | Location |
|----------|----------|
| Model interface | Supabase edge `_shared/ai.ts` (`geminiChat`, `geminiImage`, OpenAI branch) |
| Daily article | `daily-article-generator` |
| On-demand / score | `generate-content` |
| Social draft / reply | `generate-social-post`, `generate-social-reply` |
| Publish | `social-publish` |
| GSC | `fetch-gsc-analytics` |
| Product plans | `/cursor/stores/self/docs/project-context.md` |
| Repo map | `/cursor/stores/self/internal/repo-map.md` |
