import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsView } from "./settings-view";
import * as api from "@/lib/api";
import type { BudgetSettings } from "@/lib/types";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    updateSettings: vi.fn()
  };
});

const settings: BudgetSettings = {
  monthly_budget: 3000,
  category_budgets: {
    Groceries: 650,
    Dining: 500,
    Subscriptions: 150
  },
  forecast_assumptions: {
    cash_buffer: 1000,
    income_model: "last-observed-month",
    ai_mode: "aggregated",
    local_first: true
  }
};

describe("SettingsView", () => {
  beforeEach(() => {
    vi.mocked(api.updateSettings).mockResolvedValue(settings);
  });

  it("updates budget, category, forecast, and privacy settings through the live settings contract", async () => {
    render(<SettingsView initialSettings={settings} />);

    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Monthly spending budget"), { target: { value: "3500" } });
    fireEvent.change(screen.getByLabelText("Groceries budget"), { target: { value: "700" } });
    fireEvent.change(screen.getByLabelText("Cash buffer target"), { target: { value: "1500" } });
    fireEvent.change(screen.getByLabelText("AI privacy mode"), { target: { value: "off" } });
    fireEvent.click(screen.getByLabelText("Local-first controls"));
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

    await waitFor(() => expect(api.updateSettings).toHaveBeenCalledWith({
      monthly_budget: 3500,
      category_budgets: {
        Groceries: 700,
        Dining: 500,
        Subscriptions: 150
      },
      forecast_assumptions: {
        cash_buffer: 1500,
        income_model: "last-observed-month",
        ai_mode: "off",
        local_first: false
      }
    }));
    expect(within(screen.getByRole("status")).getByText("Settings saved")).toBeInTheDocument();
  });
});
