# FinSight MVP Frontend Navigation and Page Plan

This document captures the MVP frontend information architecture, route map, cross-page navigation, and current implementation status. It is the day-to-day product and task reference while the longer PRD/technical architecture document remains the broader product source.

Last updated: 2026-06-11

## 1. Navigation principles

FinSight is organized around user financial questions, not isolated features:

1. Am I financially healthy right now?
2. Do I have enough cash for upcoming obligations?
3. Where did my money go this month?
4. How are my investments and net worth changing?
5. What changed this month, quarter, or year?
6. Which underlying transactions need review?
7. Are my accounts, data sources, budgets, and privacy preferences configured correctly?

The Dashboard is the product entry point. Topic pages provide deeper analysis. Transactions is the shared drill-down and data correction layer. Accounts is the management layer for balances, sources, and sync state.

## 2. Sidebar structure

The current main sidebar exposes implemented or active MVP routes:

```text
Dashboard        /dashboard        implemented
Cash             /cash             implemented
Spending         /spending         implemented
Investments      /investments      implemented MVP
Recap            /recap            implemented
Transactions     /transactions     implemented
Accounts         /accounts         implemented
Settings         /settings         implemented MVP
```

A future grouped version can be used when the sidebar needs more structure:

```text
Overview
- Dashboard

Money
- Cash
- Spending
- Transactions

Wealth
- Investments

Insights
- Recap

Manage
- Accounts
- Settings
```

## 3. Route map

```text
/                         -> redirect to /dashboard

/dashboard                -> financial command center and page hub
/cash                     -> liquidity, monthly flow, forecast risk, account distribution
/spending                 -> income, expenses, budgets, category and merchant insights
/investments              -> portfolio, holdings, returns, allocation, FX exposure
/recap                    -> monthly, quarterly, and yearly recap
/transactions             -> transaction detail, review, categorization, rules
/accounts                 -> accounts, manual CRUD, data sources, sync health
/settings                 -> budget, category rules, forecast assumptions, privacy
```

Future nested routes may include:

```text
/investments/new
/investments/holdings/:id
/accounts/new
/accounts/connect/simplefin
/transactions/import
```

## 4. Page responsibilities

| Page | Status | Core question | Primary responsibilities |
|---|---|---|---|
| Dashboard | Implemented | Am I financially healthy right now? | KPI summary, net-worth trend, alerts, next actions, cashflow/spending previews, cross-page entry points. |
| Cash | Implemented | Is my short-term liquidity safe? | Monthly in-flow/out-flow, available cash, net short-term position, 30/60/90 forecast, cash distribution, cash and credit account drill-downs. |
| Spending | Implemented | Where did my money go? | Income/spending summary, budget thresholds, category and merchant drill-downs, recurring costs, spending insights. |
| Investments | Implemented MVP | How is my wealth performing? | Manual holdings CRUD, portfolio value, cost basis, unrealized gain, allocation, and account grouping. |
| Recap | Implemented | What changed over a period? | Period income, spending, net cashflow, savings rate, recurring costs, notable categories, top merchants, sparse-data states, and action links. |
| Transactions | Implemented MVP | Is the source data correct? | Search, filters, review queue, categorization, exclusion, transfer marking, rule creation. |
| Accounts | Implemented | Are my accounts and data sources healthy? | Real SimpleFIN Bridge status/connect/sync/disconnect, setup-token entry, sync freshness, retry/error state, cash account grouping, credit-card obligation grouping, institution visuals, source labels, clean one-line account rows, modal-based manual/statement entry, click-through account detail/update modals, and click-outside modal dismissal. |
| Settings | Implemented MVP | How should FinSight interpret my data? | Monthly budget, category budgets, forecast assumptions, base currency, timezone, AI privacy mode, and local-first preferences. |

## 5. Cross-page drill-down rules

Query parameters should preserve context when users move from summary pages to detail pages:

```text
period=2026-05
range=1M
category=Dining
merchant=Netflix
account=cibc-visa
review=true
section=recurring
tab=allocation
```

Implemented examples:

```text
/cash inflow KPI                 -> /recap?period=<current-month>
/cash outflow KPI                -> /recap?period=<current-month>
/cash available cash KPI         -> /accounts
/cash net position KPI           -> /accounts
/cash account distribution       -> /accounts
/cash cash accounts              -> /accounts
/cash credit card obligations    -> /accounts
/dashboard Cash card             -> /cash
/dashboard Accounts card         -> /accounts
/dashboard forecast preview      -> /cash
/transactions?category=Dining
/transactions?merchant=Netflix
/transactions?account=cibc-visa
/transactions?review=true
```

Planned examples:

```text
/spending?category=Dining
/transactions?category=Dining&period=2026-05
/transactions?merchant=Netflix&period=2026-05
/recap?period=2026-05
/settings?section=budget
```

## 6. Main navigation flow

```text
/
`-- /dashboard
    |-- /cash
    |   |-- /recap?period=...
    |   |-- /accounts
    |   `-- /transactions
    |
    |-- /spending
    |   |-- /transactions?category=...
    |   |-- /transactions?merchant=...
    |   `-- /settings?section=budget
    |
    |-- /investments
    |   |-- /investments/new
    |   |-- /investments/holdings/:id
    |   `-- /accounts?type=investment
    |
    |-- /recap
    |   |-- /spending?period=...
    |   |-- /transactions?period=...
    |   `-- /investments?period=...
    |
    |-- /transactions
    |   `-- /transactions?review=true
    |
    `-- /accounts
        |-- cash accounts
        |-- credit cards
        |-- bank logo and card art rows
        |-- click account row for detail/update modal
        |-- click outside modal to dismiss
        |-- account update/delete from account modals
        |-- statement import entry from Add account / Import modal
        |-- real SimpleFIN connect/sync/disconnect
        `-- /transactions?account=...
```

## 7. Dashboard specification

Dashboard is the entry page and summary hub. It should answer: "What needs my attention right now?"

### 7.1 Confirmed Dashboard body layout

The confirmed layout below the Total Net Worth header is:

```text
Header
KPI Navigation Cards: Cash / Investments / Spending / Accounts / Recap / Risk
Main Content Grid: Net Worth Trend + Needs Attention
Secondary Insight Row: Cashflow Forecast / Spending Insight / Recap or Goal
Add-data and review actions: header menu first, larger empty-state actions only when needed
```

Desktop should use a six-card KPI row when width allows, then a two-column main grid with Net Worth Trend on the left and Needs Attention on the right. The secondary insight row should use three equal cards. On mobile, the order should be Header, KPI cards, Needs Attention, Net Worth Trend, Cashflow Forecast, Spending Insight, then Recap / Goal so urgent actions remain visible before detailed charts.

### 7.2 Dashboard header

The Dashboard header is the first visual focus. It should promote Total Net Worth above the generic page title.

| Element | Displays | Click target | Notes |
|---|---|---|---|
| Total Net Worth | Current total net worth. | `/investments` or future `/net-worth`. | MVP can use accounts-only net worth until holdings and valuation are implemented. Label the source clearly. |
| Change vs yesterday | Absolute amount and percentage, such as `+$1,182.30 and +0.82% vs yesterday`. | Same as Total Net Worth. | If previous-day data is unavailable, show `No previous day data` instead of `0.00%`. |
| Goal progress | User-configured goal name and target, such as `FIRE`, `$145.3K / $1.5M`, and a progress bar. | `/settings?section=goals`. | Default current value is Total Net Worth. If the user configures a scoped goal, use that scoped value instead. |
| Current period | Current month or reporting period, such as `Jun 2026`. | Future period selector. | Keep as display-only for the first implementation. |
| Data status chips | Local-first, SimpleFIN, updated/stale/sync issue states. | `/accounts`. | Status details belong on Accounts. |
| Primary action | `Add data`. | Add-data menu or first supported target. | Menu items can include Import CSV, Add manual account, Add holding, and Connect SimpleFIN. |

### 7.3 Dashboard KPI cards

Total Net Worth belongs in the header, so KPI cards should not duplicate it. Recurring costs and spending insights are integrated into Spending instead of being first-level cards.

| KPI | Displays | Click target | Notes |
|---|---|---|---|
| Cash | Available cash, short-term liquidity, or next cash event. | `/cash`. | Use checking + savings + cash as the MVP value. |
| Investments | Portfolio value, cost basis, unrealized gain, or setup CTA. | `/investments`. | Show manual holdings and allocation while external market-data valuation remains deferred. |
| Spending | Current month spending and budget usage. | `/spending`. | Recurring costs and spending insights are summarized here and expanded on Spending. |
| Accounts | Connected/manual account count, sync health, or data freshness. | `/accounts`. | This also supports data status chip details. |
| Recap | Latest monthly/quarterly recap status. | `/recap`. | Show `May recap ready` when enough period data exists. |
| Risk | Highest priority risk, such as cashflow, budget, sync, or review risk. | Risk-specific target, usually `/cash`, `/spending`, `/accounts`, or `/transactions?review=true`. | Keep final naming and risk composition open until alert generation is implemented. |

### 7.4 Dashboard alerts and next actions

Dashboard should show a prioritized feed of actionable items:

| Alert type | Example | Target |
|---|---|---|
| Cash risk | Projected cash balance turns negative in 30 days. | `/cash` |
| Budget warning | Dining is near or over budget. | `/spending?category=Dining` |
| Upcoming payment | Netflix renews on June 15. | `/transactions?merchant=Netflix` |
| Review needed | 3 low-confidence transactions need review. | `/transactions?review=true` |
| Data issue | SimpleFIN sync failed or data is stale. | `/accounts` |
| Recap ready | May recap is ready. | `/recap?period=2026-05` |
| Investment setup | Add holdings to complete net worth. | `/investments` |
| Goal setup | Set a FIRE, emergency fund, or down payment goal. | `/settings?section=goals` |

Priority order should be critical, warning, review, informational, and success.

### 7.5 Dashboard secondary panels

| Panel | Purpose | Interactions |
|---|---|---|
| Net Worth Trend | Long-term financial health trend. | Range switch updates chart; details link opens investments or net-worth page. |
| Cashflow Forecast Preview | 30/60/90 day projected cash balance and risk. | Details link opens `/cash`. |
| Spending Insight Preview | Budget usage, top category, recurring summary, and spending insight preview. | Opens `/spending` or `/spending?category=...`. |
| Recap / Goal Progress Preview | Recap readiness or goal milestone context. | Opens `/recap` or `/settings?section=goals`. |

## 8. Accounts + Cash MVP status

The Accounts + Cash MVP slice is complete as of 2026-06-04.

Backend completed:

1. Added account request/response schemas for create, update, and delete.
2. Added account CRUD methods to local and SQL stores.
3. Added account delete behavior that removes the selected account and its attached transactions.
4. Added `POST /api/accounts`, `PATCH /api/accounts/{account_id}`, and `DELETE /api/accounts/{account_id}`.
5. Kept imported/mock/csv account balances read-only outside their update flows while allowing account-level removal from detail modals.

Frontend completed:

1. Added typed API helpers for accounts, SimpleFIN status/actions, and cashflow forecast.
2. Replaced `/accounts` placeholder with SimpleFIN Bridge status, cash accounts, credit cards, institution visuals, source labels, one-line account rows, row-click detail/update modals, manual CRUD, statement import entry, delete confirmation, and SimpleFIN controls.
3. Replaced `/cash` placeholder with compact liquidity header, four clickable KPI cards, compact 30/60/90 forecast, cash account distribution, and account drill-down tables.
4. Added Accounts to the main sidebar; Settings was added later in the 2026-06-09 MVP slice.
5. Polished Dashboard/Cash typography, Dashboard trend endpoint marker, and FinSight brand logo.

2026-06-05 Accounts frontend polish:

1. Moved the Accounts page title, summary totals, and `Add account / Import` action into a Dashboard/Cash-style header card, with the add/import action presented as a centered blue pill button.
2. Reworked cash and credit-card account groups into compact rows with bank logos or credit-card artwork, small source pills, and right-aligned balances.
3. Reworked account detail modals to show the account visual, balance, type/currency/source/last-sync facts, latest transactions, sync/delete/transactions actions, and click-outside dismissal.
4. Kept manual add and statement import in a modal flow, with click-outside dismissal matching account detail modals.
5. Added a local institution asset library for major Canadian banks, Wealthsimple, EQ Bank, PC Financial, Rogers Bank, and Amex card imagery.

Verification completed for commit `74da22d`:

```powershell
npm run test:api
npm run test:web
npm run build:web
```

## 9. Remaining task plan

### 9.0 Completed 2026-06-09 MVP pages

Completed:

1. Replaced `/recap` placeholder with a period recap page backed by `GET /api/analytics/monthly-spending?month=YYYY-MM`.
2. Expanded Spending with category budget threshold states, recurring cost drill-downs, and period-preserving Transactions links.
3. Added manual holding schemas, local/SQL persistence, `GET`/`POST`/`PATCH`/`DELETE /api/holdings`, `GET /api/portfolio`, and a usable Investments page.
4. Replaced `/settings` placeholder with budget, category budget, forecast, currency/timezone, AI privacy, and local-first controls, then added Settings to the main sidebar.

Verification:

```powershell
npm run test:api
npm run test:web
npm run build:web
```

### 9.1 Recap page

Status: Implemented on 2026-06-09.

Goal: make `/recap` the period summary page used by Cash in-flow/out-flow drill-downs.

Tasks:

1. Add period selector and route support for `period=YYYY-MM`.
2. Show income, spending, net cashflow, savings rate, recurring costs, and notable category changes.
3. Link categories and merchants into filtered Transactions views.
4. Add frontend tests for period rendering and Cash KPI drill-down context.

Acceptance:

- `/recap?period=<current-month>` explains the same monthly in-flow/out-flow values shown on Cash.
- Empty or sparse data states do not crash the page.

### 9.2 Spending expansion

Status: Implemented on 2026-06-09.

Goal: turn Spending into the primary expense analysis page.

Tasks:

1. Add budget usage states and category thresholds.
2. Add merchant/category detail sections.
3. Add recurring cost summary and drill-down links.
4. Preserve filters when moving from Spending to Transactions.

Acceptance:

- A user can identify top spending drivers and open the matching transaction list.
- Budget warnings can feed Dashboard alerts.

### 9.3 Investments MVP

Status: Implemented on 2026-06-09.

Goal: make Investments usable as a setup-first manual holdings page.

Tasks:

1. Add manual holding model/API.
2. Add holding create/edit/delete UI.
3. Add portfolio value, allocation, and account grouping.
4. Keep external market-data integrations deferred until the manual model is stable.

Acceptance:

- A user can enter holdings and see portfolio value/allocation without external integrations.
- Dashboard investment card links to meaningful setup or holdings state.

### 9.4 Settings MVP

Status: Implemented on 2026-06-09.

Goal: add Settings after the current working surfaces need configurable assumptions.

Tasks:

1. Budget and category-rule settings.
2. Forecast assumptions.
3. Currency/timezone preferences.
4. Privacy and local-first controls.
5. Add Settings to the main sidebar only after at least budget or forecast settings are usable.

Acceptance:

- Settings changes affect at least one live page instead of being static controls.

### 9.5 True account connectivity

Status: Implemented on 2026-06-11.

Goal: replace mock SimpleFIN behavior with real integration behind the same UI contract.

Completed:

1. Added local credential storage for the claimed SimpleFIN access URL, defaulting to `~/.finsight/simplefin_credentials.json` with `FINSIGHT_SIMPLEFIN_CREDENTIAL_PATH` override support.
2. Replaced mock connect/sync/disconnect endpoints with a real SimpleFIN client that claims setup tokens and fetches `/accounts`.
3. Added sync freshness, sanitized error messages, retry count, and next retry state to the API response and Accounts panel.
4. Added integration tests for token claim, credential persistence, account/transaction sync, sanitized error/retry state, and disconnect cleanup.

Acceptance:

- Existing Accounts UI still works while the source changes from mock to real integration.
- Synced accounts remain protected from accidental inline manual edits, while detail modals expose explicit sync and delete actions.
