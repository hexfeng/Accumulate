from __future__ import annotations

import re
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path

from app.domain.schemas import CsvTransactionRow


MONTHS = {
    "jan": 1,
    "feb": 2,
    "mar": 3,
    "apr": 4,
    "may": 5,
    "jun": 6,
    "jul": 7,
    "aug": 8,
    "sep": 9,
    "sept": 9,
    "oct": 10,
    "nov": 11,
    "dec": 12,
}
MONEY_RE = re.compile(r"^-?\$?\d{1,3}(?:,\d{3})*\.\d{2}$")


@dataclass(frozen=True)
class ParsedStatement:
    account_name: str
    account_type: str
    balance: float
    currency: str
    rows: list[CsvTransactionRow]


def extract_statement_text(content: bytes, filename: str = "", content_type: str = "") -> str:
    suffix = Path(filename).suffix.lower()
    if suffix == ".pdf" or content_type == "application/pdf":
        try:
            from pypdf import PdfReader
        except ImportError as error:
            raise ValueError("PDF parsing requires the pypdf package.") from error

        reader = PdfReader(BytesIO(content))
        text = "\n".join(page.extract_text() or "" for page in reader.pages).strip()
        if not text:
            raise ValueError("No readable text was found in this PDF statement.")
        return text

    for encoding in ("utf-8-sig", "utf-8", "cp1252"):
        try:
            return content.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise ValueError("Statement text could not be decoded.")


def parse_statement_text(text: str, filename: str = "") -> ParsedStatement:
    tokens = _tokens(text)
    if not tokens:
        raise ValueError("Statement did not contain readable text.")

    year, end_month = _statement_period(tokens, filename)
    account_name = _account_name(tokens, filename)
    account_type = "credit_card" if _looks_like_credit_card_statement(tokens, filename) else "checking"
    currency = "CAD"
    balance = _statement_balance(tokens)
    if account_type == "credit_card":
        balance = -abs(balance)

    rows = _transaction_rows(tokens, year, end_month, account_name, account_type, currency)
    if not rows:
        raise ValueError("No transaction rows were found in the statement.")

    return ParsedStatement(
        account_name=account_name,
        account_type=account_type,
        balance=balance,
        currency=currency,
        rows=rows,
    )


def _tokens(text: str) -> list[str]:
    return [line.strip() for line in text.splitlines() if line.strip()]


def _statement_period(tokens: list[str], filename: str) -> tuple[int, int]:
    for index, token in enumerate(tokens):
        if token.lower() == "period":
            window = tokens[index : index + 24]
            years = [int(item) for item in window if re.fullmatch(r"\d{4}", item)]
            months = [_month_number(item) for item in window if _month_number(item)]
            if years and months:
                return years[-1], months[-1]
    filename_years = [int(item) for item in re.findall(r"(20\d{2})", filename)]
    filename_months = [int(item) for item in re.findall(r"(?:^|[_\-\s])(0?[1-9]|1[0-2])(?:[_\-\s]|$)", filename)]
    return (filename_years[-1] if filename_years else 2026, filename_months[-1] if filename_months else 12)


def _account_name(tokens: list[str], filename: str) -> str:
    last4 = _last_four(tokens, filename)
    stem = Path(filename).stem.strip()
    if stem:
        parts = [part for part in re.split(r"[_\-\s]+", stem) if part]
        if last4 in parts:
            parts = parts[: parts.index(last4) + 1]
        elif len(parts) > 2 and re.fullmatch(r"20\d{2}", parts[-1]):
            parts = parts[:-1]
        name = " ".join(parts).strip()
        if name:
            return name
    if any("rogersbank" in token.lower() or token.lower() == "rogers" for token in tokens):
        return f"Rogers Bank Mastercard {last4}" if last4 else "Rogers Bank Mastercard"
    return f"Statement Account {last4}".strip()


def _last_four(tokens: list[str], filename: str) -> str:
    filename_match = re.search(r"(?:^|[_\-\s])(\d{4})(?:[_\-\s]|$)", filename)
    if filename_match:
        return filename_match.group(1)
    for index, token in enumerate(tokens):
        if token.lower() == "number":
            for candidate in tokens[index + 1 : index + 8]:
                if re.fullmatch(r"\d{4}", candidate):
                    return candidate
    return ""


def _looks_like_credit_card_statement(tokens: list[str], filename: str) -> bool:
    haystack = f"{filename} {' '.join(tokens[:160])}".lower()
    return any(marker in haystack for marker in ("mastercard", "visa", "credit limit", "minimum payment", "payment due date", "rogers red", "world elite"))


def _statement_balance(tokens: list[str]) -> float:
    for labels in (("new", "balance"), ("amount", "due")):
        for index in range(len(tokens) - len(labels)):
            if [token.lower() for token in tokens[index : index + len(labels)]] == list(labels):
                amount = _next_money(tokens, index + len(labels))
                if amount is not None:
                    return amount
    return 0.0


def _next_money(tokens: list[str], start: int) -> float | None:
    for token in tokens[start : start + 8]:
        if MONEY_RE.match(token):
            return _money(token)
    return None


def _transaction_rows(
    tokens: list[str],
    statement_year: int,
    statement_end_month: int,
    account_name: str,
    account_type: str,
    currency: str,
) -> list[CsvTransactionRow]:
    start = _find_sequence(tokens, ("Transaction", "Details"))
    end = _find_sequence(tokens, ("Interest", "Rate", "Chart"))
    if start == -1:
        start = 0
    if end == -1:
        end = len(tokens)

    rows: list[CsvTransactionRow] = []
    index = start
    while index < end - 4:
        if not _is_date_pair(tokens, index):
            index += 1
            continue
        trans_month = _month_number(tokens[index])
        trans_day = int(tokens[index + 1])
        amount_index = index + 4
        while amount_index < end and not MONEY_RE.match(tokens[amount_index]):
            amount_index += 1
        if amount_index >= end:
            break
        description = " ".join(tokens[index + 4 : amount_index]).strip()
        if description and not _is_statement_noise(description):
            amount = _money(tokens[amount_index])
            if account_type == "credit_card":
                amount = -amount if amount > 0 else abs(amount)
            year = statement_year if trans_month <= statement_end_month else statement_year - 1
            rows.append(
                CsvTransactionRow(
                    account_name=account_name,
                    account_type=account_type,
                    transaction_date=f"{year:04d}-{trans_month:02d}-{trans_day:02d}",
                    description=description,
                    amount=round(amount, 2),
                    currency=currency,
                )
            )
        index = amount_index + 1
    return rows


def _find_sequence(tokens: list[str], sequence: tuple[str, ...]) -> int:
    lowered = [token.lower() for token in tokens]
    target = [token.lower() for token in sequence]
    for index in range(len(lowered) - len(target) + 1):
        if lowered[index : index + len(target)] == target:
            return index
    return -1


def _is_date_pair(tokens: list[str], index: int) -> bool:
    return (
        _month_number(tokens[index]) is not None
        and index + 3 < len(tokens)
        and tokens[index + 1].isdigit()
        and _month_number(tokens[index + 2]) is not None
        and tokens[index + 3].isdigit()
    )


def _month_number(value: str) -> int | None:
    return MONTHS.get(value.strip().lower().rstrip("."))


def _money(value: str) -> float:
    return round(float(value.replace("$", "").replace(",", "")), 2)


def _is_statement_noise(description: str) -> bool:
    lowered = description.lower()
    return "account details" in lowered or "payment due date" in lowered or "card number" == lowered
