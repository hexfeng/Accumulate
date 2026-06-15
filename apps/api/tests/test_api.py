from fastapi.testclient import TestClient

from app.main import create_app
from app.store import LocalStore


def make_client() -> TestClient:
    return TestClient(create_app(store=LocalStore()))


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


class FakeQuoteService:
    def __init__(self):
        self.quote_calls: list[str] = []
        self.search_calls: list[str] = []
        self.prices = [132.45, 135.25]

    def get_quote(self, symbol: str):
        self.quote_calls.append(symbol)
        price = self.prices[min(len(self.quote_calls) - 1, len(self.prices) - 1)]
        return {
            "symbol": symbol.strip().upper(),
            "name": "Vanguard S&P 500 Index ETF",
            "price": price,
            "currency": "CAD",
            "provider": "test",
            "as_of": "2026-06-12T13:00:00Z",
        }

    def search(self, query: str, max_results: int = 8):
        self.search_calls.append(query)
        return [
            {
                "symbol": "MU",
                "name": "Micron Technology, Inc.",
                "quote_type": "EQUITY",
                "exchange": "NASDAQ",
                "currency": "USD",
                "price": None,
                "provider": "test",
                "as_of": None,
            },
            {
                "symbol": "MUU.TO",
                "name": "Mackenzie US Equity Index ETF CAD Hedged",
                "quote_type": "ETF",
                "exchange": "Toronto",
                "currency": "CAD",
                "price": None,
                "provider": "test",
                "as_of": None,
            },
        ][:max_results]


def test_holding_create_fetches_market_price_when_missing():
    client = TestClient(create_app(store=LocalStore(), quote_service=FakeQuoteService()))
    client.post(
        "/api/accounts",
        json={"name": "TFSA", "type": "investment", "balance": 0, "currency": "CAD"},
    )

    response = client.post(
        "/api/holdings",
        json={
            "account_id": "tfsa",
            "symbol": "VFV.TO",
            "name": "",
            "quantity": 8,
            "average_cost": 120,
            "currency": "CAD",
        },
    )

    assert response.status_code == 200
    holding = response.json()
    assert holding["name"] == "Vanguard S&P 500 Index ETF"
    assert holding["market_price"] == 132.45
    assert holding["currency"] == "CAD"
    portfolio = client.get("/api/portfolio").json()
    assert portfolio["total_value"] == 1059.6
    assert portfolio["total_cost"] == 960


def test_quote_endpoint_returns_latest_market_price():
    quote_service = FakeQuoteService()
    client = TestClient(create_app(store=LocalStore(), quote_service=quote_service))

    response = client.get("/api/quotes/VFV.TO")

    assert response.status_code == 200
    assert response.json() == {
        "symbol": "VFV.TO",
        "name": "Vanguard S&P 500 Index ETF",
        "price": 132.45,
        "currency": "CAD",
        "provider": "test",
        "as_of": "2026-06-12T13:00:00Z",
    }
    assert quote_service.quote_calls == ["VFV.TO"]


def test_security_search_returns_stock_and_etf_matches():
    quote_service = FakeQuoteService()
    client = TestClient(create_app(store=LocalStore(), quote_service=quote_service))

    response = client.get("/api/securities/search?q=MU")

    assert response.status_code == 200
    assert quote_service.search_calls == ["MU"]
    assert response.json() == [
        {
            "symbol": "MU",
            "name": "Micron Technology, Inc.",
            "quote_type": "EQUITY",
            "exchange": "NASDAQ",
            "currency": "USD",
            "price": None,
            "provider": "test",
            "as_of": None,
        },
        {
            "symbol": "MUU.TO",
            "name": "Mackenzie US Equity Index ETF CAD Hedged",
            "quote_type": "ETF",
            "exchange": "Toronto",
            "currency": "CAD",
            "price": None,
            "provider": "test",
            "as_of": None,
        },
    ]


def test_quote_refresh_updates_holdings_and_uses_fifteen_minute_cache():
    quote_service = FakeQuoteService()
    store = LocalStore()
    client = TestClient(create_app(store=store, quote_service=quote_service))
    client.post(
        "/api/accounts",
        json={"name": "TFSA", "type": "investment", "balance": 0, "currency": "CAD"},
    )
    client.post(
        "/api/holdings",
        json={
            "account_id": "tfsa",
            "symbol": "VFV.TO",
            "name": "Vanguard S&P 500 Index ETF",
            "quantity": 2,
            "average_cost": 120,
            "market_price": 125,
            "currency": "CAD",
        },
    )

    first_refresh = client.post("/api/quotes/refresh")
    second_refresh = client.post("/api/quotes/refresh")
    forced_refresh = client.post("/api/quotes/refresh?force=true")

    assert first_refresh.status_code == 200
    assert first_refresh.json()["refreshed_count"] == 1
    assert first_refresh.json()["skipped_count"] == 0
    assert first_refresh.json()["holdings"][0]["market_price"] == 132.45
    assert second_refresh.status_code == 200
    assert second_refresh.json()["refreshed_count"] == 0
    assert second_refresh.json()["skipped_count"] == 1
    assert forced_refresh.status_code == 200
    assert forced_refresh.json()["refreshed_count"] == 1
    assert forced_refresh.json()["holdings"][0]["market_price"] == 135.25
    assert quote_service.quote_calls == ["VFV.TO", "VFV.TO"]


def test_portfolio_snapshot_uses_investment_account_balances_without_holdings():
    client = make_client()
    client.post(
        "/api/accounts",
        json={"name": "Self Directed TFSA", "type": "investment", "balance": 10776.13, "currency": "CAD"},
    )
    client.post(
        "/api/accounts",
        json={"name": "Self Directed RRSP", "type": "investment", "balance": 2151.86, "currency": "CAD"},
    )

    portfolio = client.get("/api/portfolio").json()

    assert portfolio["total_value"] == 12927.99
    assert portfolio["total_cost"] == 12927.99
    assert portfolio["unrealized_gain"] == 0
    assert [account["account_name"] for account in portfolio["accounts"]] == ["Self Directed TFSA", "Self Directed RRSP"]


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
    assert rules[0]["pattern"] == "local bakery"
    assert rules[0]["merchant"] == "Local Bakery"


def test_transaction_category_patch_updates_related_merchant_history_across_accounts():
    client = make_client()
    client.post(
        "/api/imports/csv",
        json={
            "rows": [
                {
                    "account_name": "American Express Cobalt Card",
                    "account_type": "credit_card",
                    "transaction_date": "2026-06-07",
                    "description": "Petro-Canada 33370 Markham",
                    "amount": "-75.00",
                    "currency": "CAD",
                },
                {
                    "account_name": "Rogers Red World Elite",
                    "account_type": "credit_card",
                    "transaction_date": "2026-06-06",
                    "description": "PETRO CANADA 8842 TORONTO",
                    "amount": "-64.12",
                    "currency": "CAD",
                },
                {
                    "account_name": "American Express Cobalt Card",
                    "account_type": "credit_card",
                    "transaction_date": "2026-06-05",
                    "description": "Mcdonald'S #11787 Q04 Unionville",
                    "amount": "-19.20",
                    "currency": "CAD",
                },
                {
                    "account_name": "CIBC Visa",
                    "account_type": "credit_card",
                    "transaction_date": "2026-06-04",
                    "description": "MCDONALDS 4421 TORONTO",
                    "amount": "-12.45",
                    "currency": "CAD",
                },
                {
                    "account_name": "American Express Cobalt Card",
                    "account_type": "credit_card",
                    "transaction_date": "2026-06-03",
                    "description": "Rob'S Nf #7076 Unionville On",
                    "amount": "-42.10",
                    "currency": "CAD",
                },
                {
                    "account_name": "Rogers Red World Elite",
                    "account_type": "credit_card",
                    "transaction_date": "2026-06-02",
                    "description": "ROB'S NF #1234 TORONTO",
                    "amount": "-36.50",
                    "currency": "CAD",
                },
                {
                    "account_name": "CIBC Visa",
                    "account_type": "credit_card",
                    "transaction_date": "2026-06-01",
                    "description": "ROB S NF 5511 MARKHAM",
                    "amount": "-18.75",
                    "currency": "CAD",
                },
            ]
        },
    )
    transactions = client.get("/api/transactions").json()
    petro = next(transaction for transaction in transactions if transaction["merchant_raw"] == "Petro-Canada 33370 Markham")
    mcdonalds = next(transaction for transaction in transactions if transaction["merchant_raw"] == "Mcdonald'S #11787 Q04 Unionville")
    robs_nf = next(transaction for transaction in transactions if transaction["merchant_raw"] == "Rob'S Nf #7076 Unionville On")

    petro_response = client.patch(
        f"/api/transactions/{petro['id']}",
        json={"category": "Transport", "merchant_normalized": petro["merchant_normalized"], "create_rule": True},
    )
    mcdonalds_response = client.patch(
        f"/api/transactions/{mcdonalds['id']}",
        json={"category": "Dining", "merchant_normalized": mcdonalds["merchant_normalized"], "create_rule": True},
    )
    robs_nf_response = client.patch(
        f"/api/transactions/{robs_nf['id']}",
        json={"category": "Groceries", "merchant_normalized": robs_nf["merchant_normalized"], "create_rule": True},
    )

    assert petro_response.status_code == 200
    assert mcdonalds_response.status_code == 200
    assert robs_nf_response.status_code == 200
    updated_transactions = client.get("/api/transactions").json()
    by_merchant = {transaction["merchant_raw"]: transaction for transaction in updated_transactions}
    assert by_merchant["Petro-Canada 33370 Markham"]["category"] == "Transport"
    assert by_merchant["PETRO CANADA 8842 TORONTO"]["category"] == "Transport"
    assert by_merchant["Mcdonald'S #11787 Q04 Unionville"]["category"] == "Dining"
    assert by_merchant["MCDONALDS 4421 TORONTO"]["category"] == "Dining"
    assert by_merchant["Rob'S Nf #7076 Unionville On"]["category"] == "Groceries"
    assert by_merchant["ROB'S NF #1234 TORONTO"]["category"] == "Groceries"
    assert by_merchant["ROB S NF 5511 MARKHAM"]["category"] == "Groceries"

    patterns = [rule["pattern"] for rule in client.get("/api/category-rules").json()]
    assert "petro canada" in patterns
    assert "mcdonald" in patterns
    assert "rob nf" in patterns


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


def test_dashboard_and_net_worth_use_holdings_aware_investment_value():
    client = make_client()
    client.post("/api/accounts", json={"name": "TFSA", "type": "investment", "balance": 10000, "currency": "CAD"})
    client.post("/api/accounts", json={"name": "RRSP", "type": "investment", "balance": 4000, "currency": "CAD"})
    client.post("/api/accounts", json={"name": "Cash", "type": "checking", "balance": 2000, "currency": "CAD"})
    client.post("/api/accounts", json={"name": "Visa", "type": "credit_card", "balance": -500, "currency": "CAD"})
    client.post(
        "/api/holdings",
        json={
            "account_id": "tfsa",
            "symbol": "VFV.TO",
            "name": "Vanguard S&P 500 ETF",
            "quantity": 80,
            "average_cost": 100,
            "market_price": 150,
            "currency": "CAD",
        },
    )

    dashboard = client.get("/api/dashboard").json()
    history = client.get("/api/net-worth/history?range=1M").json()

    assert dashboard["net_worth_total"] == 17500
    assert dashboard["net_worth_uses_manual_holdings"] is True
    assert dashboard["investment_summary"]["total_value"] == 12000
    assert dashboard["asset_allocation"][0]["label"] == "VFV.TO"
    assert dashboard["asset_allocation"][0]["value"] == 12000
    assert history["current_value"] == 17500
    assert history["points"][-1]["value"] == 17500


def test_watchlist_returns_default_symbols_with_quotes_and_symbol_errors():
    class PartialQuoteService(FakeQuoteService):
        def get_quote(self, symbol: str):
            if symbol.strip().upper() == "^RUT":
                raise RuntimeError("rate limited")
            return {
                "symbol": symbol.strip().upper(),
                "name": f"{symbol.strip().upper()} Index",
                "price": 1000,
                "currency": "USD",
                "provider": "test",
                "as_of": "2026-06-12T13:00:00Z",
            }

    client = TestClient(create_app(store=LocalStore(), quote_service=PartialQuoteService()))

    response = client.get("/api/watchlist")

    assert response.status_code == 200
    data = response.json()
    assert [item["symbol"] for item in data["items"]] == ["^DJI", "^GSPC", "^IXIC", "^RUT", "^GSPTSE"]
    assert data["items"][0]["price"] == 1000
    assert data["items"][3]["price"] is None
    assert data["items"][3]["error"] == "Quote unavailable"


def test_watchlist_symbols_can_be_replaced():
    client = TestClient(create_app(store=LocalStore(), quote_service=FakeQuoteService()))

    response = client.put("/api/watchlist/symbols", json={"symbols": ["vfv.to", " CASH.TO ", "vfv.to"]})

    assert response.status_code == 200
    assert response.json()["symbols"] == ["VFV.TO", "CASH.TO"]
    assert [item["symbol"] for item in response.json()["items"]] == ["VFV.TO", "CASH.TO"]
    assert client.get("/api/watchlist/symbols").json()["symbols"] == ["VFV.TO", "CASH.TO"]
