from datetime import date
import json
from typing import Any

from sqlalchemy import JSON, Boolean, Column, Date, Float, MetaData, String, Table, create_engine, delete, inspect, insert, select, text, update
from sqlalchemy.engine import Engine

from app.domain.categorization import DEFAULT_RULES, categorize_transaction
from app.domain.normalization import normalize_csv_transaction
from app.domain.schemas import Account, BudgetSettings, CategoryRule, CsvTransactionRow, Holding, PortfolioSnapshot, Transaction
from app.store import LOCAL_USER_ID, AccountConflictError, AccountNotFoundError, _build_portfolio_snapshot, _clean_simplefin_account_name, _infer_simplefin_account_type, _money, _simplefin_account_institution, _simplefin_connection_names, _simplefin_institution_overrides, _simplefin_transaction_date, _slug


metadata = MetaData()

accounts = Table(
    "accounts",
    metadata,
    Column("id", String, primary_key=True),
    Column("user_id", String, nullable=False),
    Column("name", String, nullable=False),
    Column("type", String, nullable=False),
    Column("balance", Float, nullable=False, default=0),
    Column("currency", String, nullable=False, default="CAD"),
    Column("institution_name", String),
    Column("source", String, nullable=False),
    Column("last_synced_at", String),
)

transactions = Table(
    "transactions",
    metadata,
    Column("id", String, primary_key=True),
    Column("user_id", String, nullable=False),
    Column("account_id", String, nullable=False),
    Column("account_name", String, nullable=False),
    Column("account_type", String, nullable=False),
    Column("transaction_date", Date, nullable=False),
    Column("amount", Float, nullable=False),
    Column("currency", String, nullable=False),
    Column("merchant_raw", String, nullable=False),
    Column("merchant_normalized", String),
    Column("description_raw", String, nullable=False),
    Column("source", String, nullable=False),
    Column("external_id", String),
    Column("category", String),
    Column("subcategory", String),
    Column("transaction_type", String),
    Column("is_excluded_from_spending", Boolean, nullable=False, default=False),
    Column("is_recurring", Boolean, nullable=False, default=False),
    Column("confidence", Float),
    Column("duplicate_hash", String, unique=True),
)

holdings = Table(
    "holdings",
    metadata,
    Column("id", String, primary_key=True),
    Column("user_id", String, nullable=False),
    Column("account_id", String, nullable=False),
    Column("account_name", String, nullable=False),
    Column("symbol", String, nullable=False),
    Column("name", String, nullable=False),
    Column("quantity", Float, nullable=False),
    Column("average_cost", Float, nullable=False),
    Column("market_price", Float, nullable=False),
    Column("currency", String, nullable=False, default="CAD"),
    Column("source", String, nullable=False, default="manual"),
)

category_rules = Table(
    "category_rules",
    metadata,
    Column("id", String, primary_key=True),
    Column("user_id", String),
    Column("pattern", String, nullable=False),
    Column("merchant", String, nullable=False),
    Column("category", String, nullable=False),
    Column("subcategory", String),
    Column("priority", Float, nullable=False, default=100),
)

settings = Table(
    "user_settings",
    metadata,
    Column("user_id", String, primary_key=True),
    Column("monthly_budget", Float, nullable=False, default=3000),
    Column("category_budgets", JSON, nullable=False, default=dict),
    Column("forecast_assumptions", JSON, nullable=False, default=dict),
)


class DatabaseStore:
    def __init__(self, database_url: str):
        self.engine = create_engine(database_url, future=True)
        metadata.create_all(self.engine)
        self._ensure_schema_updates()
        self._ensure_settings()

    @classmethod
    def from_engine(cls, engine: Engine) -> "DatabaseStore":
        instance = cls.__new__(cls)
        instance.engine = engine
        metadata.create_all(engine)
        instance._ensure_schema_updates()
        instance._ensure_settings()
        return instance

    def _ensure_schema_updates(self) -> None:
        inspector = inspect(self.engine)
        if "transactions" not in inspector.get_table_names():
            return
        transaction_columns = {column["name"] for column in inspector.get_columns("transactions")}
        account_columns = {column["name"] for column in inspector.get_columns("accounts")}
        with self.engine.begin() as connection:
            if "institution_name" not in account_columns:
                connection.execute(text("ALTER TABLE accounts ADD COLUMN institution_name VARCHAR"))
            if "external_id" not in transaction_columns:
                connection.execute(text("ALTER TABLE transactions ADD COLUMN external_id VARCHAR"))

    def _ensure_settings(self) -> None:
        with self.engine.begin() as connection:
            existing = connection.execute(select(settings.c.user_id).where(settings.c.user_id == LOCAL_USER_ID)).first()
            if existing is None:
                connection.execute(
                    insert(settings).values(
                        user_id=LOCAL_USER_ID,
                        monthly_budget=3000,
                        category_budgets={"Groceries": 650, "Dining": 500, "Subscriptions": 150},
                        forecast_assumptions={},
                    )
                )

    @property
    def budget(self) -> BudgetSettings:
        with self.engine.begin() as connection:
            row = connection.execute(select(settings).where(settings.c.user_id == LOCAL_USER_ID)).mappings().one()
        return BudgetSettings(
            monthly_budget=row["monthly_budget"],
            category_budgets=row["category_budgets"] or {},
            forecast_assumptions=row["forecast_assumptions"] or {},
        )

    @budget.setter
    def budget(self, value: BudgetSettings) -> None:
        with self.engine.begin() as connection:
            connection.execute(
                update(settings)
                .where(settings.c.user_id == LOCAL_USER_ID)
                .values(
                    monthly_budget=value.monthly_budget,
                    category_budgets=value.category_budgets,
                    forecast_assumptions=value.forecast_assumptions,
                )
            )

    def reset(self) -> None:
        with self.engine.begin() as connection:
            connection.execute(delete(holdings))
            connection.execute(delete(transactions))
            connection.execute(delete(accounts))
            connection.execute(delete(category_rules))

    def list_accounts(self) -> list[Account]:
        with self.engine.begin() as connection:
            rows = connection.execute(select(accounts)).mappings().all()
        return [Account(**dict(row)) for row in rows]

    def list_rules(self) -> list[CategoryRule]:
        with self.engine.begin() as connection:
            rows = connection.execute(select(category_rules).order_by(category_rules.c.priority)).mappings().all()
        return [CategoryRule(**dict(row)) for row in rows]

    def _rules(self) -> list[CategoryRule]:
        return self.list_rules() + DEFAULT_RULES

    def upsert_account(self, name: str, account_type: str, balance: float = 0, currency: str = "CAD", source: str = "manual") -> Account:
        account_id = _slug(name)
        with self.engine.begin() as connection:
            row = connection.execute(select(accounts).where(accounts.c.id == account_id)).mappings().first()
            if row is None:
                connection.execute(
                    insert(accounts).values(
                        id=account_id,
                        user_id=LOCAL_USER_ID,
                        name=name,
                        type=account_type,
                        balance=balance,
                        currency=currency,
                        source=source,
                    )
                )
                row = connection.execute(select(accounts).where(accounts.c.id == account_id)).mappings().one()
        return Account(**dict(row))

    def create_account(self, name: str, account_type: str, balance: float = 0, currency: str = "CAD") -> Account:
        return self.upsert_account(name=name, account_type=account_type, balance=balance, currency=currency, source="manual")

    def import_simplefin_account_set(self, account_set: dict[str, Any], synced_at: str) -> dict[str, int]:
        created_transactions = 0
        connection_names = _simplefin_connection_names(account_set)
        institution_overrides = _simplefin_institution_overrides()
        with self.engine.begin() as connection:
            for item in account_set.get("accounts", []):
                external_account_id = str(item.get("id") or "")
                if not external_account_id:
                    continue
                connection_id = str(item.get("conn_id") or "connection")
                account_id = f"simplefin-{_slug(connection_id)}-{_slug(external_account_id)}"
                institution_name = _simplefin_account_institution(item, account_id, connection_names, institution_overrides)
                raw_name = str(item.get("name") or external_account_id)
                account_type = _infer_simplefin_account_type(raw_name)
                name = _clean_simplefin_account_name(raw_name, account_type, institution_name)
                balance = _money(float(item.get("balance") or 0))
                currency = str(item.get("currency") or "CAD").upper()
                existing = connection.execute(select(accounts.c.id).where(accounts.c.id == account_id)).first()
                values = {
                    "id": account_id,
                    "user_id": LOCAL_USER_ID,
                    "name": name,
                    "type": account_type,
                    "balance": balance,
                    "currency": currency,
                    "institution_name": institution_name,
                    "source": "simplefin",
                    "last_synced_at": synced_at,
                }
                if existing:
                    connection.execute(update(accounts).where(accounts.c.id == account_id).values(**values))
                else:
                    connection.execute(insert(accounts).values(**values))

                for raw_transaction in item.get("transactions", []):
                    external_transaction_id = str(raw_transaction.get("id") or "")
                    if not external_transaction_id:
                        continue
                    duplicate_hash = f"simplefin:{account_id}:{external_transaction_id}"
                    exists = connection.execute(select(transactions.c.id).where(transactions.c.duplicate_hash == duplicate_hash)).first()
                    if exists:
                        continue
                    description = str(raw_transaction.get("description") or "SimpleFIN transaction")
                    transaction = Transaction(
                        id=duplicate_hash,
                        user_id=LOCAL_USER_ID,
                        account_id=account_id,
                        account_name=name,
                        account_type=account_type,
                        transaction_date=_simplefin_transaction_date(raw_transaction),
                        amount=_money(float(raw_transaction.get("amount") or 0)),
                        currency=currency,
                        merchant_raw=description,
                        description_raw=description,
                        source="simplefin",
                        external_id=external_transaction_id,
                        duplicate_hash=duplicate_hash,
                    )
                    categorized = categorize_transaction(transaction, self._rules())
                    data = _table_values(transactions, categorized.model_dump())
                    data["id"] = categorized.duplicate_hash or categorized.id
                    connection.execute(insert(transactions).values(**data))
                    created_transactions += 1
        return {"accounts": len(account_set.get("accounts", [])), "created_transactions": created_transactions}

    def update_account(self, account_id: str, name: str, account_type: str, balance: float, currency: str = "CAD") -> Account:
        with self.engine.begin() as connection:
            row = connection.execute(select(accounts).where(accounts.c.id == account_id)).mappings().first()
            if row is None:
                raise AccountNotFoundError(f"Account {account_id} was not found.")
            connection.execute(
                update(accounts)
                .where(accounts.c.id == account_id)
                .values(name=name, type=account_type, balance=balance, currency=currency)
            )
            updated = connection.execute(select(accounts).where(accounts.c.id == account_id)).mappings().one()
        return Account(**dict(updated))

    def delete_account(self, account_id: str) -> str:
        with self.engine.begin() as connection:
            account_row = connection.execute(select(accounts).where(accounts.c.id == account_id)).mappings().first()
            if account_row is None:
                raise AccountNotFoundError(f"Account {account_id} was not found.")
            connection.execute(delete(holdings).where(holdings.c.account_id == account_id))
            connection.execute(delete(transactions).where(transactions.c.account_id == account_id))
            connection.execute(delete(accounts).where(accounts.c.id == account_id))
        return account_id

    def list_holdings(self) -> list[Holding]:
        with self.engine.begin() as connection:
            rows = connection.execute(select(holdings).order_by(holdings.c.account_name, holdings.c.symbol)).mappings().all()
        return [Holding(**dict(row)) for row in rows]

    def create_holding(
        self,
        account_id: str,
        symbol: str,
        name: str,
        quantity: float,
        average_cost: float,
        market_price: float,
        currency: str = "CAD",
    ) -> Holding:
        with self.engine.begin() as connection:
            account_row = connection.execute(select(accounts).where(accounts.c.id == account_id)).mappings().first()
            if account_row is None:
                raise AccountNotFoundError(f"Account {account_id} was not found.")
            holding_id = _slug(symbol)
            connection.execute(delete(holdings).where(holdings.c.id == holding_id))
            connection.execute(
                insert(holdings).values(
                    id=holding_id,
                    user_id=LOCAL_USER_ID,
                    account_id=account_id,
                    account_name=account_row["name"],
                    symbol=symbol.strip().upper(),
                    name=name,
                    quantity=quantity,
                    average_cost=average_cost,
                    market_price=market_price,
                    currency=currency,
                    source="manual",
                )
            )
            row = connection.execute(select(holdings).where(holdings.c.id == holding_id)).mappings().one()
        return Holding(**dict(row))

    def update_holding(
        self,
        holding_id: str,
        account_id: str,
        symbol: str,
        name: str,
        quantity: float,
        average_cost: float,
        market_price: float,
        currency: str = "CAD",
    ) -> Holding:
        with self.engine.begin() as connection:
            existing = connection.execute(select(holdings).where(holdings.c.id == holding_id)).mappings().first()
            if existing is None:
                raise AccountNotFoundError(f"Holding {holding_id} was not found.")
            account_row = connection.execute(select(accounts).where(accounts.c.id == account_id)).mappings().first()
            if account_row is None:
                raise AccountNotFoundError(f"Account {account_id} was not found.")
            connection.execute(
                update(holdings)
                .where(holdings.c.id == holding_id)
                .values(
                    account_id=account_id,
                    account_name=account_row["name"],
                    symbol=symbol.strip().upper(),
                    name=name,
                    quantity=quantity,
                    average_cost=average_cost,
                    market_price=market_price,
                    currency=currency,
                )
            )
            row = connection.execute(select(holdings).where(holdings.c.id == holding_id)).mappings().one()
        return Holding(**dict(row))

    def delete_holding(self, holding_id: str) -> str:
        with self.engine.begin() as connection:
            existing = connection.execute(select(holdings).where(holdings.c.id == holding_id)).mappings().first()
            if existing is None:
                raise AccountNotFoundError(f"Holding {holding_id} was not found.")
            connection.execute(delete(holdings).where(holdings.c.id == holding_id))
        return holding_id

    def portfolio_snapshot(self) -> PortfolioSnapshot:
        return _build_portfolio_snapshot(self.list_holdings())

    def import_csv_rows(self, rows: list[CsvTransactionRow]) -> int:
        created = 0
        with self.engine.begin() as connection:
            for row in rows:
                account = self.upsert_account(row.account_name, row.account_type, source="csv")
                transaction = categorize_transaction(normalize_csv_transaction(row, LOCAL_USER_ID), self._rules())
                exists = connection.execute(
                    select(transactions.c.id).where(transactions.c.duplicate_hash == transaction.duplicate_hash)
                ).first()
                if exists:
                    continue
                data = _table_values(transactions, transaction.model_dump())
                data["id"] = transaction.duplicate_hash or transaction.id
                connection.execute(insert(transactions).values(**data))
                created += 1
        return created

    def list_transactions(self) -> list[Transaction]:
        with self.engine.begin() as connection:
            rows = connection.execute(select(transactions).order_by(transactions.c.transaction_date.desc())).mappings().all()
        return [Transaction(**dict(row)) for row in rows]

    def patch_transaction(self, transaction_id: str, category: str, merchant_normalized: str | None, create_rule: bool) -> Transaction:
        with self.engine.begin() as connection:
            row = connection.execute(select(transactions).where(transactions.c.id == transaction_id)).mappings().one()
            merchant = merchant_normalized or row["merchant_normalized"] or row["merchant_raw"]
            connection.execute(
                update(transactions)
                .where(transactions.c.id == transaction_id)
                .values(category=category, merchant_normalized=merchant, confidence=1.0)
            )
            if create_rule:
                connection.execute(
                    insert(category_rules).values(
                        id=f"rule_{transaction_id[:12]}",
                        user_id=LOCAL_USER_ID,
                        pattern=row["merchant_raw"].lower(),
                        merchant=merchant,
                        category=category,
                        subcategory=None,
                        priority=1,
                    )
                )
            updated = connection.execute(select(transactions).where(transactions.c.id == transaction_id)).mappings().one()
        return Transaction(**dict(updated))

    def seed_demo(self) -> None:
        self.reset()
        self.upsert_account("CIBC Chequing", "checking", balance=4200, source="mock_simplefin")
        self.upsert_account("CIBC Visa", "credit_card", balance=-860, source="mock_simplefin")
        self.upsert_account("EQ Savings", "savings", balance=11200, source="manual")
        self.import_csv_rows(
            [
                CsvTransactionRow(account_name="CIBC Chequing", account_type="checking", transaction_date="2026-05-01", description="PAYROLL ACME CANADA", amount="5200", currency="CAD"),
                CsvTransactionRow(account_name="CIBC Visa", account_type="credit_card", transaction_date="2026-05-02", description="LOBLAWS TORONTO", amount="-126.42", currency="CAD"),
                CsvTransactionRow(account_name="CIBC Visa", account_type="credit_card", transaction_date="2026-05-04", description="STARBUCKS STORE 0456 TORONTO", amount="-5.75", currency="CAD"),
                CsvTransactionRow(account_name="CIBC Visa", account_type="credit_card", transaction_date="2026-05-15", description="NETFLIX.COM", amount="-18.99", currency="CAD"),
                CsvTransactionRow(account_name="CIBC Visa", account_type="credit_card", transaction_date="2026-04-15", description="NETFLIX.COM", amount="-18.99", currency="CAD"),
                CsvTransactionRow(account_name="CIBC Visa", account_type="credit_card", transaction_date="2026-03-15", description="NETFLIX.COM", amount="-18.99", currency="CAD"),
                CsvTransactionRow(account_name="CIBC Chequing", account_type="checking", transaction_date="2026-05-18", description="TRANSFER TO EQ SAVINGS", amount="-900", currency="CAD"),
                CsvTransactionRow(account_name="CIBC Visa", account_type="credit_card", transaction_date="2026-05-22", description="UBER EATS TORONTO", amount="-48.10", currency="CAD"),
            ]
        )


def _table_values(table: Table, values: dict) -> dict:
    allowed = {column.name for column in table.columns}
    return {key: value for key, value in values.items() if key in allowed}
