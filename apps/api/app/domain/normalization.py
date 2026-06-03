from datetime import date
import re

from app.domain.schemas import CsvTransactionRow, Transaction


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def normalize_csv_transaction(row: CsvTransactionRow, user_id: str) -> Transaction:
    transaction_date = date.fromisoformat(row.transaction_date)
    amount = round(float(row.amount), 2)
    account_slug = slugify(row.account_name)
    description_slug = slugify(row.description)
    duplicate_hash = f"csv:{account_slug}:{transaction_date.isoformat()}:{amount:.2f}:{description_slug}"

    return Transaction(
        id=duplicate_hash,
        user_id=user_id,
        account_id=account_slug,
        account_name=row.account_name.strip(),
        account_type=row.account_type.strip().lower(),
        transaction_date=transaction_date,
        amount=amount,
        currency=row.currency.strip().upper(),
        merchant_raw=row.description.strip(),
        description_raw=row.description.strip(),
        source="csv",
        duplicate_hash=duplicate_hash,
    )

