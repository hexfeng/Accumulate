from app.domain.schemas import CategoryRule, Transaction


DEFAULT_RULES: list[CategoryRule] = [
    CategoryRule(id="global_grocery", pattern="loblaws|metro|costco|walmart", merchant="Grocery", category="Groceries", priority=20),
    CategoryRule(id="global_coffee", pattern="starbucks|tim hortons", merchant="Coffee", category="Dining", priority=30),
    CategoryRule(id="global_uber_eats", pattern="uber eats", merchant="Uber Eats Toronto", category="Dining", priority=22),
    CategoryRule(id="global_netflix", pattern="netflix", merchant="Netflix", category="Subscriptions", priority=25),
    CategoryRule(id="global_spotify", pattern="spotify", merchant="Spotify", category="Subscriptions", priority=26),
    CategoryRule(id="global_subscription", pattern="prime|disney", merchant="Subscription", category="Subscriptions", priority=30),
    CategoryRule(id="global_income", pattern="payroll|salary|deposit", merchant="Payroll", category="Income", priority=10),
    CategoryRule(id="global_payment", pattern="payment received|bill pay|amex-co|card products|to amex|rogersbank", merchant="Credit card payment", category="Payment", priority=12),
    CategoryRule(id="global_transfer", pattern="transfer|e-transfer|preauthorized debit|withdrawal", merchant="Transfer", category="Transfer", priority=15),
]


def _matches(pattern: str, text: str) -> bool:
    return any(part.strip().lower() in text for part in pattern.split("|") if part.strip())


def categorize_transaction(transaction: Transaction, rules: list[CategoryRule] | None = None) -> Transaction:
    text = f"{transaction.merchant_raw} {transaction.description_raw}".lower()
    all_rules = sorted(rules or DEFAULT_RULES, key=lambda rule: (rule.user_id is None, rule.priority))

    for rule in all_rules:
        if rule.user_id is not None and rule.user_id != transaction.user_id:
            continue
        if _matches(rule.pattern, text):
            return transaction.model_copy(
                update={
                    "merchant_normalized": rule.merchant,
                    "category": rule.category,
                    "subcategory": rule.subcategory,
                    "transaction_type": "income" if rule.category == "Income" else "payment" if rule.category == "Payment" else "transfer" if rule.category == "Transfer" else "expense",
                    "is_excluded_from_spending": transaction.is_excluded_from_spending or rule.category in {"Payment", "Transfer"},
                    "confidence": 0.95 if rule.user_id else 0.75,
                }
            )

    fallback_type = "income" if transaction.amount > 0 else "expense"
    fallback_category = "Income" if transaction.amount > 0 else "Uncategorized"
    return transaction.model_copy(
        update={
            "merchant_normalized": transaction.merchant_normalized or transaction.merchant_raw.title(),
            "category": transaction.category or fallback_category,
            "transaction_type": transaction.transaction_type or fallback_type,
            "confidence": transaction.confidence or 0.4,
        }
    )
