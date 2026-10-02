import { describe, expect, it } from "vitest";
import {
  BILLING_ENABLED,
  EXTRA_BRAND_ADDON,
  FORBIDDEN_SKUS,
  PAID_PLANS,
  PLAN_CATALOG,
  assertWithinPlanLimit,
  brandCap,
  buildUsageMeters,
  emptyUsage,
  formatUsd,
  resolveEffectivePlanId,
} from "./plans";

describe("plan catalog", () => {
  it("exposes only Signal / Compound / Network as paid SKUs at brief prices", () => {
    expect(PAID_PLANS).toEqual(["signal", "compound", "network"]);
    expect(PLAN_CATALOG.signal.priceMonthlyUsd).toBe(29);
    expect(PLAN_CATALOG.compound.priceMonthlyUsd).toBe(99);
    expect(PLAN_CATALOG.network.priceMonthlyUsd).toBe(299);
    expect(EXTRA_BRAND_ADDON.priceMonthlyUsd).toBe(49);
    expect(formatUsd(29)).toBe("$29");
  });

  it("does not ship forbidden publishing $10 or service $499 SKUs", () => {
    const prices = Object.values(PLAN_CATALOG).map((p) => p.priceMonthlyUsd);
    expect(prices).not.toContain(FORBIDDEN_SKUS.publishing10.priceMonthlyUsd);
    expect(prices).not.toContain(FORBIDDEN_SKUS.service499.priceMonthlyUsd);
  });

  it("keeps early access free until billing is on", () => {
    expect(BILLING_ENABLED).toBe(false);
    expect(resolveEffectivePlanId("compound")).toBe("early_access");
  });
});

describe("Signal caps (catalog enforcement)", () => {
  it("blocks X link posts on Signal", () => {
    const result = assertWithinPlanLimit({
      planId: "signal",
      usage: emptyUsage(),
      metric: "xLinkPosts",
      delta: 1,
      forceCatalogPlan: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("PLAN_LIMIT_REACHED");
      expect(result.upgradeHint).toBe("compound");
    }
  });

  it("allows one image per article budget and blocks overage on monthly images", () => {
    expect(PLAN_CATALOG.signal.limits.imagesPerArticle).toBe(1);
    const atCap = assertWithinPlanLimit({
      planId: "signal",
      usage: { ...emptyUsage(), images: 30 },
      metric: "images",
      delta: 1,
      forceCatalogPlan: true,
    });
    expect(atCap.ok).toBe(false);
  });

  it("caps research searches so Signal cannot run Compound-scale research", () => {
    expect(PLAN_CATALOG.signal.limits.webSearchesPerArticle).toBe(10);
    const monthlySearchCap =
      PLAN_CATALOG.signal.limits.articlesPerMonth *
      PLAN_CATALOG.signal.limits.webSearchesPerArticle;
    const result = assertWithinPlanLimit({
      planId: "signal",
      usage: { ...emptyUsage(), searches: monthlySearchCap },
      metric: "searches",
      delta: 1,
      forceCatalogPlan: true,
    });
    expect(result.ok).toBe(false);
  });

  it("blocks a second brand on Signal", () => {
    const result = assertWithinPlanLimit({
      planId: "signal",
      usage: { ...emptyUsage(), brands: 1 },
      metric: "brands",
      delta: 1,
      forceCatalogPlan: true,
    });
    expect(result.ok).toBe(false);
  });

  it("stops article generation at the monthly Signal cap", () => {
    const result = assertWithinPlanLimit({
      planId: "signal",
      usage: { ...emptyUsage(), articles: 30 },
      metric: "articles",
      delta: 1,
      forceCatalogPlan: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("Signal");
    }
  });
});

describe("Compound + Network", () => {
  it("allows up to 8 X link posts on Compound then blocks", () => {
    const ok = assertWithinPlanLimit({
      planId: "compound",
      usage: { ...emptyUsage(), xLinkPosts: 7 },
      metric: "xLinkPosts",
      forceCatalogPlan: true,
    });
    expect(ok.ok).toBe(true);

    const blocked = assertWithinPlanLimit({
      planId: "compound",
      usage: { ...emptyUsage(), xLinkPosts: 8 },
      metric: "xLinkPosts",
      forceCatalogPlan: true,
    });
    expect(blocked.ok).toBe(false);
  });

  it("extra brand add-on expands Compound only", () => {
    expect(brandCap("compound", 2, { forceCatalogPlan: true })).toBe(3);
    expect(brandCap("signal", 2, { forceCatalogPlan: true })).toBe(1);
    expect(brandCap("network", 2, { forceCatalogPlan: true })).toBe(5);

    const withAddon = assertWithinPlanLimit({
      planId: "compound",
      usage: { ...emptyUsage(), brands: 2 },
      metric: "brands",
      delta: 1,
      extraBrandQuantity: 2,
      forceCatalogPlan: true,
    });
    expect(withAddon.ok).toBe(true);
  });

  it("Network alone may use programmatic batch + exchange flags", () => {
    expect(PLAN_CATALOG.network.limits.programmaticBatch).toBe(true);
    expect(PLAN_CATALOG.network.limits.backlinkExchange).toBe(true);
    expect(PLAN_CATALOG.compound.limits.programmaticBatch).toBe(false);
    expect(PLAN_CATALOG.signal.limits.backlinkExchange).toBe(false);
  });
});

describe("usage meters", () => {
  it("builds meters for all gated resources", () => {
    const meters = buildUsageMeters({
      planId: "early_access",
      usage: { ...emptyUsage(), articles: 4, images: 2, brands: 1 },
    });
    expect(meters.map((m) => m.key)).toEqual([
      "articles",
      "images",
      "searches",
      "xLinkPosts",
      "brands",
      "socialDrafts",
      "citationChecks",
    ]);
  });
});
