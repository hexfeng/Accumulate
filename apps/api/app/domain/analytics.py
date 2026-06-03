from collections import defaultdict
from datetime import date

from app.domain.schemas import BudgetSettings, CategorySummary, MerchantSummary, MonthlySummary, Transaction


def _money(value: float) -> float:
    return round(value + 0.0000001, 2)


def build_monthly_summary(transactions: list[Transaction], budget: BudgetSettings, month: date | None = None) -> MonthlySummary:
    if month is None:
        month = max((txn.transaction_date for txn in transactions), default=date.today()).replace(day=1)

    month_transactions = [
        txn for txn in transactions if txn.transaction_date.year == month.year and txn.transaction_date.month == month.month
    ]
    total_income = _money(sum(txn.amount for txn in month_transactions if txn.amount > 0 and txn.category == "Income"))
    spend_transactions = [
        txn
        for txn in month_transactions
        if txn.amount < 0 and not txn.is_excluded_from_spending and txn.category not in {"Transfer", "Income"}
    ]
    total_spending = _money(sum(abs(txn.amount) for txn in spend_transactions))

    category_amounts: dict[str, float] = defaultdict(float)
    category_counts: dict[str, int] = defaultdict(int)
    merchant_amounts: dict[str, float] = defaultdict(float)
    merchant_counts: dict[str, int] = defaultdict(int)

    for txn in spend_transactions:
        category = txn.category or "Uncategorized"
        merchant = txn.merchant_normalized or txn.merchant_raw
        category_amounts[category] += abs(txn.amount)
        category_counts[category] += 1
        merchant_amounts[merchant] += abs(txn.amount)
        merchant_counts[merchant] += 1

    categories = [
        CategorySummary(
            category=category,
            amount=_money(amount),
            transaction_count=category_counts[category],
            budget=budget.category_budgets.get(category),
            budget_used_pct=_money(amount / budget.category_budgets[category] * 100)
            if budget.category_budgets.get(category)
            else None,
        )
        for category, amount in sorted(category_amounts.items(), key=lambda item: item[1], reverse=True)
    ]
    merchants = [
        MerchantSummary(merchant=merchant, amount=_money(amount), transaction_count=merchant_counts[merchant])
        for merchant, amount in sorted(merchant_amounts.items(), key=lambda item: item[1], reverse=True)
    ]

    return MonthlySummary(
        month=month.strftime("%Y-%m"),
        total_income=total_income,
        total_spending=total_spending,
        net_cashflow=_money(total_income - total_spending),
        monthly_budget=budget.monthly_budget,
        budget_used_pct=_money(total_spending / budget.monthly_budget * 100) if budget.monthly_budget else 0,
        categories=categories,
        merchants=merchants,
    )

