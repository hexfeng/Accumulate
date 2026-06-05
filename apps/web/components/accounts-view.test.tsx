import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { AccountsView } from "./accounts-view";
import type { Account, SimpleFinStatus, Transaction } from "@/lib/types";

const accounts: Account[] = [
  { id: "cash-wallet", user_id: "local-user", name: "Cash Wallet", type: "cash", balance: 150, currency: "CAD", source: "manual" },
  { id: "cibc-chequing", user_id: "local-user", name: "CIBC Chequing", type: "checking", balance: 4200, currency: "CAD", source: "mock_simplefin" },
  { id: "csv-card", user_id: "local-user", name: "CSV Card", type: "credit_card", balance: -300, currency: "CAD", source: "csv" }
];

const simpleFinStatus: SimpleFinStatus = {
  provider: "mock_simplefin",
  status: "available",
  mode: "mock",
  message: "Mock SimpleFIN is ready."
};

const transactions: Transaction[] = [
  { id: "payroll", user_id: "local-user", account_id: "cibc-chequing", account_name: "CIBC Chequing", account_type: "checking", transaction_date: "2026-05-01", amount: 5200, currency: "CAD", merchant_raw: "PAYROLL ACME CANADA", description_raw: "PAYROLL ACME CANADA", source: "mock_simplefin", merchant_normalized: "Payroll", category: "Income", is_excluded_from_spending: false },
  { id: "transfer", user_id: "local-user", account_id: "cibc-chequing", account_name: "CIBC Chequing", account_type: "checking", transaction_date: "2026-05-18", amount: -900, currency: "CAD", merchant_raw: "TRANSFER TO EQ SAVINGS", description_raw: "TRANSFER TO EQ SAVINGS", source: "mock_simplefin", merchant_normalized: "Transfer to EQ Savings", category: "Transfer", is_excluded_from_spending: false },
  { id: "coffee", user_id: "local-user", account_id: "cash-wallet", account_name: "Cash Wallet", account_type: "cash", transaction_date: "2026-05-19", amount: -4.25, currency: "CAD", merchant_raw: "CAFE", description_raw: "CAFE", source: "manual", merchant_normalized: "Cafe", category: "Dining", is_excluded_from_spending: false }
];

describe("AccountsView", () => {
  it("renders account totals, source labels, and row-open detail entry points", () => {
    render(<AccountsView initialAccounts={accounts} initialSimpleFinStatus={simpleFinStatus} />);

    expect(screen.getByText("3 accounts")).toBeInTheDocument();
    expect(screen.getAllByText("$4,350.00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$300.00").length).toBeGreaterThan(0);
    expect(screen.getByText("$4,050.00")).toBeInTheDocument();
    expect(screen.getByText("Cash accounts")).toBeInTheDocument();
    expect(screen.getByText("Credit cards")).toBeInTheDocument();
    expect(screen.getByText("Manual")).toBeInTheDocument();
    expect(screen.getAllByText("SimpleFIN").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Statement").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Open Cash Wallet account" })).toBeInTheDocument();
    expect(screen.queryByText("Bridge account")).not.toBeInTheDocument();
    expect(screen.queryByText("Manual balance")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete CSV Card" })).not.toBeInTheDocument();
  });

  it("calls injected handlers for create and delete actions", async () => {
    const onCreateAccount = vi.fn().mockResolvedValue({
      id: "emergency-fund",
      user_id: "local-user",
      name: "Emergency Fund",
      type: "savings",
      balance: 2500,
      currency: "CAD",
      source: "manual"
    });
    const onDeleteAccount = vi.fn().mockResolvedValue({ deleted_account_id: "cash-wallet" });

    render(
      <AccountsView
        initialAccounts={accounts}
        initialSimpleFinStatus={simpleFinStatus}
        onCreateAccount={onCreateAccount}
        onDeleteAccount={onDeleteAccount}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Add account / Import" }));
    fireEvent.change(screen.getByLabelText("New account name"), { target: { value: "Emergency Fund" } });
    fireEvent.change(screen.getByLabelText("New account balance"), { target: { value: "2500" } });
    fireEvent.click(screen.getByRole("button", { name: "Add manual account" }));

    await waitFor(() => expect(onCreateAccount).toHaveBeenCalledWith({ name: "Emergency Fund", type: "checking", balance: 2500, currency: "CAD" }));

    fireEvent.click(screen.getByRole("button", { name: "Open Cash Wallet account" }));
    expect(screen.getByText("Balance")).toBeInTheDocument();
    expect(screen.getAllByText("$150.00").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Manual account" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Delete Cash Wallet" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete Cash Wallet" }));

    await waitFor(() => expect(onDeleteAccount).toHaveBeenCalledWith("cash-wallet"));
  });

  it("opens update options for synced accounts from the row dialog", () => {
    render(<AccountsView initialAccounts={accounts} initialSimpleFinStatus={simpleFinStatus} initialTransactions={transactions} />);

    fireEvent.click(screen.getByRole("button", { name: "Open CIBC Chequing account" }));

    expect(screen.getByText("Latest transactions")).toBeInTheDocument();
    expect(screen.getByText("Transfer to EQ Savings")).toBeInTheDocument();
    expect(screen.getByText("Payroll")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Sync now" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Delete CIBC Chequing" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Transactions" })).toHaveAttribute("href", "/transactions?account=cibc-chequing");
  });

  it("closes the account detail dialog when clicking outside the card", () => {
    const { container } = render(<AccountsView initialAccounts={accounts} initialSimpleFinStatus={simpleFinStatus} initialTransactions={transactions} />);

    fireEvent.click(screen.getByRole("button", { name: "Open CIBC Chequing account" }));
    expect(screen.getByRole("dialog", { name: "CIBC Chequing" })).toBeInTheDocument();

    const backdrop = container.querySelector(".account-dialog-backdrop");
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop as Element);

    expect(screen.queryByRole("dialog", { name: "CIBC Chequing" })).not.toBeInTheDocument();
  });

  it("opens statement import mode from the add dialog", () => {
    render(<AccountsView initialAccounts={accounts} initialSimpleFinStatus={simpleFinStatus} />);

    fireEvent.click(screen.getByRole("button", { name: "Add account / Import" }));
    fireEvent.click(screen.getByRole("button", { name: "Import statement" }));

    expect(screen.getByLabelText("Statement file")).toBeInTheDocument();
    expect(screen.getByText("PDF OCR import")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review import" })).toBeDisabled();
  });
});
