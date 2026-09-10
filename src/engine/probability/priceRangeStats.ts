import type { PatternPossibility } from "../data/types.js";

/**
 * 「理論可能範圍」與「高機率範圍」分開計算。
 *
 * - theoretical：所有存活路徑在該時段的全域最小/最大值（含極端小機率路徑），
 *   等同 vendor 原始碼 pattern_number===4 那一列在單一天的數字。
 * - highProbability：把存活路徑依機率由高到低排序，累加機率直到達到 coverage
 *   （預設 80%）為止，取這個子集合的最小/最大值。這是本專案自己定義的統計量，
 *   不是 vendor 原始碼現成算好的欄位——vendor 只提供「理論範圍」，
 *   「高機率範圍」是我們依規格表要求（理論範圍與高機率範圍分開顯示）另外加的。
 */
export interface DayRangeStats {
  theoretical: { min: number; max: number };
  highProbability: { min: number; max: number };
}

export function computeDayRangeStats(
  candidates: readonly PatternPossibility[],
  day: number,
  coverage = 0.8,
): DayRangeStats {
  let theoreticalMin = Number.POSITIVE_INFINITY;
  let theoreticalMax = Number.NEGATIVE_INFINITY;
  let hpMin = Number.POSITIVE_INFINITY;
  let hpMax = Number.NEGATIVE_INFINITY;

  const sorted = [...candidates].sort((a, b) => b.probability - a.probability);
  let cumulative = 0;

  for (const poss of sorted) {
    const range = poss.prices[day];
    if (!range) continue;
    theoreticalMin = Math.min(theoreticalMin, range.min);
    theoreticalMax = Math.max(theoreticalMax, range.max);

    if (cumulative < coverage) {
      hpMin = Math.min(hpMin, range.min);
      hpMax = Math.max(hpMax, range.max);
      cumulative += poss.probability;
    }
  }

  return {
    theoretical: {
      min: Number.isFinite(theoreticalMin) ? theoreticalMin : 0,
      max: Number.isFinite(theoreticalMax) ? theoreticalMax : 0,
    },
    highProbability: {
      min: Number.isFinite(hpMin) ? hpMin : 0,
      max: Number.isFinite(hpMax) ? hpMax : 0,
    },
  };
}
