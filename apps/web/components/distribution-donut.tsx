import { formatPercent } from "@/lib/format";

export type DistributionDonutItem = {
  color: string;
  label: string;
  percent: number;
};

type DistributionDonutProps = {
  centerLabel: string;
  items: DistributionDonutItem[];
  totalLabel: string;
};

export function DistributionDonut({ centerLabel, items, totalLabel }: DistributionDonutProps) {
  const radius = 58;
  const strokeWidth = 4;
  const circumference = 2 * Math.PI * radius;
  let cursor = 0;

  return (
    <svg className="cash-pie cash-donut" role="img" aria-label={items.map((item) => `${item.label} ${formatPercent(item.percent)}`).join(", ")} viewBox="0 0 120 120">
      {items.map((item) => {
        const gapPercent = items.length > 1 ? 2.2 : 0;
        const visiblePercent = Math.max(0, item.percent - gapPercent);
        const dashLength = (visiblePercent / 100) * circumference;
        const dashOffset = -(cursor / 100) * circumference;
        cursor += item.percent;

        return (
          <circle
            className="cash-donut-segment"
            cx="60"
            cy="60"
            fill="none"
            key={item.label}
            r={radius}
            stroke={item.color}
            strokeDasharray={`${dashLength} ${circumference - dashLength}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            strokeWidth={strokeWidth}
          />
        );
      })}
      <text className="cash-donut-center-value" textAnchor="middle" x="60" y="56">
        {totalLabel}
      </text>
      <text className="cash-donut-center-label" textAnchor="middle" x="60" y="70">
        {centerLabel}
      </text>
    </svg>
  );
}
