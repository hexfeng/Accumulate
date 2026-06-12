import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { InvestmentsView } from "./investments-view";
import * as api from "@/lib/api";
import type { Account, Holding, PortfolioSnapshot } from "@/lib/types";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    createHolding: vi.fn(),
    updateHolding: vi.fn(),
    deleteHolding: vi.fn()
  };
});

const accounts: Account[] = [
  { id: "tfsa", user_id: "local-user", name: "TFSA", type: "investment", balance: 0, currency: "CAD", source: "manual" }
];

const holdings: Holding[] = [
  { id: "vfv", user_id: "local-user", account_id: "tfsa", account_name: "TFSA", symbol: "VFV.TO", name: "Vanguard S&P 500 ETF", quantity: 10, average_cost: 110, market_price: 125, currency: "CAD", source: "manual" }
];

const portfolio: PortfolioSnapshot = {
  total_value: 1250,
  total_cost: 1100,
  unrealized_gain: 150,
  unrealized_gain_pct: 13.64,
  allocation: [{ label: "VFV.TO", value: 1250, percent: 100 }],
  accounts: [{ account_id: "tfsa", account_name: "TFSA", value: 1250, holdings_count: 1 }]
};

describe("InvestmentsView", () => {
  beforeEach(() => {
    vi.mocked(api.createHolding).mockResolvedValue({ ...holdings[0], id: "cash-to" });
    vi.mocked(api.updateHolding).mockResolvedValue({ ...holdings[0], quantity: 12 });
    vi.mocked(api.deleteHolding).mockResolvedValue({ deleted_holding_id: "vfv" });
  });

  it("renders portfolio value, allocation, account grouping, and holding management actions", async () => {
    render(<InvestmentsView accounts={accounts} initialHoldings={holdings} initialPortfolio={portfolio} />);

    expect(screen.getByRole("heading", { name: "Investments" })).toBeInTheDocument();
    expect(screen.getAllByText("$1,250.00").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("$150.00")).toBeInTheDocument();
    expect(screen.getByText("13.6%")).toBeInTheDocument();
    expect(screen.getByText("Allocation")).toBeInTheDocument();
    expect(screen.getAllByText("TFSA").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("VFV.TO").length).toBeGreaterThanOrEqual(1);

    fireEvent.click(screen.getByRole("button", { name: "Add holding" }));
    const dialog = screen.getByRole("dialog", { name: "Add holding" });
    fireEvent.change(within(dialog).getByLabelText("Symbol"), { target: { value: "CASH.TO" } });
    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "Global X High Interest Savings ETF" } });
    fireEvent.change(within(dialog).getByLabelText("Quantity"), { target: { value: "5" } });
    fireEvent.change(within(dialog).getByLabelText("Average cost"), { target: { value: "50" } });
    fireEvent.change(within(dialog).getByLabelText("Market price"), { target: { value: "50.2" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save holding" }));

    await waitFor(() => expect(api.createHolding).toHaveBeenCalledWith({
      account_id: "tfsa",
      symbol: "CASH.TO",
      name: "Global X High Interest Savings ETF",
      quantity: 5,
      average_cost: 50,
      market_price: 50.2,
      currency: "CAD"
    }));

    fireEvent.click(screen.getByRole("button", { name: "Edit VFV.TO" }));
    const editDialog = screen.getByRole("dialog", { name: "Edit VFV.TO" });
    fireEvent.change(within(editDialog).getByLabelText("Quantity"), { target: { value: "12" } });
    fireEvent.click(within(editDialog).getByRole("button", { name: "Save holding" }));
    await waitFor(() => expect(api.updateHolding).toHaveBeenCalledWith("vfv", expect.objectContaining({ quantity: 12 })));

    fireEvent.click(screen.getByRole("button", { name: "Delete VFV.TO" }));
    await waitFor(() => expect(api.deleteHolding).toHaveBeenCalledWith("vfv"));
  });

  it("includes synced SimpleFIN investment account balances when holdings are empty", () => {
    render(
      <InvestmentsView
        accounts={[
          {
            id: "simplefin-ws-tfsa",
            user_id: "local-user",
            name: "Self Directed TFSA",
            type: "investment",
            balance: 10776.13,
            currency: "CAD",
            institution_name: "Wealthsimple",
            source: "simplefin"
          },
          {
            id: "simplefin-ws-rrsp",
            user_id: "local-user",
            name: "Self Directed RRSP",
            type: "investment",
            balance: 2151.86,
            currency: "CAD",
            institution_name: "Wealthsimple",
            source: "simplefin"
          }
        ]}
        initialHoldings={[]}
        initialPortfolio={{ total_value: 0, total_cost: 0, unrealized_gain: 0, unrealized_gain_pct: 0, allocation: [], accounts: [] }}
      />
    );

    expect(screen.getAllByText("$12,927.99").length).toBeGreaterThan(0);
    expect(screen.getAllByText("SimpleFIN balances").length).toBeGreaterThan(0);
    expect(screen.getByText("SimpleFIN investment accounts are balance-only right now. Add manual holdings to see symbols, quantities, and prices here.")).toBeInTheDocument();
    expect(screen.getAllByText("Self Directed TFSA").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Self Directed RRSP").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$10,776.13").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$2,151.86").length).toBeGreaterThan(0);
  });
});
