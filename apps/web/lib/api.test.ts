import { afterEach, describe, expect, it, vi } from "vitest";

import { getMonthlySpending, getNetWorthHistory, getTransactions } from "./api";

describe("api fallbacks", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not return demo transactions when the transactions API fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("api offline")));

    await expect(getTransactions()).resolves.toEqual([]);
  });

  it("does not return demo monthly spending when the spending API fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    await expect(getMonthlySpending("2026-06")).resolves.toMatchObject({
      month: "2026-06",
      total_income: 0,
      total_spending: 0,
      categories: [],
      merchants: []
    });
  });

  it("does not return demo net worth points when the history API fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("api offline")));

    await expect(getNetWorthHistory("1Y")).resolves.toMatchObject({
      range: "1Y",
      current_value: 0,
      points: []
    });
  });
});
