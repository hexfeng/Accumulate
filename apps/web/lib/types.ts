export type AccountType = "checking" | "savings" | "cash" | "credit_card" | "investment" | "loan" | "other";

export type AccountInput = {
  name: string;
  type: AccountType;
  balance: number;
  currency: string;
};

export type AccountDeleteResponse = {
  deleted_account_id: string;
};

export type SimpleFinStatus = {
  provider: string;
  status: string;
  mode: string;
  message: string;
};

export type SimpleFinActionResponse = {
  status: string;
  provider: string;
  mode?: string;
};

export type Account = {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  balance: number;
  currency: string;
  source: string;
  last_synced_at?: string | null;
};

export type CategorySummary = {
  category: string;
  amount: number;
  transaction_count: number;
  budget?: number | null;
  budget_used_pct?: number | null;
};

export type MerchantSummary = {
  merchant: string;
  amount: number;
  transaction_count: number;
};

export type MonthlySummary = {
  month: string;
  total_income: number;
  total_spending: number;
  net_cashflow: number;
  monthly_budget: number;
  budget_used_pct: number;
  categories: CategorySummary[];
  merchants: MerchantSummary[];
};

export type RecurringItem = {
  merchant: string;
  cadence: string;
  monthly_amount: number;
  annualized_amount: number;
  next_payment_date: string;
  confidence: number;
};

export type CashflowForecastPoint = {
  horizon_days: number;
  projected_cash_balance: number;
  projected_income: number;
  projected_spending: number;
  risk_level: string;
};

export type CashflowForecast = {
  as_of: string;
  points: CashflowForecastPoint[];
  assumptions: Record<string, unknown>;
};

export type AssetAllocationItem = {
  label: string;
  percent: number;
  tone: "stocks" | "etf" | "cash";
  is_mock?: boolean;
};

export type NetWorthRange = "1D" | "1W" | "1M" | "3M" | "6M" | "YTD" | "1Y" | "ALL";

export type NetWorthHistoryPoint = {
  date: string;
  value: number;
};

export type NetWorthHistory = {
  range: NetWorthRange;
  current_value: number;
  change_amount: number;
  change_pct: number;
  points: NetWorthHistoryPoint[];
};

export type DashboardSnapshot = {
  accounts: Account[];
  asset_allocation?: AssetAllocationItem[];
  monthly_summary: MonthlySummary;
  recurring_items: RecurringItem[];
  forecast: CashflowForecast;
};

export type Transaction = {
  id: string;
  user_id: string;
  account_id: string;
  account_name: string;
  account_type: string;
  transaction_date: string;
  amount: number;
  currency: string;
  merchant_raw: string;
  description_raw: string;
  source: string;
  merchant_normalized?: string | null;
  category?: string | null;
  is_excluded_from_spending: boolean;
  confidence?: number | null;
};
