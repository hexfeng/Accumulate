import type { DashboardSnapshot, NetWorthHistory, NetWorthRange, Transaction } from "./types";

export const demoDashboard: DashboardSnapshot = {
  accounts: [
    { id: "cibc-chequing", user_id: "local-user", name: "CIBC Chequing", type: "checking", balance: 4200, currency: "CAD", source: "mock_simplefin" },
    { id: "eq-savings", user_id: "local-user", name: "EQ Savings", type: "savings", balance: 11200, currency: "CAD", source: "manual" },
    { id: "cibc-visa", user_id: "local-user", name: "CIBC Visa", type: "credit_card", balance: -860, currency: "CAD", source: "mock_simplefin" }
  ],
  monthly_summary: {
    month: "2026-05",
    total_income: 5200,
    total_spending: 1248.26,
    net_cashflow: 3951.74,
    monthly_budget: 3000,
    budget_used_pct: 41.61,
    categories: [
      { category: "Groceries", amount: 526.42, transaction_count: 3, budget: 650, budget_used_pct: 80.99 },
      { category: "Dining", amount: 405.85, transaction_count: 8, budget: 500, budget_used_pct: 81.17 },
      { category: "Subscriptions", amount: 75.98, transaction_count: 4, budget: 150, budget_used_pct: 50.65 },
      { category: "Transport", amount: 239.99, transaction_count: 5, budget: 350, budget_used_pct: 68.57 }
    ],
    merchants: [
      { merchant: "Loblaws", amount: 326.42, transaction_count: 2 },
      { merchant: "Uber Eats", amount: 148.10, transaction_count: 3 },
      { merchant: "Netflix", amount: 18.99, transaction_count: 1 }
    ]
  },
  recurring_items: [
    { merchant: "Netflix", cadence: "monthly", monthly_amount: 18.99, annualized_amount: 227.88, next_payment_date: "2026-06-15", confidence: 0.86 },
    { merchant: "Spotify", cadence: "monthly", monthly_amount: 11.99, annualized_amount: 143.88, next_payment_date: "2026-06-22", confidence: 0.81 }
  ],
  forecast: {
    as_of: "2026-06-02",
    points: [
      { horizon_days: 30, projected_cash_balance: 17640, projected_income: 5200, projected_spending: 1760, risk_level: "low" },
      { horizon_days: 60, projected_cash_balance: 21080, projected_income: 10400, projected_spending: 3520, risk_level: "low" },
      { horizon_days: 90, projected_cash_balance: 24520, projected_income: 15600, projected_spending: 5280, risk_level: "low" }
    ],
    assumptions: {
      income_model: "last-observed-month",
      spending_model: "last-observed-month"
    }
  }
};

export const demoTransactions: Transaction[] = [
  { id: "txn-1", user_id: "local-user", account_id: "cibc-visa", account_name: "CIBC Visa", account_type: "credit_card", transaction_date: "2026-05-22", amount: -48.1, currency: "CAD", merchant_raw: "UBER EATS TORONTO", description_raw: "UBER EATS TORONTO", source: "csv", merchant_normalized: "Uber Eats", category: "Dining", is_excluded_from_spending: false, confidence: 0.95 },
  { id: "txn-2", user_id: "local-user", account_id: "cibc-visa", account_name: "CIBC Visa", account_type: "credit_card", transaction_date: "2026-05-15", amount: -18.99, currency: "CAD", merchant_raw: "NETFLIX.COM", description_raw: "NETFLIX.COM", source: "mock_simplefin", merchant_normalized: "Netflix", category: "Subscriptions", is_excluded_from_spending: false, confidence: 0.86 },
  { id: "txn-3", user_id: "local-user", account_id: "cibc-chequing", account_name: "CIBC Chequing", account_type: "checking", transaction_date: "2026-05-01", amount: 5200, currency: "CAD", merchant_raw: "PAYROLL ACME CANADA", description_raw: "PAYROLL ACME CANADA", source: "mock_simplefin", merchant_normalized: "Payroll", category: "Income", is_excluded_from_spending: false, confidence: 0.75 }
];

const NET_WORTH_RANGES: NetWorthRange[] = ["1D", "1W", "1M", "3M", "6M", "YTD", "1Y", "ALL"];
const RANGE_POINT_COUNTS: Record<NetWorthRange, number> = {
  "1D": 8,
  "1W": 7,
  "1M": 30,
  "3M": 90,
  "6M": 120,
  "YTD": 120,
  "1Y": 180,
  "ALL": 240
};
const RANGE_CHANGE: Record<NetWorthRange, number> = {
  "1D": 42.3,
  "1W": 264.86,
  "1M": 6017.85,
  "3M": 6834.2,
  "6M": 8028.72,
  "YTD": 8756.92,
  "1Y": 9418.51,
  "ALL": 10960.44
};

function money(value: number): number {
  return Math.round(value * 100) / 100;
}

function buildDemoNetWorthHistory(range: NetWorthRange): NetWorthHistory {
  const currentValue = 14540;
  const pointCount = RANGE_POINT_COUNTS[range];
  const changeAmount = RANGE_CHANGE[range];
  const startValue = currentValue - changeAmount;
  const asOf = new Date("2026-06-03T12:00:00-04:00");
  const points = Array.from({ length: pointCount }, (_, index) => {
    const progress = index / Math.max(pointCount - 1, 1);
    const trend = startValue + (changeAmount * progress);
    const wave = Math.sin(progress * Math.PI * 4) * 180 + Math.sin(progress * Math.PI * 9) * 68;
    const pointDate = new Date(asOf);
    pointDate.setDate(asOf.getDate() - (pointCount - 1 - index));

    return {
      date: pointDate.toISOString().slice(0, 10),
      value: money(trend + wave)
    };
  });

  points[points.length - 1] = { date: "2026-06-03", value: currentValue };

  return {
    range,
    current_value: currentValue,
    change_amount: money(currentValue - points[0].value),
    change_pct: money(((currentValue - points[0].value) / points[0].value) * 100),
    points
  };
}

export const demoNetWorthHistoryByRange = Object.fromEntries(
  NET_WORTH_RANGES.map((range) => [range, buildDemoNetWorthHistory(range)])
) as Record<NetWorthRange, NetWorthHistory>;
