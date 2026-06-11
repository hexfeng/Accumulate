# FinSight MVP Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Recap, Spending expansion, Investments MVP, and Settings MVP as working FinSight surfaces.

**Architecture:** Keep the existing pattern: server pages fetch initial API data, client components own local form/dialog interactions, and the FastAPI store remains the contract source for persisted local data. Investments adds a small holdings model and portfolio snapshot; Recap and Spending reuse transaction analytics; Settings updates the existing budget/settings API and makes it visible in the sidebar.

**Tech Stack:** FastAPI, Pydantic, SQLAlchemy Core, Next.js App Router, React client components, Vitest, Pytest.

---

### Task 1: Recap Page

**Files:**
- Modify: `apps/api/app/main.py`
- Modify: `apps/web/lib/api.ts`
- Create: `apps/web/components/recap-view.tsx`
- Modify: `apps/web/app/recap/page.tsx`
- Test: `apps/api/tests/test_api.py`
- Test: `apps/web/components/recap-view.test.tsx`

- [ ] Add failing API test for `GET /api/analytics/monthly-spending?month=YYYY-MM`.
- [ ] Add failing React test for a Recap page showing income, spending, net cashflow, savings rate, recurring costs, notable categories, and Transactions links.
- [ ] Implement the API query parameter and the Recap component/page.
- [ ] Run `npm run test:api` and `npm run test:web`.

### Task 2: Spending Expansion

**Files:**
- Modify: `apps/web/components/spending-view.tsx`
- Test: `apps/web/components/spending-view.test.tsx`

- [ ] Add failing React assertions for category budget threshold labels and recurring-cost drill-down links that preserve period context.
- [ ] Render a budget watchlist and recurring cost section on Spending.
- [ ] Run `npm run test:web`.

### Task 3: Investments MVP

**Files:**
- Modify: `apps/api/app/domain/schemas.py`
- Modify: `apps/api/app/store.py`
- Modify: `apps/api/app/db_store.py`
- Modify: `apps/api/app/main.py`
- Modify: `apps/web/lib/types.ts`
- Modify: `apps/web/lib/api.ts`
- Modify: `apps/web/lib/demo-data.ts`
- Create: `apps/web/components/investments-view.tsx`
- Modify: `apps/web/app/investments/page.tsx`
- Test: `apps/api/tests/test_api.py`
- Test: `apps/api/tests/test_db_store.py`
- Test: `apps/web/components/investments-view.test.tsx`

- [ ] Add failing API/store tests for holding create/update/delete and portfolio snapshot.
- [ ] Add failing React test for manual holding create/edit/delete and allocation/account grouping.
- [ ] Implement holding schemas, store persistence, API routes, web types/API, and Investments UI.
- [ ] Run `npm run test:api` and `npm run test:web`.

### Task 4: Settings MVP

**Files:**
- Modify: `apps/web/components/app-shell.tsx`
- Create: `apps/web/components/settings-view.tsx`
- Modify: `apps/web/app/settings/page.tsx`
- Modify: `apps/web/lib/api.ts`
- Test: `apps/web/components/app-shell.test.tsx`
- Test: `apps/web/components/settings-view.test.tsx`

- [ ] Add failing tests proving Settings is in primary nav and settings changes submit to the live API contract.
- [ ] Implement budget/category/forecast/privacy controls.
- [ ] Run `npm run test:web`.

### Task 5: Docs and Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/MVP_FRONTEND_NAVIGATION.md`

- [ ] Update implemented/deferred status.
- [ ] Run `npm run test:api`.
- [ ] Run `npm run test:web`.
- [ ] Run `npm run build:web`.
- [ ] Run rendered frontend QA on Dashboard, Recap, Spending, Investments, and Settings.
