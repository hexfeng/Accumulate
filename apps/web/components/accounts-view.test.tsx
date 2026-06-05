import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { AccountsView } from "./accounts-view";
import type { Account, SimpleFinStatus } from "@/lib/types";

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

describe("AccountsView", () => {
  it("renders account totals, source labels, and edit controls only for manual accounts", () => {
    render(<AccountsView initialAccounts={accounts} initialSimpleFinStatus={simpleFinStatus} />);

    expect(screen.getByText("3 accounts")).toBeInTheDocument();
    expect(screen.getByText("$4,350.00")).toBeInTheDocument();
    expect(screen.getByText("$300.00")).toBeInTheDocument();
    expect(screen.getByText("$4,050.00")).toBeInTheDocument();
    expect(screen.getByText("Manual")).toBeInTheDocument();
    expect(screen.getAllByText("Mock SimpleFIN").length).toBeGreaterThan(0);
    expect(screen.getAllByText("CSV source").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Edit Cash Wallet" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit CIBC Chequing" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete CSV Card" })).not.toBeInTheDocument();
  });

  it("calls injected handlers for create, update, and delete actions", async () => {
    const onCreateAccount = vi.fn().mockResolvedValue({
      id: "emergency-fund",
      user_id: "local-user",
      name: "Emergency Fund",
      type: "savings",
      balance: 2500,
      currency: "CAD",
      source: "manual"
    });
    const onUpdateAccount = vi.fn().mockResolvedValue({ ...accounts[0], name: "Wallet Cash", balance: 175 });
    const onDeleteAccount = vi.fn().mockResolvedValue({ deleted_account_id: "cash-wallet" });

    render(
      <AccountsView
        initialAccounts={accounts}
        initialSimpleFinStatus={simpleFinStatus}
        onCreateAccount={onCreateAccount}
        onUpdateAccount={onUpdateAccount}
        onDeleteAccount={onDeleteAccount}
      />
    );

    fireEvent.change(screen.getByLabelText("New account name"), { target: { value: "Emergency Fund" } });
    fireEvent.change(screen.getByLabelText("New account balance"), { target: { value: "2500" } });
    fireEvent.click(screen.getByRole("button", { name: "Add manual account" }));

    await waitFor(() => expect(onCreateAccount).toHaveBeenCalledWith({ name: "Emergency Fund", type: "checking", balance: 2500, currency: "CAD" }));

    fireEvent.click(screen.getByRole("button", { name: "Edit Cash Wallet" }));
    fireEvent.change(screen.getByLabelText("Account name"), { target: { value: "Wallet Cash" } });
    fireEvent.change(screen.getByLabelText("Account balance"), { target: { value: "175" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Cash Wallet" }));

    await waitFor(() => expect(onUpdateAccount).toHaveBeenCalledWith("cash-wallet", { name: "Wallet Cash", type: "cash", balance: 175, currency: "CAD" }));

    fireEvent.click(screen.getByRole("button", { name: "Delete Wallet Cash" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete Wallet Cash" }));

    await waitFor(() => expect(onDeleteAccount).toHaveBeenCalledWith("cash-wallet"));
  });
});
