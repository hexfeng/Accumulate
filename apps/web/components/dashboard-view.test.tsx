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
});
