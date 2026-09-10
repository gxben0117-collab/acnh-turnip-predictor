export function formatBells(value: number): string {
  const rounded = Math.round(value);
  return `${rounded.toLocaleString("zh-TW")} 鈴錢`;
}

export function formatPercent(ratio: number, digits = 1): string {
  const sign = ratio > 0 ? "+" : "";
  return `${sign}${(ratio * 100).toFixed(digits)}%`;
}

/** 純機率百分比顯示（不加正負號），例如「85%」。 */
export function formatProbabilityPercent(ratio: number, digits = 0): string {
  return `${(ratio * 100).toFixed(digits)}%`;
}

export function formatPriceRange(min: number, max: number): string {
  if (min === max) return `${Math.round(min)}`;
  return `${Math.round(min)} ～ ${Math.round(max)}`;
}
