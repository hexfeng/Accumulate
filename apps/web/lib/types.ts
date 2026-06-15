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

export type BudgetSettings = {
  monthly_budget: number;
  category_budgets: Record<string, number>;
  forecast_assumptions: Record<string, unknown>;
};

export type SimpleFinStatus = {
  provider: string;
  status: string;
  mode: string;
  message: string;
  has_credentials?: boolean;
  last_synced_at?: string | null;
  backfill_completed_at?: string | null;
  transaction_coverage_start?: string | null;
  transaction_coverage_end?: string | null;
  last_error?: string | null;
  retry_count?: number;
  next_retry_at?: string | null;
};

export type SimpleFinActionResponse = {
  status: string;
  provider: string;
  mode?: string;
  message?: string;
  has_credentials?: boolean;
  last_synced_at?: string | null;
  backfill_completed_at?: string | null;
  transaction_coverage_start?: string | null;
  transaction_coverage_end?: string | null;
  last_error?: string | null;
  retry_count?: number;
  next_retry_at?: string | null;
};

export type Account = {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  balance: number;
  currency: string;
  institution_name?: string | null;
  source: string;
  last_synced_at?: string | null;
};

export type StatementImportRow = {
  account_name: string;
  account_type: string;
  transaction_date: string;
  description: string;
  amount: string | number;
  currency: string;
};

export type StatementImportResponse = {
  account: Account;
  created_transactions: number;
  preview_rows: StatementImportRow[];
  message: string;
};

export type HoldingInput = {
  account_id: string;
  symbol: string;
  name: string;
  quantity: number;
  average_cost: number;
  market_price?: number;
  currency: string;
};

export type Holding = HoldingInput & {
  id: string;
  user_id: string;
  account_name: string;
  source: string;
  market_price: number;
};

export type MarketQuote = {
  symbol: string;
  name: string;
  price: number;
  currency: string;
  provider: string;
  as_of: string;
};

export type SecuritySearchResult = {
  symbol: string;
  name: string;
  quote_type: string;
  exchange?: string | null;
  currency: string;
  price?: number | null;
  provider: string;
  as_of?: string | null;
};

export type QuoteRefreshResponse = {
  refreshed_count: number;
  skipped_count: number;
  holdings: Holding[];
  quotes: MarketQuote[];
  message: string;
};

export type HoldingDeleteResponse = {
  deleted_holding_id: string;
};

export type PortfolioAllocationItem = {
  label: string;
  value: number;
  percent: number;
};

export type PortfolioAccountSummary = {
  account_id: string;
  account_name: string;
  value: number;
  holdings_count: number;
};

export type PortfolioSnapshot = {
  total_value: number;
  total_cost: number;
  unrealized_gain: number;
  unrealized_gain_pct: number;
  allocation: PortfolioAllocationItem[];
  accounts: PortfolioAccountSummary[];
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
  value?: number;
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
  coverage_start?: string | null;
  coverage_end?: string | null;
  is_estimated?: boolean;
};

export type DashboardSnapshot = {
  accounts: Account[];
  asset_allocation?: AssetAllocationItem[];
  investment_summary?: PortfolioSnapshot | null;
  net_worth_total?: number;
  net_worth_uses_manual_holdings?: boolean;
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
  transaction_type?: string | null;
  is_excluded_from_spending: boolean;
  confidence?: number | null;
};
