from app.domain.schemas import Account, AssetAllocationItem, Holding, HoldingsAwareNetWorthSnapshot


def build_holdings_aware_net_worth(
    accounts: list[Account],
    holdings: list[Holding],
) -> HoldingsAwareNetWorthSnapshot:
    holdings_by_account: dict[str, list[Holding]] = {}
    for holding in holdings:
        holdings_by_account.setdefault(holding.account_id, []).append(holding)

    allocation_items: list[AssetAllocationItem] = []
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
                allocation_items.append(
                    AssetAllocationItem(
                        label=holding.symbol,
                        value=value,
                        percent=0,
                        tone=_holding_tone(holding),
                    )
                )
            continue

        value = _money(account.balance)
        total_value += value
        if account.type == "investment":
            investment_value += value
        if value != 0:
            allocation_items.append(
                AssetAllocationItem(
                    label=account.name,
                    value=value,
                    percent=0,
                    tone=_account_tone(account),
                )
            )

    total_value = _money(total_value)
    allocation_items = _with_percentages(allocation_items, total_value)
    return HoldingsAwareNetWorthSnapshot(
        total_value=total_value,
        investment_value=_money(investment_value),
        asset_allocation=allocation_items,
        used_manual_holdings=bool(manual_holding_account_ids),
        manual_holding_account_ids=sorted(manual_holding_account_ids),
    )


def _with_percentages(
    items: list[AssetAllocationItem],
    total_value: float,
) -> list[AssetAllocationItem]:
    if total_value == 0:
        return items
    return [
        item.model_copy(update={"percent": _money((item.value / total_value) * 100)})
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
