import { render, screen, within } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import { CashView } from "./cash-view";
import type { Account, CashflowForecast, MonthlySummary, Transaction } from "@/lib/types";

const accounts: Account[] = [
  { id: "chequing", user_id: "local-user", name: "Chequing", type: "checking", balance: 1200, currency: "CAD", source: "manual" },
  { id: "savings", user_id: "local-user", name: "Savings", type: "savings", balance: 2800, currency: "CAD", source: "manual" },
  { id: "visa", user_id: "local-user", name: "Visa", type: "credit_card", balance: -650, currency: "CAD", source: "mock_simplefin" },
  { id: "rrsp", user_id: "local-user", name: "RRSP", type: "investment", balance: 9000, currency: "CAD", source: "manual" }
];

const forecast: CashflowForecast = {
  as_of: "2026-06-03",
  points: [
    { horizon_days: 30, projected_cash_balance: -100, projected_income: 2000, projected_spending: 4100, risk_level: "high" },
    { horizon_days: 60, projected_cash_balance: 450, projected_income: 4000, projected_spending: 7550, risk_level: "medium" },
    { horizon_days: 90, projected_cash_balance: 1200, projected_income: 6000, projected_spending: 8800, risk_level: "low" }
  ],
  assumptions: {
    income_model: "last-observed-month",
    spending_model: "last-observed-month"
  }
};

const monthlySummary: MonthlySummary = {
  month: "2026-05",
  total_income: 5200,
  total_spending: 199.26,
  net_cashflow: 5000.74,
  monthly_budget: 3000,
  budget_used_pct: 6.64,
  categories: [],
  merchants: []
};

const transactions: Transaction[] = [
  { id: "may-income", user_id: "local-user", account_id: "chequing", account_name: "Chequing", account_type: "checking", transaction_date: "2026-05-01", amount: 5200, currency: "CAD", merchant_raw: "Payroll", description_raw: "Payroll", source: "manual", merchant_normalized: "Payroll", category: "Income", is_excluded_from_spending: false },
  { id: "apr-income", user_id: "local-user", account_id: "chequing", account_name: "Chequing", account_type: "checking", transaction_date: "2026-04-01", amount: 5000, currency: "CAD", merchant_raw: "Payroll", description_raw: "Payroll", source: "manual", merchant_normalized: "Payroll", category: "Income", is_excluded_from_spending: false },
  { id: "apr-spend", user_id: "local-user", account_id: "visa", account_name: "Visa", account_type: "credit_card", transaction_date: "2026-04-15", amount: -180, currency: "CAD", merchant_raw: "Grocer", description_raw: "Grocer", source: "manual", merchant_normalized: "Grocer", category: "Groceries", is_excluded_from_spending: false }
];

describe("CashView", () => {
  it("renders short-term cash position and forecast horizons", () => {
    render(<CashView accounts={accounts} forecast={forecast} monthlySummary={monthlySummary} transactions={transactions} />);

    expect(screen.getByRole("heading", { name: "Cash" })).toBeInTheDocument();
    expect(screen.getByText("Available balance")).toBeInTheDocument();
    const cashAssetChip = screen.getByText("Cash is 30.8% of total assets").closest(".cash-asset-chip");
    expect(cashAssetChip).toHaveClass("hero-change", "positive");
    expect(cashAssetChip?.querySelector(".trend-arrow")).toBeInTheDocument();
    expect(screen.getByText("2 cash accounts ready")).toBeInTheDocument();
    expect(screen.getByText("Card obligations")).toBeInTheDocument();
    expect(screen.getAllByText("$4,000.00").length).toBeGreaterThan(0);
    expect(screen.getByText("In-flow")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /In-flow/ })).toHaveAttribute("href", "/recap?period=2026-05");
    expect(screen.getByRole("link", { name: /In-flow/ })).toHaveTextContent("$5,200.00");
    expect(screen.getByRole("link", { name: /In-flow/ })).toHaveTextContent("Up 4.0% vs last month");
    expect(screen.getByText("Out-flow")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Out-flow/ })).toHaveAttribute("href", "/recap?period=2026-05");
    expect(screen.getByRole("link", { name: /Out-flow/ })).toHaveTextContent("$199.26");
    expect(screen.getByRole("link", { name: /Out-flow/ })).toHaveTextContent("Up 10.7% vs last month");
    expect(screen.getByText("Available cash")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Available cash/ })).toHaveAttribute("href", "/accounts");
    expect(screen.getAllByText("Net position").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /Net position/ })).toHaveAttribute("href", "/accounts");
    expect(screen.getAllByText("$3,350.00").length).toBeGreaterThan(0);
    expect(screen.getByText("30 days")).toBeInTheDocument();
    expect(screen.getByText("60 days")).toBeInTheDocument();
    expect(screen.getByText("90 days")).toBeInTheDocument();
    expect(screen.getByText("High risk")).toBeInTheDocument();
    expect(screen.getAllByText("Chequing").length).toBeGreaterThan(0);
    expect(screen.getByText("Visa")).toBeInTheDocument();
    expect(screen.queryByText("RRSP")).not.toBeInTheDocument();
    const distributionPanel = screen.getByText("Cash account distribution").closest("article");
    expect(distributionPanel).not.toBeNull();
    const distribution = within(distributionPanel as HTMLElement);
    expect(distribution.getByText("Cash account distribution")).toBeInTheDocument();
    expect(screen.getAllByText("Chequing").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Savings").length).toBeGreaterThan(0);
    const donutChart = screen.getByLabelText("Chequing 30.0%, Savings 70.0%");
    expect(donutChart.tagName).toBe("svg");
    expect(donutChart.closest("a")).toHaveAttribute("href", "/accounts");
    expect(donutChart.querySelectorAll(".cash-donut-segment")).toHaveLength(2);
    expect(donutChart.querySelector(".cash-donut-segment")).toHaveAttribute("stroke-linecap", "round");
    expect(distribution.getByText("30.0%")).toBeInTheDocument();
    expect(distribution.getByText("70.0%")).toBeInTheDocument();
    expect(distribution.queryByText("$1,200.00")).not.toBeInTheDocument();
    expect(distribution.queryByText("$2,800.00")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Chequing Checking - manual/ })).toHaveAttribute("href", "/accounts");
    expect(screen.getByRole("link", { name: /Visa Credit Card - mock_simplefin/ })).toHaveAttribute("href", "/accounts");
    expect(screen.getByRole("link", { name: "Manage accounts" })).toHaveAttribute("href", "/accounts");
    expect(screen.getByRole("link", { name: "Review transactions" })).toHaveAttribute("href", "/transactions");
  });
});
