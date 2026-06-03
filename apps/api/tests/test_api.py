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
