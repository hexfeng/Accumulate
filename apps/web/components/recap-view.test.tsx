import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import { RecapView } from "./recap-view";
import type { MonthlySummary, RecurringItem, Transaction } from "@/lib/types";

const summary: MonthlySummary = {
  month: "2026-05",
  total_income: 5200,
  total_spending: 1248.26,
  net_cashflow: 3951.74,
  monthly_budget: 3000,
  budget_used_pct: 41.61,
  categories: [
    { category: "Groceries", amount: 526.42, transaction_count: 3, budget: 650, budget_used_pct: 80.99 },
    { category: "Dining", amount: 405.85, transaction_count: 8, budget: 500, budget_used_pct: 81.17 }
  ],
  merchants: [{ merchant: "Loblaws", amount: 326.42, transaction_count: 2 }]
};

const recurringItems: RecurringItem[] = [
  { merchant: "Netflix", cadence: "monthly", monthly_amount: 18.99, annualized_amount: 227.88, next_payment_date: "2026-06-15", confidence: 0.86 }
];

const transactions: Transaction[] = [
  { id: "income", user_id: "local-user", account_id: "chequing", account_name: "Chequing", account_type: "checking", transaction_date: "2026-05-01", amount: 5200, currency: "CAD", merchant_raw: "PAYROLL", description_raw: "PAYROLL", source: "mock_simplefin", merchant_normalized: "Payroll", category: "Income", is_excluded_from_spending: false },
  { id: "grocery", user_id: "local-user", account_id: "visa", account_name: "CIBC Visa", account_type: "credit_card", transaction_date: "2026-05-04", amount: -326.42, currency: "CAD", merchant_raw: "LOBLAWS", description_raw: "LOBLAWS", source: "mock_simplefin", merchant_normalized: "Loblaws", category: "Groceries", is_excluded_from_spending: false }
];

describe("RecapView", () => {
  it("renders a period recap with cashflow, savings rate, recurring costs, notable categories, and drill-down links", () => {
    render(<RecapView period="2026-05" recurringItems={recurringItems} summary={summary} transactions={transactions} />);

    expect(screen.getByRole("heading", { name: "May 2026 recap" })).toBeInTheDocument();
    expect(screen.getByText("Savings rate")).toBeInTheDocument();
    expect(screen.getByText("76.0%")).toBeInTheDocument();
    expect(screen.getAllByText("$5,200.00").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("$1,248.26")).toBeInTheDocument();
    expect(screen.getByText("$3,951.74")).toBeInTheDocument();
    expect(screen.getByText("Recurring costs")).toBeInTheDocument();
    expect(screen.getAllByText("$18.99/mo").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Notable category changes")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open Groceries transactions/ })).toHaveAttribute("href", "/transactions?month=2026-05&category=Groceries");
    expect(screen.getByRole("link", { name: /Open Loblaws transactions/ })).toHaveAttribute("href", "/transactions?month=2026-05&merchant=Loblaws");
  });

  it("renders a useful sparse-data state without crashing", () => {
    render(<RecapView period="2026-06" recurringItems={[]} summary={{ ...summary, month: "2026-06", total_income: 0, total_spending: 0, net_cashflow: 0, categories: [], merchants: [] }} transactions={[]} />);

    expect(screen.getByRole("heading", { name: "June 2026 recap" })).toBeInTheDocument();
    expect(screen.getByText("No spending categories yet")).toBeInTheDocument();
    expect(screen.getByText("No recurring costs detected")).toBeInTheDocument();
  });
});
