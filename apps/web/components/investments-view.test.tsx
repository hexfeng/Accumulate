import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import InvestmentsPage from "@/app/investments/page";
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
    getAccounts: vi.fn(),
    getHoldings: vi.fn(),
    getPortfolio: vi.fn(),
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
  symbols: ["^GSPC", "^IXIC", "MU"],
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
    },
    {
      symbol: "MU",
      name: "Micron Technology, Inc.",
      price: 1087.99,
      currency: "USD",
      change_amount: 98.39,
      change_pct: 9.94,
      provider: "test",
      as_of: "2026-06-12T13:00:00Z"
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
    vi.mocked(api.getAccounts).mockResolvedValue(accounts);
    vi.mocked(api.getHoldings).mockResolvedValue(holdings);
    vi.mocked(api.getPortfolio).mockResolvedValue(portfolio);
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

  it("does not block the investments server page on watchlist quotes", async () => {
    await InvestmentsPage();

    expect(api.getAccounts).toHaveBeenCalledTimes(1);
    expect(api.getHoldings).toHaveBeenCalledTimes(1);
    expect(api.getPortfolio).toHaveBeenCalledTimes(1);
    expect(api.getWatchlist).not.toHaveBeenCalled();
  });

  it("renders portfolio value, allocation, account grouping, and holding management actions", async () => {
    render(<InvestmentsView accounts={accounts} initialHoldings={holdings} initialPortfolio={portfolio} initialWatchlist={emptyWatchlist} />);

    expect(screen.getByRole("heading", { name: "Investments" })).toBeInTheDocument();
    expect(screen.getByText("Track holdings, cost basis, live market prices, allocation, and account grouping in one workspace.")).toBeInTheDocument();
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
    expect(screen.getByText("(+37.16)")).toHaveClass("watchlist-change-amount");
    expect(screen.getByText("+0.50%")).toHaveClass("watchlist-change-pct");
    expect(screen.getByRole("button", { name: "Remove ^GSPC" })).toBeEmptyDOMElement();
    const firstCard = screen.getByRole("group", { name: "^GSPC watchlist card" });
    expect(firstCard.querySelector(".watchlist-market-row > .watchlist-direction-icon")).toHaveAttribute("aria-label", "Up");
    expect(firstCard.querySelector(".watchlist-change-row .watchlist-direction-icon")).not.toBeInTheDocument();
    expect(screen.queryByText("test · Jun 12, 2026, 9:00 AM")).not.toBeInTheDocument();
    expect(screen.getByText("Nasdaq")).toBeInTheDocument();
    expect(screen.getByText("Micron")).toBeInTheDocument();
    expect(screen.queryByText("Micron Technology, Inc.")).not.toBeInTheDocument();
    expect(screen.getByText("Quote unavailable")).toBeInTheDocument();
  });

  it("loads the watchlist on the client after the investments shell renders", async () => {
    render(<InvestmentsView accounts={accounts} initialHoldings={holdings} initialPortfolio={portfolio} initialWatchlist={emptyWatchlist} />);

    expect(screen.getByRole("heading", { name: "Investments" })).toBeInTheDocument();
    expect(api.getWatchlist).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("S&P 500")).toBeInTheDocument();
    expect(screen.getByText("7,431.46")).toBeInTheDocument();
  });

  it("draws watchlist sparklines from quote history with a stable fallback", () => {
    render(
      <InvestmentsView
        accounts={accounts}
        initialHoldings={holdings}
        initialPortfolio={portfolio}
        initialWatchlist={{
          symbols: ["^GSPC", "VFV.TO"],
          items: [
            {
              ...watchlist.items[0],
              change_amount: 16.46,
              sparkline: [7410, 7420, 7416, 7431.46]
            },
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
        }}
      />
    );

    const cards = screen.getAllByRole("group", { name: /watchlist card/i });
    expect(cards).toHaveLength(2);
    expect(cards[0].querySelector("polyline")).toHaveAttribute("points", "0,38 46.67,22.16 93.33,28.49 140,4");
    expect(cards[0].querySelector(".watchlist-previous-close-line")).toHaveAttribute("y1", "30.08");
    expect(cards[0].querySelector(".watchlist-previous-close-line")).toHaveAttribute("y2", "30.08");
    expect(cards[0].querySelector(".watchlist-previous-close-line")).toHaveAttribute("stroke-dasharray", "3 4");
    expect(cards[1].querySelector("polyline")).toHaveAttribute("points", "0,21 46.67,21 93.33,21 140,21");
    expect(cards[1].querySelector(".watchlist-previous-close-line")).not.toBeInTheDocument();
    expect(within(cards[0]).getByLabelText("Up")).toHaveClass("watchlist-direction-icon");
    expect(within(cards[1]).queryByLabelText("Flat")).not.toBeInTheDocument();
  });

  it("adds and removes watchlist symbols", async () => {
    const withVfv: WatchlistResponse = {
      symbols: ["^GSPC", "^IXIC", "MU", "VFV.TO"],
      items: [
        ...watchlist.items,
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
        symbols: ["^GSPC", "^IXIC", "MU"],
        items: watchlist.items
      });

    render(<InvestmentsView accounts={accounts} initialHoldings={holdings} initialPortfolio={portfolio} initialWatchlist={watchlist} />);

    fireEvent.change(screen.getByLabelText("Add watchlist symbol"), { target: { value: "vfv.to" } });
    fireEvent.click(screen.getByRole("button", { name: "Add symbol" }));

    await waitFor(() => expect(api.replaceWatchlistSymbols).toHaveBeenCalledWith(["^GSPC", "^IXIC", "MU", "VFV.TO"]));
    await waitFor(() => expect(screen.getAllByText("Vanguard S&P 500 ETF").length).toBeGreaterThan(1));

    fireEvent.click(screen.getByRole("button", { name: "Remove VFV.TO" }));
    await waitFor(() => expect(api.replaceWatchlistSymbols).toHaveBeenLastCalledWith(["^GSPC", "^IXIC", "MU"]));
  });

  it("serializes watchlist updates while a save is pending", async () => {
    let resolveUpdate: (value: WatchlistResponse) => void = () => undefined;
    vi.mocked(api.replaceWatchlistSymbols).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveUpdate = resolve;
      })
    );

    render(<InvestmentsView accounts={accounts} initialHoldings={holdings} initialPortfolio={portfolio} initialWatchlist={watchlist} />);

    fireEvent.change(screen.getByLabelText("Add watchlist symbol"), { target: { value: "vfv.to" } });
    fireEvent.click(screen.getByRole("button", { name: "Add symbol" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove ^IXIC" }));

    expect(api.replaceWatchlistSymbols).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Add symbol" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove ^GSPC" })).toBeDisabled();

    resolveUpdate({
      symbols: ["^GSPC", "^IXIC", "MU", "VFV.TO"],
      items: [...watchlist.items, { symbol: "VFV.TO", name: "VFV.TO", price: 150, currency: "CAD", change_amount: null, change_pct: null }]
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "Add symbol" })).not.toBeDisabled());
  });

  it("shows a watchlist error when a save fails", async () => {
    vi.mocked(api.replaceWatchlistSymbols).mockRejectedValueOnce(new Error("network down"));

    render(<InvestmentsView accounts={accounts} initialHoldings={holdings} initialPortfolio={portfolio} initialWatchlist={watchlist} />);

    fireEvent.change(screen.getByLabelText("Add watchlist symbol"), { target: { value: "vfv.to" } });
    fireEvent.click(screen.getByRole("button", { name: "Add symbol" }));

    expect(await screen.findByText("Could not update watchlist. Try again.")).toBeInTheDocument();
  });
});
