from fastapi.testclient import TestClient

from app.main import create_app


def make_client() -> TestClient:
    return TestClient(create_app())


def test_csv_import_is_deduplicated_and_visible_in_transactions():
    client = make_client()

    payload = {
        "rows": [
            {
                "account_name": "CIBC Chequing",
                "account_type": "checking",
                "transaction_date": "2026-05-04",
                "description": "STARBUCKS STORE 0456 TORONTO",
                "amount": "-5.75",
                "currency": "CAD",
            },
            {
                "account_name": "CIBC Chequing",
                "account_type": "checking",
                "transaction_date": "2026-05-04",
                "description": "STARBUCKS STORE 0456 TORONTO",
                "amount": "-5.75",
                "currency": "CAD",
            },
        ]
    }

    response = client.post("/api/imports/csv", json=payload)

    assert response.status_code == 200
    assert response.json()["created_transactions"] == 1

    transactions = client.get("/api/transactions").json()
    assert len(transactions) == 1
    assert transactions[0]["category"] == "Dining"


def test_seed_demo_populates_dashboard_snapshot():
    client = make_client()

    seed_response = client.post("/api/seed/demo")
    dashboard = client.get("/api/dashboard").json()

    assert seed_response.status_code == 200
    assert dashboard["monthly_summary"]["total_spending"] > 0
    assert len(dashboard["recurring_items"]) >= 1
    assert [point["horizon_days"] for point in dashboard["forecast"]["points"]] == [30, 60, 90]


def test_monthly_spending_can_be_requested_for_specific_period():
    client = make_client()
    client.post("/api/seed/demo")

    may_response = client.get("/api/analytics/monthly-spending?month=2026-05")
    june_response = client.get("/api/analytics/monthly-spending?month=2026-06")

    assert may_response.status_code == 200
    assert may_response.json()["month"] == "2026-05"
    assert may_response.json()["total_income"] == 5200
    assert may_response.json()["total_spending"] > 0
    assert june_response.status_code == 200
    assert june_response.json()["month"] == "2026-06"
    assert june_response.json()["total_income"] == 0
    assert june_response.json()["total_spending"] == 0


def test_holding_crud_and_portfolio_snapshot():
    client = make_client()
    client.post(
        "/api/accounts",
        json={"name": "TFSA", "type": "investment", "balance": 0, "currency": "CAD"},
    )

    create_response = client.post(
        "/api/holdings",
        json={
            "account_id": "tfsa",
            "symbol": "VFV.TO",
            "name": "Vanguard S&P 500 ETF",
            "quantity": 10,
            "average_cost": 110,
            "market_price": 125,
            "currency": "CAD",
        },
    )

    assert create_response.status_code == 200
    created = create_response.json()
    assert created["id"] == "vfv-to"
    assert created["account_name"] == "TFSA"
    assert created["source"] == "manual"

    portfolio = client.get("/api/portfolio").json()
    assert portfolio["total_value"] == 1250
    assert portfolio["total_cost"] == 1100
    assert portfolio["unrealized_gain"] == 150
    assert portfolio["allocation"][0]["label"] == "VFV.TO"
    assert portfolio["accounts"][0]["account_name"] == "TFSA"

    update_response = client.patch(
        "/api/holdings/vfv-to",
        json={
            "account_id": "tfsa",
            "symbol": "VFV.TO",
            "name": "Vanguard S&P 500 ETF",
            "quantity": 12,
            "average_cost": 111,
            "market_price": 126,
            "currency": "CAD",
        },
    )

    assert update_response.status_code == 200
    assert update_response.json()["quantity"] == 12
    assert client.get("/api/portfolio").json()["total_value"] == 1512

    delete_response = client.delete("/api/holdings/vfv-to")

    assert delete_response.status_code == 200
    assert delete_response.json() == {"deleted_holding_id": "vfv-to"}
    assert client.get("/api/holdings").json() == []


def test_transaction_category_patch_creates_user_rule_for_future_matches():
    client = make_client()
    client.post(
        "/api/imports/csv",
        json={
            "rows": [
                {
                    "account_name": "CIBC Visa",
                    "account_type": "credit_card",
                    "transaction_date": "2026-05-08",
                    "description": "LOCAL BAKERY TORONTO",
                    "amount": "-14.25",
                    "currency": "CAD",
                }
            ]
        },
    )
    transaction = client.get("/api/transactions").json()[0]

    patch_response = client.patch(
        f"/api/transactions/{transaction['id']}",
        json={"category": "Dining", "merchant_normalized": "Local Bakery", "create_rule": True},
    )

    assert patch_response.status_code == 200
    updated = patch_response.json()
    assert updated["category"] == "Dining"
    rules = client.get("/api/category-rules").json()
    assert rules[0]["pattern"] == "local bakery toronto"
    assert rules[0]["merchant"] == "Local Bakery"


def test_net_worth_history_api_returns_supported_ranges_with_current_balance():
    client = make_client()
    client.post("/api/seed/demo")

    for range_key in ("1D", "1W", "1M", "3M", "6M", "YTD", "1Y", "ALL"):
        response = client.get(f"/api/net-worth/history?range={range_key}")

        assert response.status_code == 200
        data = response.json()
        assert data["range"] == range_key
        assert data["current_value"] == 14540
        assert data["change_amount"] == round(data["current_value"] - data["points"][0]["value"], 2)
        assert len(data["points"]) > 0


def test_manual_account_can_be_created_updated_and_deleted():
    client = make_client()

    create_response = client.post(
        "/api/accounts",
        json={"name": "Emergency Fund", "type": "savings", "balance": 2500, "currency": "CAD"},
    )

    assert create_response.status_code == 200
    created = create_response.json()
    assert created["id"] == "emergency-fund"
    assert created["source"] == "manual"
    assert created["balance"] == 2500

    update_response = client.patch(
        "/api/accounts/emergency-fund",
        json={"name": "Emergency Fund CAD", "type": "cash", "balance": 2750, "currency": "CAD"},
    )

    assert update_response.status_code == 200
    updated = update_response.json()
    assert updated["name"] == "Emergency Fund CAD"
    assert updated["type"] == "cash"
    assert updated["balance"] == 2750

    delete_response = client.delete("/api/accounts/emergency-fund")

    assert delete_response.status_code == 200
    assert delete_response.json() == {"deleted_account_id": "emergency-fund"}
    assert all(account["id"] != "emergency-fund" for account in client.get("/api/accounts").json())


def test_missing_account_update_returns_404():
    client = make_client()

    response = client.patch(
        "/api/accounts/not-found",
        json={"name": "Missing", "type": "checking", "balance": 0, "currency": "CAD"},
    )

    assert response.status_code == 404


def test_account_delete_removes_transaction_backed_account_and_its_transactions():
    client = make_client()
    client.post(
        "/api/accounts",
        json={"name": "Manual Import", "type": "checking", "balance": 100, "currency": "CAD"},
    )
    client.post(
        "/api/imports/csv",
        json={
            "rows": [
                {
                    "account_name": "Manual Import",
                    "account_type": "checking",
                    "transaction_date": "2026-05-08",
                    "description": "PAYROLL ACME CANADA",
                    "amount": "2000",
                    "currency": "CAD",
                }
            ]
        },
    )

    response = client.delete("/api/accounts/manual-import")

    assert response.status_code == 200
    assert response.json() == {"deleted_account_id": "manual-import"}
    assert all(account["id"] != "manual-import" for account in client.get("/api/accounts").json())
    assert all(transaction["account_id"] != "manual-import" for transaction in client.get("/api/transactions").json())


def test_account_delete_allows_synced_source_account_and_removes_transactions():
    client = make_client()
    client.post("/api/seed/demo")

    response = client.delete("/api/accounts/cibc-chequing")

    assert response.status_code == 200
    assert response.json() == {"deleted_account_id": "cibc-chequing"}
    assert all(account["id"] != "cibc-chequing" for account in client.get("/api/accounts").json())
    assert all(transaction["account_id"] != "cibc-chequing" for transaction in client.get("/api/transactions").json())
