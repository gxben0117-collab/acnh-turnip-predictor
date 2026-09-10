import type { PriceRange, WeekPriceArray } from "../data/types.js";
import { TurnipPattern } from "../data/types.js";
import type { GenerationContext } from "../predictor/priceGenerators.js";
import { generateDecreasingRandomPrice, generateIndividualRandomPrice } from "../predictor/priceGenerators.js";
import { multiplyGeneratorProbability, type RawPossibility } from "./shared.js";

/** 大漲型主高峰五格的倍率下限／上限，index 對應 peakStart+0 ~ peakStart+4。 */
const PEAK_MIN_RATES = [0.9, 1.4, 2.0, 1.4, 0.9];
const PEAK_MAX_RATES = [1.4, 2.0, 6.0, 2.0, 1.4];
/** 高峰之後剩餘格數的倍率範圍（若還有剩餘天數）。 */
const AFTER_PEAK_MIN_RATE = 0.4;
const AFTER_PEAK_MAX_RATE = 0.9;

/**
 * 大漲型（Large Spike）。結構：盤整遞減期 → 五格主高峰 → （若還有剩餘）隨機低價期。
 * 對應遊戲邏輯：
 *
 *   peakStart = randint(3, 9);
 *   rate = randfloat(0.9, 0.85); // 高峰前遞減
 *   for (work = 2; work < peakStart; work++) { rate -= 0.03; rate -= randfloat(0, 0.02); }
 *   五格主高峰：90~140% → 140~200% → 200~600% → 140~200% → 90~140%
 *   for (; work < 14; work++) sellPrices[work] = intceil(randfloat(0.4, 0.9) * basePrice);
 *
 * 詳見 docs/演算法原始數據規格表.md 第 2 節「Pattern 1：大漲型」。
 */
export function* generatePattern1WithPeak(
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
    0.85,
    0.9,
    0.03,
    0.05,
  );
  if (probability === 0) return;

  // 高峰之後每一天彼此獨立。
  for (let i = peakStart; i < 14; i++) {
    const offset = i - peakStart;
    const rateMin = offset < 5 ? PEAK_MIN_RATES[offset]! : AFTER_PEAK_MIN_RATE;
    const rateMax = offset < 5 ? PEAK_MAX_RATES[offset]! : AFTER_PEAK_MAX_RATE;
    probability *= generateIndividualRandomPrice(ctx, givenPrices, predictedPrices, i, 1, rateMin, rateMax);
    if (probability === 0) return;
  }

  yield { patternNumber: TurnipPattern.LargeSpike, prices: predictedPrices, probability };
}

/** peakStart：3～9 之間等機率整數（7 選 1）。 */
export function* generatePattern1(
  ctx: GenerationContext,
  givenPrices: WeekPriceArray,
): Generator<RawPossibility> {
  for (let peakStart = 3; peakStart < 10; peakStart++) {
    yield* multiplyGeneratorProbability(generatePattern1WithPeak(ctx, givenPrices, peakStart), 1 / (10 - 3));
  }
}
