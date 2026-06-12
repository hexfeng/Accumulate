from app.domain.schemas import Transaction


TRANSFER_WINDOW_DAYS = 3


def normalize_internal_flows(transactions: list[Transaction]) -> list[Transaction]:
    """Classify matching local account movements after per-transaction rules run."""
    normalized = list(transactions)
    used: set[int] = set()

    for index, transaction in enumerate(normalized):
        if transaction.account_type == "credit_card" and transaction.amount > 0:
            normalized[index] = _mark_payment(transaction)

    for positive_index, positive in enumerate(normalized):
        if positive_index in used or positive.amount <= 0:
            continue
        if positive.account_type == "credit_card":
            negative_index = _find_matching_leg(normalized, positive_index, require_non_credit_negative=True)
            if negative_index is not None:
                normalized[negative_index] = _mark_payment(normalized[negative_index])
                used.add(negative_index)
            used.add(positive_index)
            continue

        negative_index = _find_matching_leg(normalized, positive_index, require_non_credit_negative=True)
        if negative_index is None:
            continue
        if normalized[negative_index].account_type == "credit_card":
            continue
        normalized[positive_index] = _mark_transfer(positive)
        normalized[negative_index] = _mark_transfer(normalized[negative_index])
        used.update({positive_index, negative_index})

    return normalized


def _find_matching_leg(
    transactions: list[Transaction],
    positive_index: int,
    *,
    require_non_credit_negative: bool,
) -> int | None:
    positive = transactions[positive_index]
    best_index: int | None = None
    best_gap = TRANSFER_WINDOW_DAYS + 1
    for candidate_index, candidate in enumerate(transactions):
        if candidate_index == positive_index:
            continue
        if candidate.account_id == positive.account_id:
            continue
        if candidate.amount >= 0:
            continue
        if require_non_credit_negative and candidate.account_type == "credit_card":
            continue
        if candidate.currency != positive.currency:
            continue
        if abs(abs(candidate.amount) - positive.amount) > 0.01:
            continue
        day_gap = abs((candidate.transaction_date - positive.transaction_date).days)
        if day_gap > TRANSFER_WINDOW_DAYS:
            continue
        if day_gap < best_gap:
            best_index = candidate_index
            best_gap = day_gap
    return best_index


def _mark_transfer(transaction: Transaction) -> Transaction:
    return transaction.model_copy(
        update={
            "merchant_normalized": "Internal transfer",
            "category": "Transfer",
            "transaction_type": "transfer",
            "is_excluded_from_spending": True,
            "confidence": max(transaction.confidence or 0, 0.98),
        }
    )


def _mark_payment(transaction: Transaction) -> Transaction:
    return transaction.model_copy(
        update={
            "merchant_normalized": "Credit card payment",
            "category": "Payment",
            "transaction_type": "payment",
            "is_excluded_from_spending": True,
            "confidence": max(transaction.confidence or 0, 0.98),
        }
    )
