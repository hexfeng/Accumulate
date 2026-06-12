"use client";

import { useMemo, useState } from "react";

import { patchTransactionCategory } from "@/lib/api";
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
              <div className="transaction-month-stack">
                {accountGroup.months.map((monthGroup) => (
                  <section className="transaction-month-section" key={monthGroup.key}>
                    <div className="transaction-month-heading">
                      <h3>{monthGroup.label}</h3>
                      <span>{monthGroup.transactions.length} entries</span>
                    </div>
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
                          {monthGroup.transactions.map((transaction) => (
                            <tr key={transaction.id}>
                              <td>{transaction.transaction_date}</td>
                              <td>
                                <strong>{transaction.merchant_normalized ?? transaction.merchant_raw}</strong>
                                <small>{transaction.source}</small>
                              </td>
                              <td>
                                <select className="table-select" value={transaction.category ?? "Uncategorized"} onChange={(event) => updateCategory(transaction, event.target.value)}>
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
                  </section>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <article className="panel">
          <p className="empty-copy">No transactions found for the selected category.</p>
        </article>
      )}
    </section>
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
