# FinSight MVP Frontend Navigation and Page Plan

This document captures the MVP frontend information architecture, route map, cross-page navigation, and first-pass Dashboard page specification. It is intended to be the day-to-day product and implementation reference while the longer PRD/technical architecture document remains the source of broader product context.

## 1. Navigation principles

FinSight is organized around user financial questions, not isolated features:

1. Am I financially healthy right now?
2. Do I have enough cash for upcoming obligations?
3. Where did my money go this month?
4. How are my investments and net worth changing?
5. What changed this month, quarter, or year?
6. Which underlying transactions need review?
7. Are my accounts, data sources, budgets, and privacy preferences configured correctly?

The Dashboard is the product entry point. Topic pages provide deeper analysis. Transactions is the shared drill-down and data correction layer.

## 2. Sidebar structure

The MVP sidebar should expose these primary routes:

```text
Dashboard        /dashboard
Cash             /cash
Spending         /spending
Investments      /investments
Recap            /recap
Transactions     /transactions
Accounts         /accounts
Settings         /settings
```

A grouped version can be used when the sidebar needs more structure:

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
/cash                     -> cash balances, liquidity, upcoming payments, forecast risk
/spending                 -> income, expenses, budgets, category and merchant insights
/investments              -> portfolio, holdings, returns, allocation, FX exposure
/recap                    -> monthly, quarterly, and yearly recap
/transactions             -> transaction detail, review, categorization, rules
/accounts                 -> accounts, data sources, sync health, connection state
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

| Page | Core question | Primary responsibilities |
|---|---|---|
| Dashboard | Am I financially healthy right now? | KPI summary, net-worth trend, alerts, next actions, cross-page entry points. |
| Cash | Is my short-term liquidity safe? | Cash accounts, credit-card obligations, upcoming payments, 30/60/90 day cashflow risk. |
| Spending | Where did my money go? | Income/spending summary, budgets, categories, merchants, recurring costs, spending insights. |
| Investments | How is my wealth performing? | Holdings, portfolio value, returns, allocation, account breakdown, FX exposure. |
| Recap | What changed over a period? | Monthly/quarterly/yearly summaries, notable changes, recurring costs, action items. |
| Transactions | Is the source data correct? | Search, filters, review queue, categorization, exclusion, transfer marking, rule creation. |
| Accounts | Are my data sources healthy? | Connected/manual accounts, balances, source labels, sync health, data freshness. |
| Settings | How should FinSight interpret my data? | Budgets, category rules, forecast assumptions, base currency, timezone, privacy/AI modes. |

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

Examples:

```text
/spending?category=Dining
/transactions?category=Dining&period=2026-05
/transactions?merchant=Netflix
/transactions?account=cibc-visa
/transactions?review=true
/recap?period=2026-05
/settings?section=budget
```

## 6. Main navigation flow

```text
/
└── /dashboard
    ├── /cash
    │   ├── /transactions?account=...
    │   ├── /transactions?merchant=...
    │   └── /settings?section=forecast
    │
    ├── /spending
    │   ├── /transactions?category=...
    │   ├── /transactions?merchant=...
    │   └── /settings?section=budget
    │
    ├── /investments
    │   ├── /investments/new
    │   ├── /investments/holdings/:id
    │   └── /accounts?type=investment
    │
    ├── /recap
    │   ├── /spending?period=...
    │   ├── /transactions?period=...
    │   └── /investments?period=...
    │
    ├── /transactions
    │   └── /transactions?review=true
    │
    ├── /accounts
    │   ├── /accounts/new
    │   └── /transactions?account=...
    │
    └── /settings
```

## 7. Dashboard specification

Dashboard is the entry page and summary hub. It should answer: "What needs my attention right now?"

### 7.1 Recommended layout

```text
Dashboard
├── Header
│   ├── Total Net Worth primary value
│   ├── Change vs yesterday, amount and percentage
│   ├── Goal progress, such as FIRE / $145.3K of $1.5M / progress bar
│   ├── Current period
│   ├── Data status chips
│   └── Primary action, such as Add data
│
├── KPI Cards
│   ├── Cash
│   ├── Investments
│   ├── Spending
│   ├── Accounts
│   ├── Recap
│   └── Risk
│
├── Main Area
│   ├── Net Worth Trend
│   └── Alerts / Next Actions
│
├── Secondary Panels
│   ├── Cashflow Forecast Preview
│   ├── Spending Insight Preview
│   └── Recap / Goal Progress Preview
│
└── Quick Actions
    ├── Import CSV
    ├── Add Account
    ├── Add Holding
    └── Review Transactions
```

### 7.2 Confirmed Dashboard body layout

The confirmed layout below the Total Net Worth header is:

```text
Header
KPI Navigation Cards: Cash / Investments / Spending / Accounts / Recap / Risk
Main Content Grid: Net Worth Trend + Needs Attention
Secondary Insight Row: Cashflow Forecast / Spending Insight / Recap or Goal
Add-data and review actions: header menu first, larger empty-state actions only when needed
```

Desktop should use a six-card KPI row when width allows, then a two-column main grid with Net Worth Trend on the left and Needs Attention on the right. The secondary insight row should use three equal cards. On mobile, the order should be Header, KPI cards, Needs Attention, Net Worth Trend, Cashflow Forecast, Spending Insight, then Recap / Goal so urgent actions remain visible before detailed charts.

### 7.3 Dashboard header

The Dashboard header is the first visual focus. It should promote Total Net Worth above the generic page title.

| Element | Displays | Click target | Notes |
|---|---|---|---|
| Total Net Worth | Current total net worth. | `/investments` or future `/net-worth`. | MVP can use accounts-only net worth until holdings and valuation are implemented. Label the source clearly. |
| Change vs yesterday | Absolute amount and percentage, such as `+$1,182.30 · +0.82% vs yesterday`. | Same as Total Net Worth. | If previous-day data is unavailable, show `No previous day data` instead of `0.00%`. |
| Goal progress | User-configured goal name and target, such as `FIRE`, `$145.3K / $1.5M`, and a progress bar. | `/settings?section=goals`. | Default current value is Total Net Worth. If the user configures a scoped goal, such as an investment goal, use that scoped value instead. |
| Current period | Current month or reporting period, such as `Jun 2026`. | Future period selector. | Keep as display-only for the first implementation. |
| Data status chips | Local-first, Mock SimpleFIN, updated/stale/sync issue states. | `/accounts`. | Status details belong on Accounts. |
| Primary action | `Add data`. | Add-data menu or first supported target. | Menu items can include Import CSV, Add manual account, Add holding, and Connect SimpleFIN. |

When no user goal is configured, the goal area should show a setup state:

```text
Set a financial goal
Track progress toward FIRE, down payment, or emergency fund.
Set goal -> /settings?section=goals
```

### 7.4 Dashboard KPI cards

Total Net Worth belongs in the header, so KPI cards should not duplicate it. Recurring costs and spending insights are integrated into Spending instead of being first-level cards.

| KPI | Displays | Click target | Notes |
|---|---|---|---|
| Cash | Available cash, short-term liquidity, or next cash event. | `/cash`. | Use checking + savings + cash as the MVP value. |
| Investments | Portfolio value/return or setup CTA. | `/investments`. | Show `Add holdings` while investment tracking is deferred. |
| Spending | Current month spending and budget usage. | `/spending`. | Recurring costs and spending insights are summarized here and expanded on Spending. |
| Accounts | Connected/manual account count, sync health, or data freshness. | `/accounts`. | This also supports data status chip details. |
| Recap | Latest monthly/quarterly recap status. | `/recap`. | Show `May recap ready` when enough period data exists. |
| Risk | Highest priority risk, such as cashflow, budget, sync, or review risk. | Risk-specific target, usually `/cash`, `/spending`, `/accounts`, or `/transactions?review=true`. | Keep final naming and risk composition open until alert generation is implemented. |

### 7.5 Dashboard alerts and next actions

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

### 7.6 Dashboard secondary panels

| Panel | Purpose | Interactions |
|---|---|---|
| Net Worth Trend | Long-term financial health trend. | Range switch updates chart; details link opens investments or net-worth page. |
| Cashflow Forecast Preview | 30/60/90 day projected cash balance and risk. | Details link opens `/cash`. |
| Spending Insight Preview | Budget usage, top category, recurring summary, and spending insight preview. | Opens `/spending` or `/spending?category=...`. |
| Recap / Goal Progress Preview | Recap readiness or goal milestone context. | Opens `/recap` or `/settings?section=goals`. |

### 7.7 Dashboard first implementation scope

Implement first:

1. Header with Total Net Worth as the primary visual, absolute and percentage change vs yesterday, goal progress, current period, data status chips, and Add data action.
2. Six KPI cards: Cash, Investments, Spending, Accounts, Recap, and Risk.
3. Net-worth trend with explicit source/estimation label.
4. Alert / next-action feed.
5. Cashflow forecast preview and Spending insight preview.
6. Quick actions for import CSV, add account, add holding, and review transactions.

Defer:

1. AI-generated summary.
2. What-if simulation.
3. Net-worth attribution waterfall.
4. True investment return until holdings and valuation are implemented.
5. Multi-chart mode switching.

## 8. Implementation order

1. Update sidebar and add placeholder routes for Cash, Investments, Recap, Accounts, and Settings.
2. Refactor Dashboard KPI cards and add click targets.
3. Add Dashboard alert feed and forecast preview.
4. Add query-parameter-driven filters to Transactions.
5. Build Cash page using existing accounts and cashflow forecast data.
6. Expand Spending with income, recurring, budget, and merchant/category insights.
7. Add Investments as a setup-first page, then implement holdings and valuation.
8. Add Recap after enough period-level analytics exist.
9. Add Accounts and Settings to support data source health, budgets, and privacy configuration.
