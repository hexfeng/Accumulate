from dataclasses import dataclass, field
from datetime import date
from uuid import uuid4

from app.domain.categorization import DEFAULT_RULES, categorize_transaction
from app.domain.normalization import normalize_csv_transaction
from app.domain.schemas import Account, BudgetSettings, CategoryRule, CsvTransactionRow, Transaction


LOCAL_USER_ID = "local-user"


class AccountNotFoundError(Exception):
    pass


class AccountConflictError(Exception):
    pass


@dataclass
class LocalStore:
    accounts: dict[str, Account] = field(default_factory=dict)
    transactions: dict[str, Transaction] = field(default_factory=dict)
    user_rules: list[CategoryRule] = field(default_factory=list)
    budget: BudgetSettings = field(default_factory=lambda: BudgetSettings(monthly_budget=3000, category_budgets={"Groceries": 650, "Dining": 500, "Subscriptions": 150}))

    def reset(self) -> None:
        self.accounts.clear()
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
        return account_id

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
