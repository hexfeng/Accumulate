import { fireEvent, render, screen, within } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import { SpendingView } from "./spending-view";
import type { Account, MonthlySummary, RecurringItem, Transaction } from "@/lib/types";

const summary: MonthlySummary = {
  month: "2026-05",
  total_income: 5200,
  total_spending: 1248.26,
  net_cashflow: 3951.74,
  monthly_budget: 3000,
  budget_used_pct: 41.61,
  categories: [
    { category: "Groceries", amount: 526.42, transaction_count: 3, budget: 650, budget_used_pct: 80.99 },
    { category: "Dining", amount: 405.85, transaction_count: 8, budget: 500, budget_used_pct: 81.17 },
    { category: "Subscriptions", amount: 75.98, transaction_count: 4, budget: 150, budget_used_pct: 50.65 }
  ],
  merchants: [
    { merchant: "Loblaws", amount: 326.42, transaction_count: 2 },
    { merchant: "Uber Eats", amount: 148.1, transaction_count: 3 },
    { merchant: "Netflix", amount: 18.99, transaction_count: 1 }
  ]
};

const accounts: Account[] = [
  { id: "cibc-visa", user_id: "local-user", name: "CIBC Visa", type: "credit_card", balance: -860, currency: "CAD", source: "mock_simplefin" },
  { id: "cash-wallet", user_id: "local-user", name: "Cash Wallet", type: "cash", balance: 150, currency: "CAD", source: "manual" },
  { id: "chequing", user_id: "local-user", name: "Chequing", type: "checking", balance: 4200, currency: "CAD", source: "mock_simplefin" }
];

const transactions: Transaction[] = [
  { id: "payroll", user_id: "local-user", account_id: "chequing", account_name: "Chequing", account_type: "checking", transaction_date: "2026-05-01", amount: 5200, currency: "CAD", merchant_raw: "PAYROLL", description_raw: "PAYROLL", source: "mock_simplefin", merchant_normalized: "Payroll", category: "Income", is_excluded_from_spending: false },
  { id: "loblaws-may", user_id: "local-user", account_id: "cibc-visa", account_name: "CIBC Visa", account_type: "credit_card", transaction_date: "2026-05-04", amount: -326.42, currency: "CAD", merchant_raw: "LOBLAWS", description_raw: "LOBLAWS", source: "mock_simplefin", merchant_normalized: "Loblaws", category: "Groceries", is_excluded_from_spending: false },
  { id: "uber-may", user_id: "local-user", account_id: "cibc-visa", account_name: "CIBC Visa", account_type: "credit_card", transaction_date: "2026-05-09", amount: -148.1, currency: "CAD", merchant_raw: "UBER EATS", description_raw: "UBER EATS", source: "mock_simplefin", merchant_normalized: "Uber Eats", category: "Dining", is_excluded_from_spending: false },
  { id: "coffee-may", user_id: "local-user", account_id: "cash-wallet", account_name: "Cash Wallet", account_type: "cash", transaction_date: "2026-05-14", amount: -24.75, currency: "CAD", merchant_raw: "CAFE", description_raw: "CAFE", source: "manual", merchant_normalized: "Cafe", category: "Dining", is_excluded_from_spending: false },
  { id: "apr-spend", user_id: "local-user", account_id: "cibc-visa", account_name: "CIBC Visa", account_type: "credit_card", transaction_date: "2026-04-15", amount: -930, currency: "CAD", merchant_raw: "GROCER", description_raw: "GROCER", source: "mock_simplefin", merchant_normalized: "Grocer", category: "Groceries", is_excluded_from_spending: false },
  { id: "mar-spend", user_id: "local-user", account_id: "cash-wallet", account_name: "Cash Wallet", account_type: "cash", transaction_date: "2026-03-12", amount: -720, currency: "CAD", merchant_raw: "MARKET", description_raw: "MARKET", source: "manual", merchant_normalized: "Market", category: "Groceries", is_excluded_from_spending: false }
];

const recurringItems: RecurringItem[] = [
  { merchant: "Netflix", cadence: "monthly", monthly_amount: 18.99, annualized_amount: 227.88, next_payment_date: "2026-06-15", confidence: 0.86 },
  { merchant: "Spotify", cadence: "monthly", monthly_amount: 11.99, annualized_amount: 143.88, next_payment_date: "2026-06-22", confidence: 0.81 }
];

function renderSpendingView() {
  const Component = SpendingView as React.ComponentType<{
    accounts: Account[];
    recurringItems: RecurringItem[];
    summary: MonthlySummary;
    transactions: Transaction[];
  }>;

  return render(<Component accounts={accounts} recurringItems={recurringItems} summary={summary} transactions={transactions} />);
}

describe("SpendingView", () => {
  it("renders natural-month spending with budget, budget overview chart, account sources, and transaction drill-downs", () => {
    renderSpendingView();

    expect(screen.getByRole("heading", { name: "Spending" })).toBeInTheDocument();
    expect(screen.getByText("Calendar month")).toBeInTheDocument();
    expect(screen.getByText("May 2026")).toBeInTheDocument();
    expect(screen.getAllByText("$1,248.26").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("$1,248.26 / $3,000.00")).toBeInTheDocument();
    expect(screen.getByText("41.6% used")).toBeInTheDocument();
    expect(screen.getByText("$1,751.74 left")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit budget" })).toBeInTheDocument();

    expect(screen.queryByRole("heading", { name: "Budget overview" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Review transactions" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Monthly" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Weekly spend" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByText("Income, expense, outcome, and budget across recent calendar months.")).not.toBeInTheDocument();
    const budgetOverviewTopline = document.querySelector(".budget-overview-topline");
    const budgetOverviewSummary = screen.getByRole("list", { name: "Budget overview summary" });
    const chartModeGroup = screen.getByRole("group", { name: "Spending chart mode" });
    expect(budgetOverviewTopline).toContainElement(budgetOverviewSummary);
    expect(budgetOverviewTopline).toContainElement(chartModeGroup);
    expect(within(budgetOverviewSummary).getAllByRole("listitem")).toHaveLength(3);
    expect(document.querySelector(".budget-overview-chart-shell")).toBeInTheDocument();
    expect(screen.getAllByText("Income").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Expense").length).toBeGreaterThanOrEqual(1);
    const budgetChart = screen.getByRole("list", { name: "Budget overview chart" });
    expect(budgetChart).toBeInTheDocument();
    expect(within(budgetChart).getAllByRole("listitem")).toHaveLength(6);
    expect(screen.getByLabelText("Monthly budget line")).toBeInTheDocument();
    expect(document.querySelectorAll(".budget-overview-bars span")).toHaveLength(12);
    expect(document.querySelectorAll(".budget-overview-bars span.outcome")).toHaveLength(0);
    expect(document.querySelectorAll(".budget-overview-bars span.budget")).toHaveLength(0);
    expect(screen.queryByText("Outcome", { selector: ".budget-overview-legend span" })).not.toBeInTheDocument();
    expect(screen.queryByText("Budget", { selector: ".budget-overview-legend span" })).toBeInTheDocument();
    expect(screen.getByText("Dec")).toBeInTheDocument();
    expect(screen.getByText("Jan")).toBeInTheDocument();
    expect(screen.getByText("Feb")).toBeInTheDocument();
    expect(screen.getByText("Mar")).toBeInTheDocument();
    expect(screen.getByText("Apr")).toBeInTheDocument();
    expect(screen.getByText("May")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Weekly spending chart" })).not.toBeInTheDocument();

    expect(screen.getByText("Spending by account")).toBeInTheDocument();
    expect(screen.getByText("CIBC Visa")).toBeInTheDocument();
    expect(screen.getByText("Cash Wallet")).toBeInTheDocument();
    const cibcSpendRow = screen.getByRole("button", { name: "View CIBC Visa spending" });
    expect(cibcSpendRow).toBeInTheDocument();
    expect(cibcSpendRow.querySelector(".account-visual")).toBeInTheDocument();
    expect(cibcSpendRow.querySelector(".card-visual")).toBeInTheDocument();
    expect(cibcSpendRow.querySelector("img")).toHaveAttribute("src", "/institutions/cards/cibc-aventura-visa-infinite.png");
    const cashWalletSpendRow = screen.getByRole("button", { name: "View Cash Wallet spending" });
    expect(cashWalletSpendRow.querySelector(".account-visual")).toBeInTheDocument();
    expect(cashWalletSpendRow.querySelector(".bank-visual")).toBeInTheDocument();

    const categoryPanel = screen.getByText("Category breakdown").closest("article");
    expect(categoryPanel).not.toBeNull();
    const categoryBreakdown = within(categoryPanel as HTMLElement);
    expect(categoryBreakdown.getByText("$1,008.25")).toBeInTheDocument();
    const categoryDonut = categoryBreakdown.getByLabelText("Groceries 52.2%, Dining 40.3%, Subscriptions 7.5%");
    expect(categoryDonut.tagName).toBe("svg");
    expect(categoryDonut.querySelectorAll(".cash-donut-segment")).toHaveLength(3);
    expect(categoryBreakdown.getByText("52.2%")).toBeInTheDocument();
    expect(categoryBreakdown.getByText("40.3%")).toBeInTheDocument();
    expect(categoryBreakdown.getByText("7.5%")).toBeInTheDocument();
    expect(document.querySelector(".spending-category-chart .bar-track")).not.toBeInTheDocument();

    const groceriesLink = categoryBreakdown.getByRole("link", { name: /Groceries/ });
    expect(groceriesLink).toHaveAttribute("href", "/transactions?month=2026-05&category=Groceries");
    const loblawsLink = screen.getByRole("link", { name: /Loblaws/ });
    expect(loblawsLink).toHaveAttribute("href", "/transactions?month=2026-05&merchant=Loblaws");
    expect(screen.getByText("Budget watchlist")).toBeInTheDocument();
    expect(screen.getAllByText("Watch pace").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Recurring costs")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Netflix recurring transactions" })).toHaveAttribute("href", "/transactions?month=2026-05&merchant=Netflix");
  });

  it("switches budget chart between monthly comparison and weekly spend", () => {
    renderSpendingView();

    fireEvent.click(screen.getByRole("button", { name: "Weekly spend" }));

    expect(screen.getByRole("button", { name: "Weekly spend" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Monthly" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("img", { name: "Weekly spending trend" })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Budget overview chart" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Monthly budget line")).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Weekly spending chart" })).not.toBeInTheDocument();
    expect(document.querySelector(".weekly-spend-line")).toBeInTheDocument();
    expect(document.querySelector(".weekly-spend-area")).toBeInTheDocument();
    expect(document.querySelector(".weekly-spend-endpoint-dot")).toBeInTheDocument();
    expect([...document.querySelectorAll("#weeklySpendArea stop")].map((stop) => stop.getAttribute("stop-opacity"))).toEqual(["0.2", "0.08", "0"]);
    expect(document.querySelectorAll(".budget-overview-bars span")).toHaveLength(0);
    expect(screen.getByText("May 9")).toBeInTheDocument();
    expect(screen.getByText("May 14")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Monthly" }));

    expect(screen.getByRole("button", { name: "Monthly" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("list", { name: "Budget overview chart" })).toBeInTheDocument();
    expect(screen.getByLabelText("Monthly budget line")).toBeInTheDocument();
  });

  it("opens recurring payment calendar and account spending details in dialogs", () => {
    renderSpendingView();

    fireEvent.click(screen.getByRole("button", { name: "Open recurring payments calendar" }));
    const dialog = screen.getByRole("dialog", { name: "Recurring payments calendar" });
    expect(within(dialog).getByText("Sun")).toBeInTheDocument();
    expect(within(dialog).getByText("Mon")).toBeInTheDocument();
    expect(within(dialog).getByText("Netflix")).toBeInTheDocument();
    expect(within(dialog).getByText("Jun 15")).toBeInTheDocument();
    expect(within(dialog).getByText("$18.99")).toBeInTheDocument();
    expect(within(dialog).getByText("Spotify")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "View Netflix transactions" })).toHaveAttribute("href", "/transactions?merchant=Netflix");

    fireEvent.click(screen.getByRole("button", { name: "Close recurring payments calendar" }));
    fireEvent.click(screen.getByRole("button", { name: "View CIBC Visa spending" }));

    const accountDialog = screen.getByRole("dialog", { name: "CIBC Visa spending" });
    expect(within(accountDialog).getByText("Monthly spending")).toBeInTheDocument();
    expect(within(accountDialog).getByText("$474.52")).toBeInTheDocument();
    expect(within(accountDialog).getByText("Down 49.0% vs last month")).toBeInTheDocument();
    expect(within(accountDialog).getByText("15.8% of total monthly budget")).toBeInTheDocument();
    expect(within(accountDialog).getByText("Loblaws")).toBeInTheDocument();
    expect(within(accountDialog).getByText("Uber Eats")).toBeInTheDocument();
    expect(within(accountDialog).getByRole("link", { name: "Open CIBC Visa transactions" })).toHaveAttribute("href", "/transactions?month=2026-05&account=cibc-visa");
  });
});
