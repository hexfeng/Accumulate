import json
import os
import re
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from app.domain.categorization import DEFAULT_RULES, categorize_transaction
from app.domain.normalization import normalize_csv_transaction
from app.domain.schemas import Account, AssetAllocationItem, BudgetSettings, CategoryRule, CsvTransactionRow, Holding, PortfolioAccountSummary, PortfolioSnapshot, Transaction


LOCAL_USER_ID = "local-user"


class AccountNotFoundError(Exception):
    pass


class AccountConflictError(Exception):
    pass


@dataclass
class LocalStore:
    accounts: dict[str, Account] = field(default_factory=dict)
    holdings: dict[str, Holding] = field(default_factory=dict)
    transactions: dict[str, Transaction] = field(default_factory=dict)
    user_rules: list[CategoryRule] = field(default_factory=list)
    budget: BudgetSettings = field(default_factory=lambda: BudgetSettings(monthly_budget=3000, category_budgets={"Groceries": 650, "Dining": 500, "Subscriptions": 150}))

    def reset(self) -> None:
        self.accounts.clear()
        self.holdings.clear()
        self.transactions.clear()
        self.user_rules.clear()

    def list_rules(self) -> list[CategoryRule]:
        return sorted(self.user_rules, key=lambda rule: rule.priority)

    def list_accounts(self) -> list[Account]:
        return list(self.accounts.values())

    def _rules(self) -> list[CategoryRule]:
        return self.user_rules + DEFAULT_RULES

    def upsert_account(self, name: str, account_type: str, balance: float = 0, currency: str = "CAD", source: str = "manual") -> Account:
        account_id = _slug(name)
        account = self.accounts.get(account_id)
        if account:
            return account
        account = Account(id=account_id, user_id=LOCAL_USER_ID, name=name, type=account_type, balance=balance, currency=currency, source=source)
        self.accounts[account.id] = account
        return account

    def create_account(self, name: str, account_type: str, balance: float = 0, currency: str = "CAD") -> Account:
        return self.upsert_account(name=name, account_type=account_type, balance=balance, currency=currency, source="manual")

    def import_simplefin_account_set(self, account_set: dict[str, Any], synced_at: str) -> dict[str, int]:
        created_transactions = 0
        connection_names = _simplefin_connection_names(account_set)
        institution_overrides = _simplefin_institution_overrides()
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
            account = Account(
                id=account_id,
                user_id=LOCAL_USER_ID,
                name=name,
                type=account_type,
                balance=balance,
                currency=currency,
                institution_name=institution_name,
                source="simplefin",
                last_synced_at=synced_at,
            )
            self.accounts[account_id] = account

            for raw_transaction in item.get("transactions", []):
                external_transaction_id = str(raw_transaction.get("id") or "")
                if not external_transaction_id:
                    continue
                duplicate_hash = f"simplefin:{account_id}:{external_transaction_id}"
                if duplicate_hash in self.transactions:
                    continue
                description = str(raw_transaction.get("description") or "SimpleFIN transaction")
                transaction = Transaction(
                    id=duplicate_hash,
                    user_id=LOCAL_USER_ID,
                    account_id=account.id,
                    account_name=account.name,
                    account_type=account.type,
                    transaction_date=_simplefin_transaction_date(raw_transaction),
                    amount=_money(float(raw_transaction.get("amount") or 0)),
                    currency=account.currency,
                    merchant_raw=description,
                    description_raw=description,
                    source="simplefin",
                    external_id=external_transaction_id,
                    duplicate_hash=duplicate_hash,
                )
                self.transactions[duplicate_hash] = categorize_transaction(transaction, self._rules())
                created_transactions += 1
        return {"accounts": len(account_set.get("accounts", [])), "created_transactions": created_transactions}

    def update_account(self, account_id: str, name: str, account_type: str, balance: float, currency: str = "CAD") -> Account:
        account = self.accounts.get(account_id)
        if account is None:
            raise AccountNotFoundError(f"Account {account_id} was not found.")
        updated = account.model_copy(update={"name": name, "type": account_type, "balance": balance, "currency": currency})
        self.accounts[account_id] = updated
        return updated

    def delete_account(self, account_id: str) -> str:
        account = self.accounts.get(account_id)
        if account is None:
            raise AccountNotFoundError(f"Account {account_id} was not found.")
        for transaction_key in [key for key, transaction in self.transactions.items() if transaction.account_id == account_id]:
            del self.transactions[transaction_key]
        del self.accounts[account_id]
        for holding_key in [key for key, holding in self.holdings.items() if holding.account_id == account_id]:
            del self.holdings[holding_key]
        return account_id

    def list_holdings(self) -> list[Holding]:
        return sorted(self.holdings.values(), key=lambda holding: (holding.account_name, holding.symbol))

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
        account = self.accounts.get(account_id)
        if account is None:
            raise AccountNotFoundError(f"Account {account_id} was not found.")
        holding_id = _slug(symbol)
        holding = Holding(
            id=holding_id,
            user_id=LOCAL_USER_ID,
            account_id=account.id,
            account_name=account.name,
            symbol=symbol.strip().upper(),
            name=name,
            quantity=quantity,
            average_cost=average_cost,
            market_price=market_price,
            currency=currency,
            source="manual",
        )
        self.holdings[holding.id] = holding
        return holding

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
        if holding_id not in self.holdings:
            raise AccountNotFoundError(f"Holding {holding_id} was not found.")
        account = self.accounts.get(account_id)
        if account is None:
            raise AccountNotFoundError(f"Account {account_id} was not found.")
        updated = Holding(
            id=holding_id,
            user_id=LOCAL_USER_ID,
            account_id=account.id,
            account_name=account.name,
            symbol=symbol.strip().upper(),
            name=name,
            quantity=quantity,
            average_cost=average_cost,
            market_price=market_price,
            currency=currency,
            source="manual",
        )
        self.holdings[holding_id] = updated
        return updated

    def delete_holding(self, holding_id: str) -> str:
        if holding_id not in self.holdings:
            raise AccountNotFoundError(f"Holding {holding_id} was not found.")
        del self.holdings[holding_id]
        return holding_id

    def portfolio_snapshot(self) -> PortfolioSnapshot:
        return _build_portfolio_snapshot(self.list_holdings())

    def import_csv_rows(self, rows: list[CsvTransactionRow]) -> int:
        created = 0
        for row in rows:
            self.upsert_account(row.account_name, row.account_type, source="csv")
            transaction = normalize_csv_transaction(row, LOCAL_USER_ID)
            categorized = categorize_transaction(transaction, self._rules())
            if categorized.duplicate_hash in self.transactions:
                continue
            self.transactions[categorized.duplicate_hash or categorized.id] = categorized
            created += 1
        return created

    def list_transactions(self) -> list[Transaction]:
        return sorted(self.transactions.values(), key=lambda txn: txn.transaction_date, reverse=True)

    def patch_transaction(self, transaction_id: str, category: str, merchant_normalized: str | None, create_rule: bool) -> Transaction:
        transaction = self.transactions[transaction_id]
        updated = transaction.model_copy(
            update={
                "category": category,
                "merchant_normalized": merchant_normalized or transaction.merchant_normalized or transaction.merchant_raw,
                "confidence": 1.0,
            }
        )
        self.transactions[transaction_id] = updated
        if create_rule:
            self.user_rules.insert(
                0,
                CategoryRule(
                    id=f"rule_{uuid4().hex[:8]}",
                    user_id=LOCAL_USER_ID,
                    pattern=transaction.merchant_raw.lower(),
                    merchant=updated.merchant_normalized or transaction.merchant_raw,
                    category=category,
                    priority=1,
                ),
            )
        return updated

    def seed_demo(self) -> None:
        self.reset()
        self.accounts = {
            "cibc-chequing": Account(id="cibc-chequing", user_id=LOCAL_USER_ID, name="CIBC Chequing", type="checking", balance=4200, currency="CAD", source="mock_simplefin"),
            "cibc-visa": Account(id="cibc-visa", user_id=LOCAL_USER_ID, name="CIBC Visa", type="credit_card", balance=-860, currency="CAD", source="mock_simplefin"),
            "eq-savings": Account(id="eq-savings", user_id=LOCAL_USER_ID, name="EQ Savings", type="savings", balance=11200, currency="CAD", source="manual"),
        }
        rows = [
            CsvTransactionRow(account_name="CIBC Chequing", account_type="checking", transaction_date="2026-05-01", description="PAYROLL ACME CANADA", amount="5200", currency="CAD"),
            CsvTransactionRow(account_name="CIBC Visa", account_type="credit_card", transaction_date="2026-05-02", description="LOBLAWS TORONTO", amount="-126.42", currency="CAD"),
            CsvTransactionRow(account_name="CIBC Visa", account_type="credit_card", transaction_date="2026-05-04", description="STARBUCKS STORE 0456 TORONTO", amount="-5.75", currency="CAD"),
            CsvTransactionRow(account_name="CIBC Visa", account_type="credit_card", transaction_date="2026-05-15", description="NETFLIX.COM", amount="-18.99", currency="CAD"),
            CsvTransactionRow(account_name="CIBC Visa", account_type="credit_card", transaction_date="2026-04-15", description="NETFLIX.COM", amount="-18.99", currency="CAD"),
            CsvTransactionRow(account_name="CIBC Visa", account_type="credit_card", transaction_date="2026-03-15", description="NETFLIX.COM", amount="-18.99", currency="CAD"),
            CsvTransactionRow(account_name="CIBC Chequing", account_type="checking", transaction_date="2026-05-18", description="TRANSFER TO EQ SAVINGS", amount="-900", currency="CAD"),
            CsvTransactionRow(account_name="CIBC Visa", account_type="credit_card", transaction_date="2026-05-22", description="UBER EATS TORONTO", amount="-48.10", currency="CAD"),
        ]
        self.import_csv_rows(rows)


def _slug(value: str) -> str:
    return "-".join(part for part in "".join(ch.lower() if ch.isalnum() else " " for ch in value).split())


def _money(value: float) -> float:
    return round(value, 2)


def _infer_simplefin_account_type(name: str) -> str:
    normalized = name.lower()
    if any(token in normalized for token in ("visa", "mastercard", "amex", "credit", "card")):
        return "credit_card"
    if any(token in normalized for token in ("saving", "savings")):
        return "savings"
    if any(token in normalized for token in ("cash", "wallet")):
        return "cash"
    if any(token in normalized for token in ("checking", "chequing", "debit")):
        return "checking"
    if any(token in normalized for token in ("tfsa", "rrsp", "investment", "brokerage", "self_directed", "non_registered", "crypto")):
        return "investment"
    if "loan" in normalized or "mortgage" in normalized:
        return "loan"
    return "other"


def _clean_simplefin_account_name(name: str, account_type: str, institution_name: str | None = None) -> str:
    compact = re.sub(r"\s+\((?!\d{4}\))[^)]*\)$", "", name.strip())
    compact = re.sub(r"\s+", " ", compact.replace("_", " ")).strip()
    normalized = compact.lower()
    institution = (institution_name or "").lower()
    if institution == "wealthsimple" and account_type == "credit_card":
        return "Wealthsimple Visa Infinite"
    if institution == "wealthsimple" and normalized == "cash":
        return "Wealthsimple Cash"
    return _title_account_name(compact) or name.strip()


def _title_account_name(name: str) -> str:
    acronyms = {"TFSA", "RRSP", "RESP", "FHSA", "USD", "CAD", "ETF", "HSA"}
    words = []
    for word in name.split(" "):
        upper = word.upper()
        words.append(upper if upper in acronyms else word.capitalize())
    return " ".join(words)


def _simplefin_connection_names(account_set: dict[str, Any]) -> dict[str, str]:
    names: dict[str, str] = {}
    for connection in account_set.get("connections", []):
        connection_id = str(connection.get("conn_id") or connection.get("id") or "")
        name = str(connection.get("org_name") or connection.get("name") or "").strip()
        if connection_id and name:
            names[connection_id] = name
    return names


def _simplefin_institution_overrides() -> dict[str, str]:
    parsed: dict[str, Any] = {}
    configured_path = os.getenv("FINSIGHT_SIMPLEFIN_INSTITUTION_OVERRIDES_PATH")
    override_path = Path(configured_path) if configured_path else Path.home() / ".finsight" / "simplefin_institutions.json"
    if override_path.exists():
        try:
            file_data = json.loads(override_path.read_text(encoding="utf-8"))
            if isinstance(file_data, dict):
                parsed.update(file_data)
        except (OSError, json.JSONDecodeError):
            pass

    raw = os.getenv("FINSIGHT_SIMPLEFIN_INSTITUTION_OVERRIDES", "").strip()
    if raw:
        try:
            env_data = json.loads(raw)
            if isinstance(env_data, dict):
                parsed.update(env_data)
        except json.JSONDecodeError:
            for entry in raw.replace(";", ",").split(","):
                if "=" not in entry:
                    continue
                key, value = entry.split("=", 1)
                parsed[key.strip()] = value.strip()
    if not isinstance(parsed, dict):
        return {}
    return {str(key).lower(): str(value).strip() for key, value in parsed.items() if str(key).strip() and str(value).strip()}


def _simplefin_account_institution(
    account: dict[str, Any],
    account_id: str,
    connection_names: dict[str, str],
    institution_overrides: dict[str, str],
) -> str | None:
    external_account_id = str(account.get("id") or "")
    connection_id = str(account.get("conn_id") or "connection")
    for candidate in (
        connection_names.get(connection_id),
        str(account.get("conn_name") or "").strip(),
        institution_overrides.get(external_account_id.lower()),
        institution_overrides.get(account_id.lower()),
    ):
        if candidate:
            return candidate
    return None


def _simplefin_transaction_date(transaction: dict[str, Any]) -> date:
    timestamp = transaction.get("posted") or transaction.get("transacted_at")
    try:
        return datetime.fromtimestamp(int(timestamp), timezone.utc).date()
    except (TypeError, ValueError, OSError):
        return datetime.now(timezone.utc).date()


def _build_portfolio_snapshot(holdings: list[Holding]) -> PortfolioSnapshot:
    holding_values = [(holding, holding.quantity * holding.market_price, holding.quantity * holding.average_cost) for holding in holdings]
    total_value = _money(sum(value for _, value, _ in holding_values))
    total_cost = _money(sum(cost for _, _, cost in holding_values))
    unrealized_gain = _money(total_value - total_cost)
    unrealized_gain_pct = _money((unrealized_gain / total_cost) * 100) if total_cost else 0

    allocation = [
        AssetAllocationItem(
            label=holding.symbol,
            value=_money(value),
            percent=_money((value / total_value) * 100) if total_value else 0,
        )
        for holding, value, _ in holding_values
    ]

    account_summaries: dict[str, PortfolioAccountSummary] = {}
    for holding, value, _ in holding_values:
        existing = account_summaries.get(holding.account_id)
        if existing is None:
            account_summaries[holding.account_id] = PortfolioAccountSummary(
                account_id=holding.account_id,
                account_name=holding.account_name,
                value=_money(value),
                holdings_count=1,
            )
        else:
            account_summaries[holding.account_id] = existing.model_copy(
                update={"value": _money(existing.value + value), "holdings_count": existing.holdings_count + 1}
            )

    return PortfolioSnapshot(
        total_value=total_value,
        total_cost=total_cost,
        unrealized_gain=unrealized_gain,
        unrealized_gain_pct=unrealized_gain_pct,
        allocation=allocation,
        accounts=list(account_summaries.values()),
    )
