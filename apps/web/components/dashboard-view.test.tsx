import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import { DashboardView } from "./dashboard-view";
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
    expect(screen.getByText("Your monthly spending limit is $2,000.")).toBeInTheDocument();
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

  it("switches the net worth chart into the mock returns view", () => {
    render(<DashboardView initialNetWorthHistory={demoNetWorthHistoryByRange["1M"]} snapshot={demoDashboard} />);

    fireEvent.click(screen.getByRole("button", { name: "Returns" }));

    expect(screen.getByRole("button", { name: "Returns" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/Mock return view past 1m/)).toBeInTheDocument();
  });

  it("renders the net worth endpoint as an unscaled solid dot", () => {
    const { container } = render(<DashboardView initialNetWorthHistory={demoNetWorthHistoryByRange["1M"]} snapshot={demoDashboard} />);

    expect(container.querySelector(".net-worth-endpoint-dot")).toBeInTheDocument();
    expect(container.querySelector("circle.net-worth-endpoint")).not.toBeInTheDocument();
  });
});
