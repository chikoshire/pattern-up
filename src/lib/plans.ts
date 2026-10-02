/**
 * Pattern Up plan catalog + hard caps.
 * Binding prices: Signal $29, Compound $99, Network $299, extra brand $49.
 * No $10 publishing plan, no $499 service, no agency tier.
 */

export const PLAN_IDS = ["signal", "compound", "network", "early_access"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export const BILLABLE_PLAN_IDS = ["signal", "compound", "network"] as const;
export type BillablePlanId = (typeof BILLABLE_PLAN_IDS)[number];

/** Set true when Stripe billing is live. Until then early_access stays free/unlimited. */
export const BILLING_ENABLED = false;

export const EXTRA_BRAND_ADDON = {
  id: "extra_brand",
  name: "Extra brand",
  priceMonthlyUsd: 49,
  description: "Add one more brand on Compound (self-serve).",
} as const;

export type PlanLimits = {
  brands: number;
  /** Max personas total (Signal/Compound: 1; Network: 1 per brand). */
  personas: number;
  articlesPerMonth: number;
  imagesPerArticle: number;
  imagesPerMonth: number;
  webSearchesPerArticle: number;
  socialDraftsPerWeek: number;
  /** Official-API send after approval. Signal: never. */
  autoSendAfterApproval: boolean;
  xLinkPostsPerMonth: number;
  citationChecksPerWeek: number;
  citationQueriesPerCheck: number;
  programmaticBatch: boolean;
  backlinkExchange: boolean;
  replyQueue: boolean;
  gscRefresh: boolean;
};

export type PlanDefinition = {
  id: PlanId;
  name: string;
  priceMonthlyUsd: number;
  tagline: string;
  limits: PlanLimits;
  /** Shown on pricing; early_access is not a paid SKU. */
  billable: boolean;
};

const UNLIMITED = Number.POSITIVE_INFINITY;

export const PLAN_CATALOG: Record<PlanId, PlanDefinition> = {
  signal: {
    id: "signal",
    name: "Signal",
    priceMonthlyUsd: 29,
    tagline: "One brand. Daily article. Drafts only.",
    billable: true,
    limits: {
      brands: 1,
      personas: 1,
      articlesPerMonth: 30,
      imagesPerArticle: 1,
      imagesPerMonth: 30,
      webSearchesPerArticle: 10,
      socialDraftsPerWeek: 3,
      autoSendAfterApproval: false,
      xLinkPostsPerMonth: 0,
      citationChecksPerWeek: 1,
      citationQueriesPerCheck: 5,
      programmaticBatch: false,
      backlinkExchange: false,
      replyQueue: false,
      gscRefresh: false,
    },
  },
  compound: {
    id: "compound",
    name: "Compound",
    priceMonthlyUsd: 99,
    tagline: "Homepage tier. Reply queue. Approved send on official APIs.",
    billable: true,
    limits: {
      brands: 1,
      personas: 1,
      articlesPerMonth: 30,
      imagesPerArticle: 3,
      imagesPerMonth: 90,
      webSearchesPerArticle: 25,
      socialDraftsPerWeek: 14,
      autoSendAfterApproval: true,
      xLinkPostsPerMonth: 8,
      citationChecksPerWeek: 2,
      citationQueriesPerCheck: 10,
      programmaticBatch: false,
      backlinkExchange: false,
      replyQueue: true,
      gscRefresh: true,
    },
  },
  network: {
    id: "network",
    name: "Network",
    priceMonthlyUsd: 299,
    tagline: "Up to 5 brands. Programmatic batch. Exchange matching.",
    billable: true,
    limits: {
      brands: 5,
      personas: 5,
      articlesPerMonth: 150,
      imagesPerArticle: 3,
      imagesPerMonth: 450,
      webSearchesPerArticle: 40,
      socialDraftsPerWeek: 35,
      autoSendAfterApproval: true,
      xLinkPostsPerMonth: 40,
      citationChecksPerWeek: 5,
      citationQueriesPerCheck: 20,
      programmaticBatch: true,
      backlinkExchange: true,
      replyQueue: true,
      gscRefresh: true,
    },
  },
  early_access: {
    id: "early_access",
    name: "Early access",
    priceMonthlyUsd: 0,
    tagline: "Free until billing is switched on.",
    billable: false,
    limits: {
      brands: UNLIMITED,
      personas: UNLIMITED,
      articlesPerMonth: UNLIMITED,
      imagesPerArticle: 3,
      imagesPerMonth: UNLIMITED,
      webSearchesPerArticle: UNLIMITED,
      socialDraftsPerWeek: UNLIMITED,
      autoSendAfterApproval: false,
      xLinkPostsPerMonth: UNLIMITED,
      citationChecksPerWeek: UNLIMITED,
      citationQueriesPerCheck: 20,
      programmaticBatch: false,
      backlinkExchange: false,
      replyQueue: true,
      gscRefresh: true,
    },
  },
};

/** Stripe-facing paid plans only — never expose a service/$499 SKU. */
export const PAID_PLANS: BillablePlanId[] = ["signal", "compound", "network"];

export function isPlanId(value: string): value is PlanId {
  return (PLAN_IDS as readonly string[]).includes(value);
}

export function getPlan(planId: PlanId): PlanDefinition {
  return PLAN_CATALOG[planId];
}

/**
 * Effective plan for entitlement checks.
 * When billing is off, everyone stays on early_access (free).
 * When billing is on, early_access is not sellable — treat unknown as signal floor.
 */
export function resolveEffectivePlanId(planId: PlanId | string | null | undefined): PlanId {
  if (!BILLING_ENABLED) {
    return "early_access";
  }
  if (planId && isPlanId(planId) && planId !== "early_access") {
    return planId;
  }
  // Billing on: no silent free Compound. Floor is Signal until checkout completes.
  return "signal";
}

export function getPlanLimits(planId: PlanId | string | null | undefined): PlanLimits {
  return getPlan(resolveEffectivePlanId(planId)).limits;
}

export function brandCap(
  planId: PlanId,
  extraBrandQuantity = 0,
  opts?: { forceCatalogPlan?: boolean },
): number {
  const effective =
    opts?.forceCatalogPlan && isPlanId(planId) ? planId : resolveEffectivePlanId(planId);
  const base = getPlan(effective).limits.brands;
  if (!Number.isFinite(base)) return base;
  if (effective !== "compound") {
    return base;
  }
  return base + Math.max(0, Math.floor(extraBrandQuantity));
}

export type UsageMetricKey =
  | "articles"
  | "images"
  | "searches"
  | "xLinkPosts"
  | "brands"
  | "socialDrafts"
  | "citationChecks";

export type UsageSnapshot = {
  articles: number;
  images: number;
  searches: number;
  xLinkPosts: number;
  brands: number;
  socialDrafts: number;
  citationChecks: number;
  /** ISO month key YYYY-MM */
  period: string;
};

export type LimitCheckResult =
  | { ok: true; metric: UsageMetricKey; used: number; limit: number; remaining: number }
  | {
      ok: false;
      metric: UsageMetricKey;
      used: number;
      limit: number;
      remaining: 0;
      code: "PLAN_LIMIT_REACHED";
      message: string;
      upgradeHint: BillablePlanId | null;
    };

function monthPeriod(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function currentUsagePeriod(date = new Date()): string {
  return monthPeriod(date);
}

export function emptyUsage(period = currentUsagePeriod()): UsageSnapshot {
  return {
    articles: 0,
    images: 0,
    searches: 0,
    xLinkPosts: 0,
    brands: 0,
    socialDrafts: 0,
    citationChecks: 0,
    period,
  };
}

function upgradeHintFor(metric: UsageMetricKey, planId: PlanId): BillablePlanId | null {
  switch (metric) {
    case "xLinkPosts":
    case "socialDrafts":
    case "images":
    case "searches":
    case "citationChecks":
      if (planId === "signal" || planId === "early_access") return "compound";
      if (planId === "compound") return "network";
      return null;
    case "brands":
    case "articles":
      if (planId === "signal" || planId === "compound" || planId === "early_access") return "network";
      return null;
    default: {
      const _exhaustive: never = metric;
      return _exhaustive;
    }
  }
}

function limitForMetric(
  limits: PlanLimits,
  metric: UsageMetricKey,
  opts: { extraBrandQuantity?: number; planId: PlanId; forceCatalogPlan?: boolean },
): number {
  switch (metric) {
    case "articles":
      return limits.articlesPerMonth;
    case "images":
      return limits.imagesPerMonth;
    case "searches":
      // Monthly search budget ≈ per-article cap × article cap (Signal stays tight).
      return Number.isFinite(limits.articlesPerMonth) && Number.isFinite(limits.webSearchesPerArticle)
        ? limits.articlesPerMonth * limits.webSearchesPerArticle
        : UNLIMITED;
    case "xLinkPosts":
      return limits.xLinkPostsPerMonth;
    case "brands":
      return brandCap(opts.planId, opts.extraBrandQuantity ?? 0, {
        forceCatalogPlan: opts.forceCatalogPlan,
      });
    case "socialDrafts":
      // Approximate month as 4 weeks for meter display/enforcement.
      return Number.isFinite(limits.socialDraftsPerWeek)
        ? limits.socialDraftsPerWeek * 4
        : UNLIMITED;
    case "citationChecks":
      return Number.isFinite(limits.citationChecksPerWeek)
        ? limits.citationChecksPerWeek * 4
        : UNLIMITED;
    default: {
      const _exhaustive: never = metric;
      return _exhaustive;
    }
  }
}

const METRIC_LABEL: Record<UsageMetricKey, string> = {
  articles: "articles",
  images: "images",
  searches: "web searches",
  xLinkPosts: "X link posts",
  brands: "brands",
  socialDrafts: "social drafts",
  citationChecks: "citation checks",
};

/**
 * Hard gate used before generation / publish / brand create.
 * Signal cannot silently perform Compound/Network work.
 *
 * Pass `forceCatalogPlan: true` to evaluate a named catalog plan's caps
 * (e.g. Usage page preview) without applying the early-access billing override.
 */
export function assertWithinPlanLimit(args: {
  planId: PlanId | string | null | undefined;
  usage: UsageSnapshot;
  metric: UsageMetricKey;
  delta?: number;
  extraBrandQuantity?: number;
  forceCatalogPlan?: boolean;
}): LimitCheckResult {
  const planId =
    args.forceCatalogPlan && args.planId && isPlanId(args.planId)
      ? args.planId
      : resolveEffectivePlanId(args.planId);
  const limits = getPlan(planId).limits;
  const delta = args.delta ?? 1;
  const used = args.usage[args.metric] ?? 0;
  const limit = limitForMetric(limits, args.metric, {
    planId,
    extraBrandQuantity: args.extraBrandQuantity,
    forceCatalogPlan: args.forceCatalogPlan,
  });

  if (!Number.isFinite(limit)) {
    return { ok: true, metric: args.metric, used, limit, remaining: UNLIMITED };
  }

  const next = used + delta;
  if (next <= limit) {
    return { ok: true, metric: args.metric, used, limit, remaining: limit - used };
  }

  const planName = getPlan(planId).name;
  const hint = upgradeHintFor(args.metric, planId);
  return {
    ok: false,
    metric: args.metric,
    used,
    limit,
    remaining: 0,
    code: "PLAN_LIMIT_REACHED",
    message: `${planName} plan limit reached for ${METRIC_LABEL[args.metric]} (${used}/${limit}).`,
    upgradeHint: hint,
  };
}

export function canAutoSend(planId: PlanId | string | null | undefined): boolean {
  return getPlanLimits(planId).autoSendAfterApproval;
}

export function canUseProgrammaticBatch(planId: PlanId | string | null | undefined): boolean {
  return getPlanLimits(planId).programmaticBatch;
}

export function canUseBacklinkExchange(planId: PlanId | string | null | undefined): boolean {
  return getPlanLimits(planId).backlinkExchange;
}

export function canPostXLink(planId: PlanId | string | null | undefined): boolean {
  return getPlanLimits(planId).xLinkPostsPerMonth > 0;
}

export function maxImagesPerArticle(planId: PlanId | string | null | undefined): number {
  return getPlanLimits(planId).imagesPerArticle;
}

export function maxWebSearchesPerArticle(planId: PlanId | string | null | undefined): number {
  return getPlanLimits(planId).webSearchesPerArticle;
}

export type UsageMeter = {
  key: UsageMetricKey;
  label: string;
  used: number;
  limit: number;
  remaining: number;
  pct: number;
  blocked: boolean;
};

export function buildUsageMeters(args: {
  planId: PlanId | string | null | undefined;
  usage: UsageSnapshot;
  extraBrandQuantity?: number;
}): UsageMeter[] {
  const planId = resolveEffectivePlanId(args.planId);
  const keys: UsageMetricKey[] = [
    "articles",
    "images",
    "searches",
    "xLinkPosts",
    "brands",
    "socialDrafts",
    "citationChecks",
  ];

  return keys.map((key) => {
    const check = assertWithinPlanLimit({
      planId,
      usage: args.usage,
      metric: key,
      delta: 0,
      extraBrandQuantity: args.extraBrandQuantity,
    });
    const limit = check.limit;
    const used = check.used;
    const remaining = check.remaining;
    const pct = !Number.isFinite(limit) || limit === 0 ? 0 : Math.min(100, Math.round((used / limit) * 100));
    return {
      key,
      label: METRIC_LABEL[key],
      used,
      limit,
      remaining,
      pct,
      blocked: Number.isFinite(limit) && used >= limit,
    };
  });
}

export function formatLimit(limit: number): string {
  if (!Number.isFinite(limit)) return "Unlimited";
  return String(limit);
}

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Guard: never register forbidden SKUs. */
export const FORBIDDEN_SKUS = {
  publishing10: { priceMonthlyUsd: 10, reason: "Audit/growth-only SKU if any — not a publishing plan" },
  service499: { priceMonthlyUsd: 499, reason: "No human service / agency tier" },
} as const;
