"use client";

import Link from "next/link";
import React, { useMemo, useState } from "react";

import { AccountVisual, accountSubtitle } from "./account-visual";
import { DistributionDonut } from "./distribution-donut";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { DistributionDonutItem } from "./distribution-donut";
import type { Account, CategorySummary, MerchantSummary, MonthlySummary, RecurringItem, Transaction } from "@/lib/types";

type SpendingViewProps = {
  accounts?: Account[];
  recurringItems?: RecurringItem[];
  summary: MonthlySummary;
  transactions?: Transaction[];
};

type AccountSpendSummary = {
  account: Account;
  income: number;
  spending: number;
};

type SpendingSlice = {
  categories: CategorySummary[];
  income: number;
  merchants: MerchantSummary[];
  netCashflow: number;
  totalSpending: number;
};

type BudgetOverviewRow = {
  expense: number;
  income: number;
  isCurrent: boolean;
  month: string;
};

type WeeklySpendRow = {
  date: string;
  label: string;
  spending: number;
};

type CategoryDistributionItem = DistributionDonutItem & {
  amount: number;
  href: string;
  transactionCount: number;
};

type CalendarCell = {
  day: number | null;
  key: string;
};

const SPENDING_ACCOUNT_TYPES = new Set(["checking", "savings", "cash", "credit_card"]);
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CATEGORY_DISTRIBUTION_COLORS = ["#146c2e", "#0b57d0", "#d93025", "#fbbc04", "#8b5cf6", "#0891b2"];

export function SpendingView({ accounts = [], recurringItems = [], summary, transactions = [] }: SpendingViewProps) {
  const [budget, setBudget] = useState(summary.monthly_budget);
  const [isBudgetDialogOpen, setIsBudgetDialogOpen] = useState(false);
  const [isRecurringDialogOpen, setIsRecurringDialogOpen] = useState(false);
  const [selectedAccountDialogId, setSelectedAccountDialogId] = useState<string | null>(null);
  const [chartMode, setChartMode] = useState<"monthly" | "weekly">("monthly");
  const [hoveredWeeklyIndex, setHoveredWeeklyIndex] = useState<number | null>(null);

  const selectedAccountDialog = accounts.find((account) => account.id === selectedAccountDialogId) ?? null;
  const visibleSlice = summarizeFromMonthlySummary(summary);
  const accountBreakdown = useMemo(() => buildAccountBreakdown(accounts, transactions, summary.month), [accounts, summary.month, transactions]);
  const budgetOverviewRows = useMemo(() => buildBudgetOverviewRows(summary, transactions), [summary, transactions]);
  const weeklySpendRows = useMemo(() => buildWeeklySpendRows(summary.month, transactions), [summary.month, transactions]);
  const weeklySpendChart = useMemo(() => buildWeeklySpendChart(weeklySpendRows), [weeklySpendRows]);
  const categoryDistribution = useMemo(() => buildCategoryDistribution(visibleSlice.categories, summary.month), [summary.month, visibleSlice.categories]);
  const categoryDistributionTotal = categoryDistribution.reduce((sum, item) => sum + item.amount, 0);
  const budgetOverviewMax = Math.max(...budgetOverviewRows.flatMap((row) => [row.expense, row.income]), budget, 1);
  const budgetLineBottom = `${(barHeight(budget, budgetOverviewMax) / 100) * 180}px`;
  const weeklySpendAreaData = `${weeklySpendChart.pathData} L ${weeklySpendChart.lastPoint.x} 44 L ${weeklySpendChart.firstPoint.x} 44 Z`;
  const weeklySpendEndpointStyle = {
    left: `${Number(weeklySpendChart.lastPoint.x)}%`,
    top: `${(Number(weeklySpendChart.lastPoint.y) / 44) * 100}%`
  };
  const hoveredWeeklyRow = hoveredWeeklyIndex === null ? null : weeklySpendRows[hoveredWeeklyIndex] ?? null;
  const hoveredWeeklyPoint = hoveredWeeklyIndex === null ? null : weeklySpendChart.points[hoveredWeeklyIndex] ?? null;
  const budgetUsedPct = budget > 0 ? (visibleSlice.totalSpending / budget) * 100 : 0;
  const remainingBudget = budget - visibleSlice.totalSpending;
  const topCategory = visibleSlice.categories[0];
  const topMerchant = visibleSlice.merchants[0];
  const recurringTotal = recurringItems.reduce((sum, item) => sum + item.monthly_amount, 0);

  function updateHoveredWeeklyPoint(event: { currentTarget: HTMLDivElement; clientX: number }) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(Math.max((event.clientX - bounds.left) / Math.max(bounds.width, 1), 0), 1);
    setHoveredWeeklyIndex(Math.round(ratio * Math.max(weeklySpendRows.length - 1, 0)));
  }

  return (
    <section className="page-stack spending-page" aria-label="Spending analysis">
      <header className="spending-hero">
        <div className="spending-hero-main">
          <span className="section-eyebrow">Expense control</span>
          <h1>Spending</h1>
          <p>Calendar month spending across credit cards, cash accounts, SimpleFIN transactions, and imported statements.</p>
          <div className="spending-hero-chips">
            <span>Calendar month</span>
            <span>{formatMonth(summary.month)}</span>
            <span>{accounts.length || "All"} accounts</span>
          </div>
        </div>

        <div className="spending-hero-side">
          <div className="spending-total-card">
            <span>Total spending</span>
            <strong>{formatCurrency(visibleSlice.totalSpending)}</strong>
            <small>{budget > 0 ? `${formatCurrency(remainingBudget)} left` : "Set a monthly budget"}</small>
          </div>
          <div className="spending-budget-row">
            <div>
              <span>Monthly budget</span>
              <strong>{budget > 0 ? `${formatCurrency(visibleSlice.totalSpending)} / ${formatCurrency(budget)}` : "Not set"}</strong>
            </div>
            <button type="button" onClick={() => setIsBudgetDialogOpen(true)}>
              {budget > 0 ? "Edit budget" : "Set monthly budget"}
            </button>
          </div>
        </div>
      </header>

      <div className="spending-summary-grid">
        <MetricCard label="Budget used" meta={budgetStatus(budgetUsedPct)} tone={budgetTone(budgetUsedPct)} value={budget > 0 ? `${formatPercent(budgetUsedPct)} used` : "No budget"} />
        <MetricCard label="Top category" meta={topCategory ? `${formatCurrency(topCategory.amount)} spend` : "No spending yet"} tone="coral" value={topCategory?.category ?? "None"} />
        <MetricCard label="Top merchant" meta={topMerchant ? `${topMerchant.transaction_count} transactions` : "No merchants yet"} tone="indigo" value={topMerchant?.merchant ?? "None"} />
        <button className="metric-card recurring-metric tone-green" type="button" onClick={() => setIsRecurringDialogOpen(true)} aria-label="Open recurring payments calendar">
          <span>Recurring payments</span>
          <strong>{formatCurrency(recurringTotal)}/mo</strong>
          <small>{recurringItems.length} active</small>
        </button>
      </div>

      <div className="spending-main-grid">
        <article className="panel spending-trend-panel">
          <div className="budget-overview-topline">
            <div className="budget-overview-header" role="list" aria-label="Budget overview summary">
              <div role="listitem">
                <small>Income</small>
                <strong>{formatCurrency(visibleSlice.income)}</strong>
              </div>
              <div role="listitem">
                <small>Expense</small>
                <strong>{formatCurrency(visibleSlice.totalSpending)}</strong>
              </div>
              <div role="listitem">
                <small>Budget</small>
                <strong>{formatCurrency(budget)}</strong>
              </div>
            </div>
            <div className="chart-mode-toggle spending-chart-toggle" role="group" aria-label="Spending chart mode">
              <button aria-pressed={chartMode === "weekly"} onClick={() => setChartMode("weekly")} type="button">
                Weekly spend
              </button>
              <button aria-pressed={chartMode === "monthly"} onClick={() => setChartMode("monthly")} type="button">
                Monthly
              </button>
            </div>
          </div>
          <div className="budget-overview-chart-shell">
            {chartMode === "monthly" ? (
              <>
                <div className="budget-overview-legend" aria-label="Budget overview legend">
                  <span><i className="income" />Income</span>
                  <span><i className="expense" />Expense</span>
                  <span><i className="budget" />Budget</span>
                </div>
                <div className="budget-overview-chart" role="list" aria-label="Budget overview chart">
                  <span className="budget-overview-line" aria-label="Monthly budget line" style={{ bottom: `calc(29px + ${budgetLineBottom})` }} />
                  {budgetOverviewRows.map((row) => (
                    <div className={row.isCurrent ? "budget-overview-month current" : "budget-overview-month"} key={row.month} role="listitem">
                      <div className="budget-overview-bars" aria-label={`${formatShortMonth(row.month)} budget overview`}>
                        <span className="income" title={`Income ${formatCurrency(row.income)}`} style={{ height: `${barHeight(row.income, budgetOverviewMax)}%` }} />
                        <span className="expense" title={`Expense ${formatCurrency(row.expense)}`} style={{ height: `${barHeight(row.expense, budgetOverviewMax)}%` }} />
                      </div>
                      <small>{formatShortMonth(row.month)}</small>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="weekly-spend-trend">
                <div
                  className="weekly-spend-line-chart"
                  aria-label="Weekly spending trend"
                  onMouseMove={updateHoveredWeeklyPoint}
                  onPointerLeave={() => setHoveredWeeklyIndex(null)}
                  onPointerMove={updateHoveredWeeklyPoint}
                  role="img"
                >
                  <svg preserveAspectRatio="none" viewBox="0 0 100 44">
                    <defs>
                      <linearGradient id="weeklySpendArea" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#146c2e" stopOpacity="0.2" />
                        <stop offset="52%" stopColor="#146c2e" stopOpacity="0.08" />
                        <stop offset="100%" stopColor="#147d64" stopOpacity="0" />
                      </linearGradient>
                      <filter id="weeklySpendLineShadow" x="-4%" y="-12%" width="108%" height="124%">
                        <feDropShadow dx="0" dy="1.4" floodColor="#0b3d22" floodOpacity="0.18" stdDeviation="1.2" />
                      </filter>
                    </defs>
                    <g className="weekly-spend-grid" aria-hidden="true">
                      <line x1="0" x2="100" y1="10" y2="10" />
                      <line x1="0" x2="100" y1="20" y2="20" />
                      <line x1="0" x2="100" y1="30" y2="30" />
                      <line x1="0" x2="100" y1="40" y2="40" />
                    </g>
                    <path className="weekly-spend-area" d={weeklySpendAreaData} fill="url(#weeklySpendArea)" />
                    <path className="weekly-spend-line-underlay" d={weeklySpendChart.pathData} />
                    <path className="weekly-spend-line" d={weeklySpendChart.pathData} filter="url(#weeklySpendLineShadow)" />
                  </svg>
                  <span aria-hidden="true" className="weekly-spend-endpoint-dot" style={weeklySpendEndpointStyle} />
                  {hoveredWeeklyRow && hoveredWeeklyPoint ? (
                    <>
                      <span aria-hidden="true" className="chart-hover-guide" style={{ left: `${hoveredWeeklyPoint.x}%` }} />
                      <span aria-hidden="true" className="chart-hover-dot" style={{ left: `${hoveredWeeklyPoint.x}%`, top: `${(hoveredWeeklyPoint.y / 44) * 100}%` }} />
                      <span className="chart-tooltip" style={{ left: `${hoveredWeeklyPoint.x}%`, top: `${(hoveredWeeklyPoint.y / 44) * 100}%` }}>
                        <strong>{formatLongDate(hoveredWeeklyRow.date)}</strong>
                        <small>{formatCurrency(hoveredWeeklyRow.spending)}</small>
                      </span>
                    </>
                  ) : null}
                </div>
                <div className="weekly-spend-axis" aria-label="Weekly spending days">
                  {weeklySpendRows.map((row) => (
                    <span key={row.date} title={`${row.label} spending ${formatCurrency(row.spending)}`}>
                      {row.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </article>

        <article className="panel account-spend-panel">
          <div className="panel-heading compact">
            <div>
              <h2>Spending by account</h2>
              <p>Credit cards and cash accounts contributing to this month.</p>
            </div>
          </div>
          <div className="account-spend-list">
            {accountBreakdown.length > 0 ? (
              accountBreakdown.map((item) => (
                <button
                  className="account-spend-row"
                  key={item.account.id}
                  type="button"
                  onClick={() => setSelectedAccountDialogId(item.account.id)}
                  aria-label={`View ${item.account.name} spending`}
                >
                  <span className="account-spend-identity">
                    <AccountVisual account={item.account} />
                    <span className="account-spend-copy">
                      <strong>{item.account.name}</strong>
                      <small>{accountSubtitle(item.account)}</small>
                    </span>
                  </span>
                  <b>{formatCurrency(item.spending)}</b>
                </button>
              ))
            ) : (
              <p className="empty-copy">No spending transactions found for {formatMonth(summary.month)}.</p>
            )}
          </div>
        </article>
      </div>

      <div className="spending-detail-grid">
        <article className="panel">
          <div className="panel-heading compact">
            <h2>Category breakdown</h2>
            <span>{visibleSlice.categories.length} categories</span>
          </div>
          <div className="cash-distribution-content spending-category-distribution">
            <div className="cash-donut-link spending-category-donut">
              <DistributionDonut centerLabel="Total spent" items={categoryDistribution} totalLabel={formatCurrency(categoryDistributionTotal)} />
            </div>
            <div className="cash-distribution-list spending-category-list">
              {categoryDistribution.map((category) => (
                <Link className="cash-distribution-row spending-distribution-row category-link-row" href={category.href} key={category.label}>
                  <span>
                    <i aria-hidden="true" style={{ background: category.color }} />
                    <span>
                      <strong>{category.label}</strong>
                      <small>{category.transactionCount} transactions</small>
                    </span>
                  </span>
                  <small>
                    <b>{formatCurrency(category.amount)}</b>
                    <span>{formatPercent(category.percent)}</span>
                  </small>
                </Link>
              ))}
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading compact">
            <h2>Top merchants</h2>
            <span>{visibleSlice.merchants.length} merchants</span>
          </div>
          <div className="list-stack">
            {visibleSlice.merchants.length > 0 ? (
              visibleSlice.merchants.map((merchant) => (
                <Link className="list-row list-link-row" href={buildTransactionsHref({ merchant: merchant.merchant, month: summary.month })} key={merchant.merchant}>
                  <span>
                    <strong>{merchant.merchant}</strong>
                    <small>{merchant.transaction_count} transactions</small>
                  </span>
                  <b>{formatCurrency(merchant.amount)}</b>
                </Link>
              ))
            ) : (
              <p className="empty-copy">No merchant spending found for {formatMonth(summary.month)}.</p>
            )}
          </div>
        </article>
      </div>

      <div className="spending-detail-grid">
        <article className="panel">
          <div className="panel-heading compact">
            <h2>Budget watchlist</h2>
            <span>{visibleSlice.categories.filter((category) => (category.budget_used_pct ?? 0) >= 70).length} active thresholds</span>
          </div>
          <div className="list-stack">
            {visibleSlice.categories.length > 0 ? (
              visibleSlice.categories.map((category) => {
                const usedPct = category.budget_used_pct ?? 0;
                return (
                  <Link className="list-row list-link-row" href={buildTransactionsHref({ category: category.category, month: summary.month })} key={category.category}>
                    <span>
                      <strong>{category.category}</strong>
                      <small>{category.budget ? `${formatCurrency(category.amount)} / ${formatCurrency(category.budget)}` : "No category budget"}</small>
                    </span>
                    <span>
                      <b>{category.budget ? formatPercent(usedPct) : "No limit"}</b>
                      <small>{categoryBudgetStatus(usedPct)}</small>
                    </span>
                  </Link>
                );
              })
            ) : (
              <p className="empty-copy">No category spending found for {formatMonth(summary.month)}.</p>
            )}
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading compact">
            <h2>Recurring costs</h2>
            <button type="button" onClick={() => setIsRecurringDialogOpen(true)}>Open calendar</button>
          </div>
          {recurringItems.length > 0 ? (
            <div className="list-stack">
              {recurringItems.map((item) => (
                <Link className="list-row list-link-row" href={buildTransactionsHref({ merchant: item.merchant, month: summary.month })} key={item.merchant} aria-label={`Open ${item.merchant} recurring transactions`}>
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
      </div>

      {isBudgetDialogOpen ? (
        <div className="account-dialog-backdrop" role="presentation" onClick={(event) => event.currentTarget === event.target && setIsBudgetDialogOpen(false)}>
          <div className="account-dialog budget-dialog" role="dialog" aria-modal="true" aria-labelledby="budget-dialog-title">
            <div className="account-dialog-header">
              <div>
                <span className="section-eyebrow">Calendar month</span>
                <h2 id="budget-dialog-title">Monthly budget</h2>
              </div>
              <button type="button" onClick={() => setIsBudgetDialogOpen(false)} aria-label="Close budget dialog">Close</button>
            </div>
            <label className="budget-input-row">
              <span>Budget amount</span>
              <input type="number" min="0" step="1" value={budget} onChange={(event) => setBudget(Number(event.target.value))} />
            </label>
            <p>Applies to the all-account calendar-month Spending view.</p>
          </div>
        </div>
      ) : null}

      {isRecurringDialogOpen ? (
        <RecurringCalendarDialog month={summary.month} recurringItems={recurringItems} onClose={() => setIsRecurringDialogOpen(false)} />
      ) : null}

      {selectedAccountDialog ? (
        <AccountSpendingDialog
          account={selectedAccountDialog}
          budget={budget}
          month={summary.month}
          onClose={() => setSelectedAccountDialogId(null)}
          transactions={transactions}
        />
      ) : null}
    </section>
  );
}

function MetricCard({ label, meta, tone, value }: { label: string; meta: string; tone: "green" | "coral" | "indigo" | "amber"; value: string }) {
  return (
    <article className={`metric-card tone-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{meta}</small>
    </article>
  );
}

function RecurringCalendarDialog({ month, onClose, recurringItems }: { month: string; onClose: () => void; recurringItems: RecurringItem[] }) {
  const displayMonth = recurringItems[0]?.next_payment_date.slice(0, 7) || month;
  const cells = buildCalendarCells(displayMonth);

  return (
    <div className="account-dialog-backdrop" role="presentation" onClick={(event) => event.currentTarget === event.target && onClose()}>
      <div className="account-dialog recurring-dialog" role="dialog" aria-modal="true" aria-labelledby="recurring-dialog-title">
        <div className="account-dialog-header">
          <div>
            <span className="section-eyebrow">{formatMonth(displayMonth)}</span>
            <h2 id="recurring-dialog-title">Recurring payments calendar</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close recurring payments calendar">Close</button>
        </div>
        <div className="recurring-calendar-grid">
          {WEEKDAY_LABELS.map((day) => (
            <span className="recurring-weekday" key={day}>{day}</span>
          ))}
          {cells.map((cell) => {
            if (cell.day === null) {
              return <div className="recurring-calendar-day empty" key={cell.key} aria-hidden="true" />;
            }

            const dayItems = recurringItems.filter((item) => item.next_payment_date === `${displayMonth}-${String(cell.day).padStart(2, "0")}`);
            return (
              <div className="recurring-calendar-day" key={cell.key}>
                <span>{formatShortMonth(displayMonth)} {cell.day}</span>
                {dayItems.map((item) => (
                  <div className="recurring-calendar-item" key={`${item.merchant}-${item.next_payment_date}`}>
                    <strong>{item.merchant}</strong>
                    <small>{formatCurrency(item.monthly_amount)}</small>
                    <Link href={buildTransactionsHref({ merchant: item.merchant })}>View {item.merchant} transactions</Link>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AccountSpendingDialog({
  account,
  budget,
  month,
  onClose,
  transactions
}: {
  account: Account;
  budget: number;
  month: string;
  onClose: () => void;
  transactions: Transaction[];
}) {
  const monthTransactions = transactions.filter((transaction) => transaction.account_id === account.id && isMonthTransaction(transaction, month));
  const spendingTransactions = monthTransactions.filter(isSpendingTransaction);
  const currentSpending = spendingTransactions.reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
  const previousMonth = getPreviousMonth(month);
  const previousSpending = transactions
    .filter((transaction) => transaction.account_id === account.id && isMonthTransaction(transaction, previousMonth))
    .reduce((sum, transaction) => sum + (isSpendingTransaction(transaction) ? Math.abs(transaction.amount) : 0), 0);
  const budgetShare = budget > 0 ? (currentSpending / budget) * 100 : 0;
  const titleId = `account-spending-${account.id}`;

  return (
    <div className="account-dialog-backdrop" role="presentation" onClick={(event) => event.currentTarget === event.target && onClose()}>
      <div className="account-dialog account-spending-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="account-dialog-header">
          <div>
            <span className="section-eyebrow">{formatMonth(month)}</span>
            <h2 id={titleId}>{account.name} spending</h2>
          </div>
          <button type="button" onClick={onClose} aria-label={`Close ${account.name} spending`}>Close</button>
        </div>

        <div className="account-spending-metrics">
          <article>
            <span>Monthly spending</span>
            <strong>{formatCurrency(currentSpending)}</strong>
            <small>{spendingTransactions.length} transactions</small>
          </article>
          <article>
            <span>Vs last month</span>
            <strong>{formatAccountComparison(currentSpending, previousSpending)}</strong>
            <small>{formatShortMonth(previousMonth)} spending {formatCurrency(previousSpending)}</small>
          </article>
          <article>
            <span>Budget share</span>
            <strong>{formatPercent(budgetShare)}</strong>
            <small>{formatPercent(budgetShare)} of total monthly budget</small>
          </article>
        </div>

        <div className="account-dialog-section">
          <div className="panel-heading compact">
            <h3>Transactions</h3>
            <Link href={buildTransactionsHref({ account: account.id, month })}>Open {account.name} transactions</Link>
          </div>
          <div className="account-transaction-list">
            {monthTransactions.map((transaction) => (
              <div className="account-transaction-row" key={transaction.id}>
                <span>
                  <strong>{transaction.merchant_normalized || transaction.merchant_raw || "Unknown merchant"}</strong>
                  <small>{formatTransactionDate(transaction.transaction_date)} · {transaction.category || "Uncategorized"}</small>
                </span>
                <b>{isSpendingTransaction(transaction) ? formatCurrency(Math.abs(transaction.amount)) : formatCurrency(transaction.amount)}</b>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function summarizeFromMonthlySummary(summary: MonthlySummary): SpendingSlice {
  return {
    categories: summary.categories,
    income: summary.total_income,
    merchants: summary.merchants,
    netCashflow: summary.net_cashflow,
    totalSpending: summary.total_spending
  };
}

function buildAccountBreakdown(accounts: Account[], transactions: Transaction[], month: string): AccountSpendSummary[] {
  return accounts
    .filter((account) => SPENDING_ACCOUNT_TYPES.has(account.type))
    .map((account) => {
      const accountTransactions = transactions.filter((transaction) => transaction.account_id === account.id && isMonthTransaction(transaction, month));
      return {
        account,
        income: accountTransactions.reduce((sum, transaction) => sum + (transaction.amount > 0 && transaction.category === "Income" ? transaction.amount : 0), 0),
        spending: accountTransactions.reduce((sum, transaction) => sum + (isSpendingTransaction(transaction) ? Math.abs(transaction.amount) : 0), 0)
      };
    })
    .filter((item) => item.spending > 0)
    .sort((a, b) => b.spending - a.spending);
}

function buildBudgetOverviewRows(summary: MonthlySummary, transactions: Transaction[]): BudgetOverviewRow[] {
  const months = getRecentMonths(summary.month, 6);
  return months.map((month) => {
    if (month === summary.month) {
      return {
        expense: summary.total_spending,
        income: summary.total_income,
        isCurrent: true,
        month
      };
    }

    const monthTransactions = transactions.filter((transaction) => transaction.transaction_date.startsWith(month));
    const income = monthTransactions.reduce((sum, transaction) => sum + (transaction.amount > 0 && transaction.category === "Income" ? transaction.amount : 0), 0);
    const expense = monthTransactions.reduce((sum, transaction) => sum + (isSpendingTransaction(transaction) ? Math.abs(transaction.amount) : 0), 0);
    return {
      expense,
      income,
      isCurrent: false,
      month
    };
  });
}

function buildWeeklySpendRows(month: string, transactions: Transaction[]): WeeklySpendRow[] {
  const monthTransactions = transactions.filter((transaction) => isMonthTransaction(transaction, month));
  const latestTransactionDate = monthTransactions
    .map((transaction) => transaction.transaction_date)
    .sort()
    .at(-1);
  const [year, monthIndex] = month.split("-").map(Number);
  const endDate = latestTransactionDate ? parseUTCDate(latestTransactionDate) : new Date(Date.UTC(year, monthIndex, 0));

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(endDate);
    date.setUTCDate(endDate.getUTCDate() - 6 + index);
    const dateKey = formatISODate(date);
    const spending = transactions
      .filter((transaction) => transaction.transaction_date === dateKey)
      .reduce((sum, transaction) => sum + (isSpendingTransaction(transaction) ? Math.abs(transaction.amount) : 0), 0);

    return {
      date: dateKey,
      label: formatShortDate(dateKey),
      spending
    };
  });
}

type ChartPoint = { x: number; y: number };

function buildWeeklySpendChart(rows: WeeklySpendRow[]): { firstPoint: { x: string; y: string }; lastPoint: { x: string; y: string }; pathData: string; points: ChartPoint[] } {
  if (rows.length === 0) {
    return { firstPoint: { x: "2", y: "38" }, lastPoint: { x: "98", y: "38" }, pathData: "M 2 38", points: [] };
  }

  const values = rows.map((row) => row.spending);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(max - min, 1);
  const chartPoints = rows.map((row, index) => ({
    x: 2 + (index / Math.max(rows.length - 1, 1)) * 96,
    y: 38 - ((row.spending - min) / spread) * 30
  }));

  const pathData = chartPoints
    .map((point, index, allPoints) => {
      if (index === 0) {
        return `M ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
      }

      const previous = allPoints[index - 1];
      const previousControl = allPoints[index - 2] ?? previous;
      const next = allPoints[index + 1] ?? point;
      const smoothing = 0.18;
      const cp1x = previous.x + (point.x - previousControl.x) * smoothing;
      const cp1y = previous.y + (point.y - previousControl.y) * smoothing;
      const cp2x = point.x - (next.x - previous.x) * smoothing;
      const cp2y = point.y - (next.y - previous.y) * smoothing;

      return `C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)} ${cp2x.toFixed(2)} ${cp2y.toFixed(2)} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    })
    .join(" ");
  const firstPoint = chartPoints[0];
  const lastPoint = chartPoints[chartPoints.length - 1];

  return {
    firstPoint: { x: firstPoint.x.toFixed(2), y: firstPoint.y.toFixed(2) },
    lastPoint: { x: lastPoint.x.toFixed(2), y: lastPoint.y.toFixed(2) },
    pathData,
    points: chartPoints
  };
}

function buildCategoryDistribution(categories: CategorySummary[], month: string): CategoryDistributionItem[] {
  const total = categories.reduce((sum, category) => sum + category.amount, 0);

  if (total <= 0) {
    return [{
      amount: 0,
      color: CATEGORY_DISTRIBUTION_COLORS[0],
      href: buildTransactionsHref({ month }),
      label: "No spending",
      percent: 100,
      transactionCount: 0
    }];
  }

  return categories.map((category, index) => ({
    amount: category.amount,
    color: CATEGORY_DISTRIBUTION_COLORS[index % CATEGORY_DISTRIBUTION_COLORS.length],
    href: buildTransactionsHref({ category: category.category, month }),
    label: category.category,
    percent: (category.amount / total) * 100,
    transactionCount: category.transaction_count
  }));
}

function getRecentMonths(month: string, count: number) {
  const [year, monthIndex] = month.split("-").map(Number);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, monthIndex - count + index, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

function getPreviousMonth(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthIndex - 2, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function buildCalendarCells(month: string): CalendarCell[] {
  const [year, monthIndex] = month.split("-").map(Number);
  const firstDay = new Date(Date.UTC(year, monthIndex - 1, 1)).getUTCDay();
  const dayCount = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
  return [
    ...Array.from({ length: firstDay }, (_, index) => ({ day: null, key: `empty-${index}` })),
    ...Array.from({ length: dayCount }, (_, index) => ({ day: index + 1, key: `day-${index + 1}` }))
  ];
}

function isMonthTransaction(transaction: Transaction, month: string) {
  return transaction.transaction_date.startsWith(month);
}

function isSpendingTransaction(transaction: Transaction) {
  return transaction.amount < 0 && !transaction.is_excluded_from_spending && !["Income", "Payment", "Transfer"].includes(transaction.category ?? "");
}

function budgetStatus(value: number) {
  if (value >= 100) return "Over budget";
  if (value >= 90) return "Near budget";
  if (value >= 70) return "Watch pace";
  return "On track";
}

function budgetTone(value: number): "green" | "coral" | "amber" {
  if (value >= 90) return "coral";
  if (value >= 70) return "amber";
  return "green";
}

function categoryBudgetStatus(value: number) {
  if (value >= 100) return "Over budget";
  if (value >= 90) return "Near budget";
  if (value >= 70) return "Watch pace";
  return "On track";
}

function buildTransactionsHref(filters: { account?: string; category?: string; merchant?: string; month?: string }) {
  const params = new URLSearchParams();
  if (filters.month) params.set("month", filters.month);
  if (filters.account) params.set("account", filters.account);
  if (filters.category) params.set("category", filters.category);
  if (filters.merchant) params.set("merchant", filters.merchant);
  const query = params.toString();
  return query ? `/transactions?${query}` : "/transactions";
}

function barHeight(value: number, max: number) {
  if (value <= 0) return 3;
  return Math.max(8, (value / max) * 100);
}

function formatAccountComparison(current: number, previous: number) {
  if (previous <= 0) return "No previous month comparison";
  const delta = ((current - previous) / previous) * 100;
  if (Math.abs(delta) < 0.05) return "Flat vs last month";
  return `${delta > 0 ? "Up" : "Down"} ${formatPercent(Math.abs(delta))} vs last month`;
}

function formatMonth(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, monthIndex - 1, 1)));
}

function formatShortMonth(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(year, monthIndex - 1, 1)));
}

function formatShortDate(date: string) {
  return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", timeZone: "UTC" }).format(parseUTCDate(date));
}

function formatTransactionDate(date: string) {
  return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00.000Z`));
}

function formatLongDate(date: string) {
  return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00.000Z`));
}

function parseUTCDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

function formatISODate(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}
