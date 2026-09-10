import { TurnipPattern } from "../data/types.js";

/**
 * 上週 Pattern → 本週 Pattern 的轉移機率矩陣。
 * 移植自 vendor/ac-nh-turnip-prices/predictions.js 的 PROBABILITY_MATRIX，數字不可更動。
 * 詳見 docs/演算法原始數據規格表.md 第 3 節的表格版本。
 */
export const PROBABILITY_MATRIX: Record<TurnipPattern, Record<TurnipPattern, number>> = {
  [TurnipPattern.Fluctuating]: {
    [TurnipPattern.Fluctuating]: 0.2,
    [TurnipPattern.LargeSpike]: 0.3,
    [TurnipPattern.Decreasing]: 0.15,
    [TurnipPattern.SmallSpike]: 0.35,
  },
  [TurnipPattern.LargeSpike]: {
    [TurnipPattern.Fluctuating]: 0.5,
    [TurnipPattern.LargeSpike]: 0.05,
    [TurnipPattern.Decreasing]: 0.2,
    [TurnipPattern.SmallSpike]: 0.25,
  },
  [TurnipPattern.Decreasing]: {
    [TurnipPattern.Fluctuating]: 0.25,
    [TurnipPattern.LargeSpike]: 0.45,
    [TurnipPattern.Decreasing]: 0.05,
    [TurnipPattern.SmallSpike]: 0.25,
  },
  [TurnipPattern.SmallSpike]: {
    [TurnipPattern.Fluctuating]: 0.45,
    [TurnipPattern.LargeSpike]: 0.25,
    [TurnipPattern.Decreasing]: 0.15,
    [TurnipPattern.SmallSpike]: 0.15,
  },
};

/**
 * 不知道上週 Pattern 時使用的穩態機率（對轉移矩陣取極限分布），
 * 依序為 [波動型, 大漲型, 遞減型, 小漲型]。這是 vendor 原始碼寫死的常數
 * （社群依 issue #68 / PR #90 驗證得出），移植時原樣照抄，不要自己重算。
 */
export const UNKNOWN_PREVIOUS_PATTERN_PROBABILITY: readonly [number, number, number, number] = [
  4530 / 13082,
  3236 / 13082,
  1931 / 13082,
  3385 / 13082,
];

/**
 * 取得本週四種 Pattern 的先驗機率。
 * previousPattern 為 undefined（不知道上週型態）時回傳穩態機率。
 */
export function getTransitionProbability(
  previousPattern: TurnipPattern | undefined,
): readonly [number, number, number, number] {
  if (
    previousPattern === undefined ||
    Number.isNaN(previousPattern) ||
    previousPattern < 0 ||
    previousPattern > 3
  ) {
    return UNKNOWN_PREVIOUS_PATTERN_PROBABILITY;
  }

  const row = PROBABILITY_MATRIX[previousPattern];
  return [
    row[TurnipPattern.Fluctuating],
    row[TurnipPattern.LargeSpike],
    row[TurnipPattern.Decreasing],
    row[TurnipPattern.SmallSpike],
  ];
}
