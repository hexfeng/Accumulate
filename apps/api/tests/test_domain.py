from datetime import date

from app.domain.analytics import build_monthly_summary
from app.domain.categorization import categorize_transaction
from app.domain.forecast import build_cashflow_forecast
from app.domain.net_worth import build_net_worth_history
from app.domain.normalization import normalize_csv_transaction
from app.domain.recurring import detect_recurring_items
from app.domain.schemas import Account, BudgetSettings, CategoryRule, CsvTransactionRow, Transaction


USER_ID = "local-user"


def test_csv_normalization_creates_stable_hash_and_expense_sign():
    row = CsvTransactionRow(
        account_name="CIBC Chequing",
        account_type="checking",
        transaction_date="2026-05-04",
        description="STARBUCKS STORE 0456 TORONTO",
        amount="-5.75",
        currency="CAD",
    )

    normalized = normalize_csv_transaction(row, USER_ID)

    assert normalized.user_id == USER_ID
    assert normalized.account_name == "CIBC Chequing"
    assert normalized.amount == -5.75
    assert normalized.currency == "CAD"
    assert normalized.merchant_raw == "STARBUCKS STORE 0456 TORONTO"
    assert normalized.duplicate_hash == "csv:cibc-chequing:2026-05-04:-5.75:starbucks-store-0456-toronto"


def test_user_category_rule_overrides_global_rule():
    transaction = Transaction(
        id="txn_1",
        user_id=USER_ID,
        account_id="acct_1",
        account_name="CIBC Visa",
        account_type="credit_card",
        transaction_date=date(2026, 5, 5),
        amount=-48.10,
        currency="CAD",
        merchant_raw="UBER EATS",
        description_raw="UBER EATS TORONTO",
    )
    rules = [
        CategoryRule(id="global_1", user_id=None, pattern="uber", merchant="Uber", category="Transport", priority=10),
        CategoryRule(id="user_1", user_id=USER_ID, pattern="uber eats", merchant="Uber Eats", category="Dining", priority=1),
    ]

    categorized = categorize_transaction(transaction, rules)

    assert categorized.category == "Dining"
    assert categorized.merchant_normalized == "Uber Eats"
    assert categorized.confidence == 0.95


def test_monthly_summary_excludes_income_transfers_and_excluded_transactions():
    transactions = [
        Transaction(
            id="salary",
            user_id=USER_ID,
            account_id="checking",
            account_name="CIBC Chequing",
            account_type="checking",
            transaction_date=date(2026, 5, 1),
            amount=4200,
            currency="CAD",
            merchant_raw="PAYROLL",
            description_raw="PAYROLL",
            category="Income",
        ),
        Transaction(
            id="grocery",
            user_id=USER_ID,
            account_id="visa",
            account_name="CIBC Visa",
            account_type="credit_card",
            transaction_date=date(2026, 5, 3),
            amount=-128.25,
            currency="CAD",
            merchant_raw="Loblaws",
            merchant_normalized="Loblaws",
            description_raw="Loblaws",
            category="Groceries",
        ),
        Transaction(
            id="transfer",
            user_id=USER_ID,
            account_id="checking",
            account_name="CIBC Chequing",
            account_type="checking",
            transaction_date=date(2026, 5, 4),
            amount=-900,
            currency="CAD",
            merchant_raw="TRANSFER",
            description_raw="TRANSFER TO SAVINGS",
            category="Transfer",
            is_excluded_from_spending=True,
        ),
    ]

    summary = build_monthly_summary(transactions, BudgetSettings(monthly_budget=3000, category_budgets={"Groceries": 500}))

    assert summary.total_income == 4200
    assert summary.total_spending == 128.25
    assert summary.net_cashflow == 4071.75
    assert summary.budget_used_pct == 4.28
    assert summary.categories[0].category == "Groceries"
    assert summary.categories[0].budget_used_pct == 25.65


def test_recurring_detection_finds_monthly_subscription():
    transactions = [
        Transaction(
            id=f"netflix_{month}",
            user_id=USER_ID,
            account_id="visa",
            account_name="CIBC Visa",
            account_type="credit_card",
            transaction_date=date(2026, month, 15),
            amount=-18.99,
            currency="CAD",
            merchant_raw="NETFLIX",
            merchant_normalized="Netflix",
            description_raw="NETFLIX.COM",
            category="Subscriptions",
        )
        for month in (3, 4, 5)
    ]

    recurring = detect_recurring_items(transactions)

    assert len(recurring) == 1
    assert recurring[0].merchant == "Netflix"
    assert recurring[0].cadence == "monthly"
    assert recurring[0].monthly_amount == 18.99
    assert recurring[0].next_payment_date == date(2026, 6, 15)


def test_cashflow_forecast_returns_30_60_90_day_points():
    accounts = [
        Account(id="checking", user_id=USER_ID, name="CIBC Chequing", type="checking", balance=2500, currency="CAD"),
        Account(id="visa", user_id=USER_ID, name="CIBC Visa", type="credit_card", balance=-600, currency="CAD"),
    ]
    transactions = [
        Transaction(
            id="salary",
            user_id=USER_ID,
            account_id="checking",
            account_name="CIBC Chequing",
            account_type="checking",
            transaction_date=date(2026, 5, 1),
            amount=4000,
            currency="CAD",
            merchant_raw="PAYROLL",
            description_raw="PAYROLL",
            category="Income",
        ),
        Transaction(
            id="spend",
            user_id=USER_ID,
            account_id="visa",
            account_name="CIBC Visa",
            account_type="credit_card",
            transaction_date=date(2026, 5, 2),
            amount=-1800,
            currency="CAD",
            merchant_raw="Various",
            description_raw="Various",
            category="Dining",
        ),
    ]

    forecast = build_cashflow_forecast(accounts, transactions, as_of=date(2026, 6, 1))

    assert [point.horizon_days for point in forecast.points] == [30, 60, 90]
    assert forecast.points[0].projected_cash_balance == 4100
    assert forecast.points[1].projected_cash_balance == 6300
    assert forecast.points[2].risk_level == "low"


def test_net_worth_history_uses_account_balance_sum_as_current_value():
    accounts = [
        Account(id="checking", user_id=USER_ID, name="CIBC Chequing", type="checking", balance=4200, currency="CAD"),
        Account(id="savings", user_id=USER_ID, name="EQ Savings", type="savings", balance=11200, currency="CAD"),
        Account(id="visa", user_id=USER_ID, name="CIBC Visa", type="credit_card", balance=-860, currency="CAD"),
    ]

    history = build_net_worth_history(accounts, "1M", as_of=date(2026, 6, 3))

    assert history.range == "1M"
    assert history.current_value == 14540
    assert len(history.points) > 1
    assert history.points[-1].value == history.current_value
    assert history.change_amount == round(history.current_value - history.points[0].value, 2)
