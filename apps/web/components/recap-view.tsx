import Link from "next/link";
import React from "react";

import { formatCurrency, formatPercent } from "@/lib/format";
import type { MonthlySummary, RecurringItem, Transaction } from "@/lib/types";

type RecapViewProps = {
  period: string;
  recurringItems: RecurringItem[];
  summary: MonthlySummary;
  transactions: Transaction[];
};

export function RecapView({ period, recurringItems, summary, transactions }: RecapViewProps) {
  const savingsRate = summary.total_income > 0 ? (summary.net_cashflow / summary.total_income) * 100 : 0;
  const periodTransactions = transactions.filter((transaction) => transaction.transaction_date.startsWith(period));
  const largestTransaction = [...periodTransactions].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))[0];
  const recurringTotal = recurringItems.reduce((sum, item) => sum + item.monthly_amount, 0);

  return (
    <section className="page-stack recap-page" aria-label="Period recap">
      <header className="page-header">
        <div>
          <span className="section-eyebrow">Financial recap</span>
          <h1>{formatMonth(period)} recap</h1>
          <p>Income, spending, recurring costs, and notable transaction movement for the selected period.</p>
        </div>
        <div className="spending-hero-chips">
          <Link href={`/recap?period=${getRelativeMonth(period, -1)}`}>Previous month</Link>
          <span>{period}</span>
          <Link href={`/recap?period=${getRelativeMonth(period, 1)}`}>Next month</Link>
        </div>
      </header>

      <div className="spending-summary-grid">
        <MetricCard label="Income" value={formatCurrency(summary.total_income)} meta={`${periodTransactions.filter((transaction) => transaction.amount > 0).length} deposits`} />
        <MetricCard label="Spending" value={formatCurrency(summary.total_spending)} meta={`${summary.budget_used_pct.toFixed(1)}% of budget`} />
        <MetricCard label="Net cashflow" value={formatCurrency(summary.net_cashflow)} meta={summary.net_cashflow >= 0 ? "Positive month" : "Cashflow shortfall"} />
        <MetricCard label="Savings rate" value={formatPercent(savingsRate)} meta="Net cashflow / income" />
      </div>

      <div className="spending-detail-grid">
        <article className="panel">
          <div className="panel-heading compact">
            <h2>Notable category changes</h2>
            <span>{summary.categories.length} categories</span>
          </div>
          {summary.categories.length > 0 ? (
            <div className="list-stack">
              {summary.categories.map((category) => (
                <Link className="list-row list-link-row" href={buildTransactionsHref({ category: category.category, month: period })} key={category.category}>
                  <span>
                    <strong>{category.category}</strong>
                    <small>{category.transaction_count} transactions</small>
                  </span>
                  <span>
                    <b>{formatCurrency(category.amount)}</b>
                    <small>{category.budget_used_pct != null ? `${formatPercent(category.budget_used_pct)} of category budget` : "No category budget"}</small>
                  </span>
                  <span className="sr-only">Open {category.category} transactions</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="empty-copy">No spending categories yet</p>
          )}
        </article>

        <article className="panel">
          <div className="panel-heading compact">
            <h2>Top merchants</h2>
            <span>{summary.merchants.length} merchants</span>
          </div>
          {summary.merchants.length > 0 ? (
            <div className="list-stack">
              {summary.merchants.map((merchant) => (
                <Link className="list-row list-link-row" href={buildTransactionsHref({ merchant: merchant.merchant, month: period })} key={merchant.merchant}>
                  <span>
                    <strong>{merchant.merchant}</strong>
                    <small>{merchant.transaction_count} transactions</small>
                  </span>
                  <b>{formatCurrency(merchant.amount)}</b>
                  <span className="sr-only">Open {merchant.merchant} transactions</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="empty-copy">No merchant activity yet</p>
          )}
        </article>
      </div>

      <div className="spending-detail-grid">
        <article className="panel">
          <div className="panel-heading compact">
            <h2>Recurring costs</h2>
            <span>{formatCurrency(recurringTotal)}/mo</span>
          </div>
          {recurringItems.length > 0 ? (
            <div className="list-stack">
              {recurringItems.map((item) => (
                <Link className="list-row list-link-row" href={buildTransactionsHref({ merchant: item.merchant, month: period })} key={item.merchant}>
                  <span>
                    <strong>{item.merchant}</strong>
                    <small>{item.cadence} · next {formatShortDate(item.next_payment_date)}</small>
                  </span>
                  <b>{formatCurrency(item.monthly_amount)}/mo</b>
                </Link>
              ))}
            </div>
          ) : (
            <p className="empty-copy">No recurring costs detected</p>
          )}
        </article>

        <article className="panel">
          <div className="panel-heading compact">
            <h2>Period signal</h2>
            <Link href={`/transactions?month=${period}`}>Open all transactions</Link>
          </div>
          <div className="insight-stat">
            <span>Largest movement</span>
            <strong>{largestTransaction ? formatCurrency(largestTransaction.amount) : "No activity"}</strong>
            <small>{largestTransaction ? largestTransaction.merchant_normalized ?? largestTransaction.merchant_raw : "Import or add transactions to build a recap."}</small>
          </div>
        </article>
      </div>
    </section>
  );
}

function MetricCard({ label, meta, value }: { label: string; meta: string; value: string }) {
  return (
    <article className="metric-card tone-indigo">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{meta}</small>
    </article>
  );
}

function buildTransactionsHref(filters: { category?: string; merchant?: string; month: string }) {
  const params = new URLSearchParams();
  params.set("month", filters.month);
  if (filters.category) params.set("category", filters.category);
  if (filters.merchant) params.set("merchant", filters.merchant);
  return `/transactions?${params.toString()}`;
}

function formatMonth(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, monthIndex - 1, 1)));
}

function formatShortDate(date: string) {
  return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00.000Z`));
}

function getRelativeMonth(month: string, offset: number) {
  const [year, monthIndex] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthIndex - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
