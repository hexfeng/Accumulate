import { demoDashboard, demoHoldings, demoNetWorthHistoryByRange, demoPortfolio, demoSettings, demoTransactions } from "./demo-data";
import type { Account, AccountDeleteResponse, AccountInput, BudgetSettings, CashflowForecast, DashboardSnapshot, Holding, HoldingDeleteResponse, HoldingInput, MonthlySummary, NetWorthHistory, NetWorthRange, PortfolioSnapshot, SimpleFinActionResponse, SimpleFinStatus, Transaction } from "./types";

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

export function getAccounts(): Promise<Account[]> {
  return getJson("/api/accounts", demoDashboard.accounts);
}

export function getCashflowForecast(): Promise<CashflowForecast> {
  return getJson("/api/analytics/cashflow-forecast", demoDashboard.forecast);
}

export function getSimpleFinStatus(): Promise<SimpleFinStatus> {
  return getJson("/api/integrations/simplefin/status", {
    provider: "simplefin",
    status: "unconfigured",
    mode: "real",
    message: "Add a SimpleFIN setup token to create a local connection.",
    has_credentials: false,
    retry_count: 0
  });
}

export function getNetWorthHistory(range: NetWorthRange = "1M"): Promise<NetWorthHistory> {
  return getJson(`/api/net-worth/history?range=${range}`, demoNetWorthHistoryByRange[range]);
}

export function getTransactions(): Promise<Transaction[]> {
  return getJson("/api/transactions", demoTransactions);
}

export function getMonthlySpending(month?: string): Promise<MonthlySummary> {
  const path = month ? `/api/analytics/monthly-spending?month=${encodeURIComponent(month)}` : "/api/analytics/monthly-spending";
  return getJson(path, month ? { ...demoDashboard.monthly_summary, month } : demoDashboard.monthly_summary);
}

export function getSettings(): Promise<BudgetSettings> {
  return getJson("/api/settings", demoSettings);
}

export function getHoldings(): Promise<Holding[]> {
  return getJson("/api/holdings", demoHoldings);
}

export function getPortfolio(): Promise<PortfolioSnapshot> {
  return getJson("/api/portfolio", demoPortfolio);
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

export async function createAccount(input: AccountInput): Promise<Account> {
  return sendJson<Account>("/api/accounts", "POST", input);
}

export async function updateAccount(accountId: string, input: AccountInput): Promise<Account> {
  return sendJson<Account>(`/api/accounts/${accountId}`, "PATCH", input);
}

export async function deleteAccount(accountId: string): Promise<AccountDeleteResponse> {
  return sendJson<AccountDeleteResponse>(`/api/accounts/${accountId}`, "DELETE");
}

export async function createHolding(input: HoldingInput): Promise<Holding> {
  return sendJson<Holding>("/api/holdings", "POST", input);
}

export async function updateHolding(holdingId: string, input: HoldingInput): Promise<Holding> {
  return sendJson<Holding>(`/api/holdings/${holdingId}`, "PATCH", input);
}

export async function deleteHolding(holdingId: string): Promise<HoldingDeleteResponse> {
  return sendJson<HoldingDeleteResponse>(`/api/holdings/${holdingId}`, "DELETE");
}

export async function updateSettings(settings: BudgetSettings): Promise<BudgetSettings> {
  return sendJson<BudgetSettings>("/api/settings", "PUT", settings);
}

export async function connectSimpleFin(setupToken?: string): Promise<SimpleFinActionResponse> {
  return sendJson<SimpleFinActionResponse>(
    "/api/integrations/simplefin/connect",
    "POST",
    setupToken ? { setup_token: setupToken } : undefined
  );
}

export async function syncSimpleFin(): Promise<SimpleFinActionResponse> {
  return sendJson<SimpleFinActionResponse>("/api/integrations/simplefin/sync", "POST");
}

export async function disconnectSimpleFin(): Promise<SimpleFinActionResponse> {
  return sendJson<SimpleFinActionResponse>("/api/integrations/simplefin/disconnect", "DELETE");
}

async function sendJson<T>(path: string, method: "POST" | "PATCH" | "PUT" | "DELETE", body?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const data = await response.json();
      if (typeof data.detail === "string") {
        message = data.detail;
      }
    } catch {
      // Keep the status-based message when the API does not return JSON.
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}
