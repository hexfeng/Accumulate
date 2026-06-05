# FinSight

Local-first personal finance dashboard for banking, spending analysis, recurring costs, and 30/60/90 day cashflow forecasting.

## What is implemented

- FastAPI backend with local single-user scope.
- CSV transaction import with normalization and deduplication.
- Mock SimpleFIN status/connect/sync/disconnect endpoints.
- Account CRUD APIs for create, update, and delete with transaction cleanup.
- Rule-based categorization with user correction rules.
- Monthly spending summaries, recurring detection, and cashflow forecast engine.
- Next.js app shell with Dashboard, Cash, Accounts, Transactions, and Spending MVP pages.
- Accounts page with SimpleFIN Bridge status, separated cash and credit-card account views, institution visuals, source labels, clean one-line account rows, and click-through account detail/update modals.
- Cash page with monthly in-flow/out-flow KPIs, available cash, net position, 30/60/90 day forecast, cash account distribution, and matching compact account rows.
- Demo seed endpoint for local development.

## Latest milestone

As of 2026-06-04, the Accounts + Cash MVP is implemented and pushed on `codex/dashboard-ui-polish` at commit `74da22d`.

Completed:

- Backend account schemas, persistence methods, and `POST`/`PATCH`/`DELETE /api/accounts`.
- Account delete behavior removes the selected account and its attached transactions, including manual, imported, and synced sources.
- Frontend API wrappers and types for accounts, mock SimpleFIN actions, and cashflow forecast data.
- `/accounts` page for SimpleFIN Bridge status, cash account summaries, credit-card obligations, source labels, one-line account rows, modal-based manual account entry, statement import entry, and per-account detail/update modals.
- `/cash` page for short-term liquidity, monthly inflow/outflow, account drill-downs, forecast, and cash account distribution.
- Sidebar navigation updated to include Accounts while keeping Settings deferred from the main nav.
- Dashboard and Cash visual polish for typography, hero/header scale, trend endpoint, and FinSight logo.

2026-06-05 Accounts frontend polish:

- Refined `/accounts` into a Dashboard/Cash-style top card with account totals and the add/import entry point in one header.
- Split cash accounts and credit cards into compact account rows with bank logos or card art, right-aligned balances, and small source pills.
- Reworked account detail modals to show balance, account facts, latest transactions, sync/delete/actions, and click-outside dismissal.
- Kept `Add account / Import` as a modal flow for manual entry and statement import instead of a standalone page/card.
- Added a local institution asset library for major Canadian banks, Wealthsimple, EQ Bank, PC Financial, Rogers Bank, and Amex card imagery.

## Planned frontend navigation

The current web app implements Dashboard, Cash, Accounts, Transactions, and Spending. Investments, Recap, and Settings remain staged for later MVP slices. Settings is intentionally not in the main sidebar yet so the current navigation stays focused on working pages.

- Dashboard (`/dashboard`) for the financial command center and cross-page entry points.
- Cash (`/cash`) for monthly inflow/outflow, available cash, net short-term position, cash account distribution, and 30/60/90 day cashflow risk.
- Spending (`/spending`) for income, expenses, budget usage, merchant/category insights, and recurring costs.
- Investments (`/investments`) for manual holdings, portfolio value, returns, allocation, and FX exposure.
- Recap (`/recap`) for monthly, quarterly, and yearly financial summaries.
- Transactions (`/transactions`) for transaction drill-down, review, categorization, and local rule creation.
- Accounts (`/accounts`) for SimpleFIN Bridge status, cash account summaries, credit-card obligations, manual/statement data entry, compact account rows, account detail/update modals, and sync health.
- Settings (`/settings`) for budgets, category rules, forecast assumptions, currency, and privacy preferences. This route is deferred and not part of the current main sidebar.

See `docs/MVP_FRONTEND_NAVIGATION.md` for the detailed route map, page responsibilities, drill-down rules, and Dashboard page specification.

## Local setup

```powershell
npm install
python -m pip install -r apps/api/requirements.txt
docker compose up -d postgres
```

Run the API:

```powershell
npm run dev:api
```

Run the web app in another terminal:

```powershell
npm run dev:web
```

Seed demo data:

```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/api/seed/demo
```

Open `http://localhost:3000/dashboard`.

## Verification

```powershell
npm run test:api
npm run test:web
npm run build:web
```

## Notes

- The backend defaults to an in-process local store when `FINSIGHT_DATABASE_URL` is unset. Set `FINSIGHT_DATABASE_URL=postgresql+psycopg://finsight:finsight@localhost:5432/finsight` to use the SQLAlchemy/PostgreSQL store.
- `apps/api/schema.sql` documents the Postgres-compatible schema used by the persistence layer.
- Real SimpleFIN credentials are not required yet. The mock adapter keeps the endpoint contract stable for later replacement.
- AI insight generation, investment holdings, yfinance valuation, Redis workers, KMS, object storage, and SaaS auth are intentionally deferred.
