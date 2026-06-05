from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

from app.db_store import DatabaseStore
from app.domain.schemas import CsvTransactionRow


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

