"use client";

import { useMemo, useState } from "react";

import { formatCurrency, formatPercent } from "@/lib/format";
import { getNetWorthHistory } from "@/lib/api";
import type { NetWorthHistory, NetWorthRange } from "@/lib/types";

const RANGES: NetWorthRange[] = ["1D", "1W", "1M", "3M", "6M", "YTD", "1Y", "ALL"];

type Props = {
  initialHistory: NetWorthHistory;
  loadHistory?: (range: NetWorthRange) => Promise<NetWorthHistory>;
};

export function NetWorthTrendPanel({ initialHistory, loadHistory = getNetWorthHistory }: Props) {
  const [selectedRange, setSelectedRange] = useState<NetWorthRange>(initialHistory.range);
  const [chartMode, setChartMode] = useState<"value" | "returns">("value");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [historyByRange, setHistoryByRange] = useState<Partial<Record<NetWorthRange, NetWorthHistory>>>({ [initialHistory.range]: initialHistory });
  const history = historyByRange[selectedRange] ?? emptyHistory(selectedRange, initialHistory.current_value);
  const visiblePoints = useMemo(() => (chartMode === "returns" ? buildReturnSeries(history.points) : history.points), [chartMode, history.points]);
  const chart = useMemo(() => buildChartPath(visiblePoints), [visiblePoints]);
  const areaData = `${chart.pathData} L ${chart.lastPoint.x} 44 L ${chart.firstPoint.x} 44 Z`;
  const hoveredPoint = hoveredIndex === null ? null : visiblePoints[hoveredIndex] ?? null;
  const hoveredChartPoint = hoveredIndex === null ? null : chart.points[hoveredIndex] ?? null;
  const endpointStyle = {
    left: `${Number(chart.lastPoint.x)}%`,
    top: `${(Number(chart.lastPoint.y) / 44) * 100}%`
  };
  const changeIsPositive = history.change_amount >= 0;
  const changeLabel = `${changeIsPositive ? "+" : "-"}${formatCurrency(Math.abs(history.change_amount))} ${rangeCaption(selectedRange)}`;
  const returnLabel = `${changeIsPositive ? "+" : "-"}${formatPercent(Math.abs(history.change_pct))}`;
  const coverageLabel = history.coverage_start
    ? `Balance history since ${history.coverage_start}`
    : "Estimated until balance snapshots accumulate";

  function updateHoveredPoint(event: { currentTarget: HTMLDivElement; clientX: number }) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(Math.max((event.clientX - bounds.left) / Math.max(bounds.width, 1), 0), 1);
    setHoveredIndex(Math.round(ratio * Math.max(visiblePoints.length - 1, 0)));
  }

  return (
    <article className="panel span-2 net-worth-panel">
      <div className="net-worth-chart-header">
        <div>
          <span>Net worth trend</span>
          <strong>{chartMode === "returns" ? returnLabel : formatCurrency(history.current_value)}</strong>
          <small className={changeIsPositive ? "positive" : "negative"}>
            {chartMode === "returns" ? `${history.is_estimated !== false ? "Estimated" : "Snapshot"} return view ${rangeCaption(selectedRange)}` : `${changeLabel} \u00b7 ${formatPercent(Math.abs(history.change_pct))}`}
          </small>
          <small className="net-worth-coverage-note">{coverageLabel}</small>
        </div>
        <div className="chart-mode-toggle" aria-label="Chart mode">
          <button aria-pressed={chartMode === "value"} onClick={() => setChartMode("value")} type="button">
            Value
          </button>
          <button aria-pressed={chartMode === "returns"} onClick={() => setChartMode("returns")} type="button">
            Returns
          </button>
        </div>
      </div>

      <div
        className="net-worth-chart"
        aria-label={`Net worth history for ${selectedRange}`}
        onMouseMove={updateHoveredPoint}
        onPointerLeave={() => setHoveredIndex(null)}
        onPointerMove={updateHoveredPoint}
        role="img"
      >
        <svg preserveAspectRatio="none" viewBox="0 0 100 44">
          <defs>
            <linearGradient id="netWorthArea" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#146c2e" stopOpacity="0.2" />
              <stop offset="52%" stopColor="#146c2e" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#147d64" stopOpacity="0" />
            </linearGradient>
            <filter id="netWorthLineShadow" x="-4%" y="-12%" width="108%" height="124%">
              <feDropShadow dx="0" dy="1.4" floodColor="#0b3d22" floodOpacity="0.18" stdDeviation="1.2" />
            </filter>
          </defs>
          <g className="net-worth-grid" aria-hidden="true">
            <line x1="0" x2="100" y1="10" y2="10" />
            <line x1="0" x2="100" y1="20" y2="20" />
            <line x1="0" x2="100" y1="30" y2="30" />
            <line x1="0" x2="100" y1="40" y2="40" />
          </g>
          <path className="net-worth-area" d={areaData} fill="url(#netWorthArea)" />
          <path className="net-worth-line-underlay" d={chart.pathData} />
          <path className="net-worth-line" d={chart.pathData} filter="url(#netWorthLineShadow)" />
        </svg>
        <span aria-hidden="true" className="net-worth-endpoint-dot" style={endpointStyle} />
        {hoveredPoint && hoveredChartPoint ? (
          <>
            <span aria-hidden="true" className="chart-hover-guide" style={{ left: `${hoveredChartPoint.x}%` }} />
            <span aria-hidden="true" className="chart-hover-dot" style={{ left: `${hoveredChartPoint.x}%`, top: `${(hoveredChartPoint.y / 44) * 100}%` }} />
            <span className="chart-tooltip" style={{ left: `${hoveredChartPoint.x}%`, top: `${(hoveredChartPoint.y / 44) * 100}%` }}>
              <strong>{formatTooltipDate(hoveredPoint.date)}</strong>
              <small>{chartMode === "returns" ? formatPercent(hoveredPoint.value) : formatCurrency(hoveredPoint.value)}</small>
            </span>
          </>
        ) : null}
      </div>

      <div className="range-row">
        <div className="range-controls" aria-label="Net worth time range">
          {RANGES.map((range) => (
            <button
              aria-pressed={selectedRange === range}
              key={range}
              onClick={() => {
                setSelectedRange(range);
                void loadHistory(range).then((loadedHistory) => {
                  setHistoryByRange((current) => ({ ...current, [range]: loadedHistory }));
                });
              }}
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

type ChartPoint = { x: number; y: number };

function buildChartPath(points: NetWorthHistory["points"]): { firstPoint: { x: string; y: string }; lastPoint: { x: string; y: string }; pathData: string; points: ChartPoint[] } {
  if (points.length === 0) {
    return { firstPoint: { x: "2", y: "22" }, lastPoint: { x: "98", y: "22" }, pathData: "M 2 22", points: [] };
  }

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(max - min, 1);
  const chartPoints = points.map((point, index) => ({
    x: 2 + (index / Math.max(points.length - 1, 1)) * 96,
    y: 38 - ((point.value - min) / spread) * 30
  }));

  const pathData = chartPoints
    .map((point, index, allPoints) => {
      if (index === 0) {
        return `M ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
      }

      const previous = allPoints[index - 1];
      const previousControl = allPoints[index - 2] ?? previous;
      const next = allPoints[index + 1] ?? point;
      const smoothing = 0.18;
      const cp1x = previous.x + (point.x - previousControl.x) * smoothing;
      const cp1y = previous.y + (point.y - previousControl.y) * smoothing;
      const cp2x = point.x - (next.x - previous.x) * smoothing;
      const cp2y = point.y - (next.y - previous.y) * smoothing;

      return `C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)} ${cp2x.toFixed(2)} ${cp2y.toFixed(2)} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    })
    .join(" ");
  const firstPoint = chartPoints[0];
  const lastPoint = chartPoints[chartPoints.length - 1];

  return {
    firstPoint: { x: firstPoint.x.toFixed(2), y: firstPoint.y.toFixed(2) },
    lastPoint: { x: lastPoint.x.toFixed(2), y: lastPoint.y.toFixed(2) },
    pathData,
    points: chartPoints
  };
}

function buildReturnSeries(points: NetWorthHistory["points"]): NetWorthHistory["points"] {
  const firstValue = points[0]?.value || 1;
  return points.map((point) => ({
    ...point,
    value: ((point.value - firstValue) / firstValue) * 100
  }));
}

function emptyHistory(range: NetWorthRange, currentValue: number): NetWorthHistory {
  return {
    range,
    current_value: currentValue,
    change_amount: 0,
    change_pct: 0,
    points: currentValue ? [{ date: new Date().toISOString().slice(0, 10), value: currentValue }] : [],
    coverage_start: null,
    coverage_end: null,
    is_estimated: true
  };
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

function formatTooltipDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00.000Z`));
}
