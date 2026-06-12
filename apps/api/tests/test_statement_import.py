from fastapi.testclient import TestClient

from app.domain.statement_import import parse_statement_text
from app.main import create_app
from app.store import LocalStore


ROGERS_STATEMENT_TEXT = """
Website
www.rogersbank.com
Account
Number
XXXX
XXXX
XXXX
8746
Statement
Period
Apr
21
,
2026
-
May
20
,
2026
Account
Details
Amount
Due
$311.14
New
Balance
$311.14
Transaction
Details
Trans
Date
Post
Date
Description
Amount
($)
Card
Number
XXXX
XXXX
XXXX
8746
Apr
21
Apr
22
FARAH
FOODS
WATERLOO
ON
12.41
Apr
21
Apr
22
PAYMENT,
THANK
YOU
-150.00
May
5
May
6
CashBack
/
Remises
Rebate
ON
-79.10
Interest
Rate
Chart
"""


def test_parse_rogers_statement_text_creates_credit_card_rows():
    parsed = parse_statement_text(ROGERS_STATEMENT_TEXT, filename="Rogers Red World Elite_8746_05_2026.pdf")

    assert parsed.account_name == "Rogers Red World Elite 8746"
    assert parsed.account_type == "credit_card"
    assert parsed.balance == -311.14
    assert parsed.currency == "CAD"
    assert [row.transaction_date for row in parsed.rows] == ["2026-04-21", "2026-04-21", "2026-05-05"]
    assert [row.description for row in parsed.rows] == [
        "FARAH FOODS WATERLOO ON",
        "PAYMENT, THANK YOU",
        "CashBack / Remises Rebate ON",
    ]
    assert [row.amount for row in parsed.rows] == [-12.41, 150.0, 79.1]


def test_statement_import_endpoint_persists_account_and_transactions():
    client = TestClient(create_app(store=LocalStore()))

    response = client.post(
        "/api/imports/statement",
        files={"file": ("Rogers Red World Elite_8746_05_2026.txt", ROGERS_STATEMENT_TEXT.encode("utf-8"), "text/plain")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["account"]["name"] == "Rogers Red World Elite 8746"
    assert body["account"]["source"] == "statement"
    assert body["account"]["balance"] == -311.14
    assert body["created_transactions"] == 3
    assert body["preview_rows"][0]["description"] == "FARAH FOODS WATERLOO ON"

    transactions = client.get("/api/transactions").json()
    assert len(transactions) == 3
    assert {transaction["source"] for transaction in transactions} == {"statement"}
    assert any(transaction["amount"] == -12.41 for transaction in transactions)
    assert any(transaction["amount"] == 150.0 for transaction in transactions)


APRIL_ROGERS_STATEMENT_TEXT = ROGERS_STATEMENT_TEXT.replace(
    "Apr\n21\n,\n2026\n-\nMay\n20\n,\n2026",
    "Mar\n21\n,\n2026\n-\nApr\n20\n,\n2026",
).replace(
    "$311.14",
    "$42.50",
).replace(
    "May\n5\nMay\n6\nCashBack\n/\nRemises\nRebate\nON\n-79.10",
    "Apr\n10\nApr\n11\nMETRO\nMARKET\nWATERLOO\nON\n42.50",
)


def test_statement_import_appends_historical_months_to_same_account():
    client = TestClient(create_app(store=LocalStore()))

    first = client.post(
        "/api/imports/statement",
        files={"file": ("Rogers Red World Elite_8746_04_2026.txt", APRIL_ROGERS_STATEMENT_TEXT.encode("utf-8"), "text/plain")},
    )
    second = client.post(
        "/api/imports/statement",
        files={"file": ("Rogers Red World Elite_8746_05_2026.txt", ROGERS_STATEMENT_TEXT.encode("utf-8"), "text/plain")},
    )

    assert first.status_code == 200
    assert second.status_code == 200

    accounts = client.get("/api/accounts").json()
    rogers_accounts = [account for account in accounts if account["name"] == "Rogers Red World Elite 8746"]
    assert len(rogers_accounts) == 1

    transactions = client.get("/api/transactions").json()
    rogers_transactions = [transaction for transaction in transactions if transaction["account_name"] == "Rogers Red World Elite 8746"]
    assert len(rogers_transactions) == 4
    assert {transaction["transaction_date"][:7] for transaction in rogers_transactions} == {"2026-04", "2026-05"}


def test_statement_credit_card_expenses_are_included_in_monthly_spending():
    client = TestClient(create_app(store=LocalStore()))

    response = client.post(
        "/api/imports/statement",
        files={"file": ("Rogers Red World Elite_8746_05_2026.txt", ROGERS_STATEMENT_TEXT.encode("utf-8"), "text/plain")},
    )

    assert response.status_code == 200
    summary = client.get("/api/analytics/monthly-spending?month=2026-04").json()
    assert summary["total_spending"] == 12.41
    assert summary["categories"][0]["category"] == "Uncategorized"


def test_historical_statement_import_does_not_roll_back_current_account_balance():
    client = TestClient(create_app(store=LocalStore()))

    current = client.post(
        "/api/imports/statement",
        files={"file": ("Rogers Red World Elite_8746_05_2026.txt", ROGERS_STATEMENT_TEXT.encode("utf-8"), "text/plain")},
    )
    historical = client.post(
        "/api/imports/statement",
        files={"file": ("Rogers Red World Elite_8746_04_2026.txt", APRIL_ROGERS_STATEMENT_TEXT.encode("utf-8"), "text/plain")},
    )

    assert current.status_code == 200
    assert historical.status_code == 200
    accounts = client.get("/api/accounts").json()
    rogers = next(account for account in accounts if account["name"] == "Rogers Red World Elite 8746")
    assert rogers["balance"] == -311.14
