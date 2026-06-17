"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createHolding, deleteHolding, getQuote, getWatchlist, refreshQuotes, replaceWatchlistSymbols, searchSecurities, updateHolding } from "@/lib/api";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { Account, Holding, HoldingInput, PortfolioSnapshot, SecuritySearchResult, WatchlistItem, WatchlistResponse } from "@/lib/types";

type InvestmentsViewProps = {
  accounts: Account[];
  initialHoldings: Holding[];
  initialPortfolio: PortfolioSnapshot;
  initialWatchlist?: WatchlistResponse;
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

const EMPTY_WATCHLIST: WatchlistResponse = { symbols: [], items: [] };
const MAX_WATCHLIST_SYMBOLS = 5;
const MARKET_SESSION_INTERVALS = 78;
const MARKET_OPEN_MINUTES = 9 * 60 + 30;
const MARKET_SESSION_MINUTES = 390;

export function InvestmentsView({ accounts, initialHoldings, initialPortfolio, initialWatchlist = EMPTY_WATCHLIST }: InvestmentsViewProps) {
  const [holdings, setHoldings] = useState(initialHoldings);
  const [watchlist, setWatchlist] = useState(initialWatchlist);
  const [watchlistDraft, setWatchlistDraft] = useState("");
  const [watchlistSearchResults, setWatchlistSearchResults] = useState<SecuritySearchResult[]>([]);
  const [isWatchlistSearching, setIsWatchlistSearching] = useState(false);
  const [isWatchlistDialogOpen, setIsWatchlistDialogOpen] = useState(false);
  const [draggedWatchlistSymbol, setDraggedWatchlistSymbol] = useState<string | null>(null);
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

  useEffect(() => {
    let isMounted = true;
    getWatchlist()
      .then((updated) => {
        if (isMounted) {
          setWatchlist(updated);
        }
      })
      .catch(() => {
        if (isMounted) {
          setWatchlistError("Could not load watchlist. Try again.");
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isWatchlistDialogOpen) {
      setWatchlistSearchResults([]);
      setIsWatchlistSearching(false);
      return;
    }
    const query = watchlistDraft.trim();
    if (!query) {
      setWatchlistSearchResults([]);
      setIsWatchlistSearching(false);
      return;
    }
    let isCancelled = false;
    setIsWatchlistSearching(true);
    const timeoutId = window.setTimeout(() => {
      searchSecurities(query)
        .then((results) => {
          if (!isCancelled) {
            setWatchlistSearchResults(results);
          }
        })
        .catch(() => {
          if (!isCancelled) {
            setWatchlistSearchResults([]);
          }
        })
        .finally(() => {
          if (!isCancelled) {
            setIsWatchlistSearching(false);
          }
        });
    }, 180);
    return () => {
      isCancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [isWatchlistDialogOpen, watchlistDraft]);

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

  async function addWatchlistSymbol(symbol: string) {
    const normalized = symbol.trim().toUpperCase();
    if (!normalized || watchlist.symbols.includes(normalized)) {
      setWatchlistDraft("");
      return;
    }
    if (watchlist.symbols.length >= MAX_WATCHLIST_SYMBOLS) {
      setWatchlistError("Watchlist can include up to 5 symbols.");
      return;
    }
    const saved = await saveWatchlistSymbols([...watchlist.symbols, normalized]);
    if (saved) {
      setWatchlistDraft("");
      setWatchlistSearchResults([]);
    }
  }

  async function removeWatchlistSymbol(symbol: string) {
    await saveWatchlistSymbols(watchlist.symbols.filter((item) => item !== symbol));
  }

  async function moveWatchlistSymbol(symbol: string, direction: -1 | 1) {
    const index = watchlist.symbols.indexOf(symbol);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= watchlist.symbols.length) {
      return;
    }
    const next = [...watchlist.symbols];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    await saveWatchlistSymbols(next);
  }

  async function reorderWatchlistSymbol(symbol: string, targetSymbol: string) {
    if (symbol === targetSymbol) {
      return;
    }
    const currentIndex = watchlist.symbols.indexOf(symbol);
    const targetIndex = watchlist.symbols.indexOf(targetSymbol);
    if (currentIndex < 0 || targetIndex < 0) {
      return;
    }
    const next = [...watchlist.symbols];
    next.splice(currentIndex, 1);
    next.splice(targetIndex, 0, symbol);
    await saveWatchlistSymbols(next);
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
        draggedSymbol={draggedWatchlistSymbol}
        isDialogOpen={isWatchlistDialogOpen}
        isSaving={isWatchlistSaving}
        isSearching={isWatchlistSearching}
        items={watchlist.items}
        onAddSymbol={addWatchlistSymbol}
        onCloseDialog={() => setIsWatchlistDialogOpen(false)}
        onDraftChange={setWatchlistDraft}
        onMove={moveWatchlistSymbol}
        onOpenDialog={() => {
          setWatchlistDraft("");
          setWatchlistSearchResults([]);
          setWatchlistError(null);
          setIsWatchlistDialogOpen(true);
        }}
        onRemove={removeWatchlistSymbol}
        onReorder={reorderWatchlistSymbol}
        onSetDraggedSymbol={setDraggedWatchlistSymbol}
        searchResults={watchlistSearchResults}
        symbols={watchlist.symbols}
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
  draggedSymbol,
  error,
  isDialogOpen,
  isSaving,
  isSearching,
  items,
  onAddSymbol,
  onCloseDialog,
  onDraftChange,
  onMove,
  onOpenDialog,
  onRemove,
  onReorder,
  onSetDraggedSymbol,
  searchResults,
  symbols
}: {
  draft: string;
  draggedSymbol: string | null;
  error: string | null;
  isDialogOpen: boolean;
  isSaving: boolean;
  isSearching: boolean;
  items: WatchlistItem[];
  onAddSymbol: (symbol: string) => void | Promise<void>;
  onCloseDialog: () => void;
  onDraftChange: (value: string) => void;
  onMove: (symbol: string, direction: -1 | 1) => void | Promise<void>;
  onOpenDialog: () => void;
  onRemove: (symbol: string) => void | Promise<void>;
  onReorder: (symbol: string, targetSymbol: string) => void | Promise<void>;
  onSetDraggedSymbol: (symbol: string | null) => void;
  searchResults: SecuritySearchResult[];
  symbols: string[];
}) {
  return (
    <article className="panel watchlist-panel">
      <div className="panel-heading compact watchlist-heading">
        <div>
          <h2>Watchlist</h2>
          <p>Intraday price movement</p>
        </div>
        <button className="watchlist-edit-button" type="button" onClick={onOpenDialog}>Edit</button>
      </div>
      {error ? <p className="watchlist-error" role="alert">{error}</p> : null}
      <div className="watchlist-strip">
        {items.map((item) => (
          <WatchlistCard item={item} key={item.symbol} />
        ))}
      </div>
      {isDialogOpen ? (
        <WatchlistDialog
          draft={draft}
          draggedSymbol={draggedSymbol}
          isSaving={isSaving}
          isSearching={isSearching}
          items={items}
          onAddSymbol={onAddSymbol}
          onClose={onCloseDialog}
          onDraftChange={onDraftChange}
          onMove={onMove}
          onRemove={onRemove}
          onReorder={onReorder}
          onSetDraggedSymbol={onSetDraggedSymbol}
          searchResults={searchResults}
          symbols={symbols}
        />
      ) : null}
    </article>
  );
}

function WatchlistCard({ item }: { item: WatchlistItem }) {
  const change = item.change_pct;
  const isPositive = (change ?? 0) >= 0;
  const previousClose = item.price != null && item.change_amount != null ? item.price - item.change_amount : null;
  const sparkline = buildSparklineChart(item.sparkline, previousClose);
  return (
    <div className={`watchlist-card ${isPositive ? "positive" : "negative"}`} role="group" aria-label={`${item.symbol} watchlist card`}>
      <div className="watchlist-card-header">
        <span className="watchlist-card-title">
          <strong>{item.symbol}</strong>
          <small>{watchlistSecurityName(item)}</small>
        </span>
        <span className="watchlist-exchange-pill">{watchlistExchangeLabel(item.symbol)}</span>
      </div>
      {item.error ? (
        <strong>{item.error}</strong>
      ) : (
        <>
          <div className="watchlist-market-row">
            <div className="watchlist-market-values">
              <strong>{formatMarketNumber(item.price ?? 0)}</strong>
              {change == null || item.change_amount == null ? (
                <small>Change unavailable</small>
              ) : (
                <span className={`watchlist-change-pct ${isPositive ? "positive" : "negative"}`}>
                  {formatChangeAmount(item.change_amount)} ({formatSignedPercent(change)})
                </span>
              )}
            </div>
          </div>
          <div className="watchlist-chart">
            <svg className={`watchlist-spark ${isPositive ? "positive" : "negative"}`} viewBox="0 0 160 58" preserveAspectRatio="none" aria-hidden="true">
              {sparkline.previousCloseY ? (
                <line
                  className="watchlist-previous-close-line"
                  x1="0"
                  x2="160"
                  y1={sparkline.previousCloseY}
                  y2={sparkline.previousCloseY}
                />
              ) : null}
              {sparkline.areaPoints ? <polygon className="watchlist-spark-area" points={sparkline.areaPoints} /> : null}
              <polyline points={sparkline.points} />
              {sparkline.endpoint ? <circle className="watchlist-spark-endpoint" cx={sparkline.endpoint.x} cy={sparkline.endpoint.y} r="2.4" /> : null}
            </svg>
            <div className="watchlist-session-track" aria-hidden="true">
              <span style={{ width: `${sparkline.progressPct}%` }} />
            </div>
            <div className="watchlist-session-labels">
              <span>Open 9:30 AM</span>
              <span>{sparkline.endLabel}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function WatchlistDialog({
  draft,
  draggedSymbol,
  isSaving,
  isSearching,
  items,
  onAddSymbol,
  onClose,
  onDraftChange,
  onMove,
  onRemove,
  onReorder,
  onSetDraggedSymbol,
  searchResults,
  symbols
}: {
  draft: string;
  draggedSymbol: string | null;
  isSaving: boolean;
  isSearching: boolean;
  items: WatchlistItem[];
  onAddSymbol: (symbol: string) => void | Promise<void>;
  onClose: () => void;
  onDraftChange: (value: string) => void;
  onMove: (symbol: string, direction: -1 | 1) => void | Promise<void>;
  onRemove: (symbol: string) => void | Promise<void>;
  onReorder: (symbol: string, targetSymbol: string) => void | Promise<void>;
  onSetDraggedSymbol: (symbol: string | null) => void;
  searchResults: SecuritySearchResult[];
  symbols: string[];
}) {
  const itemMap = new Map(items.map((item) => [item.symbol, item]));
  const canAdd = symbols.length < MAX_WATCHLIST_SYMBOLS;

  function submitDraft(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const symbol = searchResults[0]?.symbol ?? draft;
    void onAddSymbol(symbol);
  }

  return (
    <div className="account-dialog-backdrop" role="presentation" onClick={(event) => event.currentTarget === event.target && onClose()}>
      <div className="account-dialog watchlist-dialog" role="dialog" aria-modal="true" aria-labelledby="watchlist-dialog-title">
        <div className="account-dialog-header">
          <div>
            <span className="section-eyebrow">Current watchlist</span>
            <h2 id="watchlist-dialog-title">Edit watchlist</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close watchlist dialog">Close</button>
        </div>

        <div className="watchlist-current-list">
          {symbols.map((symbol, index) => {
            const item = itemMap.get(symbol);
            return (
              <div
                className={`watchlist-current-item ${draggedSymbol === symbol ? "dragging" : ""}`}
                draggable={!isSaving}
                key={symbol}
                onDragStart={() => onSetDraggedSymbol(symbol)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (draggedSymbol) {
                    void onReorder(draggedSymbol, symbol);
                  }
                  onSetDraggedSymbol(null);
                }}
                onDragEnd={() => onSetDraggedSymbol(null)}
              >
                <span className="watchlist-symbol-dot" aria-hidden="true" />
                <span className="watchlist-current-main">
                  <strong>{symbol}</strong>
                  <small>{item?.name ?? symbol}</small>
                </span>
                <div className="watchlist-current-actions">
                  <button type="button" onClick={() => void onMove(symbol, -1)} disabled={isSaving || index === 0} aria-label={`Move ${symbol} up`}>Up</button>
                  <button type="button" onClick={() => void onMove(symbol, 1)} disabled={isSaving || index === symbols.length - 1} aria-label={`Move ${symbol} down`}>Down</button>
                  <button type="button" onClick={() => void onRemove(symbol)} disabled={isSaving} aria-label={`Delete ${symbol}`}>Delete</button>
                </div>
              </div>
            );
          })}
        </div>

        <form className="watchlist-search-form" onSubmit={submitDraft}>
          <label>
            <span>Add symbol</span>
            <input
              aria-label="Search watchlist symbol"
              autoComplete="off"
              disabled={!canAdd || isSaving}
              placeholder={canAdd ? "Search symbol or company" : "Watchlist is full"}
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
            />
          </label>
        </form>
        <div className="security-search-panel watchlist-search-panel">
          {isSearching ? <p className="form-helper">Searching securities...</p> : null}
          {searchResults.length > 0 ? (
            <div className="security-search-results" role="listbox" aria-label="Watchlist symbol matches">
              {searchResults.map((result) => {
                const isAdded = symbols.includes(result.symbol);
                return (
                  <button
                    aria-label={`Add ${securityResultLabel(result)}`}
                    className="security-search-result-row"
                    type="button"
                    role="option"
                    aria-selected={isAdded}
                    disabled={!canAdd || isAdded || isSaving}
                    key={result.symbol}
                    onClick={() => void onAddSymbol(result.symbol)}
                  >
                    <span className="security-search-avatar" aria-hidden="true">{securityAvatarLabel(result.symbol)}</span>
                    <span className="security-search-main">
                      <strong className="security-search-symbol">{result.symbol}</strong>
                      <span className="security-search-name">{result.name}</span>
                    </span>
                    <span className="security-search-exchange">{formatExchange(result.exchange)}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
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
  return `${sign}${value.toFixed(1)}%`;
}

function formatWatchlistMeta(item: WatchlistItem) {
  const parts = [item.provider, formatWatchlistTime(item.as_of)].filter(Boolean);
  return parts.join(" · ");
}

function watchlistDisplayName(item: WatchlistItem) {
  const indexNames: Record<string, string> = {
    "^DJI": "Dow Jones",
    "^GSPC": "S&P 500",
    "^IXIC": "Nasdaq",
    "^RUT": "Russell",
    "^GSPTSE": "TSX",
    "MU": "Micron"
  };
  return indexNames[item.symbol] ?? item.name ?? item.symbol;
}

function watchlistSecurityName(item: WatchlistItem) {
  const name = item.name?.trim();
  return name && name !== item.symbol ? name : watchlistDisplayName(item);
}

function watchlistExchangeLabel(symbol: string) {
  const upper = symbol.toUpperCase();
  const explicit: Record<string, string> = {
    "DIA": "NYSE Arca",
    "SPY": "NYSE Arca",
    "IWM": "NYSE Arca",
    "QQQ": "Nasdaq",
    "MU": "Nasdaq",
    "^IXIC": "Nasdaq",
    "^GSPTSE": "TSX",
    "XIU.TO": "TSX"
  };
  if (explicit[upper]) {
    return explicit[upper];
  }
  if (upper.endsWith(".TO")) {
    return "TSX";
  }
  if (upper.endsWith(".NE")) {
    return "NEO";
  }
  if (upper.endsWith(".HK")) {
    return "HKEX";
  }
  if (upper.endsWith(".SS")) {
    return "SSE";
  }
  if (upper.endsWith(".SZ")) {
    return "SZSE";
  }
  if (upper.endsWith(".T")) {
    return "TSE";
  }
  if (upper.endsWith(".KS")) {
    return "KRX";
  }
  if (upper.startsWith("^")) {
    return "Index";
  }
  return "Market";
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

type SparklineInputPoint = number | { time?: string | null; price?: number | null };
type NormalizedSparklinePoint = { minutesAfterOpen: number | null; price: number; time: string | null };

function buildSparklineChart(values?: SparklineInputPoint[], previousClose?: number | null) {
  const width = 160;
  const height = 58;
  const baselineY = 48;
  const points = normalizeSparklinePoints(values);
  if (points.length < 2) {
    const fallbackPoints = `0,${baselineY} ${roundPoint(width / 3)},${baselineY} ${roundPoint((width / 3) * 2)},${baselineY} ${width},${baselineY}`;
    return {
      areaPoints: `0,${baselineY} ${width},${baselineY} ${width},${height} 0,${height}`,
      points: fallbackPoints,
      previousCloseY: null,
      endpoint: { x: width.toString(), y: baselineY.toString() },
      progressPct: 100,
      endLabel: "4:00 PM"
    };
  }
  const prices = points.map((point) => point.price);
  const hasPreviousClose = previousClose != null && Number.isFinite(previousClose);
  const scalePoints = hasPreviousClose ? [...prices, previousClose] : prices;
  const min = Math.min(...scalePoints);
  const max = Math.max(...scalePoints);
  const range = max - min;
  if (range === 0) {
    const chartPoints = points.map((point, index) => `${xForPoint(point, index, points.length)},${baselineY}`);
    const endpointX = xForPoint(points[points.length - 1], points.length - 1, points.length);
    return {
      areaPoints: `${chartPoints.join(" ")} ${endpointX},${height} 0,${height}`,
      points: chartPoints.join(" "),
      previousCloseY: hasPreviousClose ? roundPoint(baselineY) : null,
      endpoint: { x: endpointX, y: roundPoint(baselineY) },
      progressPct: marketSessionProgressPct(points),
      endLabel: marketSessionEndLabel(points)
    };
  }
  const drawableHeight = 36;
  const yForValue = (value: number) => roundPoint(baselineY - ((value - min) / range) * drawableHeight);
  const chartPoints = points.map((point, index) => {
    const x = xForPoint(point, index, points.length);
    return `${x},${yForValue(point.price)}`;
  });
  const endpoint = {
    x: xForPoint(points[points.length - 1], points.length - 1, points.length),
    y: yForValue(points[points.length - 1].price)
  };
  return {
    areaPoints: `${chartPoints.join(" ")} ${endpoint.x},${height} 0,${height}`,
    points: chartPoints.join(" "),
    previousCloseY: hasPreviousClose ? yForValue(previousClose) : null,
    endpoint,
    progressPct: marketSessionProgressPct(points),
    endLabel: marketSessionEndLabel(points)
  };
}

function normalizeSparklinePoints(values?: SparklineInputPoint[]) {
  return (values ?? []).flatMap((point): NormalizedSparklinePoint[] => {
    if (typeof point === "number") {
      return Number.isFinite(point) && point > 0 ? [{ minutesAfterOpen: null, price: point, time: null }] : [];
    }
    const price = Number(point.price);
    if (!Number.isFinite(price) || price <= 0) {
      return [];
    }
    const time = point.time ?? null;
    return [{ minutesAfterOpen: marketMinutesAfterOpen(time), price, time }];
  });
}

function xForPoint(point: NormalizedSparklinePoint, index: number, pointCount: number) {
  if (point.minutesAfterOpen != null) {
    return roundPoint((point.minutesAfterOpen / MARKET_SESSION_MINUTES) * 160);
  }
  return xForIndex(index, pointCount);
}

function xForIndex(index: number, pointCount: number) {
  const width = 160;
  const denominator = Math.max(MARKET_SESSION_INTERVALS, pointCount - 1, 1);
  return roundPoint((index / denominator) * width);
}

function marketSessionProgressPct(points: NormalizedSparklinePoint[]) {
  const lastPoint = points[points.length - 1];
  if (lastPoint?.minutesAfterOpen != null) {
    return Math.min(100, Math.max(0, (lastPoint.minutesAfterOpen / MARKET_SESSION_MINUTES) * 100));
  }
  return Math.min(100, Math.max(0, ((Math.max(points.length, 1) - 1) / MARKET_SESSION_INTERVALS) * 100));
}

function marketSessionEndLabel(points: NormalizedSparklinePoint[]) {
  const lastPoint = points[points.length - 1];
  const minutesAfterOpen = lastPoint?.minutesAfterOpen ?? Math.min(MARKET_SESSION_MINUTES, Math.max(0, (Math.max(points.length, 1) - 1) * 5));
  return marketSessionLabel(minutesAfterOpen);
}

function marketMinutesAfterOpen(value?: string | null) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    timeZone: "America/Toronto"
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return Math.min(MARKET_SESSION_MINUTES, Math.max(0, hour * 60 + minute - MARKET_OPEN_MINUTES));
}

function marketSessionLabel(minutesAfterOpen: number) {
  const totalMinutes = MARKET_OPEN_MINUTES + Math.min(MARKET_SESSION_MINUTES, Math.max(0, minutesAfterOpen));
  const hour24 = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  const hour12 = hour24 > 12 ? hour24 - 12 : hour24;
  const suffix = hour24 >= 12 ? "PM" : "AM";
  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function roundPoint(value: number) {
  return Number(value.toFixed(2)).toString();
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
