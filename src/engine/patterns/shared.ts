import type { PriceRange, TurnipPattern } from "../data/types.js";

/** 單一 Pattern 生成器產出的原始候選路徑，尚未經過 analyzePossibilities 的彙整/排序處理。 */
export interface RawPossibility {
  patternNumber: TurnipPattern;
  prices: PriceRange[];
  probability: number;
}

/**
 * 把一個 generator 產出的每個結果的機率都乘上一個固定係數。
 * 移植自 vendor/ac-nh-turnip-prices/predictions.js 的 multiply_generator_probability()，
 * 用來套用「分段長度枚舉」或「Pattern 轉移機率」的權重。
 */
export function* multiplyGeneratorProbability<T extends { probability: number }>(
  generator: Generator<T>,
  probability: number,
): Generator<T> {
  for (const it of generator) {
    yield { ...it, probability: it.probability * probability };
  }
}
