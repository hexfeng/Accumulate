import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InvestmentsView } from "./investments-view";
import * as api from "@/lib/api";
import type { Account, Holding, PortfolioSnapshot, WatchlistResponse } from "@/lib/types";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    createHolding: vi.fn(),
    updateHolding: vi.fn(),
    deleteHolding: vi.fn(),
    getQuote: vi.fn(),
    getWatchlist: vi.fn(),
    refreshQuotes: vi.fn(),
    replaceWatchlistSymbols: vi.fn(),
    searchSecurities: vi.fn()
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

const emptyWatchlist: WatchlistResponse = { symbols: [], items: [] };

const watchlist: WatchlistResponse = {
  symbols: ["^GSPC", "^IXIC"],
  items: [
    {
      symbol: "^GSPC",
      name: "S&P 500",
      price: 7431.46,
      currency: "USD",
      change_amount: 37.16,
      change_pct: 0.5,
      provider: "test",
      as_of: "2026-06-12T13:00:00Z"
    },
    {
      symbol: "^IXIC",
      name: "Nasdaq",
      price: null,
      currency: "USD",
      change_amount: null,
      change_pct: null,
      provider: null,
      as_of: null,
      error: "Quote unavailable"
    }
  ]
};

describe("InvestmentsView", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.createHolding).mockImplementation(async (input) => ({
      id: input.symbol.toLowerCase().replaceAll(".", "-"),
      user_id: "local-user",
      account_name: accounts.find((account) => account.id === input.account_id)?.name ?? "TFSA",
      source: "manual",
      ...input,
      market_price: input.market_price ?? 0
    }));
    vi.mocked(api.updateHolding).mockResolvedValue({ ...holdings[0], quantity: 12 });
    vi.mocked(api.deleteHolding).mockResolvedValue({ deleted_holding_id: "vfv" });
    vi.mocked(api.getWatchlist).mockResolvedValue(watchlist);
    vi.mocked(api.replaceWatchlistSymbols).mockResolvedValue(watchlist);
    vi.mocked(api.getQuote).mockResolvedValue({
      symbol: "MU",
      name: "Micron Technology, Inc.",
      price: 136.4,
      currency: "USD",
      provider: "test",
      as_of: "2026-06-12T13:00:00Z"
    });
    vi.mocked(api.searchSecurities).mockResolvedValue([
      {
        symbol: "MU",
        name: "Micron Technology, Inc.",
        quote_type: "EQUITY",
        exchange: "NASDAQ",
        currency: "USD",
        price: 136.4,
        provider: "test",
        as_of: "2026-06-12T13:00:00Z"
      },
      {
        symbol: "MUU.TO",
        name: "Mackenzie US Equity Index ETF CAD Hedged",
        quote_type: "ETF",
        exchange: "Toronto",
        currency: "CAD",
        price: 42.5,
        provider: "test",
        as_of: "2026-06-12T13:00:00Z"
      }
    ]);
    vi.mocked(api.refreshQuotes).mockResolvedValue({
      refreshed_count: 1,
      skipped_count: 0,
      holdings,
      quotes: [{
        symbol: "VFV.TO",
        name: "Vanguard S&P 500 ETF",
        price: 125,
        currency: "CAD",
        provider: "test",
        as_of: "2026-06-12T13:00:00Z"
      }],
      message: "Refreshed 1 symbols; skipped 0 fresh cached symbols."
    });
  });

  it("renders portfolio value, allocation, account grouping, and holding management actions", async () => {
    render(<InvestmentsView accounts={accounts} initialHoldings={holdings} initialPortfolio={portfolio} initialWatchlist={emptyWatchlist} />);

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

  it("searches and selects securities while adding a holding", async () => {
    render(<InvestmentsView accounts={accounts} initialHoldings={[]} initialPortfolio={{ total_value: 0, total_cost: 0, unrealized_gain: 0, unrealized_gain_pct: 0, allocation: [], accounts: [] }} initialWatchlist={emptyWatchlist} />);

    fireEvent.click(screen.getByRole("button", { name: "Add holding" }));
    const dialog = screen.getByRole("dialog", { name: "Add holding" });
    fireEvent.change(within(dialog).getByLabelText("Symbol"), { target: { value: "m" } });

    await waitFor(() => expect(api.searchSecurities).toHaveBeenCalledWith("M"));
    const micronOption = await within(dialog).findByRole("option", { name: "MU Micron Technology, Inc. EQUITY NASDAQ $136.40" });
    expect(within(dialog).getByText("Results")).toBeInTheDocument();
    expect(micronOption).toHaveClass("security-search-result-row");
    expect(micronOption.querySelector(".security-search-avatar")).toHaveTextContent("MU");
    expect(micronOption.querySelector(".security-search-symbol")).toHaveTextContent("MU");
    expect(within(micronOption).getByText("Micron Technology, Inc.")).toHaveClass("security-search-name");
    expect(within(micronOption).getByText("Nasdaq")).toHaveClass("security-search-exchange");
    const hedgedOption = await within(dialog).findByRole("option", { name: "MUU.TO Mackenzie US Equity Index ETF CAD Hedged ETF Toronto $42.50" });
    expect(hedgedOption.querySelector(".security-search-avatar")).toHaveTextContent("MUU");
    fireEvent.click(micronOption);
    expect(within(dialog).getByLabelText("Symbol")).toHaveValue("MU");
    expect(within(dialog).getByLabelText("Name")).toHaveValue("Micron Technology, Inc.");
    expect(within(dialog).queryByRole("button", { name: "Refresh price" })).not.toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText("Quantity"), { target: { value: "3" } });
    fireEvent.change(within(dialog).getByLabelText("Average cost"), { target: { value: "120" } });
    expect(within(dialog).getByText("$409.20")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Save holding" }));

    await waitFor(() => expect(api.createHolding).toHaveBeenCalledWith({
      account_id: "tfsa",
      symbol: "MU",
      name: "Micron Technology, Inc.",
      quantity: 3,
      average_cost: 120,
      market_price: 136.4,
      currency: "USD"
    }));
  });

  it("uses the server-calculated quote when saving without refreshing first", async () => {
    vi.mocked(api.createHolding).mockResolvedValue({
      id: "cash-to",
      user_id: "local-user",
      account_id: "tfsa",
      account_name: "TFSA",
      symbol: "CASH.TO",
      name: "Global X High Interest Savings ETF",
      quantity: 5,
      average_cost: 50,
      market_price: 50.2,
      currency: "CAD",
      source: "manual"
    });
    render(<InvestmentsView accounts={accounts} initialHoldings={[]} initialPortfolio={{ total_value: 0, total_cost: 0, unrealized_gain: 0, unrealized_gain_pct: 0, allocation: [], accounts: [] }} initialWatchlist={emptyWatchlist} />);

    fireEvent.click(screen.getByRole("button", { name: "Add holding" }));
    const dialog = screen.getByRole("dialog", { name: "Add holding" });
    fireEvent.change(within(dialog).getByLabelText("Symbol"), { target: { value: "cash.to" } });
    fireEvent.change(within(dialog).getByLabelText("Quantity"), { target: { value: "5" } });
    fireEvent.change(within(dialog).getByLabelText("Average cost"), { target: { value: "50" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save holding" }));

    await waitFor(() => expect(api.createHolding).toHaveBeenCalledWith(expect.objectContaining({
      symbol: "CASH.TO",
      quantity: 5,
      market_price: undefined
    })));
    await waitFor(() => expect(screen.getAllByText("$251.00").length).toBeGreaterThan(0));
    expect(screen.getByText("Global X High Interest Savings ETF")).toBeInTheDocument();
  });

  it("fetches a quote after selecting a search result without an embedded price", async () => {
    vi.mocked(api.searchSecurities).mockResolvedValue([
      {
        symbol: "MU",
        name: "Micron Technology, Inc.",
        quote_type: "EQUITY",
        exchange: "NASDAQ",
        currency: "USD",
        price: null,
        provider: "test",
        as_of: null
      }
    ]);

    render(<InvestmentsView accounts={accounts} initialHoldings={[]} initialPortfolio={{ total_value: 0, total_cost: 0, unrealized_gain: 0, unrealized_gain_pct: 0, allocation: [], accounts: [] }} initialWatchlist={emptyWatchlist} />);

    fireEvent.click(screen.getByRole("button", { name: "Add holding" }));
    const dialog = screen.getByRole("dialog", { name: "Add holding" });
    fireEvent.change(within(dialog).getByLabelText("Symbol"), { target: { value: "mu" } });

    fireEvent.click(await within(dialog).findByRole("option", { name: "MU Micron Technology, Inc. EQUITY NASDAQ" }));

    await waitFor(() => expect(api.getQuote).toHaveBeenCalledWith("MU"));
    await waitFor(() => expect(within(dialog).getByLabelText("Market price")).toHaveValue(136.4));
    fireEvent.change(within(dialog).getByLabelText("Quantity"), { target: { value: "3" } });
    expect(within(dialog).getByText("$409.20")).toBeInTheDocument();
  });

  it("refreshes holding prices on load, on demand, and every fifteen minutes", async () => {
    vi.useFakeTimers();
    vi.mocked(api.refreshQuotes).mockResolvedValue({
      refreshed_count: 1,
      skipped_count: 0,
      holdings: [{ ...holdings[0], market_price: 130 }],
      quotes: [{
        symbol: "VFV.TO",
        name: "Vanguard S&P 500 ETF",
        price: 130,
        currency: "CAD",
        provider: "test",
        as_of: "2026-06-12T13:15:00Z"
      }],
      message: "Refreshed 1 symbols; skipped 0 fresh cached symbols."
    });

    render(<InvestmentsView accounts={accounts} initialHoldings={holdings} initialPortfolio={portfolio} initialWatchlist={emptyWatchlist} />);

    expect(api.refreshQuotes).toHaveBeenCalledWith(false);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText("Prices refreshed 2026-06-12")).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Refresh prices" }));
      await Promise.resolve();
    });
    expect(api.refreshQuotes).toHaveBeenCalledWith(true);
    await act(async () => {
      vi.advanceTimersByTime(15 * 60 * 1000);
      await Promise.resolve();
    });
    expect(api.refreshQuotes).toHaveBeenCalledTimes(3);
  });

  it("includes synced SimpleFIN investment account balances when holdings are empty", () => {
    vi.mocked(api.refreshQuotes).mockResolvedValue({
      refreshed_count: 0,
      skipped_count: 0,
      holdings: [],
      quotes: [],
      message: "Refreshed 0 symbols; skipped 0 fresh cached symbols."
    });

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
        initialWatchlist={emptyWatchlist}
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

  it("renders watchlist cards below the investment summary", async () => {
    render(<InvestmentsView accounts={accounts} initialHoldings={holdings} initialPortfolio={portfolio} initialWatchlist={watchlist} />);

    expect(screen.getByText("Watchlist")).toBeInTheDocument();
    expect(screen.getByText("S&P 500")).toBeInTheDocument();
    expect(screen.getByText("7,431.46")).toBeInTheDocument();
    expect(screen.getByText((_content, element) => element?.textContent === "+37.16 +0.50%")).toBeInTheDocument();
    expect(screen.getByText("Nasdaq")).toBeInTheDocument();
    expect(screen.getByText("Quote unavailable")).toBeInTheDocument();
  });

  it("adds and removes watchlist symbols", async () => {
    const withVfv: WatchlistResponse = {
      symbols: ["^GSPC", "VFV.TO"],
      items: [
        watchlist.items[0],
        {
          symbol: "VFV.TO",
          name: "Vanguard S&P 500 ETF",
          price: 150,
          currency: "CAD",
          change_amount: null,
          change_pct: null,
          provider: "test",
          as_of: "2026-06-12T13:00:00Z"
        }
      ]
    };
    vi.mocked(api.replaceWatchlistSymbols)
      .mockResolvedValueOnce(withVfv)
      .mockResolvedValueOnce({
        symbols: ["^GSPC"],
        items: [watchlist.items[0]]
      });

    render(<InvestmentsView accounts={accounts} initialHoldings={holdings} initialPortfolio={portfolio} initialWatchlist={watchlist} />);

    fireEvent.change(screen.getByLabelText("Add watchlist symbol"), { target: { value: "vfv.to" } });
    fireEvent.click(screen.getByRole("button", { name: "Add symbol" }));

    await waitFor(() => expect(api.replaceWatchlistSymbols).toHaveBeenCalledWith(["^GSPC", "^IXIC", "VFV.TO"]));
    await waitFor(() => expect(screen.getAllByText("Vanguard S&P 500 ETF").length).toBeGreaterThan(1));

    fireEvent.click(screen.getByRole("button", { name: "Remove VFV.TO" }));
    await waitFor(() => expect(api.replaceWatchlistSymbols).toHaveBeenLastCalledWith(["^GSPC"]));
  });
});
