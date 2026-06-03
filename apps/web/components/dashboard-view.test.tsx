import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import { DashboardView } from "./dashboard-view";
import { demoDashboard, demoNetWorthHistoryByRange } from "@/lib/demo-data";

describe("DashboardView", () => {
  it("renders banking spending and net worth trend metrics from a dashboard snapshot", () => {
    render(<DashboardView initialNetWorthHistory={demoNetWorthHistoryByRange["1M"]} snapshot={demoDashboard} />);

    expect(screen.getByText("Cash position")).toBeInTheDocument();
    expect(screen.getByText("$15,400.00")).toBeInTheDocument();
    expect(screen.getByText("Monthly spending")).toBeInTheDocument();
    expect(screen.getByText("$1,248.26")).toBeInTheDocument();
    expect(screen.getByText("Net worth trend")).toBeInTheDocument();
    expect(screen.queryByText("30/60/90 cashflow forecast")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1M" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Netflix")).toBeInTheDocument();
  });

  it("switches the displayed net worth range", () => {
    render(<DashboardView initialNetWorthHistory={demoNetWorthHistoryByRange["1M"]} snapshot={demoDashboard} />);

    fireEvent.click(screen.getByRole("button", { name: "1W" }));

    expect(screen.getByRole("button", { name: "1W" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "ALL" }));

    expect(screen.getByRole("button", { name: "ALL" })).toHaveAttribute("aria-pressed", "true");
  });
});
