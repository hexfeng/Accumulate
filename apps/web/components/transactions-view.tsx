"use client";

import { useMemo, useState } from "react";

import { getTransactions, patchTransactionCategory } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import type { Transaction } from "@/lib/types";

const categories = ["Dining", "Groceries", "Subscriptions", "Transport", "Income", "Payment", "Transfer", "Uncategorized"];

type TransactionMonthGroup = {
  key: string;
  label: string;
  transactions: Transaction[];
};

type TransactionAccountGroup = {
  accountId: string;
  accountName: string;
  months: TransactionMonthGroup[];
  transactions: Transaction[];
};

export function TransactionsView({ initialTransactions }: { initialTransactions: Transaction[] }) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [filter, setFilter] = useState("all");
  const [activeMonthDialog, setActiveMonthDialog] = useState<{ account: TransactionAccountGroup; month: TransactionMonthGroup } | null>(null);
  const [historyDialogAccount, setHistoryDialogAccount] = useState<TransactionAccountGroup | null>(null);

  const visibleTransactions = useMemo(() => {
    return transactions
      .filter((transaction) => filter === "all" || transaction.category === filter)
      .sort((a, b) => {
        const accountSort = a.account_name.localeCompare(b.account_name);
        if (accountSort !== 0) {
          return accountSort;
        }
        return b.transaction_date.localeCompare(a.transaction_date);
      });
  }, [transactions, filter]);
  const groupedTransactions = useMemo(() => groupTransactions(visibleTransactions), [visibleTransactions]);

  async function updateCategory(transaction: Transaction, category: string) {
    const merchant = transaction.merchant_normalized ?? transaction.merchant_raw;
    const updated = await patchTransactionCategory(transaction.id, category, merchant);
    if (updated) {
      const refreshedTransactions = await getTransactions();
      if (refreshedTransactions.length > 0) {
        setTransactions(refreshedTransactions);
        return;
      }
    }
    setTransactions((current) =>
      current.map((item) => (item.id === transaction.id ? updated ?? { ...item, category } : item))
    );
  }

  return (
    <section className="page-stack">
      <header className="page-header">
        <div>
          <h1>Transactions</h1>
          <p>Review imported banking activity, correct categories, and create reusable local rules.</p>
        </div>
        <select className="select-control" value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter by category">
          <option value="all">All categories</option>
          {categories.map((category) => (
            <option value={category} key={category}>{category}</option>
          ))}
        </select>
      </header>

      {groupedTransactions.length > 0 ? (
        <div className="transaction-account-stack">
          {groupedTransactions.map((accountGroup) => (
            <section
              aria-label={`${accountGroup.accountName} transactions`}
              className="panel transaction-account-section"
              key={accountGroup.accountId}
              role="region"
            >
              <div className="panel-heading compact">
                <div>
                  <h2>{accountGroup.accountName}</h2>
                  <p>{accountGroup.transactions.length} transactions</p>
                </div>
              </div>
              {accountGroup.months[0] ? (
                <TransactionMonthPreview
                  accountGroup={accountGroup}
                  monthGroup={accountGroup.months[0]}
                  onOpenHistory={() => setHistoryDialogAccount(accountGroup)}
                  onOpenMonth={() => setActiveMonthDialog({ account: accountGroup, month: accountGroup.months[0] })}
                  onUpdateCategory={updateCategory}
                />
              ) : null}
            </section>
          ))}
        </div>
      ) : (
        <article className="panel">
          <p className="empty-copy">No transactions found for the selected category.</p>
        </article>
      )}

      {activeMonthDialog ? (
        <MonthTransactionsDialog
          accountGroup={activeMonthDialog.account}
          monthGroup={activeMonthDialog.month}
          onClose={() => setActiveMonthDialog(null)}
          onUpdateCategory={updateCategory}
        />
      ) : null}

      {historyDialogAccount ? (
        <MonthlyHistoryDialog
          accountGroup={historyDialogAccount}
          onClose={() => setHistoryDialogAccount(null)}
          onOpenMonth={(month) => {
            setHistoryDialogAccount(null);
            setActiveMonthDialog({ account: historyDialogAccount, month });
          }}
        />
      ) : null}
    </section>
  );
}

function TransactionMonthPreview({
  accountGroup,
  monthGroup,
  onOpenHistory,
  onOpenMonth,
  onUpdateCategory
}: {
  accountGroup: TransactionAccountGroup;
  monthGroup: TransactionMonthGroup;
  onOpenHistory: () => void;
  onOpenMonth: () => void;
  onUpdateCategory: (transaction: Transaction, category: string) => void;
}) {
  const previewTransactions = monthGroup.transactions.slice(0, 5);
  const hiddenCount = Math.max(monthGroup.transactions.length - previewTransactions.length, 0);

  return (
    <div className="transaction-month-stack">
      <section className="transaction-month-section">
        <div className="transaction-month-heading">
          <div>
            <h3>{monthGroup.label}</h3>
            <span>
              Showing {previewTransactions.length} of {monthGroup.transactions.length} entries
            </span>
          </div>
          <div className="transaction-month-actions">
            <button
              type="button"
              onClick={onOpenMonth}
              aria-label={`View all ${monthGroup.label} transactions for ${accountGroup.accountName}`}
            >
              View all
            </button>
            <button
              type="button"
              onClick={onOpenHistory}
              aria-label={`View ${accountGroup.accountName} history by month`}
            >
              History by month
            </button>
          </div>
        </div>
        <TransactionTable transactions={previewTransactions} onUpdateCategory={onUpdateCategory} />
        {hiddenCount > 0 ? <p className="empty-copy">{hiddenCount} more entries in {monthGroup.label}.</p> : null}
      </section>
    </div>
  );
}

function MonthTransactionsDialog({
  accountGroup,
  monthGroup,
  onClose,
  onUpdateCategory
}: {
  accountGroup: TransactionAccountGroup;
  monthGroup: TransactionMonthGroup;
  onClose: () => void;
  onUpdateCategory: (transaction: Transaction, category: string) => void;
}) {
  const titleId = `transactions-${accountGroup.accountId}-${monthGroup.key}`;

  return (
    <div className="account-dialog-backdrop" role="presentation" onClick={(event) => event.currentTarget === event.target && onClose()}>
      <div className="account-dialog transaction-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="account-dialog-header">
          <div>
            <span className="section-eyebrow">{monthGroup.label}</span>
            <h2 id={titleId}>{accountGroup.accountName} {monthGroup.label} transactions</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close transactions dialog">Close</button>
        </div>
        <TransactionTable transactions={monthGroup.transactions} onUpdateCategory={onUpdateCategory} />
      </div>
    </div>
  );
}

function MonthlyHistoryDialog({
  accountGroup,
  onClose,
  onOpenMonth
}: {
  accountGroup: TransactionAccountGroup;
  onClose: () => void;
  onOpenMonth: (month: TransactionMonthGroup) => void;
}) {
  const titleId = `history-${accountGroup.accountId}`;

  return (
    <div className="account-dialog-backdrop" role="presentation" onClick={(event) => event.currentTarget === event.target && onClose()}>
      <div className="account-dialog transaction-history-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="account-dialog-header">
          <div>
            <span className="section-eyebrow">Statement history</span>
            <h2 id={titleId}>{accountGroup.accountName} monthly history</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close monthly history">Close</button>
        </div>
        <div className="list-stack">
          {accountGroup.months.map((month) => {
            const spending = month.transactions.reduce((sum, transaction) => sum + (isSpendingTransaction(transaction) ? Math.abs(transaction.amount) : 0), 0);
            return (
              <button className="list-row list-link-row" key={month.key} type="button" onClick={() => onOpenMonth(month)}>
                <span>
                  <strong>{month.label}</strong>
                  <small>{month.transactions.length} transactions</small>
                </span>
                <b>{formatCurrency(spending)}</b>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TransactionTable({
  onUpdateCategory,
  transactions
}: {
  onUpdateCategory: (transaction: Transaction, category: string) => void;
  transactions: Transaction[];
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Merchant</th>
            <th>Category</th>
            <th className="num">Amount</th>
            <th>Confidence</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => (
            <tr key={transaction.id}>
              <td>{transaction.transaction_date}</td>
              <td>
                <strong>{transaction.merchant_normalized ?? transaction.merchant_raw}</strong>
                <small>{transaction.source}</small>
              </td>
              <td>
                <select className="table-select" value={transaction.category ?? "Uncategorized"} onChange={(event) => onUpdateCategory(transaction, event.target.value)}>
                  {categories.map((category) => (
                    <option value={category} key={category}>{category}</option>
                  ))}
                </select>
              </td>
              <td className={transaction.amount < 0 ? "num negative" : "num positive"}>{formatCurrency(transaction.amount)}</td>
              <td>{transaction.confidence ? `${Math.round(transaction.confidence * 100)}%` : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function groupTransactions(transactions: Transaction[]): TransactionAccountGroup[] {
  const accountMap = new Map<string, Transaction[]>();
  transactions.forEach((transaction) => {
    const key = transaction.account_id || transaction.account_name;
    accountMap.set(key, [...(accountMap.get(key) ?? []), transaction]);
  });

  return [...accountMap.entries()].map(([accountId, accountTransactions]) => {
    const monthMap = new Map<string, Transaction[]>();
    accountTransactions.forEach((transaction) => {
      const monthKey = transaction.transaction_date.slice(0, 7);
      monthMap.set(monthKey, [...(monthMap.get(monthKey) ?? []), transaction]);
    });
    const months = [...monthMap.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, monthTransactions]) => ({
        key,
        label: formatMonth(key),
        transactions: monthTransactions.sort((a, b) => b.transaction_date.localeCompare(a.transaction_date))
      }));
    return {
      accountId,
      accountName: accountTransactions[0]?.account_name ?? "Account",
      months,
      transactions: accountTransactions
    };
  });
}

function formatMonth(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, monthIndex - 1, 1)));
}

function isSpendingTransaction(transaction: Transaction) {
  return transaction.amount < 0 && !transaction.is_excluded_from_spending && !["Income", "Payment", "Transfer"].includes(transaction.category ?? "");
}
