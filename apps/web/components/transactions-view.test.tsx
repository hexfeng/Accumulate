import { render, screen, within } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import { TransactionsView } from "./transactions-view";
import type { Transaction } from "@/lib/types";

const transactions: Transaction[] = [
  {
    id: "june-payment",
    user_id: "local-user",
    account_id: "amex",
    account_name: "American Express Cobalt Card",
    account_type: "credit_card",
    transaction_date: "2026-06-08",
    amount: 300,
    currency: "CAD",
    merchant_raw: "PAYMENT RECEIVED - THANK YOU",
    description_raw: "PAYMENT RECEIVED - THANK YOU",
    source: "simplefin",
    merchant_normalized: "Credit card payment",
    category: "Payment",
    transaction_type: "payment",
    is_excluded_from_spending: true
  },
  {
    id: "june-transfer",
    user_id: "local-user",
    account_id: "rrsp",
    account_name: "Self Directed RRSP",
    account_type: "investment",
    transaction_date: "2026-06-05",
    amount: 2000,
    currency: "CAD",
    merchant_raw: "Deposit",
    description_raw: "Deposit",
    source: "simplefin",
    merchant_normalized: "Internal transfer",
    category: "Transfer",
    transaction_type: "transfer",
    is_excluded_from_spending: true
  },
  {
    id: "may-grocery",
    user_id: "local-user",
    account_id: "amex",
    account_name: "American Express Cobalt Card",
    account_type: "credit_card",
    transaction_date: "2026-05-04",
    amount: -25,
    currency: "CAD",
    merchant_raw: "GROCERY",
    description_raw: "GROCERY",
    source: "simplefin",
    merchant_normalized: "Grocery",
    category: "Groceries",
    transaction_type: "expense",
    is_excluded_from_spending: false
  }
];

describe("TransactionsView", () => {
  it("groups transactions by account and month with clear category labels", () => {
    render(<TransactionsView initialTransactions={transactions} />);

    expect(screen.getByRole("heading", { name: "American Express Cobalt Card" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Self Directed RRSP" })).toBeInTheDocument();

    const amexSection = screen.getByRole("region", { name: "American Express Cobalt Card transactions" });
    expect(within(amexSection).getByText("June 2026")).toBeInTheDocument();
    expect(within(amexSection).getByText("May 2026")).toBeInTheDocument();
    expect(within(amexSection).getAllByText("Payment").length).toBeGreaterThan(0);
    expect(within(amexSection).getAllByText("Groceries").length).toBeGreaterThan(0);

    const rrspSection = screen.getByRole("region", { name: "Self Directed RRSP transactions" });
    expect(within(rrspSection).getByText("June 2026")).toBeInTheDocument();
    expect(within(rrspSection).getAllByText("Transfer").length).toBeGreaterThan(0);
  });
});
