export const currency = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD"
});

export const compactCurrency = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  notation: "compact",
  maximumFractionDigits: 1
});

export function formatCurrency(value: number): string {
  return currency.format(value);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

