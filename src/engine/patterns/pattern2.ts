import type { PriceRange, WeekPriceArray } from "../data/types.js";
import { TurnipPattern } from "../data/types.js";
import type { GenerationContext } from "../predictor/priceGenerators.js";
import { generateDecreasingRandomPrice } from "../predictor/priceGenerators.js";
import type { RawPossibility } from "./shared.js";

/**
 * 遞減型（Decreasing）。整週（index 2～13）連續遞減，沒有反彈，只有一種「形狀」。
 * 對應遊戲邏輯：
 *
 *   rate = 0.9; rate -= randfloat(0, 0.05); // 等效 rate ~ U(0.85, 0.9)
 *   for (work = 2; work < 14; work++) {
 *     sellPrices[work] = intceil(rate * basePrice);
 *     rate -= 0.03; rate -= randfloat(0, 0.02);
 *   }
 *
 * 詳見 docs/演算法原始數據規格表.md 第 2 節「Pattern 2：遞減型」。
 */
export function* generatePattern2(
  ctx: GenerationContext,
  givenPrices: WeekPriceArray,
): Generator<RawPossibility> {
  const buyPrice = givenPrices[0]!;
  const predictedPrices: PriceRange[] = [
    { min: buyPrice, max: buyPrice },
    { min: buyPrice, max: buyPrice },
  ];
  let probability = 1;

  probability *= generateDecreasingRandomPrice(ctx, givenPrices, predictedPrices, 2, 14 - 2, 0.85, 0.9, 0.03, 0.05);
  if (probability === 0) return;

  yield { patternNumber: TurnipPattern.Decreasing, prices: predictedPrices, probability };
}
