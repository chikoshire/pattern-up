import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { UsagePage } from "./pages/UsagePage";
import { BILLING_ENABLED, PAID_PLANS, PLAN_CATALOG, formatUsd } from "./lib/plans";

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="shell">
      <aside className="nav">
        <div className="brand">
          <span className="brand-mark">P</span>
          <div>
            <strong>Pattern Up</strong>
            <small>SEO + GEO autopilot</small>
          </div>
        </div>
        <nav>
          <NavLink to="/app/usage">Usage</NavLink>
          <NavLink to="/app/plans">Plans</NavLink>
        </nav>
        <p className="nav-note">
          {BILLING_ENABLED ? "Billing on" : "Early access · billing off"}
        </p>
      </aside>
      <main>{children}</main>
    </div>
  );
}

function PlansPage() {
  return (
    <div className="usage-page">
      <header className="usage-header">
        <p className="eyebrow">Pattern Up</p>
        <h1>Plans</h1>
        <p className="lede">
          Pure self-serve. Signal, Compound, Network — plus optional extra brand. No agency tier.
        </p>
      </header>
      <div className="catalog">
        {PAID_PLANS.map((id) => {
          const plan = PLAN_CATALOG[id];
          return (
            <article key={id} className="catalog-card">
              <h3>{plan.name}</h3>
              <p className="price">
                {formatUsd(plan.priceMonthlyUsd)}
                <span>/mo</span>
              </p>
              <p>{plan.tagline}</p>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Navigate to="/app/usage" replace />} />
        <Route path="/app/usage" element={<UsagePage />} />
        <Route path="/app/plans" element={<PlansPage />} />
        <Route path="*" element={<Navigate to="/app/usage" replace />} />
      </Routes>
    </Shell>
  );
}
