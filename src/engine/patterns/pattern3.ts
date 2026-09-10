import type { PriceRange, WeekPriceArray } from "../data/types.js";
import { TurnipPattern } from "../data/types.js";
import type { GenerationContext } from "../predictor/priceGenerators.js";
import {
  generateDecreasingRandomPrice,
  generateIndividualRandomPrice,
  generatePeakPrice,
} from "../predictor/priceGenerators.js";
import { multiplyGeneratorProbability, type RawPossibility } from "./shared.js";

/**
 * 小漲型（Small Spike）。結構：遞減期（可為 0 格）→ 兩格緩漲 → 三格小尖峰(帽子形) →
 * （若還有剩餘）遞減期。對應遊戲邏輯：
 *
 *   peakStart = randint(2, 9);
 *   rate = randfloat(0.9, 0.4); // 高峰前遞減
 *   for (work = 2; work < peakStart; work++) { rate -= 0.03; rate -= randfloat(0, 0.02); }
 *   sellPrices[work++] = intceil(randfloat(0.9, 1.4) * basePrice);
 *   sellPrices[work++] = intceil(randfloat(0.9, 1.4) * basePrice);
 *   rate = randfloat(1.4, 2.0);
 *   sellPrices[work++] = intceil(randfloat(1.4, rate) * basePrice) - 1;
 *   sellPrices[work++] = intceil(rate * basePrice);
 *   sellPrices[work++] = intceil(randfloat(1.4, rate) * basePrice) - 1;
 *   // 尖峰之後（若還有剩餘天數）繼續遞減
 *
 * 詳見 docs/演算法原始數據規格表.md 第 2 節「Pattern 3：小漲型」。
 */
export function* generatePattern3WithPeak(
  ctx: GenerationContext,
  givenPrices: WeekPriceArray,
  peakStart: number,
): Generator<RawPossibility> {
  const buyPrice = givenPrices[0]!;
  const predictedPrices: PriceRange[] = [
    { min: buyPrice, max: buyPrice },
    { min: buyPrice, max: buyPrice },
  ];
  let probability = 1;

  probability *= generateDecreasingRandomPrice(
    ctx,
    givenPrices,
    predictedPrices,
    2,
    peakStart - 2,
    0.4,
    0.9,
    0.03,
    0.05,
  );
  if (probability === 0) return;

  // 尖峰前的兩格緩漲。
  probability *= generateIndividualRandomPrice(ctx, givenPrices, predictedPrices, peakStart, 2, 0.9, 1.4);
  if (probability === 0) return;

  // 帽子形尖峰三格。
  probability *= generatePeakPrice(ctx, givenPrices, predictedPrices, peakStart + 2, 1.4, 2.0);
  if (probability === 0) return;

  if (peakStart + 5 < 14) {
    probability *= generateDecreasingRandomPrice(
      ctx,
      givenPrices,
      predictedPrices,
      peakStart + 5,
      14 - (peakStart + 5),
      0.4,
      0.9,
      0.03,
      0.05,
    );
    if (probability === 0) return;
  }

  yield { patternNumber: TurnipPattern.SmallSpike, prices: predictedPrices, probability };
}

/** peakStart：2～9 之間等機率整數（8 選 1）。 */
export function* generatePattern3(
  ctx: GenerationContext,
  givenPrices: WeekPriceArray,
): Generator<RawPossibility> {
  for (let peakStart = 2; peakStart < 10; peakStart++) {
    yield* multiplyGeneratorProbability(generatePattern3WithPeak(ctx, givenPrices, peakStart), 1 / (10 - 2));
  }
}
