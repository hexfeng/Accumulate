from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

from app.db_store import DatabaseStore
from app.domain.schemas import CsvTransactionRow
from app.main import _build_default_store
from app.store import LocalStore


def test_database_store_persists_csv_imports_and_deduplicates_rows():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool, future=True)
    store = DatabaseStore.from_engine(engine)

    rows = [
        CsvTransactionRow(
            account_name="CIBC Visa",
            account_type="credit_card",
            transaction_date="2026-05-15",
            description="NETFLIX.COM",
            amount="-18.99",
            currency="CAD",
        ),
        CsvTransactionRow(
            account_name="CIBC Visa",
            account_type="credit_card",
            transaction_date="2026-05-15",
            description="NETFLIX.COM",
            amount="-18.99",
            currency="CAD",
        ),
    ]

    assert store.import_csv_rows(rows) == 1

    reloaded = DatabaseStore.from_engine(engine)
    transactions = reloaded.list_transactions()
    assert len(transactions) == 1
    assert transactions[0].merchant_normalized == "Netflix"
    assert transactions[0].category == "Subscriptions"


def test_database_store_persists_manual_account_crud():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool, future=True)
    store = DatabaseStore.from_engine(engine)

    created = store.create_account(name="Emergency Fund", account_type="savings", balance=2500, currency="CAD")
    updated = store.update_account(created.id, name="Emergency Fund CAD", account_type="cash", balance=2750, currency="CAD")
    deleted = store.delete_account(created.id)

    assert created.id == "emergency-fund"
    assert created.source == "manual"
    assert updated.name == "Emergency Fund CAD"
    assert updated.type == "cash"
    assert updated.balance == 2750
    assert deleted == created.id

    reloaded = DatabaseStore.from_engine(engine)
    assert reloaded.list_accounts() == []


def test_database_store_persists_manual_holding_crud():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool, future=True)
    store = DatabaseStore.from_engine(engine)

    account = store.create_account(name="TFSA", account_type="investment", balance=0, currency="CAD")
    created = store.create_holding(
        account_id=account.id,
        symbol="VFV.TO",
        name="Vanguard S&P 500 ETF",
        quantity=10,
        average_cost=110,
        market_price=125,
        currency="CAD",
    )
    updated = store.update_holding(
        created.id,
        account_id=account.id,
        symbol="VFV.TO",
        name="Vanguard S&P 500 ETF",
        quantity=12,
        average_cost=111,
        market_price=126,
        currency="CAD",
    )
    portfolio = store.portfolio_snapshot()
    deleted = store.delete_holding(created.id)

    assert created.id == "vfv-to"
    assert updated.quantity == 12
    assert portfolio.total_value == 1512
    assert deleted == created.id

    reloaded = DatabaseStore.from_engine(engine)
    assert reloaded.list_holdings() == []


def test_database_store_persists_simplefin_sync_with_external_ids():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool, future=True)
    store = DatabaseStore.from_engine(engine)

    result = store.import_simplefin_account_set(
        {
            "accounts": [
                {
                    "id": "checking-1",
                    "conn_id": "conn-1",
                    "name": "Everyday Chequing",
                    "currency": "CAD",
                    "balance": "1234.56",
                    "transactions": [
                        {
                            "id": "txn-1",
                            "posted": 1781049600,
                            "amount": "-12.34",
                            "description": "LOBLAWS TORONTO",
                        }
                    ],
                }
            ]
        },
        "2026-06-11T12:00:00+00:00",
        coverage_start="2026-04-27",
        coverage_end="2026-06-11",
    )

    assert result == {"accounts": 1, "created_transactions": 1}

    reloaded = DatabaseStore.from_engine(engine)
    account = reloaded.list_accounts()[0]
    transactions = reloaded.list_transactions()

    assert account.id == "simplefin-conn-1-checking-1"
    assert account.source == "simplefin"
    assert account.last_synced_at == "2026-06-11T12:00:00+00:00"
    assert transactions[0].external_id == "txn-1"
    assert transactions[0].source == "simplefin"
    snapshots = reloaded.list_account_balance_snapshots()
    coverage = reloaded.simplefin_transaction_coverage()
    assert len(snapshots) == 1
    assert snapshots[0].account_id == "simplefin-conn-1-checking-1"
    assert snapshots[0].snapshot_date.isoformat() == "2026-06-11"
    assert snapshots[0].balance == 1234.56
    assert coverage["start_date"] == "2026-04-27"
    assert coverage["end_date"] == "2026-06-11"


def test_default_store_uses_local_sqlite_database_when_no_database_url(monkeypatch, tmp_path):
    database_path = tmp_path / "finsight.db"
    monkeypatch.delenv("FINSIGHT_DATABASE_URL", raising=False)
    monkeypatch.setenv("FINSIGHT_DATABASE_PATH", str(database_path))

    store = _build_default_store()

    assert isinstance(store, DatabaseStore)
    assert not isinstance(store, LocalStore)
    store.import_csv_rows(
        [
            CsvTransactionRow(
                account_name="CIBC Visa",
                account_type="credit_card",
                transaction_date="2026-05-15",
                description="NETFLIX.COM",
                amount="-18.99",
                currency="CAD",
            )
        ]
    )

    reloaded = _build_default_store()

    assert database_path.exists()
    assert len(reloaded.list_transactions()) == 1


def test_database_store_persists_watchlist_symbols():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool, future=True)
    store = DatabaseStore.from_engine(engine)

    assert store.list_watchlist_symbols() == ["^DJI", "^GSPC", "^IXIC", "^RUT", "^GSPTSE"]
    store.replace_watchlist_symbols(["VFV.TO", "CASH.TO"])

    reloaded = DatabaseStore.from_engine(engine)
    assert reloaded.list_watchlist_symbols() == ["VFV.TO", "CASH.TO"]

