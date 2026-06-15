import os
from datetime import date
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.integrations.market_data import MarketDataError, YahooFinanceQuoteService
from app.integrations.simplefin import SimpleFinService
from app.domain.analytics import build_monthly_summary
from app.domain.forecast import build_cashflow_forecast
from app.domain.holdings_aware_net_worth import build_holdings_aware_net_worth
from app.domain.net_worth import build_net_worth_history
from app.domain.recurring import detect_recurring_items
from app.domain.schemas import Account, AccountCreateRequest, AccountDeleteResponse, AccountUpdateRequest, BudgetSettings, CsvTransactionRow, DashboardSnapshot, Holding, HoldingDeleteResponse, HoldingRequest, MarketQuote, NetWorthHistory, PortfolioSnapshot, QuoteRefreshResponse, SecuritySearchResult, SimpleFinConnectRequest, SimpleFinStatus, StatementImportResponse, Transaction, WatchlistItem, WatchlistResponse, WatchlistSymbolsRequest, WatchlistSymbolsResponse
from app.domain.statement_import import extract_statement_text, parse_statement_text
from app.db_store import DatabaseStore
from app.store import LocalStore, AccountConflictError, AccountNotFoundError


class CsvImportRequest(BaseModel):
    rows: list[CsvTransactionRow]


class CsvImportResponse(BaseModel):
    created_transactions: int


class TransactionPatchRequest(BaseModel):
    category: str
    merchant_normalized: str | None = None
    create_rule: bool = False


NetWorthRange = Literal["1D", "1W", "1M", "3M", "6M", "YTD", "1Y", "ALL"]


def create_app(
    store: LocalStore | DatabaseStore | None = None,
    simplefin_service: SimpleFinService | None = None,
    quote_service: YahooFinanceQuoteService | None = None,
) -> FastAPI:
    app = FastAPI(title="FinSight Local API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.state.store = store or _build_default_store()
    app.state.simplefin_service = simplefin_service or _build_default_simplefin_service()
    app.state.quote_service = quote_service or YahooFinanceQuoteService()

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/api/settings", response_model=BudgetSettings)
    def get_settings() -> BudgetSettings:
        return app.state.store.budget

    @app.put("/api/settings", response_model=BudgetSettings)
    def update_settings(settings: BudgetSettings) -> BudgetSettings:
        app.state.store.budget = settings
        return settings

    @app.get("/api/accounts")
    def list_accounts():
        return app.state.store.list_accounts()

    @app.post("/api/accounts", response_model=Account)
    def create_account(request: AccountCreateRequest) -> Account:
        return app.state.store.create_account(
            name=request.name,
            account_type=request.type,
            balance=request.balance,
            currency=request.currency,
        )

    @app.patch("/api/accounts/{account_id}", response_model=Account)
    def update_account(account_id: str, request: AccountUpdateRequest) -> Account:
        try:
            return app.state.store.update_account(
                account_id,
                name=request.name,
                account_type=request.type,
                balance=request.balance,
                currency=request.currency,
            )
        except AccountNotFoundError as error:
            raise HTTPException(status_code=404, detail=str(error)) from error

    @app.delete("/api/accounts/{account_id}", response_model=AccountDeleteResponse)
    def delete_account(account_id: str) -> AccountDeleteResponse:
        try:
            deleted_account_id = app.state.store.delete_account(account_id)
        except AccountNotFoundError as error:
            raise HTTPException(status_code=404, detail=str(error)) from error
        except AccountConflictError as error:
            raise HTTPException(status_code=409, detail=str(error)) from error
        return AccountDeleteResponse(deleted_account_id=deleted_account_id)

    @app.get("/api/holdings", response_model=list[Holding])
    def list_holdings() -> list[Holding]:
        return app.state.store.list_holdings()

    @app.get("/api/securities/search", response_model=list[SecuritySearchResult])
    def search_securities(q: str, limit: int = 10) -> list[SecuritySearchResult]:
        if not q.strip():
            return []
        try:
            return [SecuritySearchResult.model_validate(result) for result in app.state.quote_service.search(q, max(1, min(limit, 12)))]
        except MarketDataError as error:
            raise HTTPException(status_code=422, detail=str(error)) from error

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

    @app.post("/api/quotes/refresh", response_model=QuoteRefreshResponse)
    def refresh_quotes(force: bool = False) -> QuoteRefreshResponse:
        refreshed_count = 0
        skipped_count = 0
        quotes: list[MarketQuote] = []
        symbols = sorted({holding.symbol.strip().upper() for holding in app.state.store.list_holdings() if holding.symbol.strip()})
        for symbol in symbols:
            cached_quote = app.state.store.get_cached_quote(symbol)
            if not force and cached_quote is not None and app.state.store.is_cached_quote_fresh(symbol):
                skipped_count += 1
                quotes.append(cached_quote)
                continue
            try:
                quote = MarketQuote.model_validate(app.state.quote_service.get_quote(symbol))
            except MarketDataError as error:
                raise HTTPException(status_code=422, detail=str(error)) from error
            saved_quote = app.state.store.save_market_quote(quote)
            app.state.store.update_holdings_market_price(saved_quote)
            refreshed_count += 1
            quotes.append(saved_quote)
        holdings = app.state.store.list_holdings()
        return QuoteRefreshResponse(
            refreshed_count=refreshed_count,
            skipped_count=skipped_count,
            holdings=holdings,
            quotes=quotes,
            message=f"Refreshed {refreshed_count} symbols; skipped {skipped_count} fresh cached symbols.",
        )

    @app.get("/api/quotes/{symbol}", response_model=MarketQuote)
    def get_quote(symbol: str) -> MarketQuote:
        try:
            quote = MarketQuote.model_validate(app.state.quote_service.get_quote(symbol))
            return app.state.store.save_market_quote(quote)
        except MarketDataError as error:
            raise HTTPException(status_code=422, detail=str(error)) from error

    @app.post("/api/holdings", response_model=Holding)
    def create_holding(request: HoldingRequest) -> Holding:
        try:
            holding_input = _resolve_holding_quote(request, app.state.quote_service, app.state.store)
            return app.state.store.create_holding(
                account_id=holding_input.account_id,
                symbol=holding_input.symbol,
                name=holding_input.name,
                quantity=holding_input.quantity,
                average_cost=holding_input.average_cost,
                market_price=holding_input.market_price or 0,
                currency=holding_input.currency,
            )
        except AccountNotFoundError as error:
            raise HTTPException(status_code=404, detail=str(error)) from error
        except MarketDataError as error:
            raise HTTPException(status_code=422, detail=str(error)) from error

    @app.patch("/api/holdings/{holding_id}", response_model=Holding)
    def update_holding(holding_id: str, request: HoldingRequest) -> Holding:
        try:
            holding_input = _resolve_holding_quote(request, app.state.quote_service, app.state.store)
            return app.state.store.update_holding(
                holding_id,
                account_id=holding_input.account_id,
                symbol=holding_input.symbol,
                name=holding_input.name,
                quantity=holding_input.quantity,
                average_cost=holding_input.average_cost,
                market_price=holding_input.market_price or 0,
                currency=holding_input.currency,
            )
        except AccountNotFoundError as error:
            raise HTTPException(status_code=404, detail=str(error)) from error
        except MarketDataError as error:
            raise HTTPException(status_code=422, detail=str(error)) from error

    @app.delete("/api/holdings/{holding_id}", response_model=HoldingDeleteResponse)
    def delete_holding(holding_id: str) -> HoldingDeleteResponse:
        try:
            deleted_holding_id = app.state.store.delete_holding(holding_id)
        except AccountNotFoundError as error:
            raise HTTPException(status_code=404, detail=str(error)) from error
        return HoldingDeleteResponse(deleted_holding_id=deleted_holding_id)

    @app.get("/api/portfolio", response_model=PortfolioSnapshot)
    def portfolio() -> PortfolioSnapshot:
        return app.state.store.portfolio_snapshot()

    @app.get("/api/transactions", response_model=list[Transaction])
    def list_transactions() -> list[Transaction]:
        return app.state.store.list_transactions()

    @app.patch("/api/transactions/{transaction_id}", response_model=Transaction)
    def patch_transaction(transaction_id: str, request: TransactionPatchRequest) -> Transaction:
        return app.state.store.patch_transaction(
            transaction_id,
            category=request.category,
            merchant_normalized=request.merchant_normalized,
            create_rule=request.create_rule,
        )

    @app.get("/api/category-rules")
    def list_category_rules():
        return app.state.store.list_rules()

    @app.post("/api/imports/csv", response_model=CsvImportResponse)
    def import_csv(request: CsvImportRequest) -> CsvImportResponse:
        return CsvImportResponse(created_transactions=app.state.store.import_csv_rows(request.rows))

    @app.post("/api/imports/statement", response_model=StatementImportResponse)
    async def import_statement(file: UploadFile = File(...)) -> StatementImportResponse:
        content = await file.read()
        try:
            text = extract_statement_text(content, filename=file.filename or "", content_type=file.content_type or "")
            parsed = parse_statement_text(text, filename=file.filename or "")
        except ValueError as error:
            raise HTTPException(status_code=422, detail=str(error)) from error
        account, created_transactions = app.state.store.import_statement_rows(
            parsed.rows,
            account_name=parsed.account_name,
            account_type=parsed.account_type,
            balance=parsed.balance,
            currency=parsed.currency,
        )
        return StatementImportResponse(
            account=account,
            created_transactions=created_transactions,
            preview_rows=parsed.rows[:10],
            message=f"Imported {created_transactions} transactions from {account.name}.",
        )

    @app.post("/api/seed/demo")
    def seed_demo() -> dict[str, str]:
        app.state.store.seed_demo()
        return {"status": "seeded"}

    @app.get("/api/analytics/monthly-spending")
    def monthly_spending(month: str | None = None):
        return build_monthly_summary(app.state.store.list_transactions(), app.state.store.budget, _parse_month(month))

    @app.get("/api/analytics/recurring")
    def recurring():
        return detect_recurring_items(app.state.store.list_transactions())

    @app.get("/api/analytics/cashflow-forecast")
    def cashflow_forecast():
        return build_cashflow_forecast(app.state.store.list_accounts(), app.state.store.list_transactions())

    @app.get("/api/net-worth/history", response_model=NetWorthHistory)
    def net_worth_history(range: NetWorthRange = "1M") -> NetWorthHistory:
        accounts = app.state.store.list_accounts()
        holdings = app.state.store.list_holdings()
        snapshots = app.state.store.list_account_balance_snapshots() if hasattr(app.state.store, "list_account_balance_snapshots") else []
        holdings_aware = build_holdings_aware_net_worth(accounts, holdings)
        return build_net_worth_history(
            accounts,
            range,
            snapshots=snapshots,
            transactions=app.state.store.list_transactions(),
            current_value_override=holdings_aware.total_value,
        )

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

    @app.get("/api/integrations/simplefin/status", response_model=SimpleFinStatus)
    def simplefin_status() -> SimpleFinStatus:
        return SimpleFinStatus(**app.state.simplefin_service.status())

    @app.post("/api/integrations/simplefin/connect", response_model=SimpleFinStatus)
    def simplefin_connect(request: SimpleFinConnectRequest | None = None) -> SimpleFinStatus:
        return SimpleFinStatus(**app.state.simplefin_service.connect(request.setup_token if request else None, app.state.store))

    @app.post("/api/integrations/simplefin/sync", response_model=SimpleFinStatus)
    def simplefin_sync() -> SimpleFinStatus:
        return SimpleFinStatus(**app.state.simplefin_service.sync(app.state.store))

    @app.delete("/api/integrations/simplefin/disconnect", response_model=SimpleFinStatus)
    def simplefin_disconnect() -> SimpleFinStatus:
        return SimpleFinStatus(**app.state.simplefin_service.disconnect())

    return app


def _build_default_store() -> LocalStore | DatabaseStore:
    database_url = os.getenv("FINSIGHT_DATABASE_URL")
    if database_url:
        return DatabaseStore(database_url)
    database_path = Path(os.getenv("FINSIGHT_DATABASE_PATH") or Path.home() / ".finsight" / "finsight.db").expanduser()
    database_path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    return DatabaseStore(f"sqlite:///{database_path.resolve().as_posix()}")


def _build_default_simplefin_service() -> SimpleFinService:
    return SimpleFinService()


def _resolve_holding_quote(request: HoldingRequest, quote_service: YahooFinanceQuoteService, store: LocalStore | DatabaseStore) -> HoldingRequest:
    symbol = request.symbol.strip().upper()
    name = request.name.strip()
    market_price = request.market_price
    currency = request.currency
    if market_price is None or market_price <= 0:
        quote = MarketQuote.model_validate(quote_service.get_quote(symbol))
        store.save_market_quote(quote)
        market_price = quote.price
        currency = quote.currency or currency
        if not name:
            name = quote.name
    return request.model_copy(update={"symbol": symbol, "name": name or symbol, "market_price": market_price, "currency": currency})


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


def _parse_month(month: str | None) -> date | None:
    if month is None:
        return None
    try:
        year, month_index = month.split("-")
        return date(int(year), int(month_index), 1)
    except ValueError as error:
        raise HTTPException(status_code=422, detail="month must use YYYY-MM format") from error


app = create_app()
