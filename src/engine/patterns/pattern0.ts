import type { PriceRange, WeekPriceArray } from "../data/types.js";
import { TurnipPattern } from "../data/types.js";
import type { GenerationContext } from "../predictor/priceGenerators.js";
import { generateDecreasingRandomPrice, generateIndividualRandomPrice } from "../predictor/priceGenerators.js";
import { multiplyGeneratorProbability, type RawPossibility } from "./shared.js";

/**
 * 波動型（Fluctuating）。結構：高價期1 → 遞減期1 → 高價期2 → 遞減期2 → 高價期3。
 * 對應遊戲邏輯（見 vendor/ac-nh-turnip-prices/predictions.js 的 generate_pattern_0_with_lengths 註解）：
 *
 *   work = 2;
 *   高價期：intceil(randfloat(0.9, 1.4) * basePrice)（每格獨立）
 *   遞減期：rate = randfloat(0.8, 0.6); 每格 rate -= 0.04; rate -= randfloat(0, 0.06);
 *
 * 詳細規則見 docs/演算法原始數據規格表.md 第 2 節「Pattern 0：波動型」。
 */
export function* generatePattern0WithLengths(
  ctx: GenerationContext,
  givenPrices: WeekPriceArray,
  highPhase1Len: number,
  decPhase1Len: number,
  highPhase2Len: number,
  decPhase2Len: number,
  highPhase3Len: number,
): Generator<RawPossibility> {
  const buyPrice = givenPrices[0]!;
  const predictedPrices: PriceRange[] = [
    { min: buyPrice, max: buyPrice },
    { min: buyPrice, max: buyPrice },
  ];
  let probability = 1;

  // 高價期 1
  probability *= generateIndividualRandomPrice(ctx, givenPrices, predictedPrices, 2, highPhase1Len, 0.9, 1.4);
  if (probability === 0) return;

  // 遞減期 1
  probability *= generateDecreasingRandomPrice(
    ctx,
    givenPrices,
    predictedPrices,
    2 + highPhase1Len,
    decPhase1Len,
    0.6,
    0.8,
    0.04,
    0.1,
  );
  if (probability === 0) return;

  // 高價期 2
  probability *= generateIndividualRandomPrice(
    ctx,
    givenPrices,
    predictedPrices,
    2 + highPhase1Len + decPhase1Len,
    highPhase2Len,
    0.9,
    1.4,
  );
  if (probability === 0) return;

  // 遞減期 2
  probability *= generateDecreasingRandomPrice(
    ctx,
    givenPrices,
    predictedPrices,
    2 + highPhase1Len + decPhase1Len + highPhase2Len,
    decPhase2Len,
    0.6,
    0.8,
    0.04,
    0.1,
  );
  if (probability === 0) return;

  // 高價期 3
  const total = 2 + highPhase1Len + decPhase1Len + highPhase2Len + decPhase2Len + highPhase3Len;
  if (total !== 14) {
    throw new Error("Phase lengths don't add up");
  }

  const prevLength = 2 + highPhase1Len + decPhase1Len + highPhase2Len + decPhase2Len;
  probability *= generateIndividualRandomPrice(
    ctx,
    givenPrices,
    predictedPrices,
    prevLength,
    14 - prevLength,
    0.9,
    1.4,
  );
  if (probability === 0) return;

  yield { patternNumber: TurnipPattern.Fluctuating, prices: predictedPrices, probability };
}

/**
 * 對應遊戲邏輯：
 *   decPhaseLen1 = randbool() ? 3 : 2;
 *   decPhaseLen2 = 5 - decPhaseLen1;
 *   hiPhaseLen1 = randint(0, 6);
 *   hiPhaseLen2and3 = 7 - hiPhaseLen1;
 *   hiPhaseLen3 = randint(0, hiPhaseLen2and3 - 1);
 */
export function* generatePattern0(
  ctx: GenerationContext,
  givenPrices: WeekPriceArray,
): Generator<RawPossibility> {
  for (let decPhase1Len = 2; decPhase1Len < 4; decPhase1Len++) {
    for (let highPhase1Len = 0; highPhase1Len < 7; highPhase1Len++) {
      for (let highPhase3Len = 0; highPhase3Len < 7 - highPhase1Len - 1 + 1; highPhase3Len++) {
        yield* multiplyGeneratorProbability(
          generatePattern0WithLengths(
            ctx,
            givenPrices,
            highPhase1Len,
            decPhase1Len,
            7 - highPhase1Len - highPhase3Len,
            5 - decPhase1Len,
            highPhase3Len,
          ),
          1 / (4 - 2) / 7 / (7 - highPhase1Len),
        );
      }
    }
  }
}
