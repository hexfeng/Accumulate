from datetime import date

from app.domain.schemas import Account, CashflowForecast, CashflowForecastPoint, Transaction


def _money(value: float) -> float:
    return round(value + 0.0000001, 2)


def _risk(balance: float) -> str:
    if balance < 0:
        return "high"
    if balance < 500:
        return "medium"
    return "low"


def build_cashflow_forecast(accounts: list[Account], transactions: list[Transaction], as_of: date | None = None) -> CashflowForecast:
    as_of = as_of or date.today()
    cash_balance = sum(account.balance for account in accounts if account.type in {"checking", "savings", "cash"})
    credit_card_balance = sum(abs(account.balance) for account in accounts if account.type == "credit_card" and account.balance < 0)

    monthly_income = sum(txn.amount for txn in transactions if txn.amount > 0 and txn.category == "Income")
    monthly_spending = sum(
        abs(txn.amount)
        for txn in transactions
        if txn.amount < 0 and not txn.is_excluded_from_spending and txn.category not in {"Income", "Transfer"}
    )

    points: list[CashflowForecastPoint] = []
    for horizon in (30, 60, 90):
        months = horizon // 30
        projected_income = monthly_income * months
        projected_spending = monthly_spending * months + credit_card_balance
        projected_balance = _money(cash_balance + projected_income - projected_spending)
        points.append(
            CashflowForecastPoint(
                horizon_days=horizon,
                projected_cash_balance=projected_balance,
                projected_income=_money(projected_income),
                projected_spending=_money(projected_spending),
                risk_level=_risk(projected_balance),
            )
        )

    return CashflowForecast(
        as_of=as_of,
        points=points,
        assumptions={
            "income_model": "last-observed-month",
            "spending_model": "last-observed-month",
            "credit_card_payment": "next-30-days",
        },
    )
