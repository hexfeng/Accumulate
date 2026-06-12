import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { AccountsView } from "./accounts-view";
import type { Account, SimpleFinStatus, StatementImportResponse, Transaction } from "@/lib/types";

const accounts: Account[] = [
  { id: "cash-wallet", user_id: "local-user", name: "Cash Wallet", type: "cash", balance: 150, currency: "CAD", source: "manual" },
  { id: "cibc-chequing", user_id: "local-user", name: "CIBC Chequing", type: "checking", balance: 4200, currency: "CAD", source: "mock_simplefin" },
  { id: "csv-card", user_id: "local-user", name: "CSV Card", type: "credit_card", balance: -300, currency: "CAD", source: "csv" }
];

const rogersStatementAccount: Account = {
  id: "rogers-red-world-elite-8746",
  user_id: "local-user",
  name: "Rogers Red World Elite 8746",
  type: "credit_card",
  balance: -311.14,
  currency: "CAD",
  source: "statement"
};

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

  it("uses the synced institution name for account logos when the account name is generic", () => {
    const { container } = render(
      <AccountsView
        initialAccounts={[
          {
            id: "simplefin-connection-checking",
            user_id: "local-user",
            name: "Chequing (6151)",
            type: "checking",
            balance: 3050.63,
            currency: "CAD",
            institution_name: "CIBC",
            source: "simplefin"
          }
        ]}
        initialSimpleFinStatus={{ ...simpleFinStatus, provider: "simplefin", mode: "real", status: "synced" }}
      />
    );

    expect(screen.getByRole("button", { name: "Open Chequing (6151) account" })).toBeInTheDocument();
    expect(container.querySelector('img[src="/institutions/logos/cibc.jpg"]')).toBeInTheDocument();
  });

  it("uses Wealthsimple logo and Visa Infinite card art for synced Wealthsimple accounts", () => {
    const { container } = render(
      <AccountsView
        initialAccounts={[
          {
            id: "simplefin-connection-act-cash",
            user_id: "local-user",
            name: "Wealthsimple Cash",
            type: "cash",
            balance: 767.79,
            currency: "CAD",
            institution_name: "Wealthsimple",
            source: "simplefin"
          },
          {
            id: "simplefin-connection-act-card",
            user_id: "local-user",
            name: "Wealthsimple Visa Infinite",
            type: "credit_card",
            balance: 0,
            currency: "CAD",
            institution_name: "Wealthsimple",
            source: "simplefin"
          }
        ]}
        initialSimpleFinStatus={{ ...simpleFinStatus, provider: "simplefin", mode: "real", status: "synced" }}
      />
    );

    expect(screen.getByRole("button", { name: "Open Wealthsimple Cash account" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Wealthsimple Visa Infinite account" })).toBeInTheDocument();
    expect(container.querySelector('img[src="/institutions/logos/wealthsimple.jpg"]')).toBeInTheDocument();
    expect(container.querySelector('img[src="/institutions/cards/wealthsimple-visa-infinite.svg"]')).toBeInTheDocument();
  });

  it("maps American Express Cobalt and Green cards to their specific card art", () => {
    const { container } = render(
      <AccountsView
        initialAccounts={[
        {
          id: "amex-cobalt",
          user_id: "local-user",
          name: "American Express Cobalt Card (1003)",
          type: "credit_card",
          balance: -36.69,
          currency: "CAD",
          institution_name: "American Express (Canada)",
          source: "simplefin"
        },
        {
          id: "amex-green",
          user_id: "local-user",
          name: "American Express Green Card (1005)",
          type: "credit_card",
          balance: 0,
          currency: "CAD",
          institution_name: "American Express (Canada)",
          source: "simplefin"
        }
        ]}
        initialSimpleFinStatus={{ ...simpleFinStatus, provider: "simplefin", mode: "real", status: "synced" }}
      />
    );

    expect(container.querySelector('img[src="/institutions/cards/amex-cobalt.png"]')).toBeInTheDocument();
    expect(container.querySelector('img[src="/institutions/cards/amex-green-card.svg"]')).toBeInTheDocument();
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

  it("refreshes account transactions after a successful SimpleFIN sync", async () => {
    const onSyncSimpleFin = vi.fn().mockResolvedValue({
      provider: "simplefin",
      status: "synced",
      mode: "real",
      message: "SimpleFIN sync complete.",
      has_credentials: true,
      retry_count: 0
    });
    const onRefreshAccounts = vi.fn().mockResolvedValue(accounts);
    const onRefreshTransactions = vi.fn().mockResolvedValue(transactions);

    render(
      <AccountsView
        initialAccounts={accounts}
        initialSimpleFinStatus={simpleFinStatus}
        initialTransactions={[]}
        onSyncSimpleFin={onSyncSimpleFin}
        onRefreshAccounts={onRefreshAccounts}
        onRefreshTransactions={onRefreshTransactions}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Open CIBC Chequing account" }));
    expect(screen.getByText("No transactions found for this account yet.")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Sync now" }).at(-1)!);

    await waitFor(() => expect(onRefreshTransactions).toHaveBeenCalled());
    expect(onRefreshAccounts).toHaveBeenCalled();
    expect(screen.getByText("Transfer to EQ Savings")).toBeInTheDocument();
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

  it("imports a selected statement file from the add dialog", async () => {
    const originalConsoleError = console.error;
    const consoleError = vi.spyOn(console, "error").mockImplementation((message, ...args) => {
      if (typeof message === "string" && message.includes("A component is changing a controlled input to be uncontrolled")) {
        return;
      }
      originalConsoleError(message, ...args);
    });
    const importResponse: StatementImportResponse = {
      account: {
        id: "rogers-red-world-elite-8746",
        user_id: "local-user",
        name: "Rogers Red World Elite 8746",
        type: "credit_card",
        balance: -311.14,
        currency: "CAD",
        source: "statement"
      },
      created_transactions: 3,
      preview_rows: [
        {
          account_name: "Rogers Red World Elite 8746",
          account_type: "credit_card",
          transaction_date: "2026-04-21",
          description: "FARAH FOODS WATERLOO ON",
          amount: -12.41,
          currency: "CAD"
        }
      ],
      message: "Imported 3 transactions from Rogers Red World Elite 8746."
    };
    const onImportStatement = vi.fn().mockResolvedValue(importResponse);
    const onRefreshTransactions = vi.fn().mockResolvedValue([]);

    render(
      <AccountsView
        initialAccounts={accounts}
        initialSimpleFinStatus={simpleFinStatus}
        onImportStatement={onImportStatement}
        onRefreshTransactions={onRefreshTransactions}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Add account / Import" }));
    fireEvent.click(screen.getByRole("button", { name: "Import statement" }));
    const file = new File(["statement"], "Rogers Red World Elite_8746_05_2026.pdf", { type: "application/pdf" });

    const input = screen.getByLabelText("Statement files");
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    fireEvent.change(input);
    fireEvent.click(screen.getByRole("button", { name: "Import selected statement files" }));

    await waitFor(() => expect(onImportStatement).toHaveBeenCalledWith(file));
    expect(screen.getByRole("button", { name: "Open Rogers Red World Elite 8746 account" })).toBeInTheDocument();
    expect(screen.getAllByText("Imported 3 transactions from Rogers Red World Elite 8746.").length).toBeGreaterThan(0);
    consoleError.mockRestore();
  });

  it("imports multiple historical statement files from the add dialog", async () => {
    const importResponse = (month: string): StatementImportResponse => ({
      account: {
        id: "rogers-red-world-elite-8746",
        user_id: "local-user",
        name: "Rogers Red World Elite 8746",
        type: "credit_card",
        balance: -311.14,
        currency: "CAD",
        source: "statement"
      },
      created_transactions: 2,
      preview_rows: [
        {
          account_name: "Rogers Red World Elite 8746",
          account_type: "credit_card",
          transaction_date: `2026-${month}-20`,
          description: `${month} statement row`,
          amount: -42,
          currency: "CAD"
        }
      ],
      message: `Imported 2 transactions from Rogers Red World Elite 8746.`
    });
    const onImportStatement = vi
      .fn()
      .mockResolvedValueOnce(importResponse("04"))
      .mockResolvedValueOnce(importResponse("05"));

    render(
      <AccountsView
        initialAccounts={accounts}
        initialSimpleFinStatus={simpleFinStatus}
        onImportStatement={onImportStatement}
        onRefreshTransactions={vi.fn().mockResolvedValue([])}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Add account / Import" }));
    fireEvent.click(screen.getByRole("button", { name: "Import statement" }));
    const april = new File(["statement"], "Rogers Red World Elite_8746_04_2026.pdf", { type: "application/pdf" });
    const may = new File(["statement"], "Rogers Red World Elite_8746_05_2026.pdf", { type: "application/pdf" });

    const input = screen.getByLabelText("Statement files");
    Object.defineProperty(input, "files", { value: [april, may], configurable: true });
    fireEvent.change(input);
    fireEvent.click(screen.getByRole("button", { name: "Import selected statement files" }));

    await waitFor(() => expect(onImportStatement).toHaveBeenCalledTimes(2));
    expect(onImportStatement).toHaveBeenNthCalledWith(1, april);
    expect(onImportStatement).toHaveBeenNthCalledWith(2, may);
    expect(screen.getByText("Imported 2 statement files and 4 new transactions.")).toBeInTheDocument();
  });

  it("updates transactions from an existing statement account detail dialog", async () => {
    const importResponse: StatementImportResponse = {
      account: rogersStatementAccount,
      created_transactions: 1,
      preview_rows: [
        {
          account_name: "Rogers Red World Elite 8746",
          account_type: "credit_card",
          transaction_date: "2026-06-20",
          description: "New cycle purchase",
          amount: -25,
          currency: "CAD"
        }
      ],
      message: "Imported 1 transactions from Rogers Red World Elite 8746."
    };
    const updatedTransactions: Transaction[] = [
      {
        id: "rogers-june",
        user_id: "local-user",
        account_id: "rogers-red-world-elite-8746",
        account_name: "Rogers Red World Elite 8746",
        account_type: "credit_card",
        transaction_date: "2026-06-20",
        amount: -25,
        currency: "CAD",
        merchant_raw: "New cycle purchase",
        description_raw: "New cycle purchase",
        source: "statement",
        merchant_normalized: "New Cycle Purchase",
        category: "Uncategorized",
        is_excluded_from_spending: false
      }
    ];
    const onImportStatement = vi.fn().mockResolvedValue(importResponse);
    const onRefreshTransactions = vi.fn().mockResolvedValue(updatedTransactions);

    render(
      <AccountsView
        initialAccounts={[...accounts, rogersStatementAccount]}
        initialSimpleFinStatus={simpleFinStatus}
        onImportStatement={onImportStatement}
        onRefreshTransactions={onRefreshTransactions}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Open Rogers Red World Elite 8746 account" }));
    const dialog = screen.getByRole("dialog", { name: "Rogers Red World Elite 8746" });
    expect(screen.getByRole("heading", { name: "Update transactions" })).toBeInTheDocument();

    const file = new File(["statement"], "Rogers Red World Elite_8746_06_2026.pdf", { type: "application/pdf" });
    const input = screen.getByLabelText("Statement update files");
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    fireEvent.change(input);
    fireEvent.click(screen.getByRole("button", { name: "Update transactions" }));

    await waitFor(() => expect(onImportStatement).toHaveBeenCalledWith(file));
    expect(onRefreshTransactions).toHaveBeenCalled();
    expect(screen.getByText("Imported 1 transactions from Rogers Red World Elite 8746.")).toBeInTheDocument();
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText("New Cycle Purchase")).toBeInTheDocument();
  });

  it("accepts a SimpleFIN setup token and surfaces retry state", async () => {
    const onConnectSimpleFin = vi.fn().mockResolvedValue({
      provider: "simplefin",
      status: "connected",
      mode: "real",
      message: "SimpleFIN connection saved locally.",
      has_credentials: true,
      retry_count: 0
    });

    render(
      <AccountsView
        initialAccounts={accounts}
        initialSimpleFinStatus={{
          provider: "simplefin",
          status: "error",
          mode: "real",
          message: "SimpleFIN needs attention.",
          has_credentials: false,
          last_error: "SimpleFIN accounts sync failed with 403.",
          retry_count: 2,
          next_retry_at: "2026-06-11T12:04:00+00:00"
        }}
        onConnectSimpleFin={onConnectSimpleFin}
      />
    );

    expect(screen.getByText("Needs attention")).toBeInTheDocument();
    expect(screen.getByText("SimpleFIN accounts sync failed with 403.")).toBeInTheDocument();
    expect(screen.getByText("Retry 2")).toBeInTheDocument();
    expect(screen.getByText("2026-06-11 12:04")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("SimpleFIN setup token"), { target: { value: "setup-token" } });
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));

    await waitFor(() => expect(onConnectSimpleFin).toHaveBeenCalledWith("setup-token"));
    await waitFor(() => expect(screen.getAllByText("SimpleFIN connection saved locally.").length).toBeGreaterThan(0));
  });
});
