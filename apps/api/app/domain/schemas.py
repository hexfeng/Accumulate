from datetime import date
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class Account(BaseModel):
    id: str
    user_id: str
    name: str
    type: str
    balance: float
    currency: str = "CAD"
    source: str = "manual"
    last_synced_at: str | None = None


class CsvTransactionRow(BaseModel):
    account_name: str
    account_type: str
    transaction_date: str
    description: str
    amount: str | float
    currency: str = "CAD"


class Transaction(BaseModel):
    id: str
    user_id: str
    account_id: str
    account_name: str
    account_type: str
    transaction_date: date
    amount: float
    currency: str
    merchant_raw: str
    description_raw: str
    source: str = "manual"
    external_id: str | None = None
    merchant_normalized: str | None = None
    category: str | None = None
    subcategory: str | None = None
    transaction_type: str | None = None
    is_excluded_from_spending: bool = False
    is_recurring: bool = False
    confidence: float | None = None
    duplicate_hash: str | None = None


class CategoryRule(BaseModel):
    id: str
    pattern: str
    merchant: str
    category: str
    user_id: str | None = None
    subcategory: str | None = None
    priority: int = 100


class BudgetSettings(BaseModel):
    monthly_budget: float = 3000.0
    category_budgets: dict[str, float] = Field(default_factory=dict)
    forecast_assumptions: dict[str, Any] = Field(default_factory=dict)


class CategorySummary(BaseModel):
    category: str
    amount: float
    transaction_count: int
    budget: float | None = None
    budget_used_pct: float | None = None


class MerchantSummary(BaseModel):
    merchant: str
    amount: float
    transaction_count: int


class MonthlySummary(BaseModel):
    month: str
    total_income: float
    total_spending: float
    net_cashflow: float
    monthly_budget: float
    budget_used_pct: float
    categories: list[CategorySummary]
    merchants: list[MerchantSummary]


class RecurringItem(BaseModel):
    merchant: str
    cadence: str
    monthly_amount: float
    annualized_amount: float
    next_payment_date: date
    confidence: float


class CashflowForecastPoint(BaseModel):
    horizon_days: int
    projected_cash_balance: float
    projected_income: float
    projected_spending: float
    risk_level: str


class CashflowForecast(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    as_of: date
    points: list[CashflowForecastPoint]
    assumptions: dict[str, Any]


class NetWorthHistoryPoint(BaseModel):
    date: date
    value: float


class NetWorthHistory(BaseModel):
    range: str
    current_value: float
    change_amount: float
    change_pct: float
    points: list[NetWorthHistoryPoint]


class DashboardSnapshot(BaseModel):
    accounts: list[Account]
    monthly_summary: MonthlySummary
    recurring_items: list[RecurringItem]
    forecast: CashflowForecast
