import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { DashboardView } from "./dashboard-view";
import { NetWorthTrendPanel } from "./net-worth-trend-panel";
import { demoDashboard, demoNetWorthHistoryByRange } from "@/lib/demo-data";

describe("DashboardView", () => {
  it("renders the Dashboard preview hero, KPI navigation, and insights from a snapshot", () => {
    render(<DashboardView initialNetWorthHistory={demoNetWorthHistoryByRange["1M"]} snapshot={demoDashboard} />);

    expect(screen.getByText("Total net worth")).toBeInTheDocument();
    expect(screen.getAllByText("$14,540.00").length).toBeGreaterThan(0);
    expect(screen.getByText(/vs yesterday/)).toBeInTheDocument();
    expect(screen.getByText("FIRE")).toBeInTheDocument();
    expect(screen.getByText("Cash")).toBeInTheDocument();
    expect(screen.getByText("Investments")).toBeInTheDocument();
    expect(screen.getByText("Spending")).toBeInTheDocument();
    expect(screen.getByText("Accounts")).toBeInTheDocument();
    expect(screen.getByText("Recap")).toBeInTheDocument();
    expect(screen.getByText("Risk")).toBeInTheDocument();
    expect(screen.getByText("Spending Summary")).toBeInTheDocument();
    expect(screen.getByText("Spent")).toBeInTheDocument();
    expect(screen.getByText("Your monthly spending limit is $3,000.")).toBeInTheDocument();
    expect(screen.queryByText("Needs attention")).not.toBeInTheDocument();
    expect(screen.getByText("Cashflow forecast")).toBeInTheDocument();
    expect(screen.getByText("Spending insight")).toBeInTheDocument();
    expect(screen.getByText("Recap / goal")).toBeInTheDocument();
    expect(screen.getByText("Net worth trend")).toBeInTheDocument();
    expect(screen.getByText("Mock asset mix")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Stocks 42%, ETF 33%, Cash 25%" })).toBeInTheDocument();
    expect(screen.queryByText("30/60/90 cashflow forecast")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1M" })).toHaveAttribute("aria-pressed", "true");
  });

  it("switches the displayed net worth range", () => {
    render(<DashboardView initialNetWorthHistory={demoNetWorthHistoryByRange["1M"]} snapshot={demoDashboard} />);

    fireEvent.click(screen.getByRole("button", { name: "1W" }));

    expect(screen.getByRole("button", { name: "1W" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "ALL" }));

    expect(screen.getByRole("button", { name: "ALL" })).toHaveAttribute("aria-pressed", "true");
  });

  it("loads real net worth history when switching ranges", async () => {
    const loadHistory = vi.fn().mockResolvedValue({
      ...demoNetWorthHistoryByRange["1Y"],
      range: "1Y",
      current_value: 20000,
      coverage_start: "2025-06-11",
      coverage_end: "2026-06-11",
      is_estimated: false
    });

    render(<NetWorthTrendPanel initialHistory={demoNetWorthHistoryByRange["1M"]} loadHistory={loadHistory} />);

    fireEvent.click(screen.getByRole("button", { name: "1Y" }));

    await waitFor(() => expect(loadHistory).toHaveBeenCalledWith("1Y"));
    await waitFor(() => expect(screen.getByText("Balance history since 2025-06-11")).toBeInTheDocument());
  });

  it("shows the real balance snapshot coverage window when provided", () => {
    render(
      <DashboardView
        initialNetWorthHistory={{
          ...demoNetWorthHistoryByRange["1M"],
          coverage_start: "2026-06-01",
          coverage_end: "2026-06-11",
          is_estimated: false
        }}
        snapshot={demoDashboard}
      />
    );

    expect(screen.getByText("Balance history since 2026-06-01")).toBeInTheDocument();
  });

  it("switches the net worth chart into the mock returns view", () => {
    render(<DashboardView initialNetWorthHistory={demoNetWorthHistoryByRange["1M"]} snapshot={demoDashboard} />);

    fireEvent.click(screen.getByRole("button", { name: "Returns" }));

    expect(screen.getByRole("button", { name: "Returns" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/Estimated return view past 1m/)).toBeInTheDocument();
  });

  it("renders the net worth endpoint as an unscaled solid dot", () => {
    const { container } = render(<DashboardView initialNetWorthHistory={demoNetWorthHistoryByRange["1M"]} snapshot={demoDashboard} />);

    expect(container.querySelector(".net-worth-endpoint-dot")).toBeInTheDocument();
    expect(container.querySelector("circle.net-worth-endpoint")).not.toBeInTheDocument();
  });

  it("shows a value tooltip when hovering the net worth curve", () => {
    const history = {
      ...demoNetWorthHistoryByRange["1M"],
      points: [
        { date: "2026-06-01", value: 10000 },
        { date: "2026-06-15", value: 11000 },
        { date: "2026-06-30", value: 12500 }
      ],
      current_value: 12500,
      change_amount: 2500,
      change_pct: 25
    };
    const { container } = render(<NetWorthTrendPanel initialHistory={history} />);
    const chart = container.querySelector(".net-worth-chart") as HTMLElement;
    chart.getBoundingClientRect = () => ({ left: 0, top: 0, width: 300, height: 132, bottom: 132, right: 300, x: 0, y: 0, toJSON: () => ({}) });

    fireEvent.mouseMove(chart, { clientX: 150, clientY: 40 });

    expect(screen.getByText("Jun 15, 2026")).toBeInTheDocument();
    expect(screen.getByText("$11,000.00")).toBeInTheDocument();
    expect(container.querySelector(".chart-hover-guide")).toBeInTheDocument();
  });

  it("renders holdings-aware net worth, real allocation, and investment KPI", () => {
    const { container } = render(
      <DashboardView
        initialNetWorthHistory={{ ...demoNetWorthHistoryByRange["1M"], current_value: 17500 }}
        snapshot={{
          ...demoDashboard,
          net_worth_total: 17500,
          net_worth_uses_manual_holdings: true,
          investment_summary: {
            total_value: 12000,
            total_cost: 8000,
            unrealized_gain: 4000,
            unrealized_gain_pct: 50,
            allocation: [{ label: "VFV.TO", value: 12000, percent: 100 }],
            accounts: [{ account_id: "tfsa", account_name: "TFSA", value: 12000, holdings_count: 1 }]
          },
          asset_allocation: [
            { label: "Cash", value: 2000, percent: 11.11, tone: "cash" },
            { label: "ETFs", value: 12000, percent: 66.67, tone: "etf" },
            { label: "Investment balances", value: 4000, percent: 22.22, tone: "stocks" }
          ]
        }}
      />
    );

    expect(screen.getAllByText("$17,500.00").length).toBeGreaterThan(0);
    expect(screen.getByText("Holdings-aware estimate")).toBeInTheDocument();
    expect(screen.getByText("Asset mix")).toBeInTheDocument();
    expect(screen.queryByText("Mock asset mix")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Cash 11%, ETFs 67%, Investment balances 22%" })).toBeInTheDocument();
    const segmentWidths = Array.from(container.querySelectorAll<HTMLElement>(".asset-segment"))
      .map((segment) => segment.style.width)
      .filter(Boolean);
    expect(segmentWidths.every((width) => !width.startsWith("-"))).toBe(true);
    expect(segmentWidths).toEqual(["11.11%", "66.67%", "22.22%"]);
    expect(screen.getByText("$12,000.00")).toBeInTheDocument();
    expect(screen.getByText("Portfolio value")).toBeInTheDocument();
  });

  it("keeps zero net worth as a valid displayed value", () => {
    render(
      <DashboardView
        initialNetWorthHistory={{ ...demoNetWorthHistoryByRange["1M"], current_value: 0, points: [] }}
        snapshot={{
          ...demoDashboard,
          accounts: [
            { id: "cash", user_id: "local-user", name: "Cash", type: "cash", balance: 1000, currency: "CAD", source: "manual" }
          ],
          net_worth_total: 5000
        }}
      />
    );

    expect(screen.getByRole("link", { name: "Open investments from total net worth" })).toHaveTextContent("$0.00");
  });
});
