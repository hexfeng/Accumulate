from app.domain.schemas import Account, AssetAllocationItem, Holding, HoldingsAwareNetWorthSnapshot


def build_holdings_aware_net_worth(
    accounts: list[Account],
    holdings: list[Holding],
) -> HoldingsAwareNetWorthSnapshot:
    holdings_by_account: dict[str, list[Holding]] = {}
    for holding in holdings:
        holdings_by_account.setdefault(holding.account_id, []).append(holding)

    allocation_buckets = {
        "Cash": {"value": 0.0, "tone": "cash"},
        "Stocks": {"value": 0.0, "tone": "stocks"},
        "ETFs": {"value": 0.0, "tone": "etf"},
        "Investment balances": {"value": 0.0, "tone": "stocks"},
    }
    manual_holding_account_ids: list[str] = []
    total_value = 0.0
    investment_value = 0.0

    for account in accounts:
        account_holdings = holdings_by_account.get(account.id, [])
        if account.type == "investment" and account_holdings:
            manual_holding_account_ids.append(account.id)
            for holding in account_holdings:
                value = _money(holding.quantity * holding.market_price)
                total_value += value
                investment_value += value
                bucket = "ETFs" if _holding_tone(holding) == "etf" else "Stocks"
                allocation_buckets[bucket]["value"] += value
            continue

        value = _money(account.balance)
        total_value += value
        if account.type == "investment":
            investment_value += value
            if value > 0:
                allocation_buckets["Investment balances"]["value"] += value
        elif account.type in {"checking", "savings", "cash"} and value > 0:
            allocation_buckets["Cash"]["value"] += value

    total_value = _money(total_value)
    allocation_items = _with_percentages(_allocation_items(allocation_buckets))
    return HoldingsAwareNetWorthSnapshot(
        total_value=total_value,
        investment_value=_money(investment_value),
        asset_allocation=allocation_items,
        used_manual_holdings=bool(manual_holding_account_ids),
        manual_holding_account_ids=sorted(manual_holding_account_ids),
    )


def _allocation_items(buckets: dict[str, dict[str, float | str]]) -> list[AssetAllocationItem]:
    return [
        AssetAllocationItem(
            label=label,
            value=_money(float(bucket["value"])),
            percent=0,
            tone=str(bucket["tone"]),
        )
        for label, bucket in buckets.items()
        if float(bucket["value"]) > 0
    ]


def _with_percentages(items: list[AssetAllocationItem]) -> list[AssetAllocationItem]:
    allocation_total = _money(sum(item.value for item in items if item.value > 0))
    if allocation_total == 0:
        return items
    return [
        item.model_copy(update={"percent": _money((item.value / allocation_total) * 100)})
        for item in items
    ]


def _account_tone(account: Account) -> str:
    if account.type in {"checking", "savings", "cash"}:
        return "cash"
    if account.type == "investment":
        return "etf"
    return "stocks"


def _holding_tone(holding: Holding) -> str:
    haystack = f"{holding.symbol} {holding.name}".upper()
    return "etf" if "ETF" in haystack else "stocks"


def _money(value: float) -> float:
    return round(value + 0.0000001, 2)
