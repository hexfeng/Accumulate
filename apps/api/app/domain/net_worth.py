from datetime import date, timedelta
import math

from app.domain.schemas import Account, NetWorthHistory, NetWorthHistoryPoint


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


def build_net_worth_history(accounts: list[Account], range_key: str = "1M", as_of: date | None = None) -> NetWorthHistory:
    if range_key not in NET_WORTH_RANGES:
        raise ValueError(f"Unsupported net worth range: {range_key}")

    as_of = as_of or date.today()
    current_value = _money(sum(account.balance for account in accounts))
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
    )
