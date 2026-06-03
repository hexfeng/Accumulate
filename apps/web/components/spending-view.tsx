import type { MonthlySummary } from "@/lib/types";
import { formatCurrency, formatPercent } from "@/lib/format";

export function SpendingView({ summary }: { summary: MonthlySummary }) {
  const maxCategory = Math.max(...summary.categories.map((category) => category.amount), 1);

  return (
    <section className="page-stack">
      <header className="page-header">
        <div>
          <h1>Spending</h1>
          <p>Monthly budget performance, category concentration, and merchant-level spending.</p>
        </div>
        <div className="status-chip">{summary.month}</div>
      </header>

      <div className="metric-grid three">
        <article className="metric-card tone-coral">
          <span>Total spending</span>
          <strong>{formatCurrency(summary.total_spending)}</strong>
          <small>{formatPercent(summary.budget_used_pct)} of monthly budget</small>
        </article>
        <article className="metric-card tone-green">
          <span>Income</span>
          <strong>{formatCurrency(summary.total_income)}</strong>
          <small>Latest observed month</small>
        </article>
        <article className="metric-card tone-indigo">
          <span>Net cashflow</span>
          <strong>{formatCurrency(summary.net_cashflow)}</strong>
          <small>Income minus spend</small>
        </article>
      </div>

      <div className="dashboard-layout">
        <article className="panel span-2">
          <div className="panel-heading">
            <h2>Category breakdown</h2>
          </div>
          <div className="category-chart">
            {summary.categories.map((category) => (
              <div className="category-row" key={category.category}>
                <span>{category.category}</span>
                <div className="bar-track">
                  <div className="bar-fill risk-low" style={{ width: `${Math.max(8, (category.amount / maxCategory) * 100)}%` }} />
                </div>
                <strong>{formatCurrency(category.amount)}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <h2>Top merchants</h2>
          </div>
          <div className="list-stack">
            {summary.merchants.map((merchant) => (
              <div className="list-row" key={merchant.merchant}>
                <span>
                  <strong>{merchant.merchant}</strong>
                  <small>{merchant.transaction_count} transactions</small>
                </span>
                <b>{formatCurrency(merchant.amount)}</b>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}

