import os
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.domain.analytics import build_monthly_summary
from app.domain.forecast import build_cashflow_forecast
from app.domain.net_worth import build_net_worth_history
from app.domain.recurring import detect_recurring_items
from app.domain.schemas import Account, AccountCreateRequest, AccountDeleteResponse, AccountUpdateRequest, BudgetSettings, CsvTransactionRow, DashboardSnapshot, NetWorthHistory, Transaction
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


class SimpleFinStatus(BaseModel):
    provider: str = "mock_simplefin"
    status: str = "available"
    mode: str = "mock"
    message: str = "Mock SimpleFIN is ready for local-first development."


NetWorthRange = Literal["1D", "1W", "1M", "3M", "6M", "YTD", "1Y", "ALL"]


def create_app(store: LocalStore | DatabaseStore | None = None) -> FastAPI:
    app = FastAPI(title="FinSight Local API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.state.store = store or _build_default_store()

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

    @app.post("/api/seed/demo")
    def seed_demo() -> dict[str, str]:
        app.state.store.seed_demo()
        return {"status": "seeded"}

    @app.get("/api/analytics/monthly-spending")
    def monthly_spending():
        return build_monthly_summary(app.state.store.list_transactions(), app.state.store.budget)

    @app.get("/api/analytics/recurring")
    def recurring():
        return detect_recurring_items(app.state.store.list_transactions())

    @app.get("/api/analytics/cashflow-forecast")
    def cashflow_forecast():
        return build_cashflow_forecast(app.state.store.list_accounts(), app.state.store.list_transactions())

    @app.get("/api/net-worth/history", response_model=NetWorthHistory)
    def net_worth_history(range: NetWorthRange = "1M") -> NetWorthHistory:
        return build_net_worth_history(app.state.store.list_accounts(), range)

    @app.get("/api/dashboard", response_model=DashboardSnapshot)
    def dashboard() -> DashboardSnapshot:
        transactions = app.state.store.list_transactions()
        return DashboardSnapshot(
            accounts=app.state.store.list_accounts(),
            monthly_summary=build_monthly_summary(transactions, app.state.store.budget),
            recurring_items=detect_recurring_items(transactions),
            forecast=build_cashflow_forecast(app.state.store.list_accounts(), transactions),
        )

    @app.get("/api/integrations/simplefin/status", response_model=SimpleFinStatus)
    def simplefin_status() -> SimpleFinStatus:
        return SimpleFinStatus()

    @app.post("/api/integrations/simplefin/connect")
    def simplefin_connect() -> dict[str, str]:
        return {"status": "connected", "provider": "mock_simplefin", "mode": "mock"}

    @app.post("/api/integrations/simplefin/sync")
    def simplefin_sync() -> dict[str, str]:
        app.state.store.seed_demo()
        return {"status": "synced", "provider": "mock_simplefin"}

    @app.delete("/api/integrations/simplefin/disconnect")
    def simplefin_disconnect() -> dict[str, str]:
        return {"status": "disconnected", "provider": "mock_simplefin"}

    return app


def _build_default_store() -> LocalStore | DatabaseStore:
    database_url = os.getenv("FINSIGHT_DATABASE_URL")
    if database_url:
        return DatabaseStore(database_url)
    return LocalStore()


app = create_app()
