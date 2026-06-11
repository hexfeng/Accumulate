"use client";

import React, { useMemo, useState } from "react";

import { createHolding, deleteHolding, updateHolding } from "@/lib/api";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { Account, Holding, HoldingInput, PortfolioSnapshot } from "@/lib/types";

type InvestmentsViewProps = {
  accounts: Account[];
  initialHoldings: Holding[];
  initialPortfolio: PortfolioSnapshot;
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

export function InvestmentsView({ accounts, initialHoldings, initialPortfolio }: InvestmentsViewProps) {
  const [holdings, setHoldings] = useState(initialHoldings);
  const [editingHolding, setEditingHolding] = useState<Holding | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const accountOptions = useMemo(() => {
    const investmentAccounts = accounts.filter((account) => account.type === "investment");
    return investmentAccounts.length > 0 ? investmentAccounts : accounts;
  }, [accounts]);
  const portfolio = useMemo(() => buildPortfolioSnapshot(holdings, initialPortfolio), [holdings, initialPortfolio]);

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
        current.map((holding) => (holding.id === editingHolding.id ? { ...updated, ...input, id: editingHolding.id, account_name: accountName, user_id: holding.user_id, source: holding.source } : holding))
      );
    } else {
      const created = await createHolding(input);
      const accountName = accountOptions.find((account) => account.id === input.account_id)?.name ?? created.account_name;
      setHoldings((current) => [
        ...current,
        {
          ...created,
          ...input,
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

  return (
    <section className="page-stack investments-page" aria-label="Investments workspace">
      <header className="page-header">
        <div>
          <span className="section-eyebrow">Manual holdings MVP</span>
          <h1>Investments</h1>
          <p>Track holdings, cost basis, portfolio value, allocation, and account grouping before external market data is connected.</p>
        </div>
        <button className="placeholder-primary" type="button" onClick={openAddDialog}>
          Add holding
        </button>
      </header>

      <div className="spending-summary-grid">
        <MetricCard label="Portfolio value" value={formatCurrency(portfolio.total_value)} meta={`${holdings.length} holdings`} />
        <MetricCard label="Cost basis" value={formatCurrency(portfolio.total_cost)} meta="Manual average cost" />
        <MetricCard label="Unrealized gain" value={formatCurrency(portfolio.unrealized_gain)} meta={formatPercent(portfolio.unrealized_gain_pct)} />
        <MetricCard label="Accounts" value={String(portfolio.accounts.length)} meta="Investment groups" />
      </div>

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
            <p className="empty-copy">Add holdings to calculate allocation.</p>
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
                    <small>{account.holdings_count} holdings</small>
                  </span>
                  <b>{formatCurrency(account.value)}</b>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-copy">No investment accounts have holdings yet.</p>
          )}
        </article>
      </div>

      <article className="panel">
        <div className="panel-heading compact">
          <h2>Holdings</h2>
          <span>{holdings.length} manual entries</span>
        </div>
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
  const title = holding ? `Edit ${holding.symbol}` : "Add holding";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    await onSave({
      ...draft,
      symbol: draft.symbol.trim().toUpperCase(),
      name: draft.name.trim(),
      quantity: Number(draft.quantity),
      average_cost: Number(draft.average_cost),
      market_price: Number(draft.market_price)
    });
    setIsSaving(false);
  }

  function updateDraft<K extends keyof HoldingDraft>(key: K, value: HoldingDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
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
          <input value={draft.symbol} onChange={(event) => updateDraft("symbol", event.target.value)} />
        </label>
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
        <button className="placeholder-primary" disabled={isSaving || !draft.account_id || !draft.symbol.trim()} type="submit">
          Save holding
        </button>
      </form>
    </div>
  );
}

function buildPortfolioSnapshot(holdings: Holding[], fallback: PortfolioSnapshot): PortfolioSnapshot {
  if (holdings.length === 0) {
    return { ...fallback, total_value: 0, total_cost: 0, unrealized_gain: 0, unrealized_gain_pct: 0, allocation: [], accounts: [] };
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
