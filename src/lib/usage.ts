import {
  type PlanId,
  type UsageSnapshot,
  assertWithinPlanLimit,
  buildUsageMeters,
  currentUsagePeriod,
  emptyUsage,
  formatLimit,
  formatUsd,
  getPlan,
  resolveEffectivePlanId,
  BILLING_ENABLED,
  PAID_PLANS,
  PLAN_CATALOG,
  EXTRA_BRAND_ADDON,
  type UsageMetricKey,
} from "../lib/plans";

export type WorkspacePlanState = {
  planId: PlanId;
  extraBrandQuantity: number;
  usage: UsageSnapshot;
};

/** Demo / local state until Supabase `usage_counters` + subscription are wired. */
export function demoWorkspaceState(overrides?: Partial<WorkspacePlanState>): WorkspacePlanState {
  return {
    planId: "signal",
    extraBrandQuantity: 0,
    usage: {
      ...emptyUsage(currentUsagePeriod()),
      articles: 12,
      images: 8,
      searches: 64,
      xLinkPosts: 0,
      brands: 1,
      socialDrafts: 5,
      citationChecks: 1,
    },
    ...overrides,
  };
}

export function checkAction(
  state: WorkspacePlanState,
  metric: UsageMetricKey,
  delta = 1,
) {
  return assertWithinPlanLimit({
    planId: state.planId,
    usage: state.usage,
    metric,
    delta,
    extraBrandQuantity: state.extraBrandQuantity,
  });
}

export function usageViewModel(state: WorkspacePlanState) {
  const effectivePlanId = resolveEffectivePlanId(state.planId);
  const plan = getPlan(effectivePlanId);
  const meters = buildUsageMeters({
    planId: state.planId,
    usage: state.usage,
    extraBrandQuantity: state.extraBrandQuantity,
  });

  return {
    billingEnabled: BILLING_ENABLED,
    selectedPlanId: state.planId,
    effectivePlanId,
    plan,
    meters,
    paidPlans: PAID_PLANS.map((id) => PLAN_CATALOG[id]),
    extraBrand: EXTRA_BRAND_ADDON,
    period: state.usage.period,
    formatLimit,
    formatUsd,
  };
}
