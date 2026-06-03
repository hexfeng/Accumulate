"use client";

import { useMemo, useState } from "react";

import { patchTransactionCategory } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import type { Transaction } from "@/lib/types";

const categories = ["Dining", "Groceries", "Subscriptions", "Transport", "Income", "Transfer", "Uncategorized"];

export function TransactionsView({ initialTransactions }: { initialTransactions: Transaction[] }) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [filter, setFilter] = useState("all");

  const visibleTransactions = useMemo(
    () => transactions.filter((transaction) => filter === "all" || transaction.category === filter),
    [transactions, filter]
  );

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

      <article className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Merchant</th>
                <th>Account</th>
                <th>Category</th>
                <th className="num">Amount</th>
                <th>Confidence</th>
              </tr>
            </thead>
            <tbody>
              {visibleTransactions.map((transaction) => (
                <tr key={transaction.id}>
                  <td>{transaction.transaction_date}</td>
                  <td>
                    <strong>{transaction.merchant_normalized ?? transaction.merchant_raw}</strong>
                    <small>{transaction.source}</small>
                  </td>
                  <td>{transaction.account_name}</td>
                  <td>
                    <select className="table-select" value={transaction.category ?? "Uncategorized"} onChange={(event) => updateCategory(transaction, event.target.value)}>
                      {categories.map((category) => (
                        <option value={category} key={category}>{category}</option>
                      ))}
                    </select>
                  </td>
                  <td className={transaction.amount < 0 ? "num negative" : "num positive"}>{formatCurrency(transaction.amount)}</td>
                  <td>{transaction.confidence ? `${Math.round(transaction.confidence * 100)}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}

