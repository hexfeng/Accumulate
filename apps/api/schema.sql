CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    balance NUMERIC(18, 4) NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'CAD',
    source TEXT NOT NULL,
    last_synced_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    account_name TEXT NOT NULL,
    account_type TEXT NOT NULL,
    transaction_date DATE NOT NULL,
    amount NUMERIC(18, 4) NOT NULL,
    currency TEXT NOT NULL,
    merchant_raw TEXT NOT NULL,
    merchant_normalized TEXT,
    description_raw TEXT NOT NULL,
    source TEXT NOT NULL,
    category TEXT,
    subcategory TEXT,
    transaction_type TEXT,
    is_excluded_from_spending BOOLEAN DEFAULT FALSE,
    is_recurring BOOLEAN DEFAULT FALSE,
    confidence NUMERIC(5, 4),
    duplicate_hash TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS category_rules (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    pattern TEXT NOT NULL,
    merchant TEXT NOT NULL,
    category TEXT NOT NULL,
    subcategory TEXT,
    priority INT DEFAULT 100
);

CREATE TABLE IF NOT EXISTS user_settings (
    user_id TEXT PRIMARY KEY,
    monthly_budget NUMERIC(18, 4) NOT NULL DEFAULT 3000,
    category_budgets JSONB NOT NULL DEFAULT '{}'::jsonb,
    forecast_assumptions JSONB NOT NULL DEFAULT '{}'::jsonb
);

