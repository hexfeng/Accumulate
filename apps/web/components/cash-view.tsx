import Link from "next/link";
import React from "react";

import { AccountVisual, accountSubtitle, formatCardBalance, sourceLabel } from "./account-visual";
import { DistributionDonut } from "./distribution-donut";
import { formatCurrency } from "@/lib/format";
import type { Account, CashflowForecast, CashflowForecastPoint, MonthlySummary, Transaction } from "@/lib/types";

type CashViewProps = {
  accounts: Account[];
  forecast: CashflowForecast;
  monthlySummary: MonthlySummary;
  transactions: Transaction[];
};

const CASH_TYPES = new Set(["checking", "savings", "cash"]);
const DISTRIBUTION_COLORS = ["#0b57d0", "#d93025", "#fbbc04", "#8b5cf6", "#146c2e", "#0891b2"];

export function CashView({ accounts, forecast, monthlySummary, transactions }: CashViewProps) {
  const cashAccounts = accounts.filter((account) => CASH_TYPES.has(account.type));
  const creditAccounts = accounts.filter((account) => account.type === "credit_card");
  const cashTotal = cashAccounts.reduce((sum, account) => sum + account.balance, 0);
  const totalAssets = accounts.reduce((sum, account) => sum + Math.max(account.balance, 0), 0);
  const cashAssetPct = totalAssets > 0 ? (cashTotal / totalAssets) * 100 : 0;
  const creditObligations = creditAccounts.reduce((sum, account) => sum + (account.balance < 0 ? Math.abs(account.balance) : 0), 0);
  const netPosition = cashTotal - creditObligations;
  const previousMonth = getPreviousMonth(monthlySummary.month);
  const previousFlow = summarizeTransactionsForMonth(transactions, previousMonth);
  const recapHref = `/recap?period=${monthlySummary.month}`;
  const cashDistribution = buildCashDistribution(cashAccounts);

  return (
    <section className="page-stack cash-page" aria-label="Cash planning">
      <header className="cash-account-header">
        <div className="cash-account-main">
          <div className="cash-account-title">
            <span className="section-eyebrow">Liquidity</span>
            <h1>Cash</h1>
          </div>
          <div className="cash-account-balance" aria-label="Cash total">
            <span>Available balance</span>
            <strong>{formatCurrency(cashTotal)}</strong>
            <div className="cash-account-meta">
              <span className="cash-asset-chip hero-change positive">
                <span className="trend-arrow" aria-hidden="true" />
                <span>Cash is {formatPercent(cashAssetPct)} of total assets</span>
              </span>
              <small>{cashAccounts.length} cash accounts ready</small>
            </div>
          </div>
          <p>Checking, savings, and cash accounts with card obligations folded into the short-term view.</p>
        </div>

        <div className="cash-account-side">
          <div className="cash-account-stat">
            <span>Card obligations</span>
            <strong>{formatCurrency(creditObligations)}</strong>
            <small>Short-term payoff need</small>
          </div>
          <div className="cash-account-stat">
            <span>Net position</span>
            <strong>{formatCurrency(netPosition)}</strong>
            <small>After card obligations</small>
          </div>
          <div className="cash-account-actions">
            <Link href="/accounts">Manage accounts</Link>
            <Link href="/transactions">Review transactions</Link>
          </div>
        </div>
      </header>

      <div className="cash-summary-grid">
        <CashMetric href={recapHref} label="In-flow" value={formatCurrency(monthlySummary.total_income)} meta={formatMonthlyChange(monthlySummary.total_income, previousFlow.inflow)} />
        <CashMetric href={recapHref} label="Out-flow" value={formatCurrency(monthlySummary.total_spending)} meta={formatMonthlyChange(monthlySummary.total_spending, previousFlow.outflow)} />
        <CashMetric href="/accounts" label="Available cash" value={formatCurrency(cashTotal)} meta={`${cashAccounts.length} cash accounts`} />
        <CashMetric href="/accounts" label="Net position" value={formatCurrency(netPosition)} meta={netPosition >= 0 ? "After card obligations" : "Gap after card obligations"} />
      </div>

      <div className="cash-insight-grid">
        <article className="panel forecast-panel">
          <div className="panel-heading compact">
            <h2>30/60/90 cashflow forecast</h2>
            <span>As of {forecast.as_of}</span>
          </div>
          <div className="cash-forecast-grid">
            {forecast.points.map((point) => (
              <ForecastCard key={point.horizon_days} point={point} />
            ))}
          </div>
          <div className="forecast-assumptions">
            <span>Income model: {String(forecast.assumptions.income_model ?? "not set")}</span>
            <span>Spending model: {String(forecast.assumptions.spending_model ?? "not set")}</span>
          </div>
        </article>
        <CashDistributionPanel items={cashDistribution} />
      </div>

      <div className="cash-tables-grid">
        <AccountTable title="Cash accounts" empty="Add a checking, savings, or cash account to unlock liquidity tracking." accounts={cashAccounts} />
        <AccountTable title="Credit card obligations" empty="Add a credit card account to track short-term payoff needs." accounts={creditAccounts} />
      </div>
    </section>
  );
}

function CashMetric({ href, label, meta, value }: { href: string; label: string; meta: string; value: string }) {
  return (
    <Link className="metric-card cash-metric" href={href}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{meta}</small>
    </Link>
  );
}

function ForecastCard({ point }: { point: CashflowForecastPoint }) {
  return (
    <div className={`forecast-card risk-${point.risk_level}`}>
      <div>
        <span>{point.horizon_days} days</span>
        <strong>{formatRisk(point.risk_level)} risk</strong>
      </div>
      <b>{formatCurrency(point.projected_cash_balance)}</b>
      <dl>
        <div>
          <dt>Income</dt>
          <dd>{formatCurrency(point.projected_income)}</dd>
        </div>
        <div>
          <dt>Spending</dt>
          <dd>{formatCurrency(point.projected_spending)}</dd>
        </div>
      </dl>
    </div>
  );
}

function AccountTable({ accounts, empty, title }: { accounts: Account[]; empty: string; title: string }) {
  return (
    <article className="panel account-table-panel">
      <div className="panel-heading compact">
        <h2>{title}</h2>
        <span>{accounts.length} accounts</span>
      </div>
      {accounts.length ? (
        <div className="simple-table" role="list" aria-label={title}>
          {accounts.map((account) => (
            <Link className="simple-table-row simple-table-link account-row-button" href="/accounts" key={account.id} aria-label={`Open ${account.name} account`}>
              <div className="account-row-main">
                <AccountVisual account={account} />
                <div>
                  <span className="account-name-line">
                    <strong>{account.name}</strong>
                    <span className={`source-badge source-${account.source}`}>{sourceLabel(account.source)}</span>
                  </span>
                  <small>{accountSubtitle(account)}</small>
                </div>
              </div>
              <div className="account-row-balance">
                <strong>{account.type === "credit_card" ? formatCardBalance(account.balance) : formatCurrency(account.balance)}</strong>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="empty-copy">{empty}</p>
      )}
    </article>
  );
}

function CashDistributionPanel({ items }: { items: CashDistributionItem[] }) {
  const total = items.reduce((sum, item) => sum + item.amount, 0);

  return (
    <article className="panel cash-distribution-panel">
      <div className="panel-heading compact">
        <h2>Cash account distribution</h2>
        <span>{items.length} accounts</span>
      </div>
      <div className="cash-distribution-content">
        <Link className="cash-donut-link" href="/accounts" aria-label="Open accounts from cash distribution">
          <DistributionDonut centerLabel="Total cash" items={items} totalLabel={formatCurrency(total)} />
        </Link>
        <div className="cash-distribution-list">
          {items.map((item) => (
            <div className="cash-distribution-row" key={item.label}>
              <span>
                <i aria-hidden="true" style={{ background: item.color }} />
                {item.label}
              </span>
              <small>{formatPercent(item.percent)}</small>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

type CashDistributionItem = {
  amount: number;
  color: string;
  label: string;
  percent: number;
};

function buildCashDistribution(accounts: Account[]): CashDistributionItem[] {
  const total = accounts.reduce((sum, account) => sum + Math.max(account.balance, 0), 0);

  if (total <= 0) {
    return [{ amount: 0, color: DISTRIBUTION_COLORS[0], label: "No cash accounts", percent: 100 }];
  }

  return accounts.map((account, index) => {
    const amount = Math.max(account.balance, 0);
    return {
      amount,
      color: DISTRIBUTION_COLORS[index % DISTRIBUTION_COLORS.length],
      label: account.name,
      percent: (amount / total) * 100
    };
  });
}

function summarizeTransactionsForMonth(transactions: Transaction[], month: string) {
  const monthTransactions = transactions.filter((transaction) => transaction.transaction_date.startsWith(month));
  return {
    inflow: monthTransactions.reduce((sum, transaction) => sum + (transaction.amount > 0 && transaction.category === "Income" ? transaction.amount : 0), 0),
    outflow: monthTransactions.reduce((sum, transaction) => sum + (isSpendingTransaction(transaction) ? Math.abs(transaction.amount) : 0), 0)
  };
}

function isSpendingTransaction(transaction: Transaction) {
  return transaction.amount < 0 && !transaction.is_excluded_from_spending && !["Income", "Payment", "Transfer"].includes(transaction.category ?? "");
}

function getPreviousMonth(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  if (!year || !monthIndex) {
    return month;
  }

  const previous = new Date(Date.UTC(year, monthIndex - 2, 1));
  return `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatMonthlyChange(current: number, previous: number) {
  if (previous === 0) {
    return current === 0 ? "No change vs last month" : "No prior month data";
  }

  const changePct = ((current - previous) / previous) * 100;
  if (Math.abs(changePct) < 0.05) {
    return "No change vs last month";
  }

  return `${changePct > 0 ? "Up" : "Down"} ${Math.abs(changePct).toFixed(1)}% vs last month`;
}

function formatRisk(risk: string) {
  return risk.charAt(0).toUpperCase() + risk.slice(1);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}
