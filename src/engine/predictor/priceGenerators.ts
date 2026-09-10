import { PDF } from "../probability/pdf.js";
import {
  clamp,
  rangeIntersect,
  rangeIntersectLength,
  rangeLength,
  type NumRange,
} from "../probability/rangeMath.js";
import { RATE_MULTIPLIER, type PriceRange, type WeekPriceArray } from "../data/types.js";

/**
 * 反推時使用的容錯範圍：因為反編譯結果不是 100% 精確重現遊戲的 32-bit ARM 浮點運算，
 * 找不到任何符合路徑時，會把每個時段的合法區間上下限各放寬 fudgeFactor（0～5 逐次嘗試）。
 * 見 docs/演算法原始數據規格表.md 第 1 節「反向容錯」。
 */
export interface GenerationContext {
  fudgeFactor: number;
}

/** intceil(val) = Math.trunc(val + 0.99999)，模擬遊戲的「無條件進位」取整方式。 */
export function intceil(val: number): number {
  return Math.trunc(val + 0.99999);
}

export function getPrice(rate: number, basePrice: number): number {
  return intceil((rate * basePrice) / RATE_MULTIPLIER);
}

export function minimumRateFromGivenAndBase(givenPrice: number, buyPrice: number): number {
  return (RATE_MULTIPLIER * (givenPrice - 0.99999)) / buyPrice;
}

export function maximumRateFromGivenAndBase(givenPrice: number, buyPrice: number): number {
  return (RATE_MULTIPLIER * (givenPrice + 0.00001)) / buyPrice;
}

export function rateRangeFromGivenAndBase(givenPrice: number, buyPrice: number): [number, number] {
  return [
    minimumRateFromGivenAndBase(givenPrice, buyPrice),
    maximumRateFromGivenAndBase(givenPrice, buyPrice),
  ];
}

/**
 * 對應遊戲邏輯：
 *   for (int i = start; i < start + length; i++)
 *     sellPrices[work++] = intceil(randfloat(rate_min, rate_max) * basePrice);
 *
 * 回傳「給定的 given_prices 是否吻合」的條件機率，並把預測區間 push 進 predictedPrices。
 * 若 given_prices 不吻合，回傳 0。
 */
export function generateIndividualRandomPrice(
  ctx: GenerationContext,
  givenPrices: WeekPriceArray,
  predictedPrices: PriceRange[],
  start: number,
  length: number,
  rateMinRaw: number,
  rateMaxRaw: number,
): number {
  const rateMin = rateMinRaw * RATE_MULTIPLIER;
  const rateMax = rateMaxRaw * RATE_MULTIPLIER;

  const buyPrice = givenPrices[0]!;
  const rateRange: NumRange = [rateMin, rateMax];
  let prob = 1;

  for (let i = start; i < start + length; i++) {
    let minPred = getPrice(rateMin, buyPrice);
    let maxPred = getPrice(rateMax, buyPrice);
    const given = givenPrices[i]!;
    if (!Number.isNaN(given)) {
      if (given < minPred - ctx.fudgeFactor || given > maxPred + ctx.fudgeFactor) {
        // 給定價格超出這個路徑允許的範圍，代表這條路徑錯誤。
        return 0;
      }
      // 先把數值限制在範圍內，避免機率完全被容錯值帶偏。
      const realRateRange = rateRangeFromGivenAndBase(clamp(given, minPred, maxPred), buyPrice);
      prob *= rangeIntersectLength(rateRange, realRateRange) / rangeLength(rateRange);
      minPred = given;
      maxPred = given;
    }

    predictedPrices.push({ min: minPred, max: maxPred });
  }
  return prob;
}

/**
 * 對應遊戲邏輯：
 *   rate = randfloat(start_rate_min, start_rate_max);
 *   for (int i = start; i < start + length; i++) {
 *     sellPrices[work++] = intceil(rate * basePrice);
 *     rate -= randfloat(rate_decay_min, rate_decay_max);
 *   }
 */
export function generateDecreasingRandomPrice(
  ctx: GenerationContext,
  givenPrices: WeekPriceArray,
  predictedPrices: PriceRange[],
  start: number,
  length: number,
  startRateMinRaw: number,
  startRateMaxRaw: number,
  rateDecayMinRaw: number,
  rateDecayMaxRaw: number,
): number {
  const startRateMin = startRateMinRaw * RATE_MULTIPLIER;
  const startRateMax = startRateMaxRaw * RATE_MULTIPLIER;
  const rateDecayMin = rateDecayMinRaw * RATE_MULTIPLIER;
  const rateDecayMax = rateDecayMaxRaw * RATE_MULTIPLIER;

  const buyPrice = givenPrices[0]!;
  const ratePdf = new PDF(startRateMin, startRateMax);
  let prob = 1;

  for (let i = start; i < start + length; i++) {
    let minPred = getPrice(ratePdf.minValue(), buyPrice);
    let maxPred = getPrice(ratePdf.maxValue(), buyPrice);
    const given = givenPrices[i]!;
    if (!Number.isNaN(given)) {
      if (given < minPred - ctx.fudgeFactor || given > maxPred + ctx.fudgeFactor) {
        return 0;
      }
      const realRateRange = rateRangeFromGivenAndBase(clamp(given, minPred, maxPred), buyPrice);
      prob *= ratePdf.rangeLimit(realRateRange);
      if (prob === 0) {
        return 0;
      }
      minPred = given;
      maxPred = given;
    }

    predictedPrices.push({ min: minPred, max: maxPred });

    ratePdf.decay(rateDecayMin, rateDecayMax);
  }
  return prob;
}

/**
 * 對應遊戲邏輯（小漲型的「帽子形」尖峰三格）：
 *   rate = randfloat(rate_min, rate_max);
 *   sellPrices[work++] = intceil(randfloat(rate_min, rate) * basePrice) - 1;
 *   sellPrices[work++] = intceil(rate * basePrice);
 *   sellPrices[work++] = intceil(randfloat(rate_min, rate) * basePrice) - 1;
 */
export function generatePeakPrice(
  ctx: GenerationContext,
  givenPrices: WeekPriceArray,
  predictedPrices: PriceRange[],
  start: number,
  rateMinRaw: number,
  rateMaxRaw: number,
): number {
  const rateMin = rateMinRaw * RATE_MULTIPLIER;
  const rateMax = rateMaxRaw * RATE_MULTIPLIER;

  const buyPrice = givenPrices[0]!;
  let prob = 1;
  let rateRange: [number, number] = [rateMin, rateMax];

  // 先算中間格（最高點）的機率。
  const middlePrice = givenPrices[start + 1]!;
  if (!Number.isNaN(middlePrice)) {
    const minPred = getPrice(rateMin, buyPrice);
    const maxPred = getPrice(rateMax, buyPrice);
    if (middlePrice < minPred - ctx.fudgeFactor || middlePrice > maxPred + ctx.fudgeFactor) {
      return 0;
    }
    const realRateRange = rateRangeFromGivenAndBase(clamp(middlePrice, minPred, maxPred), buyPrice);
    prob *= rangeIntersectLength(rateRange, realRateRange) / rangeLength(rateRange);
    if (prob === 0) {
      return 0;
    }

    const intersected = rangeIntersect(rateRange, realRateRange);
    if (!intersected) {
      return 0;
    }
    rateRange = intersected;
  }

  const leftPrice = givenPrices[start]!;
  const rightPrice = givenPrices[start + 2]!;
  // Prob(left_price | middle_price)、Prob(right_price | middle_price)。
  //
  // A = rateRange[0], B = rateRange[1], C = rateMin, X = rate, Y = randfloat(C, X)
  // rate = randfloat(A, B); sellPrices[work++] = intceil(randfloat(C, rate) * basePrice) - 1;
  //
  // 詳細推導見 vendor/ac-nh-turnip-prices/predictions.js 的 generate_peak_price() 註解，
  // 這段條件機率積分不可簡化，必須逐行照抄。
  for (const price of [leftPrice, rightPrice]) {
    if (Number.isNaN(price)) {
      continue;
    }
    const minPred = getPrice(rateMin, buyPrice) - 1;
    const maxPred = getPrice(rateRange[1], buyPrice) - 1;
    if (price < minPred - ctx.fudgeFactor || price > maxPred + ctx.fudgeFactor) {
      return 0;
    }
    const rate2Range = rateRangeFromGivenAndBase(clamp(price, minPred, maxPred) + 1, buyPrice);

    const F = (t: number, ZZ: number): number => {
      if (t <= 0) {
        return 0;
      }
      return ZZ < t ? ZZ : t - t * (Math.log(t) - Math.log(ZZ));
    };
    const [A, B] = rateRange;
    const C = rateMin;
    const Z1 = A - C;
    const Z2 = B - C;
    const PY = (t: number): number => (F(t - C, Z2) - F(t - C, Z1)) / (Z2 - Z1);
    prob *= PY(rate2Range[1]) - PY(rate2Range[0]);
    if (prob === 0) {
      return 0;
    }
  }

  // 接著依「往前預測」較實用的順序，實際產生預測區間。
  //
  // 主尖峰第 1 格
  let minPred = getPrice(rateMin, buyPrice) - 1;
  let maxPred = getPrice(rateMax, buyPrice) - 1;
  if (!Number.isNaN(givenPrices[start]!)) {
    minPred = givenPrices[start]!;
    maxPred = givenPrices[start]!;
  }
  predictedPrices.push({ min: minPred, max: maxPred });

  // 主尖峰第 2 格（最高點）
  minPred = predictedPrices[start]!.min;
  maxPred = getPrice(rateMax, buyPrice);
  if (!Number.isNaN(givenPrices[start + 1]!)) {
    minPred = givenPrices[start + 1]!;
    maxPred = givenPrices[start + 1]!;
  }
  predictedPrices.push({ min: minPred, max: maxPred });

  // 主尖峰第 3 格
  minPred = getPrice(rateMin, buyPrice) - 1;
  maxPred = predictedPrices[start + 1]!.max - 1;
  if (!Number.isNaN(givenPrices[start + 2]!)) {
    minPred = givenPrices[start + 2]!;
    maxPred = givenPrices[start + 2]!;
  }
  predictedPrices.push({ min: minPred, max: maxPred });

  return prob;
}
