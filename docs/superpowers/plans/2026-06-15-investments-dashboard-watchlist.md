# Investments Dashboard Watchlist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Dashboard net worth and allocation use manual holdings correctly, and add a configurable Investments watchlist backed by the existing quote provider.

**Architecture:** Add one backend domain helper for holdings-aware net worth so API routes do not duplicate portfolio math. Extend store interfaces with a small persisted watchlist and add API endpoints that resolve watchlist symbols through the existing quote service. Update Dashboard and Investments to consume these explicit backend contracts rather than reconstructing financial state in unrelated components.

**Tech Stack:** FastAPI, Pydantic, SQLAlchemy, pytest, Next.js, React, TypeScript, Vitest, Testing Library, existing yfinance quote adapter.

---

## File Map

- Create `apps/api/app/domain/holdings_aware_net_worth.py`
  - Owns the account replacement rule: investment account holdings replace that account balance; investment accounts without holdings keep balance; non-investment accounts keep balance.
- Modify `apps/api/app/domain/net_worth.py`
  - Accept an optional `current_value_override` so historical points can keep existing behavior while current net worth uses holdings-aware total.
- Modify `apps/api/app/domain/schemas.py`
  - Add Dashboard fields for real asset allocation, portfolio summary, and watchlist response models.
- Modify `apps/api/app/store.py`
  - Add LocalStore watchlist storage and methods.
- Modify `apps/api/app/db_store.py`
  - Add a `watchlist_symbols` table, schema upgrade, and DatabaseStore watchlist methods.
- Modify `apps/api/app/main.py`
  - Wire holdings-aware net worth into `/api/net-worth/history` and `/api/dashboard`.
  - Add watchlist endpoints.
- Modify `apps/api/tests/test_domain.py`
  - Add domain tests for holdings-aware replacement.
- Modify `apps/api/tests/test_api.py`
  - Add API tests for Dashboard, net worth, and watchlist.
- Modify `apps/api/tests/test_db_store.py`
  - Add DatabaseStore persistence tests for watchlist symbols.
- Modify `apps/web/lib/types.ts`
  - Add watchlist and Dashboard portfolio types.
- Modify `apps/web/lib/api.ts`
  - Add watchlist fetch/update functions and safe fallbacks.
- Modify `apps/web/lib/demo-data.ts`
  - Add demo Dashboard portfolio/allocation and watchlist data.
- Modify `apps/web/app/dashboard/page.tsx`
  - No structural change expected; it already fetches Dashboard and net worth.
- Modify `apps/web/app/investments/page.tsx`
  - Fetch initial watchlist.
- Modify `apps/web/components/dashboard-view.tsx`
  - Render real allocation and investment KPI.
- Modify `apps/web/components/dashboard-view.test.tsx`
  - Cover real Dashboard data and non-mock state.
- Modify `apps/web/components/investments-view.tsx`
  - Render and manage watchlist panel under summary metrics.
- Modify `apps/web/components/investments-view.test.tsx`
  - Cover watchlist cards, add/remove, and symbol error state.
- Modify `apps/web/app/globals.css`
  - Add watchlist panel/card styling.
- Modify `README.md` and `docs/MVP_FRONTEND_NAVIGATION.md`
  - Sync implemented status after code ships.

---

### Task 1: Holdings-Aware Net Worth Domain Helper

**Files:**
- Create: `apps/api/app/domain/holdings_aware_net_worth.py`
- Modify: `apps/api/app/domain/net_worth.py`
- Modify: `apps/api/app/domain/schemas.py`
- Test: `apps/api/tests/test_domain.py`

- [ ] **Step 1: Write failing domain tests**

Append these tests to `apps/api/tests/test_domain.py`:

```python
from app.domain.holdings_aware_net_worth import build_holdings_aware_net_worth
from app.domain.schemas import Holding


def test_holdings_aware_net_worth_replaces_investment_balance_per_account():
    accounts = [
        Account(id="tfsa", user_id=USER_ID, name="TFSA", type="investment", balance=10000, currency="CAD"),
        Account(id="rrsp", user_id=USER_ID, name="RRSP", type="investment", balance=4000, currency="CAD"),
        Account(id="cash", user_id=USER_ID, name="Cash", type="checking", balance=2000, currency="CAD"),
        Account(id="visa", user_id=USER_ID, name="Visa", type="credit_card", balance=-500, currency="CAD"),
    ]
    holdings = [
        Holding(
            id="vfv-to",
            user_id=USER_ID,
            account_id="tfsa",
            account_name="TFSA",
            symbol="VFV.TO",
            name="Vanguard S&P 500 ETF",
            quantity=80,
            average_cost=100,
            market_price=150,
            currency="CAD",
            source="manual",
        )
    ]

    snapshot = build_holdings_aware_net_worth(accounts, holdings)

    assert snapshot.total_value == 17500
    assert snapshot.investment_value == 16000
    assert snapshot.used_manual_holdings is True
    assert snapshot.manual_holding_account_ids == ["tfsa"]
    assert [(item.label, item.value, item.percent) for item in snapshot.asset_allocation] == [
        ("VFV.TO", 12000, 68.57),
        ("RRSP", 4000, 22.86),
        ("Cash", 2000, 11.43),
        ("Visa", -500, -2.86),
    ]


def test_net_worth_history_accepts_holdings_aware_current_value_override():
    accounts = [
        Account(id="tfsa", user_id=USER_ID, name="TFSA", type="investment", balance=10000, currency="CAD"),
        Account(id="cash", user_id=USER_ID, name="Cash", type="checking", balance=2000, currency="CAD"),
    ]

    history = build_net_worth_history(accounts, "1M", as_of=date(2026, 6, 15), current_value_override=14000)

    assert history.current_value == 14000
    assert history.points[-1].value == 14000
```

- [ ] **Step 2: Run domain tests and verify failure**

Run:

```powershell
python -m pytest apps/api/tests/test_domain.py::test_holdings_aware_net_worth_replaces_investment_balance_per_account apps/api/tests/test_domain.py::test_net_worth_history_accepts_holdings_aware_current_value_override -q
```

Expected: FAIL because `app.domain.holdings_aware_net_worth` does not exist and `build_net_worth_history()` does not accept `current_value_override`.

- [ ] **Step 3: Extend backend schemas**

In `apps/api/app/domain/schemas.py`, replace `AssetAllocationItem` and `DashboardSnapshot` with this expanded shape, preserving existing fields:

```python
class AssetAllocationItem(BaseModel):
    label: str
    value: float = 0
    percent: float
    tone: str = "stocks"
    is_mock: bool = False


class HoldingsAwareNetWorthSnapshot(BaseModel):
    total_value: float
    investment_value: float
    asset_allocation: list[AssetAllocationItem]
    used_manual_holdings: bool = False
    manual_holding_account_ids: list[str] = Field(default_factory=list)


class DashboardSnapshot(BaseModel):
    accounts: list[Account]
    monthly_summary: MonthlySummary
    recurring_items: list[RecurringItem]
    forecast: CashflowForecast
    asset_allocation: list[AssetAllocationItem] = Field(default_factory=list)
    investment_summary: PortfolioSnapshot | None = None
    net_worth_total: float = 0
    net_worth_uses_manual_holdings: bool = False
```

- [ ] **Step 4: Create holdings-aware helper**

Create `apps/api/app/domain/holdings_aware_net_worth.py`:

```python
from app.domain.schemas import Account, AssetAllocationItem, Holding, HoldingsAwareNetWorthSnapshot


def build_holdings_aware_net_worth(accounts: list[Account], holdings: list[Holding]) -> HoldingsAwareNetWorthSnapshot:
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


def _with_percentages(items: list[AssetAllocationItem], total_value: float) -> list[AssetAllocationItem]:
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
```

- [ ] **Step 5: Add current value override to net worth history**

In `apps/api/app/domain/net_worth.py`, update the signature and current value line:

```python
def build_net_worth_history(
    accounts: list[Account],
    range_key: str = "1M",
    snapshots: list[AccountBalanceSnapshot] | None = None,
    transactions: list[Transaction] | None = None,
    as_of: date | None = None,
    current_value_override: float | None = None,
) -> NetWorthHistory:
```

Replace:

```python
current_value = _money(sum(account.balance for account in accounts))
```

with:

```python
current_value = _money(current_value_override if current_value_override is not None else sum(account.balance for account in accounts))
```

- [ ] **Step 6: Run domain tests and verify pass**

Run:

```powershell
python -m pytest apps/api/tests/test_domain.py::test_holdings_aware_net_worth_replaces_investment_balance_per_account apps/api/tests/test_domain.py::test_net_worth_history_accepts_holdings_aware_current_value_override -q
```

Expected: PASS.

- [ ] **Step 7: Commit Task 1**

Run:

```powershell
git add apps/api/app/domain/holdings_aware_net_worth.py apps/api/app/domain/net_worth.py apps/api/app/domain/schemas.py apps/api/tests/test_domain.py
git commit -m "feat: add holdings-aware net worth helper"
```

---

### Task 2: Dashboard and Net Worth API Wiring

**Files:**
- Modify: `apps/api/app/main.py`
- Modify: `apps/api/tests/test_api.py`

- [ ] **Step 1: Write failing API tests**

Append these tests to `apps/api/tests/test_api.py`:

```python
def test_dashboard_and_net_worth_use_holdings_aware_investment_value():
    client = make_client()
    client.post("/api/accounts", json={"name": "TFSA", "type": "investment", "balance": 10000, "currency": "CAD"})
    client.post("/api/accounts", json={"name": "RRSP", "type": "investment", "balance": 4000, "currency": "CAD"})
    client.post("/api/accounts", json={"name": "Cash", "type": "checking", "balance": 2000, "currency": "CAD"})
    client.post("/api/accounts", json={"name": "Visa", "type": "credit_card", "balance": -500, "currency": "CAD"})
    client.post(
        "/api/holdings",
        json={
            "account_id": "tfsa",
            "symbol": "VFV.TO",
            "name": "Vanguard S&P 500 ETF",
            "quantity": 80,
            "average_cost": 100,
            "market_price": 150,
            "currency": "CAD",
        },
    )

    dashboard = client.get("/api/dashboard").json()
    history = client.get("/api/net-worth/history?range=1M").json()

    assert dashboard["net_worth_total"] == 17500
    assert dashboard["net_worth_uses_manual_holdings"] is True
    assert dashboard["investment_summary"]["total_value"] == 12000
    assert dashboard["asset_allocation"][0]["label"] == "VFV.TO"
    assert dashboard["asset_allocation"][0]["value"] == 12000
    assert history["current_value"] == 17500
    assert history["points"][-1]["value"] == 17500
```

- [ ] **Step 2: Run API test and verify failure**

Run:

```powershell
python -m pytest apps/api/tests/test_api.py::test_dashboard_and_net_worth_use_holdings_aware_investment_value -q
```

Expected: FAIL because `/api/dashboard` does not return the new fields and `/api/net-worth/history` still sums account balances.

- [ ] **Step 3: Wire helper into API**

In `apps/api/app/main.py`, add import:

```python
from app.domain.holdings_aware_net_worth import build_holdings_aware_net_worth
```

Update `/api/net-worth/history`:

```python
    @app.get("/api/net-worth/history", response_model=NetWorthHistory)
    def net_worth_history(range: NetWorthRange = "1M") -> NetWorthHistory:
        snapshots = app.state.store.list_account_balance_snapshots() if hasattr(app.state.store, "list_account_balance_snapshots") else []
        holdings_aware = build_holdings_aware_net_worth(app.state.store.list_accounts(), app.state.store.list_holdings())
        return build_net_worth_history(
            app.state.store.list_accounts(),
            range,
            snapshots=snapshots,
            transactions=app.state.store.list_transactions(),
            current_value_override=holdings_aware.total_value,
        )
```

Update `/api/dashboard`:

```python
    @app.get("/api/dashboard", response_model=DashboardSnapshot)
    def dashboard() -> DashboardSnapshot:
        accounts = app.state.store.list_accounts()
        holdings = app.state.store.list_holdings()
        transactions = app.state.store.list_transactions()
        holdings_aware = build_holdings_aware_net_worth(accounts, holdings)
        return DashboardSnapshot(
            accounts=accounts,
            monthly_summary=build_monthly_summary(transactions, app.state.store.budget),
            recurring_items=detect_recurring_items(transactions),
            forecast=build_cashflow_forecast(accounts, transactions),
            asset_allocation=holdings_aware.asset_allocation,
            investment_summary=app.state.store.portfolio_snapshot(),
            net_worth_total=holdings_aware.total_value,
            net_worth_uses_manual_holdings=holdings_aware.used_manual_holdings,
        )
```

- [ ] **Step 4: Run API tests and update old assertion if needed**

Run:

```powershell
python -m pytest apps/api/tests/test_api.py::test_dashboard_and_net_worth_use_holdings_aware_investment_value apps/api/tests/test_api.py::test_net_worth_history_api_returns_supported_ranges_with_current_balance -q
```

Expected: PASS. The existing demo range test should still pass because demo data has no holdings.

- [ ] **Step 5: Commit Task 2**

Run:

```powershell
git add apps/api/app/main.py apps/api/tests/test_api.py
git commit -m "feat: connect dashboard net worth to holdings"
```

---

### Task 3: Watchlist Store and API

**Files:**
- Modify: `apps/api/app/domain/schemas.py`
- Modify: `apps/api/app/store.py`
- Modify: `apps/api/app/db_store.py`
- Modify: `apps/api/app/main.py`
- Modify: `apps/api/tests/test_api.py`
- Modify: `apps/api/tests/test_db_store.py`

- [ ] **Step 1: Write failing API and DB tests**

Append to `apps/api/tests/test_api.py`:

```python
def test_watchlist_returns_default_symbols_with_quotes_and_symbol_errors():
    class PartialQuoteService(FakeQuoteService):
        def get_quote(self, symbol: str):
            if symbol.strip().upper() == "^RUT":
                raise RuntimeError("rate limited")
            return {
                "symbol": symbol.strip().upper(),
                "name": f"{symbol.strip().upper()} Index",
                "price": 1000,
                "currency": "USD",
                "provider": "test",
                "as_of": "2026-06-12T13:00:00Z",
            }

    client = TestClient(create_app(store=LocalStore(), quote_service=PartialQuoteService()))

    response = client.get("/api/watchlist")

    assert response.status_code == 200
    data = response.json()
    assert [item["symbol"] for item in data["items"]] == ["^DJI", "^GSPC", "^IXIC", "^RUT", "^GSPTSE"]
    assert data["items"][0]["price"] == 1000
    assert data["items"][3]["price"] is None
    assert data["items"][3]["error"] == "Quote unavailable"


def test_watchlist_symbols_can_be_replaced():
    client = TestClient(create_app(store=LocalStore(), quote_service=FakeQuoteService()))

    response = client.put("/api/watchlist/symbols", json={"symbols": ["vfv.to", " CASH.TO ", "vfv.to"]})

    assert response.status_code == 200
    assert response.json()["symbols"] == ["VFV.TO", "CASH.TO"]
    assert client.get("/api/watchlist/symbols").json()["symbols"] == ["VFV.TO", "CASH.TO"]
```

Append to `apps/api/tests/test_db_store.py`:

```python
def test_database_store_persists_watchlist_symbols():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool, future=True)
    store = DatabaseStore.from_engine(engine)

    assert store.list_watchlist_symbols() == ["^DJI", "^GSPC", "^IXIC", "^RUT", "^GSPTSE"]
    store.replace_watchlist_symbols(["VFV.TO", "CASH.TO"])

    reloaded = DatabaseStore.from_engine(engine)
    assert reloaded.list_watchlist_symbols() == ["VFV.TO", "CASH.TO"]
```

- [ ] **Step 2: Run new watchlist tests and verify failure**

Run:

```powershell
python -m pytest apps/api/tests/test_api.py::test_watchlist_returns_default_symbols_with_quotes_and_symbol_errors apps/api/tests/test_api.py::test_watchlist_symbols_can_be_replaced apps/api/tests/test_db_store.py::test_database_store_persists_watchlist_symbols -q
```

Expected: FAIL because watchlist schemas, store methods, and routes do not exist.

- [ ] **Step 3: Add watchlist schemas**

In `apps/api/app/domain/schemas.py`, add:

```python
class WatchlistItem(BaseModel):
    symbol: str
    name: str
    price: float | None = None
    currency: str = "CAD"
    change_amount: float | None = None
    change_pct: float | None = None
    provider: str | None = None
    as_of: str | None = None
    error: str | None = None


class WatchlistResponse(BaseModel):
    symbols: list[str]
    items: list[WatchlistItem]


class WatchlistSymbolsRequest(BaseModel):
    symbols: list[str]


class WatchlistSymbolsResponse(BaseModel):
    symbols: list[str]
```

- [ ] **Step 4: Add LocalStore watchlist methods**

In `apps/api/app/store.py`, define defaults near `LOCAL_USER_ID`:

```python
DEFAULT_WATCHLIST_SYMBOLS = ["^DJI", "^GSPC", "^IXIC", "^RUT", "^GSPTSE"]
```

Add field to `LocalStore`:

```python
    watchlist_symbols: list[str] = field(default_factory=lambda: list(DEFAULT_WATCHLIST_SYMBOLS))
```

Add methods inside `LocalStore`:

```python
    def list_watchlist_symbols(self) -> list[str]:
        return list(self.watchlist_symbols or DEFAULT_WATCHLIST_SYMBOLS)

    def replace_watchlist_symbols(self, symbols: list[str]) -> list[str]:
        cleaned = _normalize_symbol_list(symbols)
        self.watchlist_symbols = cleaned or list(DEFAULT_WATCHLIST_SYMBOLS)
        return list(self.watchlist_symbols)
```

Add module helper:

```python
def _normalize_symbol_list(symbols: list[str]) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for symbol in symbols:
        cleaned = symbol.strip().upper()
        if not cleaned or cleaned in seen:
            continue
        normalized.append(cleaned)
        seen.add(cleaned)
    return normalized[:12]
```

- [ ] **Step 5: Add DatabaseStore watchlist table and methods**

In `apps/api/app/db_store.py`, import defaults:

```python
from app.store import LOCAL_USER_ID, DEFAULT_WATCHLIST_SYMBOLS, AccountConflictError, AccountNotFoundError, _build_portfolio_snapshot, _clean_simplefin_account_name, _date_from_iso, _infer_simplefin_account_type, _latest_statement_row_date, _money, _normalize_simplefin_account_type, _normalize_symbol_list, _simplefin_account_institution, _simplefin_connection_names, _simplefin_institution_overrides, _simplefin_transaction_date, _slug, _statement_transaction_from_row
```

Add table:

```python
watchlist_symbols = Table(
    "watchlist_symbols",
    metadata,
    Column("symbol", String, primary_key=True),
    Column("position", Float, nullable=False),
)
```

Add method:

```python
    def _ensure_watchlist_defaults(self) -> None:
        with self.engine.begin() as connection:
            existing = connection.execute(select(watchlist_symbols.c.symbol)).first()
            if existing is not None:
                return
            for index, symbol in enumerate(DEFAULT_WATCHLIST_SYMBOLS):
                connection.execute(insert(watchlist_symbols).values(symbol=symbol, position=index))
```

Call it from `__init__` and `from_engine` after `_ensure_settings()`:

```python
        self._ensure_watchlist_defaults()
```

Add methods:

```python
    def list_watchlist_symbols(self) -> list[str]:
        with self.engine.begin() as connection:
            rows = connection.execute(select(watchlist_symbols).order_by(watchlist_symbols.c.position)).mappings().all()
        return [str(row["symbol"]) for row in rows] or list(DEFAULT_WATCHLIST_SYMBOLS)

    def replace_watchlist_symbols(self, symbols: list[str]) -> list[str]:
        cleaned = _normalize_symbol_list(symbols)
        if not cleaned:
            cleaned = list(DEFAULT_WATCHLIST_SYMBOLS)
        with self.engine.begin() as connection:
            connection.execute(delete(watchlist_symbols))
            for index, symbol in enumerate(cleaned):
                connection.execute(insert(watchlist_symbols).values(symbol=symbol, position=index))
        return cleaned
```

- [ ] **Step 6: Add watchlist routes**

In `apps/api/app/main.py`, extend schema imports with:

```python
WatchlistItem, WatchlistResponse, WatchlistSymbolsRequest, WatchlistSymbolsResponse
```

Add routes before quote endpoints:

```python
    @app.get("/api/watchlist/symbols", response_model=WatchlistSymbolsResponse)
    def get_watchlist_symbols() -> WatchlistSymbolsResponse:
        return WatchlistSymbolsResponse(symbols=app.state.store.list_watchlist_symbols())

    @app.put("/api/watchlist/symbols", response_model=WatchlistSymbolsResponse)
    def replace_watchlist_symbols(request: WatchlistSymbolsRequest) -> WatchlistSymbolsResponse:
        return WatchlistSymbolsResponse(symbols=app.state.store.replace_watchlist_symbols(request.symbols))

    @app.get("/api/watchlist", response_model=WatchlistResponse)
    def watchlist() -> WatchlistResponse:
        symbols = app.state.store.list_watchlist_symbols()
        return WatchlistResponse(
            symbols=symbols,
            items=[_watchlist_item(symbol, app.state.quote_service, app.state.store) for symbol in symbols],
        )
```

Add module helper:

```python
def _watchlist_item(symbol: str, quote_service: YahooFinanceQuoteService, store: LocalStore | DatabaseStore) -> WatchlistItem:
    normalized = symbol.strip().upper()
    try:
        quote = MarketQuote.model_validate(quote_service.get_quote(normalized))
        saved = store.save_market_quote(quote)
        return WatchlistItem(
            symbol=saved.symbol,
            name=saved.name,
            price=saved.price,
            currency=saved.currency,
            change_amount=None,
            change_pct=None,
            provider=saved.provider,
            as_of=saved.as_of,
        )
    except Exception:
        return WatchlistItem(symbol=normalized, name=normalized, error="Quote unavailable")
```

- [ ] **Step 7: Run watchlist tests and verify pass**

Run:

```powershell
python -m pytest apps/api/tests/test_api.py::test_watchlist_returns_default_symbols_with_quotes_and_symbol_errors apps/api/tests/test_api.py::test_watchlist_symbols_can_be_replaced apps/api/tests/test_db_store.py::test_database_store_persists_watchlist_symbols -q
```

Expected: PASS.

- [ ] **Step 8: Commit Task 3**

Run:

```powershell
git add apps/api/app/domain/schemas.py apps/api/app/store.py apps/api/app/db_store.py apps/api/app/main.py apps/api/tests/test_api.py apps/api/tests/test_db_store.py
git commit -m "feat: add investment watchlist api"
```

---

### Task 4: Dashboard Frontend Uses Real Net Worth and Allocation

**Files:**
- Modify: `apps/web/lib/types.ts`
- Modify: `apps/web/lib/demo-data.ts`
- Modify: `apps/web/components/dashboard-view.tsx`
- Modify: `apps/web/components/dashboard-view.test.tsx`

- [ ] **Step 1: Write failing Dashboard tests**

In `apps/web/components/dashboard-view.test.tsx`, append:

```tsx
it("renders holdings-aware net worth, real allocation, and investment KPI", () => {
  render(
    <DashboardView
      initialNetWorthHistory={{ ...demoNetWorthHistoryByRange["1M"], current_value: 17500 }}
      snapshot={{
        ...demoDashboard,
        net_worth_total: 17500,
        net_worth_uses_manual_holdings: true,
        investment_summary: {
          total_value: 12000,
          total_cost: 8000,
          unrealized_gain: 4000,
          unrealized_gain_pct: 50,
          allocation: [{ label: "VFV.TO", value: 12000, percent: 100 }],
          accounts: [{ account_id: "tfsa", account_name: "TFSA", value: 12000, holdings_count: 1 }]
        },
        asset_allocation: [
          { label: "VFV.TO", value: 12000, percent: 68.57, tone: "etf" },
          { label: "RRSP", value: 4000, percent: 22.86, tone: "etf" },
          { label: "Cash", value: 2000, percent: 11.43, tone: "cash" },
          { label: "Visa", value: -500, percent: -2.86, tone: "stocks" }
        ]
      }}
    />
  );

  expect(screen.getAllByText("$17,500.00").length).toBeGreaterThan(0);
  expect(screen.getByText("Holdings-aware estimate")).toBeInTheDocument();
  expect(screen.getByText("Asset mix")).toBeInTheDocument();
  expect(screen.queryByText("Mock asset mix")).not.toBeInTheDocument();
  expect(screen.getByRole("img", { name: "VFV.TO 69%, RRSP 23%, Cash 11%, Visa -3%" })).toBeInTheDocument();
  expect(screen.getByText("$12,000.00")).toBeInTheDocument();
  expect(screen.getByText("Portfolio value")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run Dashboard test and verify failure**

Run:

```powershell
npm run test --workspace @finsight/web -- dashboard-view.test.tsx
```

Expected: FAIL because the frontend types and component still assume mock allocation and `Investments` value is `Not set`.

- [ ] **Step 3: Extend frontend types and demo data**

In `apps/web/lib/types.ts`, update `AssetAllocationItem` and `DashboardSnapshot`:

```ts
export type AssetAllocationItem = {
  label: string;
  value?: number;
  percent: number;
  tone: "stocks" | "etf" | "cash";
  is_mock?: boolean;
};
```

```ts
export type DashboardSnapshot = {
  accounts: Account[];
  asset_allocation?: AssetAllocationItem[];
  investment_summary?: PortfolioSnapshot | null;
  net_worth_total?: number;
  net_worth_uses_manual_holdings?: boolean;
  monthly_summary: MonthlySummary;
  recurring_items: RecurringItem[];
  forecast: CashflowForecast;
};
```

In `apps/web/lib/demo-data.ts`, add:

```ts
  investment_summary: demoPortfolio,
  net_worth_total: 14540,
  net_worth_uses_manual_holdings: false,
```

inside `demoDashboard`.

- [ ] **Step 4: Update DashboardView rendering**

In `apps/web/components/dashboard-view.tsx`, replace:

```ts
  const accountsOnlyNetWorth = snapshot.accounts.reduce((sum, account) => sum + account.balance, 0);
  const totalNetWorth = initialNetWorthHistory.current_value || accountsOnlyNetWorth;
```

with:

```ts
  const accountsOnlyNetWorth = snapshot.accounts.reduce((sum, account) => sum + account.balance, 0);
  const totalNetWorth = initialNetWorthHistory.current_value || snapshot.net_worth_total || accountsOnlyNetWorth;
  const investmentValue = snapshot.investment_summary?.total_value ?? snapshot.accounts
    .filter((account) => account.type === "investment")
    .reduce((sum, account) => sum + Math.max(account.balance, 0), 0);
```

Replace asset allocation line:

```ts
  const assetAllocation = normalizeAssetAllocation(snapshot.asset_allocation?.length ? snapshot.asset_allocation : MOCK_ASSET_ALLOCATION);
```

with:

```ts
  const realAllocation = snapshot.asset_allocation?.filter((asset) => asset.value == null || asset.value !== 0) ?? [];
  const assetAllocation = normalizeAssetAllocation(realAllocation.length ? realAllocation : MOCK_ASSET_ALLOCATION);
```

Replace hero copy:

```tsx
          <p>Accounts-only estimate {"\u00b7"} {hasMockAllocation ? "Mock allocation until holdings connect" : "Holdings allocation connected"}</p>
```

with:

```tsx
          <p>{snapshot.net_worth_uses_manual_holdings ? "Holdings-aware estimate" : "Accounts and synced balances"} {"\u00b7"} {hasMockAllocation ? "Mock allocation until holdings connect" : "Real allocation connected"}</p>
```

Replace Investments KPI:

```tsx
        <DashboardKpiCard href="/investments" label="Investments" value="Not set" meta="Add holdings" tone="indigo" />
```

with:

```tsx
        <DashboardKpiCard
          href="/investments"
          label="Investments"
          value={investmentValue > 0 ? formatCurrency(investmentValue) : "Not set"}
          meta={investmentValue > 0 ? "Portfolio value" : "Add holdings"}
          tone="indigo"
        />
```

- [ ] **Step 5: Keep allocation percentages readable**

In `normalizeAssetAllocation()`, preserve negative credit-card percentages and round normally:

```ts
function normalizeAssetAllocation(items: AssetAllocationItem[]) {
  const positiveTotal = items.filter((item) => item.percent > 0).reduce((sum, item) => sum + item.percent, 0);
  if (positiveTotal <= 0) {
    return MOCK_ASSET_ALLOCATION;
  }
  return items.map((item) => ({
    ...item,
    percent: Math.round(item.percent)
  }));
}
```

- [ ] **Step 6: Run Dashboard tests**

Run:

```powershell
npm run test --workspace @finsight/web -- dashboard-view.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit Task 4**

Run:

```powershell
git add apps/web/lib/types.ts apps/web/lib/demo-data.ts apps/web/components/dashboard-view.tsx apps/web/components/dashboard-view.test.tsx
git commit -m "feat: show real dashboard investment allocation"
```

---

### Task 5: Investments Watchlist Frontend

**Files:**
- Modify: `apps/web/lib/types.ts`
- Modify: `apps/web/lib/api.ts`
- Modify: `apps/web/lib/demo-data.ts`
- Modify: `apps/web/app/investments/page.tsx`
- Modify: `apps/web/components/investments-view.tsx`
- Modify: `apps/web/components/investments-view.test.tsx`
- Modify: `apps/web/app/globals.css`

- [ ] **Step 1: Write failing Investments watchlist tests**

In `apps/web/components/investments-view.test.tsx`, update the `vi.mock("@/lib/api"...` return object with:

```ts
    getWatchlist: vi.fn(),
    replaceWatchlistSymbols: vi.fn(),
```

Add imports from types if needed:

```ts
import type { Account, Holding, PortfolioSnapshot, WatchlistResponse } from "@/lib/types";
```

Add test data near `portfolio`:

```ts
const watchlist: WatchlistResponse = {
  symbols: ["^GSPC", "^IXIC"],
  items: [
    {
      symbol: "^GSPC",
      name: "S&P 500",
      price: 7431.46,
      currency: "USD",
      change_amount: 37.16,
      change_pct: 0.5,
      provider: "test",
      as_of: "2026-06-12T13:00:00Z"
    },
    {
      symbol: "^IXIC",
      name: "Nasdaq",
      price: null,
      currency: "USD",
      change_amount: null,
      change_pct: null,
      provider: null,
      as_of: null,
      error: "Quote unavailable"
    }
  ]
};
```

In `beforeEach`, add:

```ts
    vi.mocked(api.getWatchlist).mockResolvedValue(watchlist);
    vi.mocked(api.replaceWatchlistSymbols).mockResolvedValue(watchlist);
```

Append tests:

```tsx
it("renders watchlist cards below the investment summary", async () => {
  render(<InvestmentsView accounts={accounts} initialHoldings={holdings} initialPortfolio={portfolio} initialWatchlist={watchlist} />);

  expect(screen.getByText("Watchlist")).toBeInTheDocument();
  expect(screen.getByText("S&P 500")).toBeInTheDocument();
  expect(screen.getByText("7,431.46")).toBeInTheDocument();
  expect(screen.getByText("+0.50%")).toBeInTheDocument();
  expect(screen.getByText("Nasdaq")).toBeInTheDocument();
  expect(screen.getByText("Quote unavailable")).toBeInTheDocument();
});


it("adds and removes watchlist symbols", async () => {
  vi.mocked(api.replaceWatchlistSymbols).mockResolvedValue({
    symbols: ["^GSPC", "VFV.TO"],
    items: [
      watchlist.items[0],
      {
        symbol: "VFV.TO",
        name: "Vanguard S&P 500 ETF",
        price: 150,
        currency: "CAD",
        change_amount: null,
        change_pct: null,
        provider: "test",
        as_of: "2026-06-12T13:00:00Z"
      }
    ]
  });
  render(<InvestmentsView accounts={accounts} initialHoldings={holdings} initialPortfolio={portfolio} initialWatchlist={watchlist} />);

  fireEvent.change(screen.getByLabelText("Add watchlist symbol"), { target: { value: "vfv.to" } });
  fireEvent.click(screen.getByRole("button", { name: "Add symbol" }));

  await waitFor(() => expect(api.replaceWatchlistSymbols).toHaveBeenCalledWith(["^GSPC", "^IXIC", "VFV.TO"]));
  await waitFor(() => expect(screen.getByText("Vanguard S&P 500 ETF")).toBeInTheDocument());

  fireEvent.click(screen.getByRole("button", { name: "Remove VFV.TO" }));
  await waitFor(() => expect(api.replaceWatchlistSymbols).toHaveBeenLastCalledWith(["^GSPC"]));
});
```

- [ ] **Step 2: Run Investments test and verify failure**

Run:

```powershell
npm run test --workspace @finsight/web -- investments-view.test.tsx
```

Expected: FAIL because watchlist types, API functions, props, and UI do not exist.

- [ ] **Step 3: Add frontend watchlist types and API functions**

In `apps/web/lib/types.ts`, add:

```ts
export type WatchlistItem = {
  symbol: string;
  name: string;
  price?: number | null;
  currency: string;
  change_amount?: number | null;
  change_pct?: number | null;
  provider?: string | null;
  as_of?: string | null;
  error?: string | null;
};

export type WatchlistResponse = {
  symbols: string[];
  items: WatchlistItem[];
};
```

In `apps/web/lib/demo-data.ts`, export:

```ts
export const demoWatchlist: WatchlistResponse = {
  symbols: ["^DJI", "^GSPC", "^IXIC", "^RUT", "^GSPTSE"],
  items: [
    { symbol: "^DJI", name: "Dow Jones", price: 51202.26, currency: "USD", change_amount: 353.51, change_pct: 0.7, provider: "demo", as_of: "2026-06-12T13:00:00Z" },
    { symbol: "^GSPC", name: "S&P 500", price: 7431.46, currency: "USD", change_amount: 37.16, change_pct: 0.5, provider: "demo", as_of: "2026-06-12T13:00:00Z" },
    { symbol: "^IXIC", name: "Nasdaq", price: 25888.84, currency: "USD", change_amount: 79.18, change_pct: 0.31, provider: "demo", as_of: "2026-06-12T13:00:00Z" },
    { symbol: "^RUT", name: "Russell 2000", price: 2943.99, currency: "USD", change_amount: 22.96, change_pct: 0.79, provider: "demo", as_of: "2026-06-12T13:00:00Z" },
    { symbol: "^GSPTSE", name: "TSX", price: 34937.85, currency: "CAD", change_amount: 266.39, change_pct: 0.77, provider: "demo", as_of: "2026-06-12T13:00:00Z" }
  ]
};
```

In `apps/web/lib/api.ts`, import `demoWatchlist` and add:

```ts
export function getWatchlist(): Promise<WatchlistResponse> {
  return getJson("/api/watchlist", demoWatchlist);
}

export async function replaceWatchlistSymbols(symbols: string[]): Promise<WatchlistResponse> {
  await sendJson<{ symbols: string[] }>("/api/watchlist/symbols", "PUT", { symbols });
  return getWatchlist();
}
```

- [ ] **Step 4: Fetch watchlist in Investments page**

In `apps/web/app/investments/page.tsx`, update imports:

```ts
import { getAccounts, getHoldings, getPortfolio, getWatchlist } from "@/lib/api";
```

Update fetch:

```tsx
  const [accounts, holdings, portfolio, watchlist] = await Promise.all([getAccounts(), getHoldings(), getPortfolio(), getWatchlist()]);
```

Update component:

```tsx
      <InvestmentsView accounts={accounts} initialHoldings={holdings} initialPortfolio={portfolio} initialWatchlist={watchlist} />
```

- [ ] **Step 5: Add watchlist UI to InvestmentsView**

In `apps/web/components/investments-view.tsx`, update imports:

```ts
import { createHolding, deleteHolding, getQuote, refreshQuotes, replaceWatchlistSymbols, searchSecurities, updateHolding } from "@/lib/api";
import type { Account, Holding, HoldingInput, PortfolioSnapshot, SecuritySearchResult, WatchlistItem, WatchlistResponse } from "@/lib/types";
```

Update props:

```ts
type InvestmentsViewProps = {
  accounts: Account[];
  initialHoldings: Holding[];
  initialPortfolio: PortfolioSnapshot;
  initialWatchlist: WatchlistResponse;
};
```

Update function signature and state:

```tsx
export function InvestmentsView({ accounts, initialHoldings, initialPortfolio, initialWatchlist }: InvestmentsViewProps) {
  const [watchlist, setWatchlist] = useState(initialWatchlist);
  const [watchlistDraft, setWatchlistDraft] = useState("");
```

Add functions inside component:

```tsx
  async function addWatchlistSymbol(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const symbol = watchlistDraft.trim().toUpperCase();
    if (!symbol || watchlist.symbols.includes(symbol)) {
      setWatchlistDraft("");
      return;
    }
    const updated = await replaceWatchlistSymbols([...watchlist.symbols, symbol]);
    setWatchlist(updated);
    setWatchlistDraft("");
  }

  async function removeWatchlistSymbol(symbol: string) {
    const updated = await replaceWatchlistSymbols(watchlist.symbols.filter((item) => item !== symbol));
    setWatchlist(updated);
  }
```

Render after summary grid:

```tsx
      <WatchlistPanel
        draft={watchlistDraft}
        items={watchlist.items}
        onDraftChange={setWatchlistDraft}
        onAdd={addWatchlistSymbol}
        onRemove={(symbol) => void removeWatchlistSymbol(symbol)}
      />
```

Add components near `MetricCard`:

```tsx
function WatchlistPanel({
  draft,
  items,
  onAdd,
  onDraftChange,
  onRemove
}: {
  draft: string;
  items: WatchlistItem[];
  onAdd: (event: React.FormEvent<HTMLFormElement>) => void;
  onDraftChange: (value: string) => void;
  onRemove: (symbol: string) => void;
}) {
  return (
    <article className="panel watchlist-panel">
      <div className="panel-heading compact">
        <h2>Watchlist</h2>
        <form className="watchlist-form" onSubmit={onAdd}>
          <label>
            <span className="sr-only">Add watchlist symbol</span>
            <input aria-label="Add watchlist symbol" value={draft} onChange={(event) => onDraftChange(event.target.value)} />
          </label>
          <button type="submit">Add symbol</button>
        </form>
      </div>
      <div className="watchlist-strip">
        {items.map((item) => (
          <WatchlistCard item={item} key={item.symbol} onRemove={() => onRemove(item.symbol)} />
        ))}
      </div>
    </article>
  );
}

function WatchlistCard({ item, onRemove }: { item: WatchlistItem; onRemove: () => void }) {
  const change = item.change_pct ?? 0;
  const isPositive = change >= 0;
  return (
    <div className="watchlist-card">
      <button type="button" className="watchlist-remove" onClick={onRemove} aria-label={`Remove ${item.symbol}`}>×</button>
      <span>{item.name || item.symbol}</span>
      {item.error ? (
        <strong>{item.error}</strong>
      ) : (
        <>
          <strong>{formatMarketNumber(item.price ?? 0)}</strong>
          <small>{formatChangeAmount(item.change_amount)} {formatSignedPercent(change, isPositive)}</small>
          <div className={`watchlist-spark ${isPositive ? "positive" : "negative"}`} aria-hidden="true" />
        </>
      )}
    </div>
  );
}

function formatMarketNumber(value: number) {
  return new Intl.NumberFormat("en-CA", { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(value);
}

function formatChangeAmount(value?: number | null) {
  if (value == null) {
    return "";
  }
  const sign = value >= 0 ? "+" : "";
  return `${sign}${formatMarketNumber(value)}`;
}

function formatSignedPercent(value: number, isPositive: boolean) {
  const sign = isPositive ? "+" : "";
  return `${sign}${formatPercent(value)}`;
}
```

- [ ] **Step 6: Add watchlist CSS**

In `apps/web/app/globals.css`, add:

```css
.watchlist-panel {
  overflow: hidden;
}

.watchlist-form {
  display: flex;
  gap: 8px;
  align-items: center;
}

.watchlist-form input {
  width: 150px;
}

.watchlist-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.watchlist-card {
  position: relative;
  display: grid;
  gap: 6px;
  min-height: 132px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
}

.watchlist-card > span {
  font-weight: 700;
}

.watchlist-card > strong {
  font-size: 1.35rem;
}

.watchlist-card > small {
  color: var(--success);
  font-weight: 700;
}

.watchlist-remove {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  border-radius: 999px;
}

.watchlist-spark {
  height: 30px;
  margin-top: 8px;
  border-radius: 999px;
  background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--success) 28%, transparent));
  border-bottom: 2px solid var(--success);
}

.watchlist-spark.negative {
  background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--danger) 28%, transparent));
  border-bottom-color: var(--danger);
}
```

- [ ] **Step 7: Run Investments tests**

Run:

```powershell
npm run test --workspace @finsight/web -- investments-view.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit Task 5**

Run:

```powershell
git add apps/web/lib/types.ts apps/web/lib/api.ts apps/web/lib/demo-data.ts apps/web/app/investments/page.tsx apps/web/components/investments-view.tsx apps/web/components/investments-view.test.tsx apps/web/app/globals.css
git commit -m "feat: add investments watchlist panel"
```

---

### Task 6: Documentation Sync and Full Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/MVP_FRONTEND_NAVIGATION.md`

- [ ] **Step 1: Update README shipped feature wording**

In `README.md`, update the Investments bullet to mention:

```md
- Investments MVP with manual holdings CRUD, Yahoo Finance-backed security search, cached portfolio price refresh, watchlist cards, portfolio value, cost basis, unrealized gain, allocation, and account grouping.
```

Add a changelog bullet under the latest MVP section:

```md
- Dashboard net worth and asset allocation now use holdings-aware investment values, replacing investment account balances with manual holdings per account to avoid double counting.
- Added configurable Investments watchlist cards backed by the existing quote provider.
```

- [ ] **Step 2: Update MVP navigation doc**

In `docs/MVP_FRONTEND_NAVIGATION.md`, update the Investments row description to include:

```md
Manual holdings CRUD, stock/ETF autocomplete, cached Yahoo Finance-backed portfolio price refresh, configurable market watchlist cards, portfolio value, cost basis, unrealized gain, allocation, and account grouping.
```

Add a notes bullet near the existing 2026-06-09 Investments notes:

```md
Dashboard net worth now uses holdings-aware investment values: manual holdings replace the matching investment account balance, while investment accounts without holdings continue to contribute their synced or manual balance.
```

- [ ] **Step 3: Run backend verification**

Run:

```powershell
npm run test:api
```

Expected: PASS.

- [ ] **Step 4: Run frontend verification**

Run:

```powershell
npm run test:web
```

Expected: PASS.

- [ ] **Step 5: Run production build**

Run:

```powershell
npm run build:web
```

Expected: PASS.

- [ ] **Step 6: Run diff hygiene**

Run:

```powershell
git diff --check
git status --short
```

Expected: `git diff --check` has no output. `git status --short` should show only intentional source/doc changes plus any pre-existing unrelated `.codex-api.out.log` change.

- [ ] **Step 7: Commit Task 6**

Run:

```powershell
git add README.md docs/MVP_FRONTEND_NAVIGATION.md
git commit -m "docs: sync dashboard investments watchlist status"
```

---

## Self-Review

Spec coverage:

- Dashboard net worth includes holdings without double counting: Tasks 1, 2, and 4.
- Real Dashboard asset allocation: Tasks 1, 2, and 4.
- Dashboard Investments KPI uses portfolio value: Task 4.
- Configurable watchlist under Investments summary: Tasks 3 and 5.
- yfinance-backed quote path without TradingView backend data use: Task 3.
- Per-symbol quote failure state: Tasks 3 and 5.
- OCR import remains second phase: intentionally excluded from implementation tasks and documented in the spec.
- Verification commands: Task 6.

Plan hygiene:

- No incomplete requirement markers are present.
- Types introduced in API tasks match frontend types by name and response shape.
- Store methods are defined for both LocalStore and DatabaseStore before API routes call them.

