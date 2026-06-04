import Link from "next/link";
import React from "react";

import { NetWorthTrendPanel } from "@/components/net-worth-trend-panel";
import { compactCurrency, formatCurrency, formatPercent } from "@/lib/format";
import type { AssetAllocationItem, CashflowForecastPoint, DashboardSnapshot, NetWorthHistory } from "@/lib/types";

type Props = {
  initialNetWorthHistory: NetWorthHistory;
  snapshot: DashboardSnapshot;
};

type KpiCardProps = {
  href: string;
  label: string;
  meta: string;
  tone: "green" | "coral" | "indigo" | "amber";
  value: string;
};

const DEFAULT_GOAL = {
  name: "FIRE",
  targetAmount: 1_500_000
};

const RISK_PRIORITY: Record<string, number> = {
  low: 0,
  medium: 1,
  high: 2
};

const MOCK_ASSET_ALLOCATION: AssetAllocationItem[] = [
  { label: "Stocks", percent: 42, tone: "stocks", is_mock: true },
  { label: "ETF", percent: 33, tone: "etf", is_mock: true },
  { label: "Cash", percent: 25, tone: "cash", is_mock: true }
];

export function DashboardView({ initialNetWorthHistory, snapshot }: Props) {
  const cashPosition = snapshot.accounts
    .filter((account) => ["checking", "savings", "cash"].includes(account.type))
    .reduce((sum, account) => sum + account.balance, 0);
  const accountsOnlyNetWorth = snapshot.accounts.reduce((sum, account) => sum + account.balance, 0);
  const totalNetWorth = initialNetWorthHistory.current_value || accountsOnlyNetWorth;
  const yesterdayChange = getYesterdayChange(initialNetWorthHistory, totalNetWorth);
  const goalProgressPct = Math.min((totalNetWorth / DEFAULT_GOAL.targetAmount) * 100, 100);
  const highestRisk = getHighestCashflowRisk(snapshot.forecast.points);
  const recurringMonthlyTotal = snapshot.recurring_items.reduce((sum, item) => sum + item.monthly_amount, 0);
  const topCategory = snapshot.monthly_summary.categories[0];
  const currentPeriod = formatPeriod(snapshot.monthly_summary.month);
  const currentPeriodShort = formatShortPeriod(snapshot.monthly_summary.month);
  const assetAllocation = normalizeAssetAllocation(snapshot.asset_allocation?.length ? snapshot.asset_allocation : MOCK_ASSET_ALLOCATION);
  const hasMockAllocation = assetAllocation.some((asset) => asset.is_mock);
  const allocationLabel = assetAllocation.map((asset) => `${asset.label} ${asset.percent}%`).join(", ");

  return (
    <section className="page-stack dashboard-preview" aria-label="Dashboard preview">
      <header className="dashboard-hero">
        <div className="hero-net-worth">
          <span className="hero-eyebrow">Total net worth</span>
          <Link href="/investments" className="hero-amount" aria-label="Open investments from total net worth">
            {formatCurrency(totalNetWorth)}
          </Link>
          <div className={`hero-change ${yesterdayChange.amount >= 0 ? "positive" : "negative"}`}>
            <span className="trend-arrow" aria-hidden="true" />
            <span>{yesterdayChange.amountLabel}</span>
            <span>{yesterdayChange.percentLabel}</span>
            <span>vs yesterday</span>
          </div>
          <p>Accounts-only estimate {"\u00b7"} {hasMockAllocation ? "Mock allocation until holdings connect" : "Holdings allocation connected"}</p>
        </div>

        <Link className="goal-card" href="/settings?section=goals" aria-label="Open goal settings">
          <div className="goal-header">
            <span>Goal</span>
            <strong>{DEFAULT_GOAL.name}</strong>
          </div>
          <div className="goal-stats">
            <b>
              {formatPercent(goalProgressPct)} <span>complete</span>
            </b>
            <small>
              {compactCurrency.format(totalNetWorth)} / {compactCurrency.format(DEFAULT_GOAL.targetAmount)}
            </small>
          </div>
          <div className="goal-track" aria-label={`${formatPercent(goalProgressPct)} complete`}>
            <div className="goal-fill" style={{ width: `${goalProgressPct}%` }} />
          </div>
        </Link>

        <div className="asset-distribution" aria-label="Asset allocation">
          <div className="asset-distribution-caption">
            <span>{hasMockAllocation ? "Mock asset mix" : "Asset mix"}</span>
            <small>{hasMockAllocation ? "Placeholder until investments are added" : "Based on connected holdings"}</small>
          </div>
          <div className="asset-distribution-track" role="img" aria-label={allocationLabel}>
            {assetAllocation.map((asset) => (
              <span
                className={`asset-segment asset-${asset.tone}`}
                key={asset.label}
                style={{ width: `${asset.percent}%` }}
              />
            ))}
          </div>
          <div className="asset-distribution-legend">
            {assetAllocation.map((asset) => (
              <span key={asset.label}>
                <i className={`asset-dot asset-${asset.tone}`} aria-hidden="true" />
                {asset.label} {asset.percent}%
              </span>
            ))}
          </div>
        </div>

        <div className="hero-meta-row">
          <span className="hero-period">{currentPeriod}</span>
          <Link className="hero-chip" href="/accounts">
            Local-first mode
          </Link>
          <Link className="hero-chip" href="/accounts">
            Mock SimpleFIN ready
          </Link>
          <Link className="hero-primary-action" href="/accounts">
            Add data
          </Link>
        </div>
      </header>

      <div className="kpi-nav-grid" aria-label="Dashboard navigation metrics">
        <DashboardKpiCard href="/cash" label="Cash" value={formatCurrency(cashPosition)} meta="90d projected positive" tone="green" />
        <DashboardKpiCard href="/investments" label="Investments" value="Not set" meta="Add holdings" tone="indigo" />
        <DashboardKpiCard href="/spending" label="Spending" value={formatCurrency(snapshot.monthly_summary.total_spending)} meta={`${formatPercent(snapshot.monthly_summary.budget_used_pct)} of budget`} tone="coral" />
        <DashboardKpiCard href="/accounts" label="Accounts" value={`${snapshot.accounts.length} active`} meta="View data health" tone="green" />
        <DashboardKpiCard href={`/recap?period=${snapshot.monthly_summary.month}`} label="Recap" value={`${currentPeriodShort} ready`} meta="Review month" tone="indigo" />
        <DashboardKpiCard href={highestRisk.href} label="Risk" value={highestRisk.label} meta={highestRisk.meta} tone={highestRisk.tone} />
      </div>

      <div className="dashboard-main-grid">
        <NetWorthTrendPanel initialHistory={initialNetWorthHistory} />
        <article className="panel attention-panel">
          <div className="panel-heading">
            <div>
              <h2>
                <svg aria-hidden="true" viewBox="0 0 24 24">
                  <path d="M12 2L15 9l7 3-7 3-3 7-3-7-7-3 7-3z" />
                </svg>
                Needs attention
              </h2>
              <p>Highest priority tasks and signals.</p>
            </div>
          </div>
          <div className="attention-list">
            {topCategory ? (
              <AttentionItem
                href={`/spending?category=${encodeURIComponent(topCategory.category)}`}
                tone="amber"
                title={`${topCategory.category} near budget`}
                description={`${formatPercent(topCategory.budget_used_pct ?? 0)} used \u00b7 view spending`}
              />
            ) : null}
            <AttentionItem href="/investments" tone="indigo" title="Add holdings" description="Complete net worth tracking" />
            <AttentionItem
              href={`/recap?period=${snapshot.monthly_summary.month}`}
              tone="green"
              title="Monthly recap ready"
              description={`${currentPeriod} summary is ready`}
            />
          </div>
        </article>
      </div>

      <div className="secondary-insight-grid">
        <article className="panel insight-panel">
          <div className="panel-heading compact">
            <h2>Cashflow forecast</h2>
            <Link href="/cash">View cash</Link>
          </div>
          <div className="forecast-bars">
            {snapshot.forecast.points.map((point) => (
              <div className="forecast-row" key={point.horizon_days}>
                <span>{point.horizon_days}d</span>
                <div className="bar-track">
                  <div className={`bar-fill risk-${point.risk_level}`} style={{ width: `${forecastWidth(point, snapshot.forecast.points)}%` }} />
                </div>
                <strong>{formatCurrency(point.projected_cash_balance)}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="panel insight-panel">
          <div className="panel-heading compact">
            <h2>Spending insight</h2>
            <Link href="/spending">View spending</Link>
          </div>
          <div className="insight-stat">
            <span>Top category</span>
            <strong>{topCategory ? topCategory.category : "No spending yet"}</strong>
            <small>{topCategory ? `${formatCurrency(topCategory.amount)} \u00b7 ${formatPercent(topCategory.budget_used_pct ?? 0)} of budget` : "Import transactions to unlock insights"}</small>
          </div>
          <div className="insight-note">
            {snapshot.recurring_items.length} recurring detected {"\u00b7"} {formatCurrency(recurringMonthlyTotal)}/mo
          </div>
        </article>

        <article className="panel insight-panel">
          <div className="panel-heading compact">
            <h2>Recap / goal</h2>
            <Link href={`/recap?period=${snapshot.monthly_summary.month}`}>View recap</Link>
          </div>
          <div className="insight-stat">
            <span>{currentPeriod} recap</span>
            <strong>Ready to review</strong>
            <small>
              Income {formatCurrency(snapshot.monthly_summary.total_income)} {"\u00b7"} Net cashflow {formatCurrency(snapshot.monthly_summary.net_cashflow)}
            </small>
          </div>
          <div className="mini-goal-track">
            <span style={{ width: `${goalProgressPct}%` }} />
          </div>
        </article>
      </div>
    </section>
  );
}

function DashboardKpiCard({ href, label, meta, tone, value }: KpiCardProps) {
  return (
    <Link className={`metric-card kpi-nav-card tone-${tone}`} href={href}>
      <span>
        <i aria-hidden="true" />
        {label}
      </span>
      <strong>{value}</strong>
      <small>{meta}</small>
    </Link>
  );
}

function AttentionItem({ description, href, title, tone }: { description: string; href: string; title: string; tone: "amber" | "green" | "indigo" }) {
  return (
    <Link className="attention-item" href={href}>
      <span className={`attention-dot tone-${tone}`} />
      <span>
        <strong>{title}</strong>
        <small>
          {description} <em aria-hidden="true">{"\u2192"}</em>
        </small>
      </span>
    </Link>
  );
}

function getYesterdayChange(history: NetWorthHistory, currentValue: number) {
  const previousPoint = history.points.at(-2);
  if (!previousPoint) {
    return { amount: 0, amountLabel: "No previous day data", percentLabel: "" };
  }
  const amount = currentValue - previousPoint.value;
  const pct = previousPoint.value === 0 ? 0 : (amount / previousPoint.value) * 100;
  const direction = amount >= 0 ? "+" : "-";
  return {
    amount,
    amountLabel: formatCurrency(Math.abs(amount)),
    percentLabel: `(${direction}${formatPercent(Math.abs(pct))})`
  };
}

function getHighestCashflowRisk(points: CashflowForecastPoint[]) {
  const highest = points.reduce<string>((risk, point) => ((RISK_PRIORITY[point.risk_level] ?? 0) > (RISK_PRIORITY[risk] ?? 0) ? point.risk_level : risk), "low");
  if (highest === "high") {
    return { href: "/cash", label: "High", meta: "Cashflow needs action", tone: "coral" as const };
  }
  if (highest === "medium") {
    return { href: "/cash", label: "Medium", meta: "Watch upcoming cashflow", tone: "amber" as const };
  }
  return { href: "/cash", label: "Low", meta: "Cashflow ok", tone: "green" as const };
}

function forecastWidth(point: CashflowForecastPoint, points: CashflowForecastPoint[]) {
  const maxBalance = Math.max(...points.map((item) => item.projected_cash_balance), 1);
  return Math.max((point.projected_cash_balance / maxBalance) * 100, 8);
}

function formatPeriod(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  if (!year || !monthIndex) {
    return month;
  }
  return new Intl.DateTimeFormat("en-CA", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, monthIndex - 1, 1)));
}

function formatShortPeriod(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  if (!year || !monthIndex) {
    return month;
  }
  return new Intl.DateTimeFormat("en-CA", { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(year, monthIndex - 1, 1)));
}

function normalizeAssetAllocation(items: AssetAllocationItem[]) {
  const total = items.reduce((sum, item) => sum + item.percent, 0);
  if (total <= 0) {
    return MOCK_ASSET_ALLOCATION;
  }
  return items.map((item) => ({
    ...item,
    percent: Math.round((item.percent / total) * 100)
  }));
}
