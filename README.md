# FinSight

Local-first personal finance dashboard for banking, spending analysis, recurring costs, and 30/60/90 day cashflow forecasting.

## What is implemented

- FastAPI backend with local single-user scope.
- CSV transaction import with normalization and deduplication.
- Mock SimpleFIN status/connect/sync/disconnect endpoints.
- Rule-based categorization with user correction rules.
- Monthly spending summaries, recurring detection, and cashflow forecast engine.
- Next.js dashboard with Dashboard, Transactions, and Spending pages.
- Demo seed endpoint for local development.

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
