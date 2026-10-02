import { useMemo, useState } from "react";
import {
  BILLING_ENABLED,
  type BillablePlanId,
  type PlanId,
  type UsageMetricKey,
  PAID_PLANS,
  PLAN_CATALOG,
  assertWithinPlanLimit,
  buildUsageMeters,
  formatLimit,
  formatUsd,
  getPlan,
  resolveEffectivePlanId,
} from "../lib/plans";
import { demoWorkspaceState, type WorkspacePlanState } from "../lib/usage";

const METRIC_TITLES: Record<UsageMetricKey, string> = {
  articles: "Articles",
  images: "Images",
  searches: "Web searches",
  xLinkPosts: "X link posts",
  brands: "Brands",
  socialDrafts: "Social drafts",
  citationChecks: "Citation checks",
};

export function UsagePage() {
  const [state, setState] = useState<WorkspacePlanState>(() => demoWorkspaceState());
  const [previewPlan, setPreviewPlan] = useState<BillablePlanId>("signal");
  const [actionLog, setActionLog] = useState<string[]>([]);

  const effectivePlanId = resolveEffectivePlanId(state.planId);
  const effectivePlan = getPlan(effectivePlanId);

  const liveMeters = useMemo(
    () =>
      buildUsageMeters({
        planId: state.planId,
        usage: state.usage,
        extraBrandQuantity: state.extraBrandQuantity,
      }),
    [state],
  );

  const previewMeters = useMemo(
    () =>
      buildUsageMeters({
        planId: previewPlan,
        usage: state.usage,
        extraBrandQuantity: state.extraBrandQuantity,
      }).map((meter) => {
        // Force catalog caps so Signal preview stays honest during early access.
        const check = assertWithinPlanLimit({
          planId: previewPlan,
          usage: state.usage,
          metric: meter.key,
          delta: 0,
          extraBrandQuantity: state.extraBrandQuantity,
          forceCatalogPlan: true,
        });
        const limit = check.limit;
        const used = check.used;
        const pct =
          !Number.isFinite(limit) || limit === 0 ? 0 : Math.min(100, Math.round((used / limit) * 100));
        return {
          ...meter,
          limit,
          remaining: check.remaining,
          pct,
          blocked: Number.isFinite(limit) && used >= limit,
        };
      }),
    [previewPlan, state],
  );

  function tryAction(metric: UsageMetricKey) {
    const catalogPlan = BILLING_ENABLED ? state.planId : previewPlan;
    const result = assertWithinPlanLimit({
      planId: catalogPlan,
      usage: state.usage,
      metric,
      delta: 1,
      extraBrandQuantity: state.extraBrandQuantity,
      forceCatalogPlan: true,
    });

    if (!result.ok) {
      setActionLog((log) =>
        [
          `${result.message}${result.upgradeHint ? ` → upgrade to ${PLAN_CATALOG[result.upgradeHint].name}` : ""}`,
          ...log,
        ].slice(0, 8),
      );
      return;
    }

    setState((prev) => ({
      ...prev,
      usage: { ...prev.usage, [metric]: prev.usage[metric] + 1 },
    }));
    const remainingAfter = Number.isFinite(result.remaining) ? result.remaining - 1 : result.remaining;
    setActionLog((log) =>
      [
        `Allowed ${METRIC_TITLES[metric]} (+1). ${formatLimit(remainingAfter)} left on ${getPlan(catalogPlan as PlanId).name}.`,
        ...log,
      ].slice(0, 8),
    );
  }

  return (
    <div className="usage-page">
      <header className="usage-header">
        <p className="eyebrow">Pattern Up</p>
        <h1>Usage</h1>
        <p className="lede">
          Caps are enforced in product code. Signal cannot silently run Compound-level articles,
          images, searches, or X link posts.
        </p>
      </header>

      <section className="panel plan-status">
        <div>
          <h2>Current entitlement</h2>
          <p>
            Workspace plan: <strong>{getPlan(state.planId).name}</strong>
            {" · "}
            Effective: <strong>{effectivePlan.name}</strong>
            {" · "}
            Billing: <strong>{BILLING_ENABLED ? "on" : "off (early access)"}</strong>
          </p>
          {!BILLING_ENABLED && (
            <p className="hint">
              Early access stays free until billing is switched on. When billing is on, only Signal
              ({formatUsd(29)}), Compound ({formatUsd(99)}), Network ({formatUsd(299)}), and extra
              brand ({formatUsd(49)}) apply — no service SKU.
            </p>
          )}
        </div>
        <label className="field">
          <span>Simulate workspace plan</span>
          <select
            value={state.planId}
            onChange={(e) => setState((s) => ({ ...s, planId: e.target.value as PlanId }))}
          >
            {(["early_access", ...PAID_PLANS] as PlanId[]).map((id) => (
              <option key={id} value={id}>
                {PLAN_CATALOG[id].name}
                {PLAN_CATALOG[id].billable ? ` · ${formatUsd(PLAN_CATALOG[id].priceMonthlyUsd)}/mo` : " · free"}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="panel">
        <div className="section-head">
          <h2>This month · {state.usage.period}</h2>
          <p>Live meters for the effective plan{!BILLING_ENABLED ? " (unlimited while early access)" : ""}.</p>
        </div>
        <div className="meter-grid">
          {liveMeters.map((meter) => (
            <MeterCard
              key={meter.key}
              title={METRIC_TITLES[meter.key]}
              used={meter.used}
              limit={meter.limit}
              pct={meter.pct}
              blocked={meter.blocked}
            />
          ))}
        </div>
      </section>

      <section className="panel accent">
        <div className="section-head">
          <h2>Plan preview (hard caps)</h2>
          <p>
            Compare what each paid plan would allow against your current usage — so Signal never
            looks like Compound by accident.
          </p>
        </div>
        <div className="plan-tabs">
          {PAID_PLANS.map((id) => (
            <button
              key={id}
              type="button"
              className={previewPlan === id ? "tab active" : "tab"}
              onClick={() => setPreviewPlan(id)}
            >
              {PLAN_CATALOG[id].name}
              <span>{formatUsd(PLAN_CATALOG[id].priceMonthlyUsd)}</span>
            </button>
          ))}
        </div>
        <p className="hint">{PLAN_CATALOG[previewPlan].tagline}</p>
        <div className="meter-grid">
          {previewMeters.map((meter) => (
            <MeterCard
              key={meter.key}
              title={METRIC_TITLES[meter.key]}
              used={meter.used}
              limit={meter.limit}
              pct={meter.pct}
              blocked={meter.blocked}
              emphasizeBlocked
            />
          ))}
        </div>
        <div className="actions">
          <button type="button" onClick={() => tryAction("articles")}>
            Generate article
          </button>
          <button type="button" onClick={() => tryAction("images")}>
            Generate image
          </button>
          <button type="button" onClick={() => tryAction("searches")}>
            Run web search
          </button>
          <button type="button" onClick={() => tryAction("xLinkPosts")}>
            Send X link post
          </button>
          <button type="button" onClick={() => tryAction("brands")}>
            Add brand
          </button>
        </div>
        {actionLog.length > 0 && (
          <ul className="action-log">
            {actionLog.map((line, i) => (
              <li key={`${i}-${line.slice(0, 24)}`}>{line}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <h2>Paid catalog</h2>
        <div className="catalog">
          {PAID_PLANS.map((id) => {
            const plan = PLAN_CATALOG[id];
            return (
              <article key={id} className="catalog-card">
                <h3>{plan.name}</h3>
                <p className="price">{formatUsd(plan.priceMonthlyUsd)}<span>/mo</span></p>
                <p>{plan.tagline}</p>
                <ul>
                  <li>{formatLimit(plan.limits.brands)} brand{plan.limits.brands === 1 ? "" : "s"}</li>
                  <li>{formatLimit(plan.limits.articlesPerMonth)} articles/mo</li>
                  <li>{plan.limits.imagesPerArticle} image(s)/article</li>
                  <li>{plan.limits.webSearchesPerArticle} searches/article</li>
                  <li>
                    X link posts:{" "}
                    {plan.limits.xLinkPostsPerMonth === 0
                      ? "not allowed"
                      : `${plan.limits.xLinkPostsPerMonth}/mo`}
                  </li>
                  <li>Auto-send after approval: {plan.limits.autoSendAfterApproval ? "yes" : "no"}</li>
                </ul>
              </article>
            );
          })}
        </div>
        <p className="hint">
          Extra brand add-on: {formatUsd(49)}/mo on Compound only. No $10 publishing plan. No $499
          service.
        </p>
      </section>
    </div>
  );
}

function MeterCard(props: {
  title: string;
  used: number;
  limit: number;
  pct: number;
  blocked: boolean;
  emphasizeBlocked?: boolean;
}) {
  const limitLabel = formatLimit(props.limit);
  return (
    <div
      className={
        props.blocked && props.emphasizeBlocked ? "meter blocked" : props.blocked ? "meter blocked-soft" : "meter"
      }
    >
      <div className="meter-top">
        <span>{props.title}</span>
        <strong>
          {props.used}
          <span className="muted"> / {limitLabel}</span>
        </strong>
      </div>
      <div className="bar" aria-hidden>
        <div
          className="bar-fill"
          style={{ width: Number.isFinite(props.limit) ? `${props.pct}%` : "8%" }}
        />
      </div>
      {props.blocked && <p className="cap-note">Cap reached for this plan</p>}
    </div>
  );
}
