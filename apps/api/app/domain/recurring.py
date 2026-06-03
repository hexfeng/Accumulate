from collections import defaultdict
from datetime import date

from app.domain.schemas import RecurringItem, Transaction


def _add_month(source: date) -> date:
    year = source.year + (1 if source.month == 12 else 0)
    month = 1 if source.month == 12 else source.month + 1
    return source.replace(year=year, month=month)


def detect_recurring_items(transactions: list[Transaction]) -> list[RecurringItem]:
    grouped: dict[str, list[Transaction]] = defaultdict(list)
    for txn in transactions:
        if txn.amount < 0 and not txn.is_excluded_from_spending:
            grouped[txn.merchant_normalized or txn.merchant_raw].append(txn)

    recurring: list[RecurringItem] = []
    for merchant, merchant_transactions in grouped.items():
        if len(merchant_transactions) < 3:
            continue
        sorted_txns = sorted(merchant_transactions, key=lambda txn: txn.transaction_date)
        amounts = [abs(txn.amount) for txn in sorted_txns]
        amount_range = max(amounts) - min(amounts)
        intervals = [
            (next_txn.transaction_date - current.transaction_date).days
            for current, next_txn in zip(sorted_txns, sorted_txns[1:])
        ]
        monthly_like = intervals and all(25 <= interval <= 35 for interval in intervals)
        stable_amount = amount_range <= 2.0
        if monthly_like and stable_amount:
            monthly_amount = round(sum(amounts) / len(amounts), 2)
            recurring.append(
                RecurringItem(
                    merchant=merchant,
                    cadence="monthly",
                    monthly_amount=monthly_amount,
                    annualized_amount=round(monthly_amount * 12, 2),
                    next_payment_date=_add_month(sorted_txns[-1].transaction_date),
                    confidence=0.86,
                )
            )

    return sorted(recurring, key=lambda item: item.monthly_amount, reverse=True)

