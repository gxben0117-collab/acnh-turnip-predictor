/**
 * 區間運算工具。移植自 vendor/ac-nh-turnip-prices/predictions.js 的
 * range_length() / clamp() / range_intersect() / range_intersect_length()。
 */
export type NumRange = readonly [number, number];

export function rangeLength(range: NumRange): number {
  return range[1] - range[0];
}

export function clamp(x: number, min: number, max: number): number {
  return Math.min(Math.max(x, min), max);
}

/** 若兩區間不相交回傳 null，否則回傳交集區間。 */
export function rangeIntersect(range1: NumRange, range2: NumRange): [number, number] | null {
  if (range1[0] > range2[1] || range1[1] < range2[0]) {
    return null;
  }
  return [Math.max(range1[0], range2[0]), Math.min(range1[1], range2[1])];
}

export function rangeIntersectLength(range1: NumRange, range2: NumRange): number {
  if (range1[0] > range2[1] || range1[1] < range2[0]) {
    return 0;
  }
  const intersection = rangeIntersect(range1, range2);
  return intersection ? rangeLength(intersection) : 0;
}
