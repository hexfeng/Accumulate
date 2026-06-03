"use client";

import { useMemo, useState } from "react";

import { demoNetWorthHistoryByRange } from "@/lib/demo-data";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { NetWorthHistory, NetWorthRange } from "@/lib/types";

const RANGES: NetWorthRange[] = ["1D", "1W", "1M", "3M", "6M", "YTD", "1Y", "ALL"];

type Props = {
  initialHistory: NetWorthHistory;
};

export function NetWorthTrendPanel({ initialHistory }: Props) {
  const [selectedRange, setSelectedRange] = useState<NetWorthRange>(initialHistory.range);
  const historyByRange = useMemo(
    () => ({
      ...demoNetWorthHistoryByRange,
      [initialHistory.range]: initialHistory
    }),
    [initialHistory]
  );
  const history = historyByRange[selectedRange];
  const pathData = useMemo(() => buildLinePath(history.points), [history.points]);
  const areaData = `${pathData} L 100 44 L 0 44 Z`;
  const changeIsPositive = history.change_amount >= 0;
  const changeLabel = `${changeIsPositive ? "+" : "-"}${formatCurrency(Math.abs(history.change_amount))} ${rangeCaption(selectedRange)}`;

  return (
    <article className="panel span-2 net-worth-panel">
      <div className="net-worth-chart-header">
        <div>
          <span>Net worth trend</span>
          <strong>{formatCurrency(history.current_value)}</strong>
          <small className={changeIsPositive ? "positive" : "negative"}>
            {changeLabel} - {formatPercent(Math.abs(history.change_pct))}
          </small>
        </div>
        <div className="chart-mode-toggle" aria-label="Chart mode">
          <button aria-pressed="true" type="button">
            Value
          </button>
          <button aria-pressed="false" type="button">
            Returns
          </button>
        </div>
      </div>

      <div className="net-worth-chart" aria-label={`Net worth history for ${selectedRange}`} role="img">
        <svg preserveAspectRatio="none" viewBox="0 0 100 44">
          <defs>
            <linearGradient id="netWorthArea" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#147d64" stopOpacity="0.24" />
              <stop offset="100%" stopColor="#147d64" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path className="net-worth-area" d={areaData} fill="url(#netWorthArea)" />
          <path className="net-worth-line" d={pathData} />
        </svg>
      </div>

      <div className="range-row">
        <div className="range-controls" aria-label="Net worth time range">
          {RANGES.map((range) => (
            <button
              aria-pressed={selectedRange === range}
              key={range}
              onClick={() => setSelectedRange(range)}
              type="button"
            >
              {range}
            </button>
          ))}
        </div>
      </div>
    </article>
  );
}

function buildLinePath(points: NetWorthHistory["points"]): string {
  if (points.length === 0) {
    return "M 0 22";
  }

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(max - min, 1);

  return points
    .map((point, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * 100;
      const y = 38 - ((point.value - min) / spread) * 30;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function rangeCaption(range: NetWorthRange): string {
  if (range === "YTD") {
    return "year to date";
  }
  if (range === "ALL") {
    return "all time";
  }
  return `past ${range.toLowerCase()}`;
}
