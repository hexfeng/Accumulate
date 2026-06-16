from datetime import date, timedelta
import math

from app.domain.schemas import Account, AccountBalanceSnapshot, NetWorthHistory, NetWorthHistoryPoint, Transaction


NET_WORTH_RANGES = ("1D", "1W", "1M", "3M", "6M", "YTD", "1Y", "ALL")

_POINT_COUNTS = {
    "1D": 8,
    "1W": 7,
    "1M": 30,
    "3M": 90,
    "6M": 120,
    "YTD": 120,
    "1Y": 180,
    "ALL": 240,
}

_CHANGE_PCT = {
    "1D": 0.003,
    "1W": 0.018,
    "1M": 0.082,
    "3M": 0.128,
    "6M": 0.174,
    "YTD": 0.213,
    "1Y": 0.264,
    "ALL": 0.382,
}


def _money(value: float) -> float:
    return round(value + 0.0000001, 2)


def build_net_worth_history(
    accounts: list[Account],
    range_key: str = "1M",
    snapshots: list[AccountBalanceSnapshot] | None = None,
    transactions: list[Transaction] | None = None,
    as_of: date | None = None,
    current_value_override: float | None = None,
) -> NetWorthHistory:
    if range_key not in NET_WORTH_RANGES:
        raise ValueError(f"Unsupported net worth range: {range_key}")

    as_of = as_of or date.today()
    if snapshots:
        latest_snapshot_date = max(snapshot.snapshot_date for snapshot in snapshots)
        if latest_snapshot_date > as_of:
            as_of = latest_snapshot_date
    current_value = _money(
        current_value_override if current_value_override is not None else sum(account.balance for account in accounts)
    )
    snapshot_points = _snapshot_points(snapshots or [], range_key, as_of)
    transaction_points = _transaction_estimate_points(transactions or [], current_value, range_key, as_of)
    if len(snapshot_points) >= 2:
        if transaction_points and not _snapshot_points_cover_range_start(snapshot_points, range_key, as_of):
            change_amount = _money(current_value - transaction_points[0].value)
            change_pct = _money((change_amount / transaction_points[0].value) * 100) if transaction_points[0].value else 0
            return NetWorthHistory(
                range=range_key,
                current_value=current_value,
                change_amount=change_amount,
                change_pct=change_pct,
                points=transaction_points,
                coverage_start=transaction_points[0].date,
                coverage_end=transaction_points[-1].date,
                is_estimated=True,
            )
        if snapshot_points[-1].date != as_of or snapshot_points[-1].value != current_value:
            snapshot_points.append(NetWorthHistoryPoint(date=as_of, value=current_value))
        change_amount = _money(current_value - snapshot_points[0].value)
        change_pct = _money((change_amount / snapshot_points[0].value) * 100) if snapshot_points[0].value else 0
        return NetWorthHistory(
            range=range_key,
            current_value=current_value,
            change_amount=change_amount,
            change_pct=change_pct,
            points=snapshot_points,
            coverage_start=snapshot_points[0].date,
            coverage_end=snapshot_points[-1].date,
            is_estimated=False,
        )

    if transaction_points:
        change_amount = _money(current_value - transaction_points[0].value)
        change_pct = _money((change_amount / transaction_points[0].value) * 100) if transaction_points[0].value else 0
        return NetWorthHistory(
            range=range_key,
            current_value=current_value,
            change_amount=change_amount,
            change_pct=change_pct,
            points=transaction_points,
            coverage_start=transaction_points[0].date,
            coverage_end=transaction_points[-1].date,
            is_estimated=True,
        )

    point_count = _POINT_COUNTS[range_key]
    start_value = _money(current_value / (1 + _CHANGE_PCT[range_key])) if current_value else 0
    points: list[NetWorthHistoryPoint] = []

    for index in range(point_count):
        progress = index / max(point_count - 1, 1)
        trend_value = start_value + ((current_value - start_value) * progress)
        wave = current_value * (math.sin(progress * math.pi * 4) * 0.012 + math.sin(progress * math.pi * 9) * 0.005)
        point_value = _money(trend_value + wave)
        point_date = as_of - timedelta(days=point_count - 1 - index)
        points.append(NetWorthHistoryPoint(date=point_date, value=point_value))

    points[-1] = NetWorthHistoryPoint(date=as_of, value=current_value)
    change_amount = _money(current_value - points[0].value)
    change_pct = _money((change_amount / points[0].value) * 100) if points[0].value else 0

    return NetWorthHistory(
        range=range_key,
        current_value=current_value,
        change_amount=change_amount,
        change_pct=change_pct,
        points=points,
        coverage_start=None,
        coverage_end=None,
        is_estimated=True,
    )


def _snapshot_points(snapshots: list[AccountBalanceSnapshot], range_key: str, as_of: date) -> list[NetWorthHistoryPoint]:
    if not snapshots:
        return []
    start_date = _range_start(range_key, as_of)
    totals: dict[date, float] = {}
    for snapshot in snapshots:
        if snapshot.snapshot_date < start_date or snapshot.snapshot_date > as_of:
            continue
        totals[snapshot.snapshot_date] = totals.get(snapshot.snapshot_date, 0) + snapshot.balance
    return [NetWorthHistoryPoint(date=snapshot_date, value=_money(value)) for snapshot_date, value in sorted(totals.items())]


def _snapshot_points_cover_range_start(snapshot_points: list[NetWorthHistoryPoint], range_key: str, as_of: date) -> bool:
    if not snapshot_points:
        return False
    return snapshot_points[0].date <= _range_start(range_key, as_of)


def _transaction_estimate_points(
    transactions: list[Transaction],
    current_value: float,
    range_key: str,
    as_of: date,
) -> list[NetWorthHistoryPoint]:
    start_date = _range_start(range_key, as_of)
    in_range_transactions = [
        transaction for transaction in transactions if start_date <= transaction.transaction_date <= as_of
    ]
    if not in_range_transactions:
        return []

    first_transaction_date = min(transaction.transaction_date for transaction in in_range_transactions)
    first_date = max(start_date, first_transaction_date - timedelta(days=1))
    daily_changes: dict[date, float] = {}
    for transaction in in_range_transactions:
        daily_changes[transaction.transaction_date] = daily_changes.get(transaction.transaction_date, 0) + transaction.amount

    values_by_date: dict[date, float] = {}
    future_change = 0.0
    day = as_of
    while day >= first_date:
        values_by_date[day] = _money(current_value - future_change)
        future_change += daily_changes.get(day, 0)
        day -= timedelta(days=1)

    dates = sorted(values_by_date)
    sample_dates = _sample_dates(dates, _POINT_COUNTS[range_key])
    return [NetWorthHistoryPoint(date=point_date, value=values_by_date[point_date]) for point_date in sample_dates]


def _sample_dates(dates: list[date], max_count: int) -> list[date]:
    if len(dates) <= max_count:
        return dates
    sample_indexes = {
        round(index * (len(dates) - 1) / (max_count - 1))
        for index in range(max_count)
    }
    sample_indexes.add(0)
    sample_indexes.add(len(dates) - 1)
    return [dates[index] for index in sorted(sample_indexes)]


def _range_start(range_key: str, as_of: date) -> date:
    if range_key == "YTD":
        return date(as_of.year, 1, 1)
    days = {
        "1D": 1,
        "1W": 7,
        "1M": 31,
        "3M": 93,
        "6M": 186,
        "1Y": 366,
        "ALL": 3650,
    }[range_key]
    return as_of - timedelta(days=days)
