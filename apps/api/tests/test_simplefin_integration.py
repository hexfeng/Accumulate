import base64
import os
import stat

from fastapi.testclient import TestClient

from app.integrations.simplefin import SimpleFinClient, SimpleFinCredentialStore, SimpleFinHttpResponse, SimpleFinService
from app.main import create_app


FIXED_NOW = "2026-06-11T12:00:00+00:00"
ACCESS_URL = "https://user:secret@bridge.example.test/accounts-token"
ACCESS_AUTH_HEADER = f"Basic {base64.b64encode(b'user:secret').decode('ascii')}"


class FakeSimpleFinHttp:
    def __init__(self) -> None:
        self.requests: list[tuple[str, str, dict[str, str]]] = []
        self.accounts_response = SimpleFinHttpResponse(
            status_code=200,
            body={
                "accounts": [
                    {
                        "id": "checking-1",
                        "conn_id": "conn-1",
                        "name": "Everyday Chequing",
                        "currency": "CAD",
                        "balance": "1234.56",
                        "balance-date": 1781136000,
                        "transactions": [
                            {
                                "id": "txn-1",
                                "posted": 1781049600,
                                "amount": "-12.34",
                                "description": "LOBLAWS TORONTO",
                            }
                        ],
                    }
                ],
                "connections": [{"conn_id": "conn-1", "name": "CIBC - Checking", "org_name": "CIBC"}],
                "errlist": [],
            },
        )

    def request(self, method: str, url: str, headers: dict[str, str] | None = None) -> SimpleFinHttpResponse:
        self.requests.append((method, url, headers or {}))
        if method == "POST":
            return SimpleFinHttpResponse(status_code=200, body=ACCESS_URL)
        if method == "GET":
            return self.accounts_response
        raise AssertionError(f"Unexpected request: {method} {url}")


def make_client(tmp_path, http: FakeSimpleFinHttp | None = None) -> tuple[TestClient, SimpleFinCredentialStore, FakeSimpleFinHttp]:
    fake_http = http or FakeSimpleFinHttp()
    credential_store = SimpleFinCredentialStore(tmp_path / "simplefin_credentials.json")
    service = SimpleFinService(
        client=SimpleFinClient(http_request=fake_http.request),
        credential_store=credential_store,
        now=lambda: FIXED_NOW,
    )
    return TestClient(create_app(simplefin_service=service)), credential_store, fake_http


def setup_token(url: str = "https://setup.simplefin.example/claim/demo") -> str:
    return base64.b64encode(url.encode("utf-8")).decode("ascii")


def test_simplefin_connect_claims_setup_token_and_stores_access_url_securely(tmp_path):
    client, credential_store, http = make_client(tmp_path)

    response = client.post("/api/integrations/simplefin/connect", json={"setup_token": setup_token()})

    assert response.status_code == 200
    body = response.json()
    assert body["provider"] == "simplefin"
    assert body["mode"] == "real"
    assert body["status"] == "connected"
    assert body["has_credentials"] is True
    assert ACCESS_URL not in str(body)
    assert http.requests == [
        (
            "POST",
            "https://setup.simplefin.example/claim/demo",
            {
                "Accept": "text/plain, application/json",
                "Content-Length": "0",
                "User-Agent": "FinSight/0.1 SimpleFIN local client",
            },
        )
    ]
    assert credential_store.has_access_url()
    if os.name != "nt":
        assert stat.S_IMODE(credential_store.path.stat().st_mode) & stat.S_IRWXO == 0


def test_simplefin_sync_fetches_accounts_and_transactions_without_changing_ui_contract(tmp_path):
    client, credential_store, http = make_client(tmp_path)
    credential_store.save_access_url(ACCESS_URL)

    response = client.post("/api/integrations/simplefin/sync")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "synced"
    assert body["provider"] == "simplefin"
    assert body["last_synced_at"] == FIXED_NOW
    assert body["retry_count"] == 0
    assert http.requests == [
        (
            "GET",
            "https://bridge.example.test/accounts-token/accounts",
            {
                "Accept": "application/json",
                "Authorization": ACCESS_AUTH_HEADER,
                "User-Agent": "FinSight/0.1 SimpleFIN local client",
            },
        )
    ]

    accounts = client.get("/api/accounts").json()
    assert accounts == [
        {
            "id": "simplefin-conn-1-checking-1",
            "user_id": "local-user",
            "name": "Everyday Chequing",
            "type": "checking",
            "balance": 1234.56,
            "currency": "CAD",
            "institution_name": "CIBC",
            "source": "simplefin",
            "last_synced_at": FIXED_NOW,
        }
    ]

    transactions = client.get("/api/transactions").json()
    assert len(transactions) == 1
    assert transactions[0]["account_id"] == "simplefin-conn-1-checking-1"
    assert transactions[0]["external_id"] == "txn-1"
    assert transactions[0]["amount"] == -12.34
    assert transactions[0]["source"] == "simplefin"


def test_simplefin_sync_records_sanitized_error_and_retry_state(tmp_path):
    http = FakeSimpleFinHttp()
    http.accounts_response = SimpleFinHttpResponse(status_code=403, body="forbidden for https://user:secret@bridge.example.test")
    client, credential_store, _ = make_client(tmp_path, http)
    credential_store.save_access_url(ACCESS_URL)

    response = client.post("/api/integrations/simplefin/sync")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "error"
    assert body["retry_count"] == 1
    assert body["next_retry_at"]
    assert "403" in body["last_error"]
    assert "secret" not in body["last_error"]
    assert ACCESS_URL not in str(body)

    status = client.get("/api/integrations/simplefin/status").json()
    assert status["status"] == "error"
    assert status["retry_count"] == 1
    assert status["last_error"] == body["last_error"]


def test_simplefin_sync_uses_local_institution_override_when_bridge_omits_connection_metadata(tmp_path, monkeypatch):
    http = FakeSimpleFinHttp()
    http.accounts_response.body["connections"] = []
    http.accounts_response.body["accounts"][0]["id"] = "ACT-f134126c"
    http.accounts_response.body["accounts"][0].pop("conn_id")
    monkeypatch.setenv("FINSIGHT_SIMPLEFIN_INSTITUTION_OVERRIDES", '{"ACT-f134126c":"CIBC"}')
    client, credential_store, _ = make_client(tmp_path, http)
    credential_store.save_access_url(ACCESS_URL)

    response = client.post("/api/integrations/simplefin/sync")

    assert response.status_code == 200
    account = client.get("/api/accounts").json()[0]
    assert account["name"] == "Everyday Chequing"
    assert account["institution_name"] == "CIBC"


def test_simplefin_sync_cleans_wealthsimple_account_names_and_card_metadata(tmp_path, monkeypatch):
    http = FakeSimpleFinHttp()
    http.accounts_response.body = {
        "accounts": [
            {
                "id": "ACT-cash",
                "name": "CASH (-WGQ)",
                "currency": "CAD",
                "balance": "767.79",
                "transactions": [],
            },
            {
                "id": "ACT-card",
                "name": "CREDIT_CARD (W97Q)",
                "currency": "CAD",
                "balance": "0",
                "transactions": [],
            },
            {
                "id": "ACT-tfsa",
                "name": "SELF_DIRECTED_TFSA (JPhw)",
                "currency": "CAD",
                "balance": "10228.31",
                "transactions": [],
            },
        ],
        "connections": [],
        "errlist": [],
    }
    monkeypatch.setenv(
        "FINSIGHT_SIMPLEFIN_INSTITUTION_OVERRIDES",
        '{"ACT-cash":"Wealthsimple","ACT-card":"Wealthsimple","ACT-tfsa":"Wealthsimple"}',
    )
    client, credential_store, _ = make_client(tmp_path, http)
    credential_store.save_access_url(ACCESS_URL)

    response = client.post("/api/integrations/simplefin/sync")

    assert response.status_code == 200
    accounts = {account["id"]: account for account in client.get("/api/accounts").json()}
    cash = accounts["simplefin-connection-act-cash"]
    card = accounts["simplefin-connection-act-card"]
    tfsa = accounts["simplefin-connection-act-tfsa"]
    assert cash["name"] == "Wealthsimple Cash"
    assert cash["type"] == "cash"
    assert card["name"] == "Wealthsimple Visa Infinite"
    assert card["type"] == "credit_card"
    assert tfsa["name"] == "Self Directed TFSA"
    assert tfsa["type"] == "investment"
    assert {cash["institution_name"], card["institution_name"], tfsa["institution_name"]} == {"Wealthsimple"}


def test_simplefin_disconnect_clears_credentials_and_preserves_response_shape(tmp_path):
    client, credential_store, _ = make_client(tmp_path)
    credential_store.save_access_url(ACCESS_URL)

    response = client.delete("/api/integrations/simplefin/disconnect")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "disconnected"
    assert body["provider"] == "simplefin"
    assert body["mode"] == "real"
    assert body["has_credentials"] is False
    assert not credential_store.has_access_url()
