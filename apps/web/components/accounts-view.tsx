"use client";

import React, { FormEvent, useState } from "react";

import { connectSimpleFin, createAccount, deleteAccount, disconnectSimpleFin, syncSimpleFin, updateAccount } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import type { Account, AccountDeleteResponse, AccountInput, AccountType, SimpleFinActionResponse, SimpleFinStatus } from "@/lib/types";

type AccountsViewProps = {
  initialAccounts: Account[];
  initialSimpleFinStatus: SimpleFinStatus;
  onCreateAccount?: (input: AccountInput) => Promise<Account>;
  onDeleteAccount?: (accountId: string) => Promise<AccountDeleteResponse>;
  onUpdateAccount?: (accountId: string, input: AccountInput) => Promise<Account>;
  onConnectSimpleFin?: () => Promise<SimpleFinActionResponse>;
  onDisconnectSimpleFin?: () => Promise<SimpleFinActionResponse>;
  onSyncSimpleFin?: () => Promise<SimpleFinActionResponse>;
};

const ACCOUNT_TYPES: AccountType[] = ["checking", "savings", "cash", "credit_card", "investment", "loan", "other"];
const DEFAULT_INPUT: AccountInput = { name: "", type: "checking", balance: 0, currency: "CAD" };

export function AccountsView({
  initialAccounts,
  initialSimpleFinStatus,
  onCreateAccount = createAccount,
  onDeleteAccount = deleteAccount,
  onUpdateAccount = updateAccount,
  onConnectSimpleFin = connectSimpleFin,
  onDisconnectSimpleFin = disconnectSimpleFin,
  onSyncSimpleFin = syncSimpleFin
}: AccountsViewProps) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [form, setForm] = useState<AccountInput>(DEFAULT_INPUT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<AccountInput>(DEFAULT_INPUT);
  const [deleteCandidateId, setDeleteCandidateId] = useState<string | null>(null);
  const [message, setMessage] = useState(initialSimpleFinStatus.message);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const totals = summarizeAccounts(accounts);
  const groupedAccounts = groupAccounts(accounts);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction("create", async () => {
      const created = await onCreateAccount({ ...form, balance: Number(form.balance) });
      setAccounts((current) => [...current, created]);
      setForm(DEFAULT_INPUT);
      setMessage(`${created.name} added.`);
    });
  }

  async function handleUpdate(account: Account) {
    await runAction(`update-${account.id}`, async () => {
      const updated = await onUpdateAccount(account.id, { ...editForm, balance: Number(editForm.balance) });
      setAccounts((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setEditingId(null);
      setMessage(`${updated.name} updated.`);
    });
  }

  async function handleDelete(account: Account) {
    await runAction(`delete-${account.id}`, async () => {
      await onDeleteAccount(account.id);
      setAccounts((current) => current.filter((item) => item.id !== account.id));
      setDeleteCandidateId(null);
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

  function startEditing(account: Account) {
    setEditingId(account.id);
    setDeleteCandidateId(null);
    setEditForm({ name: account.name, type: account.type, balance: account.balance, currency: account.currency });
  }

  return (
    <section className="page-stack accounts-page" aria-label="Accounts management">
      <header className="workspace-header">
        <div>
          <span className="section-eyebrow">Data sources</span>
          <h1>Accounts</h1>
          <p>Manage manual balances, imported accounts, and local Mock SimpleFIN actions.</p>
        </div>
      </header>

      <div className="account-summary-grid" aria-label="Account totals">
        <SummaryTile label={`${accounts.length} accounts`} value="Connected locally" />
        <SummaryTile label="Total assets" value={formatCurrency(totals.assets)} />
        <SummaryTile label="Total liabilities" value={formatCurrency(totals.liabilities)} />
        <SummaryTile label="Net worth" value={formatCurrency(totals.netWorth)} />
      </div>

      {error ? <div className="inline-error" role="alert">{error}</div> : null}
      {message ? <div className="inline-status" role="status">{message}</div> : null}

      <div className="accounts-layout">
        <article className="panel account-form-panel">
          <div className="panel-heading compact">
            <h2>Add manual account</h2>
          </div>
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
        </article>

        <article className="panel simplefin-panel">
          <div className="panel-heading compact">
            <h2>Mock SimpleFIN</h2>
          </div>
          <div className="source-status">
            <strong>{initialSimpleFinStatus.status}</strong>
            <span>{initialSimpleFinStatus.mode} mode</span>
            <small>{initialSimpleFinStatus.message}</small>
          </div>
          <div className="source-actions">
            <button type="button" onClick={() => handleSimpleFin("connect", onConnectSimpleFin)} disabled={pendingAction === "connect"}>Connect</button>
            <button type="button" onClick={() => handleSimpleFin("sync", onSyncSimpleFin)} disabled={pendingAction === "sync"}>Sync</button>
            <button type="button" onClick={() => handleSimpleFin("disconnect", onDisconnectSimpleFin)} disabled={pendingAction === "disconnect"}>Disconnect</button>
          </div>
        </article>
      </div>

      <div className="account-groups">
        {groupedAccounts.map((group) => (
          <article className="panel account-group-panel" key={group.key}>
            <div className="panel-heading compact">
              <h2>{group.label}</h2>
              <span>{group.accounts.length} accounts</span>
            </div>
            <div className="account-list">
              {group.accounts.map((account) => {
                const isManual = account.source === "manual";
                const isEditing = editingId === account.id;
                const isDeleteCandidate = deleteCandidateId === account.id;
                return (
                  <div className="account-row" key={account.id}>
                    {isEditing ? (
                      <div className="account-edit-grid">
                        <label>
                          <span>Account name</span>
                          <input value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} />
                        </label>
                        <label>
                          <span>Type</span>
                          <select value={editForm.type} onChange={(event) => setEditForm({ ...editForm, type: event.target.value as AccountType })}>
                            {ACCOUNT_TYPES.map((type) => (
                              <option key={type} value={type}>{formatType(type)}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span>Account balance</span>
                          <input type="number" step="0.01" value={editForm.balance} onChange={(event) => setEditForm({ ...editForm, balance: Number(event.target.value) })} />
                        </label>
                        <label>
                          <span>Currency</span>
                          <input value={editForm.currency} onChange={(event) => setEditForm({ ...editForm, currency: event.target.value.toUpperCase() })} maxLength={3} />
                        </label>
                        <div className="row-actions">
                          <button type="button" onClick={() => handleUpdate(account)} aria-label={`Save ${account.name}`}>Save</button>
                          <button type="button" onClick={() => setEditingId(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="account-row-main">
                          <span className={`source-badge source-${account.source}`}>{sourceLabel(account.source)}</span>
                          <div>
                            <strong>{account.name}</strong>
                            <small>{formatType(account.type)} - {account.currency}</small>
                          </div>
                        </div>
                        <div className="account-row-balance">
                          <strong>{formatCurrency(account.balance)}</strong>
                          <small>{account.last_synced_at ? `Synced ${account.last_synced_at}` : "Local balance"}</small>
                        </div>
                        {isManual ? (
                          <div className="row-actions">
                            <button type="button" onClick={() => startEditing(account)} aria-label={`Edit ${account.name}`}>Edit</button>
                            {isDeleteCandidate ? (
                              <button type="button" onClick={() => handleDelete(account)} aria-label={`Confirm delete ${account.name}`}>Confirm delete</button>
                            ) : (
                              <button type="button" onClick={() => setDeleteCandidateId(account.id)} aria-label={`Delete ${account.name}`}>Delete</button>
                            )}
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </article>
        ))}
      </div>
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

function groupAccounts(accounts: Account[]) {
  const groups = new Map<string, Account[]>();
  for (const account of accounts) {
    const key = `${account.source}-${account.type}`;
    groups.set(key, [...(groups.get(key) ?? []), account]);
  }
  return Array.from(groups.entries()).map(([key, items]) => ({
    key,
    label: `${sourceLabel(items[0].source)} - ${formatType(items[0].type)}`,
    accounts: items
  }));
}

function sourceLabel(source: string) {
  if (source === "manual") {
    return "Manual";
  }
  if (source === "mock_simplefin") {
    return "Mock SimpleFIN";
  }
  if (source === "csv") {
    return "CSV source";
  }
  return "Imported";
}

function formatType(type: AccountType) {
  return type.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
