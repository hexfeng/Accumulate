# Investments Dashboard Watchlist Design

## Scope

This spec covers the first implementation slice for Investments and Dashboard:

- Make Dashboard net worth include manual investment holdings without double-counting investment account balances.
- Replace Dashboard mock asset allocation with real holdings-aware allocation.
- Add a configurable Investments watchlist card under the summary metrics.

Holding import from screenshots or PDFs is intentionally a second phase. This first slice may prepare API boundaries for later reuse, but it should not implement OCR or vision parsing.

## Current State

Investments already supports manual holding CRUD, Yahoo Finance-backed security search, quote refresh, portfolio value, cost basis, unrealized gain, allocation, and account grouping.

Dashboard currently reads `/api/dashboard` and `/api/net-worth/history`. The net worth history calculation sums account balances only. Dashboard's asset distribution falls back to a mock allocation because `/api/dashboard` does not return a real portfolio allocation.

This creates two user-visible problems:

- A manual holding added in Investments updates the Investments page but does not affect Dashboard top-line net worth.
- Dashboard asset mix can still show mock Stocks / ETF / Cash distribution even when manual holdings exist.

## Net Worth Rule

Use a holdings-aware account replacement rule:

- For each investment account with one or more manual holdings, use the total market value of those holdings.
- For each investment account with no manual holdings, use the account balance.
- For non-investment accounts, use the account balance.
- Do not add an investment account balance on top of holdings for the same account.

Examples:

- TFSA has holdings worth CAD 12,000 and account balance CAD 10,000: use CAD 12,000.
- RRSP has no holdings and account balance CAD 4,000: use CAD 4,000.
- Chequing account balance CAD 2,000: use CAD 2,000.
- Credit card balance CAD -500: use CAD -500.

This keeps SimpleFIN balance-only investment accounts useful while allowing a user to progressively replace account-level balances with holding-level values.

## Backend Design

Add a domain helper that builds a holdings-aware net worth snapshot from accounts and holdings. The helper should return enough structure for:

- Current total net worth.
- Asset allocation items.
- Portfolio value for Dashboard KPI display.
- A clear indication of whether manual holdings were used.

`/api/net-worth/history` should use the new holdings-aware current value. Historical snapshot points can remain account-balance based for this slice. If historical points do not include holdings, the endpoint should continue to mark the series as estimated when appropriate.

`/api/dashboard` should return real asset allocation and investment summary data. Dashboard should not need to reconstruct portfolio math in the browser.

Keep existing `/api/portfolio` behavior compatible with Investments. It may reuse the same helper internally where that reduces duplication, but the public response shape should remain compatible unless tests are updated alongside clients.

## Frontend Design

Dashboard should display the holdings-aware current net worth. The hero supporting copy should no longer say "Accounts-only estimate" when holdings are included.

Dashboard asset allocation should render real allocation when data exists. Mock allocation should only appear as an explicit empty/demo fallback when there is no real account or holding data. The visible copy must not imply real holdings are connected when the allocation is mocked.

The Investments KPI card on Dashboard should show the real investment value when any investment account or holding exists. If no investment data exists, it can keep the setup CTA.

## Investments Watchlist MVP

Add a watchlist panel below the Investments summary KPI cards and above the allocation/account/holdings sections.

The default list should include broad-market benchmarks suitable for this app:

- Dow Jones
- S&P 500
- Nasdaq
- Russell 2000
- TSX

Users should be able to add and remove watchlist symbols from the UI. The first version can persist watchlist symbols locally in the backend store or app settings, as long as the behavior is tested and survives page refresh in the configured store.

Use the existing Yahoo Finance/yfinance quote provider first. TradingView should not be used as a backend data source in this slice. TradingView widgets or charts can be considered later for richer charting, but the current need is structured data for custom Google Finance-style cards.

Each watchlist card should show:

- Display name or symbol.
- Latest price.
- Absolute change.
- Percent change.
- Provider/as-of state.
- A compact visual trend placeholder or sparkline if a lightweight data source is available without expanding the scope.

If quote data is unavailable, show a compact error state for that symbol and keep the rest of the watchlist usable.

## OCR Import Phase 2

The screenshot/PDF holdings import should be designed as a separate implementation slice:

- Add an `Import holdings` action in Investments.
- Accept PDF and image uploads.
- Extract candidate holdings into a preview table.
- Let the user choose `Create investment account` or `Update existing account`.
- Allow edits before writing data.
- Confirm before batch creating or updating holdings.

The parser should target symbol, name, quantity, average cost, market price, value, and currency. Because brokerage screenshots vary heavily, this should start with a preview-and-confirm flow rather than automatic writes.

## Testing

Backend tests should cover:

- Holdings-aware net worth replaces investment account balances per account.
- Investment accounts without holdings still contribute their balance.
- Dashboard returns real allocation when holdings exist.
- `/api/net-worth/history` current value uses the holdings-aware total.
- Watchlist quote endpoint and persistence behavior.

Frontend tests should cover:

- Dashboard hero net worth includes holdings.
- Dashboard allocation renders real data instead of mock data when portfolio data exists.
- Dashboard Investments KPI shows real investment value.
- Investments renders watchlist cards.
- Users can add and remove watchlist symbols.
- Quote failures render per-symbol fallback state.

Run the standard FinSight verification set after implementation:

- `npm run test:api`
- `npm run test:web`
- `npm run build:web`

