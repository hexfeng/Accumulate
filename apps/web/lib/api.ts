import { demoDashboard, demoNetWorthHistoryByRange, demoTransactions } from "./demo-data";
import type { DashboardSnapshot, MonthlySummary, NetWorthHistory, NetWorthRange, Transaction } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

async function getJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
    if (!response.ok) {
      return fallback;
    }
    return (await response.json()) as T;
  } catch {
    return fallback;
  }
}

export function getDashboard(): Promise<DashboardSnapshot> {
  return getJson("/api/dashboard", demoDashboard);
}

export function getNetWorthHistory(range: NetWorthRange = "1M"): Promise<NetWorthHistory> {
  return getJson(`/api/net-worth/history?range=${range}`, demoNetWorthHistoryByRange[range]);
}

export function getTransactions(): Promise<Transaction[]> {
  return getJson("/api/transactions", demoTransactions);
}

export function getMonthlySpending(): Promise<MonthlySummary> {
  return getJson("/api/analytics/monthly-spending", demoDashboard.monthly_summary);
}

export async function patchTransactionCategory(transactionId: string, category: string, merchant: string): Promise<Transaction | null> {
  try {
    const response = await fetch(`${API_BASE}/api/transactions/${transactionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, merchant_normalized: merchant, create_rule: true })
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as Transaction;
  } catch {
    return null;
  }
}
