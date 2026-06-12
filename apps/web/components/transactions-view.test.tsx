import { fireEvent, render, screen, within } from "@testing-library/react";
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
    expect(within(amexSection).queryByText("May 2026")).not.toBeInTheDocument();
    expect(within(amexSection).getAllByText("Payment").length).toBeGreaterThan(0);
    fireEvent.click(within(amexSection).getByRole("button", { name: "View American Express Cobalt Card history by month" }));
    const historyDialog = screen.getByRole("dialog", { name: "American Express Cobalt Card monthly history" });
    expect(within(historyDialog).getByText("May 2026")).toBeInTheDocument();
    fireEvent.click(within(historyDialog).getByRole("button", { name: "Close monthly history" }));

    const rrspSection = screen.getByRole("region", { name: "Self Directed RRSP transactions" });
    expect(within(rrspSection).getByText("June 2026")).toBeInTheDocument();
    expect(within(rrspSection).getAllByText("Transfer").length).toBeGreaterThan(0);
  });

  it("shows only the latest five current-month transactions per account and opens monthly dialogs", () => {
    const accountTransactions: Transaction[] = Array.from({ length: 6 }, (_, index) => {
      const day = 10 - index;
      return {
        id: `rogers-june-${day}`,
        user_id: "local-user",
        account_id: "rogers",
        account_name: "Rogers Red World Elite 8746",
        account_type: "credit_card",
        transaction_date: `2026-06-${String(day).padStart(2, "0")}`,
        amount: -10 - index,
        currency: "CAD",
        merchant_raw: `June merchant ${day}`,
        description_raw: `June merchant ${day}`,
        source: "statement",
        merchant_normalized: `June merchant ${day}`,
        category: "Dining",
        transaction_type: "expense",
        is_excluded_from_spending: false
      };
    });

    accountTransactions.push({
      id: "rogers-may-transaction",
      user_id: "local-user",
      account_id: "rogers",
      account_name: "Rogers Red World Elite 8746",
      account_type: "credit_card",
      transaction_date: "2026-05-20",
      amount: -42.5,
      currency: "CAD",
      merchant_raw: "May merchant",
      description_raw: "May merchant",
      source: "statement",
      merchant_normalized: "May merchant",
      category: "Groceries",
      transaction_type: "expense",
      is_excluded_from_spending: false
    });

    render(<TransactionsView initialTransactions={accountTransactions} />);

    const rogersSection = screen.getByRole("region", { name: "Rogers Red World Elite 8746 transactions" });
    expect(within(rogersSection).getByText("June merchant 10")).toBeInTheDocument();
    expect(within(rogersSection).getByText("June merchant 6")).toBeInTheDocument();
    expect(within(rogersSection).queryByText("June merchant 5")).not.toBeInTheDocument();
    expect(within(rogersSection).queryByText("May merchant")).not.toBeInTheDocument();

    fireEvent.click(within(rogersSection).getByRole("button", { name: "View all June 2026 transactions for Rogers Red World Elite 8746" }));
    const currentDialog = screen.getByRole("dialog", { name: "Rogers Red World Elite 8746 June 2026 transactions" });
    expect(within(currentDialog).getByText("June merchant 5")).toBeInTheDocument();
    fireEvent.click(within(currentDialog).getByRole("button", { name: "Close transactions dialog" }));

    fireEvent.click(within(rogersSection).getByRole("button", { name: "View Rogers Red World Elite 8746 history by month" }));
    const historyDialog = screen.getByRole("dialog", { name: "Rogers Red World Elite 8746 monthly history" });
    expect(within(historyDialog).getByText("May 2026")).toBeInTheDocument();
    expect(within(historyDialog).getByText("$42.50")).toBeInTheDocument();
  });
});
