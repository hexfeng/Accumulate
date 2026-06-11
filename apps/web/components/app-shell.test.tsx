import { render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "./app-shell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/accounts"
}));

describe("AppShell", () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });
  });

  it("includes working MVP routes in primary navigation including Settings", () => {
    render(<AppShell><div>Body</div></AppShell>);

    const logo = screen.getByLabelText("FinSight logo");
    expect(logo.tagName).toBe("svg");
    expect(logo.querySelector(".brand-trend-line")).toBeInTheDocument();
    expect(logo.querySelector(".brand-trend-arrow")).toBeInTheDocument();
    expect(screen.queryByText("F")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Accounts/ })).toHaveAttribute("href", "/accounts");
    expect(screen.getByRole("link", { name: /Accounts/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /Accounts/ })).toHaveClass("nav-active");
    expect(screen.getByRole("link", { name: /Settings/ })).toHaveAttribute("href", "/settings");
  });
});
