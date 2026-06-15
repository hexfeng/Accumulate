"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createHolding, deleteHolding, getQuote, refreshQuotes, replaceWatchlistSymbols, searchSecurities, updateHolding } from "@/lib/api";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { Account, Holding, HoldingInput, PortfolioSnapshot, SecuritySearchResult, WatchlistItem, WatchlistResponse } from "@/lib/types";

type InvestmentsViewProps = {
  accounts: Account[];
  initialHoldings: Holding[];
  initialPortfolio: PortfolioSnapshot;
  initialWatchlist: WatchlistResponse;
};

type HoldingDraft = HoldingInput;

const EMPTY_DRAFT: HoldingDraft = {
  account_id: "",
  symbol: "",
  name: "",
  quantity: 0,
  average_cost: 0,
  market_price: 0,
  currency: "CAD"
};

export function InvestmentsView({ accounts, initialHoldings, initialPortfolio, initialWatchlist }: InvestmentsViewProps) {
  const [holdings, setHoldings] = useState(initialHoldings);
  const [watchlist, setWatchlist] = useState(initialWatchlist);
  const [watchlistDraft, setWatchlistDraft] = useState("");
  const [isWatchlistSaving, setIsWatchlistSaving] = useState(false);
  const [watchlistError, setWatchlistError] = useState<string | null>(null);
  const watchlistSavingRef = useRef(false);
  const [editingHolding, setEditingHolding] = useState<Holding | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isRefreshingPrices, setIsRefreshingPrices] = useState(false);
  const [quoteStatus, setQuoteStatus] = useState<string | null>(null);
  const accountOptions = useMemo(() => {
    const investmentAccounts = accounts.filter((account) => account.type === "investment");
    return investmentAccounts.length > 0 ? investmentAccounts : accounts;
  }, [accounts]);
  const investmentAccounts = useMemo(() => accounts.filter((account) => account.type === "investment"), [accounts]);
  const portfolio = useMemo(() => buildPortfolioSnapshot(holdings, initialPortfolio, investmentAccounts), [holdings, initialPortfolio, investmentAccounts]);
  const isSimpleFinBalancePortfolio = holdings.length === 0 && investmentAccounts.length > 0;

  const refreshPortfolioPrices = useCallback(async (force: boolean) => {
    setIsRefreshingPrices(true);
    try {
      const response = await refreshQuotes(force);
      setHoldings(response.holdings);
      const latestQuote = response.quotes[0];
      setQuoteStatus(latestQuote ? `Prices refreshed ${latestQuote.as_of.slice(0, 10)}` : response.message);
    } catch {
      setQuoteStatus("Price refresh unavailable.");
    } finally {
      setIsRefreshingPrices(false);
    }
  }, []);

  useEffect(() => {
    void refreshPortfolioPrices(false);
    const intervalId = window.setInterval(() => {
      void refreshPortfolioPrices(false);
    }, 15 * 60 * 1000);
    return () => window.clearInterval(intervalId);
  }, [refreshPortfolioPrices]);

  function openAddDialog() {
    setEditingHolding(null);
    setIsDialogOpen(true);
  }

  function openEditDialog(holding: Holding) {
    setEditingHolding(holding);
    setIsDialogOpen(true);
  }

  async function saveHolding(input: HoldingInput) {
    if (editingHolding) {
      const updated = await updateHolding(editingHolding.id, input);
      const accountName = accountOptions.find((account) => account.id === input.account_id)?.name ?? updated.account_name;
      setHoldings((current) =>
        current.map((holding) => (holding.id === editingHolding.id ? { ...updated, id: editingHolding.id, account_name: accountName, user_id: holding.user_id, source: holding.source } : holding))
      );
    } else {
      const created = await createHolding(input);
      const accountName = accountOptions.find((account) => account.id === input.account_id)?.name ?? created.account_name;
      setHoldings((current) => [
        ...current,
        {
          ...created,
          id: created.id,
          user_id: created.user_id,
          account_name: accountName,
          source: created.source
        }
      ]);
    }
    setIsDialogOpen(false);
  }

  async function removeHolding(holding: Holding) {
    await deleteHolding(holding.id);
    setHoldings((current) => current.filter((item) => item.id !== holding.id));
  }

  async function addWatchlistSymbol(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const symbol = watchlistDraft.trim().toUpperCase();
    if (!symbol || watchlist.symbols.includes(symbol)) {
      setWatchlistDraft("");
      return;
    }
    const saved = await saveWatchlistSymbols([...watchlist.symbols, symbol]);
    if (saved) {
      setWatchlistDraft("");
    }
  }

  async function removeWatchlistSymbol(symbol: string) {
    await saveWatchlistSymbols(watchlist.symbols.filter((item) => item !== symbol));
  }

  async function saveWatchlistSymbols(symbols: string[]) {
    if (watchlistSavingRef.current) {
      return false;
    }
    watchlistSavingRef.current = true;
    setIsWatchlistSaving(true);
    setWatchlistError(null);
    try {
      const updated = await replaceWatchlistSymbols(symbols);
      setWatchlist(updated);
      return true;
    } catch {
      setWatchlistError("Could not update watchlist. Try again.");
      return false;
    } finally {
      watchlistSavingRef.current = false;
      setIsWatchlistSaving(false);
    }
  }

  return (
    <section className="page-stack investments-page" aria-label="Investments workspace">
      <header className="page-header">
        <div>
          <span className="section-eyebrow">Manual holdings MVP</span>
          <h1>Investments</h1>
          <p>Track holdings, cost basis, live market prices, allocation, and account grouping in one workspace.</p>
        </div>
        <div className="investments-header-actions">
          {quoteStatus ? <span>{quoteStatus}</span> : null}
          <button type="button" onClick={() => void refreshPortfolioPrices(true)} disabled={isRefreshingPrices}>
            {isRefreshingPrices ? "Refreshing..." : "Refresh prices"}
          </button>
          <button className="placeholder-primary" type="button" onClick={openAddDialog}>
            Add holding
          </button>
        </div>
      </header>

      <div className="spending-summary-grid">
        <MetricCard label="Portfolio value" value={formatCurrency(portfolio.total_value)} meta={isSimpleFinBalancePortfolio ? "SimpleFIN balances" : `${holdings.length} holdings`} />
        <MetricCard label="Cost basis" value={formatCurrency(portfolio.total_cost)} meta={isSimpleFinBalancePortfolio ? "Balance basis until holdings sync" : "Manual average cost"} />
        <MetricCard label="Unrealized gain" value={formatCurrency(portfolio.unrealized_gain)} meta={formatPercent(portfolio.unrealized_gain_pct)} />
        <MetricCard label="Accounts" value={String(portfolio.accounts.length)} meta="Investment groups" />
      </div>

      <WatchlistPanel
        draft={watchlistDraft}
        error={watchlistError}
        isSaving={isWatchlistSaving}
        items={watchlist.items}
        onAdd={addWatchlistSymbol}
        onDraftChange={setWatchlistDraft}
        onRemove={removeWatchlistSymbol}
      />

      <div className="spending-detail-grid">
        <article className="panel">
          <div className="panel-heading compact">
            <h2>Allocation</h2>
            <span>{formatCurrency(portfolio.total_value)}</span>
          </div>
          {portfolio.allocation.length > 0 ? (
            <div className="list-stack">
              {portfolio.allocation.map((item) => (
                <div className="list-row" key={item.label}>
                  <span>
                    <strong>{item.label}</strong>
                    <small>{formatPercent(item.percent)} of portfolio</small>
                  </span>
                  <b>{formatCurrency(item.value)}</b>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-copy">Add holdings or sync investment balances to calculate allocation.</p>
          )}
        </article>

        <article className="panel">
          <div className="panel-heading compact">
            <h2>Account grouping</h2>
            <span>{portfolio.accounts.length} accounts</span>
          </div>
          {portfolio.accounts.length > 0 ? (
            <div className="list-stack">
              {portfolio.accounts.map((account) => (
                <div className="list-row" key={account.account_id}>
                  <span>
                    <strong>{account.account_name}</strong>
                    <small>{account.holdings_count > 0 ? `${account.holdings_count} holdings` : "SimpleFIN balances"}</small>
                  </span>
                  <b>{formatCurrency(account.value)}</b>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-copy">No investment accounts have holdings or synced balances yet.</p>
          )}
        </article>
      </div>

      <article className="panel">
        <div className="panel-heading compact">
          <h2>Holdings</h2>
          <span>{holdings.length} manual entries</span>
        </div>
        {holdings.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Name</th>
                  <th>Account</th>
                  <th className="num">Quantity</th>
                  <th className="num">Price</th>
                  <th className="num">Value</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((holding) => (
                  <tr key={holding.id}>
                    <td><strong>{holding.symbol}</strong></td>
                    <td>{holding.name}</td>
                    <td>{holding.account_name}</td>
                    <td className="num">{holding.quantity}</td>
                    <td className="num">{formatCurrency(holding.market_price)}</td>
                    <td className="num">{formatCurrency(holding.quantity * holding.market_price)}</td>
                    <td>
                      <div className="table-action-row">
                        <button type="button" onClick={() => openEditDialog(holding)} aria-label={`Edit ${holding.symbol}`}>Edit</button>
                        <button type="button" onClick={() => removeHolding(holding)} aria-label={`Delete ${holding.symbol}`}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-copy">
            {isSimpleFinBalancePortfolio
              ? "SimpleFIN investment accounts are balance-only right now. Add manual holdings to see symbols, quantities, and prices here."
              : "No holdings have been added yet."}
          </p>
        )}
      </article>

      {isDialogOpen ? (
        <HoldingDialog
          accountOptions={accountOptions}
          holding={editingHolding}
          onClose={() => setIsDialogOpen(false)}
          onSave={saveHolding}
        />
      ) : null}
    </section>
  );
}

function MetricCard({ label, meta, value }: { label: string; meta: string; value: string }) {
  return (
    <article className="metric-card tone-green">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{meta}</small>
    </article>
  );
}

function WatchlistPanel({
  draft,
  error,
  isSaving,
  items,
  onAdd,
  onDraftChange,
  onRemove
}: {
  draft: string;
  error: string | null;
  isSaving: boolean;
  items: WatchlistItem[];
  onAdd: (event: React.FormEvent<HTMLFormElement>) => void;
  onDraftChange: (value: string) => void;
  onRemove: (symbol: string) => void | Promise<void>;
}) {
  return (
    <article className="panel watchlist-panel">
      <div className="panel-heading compact watchlist-heading">
        <h2>Watchlist</h2>
        <form className="watchlist-form" onSubmit={onAdd}>
          <label>
            <span>Add watchlist symbol</span>
            <input value={draft} onChange={(event) => onDraftChange(event.target.value)} />
          </label>
          <button type="submit" disabled={isSaving}>Add symbol</button>
        </form>
      </div>
      {error ? <p className="watchlist-error" role="alert">{error}</p> : null}
      <div className="watchlist-strip">
        {items.map((item) => (
          <WatchlistCard isSaving={isSaving} item={item} key={item.symbol} onRemove={() => void onRemove(item.symbol)} />
        ))}
      </div>
    </article>
  );
}

function WatchlistCard({ isSaving, item, onRemove }: { isSaving: boolean; item: WatchlistItem; onRemove: () => void }) {
  const change = item.change_pct;
  const isPositive = (change ?? 0) >= 0;
  const meta = formatWatchlistMeta(item);
  return (
    <div className="watchlist-card">
      <button type="button" className="watchlist-remove" onClick={onRemove} aria-label={`Remove ${item.symbol}`} disabled={isSaving}>x</button>
      <span>{item.name || item.symbol}</span>
      {item.error ? (
        <strong>{item.error}</strong>
      ) : (
        <>
          <strong>{formatMarketNumber(item.price ?? 0)}</strong>
          {change == null || item.change_amount == null ? (
            <small>Change unavailable</small>
          ) : (
            <small className={isPositive ? "positive" : "negative"}>
              {formatChangeAmount(item.change_amount)} {formatSignedPercent(change)}
            </small>
          )}
          {meta ? <em>{meta}</em> : null}
          <div className={`watchlist-spark ${isPositive ? "positive" : "negative"}`} aria-hidden="true" />
        </>
      )}
    </div>
  );
}

function HoldingDialog({
  accountOptions,
  holding,
  onClose,
  onSave
}: {
  accountOptions: Account[];
  holding: Holding | null;
  onClose: () => void;
  onSave: (input: HoldingInput) => Promise<void>;
}) {
  const [draft, setDraft] = useState<HoldingDraft>(() => ({
    ...EMPTY_DRAFT,
    account_id: holding?.account_id ?? accountOptions[0]?.id ?? "",
    symbol: holding?.symbol ?? "",
    name: holding?.name ?? "",
    quantity: holding?.quantity ?? 0,
    average_cost: holding?.average_cost ?? 0,
    market_price: holding?.market_price ?? 0,
    currency: holding?.currency ?? "CAD"
  }));
  const [isSaving, setIsSaving] = useState(false);
  const [searchResults, setSearchResults] = useState<SecuritySearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const title = holding ? `Edit ${holding.symbol}` : "Add holding";
  const estimatedValue = money(Number(draft.quantity) * Number(draft.market_price ?? 0));

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    await onSave({
      ...draft,
      symbol: draft.symbol.trim().toUpperCase(),
      name: draft.name.trim(),
      quantity: Number(draft.quantity),
      average_cost: Number(draft.average_cost),
      market_price: Number(draft.market_price) > 0 ? Number(draft.market_price) : undefined
    });
    setIsSaving(false);
  }

  function updateDraft<K extends keyof HoldingDraft>(key: K, value: HoldingDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function handleSymbolChange(value: string) {
    const normalized = value.trim().toUpperCase();
    updateDraft("symbol", value);
    if (!normalized) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const results = await searchSecurities(normalized);
      setSearchResults(results);
    } finally {
      setIsSearching(false);
    }
  }

  async function selectSecurity(result: SecuritySearchResult) {
    setDraft((current) => ({
      ...current,
      symbol: result.symbol,
      name: result.name,
      market_price: result.price ?? current.market_price,
      currency: result.currency || current.currency
    }));
    setSearchResults([]);

    if (result.price == null) {
      const quote = await getQuote(result.symbol);
      setDraft((current) => ({
        ...current,
        name: current.name || quote.name,
        market_price: quote.price || current.market_price,
        currency: quote.currency || current.currency
      }));
    }
  }

  return (
    <div className="account-dialog-backdrop" role="presentation" onClick={(event) => event.currentTarget === event.target && onClose()}>
      <form className="account-dialog" role="dialog" aria-modal="true" aria-labelledby="holding-dialog-title" onSubmit={handleSubmit}>
        <div className="account-dialog-header">
          <div>
            <span className="section-eyebrow">Manual holding</span>
            <h2 id="holding-dialog-title">{title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close holding dialog">Close</button>
        </div>
        <label className="budget-input-row">
          <span>Account</span>
          <select value={draft.account_id} onChange={(event) => updateDraft("account_id", event.target.value)}>
            {accountOptions.map((account) => (
              <option value={account.id} key={account.id}>{account.name}</option>
            ))}
          </select>
        </label>
        <label className="budget-input-row">
          <span>Symbol</span>
          <input value={draft.symbol} onChange={(event) => void handleSymbolChange(event.target.value)} autoComplete="off" />
        </label>
        {searchResults.length > 0 ? (
          <div className="security-search-panel">
            <span className="security-search-heading">Results</span>
            <div className="security-search-results" role="listbox" aria-label="Security matches">
              {searchResults.map((result) => (
                <button
                  aria-label={securityResultLabel(result)}
                  className="security-search-result-row"
                  type="button"
                  role="option"
                  aria-selected={draft.symbol === result.symbol}
                  key={result.symbol}
                  onClick={() => void selectSecurity(result)}
                >
                  <span className="security-search-avatar" aria-hidden="true">{securityAvatarLabel(result.symbol)}</span>
                  <span className="security-search-main">
                    <strong className="security-search-symbol">{result.symbol}</strong>
                    <span className="security-search-name">{result.name}</span>
                  </span>
                  <span className="security-search-exchange">{formatExchange(result.exchange)}</span>
                </button>
              ))}
            </div>
          </div>
        ) : isSearching ? (
          <p className="form-helper">Searching securities...</p>
        ) : null}
        <label className="budget-input-row">
          <span>Name</span>
          <input value={draft.name} onChange={(event) => updateDraft("name", event.target.value)} />
        </label>
        <label className="budget-input-row">
          <span>Quantity</span>
          <input min="0" step="0.0001" type="number" value={draft.quantity} onChange={(event) => updateDraft("quantity", Number(event.target.value))} />
        </label>
        <label className="budget-input-row">
          <span>Average cost</span>
          <input min="0" step="0.01" type="number" value={draft.average_cost} onChange={(event) => updateDraft("average_cost", Number(event.target.value))} />
        </label>
        <label className="budget-input-row">
          <span>Market price</span>
          <input min="0" step="0.01" type="number" value={draft.market_price} onChange={(event) => updateDraft("market_price", Number(event.target.value))} />
        </label>
        <div className="quote-preview-panel">
          <div>
            <span>Estimated value</span>
            <strong>{formatCurrency(estimatedValue)}</strong>
          </div>
        </div>
        <button className="placeholder-primary" disabled={isSaving || !draft.account_id || !draft.symbol.trim()} type="submit">
          Save holding
        </button>
      </form>
    </div>
  );
}

function securityResultLabel(result: SecuritySearchResult) {
  return `${result.symbol} ${result.name} ${result.quote_type} ${result.exchange ?? ""} ${result.price ? formatCurrency(result.price) : ""}`.replace(/\s+/g, " ").trim();
}

function securityAvatarLabel(symbol: string) {
  const baseSymbol = symbol.split(".", 1)[0] ?? symbol;
  return baseSymbol.replace(/[^A-Z0-9]/gi, "").slice(0, 3).toUpperCase();
}

function formatExchange(exchange?: string | null) {
  const normalized = (exchange ?? "").trim();
  if (!normalized) {
    return "Market";
  }
  const upper = normalized.toUpperCase();
  if (upper === "NASDAQ") {
    return "Nasdaq";
  }
  if (upper === "TORONTO") {
    return "TSX";
  }
  return normalized.length <= 4 ? upper : normalized;
}

function formatMarketNumber(value: number) {
  return new Intl.NumberFormat("en-CA", { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(value);
}

function formatChangeAmount(value?: number | null) {
  if (value == null) {
    return "";
  }
  const sign = value >= 0 ? "+" : "";
  return `${sign}${formatMarketNumber(value)}`;
}

function formatSignedPercent(value: number) {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatWatchlistMeta(item: WatchlistItem) {
  const parts = [item.provider, formatWatchlistTime(item.as_of)].filter(Boolean);
  return parts.join(" · ");
}

function formatWatchlistTime(value?: string | null) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Toronto"
  }).format(date);
}

function buildPortfolioSnapshot(holdings: Holding[], fallback: PortfolioSnapshot, investmentAccounts: Account[]): PortfolioSnapshot {
  if (holdings.length === 0) {
    if (investmentAccounts.length === 0) {
      return { ...fallback, total_value: 0, total_cost: 0, unrealized_gain: 0, unrealized_gain_pct: 0, allocation: [], accounts: [] };
    }
    const positiveAccounts = investmentAccounts.filter((account) => account.balance > 0);
    const totalValue = money(positiveAccounts.reduce((sum, account) => sum + account.balance, 0));
    return {
      total_value: totalValue,
      total_cost: totalValue,
      unrealized_gain: 0,
      unrealized_gain_pct: 0,
      allocation: positiveAccounts.map((account) => ({
        label: account.name,
        value: money(account.balance),
        percent: totalValue > 0 ? money((account.balance / totalValue) * 100) : 0
      })),
      accounts: positiveAccounts.map((account) => ({
        account_id: account.id,
        account_name: account.name,
        holdings_count: 0,
        value: money(account.balance)
      }))
    };
  }
  const totalValue = money(holdings.reduce((sum, holding) => sum + holding.quantity * holding.market_price, 0));
  const totalCost = money(holdings.reduce((sum, holding) => sum + holding.quantity * holding.average_cost, 0));
  const unrealizedGain = money(totalValue - totalCost);
  const allocation = holdings.map((holding) => {
    const value = money(holding.quantity * holding.market_price);
    return {
      label: holding.symbol,
      value,
      percent: totalValue > 0 ? money((value / totalValue) * 100) : 0
    };
  });
  const accountMap = new Map<string, { account_id: string; account_name: string; holdings_count: number; value: number }>();
  holdings.forEach((holding) => {
    const existing = accountMap.get(holding.account_id) ?? { account_id: holding.account_id, account_name: holding.account_name, holdings_count: 0, value: 0 };
    existing.holdings_count += 1;
    existing.value = money(existing.value + holding.quantity * holding.market_price);
    accountMap.set(holding.account_id, existing);
  });
  return {
    total_value: totalValue,
    total_cost: totalCost,
    unrealized_gain: unrealizedGain,
    unrealized_gain_pct: totalCost > 0 ? money((unrealizedGain / totalCost) * 100) : 0,
    allocation,
    accounts: [...accountMap.values()]
  };
}

function money(value: number) {
  return Math.round(value * 100) / 100;
}
