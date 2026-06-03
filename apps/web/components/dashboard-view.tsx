import React from "react";

import { NetWorthTrendPanel } from "@/components/net-worth-trend-panel";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { DashboardSnapshot, NetWorthHistory } from "@/lib/types";

type Props = {
  initialNetWorthHistory: NetWorthHistory;
  snapshot: DashboardSnapshot;
};

export function DashboardView({ initialNetWorthHistory, snapshot }: Props) {
  const cashPosition = snapshot.accounts
    .filter((account) => ["checking", "savings", "cash"].includes(account.type))
    .reduce((sum, account) => sum + account.balance, 0);
  const netWorthPlaceholder = snapshot.accounts.reduce((sum, account) => sum + account.balance, 0);

  return (
    <section className="page-stack">
      <header className="page-header">
        <div>
          <h1>Financial command center</h1>
          <p>Banking, spending, recurring costs, and cashflow risk in one local-first view.</p>
        </div>
        <div className="status-chip">Mock SimpleFIN ready</div>
      </header>

      <div className="metric-grid">
        <MetricCard label="Cash position" value={formatCurrency(cashPosition)} meta="Checking + savings" tone="green" />
        <MetricCard label="Monthly spending" value={formatCurrency(snapshot.monthly_summary.total_spending)} meta={`${formatPercent(snapshot.monthly_summary.budget_used_pct)} of budget`} tone="coral" />
        <MetricCard label="Net worth placeholder" value={formatCurrency(netWorthPlaceholder)} meta="Investments deferred" tone="indigo" />
        <MetricCard label="Recurring costs" value={formatCurrency(snapshot.recurring_items.reduce((sum, item) => sum + item.monthly_amount, 0))} meta={`${snapshot.recurring_items.length} detected`} tone="amber" />
      </div>

      <div className="dashboard-layout">
        <NetWorthTrendPanel initialHistory={initialNetWorthHistory} />

        <article className="panel">
          <div className="panel-heading">
            <h2>Recurring watchlist</h2>
          </div>
          <div className="list-stack">
            {snapshot.recurring_items.map((item) => (
              <div className="list-row" key={item.merchant}>
                <span>
                  <strong>{item.merchant}</strong>
                  <small>{item.cadence} · next {item.next_payment_date}</small>
                </span>
                <b>{formatCurrency(item.monthly_amount)}</b>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <h2>Category budget use</h2>
          </div>
          <div className="list-stack">
            {snapshot.monthly_summary.categories.slice(0, 4).map((category) => (
              <div className="budget-row" key={category.category}>
                <div className="row-between">
                  <span>{category.category}</span>
                  <strong>{formatCurrency(category.amount)}</strong>
                </div>
                <div className="thin-track">
                  <div className="thin-fill" style={{ width: `${Math.min(category.budget_used_pct ?? 0, 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}

function MetricCard({ label, value, meta, tone }: { label: string; value: string; meta: string; tone: string }) {
  return (
    <article className={`metric-card tone-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{meta}</small>
    </article>
  );
}
