"use client";

import React, { useState } from "react";

import { updateSettings } from "@/lib/api";
import type { BudgetSettings } from "@/lib/types";

type SettingsViewProps = {
  initialSettings: BudgetSettings;
};

const CATEGORY_KEYS = ["Groceries", "Dining", "Subscriptions"];

export function SettingsView({ initialSettings }: SettingsViewProps) {
  const [settings, setSettings] = useState(initialSettings);
  const [status, setStatus] = useState("Ready");
  const assumptions = settings.forecast_assumptions;

  function updateCategoryBudget(category: string, value: number) {
    setSettings((current) => ({
      ...current,
      category_budgets: {
        ...current.category_budgets,
        [category]: value
      }
    }));
  }

  function updateAssumption(key: string, value: unknown) {
    setSettings((current) => ({
      ...current,
      forecast_assumptions: {
        ...current.forecast_assumptions,
        [key]: value
      }
    }));
  }

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("Saving settings");
    await updateSettings(settings);
    setStatus("Settings saved");
  }

  return (
    <section className="page-stack settings-page" aria-label="Settings workspace">
      <header className="page-header">
        <div>
          <span className="section-eyebrow">Product settings</span>
          <h1>Settings</h1>
          <p>Budgets, category rules, forecast assumptions, currency defaults, and privacy controls that affect live pages.</p>
        </div>
      </header>

      <form className="settings-grid" onSubmit={saveSettings}>
        <article className="panel">
          <div className="panel-heading compact">
            <h2>Budgets</h2>
            <span>Feeds Spending</span>
          </div>
          <label className="budget-input-row">
            <span>Monthly spending budget</span>
            <input
              min="0"
              step="1"
              type="number"
              value={settings.monthly_budget}
              onChange={(event) => setSettings((current) => ({ ...current, monthly_budget: Number(event.target.value) }))}
            />
          </label>
          {CATEGORY_KEYS.map((category) => (
            <label className="budget-input-row" key={category}>
              <span>{category} budget</span>
              <input
                aria-label={`${category} budget`}
                min="0"
                step="1"
                type="number"
                value={settings.category_budgets[category] ?? 0}
                onChange={(event) => updateCategoryBudget(category, Number(event.target.value))}
              />
            </label>
          ))}
        </article>

        <article className="panel">
          <div className="panel-heading compact">
            <h2>Forecast assumptions</h2>
            <span>Feeds Cash</span>
          </div>
          <label className="budget-input-row">
            <span>Cash buffer target</span>
            <input
              min="0"
              step="1"
              type="number"
              value={Number(assumptions.cash_buffer ?? 0)}
              onChange={(event) => updateAssumption("cash_buffer", Number(event.target.value))}
            />
          </label>
          <label className="budget-input-row">
            <span>Income model</span>
            <select value={String(assumptions.income_model ?? "last-observed-month")} onChange={(event) => updateAssumption("income_model", event.target.value)}>
              <option value="last-observed-month">Last observed month</option>
              <option value="three-month-average">Three-month average</option>
              <option value="manual">Manual assumption</option>
            </select>
          </label>
        </article>

        <article className="panel">
          <div className="panel-heading compact">
            <h2>Currency and locale</h2>
            <span>Local defaults</span>
          </div>
          <label className="budget-input-row">
            <span>Base currency</span>
            <select value={String(assumptions.base_currency ?? "CAD")} onChange={(event) => updateAssumption("base_currency", event.target.value)}>
              <option value="CAD">CAD</option>
              <option value="USD">USD</option>
            </select>
          </label>
          <label className="budget-input-row">
            <span>Timezone</span>
            <select value={String(assumptions.timezone ?? "America/Toronto")} onChange={(event) => updateAssumption("timezone", event.target.value)}>
              <option value="America/Toronto">America/Toronto</option>
              <option value="America/Vancouver">America/Vancouver</option>
              <option value="America/New_York">America/New_York</option>
            </select>
          </label>
        </article>

        <article className="panel">
          <div className="panel-heading compact">
            <h2>Privacy controls</h2>
            <span>Local-first</span>
          </div>
          <label className="budget-input-row">
            <span>AI privacy mode</span>
            <select value={String(assumptions.ai_mode ?? "aggregated")} onChange={(event) => updateAssumption("ai_mode", event.target.value)}>
              <option value="off">Off</option>
              <option value="aggregated">Aggregated only</option>
              <option value="detailed">Detailed local data</option>
            </select>
          </label>
          <label className="settings-check-row">
            <input
              aria-label="Local-first controls"
              checked={Boolean(assumptions.local_first ?? true)}
              type="checkbox"
              onChange={(event) => updateAssumption("local_first", event.target.checked)}
            />
            <span>Keep local-first controls enabled</span>
          </label>
          <button className="placeholder-primary" type="submit">Save settings</button>
          <div role="status" aria-live="polite">{status}</div>
        </article>
      </form>
    </section>
  );
}
