import { describe, expect, it } from "vitest";
import { enforceArticleResearchBudget, enforcePlanMetric } from "./enforce";
import { BILLING_ENABLED, emptyUsage } from "./plans";

describe("enforcePlanMetric", () => {
  it("allows usage while early access billing is off", () => {
    expect(BILLING_ENABLED).toBe(false);
    const result = enforcePlanMetric({
      planId: "signal",
      usage: { ...emptyUsage(), articles: 999 },
      metric: "articles",
    });
    expect(result.allowed).toBe(true);
  });

  it("allows article research while billing is off", () => {
    const result = enforceArticleResearchBudget({
      planId: "signal",
      searchesUsedOnArticle: 50,
    });
    expect(result.allowed).toBe(true);
  });
});
