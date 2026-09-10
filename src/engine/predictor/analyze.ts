import type { PatternPossibility, TurnipPattern, WeekPriceArray } from "../data/types.js";
import { generatePossibilities } from "./generatePossibilities.js";
import type { GenerationContext } from "./priceGenerators.js";

const MAX_FUDGE_FACTOR = 5;

/**
 * 分析一週的已知/部分已知價格，回傳所有存活的候選路徑（含機率、每時段區間），
 * 依「Pattern 總機率」由高到低排序，並在陣列開頭附加 pattern_number = 4 的
 * 全域聚合列（所有存活路徑的每時段最小/最大值）。
 *
 * 這是移植自 vendor/ac-nh-turnip-prices/predictions.js 的 Predictor.analyze_possibilities()，
 * 邏輯（含 fudge factor 重試、機率正規化、週保證最低/最高價、排序方式）逐步照抄，
 * 不可簡化或跳過任何一步——這些步驟就是使用者要的「排除所有不符合的可能曲線」。
 */
export function analyzePossibilities(
  prices: WeekPriceArray,
  firstBuy: boolean,
  previousPattern: TurnipPattern | undefined,
): PatternPossibility[] {
  let generatedPossibilities: PatternPossibility[] = [];

  // 反編譯結果並非 100% 精確重現遊戲的 32-bit 浮點運算，找不到任何符合路徑時，
  // 逐步放寬每個時段的容錯範圍（fudge factor），直到找到至少一種可能路徑為止。
  for (let fudgeFactor = 0; fudgeFactor <= MAX_FUDGE_FACTOR; fudgeFactor++) {
    const ctx: GenerationContext = { fudgeFactor };
    generatedPossibilities = Array.from(
      generatePossibilities(ctx, prices, firstBuy, previousPattern),
    ) as PatternPossibility[];
    if (generatedPossibilities.length > 0) {
      break;
    }
  }

  const totalProbability = generatedPossibilities.reduce((acc, it) => acc + it.probability, 0);
  for (const it of generatedPossibilities) {
    it.probability /= totalProbability;
  }

  for (const poss of generatedPossibilities) {
    let weekMins: number[] = [];
    let weekMaxes: number[] = [];
    for (const day of poss.prices.slice(2)) {
      if (day.min !== day.max) {
        weekMins.push(day.min);
        weekMaxes.push(day.max);
      } else {
        // 已經是區間之後又出現固定值，代表玩家跳過了某一格沒填，整段重置重新收集。
        weekMins = [];
        weekMaxes = [];
      }
    }
    if (!weekMins.length && !weekMaxes.length) {
      const lastDay = poss.prices[poss.prices.length - 1]!;
      weekMins.push(lastDay.min);
      weekMaxes.push(lastDay.max);
    }
    poss.weekGuaranteedMinimum = Math.max(...weekMins);
    poss.weekMax = Math.max(...weekMaxes);
  }

  const categoryTotals: Record<number, number> = {};
  for (const pattern of [0, 1, 2, 3]) {
    categoryTotals[pattern] = generatedPossibilities
      .filter((value) => value.patternNumber === pattern)
      .map((value) => value.probability)
      .reduce((previous, current) => previous + current, 0);
  }

  for (const pos of generatedPossibilities) {
    pos.categoryTotalProbability = categoryTotals[pos.patternNumber];
  }

  generatedPossibilities.sort((a, b) => {
    return (
      b.categoryTotalProbability! - a.categoryTotalProbability! || b.probability - a.probability
    );
  });

  const globalMinMax = [];
  for (let day = 0; day < 14; day++) {
    const dayPrices = { min: 999, max: 0 };
    for (const poss of generatedPossibilities) {
      const dayRange = poss.prices[day]!;
      if (dayRange.min < dayPrices.min) dayPrices.min = dayRange.min;
      if (dayRange.max > dayPrices.max) dayPrices.max = dayRange.max;
    }
    globalMinMax.push(dayPrices);
  }

  generatedPossibilities.unshift({
    patternNumber: 4,
    prices: globalMinMax,
    probability: Number.NaN,
    weekGuaranteedMinimum: Math.min(...generatedPossibilities.map((poss) => poss.weekGuaranteedMinimum!)),
    weekMax: Math.max(...generatedPossibilities.map((poss) => poss.weekMax!)),
  });

  return generatedPossibilities;
}
