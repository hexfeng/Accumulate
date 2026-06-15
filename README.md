# FinSight

FinSight is a local-first personal finance workspace for bank-account tracking, cashflow forecasting, spending analysis, and source-health management. It combines a Dashboard command center with focused Cash, Accounts, Transactions, and Spending pages so users can move from high-level financial signals into account balances, card obligations, transaction review, and data-source actions.

## What is implemented

- FastAPI backend with local single-user scope.
- CSV transaction import with normalization and deduplication.
- Real SimpleFIN status/connect/sync/disconnect endpoints with local credential storage.
- Account CRUD APIs for create, update, and delete with transaction cleanup.
- Rule-based categorization with user correction rules.
- Monthly spending summaries, recurring detection, and cashflow forecast engine.
- Next.js app shell with Dashboard, Cash, Accounts, Transactions, Spending, Recap, Investments, and Settings MVP pages.
- Accounts page with SimpleFIN Bridge status, setup-token connect flow, sync freshness, retry/error state, separated cash and credit-card account views, institution visuals, source labels, clean one-line account rows, multi-file historical statement import, and click-through account detail/update modals.
- Cash page with monthly in-flow/out-flow KPIs, available cash, net position, 30/60/90 day forecast, cash account distribution, and matching compact account rows.
- Recap page with period support, income/spending/net cashflow, savings rate, recurring costs, notable categories, top merchants, sparse-data states, and Transactions drill-down links.
- Spending page expansion with budget threshold watchlists, category/merchant drill-downs, recurring cost drill-downs, and period-preserving Transactions links.
- Investments MVP with manual holdings CRUD, Yahoo Finance-backed security search, cached portfolio price refresh, configurable watchlist cards, portfolio value, cost basis, unrealized gain, allocation, and account grouping.
- Settings MVP with budget, category budget, forecast assumption, currency/timezone, AI privacy, and local-first controls connected to the settings API.
- Demo seed endpoint for local development.

## Latest milestone

As of 2026-06-04, the Accounts + Cash MVP is implemented and pushed on `codex/dashboard-ui-polish` at commit `74da22d`.

Completed:

- Backend account schemas, persistence methods, and `POST`/`PATCH`/`DELETE /api/accounts`.
- Account delete behavior removes the selected account and its attached transactions, including manual, imported, and synced sources.
- Frontend API wrappers and types for accounts, mock SimpleFIN actions, and cashflow forecast data.
- `/accounts` page for SimpleFIN Bridge status, cash account summaries, credit-card obligations, source labels, one-line account rows, modal-based manual account entry, statement import entry, and per-account detail/update modals.
- `/cash` page for short-term liquidity, monthly inflow/outflow, account drill-downs, forecast, and cash account distribution.
- Sidebar navigation updated to include Accounts; Settings was added to the main nav in the 2026-06-09 MVP slice.
- Dashboard and Cash visual polish for typography, hero/header scale, trend endpoint, and FinSight logo.

2026-06-05 Accounts frontend polish:

- Refined `/accounts` into a Dashboard/Cash-style top card with account totals and the add/import entry point in one header.
- Split cash accounts and credit cards into compact account rows with bank logos or card art, right-aligned balances, and small source pills.
- Reworked account detail modals to show balance, account facts, latest transactions, sync/delete/actions, and click-outside dismissal.
- Kept `Add account / Import` as a modal flow for manual entry and statement import instead of a standalone page/card.
- Aligned the Accounts header action with the Dashboard pill-button style so `Add account / Import` sits centered with the header copy.
- Added a local institution asset library for major Canadian banks, Wealthsimple, EQ Bank, PC Financial, Rogers Bank, and Amex card imagery.

2026-06-09 Recap, Spending, Investments, and Settings MVP:

- Added `month=YYYY-MM` support to monthly spending analytics for period-specific Recap views.
- Added holdings persistence and `GET`/`POST`/`PATCH`/`DELETE /api/holdings` plus `GET /api/portfolio`.
- Replaced `/recap` placeholder with a period recap page for income, spending, net cashflow, savings rate, recurring costs, notable categories, top merchants, and sparse-data states.
- Expanded `/spending` with budget threshold watchlists and recurring cost drill-down links.
- Replaced `/investments` placeholder with manual holdings management, portfolio totals, allocation, and account grouping.
- Replaced `/settings` placeholder with live settings controls and added Settings to the main sidebar.

2026-06-11 Real SimpleFIN connectivity:

- Replaced mock SimpleFIN connect/sync/disconnect with a real SimpleFIN client that claims setup tokens, stores the returned access URL locally, and fetches `/accounts`.
- Added local credential storage at `~/.finsight/simplefin_credentials.json` by default, overrideable with `FINSIGHT_SIMPLEFIN_CREDENTIAL_PATH`; the API never returns the access URL in responses.
- Synced SimpleFIN accounts now write `source="simplefin"`, stable external account IDs, balances, `last_synced_at`, and de-duplicated transactions with `external_id`.
- Accounts shows setup-token entry, sync freshness, last error, retry count, and next retry time while preserving the existing Connect / Sync now / Disconnect controls.

2026-06-12 Statement import and Transactions UX:

- Statement import accepts multiple monthly PDF/TXT/CSV statement files in one modal flow, while existing statement account detail dialogs provide `Update transactions` for later monthly statements.
- Current or newer statement imports update the statement account balance; older historical statement imports append missing transactions without rolling the account balance back.
- Imported credit-card statement expenses are persisted as statement transactions and included in monthly spending analytics when they are not payments or transfers.
- Transactions now defaults each account to its latest month and the five newest rows, with dialogs for all transactions in that month and history by month.

2026-06-12 Investment quote refresh:

- Added `GET /api/quotes/{symbol}` with a replaceable Yahoo Finance quote provider using `yfinance`.
- Added `GET /api/securities/search?q=...` for Add holding autocomplete, filtered to stock/ETF-style quote results, ranked by exact/prefix/contains matches, and backed by a Nasdaq Trader symbol-directory fallback when Yahoo search is sparse.
- Added `POST /api/quotes/refresh?force=...` to refresh all manual holding prices, persist latest quotes locally, and skip cached prices that were fetched within the last 15 minutes.
- Holdings can now be saved with symbol, quantity, and cost basis while the API fills missing market price/name from the latest quote.
- `/investments` automatically refreshes holding prices when the page opens, refreshes every 15 minutes while open, and includes a page-level `Refresh prices` action; Add holding now uses a compact one-line searchable symbol picker instead of a per-holding refresh button.

2026-06-15 Dashboard investments and watchlist:

- Dashboard net worth and asset allocation now use holdings-aware investment values, replacing an investment account balance with that account's manual holdings total when holdings exist so the same account is not double counted.
- Investment accounts without manual holdings still contribute their account balance, preserving synced or manually entered balance-only accounts.
- Added persisted configurable Investments watchlist cards backed by the existing quote provider, with per-symbol quote fallback states.
- Screenshot/PDF holdings import remains a planned preview-and-confirm flow for a later slice.

## Planned frontend navigation

The current web app implements Dashboard, Cash, Spending, Investments, Recap, Transactions, Accounts, and Settings as MVP pages.

- Dashboard (`/dashboard`) for the financial command center and cross-page entry points.
- Cash (`/cash`) for monthly inflow/outflow, available cash, net short-term position, cash account distribution, and 30/60/90 day cashflow risk.
- Spending (`/spending`) for income, expenses, budget usage, merchant/category insights, and recurring costs.
- Investments (`/investments`) for manual holdings, searchable stock/ETF selection, configurable market watchlist cards, cached quote-backed market prices, portfolio value, cost basis, unrealized gains, allocation, and account grouping.
- Recap (`/recap`) for period income, spending, net cashflow, savings rate, recurring costs, notable categories, and merchant summaries.
- Transactions (`/transactions`) for transaction drill-down, review, categorization, local rule creation, compact latest-month account previews, and monthly history dialogs.
- Accounts (`/accounts`) for SimpleFIN Bridge status, cash account summaries, credit-card obligations, manual data entry, multi-file historical statement import, compact account rows, account detail/update modals, and sync health.
- SimpleFIN setup tokens can be entered from `/accounts`; credentials are stored locally and can be disconnected from the same panel.
- Settings (`/settings`) for budgets, category budgets, forecast assumptions, currency/timezone, AI privacy mode, and local-first preferences.

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
- SimpleFIN credentials are local-only. By default the access URL is stored in `~/.finsight/simplefin_credentials.json`; set `FINSIGHT_SIMPLEFIN_CREDENTIAL_PATH` to choose a different local secret file.
- External market-data valuation such as yfinance, AI insight generation, Redis workers, KMS, object storage, and SaaS auth are intentionally deferred.
