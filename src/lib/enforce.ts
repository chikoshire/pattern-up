/**
 * Edge/API-facing helpers. Call before generate-content, social-publish, brand create, etc.
 * Returns a structured denial Signal cannot bypass once billing is on.
 */
import {
  type PlanId,
  type UsageMetricKey,
  type UsageSnapshot,
  BILLING_ENABLED,
  PLAN_CATALOG,
  assertWithinPlanLimit,
  canAutoSend,
  canPostXLink,
  canUseBacklinkExchange,
  canUseProgrammaticBatch,
  isPlanId,
  maxImagesPerArticle,
  maxWebSearchesPerArticle,
  resolveEffectivePlanId,
} from "./plans";

export type EnforceDenied = {
  allowed: false;
  status: 402;
  code: "PLAN_LIMIT_REACHED";
  message: string;
  metric: UsageMetricKey;
  upgradeHint: string | null;
};

export type EnforceAllowed = {
  allowed: true;
};

/**
 * Monthly (or brand-count) gates. Uses effective plan:
 * early_access while billing is off; paid plan caps when billing is on.
 */
export function enforcePlanMetric(args: {
  planId: PlanId | string | null | undefined;
  usage: UsageSnapshot;
  metric: UsageMetricKey;
  delta?: number;
  extraBrandQuantity?: number;
}): EnforceAllowed | EnforceDenied {
  const result = assertWithinPlanLimit(args);
  if (result.ok) return { allowed: true };
  return {
    allowed: false,
    status: 402,
    code: result.code,
    message: result.message,
    metric: result.metric,
    upgradeHint: result.upgradeHint,
  };
}

/**
 * Per-article research cap (Signal = 10). When billing is off, allows.
 * When billing is on, uses the workspace's effective paid plan catalog caps.
 */
export function enforceArticleResearchBudget(args: {
  planId: PlanId | string | null | undefined;
  searchesUsedOnArticle: number;
  additionalSearches?: number;
}): EnforceAllowed | EnforceDenied {
  if (!BILLING_ENABLED) {
    return { allowed: true };
  }

  const effective = resolveEffectivePlanId(args.planId);
  const catalogId = isPlanId(effective) ? effective : "signal";
  const max = PLAN_CATALOG[catalogId].limits.webSearchesPerArticle;
  const next = args.searchesUsedOnArticle + (args.additionalSearches ?? 1);

  if (Number.isFinite(max) && next > max) {
    return {
      allowed: false,
      status: 402,
      code: "PLAN_LIMIT_REACHED",
      message: `${PLAN_CATALOG[catalogId].name} plan limit reached for web searches on this article (${args.searchesUsedOnArticle}/${max}).`,
      metric: "searches",
      upgradeHint: catalogId === "signal" ? "compound" : catalogId === "compound" ? "network" : null,
    };
  }

  return { allowed: true };
}

export {
  canAutoSend,
  canPostXLink,
  canUseBacklinkExchange,
  canUseProgrammaticBatch,
  maxImagesPerArticle,
  maxWebSearchesPerArticle,
};
