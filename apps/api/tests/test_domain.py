from datetime import date

from app.domain.analytics import build_monthly_summary
from app.domain.categorization import categorize_transaction
from app.domain.forecast import build_cashflow_forecast
from app.domain.holdings_aware_net_worth import build_holdings_aware_net_worth
from app.domain.net_worth import build_net_worth_history
from app.domain.normalization import normalize_csv_transaction
from app.domain.recurring import detect_recurring_items
from app.domain.schemas import Account, AccountBalanceSnapshot, BudgetSettings, CategoryRule, CsvTransactionRow, Holding, Transaction
from app.domain.transaction_classification import normalize_internal_flows


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


def test_user_category_rule_ignores_numbers_possessives_and_locations_for_merchant_variants():
    rule = CategoryRule(
        id="user_robs_nf",
        user_id=USER_ID,
        pattern="rob's nf #7076 unionville on",
        merchant="Rob's NF",
        category="Groceries",
        priority=1,
    )
    transaction = Transaction(
        id="txn_robs_nf_variant",
        user_id=USER_ID,
        account_id="acct_1",
        account_name="CIBC Visa",
        account_type="credit_card",
        transaction_date=date(2026, 6, 12),
        amount=-36.50,
        currency="CAD",
        merchant_raw="ROB'S NF #1234 TORONTO",
        description_raw="ROB'S NF #1234 TORONTO",
    )

    categorized = categorize_transaction(transaction, [rule])

    assert categorized.category == "Groceries"
    assert categorized.merchant_normalized == "Rob's NF"


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


def test_internal_transfer_pairs_are_excluded_from_income_and_spending():
    transactions = [
        Transaction(
            id="cibc-out",
            user_id=USER_ID,
            account_id="cibc",
            account_name="CIBC Chequing",
            account_type="checking",
            transaction_date=date(2026, 6, 5),
            amount=-2000,
            currency="CAD",
            merchant_raw="PREAUTHORIZED DEBIT Wealthsimple Investments Inc.",
            description_raw="PREAUTHORIZED DEBIT Wealthsimple Investments Inc.",
        ),
        Transaction(
            id="rrsp-in",
            user_id=USER_ID,
            account_id="rrsp",
            account_name="Self Directed RRSP",
            account_type="investment",
            transaction_date=date(2026, 6, 5),
            amount=2000,
            currency="CAD",
            merchant_raw="Deposit",
            description_raw="Deposit",
        ),
    ]

    normalized = normalize_internal_flows(transactions)
    summary = build_monthly_summary(normalized, BudgetSettings(monthly_budget=3000), date(2026, 6, 1))

    assert {transaction.category for transaction in normalized} == {"Transfer"}
    assert all(transaction.is_excluded_from_spending for transaction in normalized)
    assert summary.total_income == 0
    assert summary.total_spending == 0


def test_credit_card_inflows_are_payments_and_matching_outflows_are_excluded():
    transactions = [
        Transaction(
            id="cash-out",
            user_id=USER_ID,
            account_id="cash",
            account_name="Wealthsimple Cash",
            account_type="cash",
            transaction_date=date(2026, 6, 5),
            amount=-300,
            currency="CAD",
            merchant_raw="AMEX-CO",
            description_raw="AMEX-CO",
        ),
        Transaction(
            id="amex-in",
            user_id=USER_ID,
            account_id="amex",
            account_name="American Express Cobalt Card",
            account_type="credit_card",
            transaction_date=date(2026, 6, 8),
            amount=300,
            currency="CAD",
            merchant_raw="PAYMENT RECEIVED - THANK YOU",
            description_raw="PAYMENT RECEIVED - THANK YOU",
        ),
    ]

    normalized = normalize_internal_flows(transactions)
    summary = build_monthly_summary(normalized, BudgetSettings(monthly_budget=3000), date(2026, 6, 1))

    assert {transaction.category for transaction in normalized} == {"Payment"}
    assert all(transaction.transaction_type == "payment" for transaction in normalized)
    assert all(transaction.is_excluded_from_spending for transaction in normalized)
    assert summary.total_income == 0
    assert summary.total_spending == 0


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


def test_net_worth_history_uses_balance_snapshots_when_available():
    accounts = [
        Account(id="checking", user_id=USER_ID, name="CIBC Chequing", type="checking", balance=4200, currency="CAD"),
        Account(id="visa", user_id=USER_ID, name="CIBC Visa", type="credit_card", balance=-700, currency="CAD"),
    ]
    snapshots = [
        AccountBalanceSnapshot(
            account_id="checking",
            account_name="CIBC Chequing",
            snapshot_date=date(2026, 6, 1),
            balance=3000,
            currency="CAD",
            captured_at="2026-06-01T12:00:00+00:00",
        ),
        AccountBalanceSnapshot(
            account_id="visa",
            account_name="CIBC Visa",
            snapshot_date=date(2026, 6, 1),
            balance=-500,
            currency="CAD",
            captured_at="2026-06-01T12:00:00+00:00",
        ),
        AccountBalanceSnapshot(
            account_id="checking",
            account_name="CIBC Chequing",
            snapshot_date=date(2026, 6, 11),
            balance=4200,
            currency="CAD",
            captured_at="2026-06-11T12:00:00+00:00",
        ),
        AccountBalanceSnapshot(
            account_id="visa",
            account_name="CIBC Visa",
            snapshot_date=date(2026, 6, 11),
            balance=-700,
            currency="CAD",
            captured_at="2026-06-11T12:00:00+00:00",
        ),
    ]

    history = build_net_worth_history(accounts, "1M", snapshots=snapshots, as_of=date(2026, 6, 11))

    assert history.current_value == 3500
    assert [(point.date, point.value) for point in history.points] == [
        (date(2026, 6, 1), 2500),
        (date(2026, 6, 11), 3500),
    ]
    assert history.change_amount == 1000
    assert history.coverage_start == date(2026, 6, 1)
    assert history.coverage_end == date(2026, 6, 11)
    assert history.is_estimated is False


def test_net_worth_history_estimates_from_transactions_when_only_current_snapshot_exists():
    accounts = [
        Account(id="checking", user_id=USER_ID, name="BMO Chequing", type="checking", balance=2000, currency="CAD"),
        Account(id="visa", user_id=USER_ID, name="Wealthsimple Visa", type="credit_card", balance=-250, currency="CAD"),
    ]
    snapshots = [
        AccountBalanceSnapshot(
            account_id="checking",
            account_name="BMO Chequing",
            snapshot_date=date(2026, 6, 11),
            balance=2000,
            currency="CAD",
            captured_at="2026-06-11T12:00:00+00:00",
        ),
        AccountBalanceSnapshot(
            account_id="visa",
            account_name="Wealthsimple Visa",
            snapshot_date=date(2026, 6, 11),
            balance=-250,
            currency="CAD",
            captured_at="2026-06-11T12:00:00+00:00",
        ),
    ]
    transactions = [
        Transaction(
            id="payroll",
            user_id=USER_ID,
            account_id="checking",
            account_name="BMO Chequing",
            account_type="checking",
            transaction_date=date(2026, 6, 3),
            amount=1200,
            currency="CAD",
            merchant_raw="PAYROLL",
            description_raw="PAYROLL",
            category="Income",
        ),
        Transaction(
            id="grocery",
            user_id=USER_ID,
            account_id="visa",
            account_name="Wealthsimple Visa",
            account_type="credit_card",
            transaction_date=date(2026, 6, 8),
            amount=-150,
            currency="CAD",
            merchant_raw="GROCERY",
            description_raw="GROCERY",
            category="Groceries",
        ),
    ]

    history = build_net_worth_history(
        accounts,
        "1M",
        snapshots=snapshots,
        transactions=transactions,
        as_of=date(2026, 6, 11),
    )

    assert history.current_value == 1750
    assert len(history.points) > 1
    assert history.points[0].date == date(2026, 6, 2)
    assert history.points[0].value == 700
    assert history.points[-1].date == date(2026, 6, 11)
    assert history.points[-1].value == 1750
    assert history.coverage_start == date(2026, 6, 2)
    assert history.coverage_end == date(2026, 6, 11)
    assert history.is_estimated is True


def test_net_worth_history_estimates_from_transactions_when_snapshots_do_not_cover_range_start():
    accounts = [
        Account(id="checking", user_id=USER_ID, name="BMO Chequing", type="checking", balance=2000, currency="CAD"),
        Account(id="visa", user_id=USER_ID, name="Wealthsimple Visa", type="credit_card", balance=-250, currency="CAD"),
    ]
    snapshots = [
        AccountBalanceSnapshot(
            account_id="checking",
            account_name="BMO Chequing",
            snapshot_date=date(2026, 6, 12),
            balance=1900,
            currency="CAD",
            captured_at="2026-06-12T12:00:00+00:00",
        ),
        AccountBalanceSnapshot(
            account_id="visa",
            account_name="Wealthsimple Visa",
            snapshot_date=date(2026, 6, 12),
            balance=-200,
            currency="CAD",
            captured_at="2026-06-12T12:00:00+00:00",
        ),
        AccountBalanceSnapshot(
            account_id="checking",
            account_name="BMO Chequing",
            snapshot_date=date(2026, 6, 16),
            balance=2000,
            currency="CAD",
            captured_at="2026-06-16T12:00:00+00:00",
        ),
        AccountBalanceSnapshot(
            account_id="visa",
            account_name="Wealthsimple Visa",
            snapshot_date=date(2026, 6, 16),
            balance=-250,
            currency="CAD",
            captured_at="2026-06-16T12:00:00+00:00",
        ),
    ]
    transactions = [
        Transaction(
            id="payroll",
            user_id=USER_ID,
            account_id="checking",
            account_name="BMO Chequing",
            account_type="checking",
            transaction_date=date(2026, 6, 3),
            amount=1200,
            currency="CAD",
            merchant_raw="PAYROLL",
            description_raw="PAYROLL",
            category="Income",
        ),
        Transaction(
            id="grocery",
            user_id=USER_ID,
            account_id="visa",
            account_name="Wealthsimple Visa",
            account_type="credit_card",
            transaction_date=date(2026, 6, 8),
            amount=-150,
            currency="CAD",
            merchant_raw="GROCERY",
            description_raw="GROCERY",
            category="Groceries",
        ),
    ]

    history = build_net_worth_history(
        accounts,
        "1M",
        snapshots=snapshots,
        transactions=transactions,
        as_of=date(2026, 6, 16),
    )

    assert history.current_value == 1750
    assert history.points[0].date == date(2026, 6, 2)
    assert history.points[-1].date == date(2026, 6, 16)
    assert history.is_estimated is True


def test_holdings_aware_net_worth_replaces_investment_balance_per_account():
    accounts = [
        Account(id="tfsa", user_id=USER_ID, name="TFSA", type="investment", balance=10000, currency="CAD"),
        Account(id="rrsp", user_id=USER_ID, name="RRSP", type="investment", balance=4000, currency="CAD"),
        Account(id="cash", user_id=USER_ID, name="Cash", type="checking", balance=2000, currency="CAD"),
        Account(id="visa", user_id=USER_ID, name="Visa", type="credit_card", balance=-500, currency="CAD"),
    ]
    holdings = [
        Holding(
            id="vfv-to",
            user_id=USER_ID,
            account_id="tfsa",
            account_name="TFSA",
            symbol="VFV.TO",
            name="Vanguard S&P 500 ETF",
            quantity=80,
            average_cost=100,
            market_price=150,
            currency="CAD",
            source="manual",
        )
    ]

    snapshot = build_holdings_aware_net_worth(accounts, holdings)

    assert snapshot.total_value == 17500
    assert snapshot.investment_value == 16000
    assert snapshot.used_manual_holdings is True
    assert snapshot.manual_holding_account_ids == ["tfsa"]
    assert [(item.label, item.value, item.percent) for item in snapshot.asset_allocation] == [
        ("Cash", 2000, 11.11),
        ("ETFs", 12000, 66.67),
        ("Investment balances", 4000, 22.22),
    ]


def test_net_worth_history_accepts_holdings_aware_current_value_override():
    accounts = [
        Account(id="tfsa", user_id=USER_ID, name="TFSA", type="investment", balance=10000, currency="CAD"),
        Account(id="cash", user_id=USER_ID, name="Cash", type="checking", balance=2000, currency="CAD"),
    ]

    history = build_net_worth_history(accounts, "1M", as_of=date(2026, 6, 15), current_value_override=14000)

    assert history.current_value == 14000
    assert history.points[-1].value == 14000
