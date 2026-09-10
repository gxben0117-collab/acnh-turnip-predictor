import {
  DAY_SLOT_KEYS,
  TurnipPattern,
  WEEK_SLOT_COUNT,
  type DaySlotKey,
  type PatternPossibility,
  type WeekPriceArray,
} from "../data/types.js";
import { analyzePossibilities } from "./analyze.js";

export interface PredictTurnipPricesInput {
  /** 週日購入價，未知時留空（會展開列舉 90～110 所有可能）。 */
  buyPrice?: number;
  /** 玩家在該座島「有史以來第一次」買大頭菜，預設 false。見演算法規格表第 4 節。 */
  firstBuy?: boolean;
  /** 上週的 Pattern，留空代表「不知道」，會用穩態機率。 */
  previousPattern?: TurnipPattern;
  /** 本週已知的時段價格，鍵值見 DaySlotKey（monAM ~ satPM），未提供代表尚未發生/未知。 */
  prices: Partial<Record<DaySlotKey, number>>;
}

/** 把友善的（買入價＋各時段價格）輸入轉成內部運算用的 14 格陣列（index 2~13 = 週一AM~週六PM）。 */
export function buildWeekPriceArray(
  buyPrice: number | undefined,
  dayPrices: Partial<Record<DaySlotKey, number>>,
): WeekPriceArray {
  const week: WeekPriceArray = new Array(WEEK_SLOT_COUNT).fill(Number.NaN);
  const resolvedBuyPrice = buyPrice ?? Number.NaN;
  week[0] = resolvedBuyPrice;
  week[1] = resolvedBuyPrice;

  DAY_SLOT_KEYS.forEach((key, i) => {
    const value = dayPrices[key];
    week[i + 2] = value === undefined ? Number.NaN : value;
  });

  return week;
}

/**
 * 大頭菜價格預測主入口：輸入購入價與已知價格，回傳所有仍然可能存在的候選路徑
 * （已依 Pattern 總機率排序，並在最前面附加全域聚合列 patternNumber === 4）。
 */
export function predictTurnipPrices(input: PredictTurnipPricesInput): PatternPossibility[] {
  const week = buildWeekPriceArray(input.buyPrice, input.prices);
  return analyzePossibilities(week, input.firstBuy ?? false, input.previousPattern);
}

/**
 * 把分析結果整理成「四個 Pattern 各自的總機率」，供 UI 顯示
 * 「🔥 大漲型 62%／📈 小漲型 21%／…」使用。數字直接取自
 * analyzePossibilities 已經算好的 categoryTotalProbability，不是另外重算。
 */
export function summarizePatternProbabilities(
  possibilities: readonly PatternPossibility[],
): Record<TurnipPattern, number> {
  const summary: Record<TurnipPattern, number> = {
    [TurnipPattern.Fluctuating]: 0,
    [TurnipPattern.LargeSpike]: 0,
    [TurnipPattern.Decreasing]: 0,
    [TurnipPattern.SmallSpike]: 0,
  };

  for (const poss of possibilities) {
    if (poss.patternNumber === 4) continue;
    summary[poss.patternNumber] = poss.categoryTotalProbability ?? 0;
  }

  return summary;
}
