"use client";

import Link from "next/link";
import React, { FormEvent, useMemo, useState } from "react";

import { AccountVisual, accountSubtitle, formatCardBalance, sourceLabel } from "./account-visual";
import { connectSimpleFin, createAccount, deleteAccount, disconnectSimpleFin, syncSimpleFin } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import type { Account, AccountDeleteResponse, AccountInput, AccountType, SimpleFinActionResponse, SimpleFinStatus, Transaction } from "@/lib/types";

type AccountsViewProps = {
  initialAccounts: Account[];
  initialSimpleFinStatus: SimpleFinStatus;
  initialTransactions?: Transaction[];
  onCreateAccount?: (input: AccountInput) => Promise<Account>;
  onDeleteAccount?: (accountId: string) => Promise<AccountDeleteResponse>;
  onConnectSimpleFin?: () => Promise<SimpleFinActionResponse>;
  onDisconnectSimpleFin?: () => Promise<SimpleFinActionResponse>;
  onSyncSimpleFin?: () => Promise<SimpleFinActionResponse>;
};

const ACCOUNT_TYPES: AccountType[] = ["checking", "savings", "cash", "credit_card", "investment", "loan", "other"];
const DEFAULT_INPUT: AccountInput = { name: "", type: "checking", balance: 0, currency: "CAD" };
const CASH_ACCOUNT_TYPES = new Set<AccountType>(["checking", "savings", "cash"]);

export function AccountsView({
  initialAccounts,
  initialSimpleFinStatus,
  initialTransactions = [],
  onCreateAccount = createAccount,
  onDeleteAccount = deleteAccount,
  onConnectSimpleFin = connectSimpleFin,
  onDisconnectSimpleFin = disconnectSimpleFin,
  onSyncSimpleFin = syncSimpleFin
}: AccountsViewProps) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [form, setForm] = useState<AccountInput>(DEFAULT_INPUT);
  const [deleteCandidateId, setDeleteCandidateId] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [addMode, setAddMode] = useState<"manual" | "statement">("manual");
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [message, setMessage] = useState(initialSimpleFinStatus.message);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const selectedAccount = accounts.find((account) => account.id === selectedAccountId) ?? null;
  const totals = summarizeAccounts(accounts);
  const simpleFinAccounts = accounts.filter((account) => account.source === "mock_simplefin" || account.source === "simplefin");
  const cashAccounts = accounts.filter((account) => CASH_ACCOUNT_TYPES.has(account.type));
  const creditCardAccounts = accounts.filter((account) => account.type === "credit_card");
  const otherAccounts = accounts.filter((account) => !CASH_ACCOUNT_TYPES.has(account.type) && account.type !== "credit_card");
  const cashTotal = cashAccounts.reduce((sum, account) => sum + account.balance, 0);
  const creditOutstanding = creditCardAccounts.reduce((sum, account) => sum + Math.abs(Math.min(account.balance, 0)), 0);
  const syncedCount = simpleFinAccounts.length;
  const sourceLabelText = sourceLabel(initialSimpleFinStatus.provider);

  const freshnessLabel = useMemo(() => {
    if (initialSimpleFinStatus.status === "available" || initialSimpleFinStatus.status === "connected") {
      return "Ready";
    }
    if (initialSimpleFinStatus.status === "synced") {
      return "Synced";
    }
    return "Needs attention";
  }, [initialSimpleFinStatus.status]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction("create", async () => {
      const created = await onCreateAccount({ ...form, balance: Number(form.balance) });
      setAccounts((current) => [...current, created]);
      setForm(DEFAULT_INPUT);
      setIsAddDialogOpen(false);
      setMessage(`${created.name} added.`);
    });
  }

  async function handleDelete(account: Account) {
    await runAction(`delete-${account.id}`, async () => {
      await onDeleteAccount(account.id);
      setAccounts((current) => current.filter((item) => item.id !== account.id));
      setDeleteCandidateId(null);
      setSelectedAccountId(null);
      setMessage(`${account.name} deleted.`);
    });
  }

  async function handleSimpleFin(label: string, action: () => Promise<SimpleFinActionResponse>) {
    await runAction(label, async () => {
      const response = await action();
      setMessage(`Mock SimpleFIN ${response.status}. Refresh accounts if you do not see updated balances.`);
    });
  }

  async function runAction(label: string, action: () => Promise<void>) {
    setPendingAction(label);
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The account action failed.");
    } finally {
      setPendingAction(null);
    }
  }

  function openAccountDetails(account: Account) {
    setSelectedAccountId(account.id);
    setDeleteCandidateId(null);
  }

  return (
    <section className="page-stack accounts-page" aria-label="Accounts management">
      <header className="accounts-hero">
        <div className="accounts-hero-top">
          <div className="accounts-hero-copy">
            <span className="section-eyebrow">Data sources</span>
            <h1>Accounts</h1>
            <p>Monitor SimpleFIN Bridge accounts, separate cash from card obligations, and fill gaps with manual or statement data.</p>
          </div>
          <div className="workspace-actions accounts-hero-actions">
            <button className="accounts-hero-action-button" type="button" onClick={() => setIsAddDialogOpen(true)}>
              Add account / Import
            </button>
          </div>
        </div>

        <div className="account-summary-grid accounts-hero-summary" aria-label="Account totals">
          <SummaryTile label={`${accounts.length} accounts`} value="Connected locally" />
          <SummaryTile label="Available cash" value={formatCurrency(cashTotal)} />
          <SummaryTile label="Card balance" value={formatCurrency(creditOutstanding)} />
          <SummaryTile label="Net worth" value={formatCurrency(totals.netWorth)} />
        </div>
      </header>

      {error ? <div className="inline-error" role="alert">{error}</div> : null}
      {message ? <div className="inline-status" role="status">{message}</div> : null}

      <section className="accounts-source-panel" aria-label="SimpleFIN Bridge status">
        <div className="source-status-main">
          <span className="section-eyebrow">SimpleFIN Bridge</span>
          <strong>{freshnessLabel}</strong>
          <p>{initialSimpleFinStatus.message}</p>
        </div>
        <div className="source-health-grid">
          <div className="source-health-tile">
            <span>Mode</span>
            <strong>{initialSimpleFinStatus.mode}</strong>
          </div>
          <div className="source-health-tile">
            <span>Synced accounts</span>
            <strong>{syncedCount}</strong>
          </div>
          <div className="source-health-tile">
            <span>Source</span>
            <strong>{sourceLabelText}</strong>
          </div>
        </div>
        <div className="source-actions">
          <button type="button" onClick={() => handleSimpleFin("connect", onConnectSimpleFin)} disabled={pendingAction === "connect"}>Connect</button>
          <button type="button" onClick={() => handleSimpleFin("sync", onSyncSimpleFin)} disabled={pendingAction === "sync"}>Sync now</button>
          <button type="button" onClick={() => handleSimpleFin("disconnect", onDisconnectSimpleFin)} disabled={pendingAction === "disconnect"}>Disconnect</button>
        </div>
      </section>

      <div className="accounts-primary-grid">
        <AccountGroupPanel
          accounts={cashAccounts}
          empty="Connect SimpleFIN or add checking and savings accounts to track available cash."
          metricLabel="Available cash"
          metricValue={formatCurrency(cashTotal)}
          onOpenAccount={openAccountDetails}
          title="Cash accounts"
        />
        <AccountGroupPanel
          accounts={creditCardAccounts}
          empty="Connect SimpleFIN or add credit cards to monitor short-term obligations."
          metricLabel="Outstanding balance"
          metricValue={formatCurrency(creditOutstanding)}
          onOpenAccount={openAccountDetails}
          title="Credit cards"
        />
      </div>

      {otherAccounts.length ? (
        <AccountGroupPanel
          accounts={otherAccounts}
          empty=""
          metricLabel="Other balance"
          metricValue={formatCurrency(otherAccounts.reduce((sum, account) => sum + account.balance, 0))}
          onOpenAccount={openAccountDetails}
          title="Manual and other accounts"
        />
      ) : null}

      {isAddDialogOpen ? (
        <div
          className="account-dialog-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.currentTarget === event.target) {
              setIsAddDialogOpen(false);
            }
          }}
        >
          <div className="account-dialog" role="dialog" aria-modal="true" aria-labelledby="account-dialog-title">
            <div className="account-dialog-header">
              <div>
                <span className="section-eyebrow">Data entry</span>
                <h2 id="account-dialog-title">Add account / Import</h2>
              </div>
              <button type="button" onClick={() => setIsAddDialogOpen(false)} aria-label="Close add account dialog">Close</button>
            </div>

            <div className="account-dialog-tabs" role="tablist" aria-label="Account entry mode">
              <button type="button" className={addMode === "manual" ? "active" : undefined} onClick={() => setAddMode("manual")}>Manual account</button>
              <button type="button" className={addMode === "statement" ? "active" : undefined} onClick={() => setAddMode("statement")}>Import statement</button>
            </div>

            {addMode === "manual" ? (
              <form className="account-form" onSubmit={handleCreate}>
                <label>
                  <span>New account name</span>
                  <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
                </label>
                <label>
                  <span>Type</span>
                  <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as AccountType })}>
                    {ACCOUNT_TYPES.map((type) => (
                      <option key={type} value={type}>{formatType(type)}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>New account balance</span>
                  <input type="number" step="0.01" value={form.balance} onChange={(event) => setForm({ ...form, balance: Number(event.target.value) })} />
                </label>
                <label>
                  <span>Currency</span>
                  <input value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value.toUpperCase() })} maxLength={3} />
                </label>
                <button className="primary-action-button" type="submit" disabled={pendingAction === "create"}>Add manual account</button>
              </form>
            ) : (
              <div className="statement-import-panel">
                <label>
                  <span>Statement file</span>
                  <input accept=".pdf,.csv" type="file" />
                </label>
                <label>
                  <span>Match account type</span>
                  <select defaultValue="checking">
                    <option value="checking">Checking</option>
                    <option value="savings">Savings</option>
                    <option value="credit_card">Credit card</option>
                  </select>
                </label>
                <div className="statement-import-state">
                  <strong>PDF OCR import</strong>
                  <small>Statement parsing will create reviewable transactions before anything is saved.</small>
                </div>
                <button className="primary-action-button" type="button" disabled>Review import</button>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {selectedAccount ? (
        <AccountDetailsDialog
          account={selectedAccount}
          deleteCandidateId={deleteCandidateId}
          latestTransactions={getLatestAccountTransactions(selectedAccount, initialTransactions)}
          onClose={() => {
            setSelectedAccountId(null);
            setDeleteCandidateId(null);
          }}
          onDelete={handleDelete}
          onStartDelete={setDeleteCandidateId}
          onSyncSimpleFin={() => handleSimpleFin("sync", onSyncSimpleFin)}
          pendingAction={pendingAction}
        />
      ) : null}
    </section>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <article className="metric-card account-summary-tile">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

type AccountGroupPanelProps = {
  accounts: Account[];
  empty: string;
  metricLabel: string;
  metricValue: string;
  onOpenAccount: (account: Account) => void;
  title: string;
};

function AccountGroupPanel({
  accounts,
  empty,
  metricLabel,
  metricValue,
  onOpenAccount,
  title
}: AccountGroupPanelProps) {
  return (
    <article className="panel account-group-panel">
      <div className="panel-heading compact account-group-heading">
        <div>
          <h2>{title}</h2>
          <span>{accounts.length} accounts</span>
        </div>
        <div className="account-group-total">
          <span>{metricLabel}</span>
          <strong>{metricValue}</strong>
        </div>
      </div>
      <div className="account-list">
        {accounts.length ? (
          accounts.map((account) => (
            <AccountRow
              account={account}
              key={account.id}
              onOpenAccount={onOpenAccount}
            />
          ))
        ) : (
          <p className="empty-copy">{empty}</p>
        )}
      </div>
    </article>
  );
}

type AccountRowProps = {
  account: Account;
  onOpenAccount: (account: Account) => void;
};

function AccountRow({ account, onOpenAccount }: AccountRowProps) {
  return (
    <button className="account-row account-row-button" type="button" onClick={() => onOpenAccount(account)} aria-label={`Open ${account.name} account`}>
      <div className="account-row-main">
        <AccountVisual account={account} />
        <div>
          <span className="account-name-line">
            <strong>{account.name}</strong>
            <span className={`source-badge source-${account.source}`}>{sourceLabel(account.source)}</span>
          </span>
          <small>{accountSubtitle(account)}</small>
        </div>
      </div>
      <div className="account-row-balance">
        <strong>{account.type === "credit_card" ? formatCardBalance(account.balance) : formatCurrency(account.balance)}</strong>
      </div>
    </button>
  );
}

type AccountDetailsDialogProps = {
  account: Account;
  deleteCandidateId: string | null;
  latestTransactions: Transaction[];
  onClose: () => void;
  onDelete: (account: Account) => Promise<void>;
  onStartDelete: (accountId: string) => void;
  onSyncSimpleFin: () => Promise<void>;
  pendingAction: string | null;
};

function AccountDetailsDialog({
  account,
  deleteCandidateId,
  latestTransactions,
  onClose,
  onDelete,
  onStartDelete,
  onSyncSimpleFin,
  pendingAction
}: AccountDetailsDialogProps) {
  const isStatement = account.source === "csv" || account.source === "statement" || account.source === "statement_import";
  const isBridge = account.source === "mock_simplefin" || account.source === "simplefin";
  const isDeleteCandidate = deleteCandidateId === account.id;
  const syncLabel = isBridge ? "Sync now" : isStatement ? "Update statement" : "Manual account";

  return (
    <div
      className="account-dialog-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.currentTarget === event.target) {
          onClose();
        }
      }}
    >
      <div className="account-dialog account-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="account-detail-title">
        <div className="account-dialog-header">
          <div className="account-detail-title">
            <AccountVisual account={account} />
            <div>
              <span className={`source-badge source-${account.source}`}>{sourceLabel(account.source)}</span>
              <h2 id="account-detail-title">{account.name}</h2>
              <p>{accountSubtitle(account)}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close account details">Close</button>
        </div>

        <div className="account-detail-summary">
          <div className="account-detail-balance">
            <span>{account.type === "credit_card" ? "Outstanding balance" : "Balance"}</span>
            <strong>{account.type === "credit_card" ? formatCardBalance(account.balance) : formatCurrency(account.balance)}</strong>
          </div>

          <dl className="account-detail-facts" aria-label="Account information">
            <div>
              <dt>Type</dt>
              <dd>{formatType(account.type)}</dd>
            </div>
            <div>
              <dt>Currency</dt>
              <dd>{account.currency}</dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>{sourceLabel(account.source)}</dd>
            </div>
            <div>
              <dt>Last sync</dt>
              <dd>{account.last_synced_at ?? "Not synced"}</dd>
            </div>
          </dl>
        </div>

        <section className="account-detail-transactions" aria-label={`Latest transactions for ${account.name}`}>
          <div className="account-detail-section-heading">
            <h3>Latest transactions</h3>
            <span>{latestTransactions.length} shown</span>
          </div>
          {latestTransactions.length ? (
            <div className="account-transaction-list">
              {latestTransactions.map((transaction) => (
                <div className="account-transaction-row" key={transaction.id}>
                  <div>
                    <strong>{transaction.merchant_normalized ?? transaction.merchant_raw}</strong>
                    <small>{transaction.transaction_date} - {transaction.category ?? "Uncategorized"}</small>
                  </div>
                  <b className={transaction.amount >= 0 ? "positive-amount" : undefined}>{formatCurrency(transaction.amount)}</b>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-copy">No transactions found for this account yet.</p>
          )}
        </section>

        <div className="account-detail-actions account-detail-footer-actions">
          <button className="primary-action-button" type="button" onClick={isBridge ? onSyncSimpleFin : undefined} disabled={!isBridge || pendingAction === "sync"}>{syncLabel}</button>
          {isDeleteCandidate ? (
            <button type="button" onClick={() => onDelete(account)} aria-label={`Confirm delete ${account.name}`}>Confirm delete</button>
          ) : (
            <button type="button" onClick={() => onStartDelete(account.id)} aria-label={`Delete ${account.name}`}>Delete</button>
          )}
          <Link className="account-detail-link" href={`/transactions?account=${encodeURIComponent(account.id)}`}>Transactions</Link>
        </div>
      </div>
    </div>
  );
}

function getLatestAccountTransactions(account: Account, transactions: Transaction[]) {
  return [...transactions]
    .filter((transaction) => transaction.account_id === account.id || transaction.account_name === account.name)
    .sort((left, right) => right.transaction_date.localeCompare(left.transaction_date))
    .slice(0, 5);
}

function summarizeAccounts(accounts: Account[]) {
  return accounts.reduce(
    (totals, account) => {
      if (account.balance >= 0) {
        totals.assets += account.balance;
      } else {
        totals.liabilities += Math.abs(account.balance);
      }
      totals.netWorth += account.balance;
      return totals;
    },
    { assets: 0, liabilities: 0, netWorth: 0 }
  );
}

function formatType(type: AccountType) {
  return type.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
