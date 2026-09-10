var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// src/engine/data/types.ts
var WEEK_SLOT_COUNT = 14;
var DAY_SLOT_KEYS = [
  "monAM",
  "monPM",
  "tueAM",
  "tuePM",
  "wedAM",
  "wedPM",
  "thuAM",
  "thuPM",
  "friAM",
  "friPM",
  "satAM",
  "satPM"
];
var RATE_MULTIPLIER = 1e4;

// src/engine/probability/floatSum.ts
function floatSum(input) {
  let sum = 0;
  let c = 0;
  for (let i = 0; i < input.length; i++) {
    const cur = input[i];
    const t = sum + cur;
    if (Math.abs(sum) >= Math.abs(cur)) {
      c += sum - t + cur;
    } else {
      c += cur - t + sum;
    }
    sum = t;
  }
  return sum + c;
}
function prefixFloatSum(input) {
  const prefixSum = [[0, 0]];
  let sum = 0;
  let c = 0;
  for (let i = 0; i < input.length; i++) {
    const cur = input[i];
    const t = sum + cur;
    if (Math.abs(sum) >= Math.abs(cur)) {
      c += sum - t + cur;
    } else {
      c += cur - t + sum;
    }
    sum = t;
    prefixSum.push([sum, c]);
  }
  return prefixSum;
}

// src/engine/probability/rangeMath.ts
function rangeLength(range) {
  return range[1] - range[0];
}
function clamp(x, min, max) {
  return Math.min(Math.max(x, min), max);
}
function rangeIntersect(range1, range2) {
  if (range1[0] > range2[1] || range1[1] < range2[0]) {
    return null;
  }
  return [Math.max(range1[0], range2[0]), Math.min(range1[1], range2[1])];
}
function rangeIntersectLength(range1, range2) {
  if (range1[0] > range2[1] || range1[1] < range2[0]) {
    return 0;
  }
  const intersection = rangeIntersect(range1, range2);
  return intersection ? rangeLength(intersection) : 0;
}

// src/engine/probability/pdf.ts
var PDF = class {
  /**
   * 建立一個定義域在 [a, b] 的 PDF，a、b 可以不是整數。
   * uniform 為 true 時初始化成均勻分布，否則初始化成全零（無效）分布。
   */
  constructor(a, b, uniform = true) {
    __publicField(this, "valueStart");
    __publicField(this, "valueEnd");
    __publicField(this, "prob");
    this.valueStart = Math.floor(a);
    this.valueEnd = Math.ceil(b);
    const range = [a, b];
    const totalLength = rangeLength(range);
    this.prob = new Array(this.valueEnd - this.valueStart).fill(0);
    if (uniform) {
      for (let i = 0; i < this.prob.length; i++) {
        this.prob[i] = rangeIntersectLength(this.rangeOf(i), range) / totalLength;
      }
    }
  }
  /** 計算 this.prob[idx] 代表的區間。 */
  rangeOf(idx) {
    return [this.valueStart + idx, this.valueStart + idx + 1];
  }
  minValue() {
    return this.valueStart;
  }
  maxValue() {
    return this.valueEnd;
  }
  /** @returns 正規化之前的機率總和。 */
  normalize() {
    const totalProbability = floatSum(this.prob);
    for (let i = 0; i < this.prob.length; i++) {
      this.prob[i] /= totalProbability;
    }
    return totalProbability;
  }
  /**
   * 把值限制在 range 範圍內，並回傳「值原本就落在這個範圍內」的機率。
   */
  rangeLimit(range) {
    let [start, end] = range;
    start = Math.max(start, this.minValue());
    end = Math.min(end, this.maxValue());
    if (start >= end) {
      this.valueStart = this.valueEnd = 0;
      this.prob = [];
      return 0;
    }
    start = Math.floor(start);
    end = Math.ceil(end);
    const startIdx = start - this.valueStart;
    const endIdx = end - this.valueStart;
    for (let i = startIdx; i < endIdx; i++) {
      this.prob[i] *= rangeIntersectLength(this.rangeOf(i), range);
    }
    this.prob = this.prob.slice(startIdx, endIdx);
    this.valueStart = start;
    this.valueEnd = end;
    return this.normalize();
  }
  /**
   * 用一個 [rateDecayMin, rateDecayMax] 範圍內的均勻分布去對這個 PDF 做「減法卷積」。
   *
   * 為了簡化計算，假設 rateDecayMin 與 rateDecayMax 都是整數。
   */
  decay(rateDecayMin, rateDecayMax) {
    rateDecayMin = Math.round(rateDecayMin);
    rateDecayMax = Math.round(rateDecayMax);
    const prefix = prefixFloatSum(this.prob);
    const maxX = this.prob.length;
    const maxY = rateDecayMax - rateDecayMin;
    const newProb = new Array(this.prob.length + maxY);
    for (let i = 0; i < newProb.length; i++) {
      const left = Math.max(0, i - maxY);
      const right = Math.min(maxX - 1, i);
      const numbersToSum = [
        prefix[right + 1][0],
        prefix[right + 1][1],
        -prefix[left][0],
        -prefix[left][1]
      ];
      if (left === i - maxY) {
        numbersToSum.push(-this.prob[left] / 2);
      }
      if (right === i) {
        numbersToSum.push(-this.prob[right] / 2);
      }
      newProb[i] = floatSum(numbersToSum) / maxY;
    }
    this.prob = newProb;
    this.valueStart -= rateDecayMax;
    this.valueEnd -= rateDecayMin;
  }
};

// src/engine/predictor/priceGenerators.ts
function intceil(val) {
  return Math.trunc(val + 0.99999);
}
function getPrice(rate, basePrice) {
  return intceil(rate * basePrice / RATE_MULTIPLIER);
}
function minimumRateFromGivenAndBase(givenPrice, buyPrice) {
  return RATE_MULTIPLIER * (givenPrice - 0.99999) / buyPrice;
}
function maximumRateFromGivenAndBase(givenPrice, buyPrice) {
  return RATE_MULTIPLIER * (givenPrice + 1e-5) / buyPrice;
}
function rateRangeFromGivenAndBase(givenPrice, buyPrice) {
  return [
    minimumRateFromGivenAndBase(givenPrice, buyPrice),
    maximumRateFromGivenAndBase(givenPrice, buyPrice)
  ];
}
function generateIndividualRandomPrice(ctx, givenPrices, predictedPrices, start, length, rateMinRaw, rateMaxRaw) {
  const rateMin = rateMinRaw * RATE_MULTIPLIER;
  const rateMax = rateMaxRaw * RATE_MULTIPLIER;
  const buyPrice = givenPrices[0];
  const rateRange = [rateMin, rateMax];
  let prob = 1;
  for (let i = start; i < start + length; i++) {
    let minPred = getPrice(rateMin, buyPrice);
    let maxPred = getPrice(rateMax, buyPrice);
    const given = givenPrices[i];
    if (!Number.isNaN(given)) {
      if (given < minPred - ctx.fudgeFactor || given > maxPred + ctx.fudgeFactor) {
        return 0;
      }
      const realRateRange = rateRangeFromGivenAndBase(clamp(given, minPred, maxPred), buyPrice);
      prob *= rangeIntersectLength(rateRange, realRateRange) / rangeLength(rateRange);
      minPred = given;
      maxPred = given;
    }
    predictedPrices.push({ min: minPred, max: maxPred });
  }
  return prob;
}
function generateDecreasingRandomPrice(ctx, givenPrices, predictedPrices, start, length, startRateMinRaw, startRateMaxRaw, rateDecayMinRaw, rateDecayMaxRaw) {
  const startRateMin = startRateMinRaw * RATE_MULTIPLIER;
  const startRateMax = startRateMaxRaw * RATE_MULTIPLIER;
  const rateDecayMin = rateDecayMinRaw * RATE_MULTIPLIER;
  const rateDecayMax = rateDecayMaxRaw * RATE_MULTIPLIER;
  const buyPrice = givenPrices[0];
  const ratePdf = new PDF(startRateMin, startRateMax);
  let prob = 1;
  for (let i = start; i < start + length; i++) {
    let minPred = getPrice(ratePdf.minValue(), buyPrice);
    let maxPred = getPrice(ratePdf.maxValue(), buyPrice);
    const given = givenPrices[i];
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
function generatePeakPrice(ctx, givenPrices, predictedPrices, start, rateMinRaw, rateMaxRaw) {
  const rateMin = rateMinRaw * RATE_MULTIPLIER;
  const rateMax = rateMaxRaw * RATE_MULTIPLIER;
  const buyPrice = givenPrices[0];
  let prob = 1;
  let rateRange = [rateMin, rateMax];
  const middlePrice = givenPrices[start + 1];
  if (!Number.isNaN(middlePrice)) {
    const minPred2 = getPrice(rateMin, buyPrice);
    const maxPred2 = getPrice(rateMax, buyPrice);
    if (middlePrice < minPred2 - ctx.fudgeFactor || middlePrice > maxPred2 + ctx.fudgeFactor) {
      return 0;
    }
    const realRateRange = rateRangeFromGivenAndBase(clamp(middlePrice, minPred2, maxPred2), buyPrice);
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
  const leftPrice = givenPrices[start];
  const rightPrice = givenPrices[start + 2];
  for (const price of [leftPrice, rightPrice]) {
    if (Number.isNaN(price)) {
      continue;
    }
    const minPred2 = getPrice(rateMin, buyPrice) - 1;
    const maxPred2 = getPrice(rateRange[1], buyPrice) - 1;
    if (price < minPred2 - ctx.fudgeFactor || price > maxPred2 + ctx.fudgeFactor) {
      return 0;
    }
    const rate2Range = rateRangeFromGivenAndBase(clamp(price, minPred2, maxPred2) + 1, buyPrice);
    const F = (t, ZZ) => {
      if (t <= 0) {
        return 0;
      }
      return ZZ < t ? ZZ : t - t * (Math.log(t) - Math.log(ZZ));
    };
    const [A, B] = rateRange;
    const C = rateMin;
    const Z1 = A - C;
    const Z2 = B - C;
    const PY = (t) => (F(t - C, Z2) - F(t - C, Z1)) / (Z2 - Z1);
    prob *= PY(rate2Range[1]) - PY(rate2Range[0]);
    if (prob === 0) {
      return 0;
    }
  }
  let minPred = getPrice(rateMin, buyPrice) - 1;
  let maxPred = getPrice(rateMax, buyPrice) - 1;
  if (!Number.isNaN(givenPrices[start])) {
    minPred = givenPrices[start];
    maxPred = givenPrices[start];
  }
  predictedPrices.push({ min: minPred, max: maxPred });
  minPred = predictedPrices[start].min;
  maxPred = getPrice(rateMax, buyPrice);
  if (!Number.isNaN(givenPrices[start + 1])) {
    minPred = givenPrices[start + 1];
    maxPred = givenPrices[start + 1];
  }
  predictedPrices.push({ min: minPred, max: maxPred });
  minPred = getPrice(rateMin, buyPrice) - 1;
  maxPred = predictedPrices[start + 1].max - 1;
  if (!Number.isNaN(givenPrices[start + 2])) {
    minPred = givenPrices[start + 2];
    maxPred = givenPrices[start + 2];
  }
  predictedPrices.push({ min: minPred, max: maxPred });
  return prob;
}

// src/engine/patterns/shared.ts
function* multiplyGeneratorProbability(generator, probability) {
  for (const it of generator) {
    yield { ...it, probability: it.probability * probability };
  }
}

// src/engine/patterns/pattern0.ts
function* generatePattern0WithLengths(ctx, givenPrices, highPhase1Len, decPhase1Len, highPhase2Len, decPhase2Len, highPhase3Len) {
  const buyPrice = givenPrices[0];
  const predictedPrices = [
    { min: buyPrice, max: buyPrice },
    { min: buyPrice, max: buyPrice }
  ];
  let probability = 1;
  probability *= generateIndividualRandomPrice(ctx, givenPrices, predictedPrices, 2, highPhase1Len, 0.9, 1.4);
  if (probability === 0) return;
  probability *= generateDecreasingRandomPrice(
    ctx,
    givenPrices,
    predictedPrices,
    2 + highPhase1Len,
    decPhase1Len,
    0.6,
    0.8,
    0.04,
    0.1
  );
  if (probability === 0) return;
  probability *= generateIndividualRandomPrice(
    ctx,
    givenPrices,
    predictedPrices,
    2 + highPhase1Len + decPhase1Len,
    highPhase2Len,
    0.9,
    1.4
  );
  if (probability === 0) return;
  probability *= generateDecreasingRandomPrice(
    ctx,
    givenPrices,
    predictedPrices,
    2 + highPhase1Len + decPhase1Len + highPhase2Len,
    decPhase2Len,
    0.6,
    0.8,
    0.04,
    0.1
  );
  if (probability === 0) return;
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
    1.4
  );
  if (probability === 0) return;
  yield { patternNumber: 0 /* Fluctuating */, prices: predictedPrices, probability };
}
function* generatePattern0(ctx, givenPrices) {
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
            highPhase3Len
          ),
          1 / (4 - 2) / 7 / (7 - highPhase1Len)
        );
      }
    }
  }
}

// src/engine/patterns/pattern1.ts
var PEAK_MIN_RATES = [0.9, 1.4, 2, 1.4, 0.9];
var PEAK_MAX_RATES = [1.4, 2, 6, 2, 1.4];
var AFTER_PEAK_MIN_RATE = 0.4;
var AFTER_PEAK_MAX_RATE = 0.9;
function* generatePattern1WithPeak(ctx, givenPrices, peakStart) {
  const buyPrice = givenPrices[0];
  const predictedPrices = [
    { min: buyPrice, max: buyPrice },
    { min: buyPrice, max: buyPrice }
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
    0.05
  );
  if (probability === 0) return;
  for (let i = peakStart; i < 14; i++) {
    const offset = i - peakStart;
    const rateMin = offset < 5 ? PEAK_MIN_RATES[offset] : AFTER_PEAK_MIN_RATE;
    const rateMax = offset < 5 ? PEAK_MAX_RATES[offset] : AFTER_PEAK_MAX_RATE;
    probability *= generateIndividualRandomPrice(ctx, givenPrices, predictedPrices, i, 1, rateMin, rateMax);
    if (probability === 0) return;
  }
  yield { patternNumber: 1 /* LargeSpike */, prices: predictedPrices, probability };
}
function* generatePattern1(ctx, givenPrices) {
  for (let peakStart = 3; peakStart < 10; peakStart++) {
    yield* multiplyGeneratorProbability(generatePattern1WithPeak(ctx, givenPrices, peakStart), 1 / (10 - 3));
  }
}

// src/engine/patterns/pattern2.ts
function* generatePattern2(ctx, givenPrices) {
  const buyPrice = givenPrices[0];
  const predictedPrices = [
    { min: buyPrice, max: buyPrice },
    { min: buyPrice, max: buyPrice }
  ];
  let probability = 1;
  probability *= generateDecreasingRandomPrice(ctx, givenPrices, predictedPrices, 2, 14 - 2, 0.85, 0.9, 0.03, 0.05);
  if (probability === 0) return;
  yield { patternNumber: 2 /* Decreasing */, prices: predictedPrices, probability };
}

// src/engine/patterns/pattern3.ts
function* generatePattern3WithPeak(ctx, givenPrices, peakStart) {
  const buyPrice = givenPrices[0];
  const predictedPrices = [
    { min: buyPrice, max: buyPrice },
    { min: buyPrice, max: buyPrice }
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
    0.05
  );
  if (probability === 0) return;
  probability *= generateIndividualRandomPrice(ctx, givenPrices, predictedPrices, peakStart, 2, 0.9, 1.4);
  if (probability === 0) return;
  probability *= generatePeakPrice(ctx, givenPrices, predictedPrices, peakStart + 2, 1.4, 2);
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
      0.05
    );
    if (probability === 0) return;
  }
  yield { patternNumber: 3 /* SmallSpike */, prices: predictedPrices, probability };
}
function* generatePattern3(ctx, givenPrices) {
  for (let peakStart = 2; peakStart < 10; peakStart++) {
    yield* multiplyGeneratorProbability(generatePattern3WithPeak(ctx, givenPrices, peakStart), 1 / (10 - 2));
  }
}

// src/engine/predictor/constants.ts
var PROBABILITY_MATRIX = {
  [0 /* Fluctuating */]: {
    [0 /* Fluctuating */]: 0.2,
    [1 /* LargeSpike */]: 0.3,
    [2 /* Decreasing */]: 0.15,
    [3 /* SmallSpike */]: 0.35
  },
  [1 /* LargeSpike */]: {
    [0 /* Fluctuating */]: 0.5,
    [1 /* LargeSpike */]: 0.05,
    [2 /* Decreasing */]: 0.2,
    [3 /* SmallSpike */]: 0.25
  },
  [2 /* Decreasing */]: {
    [0 /* Fluctuating */]: 0.25,
    [1 /* LargeSpike */]: 0.45,
    [2 /* Decreasing */]: 0.05,
    [3 /* SmallSpike */]: 0.25
  },
  [3 /* SmallSpike */]: {
    [0 /* Fluctuating */]: 0.45,
    [1 /* LargeSpike */]: 0.25,
    [2 /* Decreasing */]: 0.15,
    [3 /* SmallSpike */]: 0.15
  }
};
var UNKNOWN_PREVIOUS_PATTERN_PROBABILITY = [
  4530 / 13082,
  3236 / 13082,
  1931 / 13082,
  3385 / 13082
];
function getTransitionProbability(previousPattern) {
  if (previousPattern === void 0 || Number.isNaN(previousPattern) || previousPattern < 0 || previousPattern > 3) {
    return UNKNOWN_PREVIOUS_PATTERN_PROBABILITY;
  }
  const row = PROBABILITY_MATRIX[previousPattern];
  return [
    row[0 /* Fluctuating */],
    row[1 /* LargeSpike */],
    row[2 /* Decreasing */],
    row[3 /* SmallSpike */]
  ];
}

// src/engine/predictor/generatePossibilities.ts
var PATTERN_GENERATORS = [generatePattern0, generatePattern1, generatePattern2, generatePattern3];
function* generateAllPatterns(ctx, sellPrices, previousPattern) {
  const transitionProbability = getTransitionProbability(previousPattern);
  for (let i = 0; i < 4; i++) {
    yield* multiplyGeneratorProbability(PATTERN_GENERATORS[i](ctx, sellPrices), transitionProbability[i]);
  }
}
function* generatePossibilities(ctx, sellPrices, firstBuy, previousPattern) {
  if (firstBuy || Number.isNaN(sellPrices[0])) {
    for (let buyPrice = 90; buyPrice <= 110; buyPrice++) {
      const tempSellPrices = sellPrices.slice();
      tempSellPrices[0] = buyPrice;
      tempSellPrices[1] = buyPrice;
      if (firstBuy) {
        yield* generatePattern3(ctx, tempSellPrices);
      } else {
        yield* generateAllPatterns(ctx, tempSellPrices, previousPattern);
      }
    }
  } else {
    yield* generateAllPatterns(ctx, sellPrices, previousPattern);
  }
}

// src/engine/predictor/analyze.ts
var MAX_FUDGE_FACTOR = 5;
function analyzePossibilities(prices, firstBuy, previousPattern) {
  let generatedPossibilities = [];
  for (let fudgeFactor = 0; fudgeFactor <= MAX_FUDGE_FACTOR; fudgeFactor++) {
    const ctx = { fudgeFactor };
    generatedPossibilities = Array.from(
      generatePossibilities(ctx, prices, firstBuy, previousPattern)
    );
    if (generatedPossibilities.length > 0) {
      break;
    }
  }
  const totalProbability = generatedPossibilities.reduce((acc, it) => acc + it.probability, 0);
  for (const it of generatedPossibilities) {
    it.probability /= totalProbability;
  }
  for (const poss of generatedPossibilities) {
    let weekMins = [];
    let weekMaxes = [];
    for (const day of poss.prices.slice(2)) {
      if (day.min !== day.max) {
        weekMins.push(day.min);
        weekMaxes.push(day.max);
      } else {
        weekMins = [];
        weekMaxes = [];
      }
    }
    if (!weekMins.length && !weekMaxes.length) {
      const lastDay = poss.prices[poss.prices.length - 1];
      weekMins.push(lastDay.min);
      weekMaxes.push(lastDay.max);
    }
    poss.weekGuaranteedMinimum = Math.max(...weekMins);
    poss.weekMax = Math.max(...weekMaxes);
  }
  const categoryTotals = {};
  for (const pattern of [0, 1, 2, 3]) {
    categoryTotals[pattern] = generatedPossibilities.filter((value) => value.patternNumber === pattern).map((value) => value.probability).reduce((previous, current) => previous + current, 0);
  }
  for (const pos of generatedPossibilities) {
    pos.categoryTotalProbability = categoryTotals[pos.patternNumber];
  }
  generatedPossibilities.sort((a, b) => {
    return b.categoryTotalProbability - a.categoryTotalProbability || b.probability - a.probability;
  });
  const globalMinMax = [];
  for (let day = 0; day < 14; day++) {
    const dayPrices = { min: 999, max: 0 };
    for (const poss of generatedPossibilities) {
      const dayRange = poss.prices[day];
      if (dayRange.min < dayPrices.min) dayPrices.min = dayRange.min;
      if (dayRange.max > dayPrices.max) dayPrices.max = dayRange.max;
    }
    globalMinMax.push(dayPrices);
  }
  generatedPossibilities.unshift({
    patternNumber: 4,
    prices: globalMinMax,
    probability: Number.NaN,
    weekGuaranteedMinimum: Math.min(...generatedPossibilities.map((poss) => poss.weekGuaranteedMinimum)),
    weekMax: Math.max(...generatedPossibilities.map((poss) => poss.weekMax))
  });
  return generatedPossibilities;
}

// src/engine/predictor/publicApi.ts
function buildWeekPriceArray(buyPrice, dayPrices) {
  const week = new Array(WEEK_SLOT_COUNT).fill(Number.NaN);
  const resolvedBuyPrice = buyPrice ?? Number.NaN;
  week[0] = resolvedBuyPrice;
  week[1] = resolvedBuyPrice;
  DAY_SLOT_KEYS.forEach((key, i) => {
    const value = dayPrices[key];
    week[i + 2] = value === void 0 ? Number.NaN : value;
  });
  return week;
}
function predictTurnipPrices(input) {
  const week = buildWeekPriceArray(input.buyPrice, input.prices);
  return analyzePossibilities(week, input.firstBuy ?? false, input.previousPattern);
}
function summarizePatternProbabilities(possibilities) {
  const summary = {
    [0 /* Fluctuating */]: 0,
    [1 /* LargeSpike */]: 0,
    [2 /* Decreasing */]: 0,
    [3 /* SmallSpike */]: 0
  };
  for (const poss of possibilities) {
    if (poss.patternNumber === 4) continue;
    summary[poss.patternNumber] = poss.categoryTotalProbability ?? 0;
  }
  return summary;
}

// src/engine/probability/priceRangeStats.ts
function computeDayRangeStats(candidates, day, coverage = 0.8) {
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
      max: Number.isFinite(theoreticalMax) ? theoreticalMax : 0
    },
    highProbability: {
      min: Number.isFinite(hpMin) ? hpMin : 0,
      max: Number.isFinite(hpMax) ? hpMax : 0
    }
  };
}

// src/engine/sellStrategy/currentPrice.ts
function getCurrentPriceInfo(prices) {
  for (let i = 13 /* SatPM */; i >= 2 /* MonAM */; i--) {
    const value = prices[i];
    if (value !== void 0 && !Number.isNaN(value)) {
      return { price: value, dayIndex: i, isBuyPrice: false };
    }
  }
  const buyPrice = prices[0];
  if (buyPrice !== void 0 && !Number.isNaN(buyPrice)) {
    return { price: buyPrice, dayIndex: 0, isBuyPrice: true };
  }
  return void 0;
}

// src/engine/sellStrategy/advice.ts
var RISK_THRESHOLDS = {
  // score ≈ 機率加權的期望漲幅（例如 0.05 代表期望還能再漲約 5%）。
  // 保守策略門檻較高，代表「期望漲幅沒有明顯超過門檻」就傾向早點賣。
  conservative: { stronglySell: 0.02, shouldSell: 0.06, canSell: 0.15 },
  balanced: { stronglySell: 0.01, shouldSell: 0.04, canSell: 0.1 },
  aggressive: { stronglySell: 5e-3, shouldSell: 0.02, canSell: 0.06 }
};
function realPossibilities(possibilities) {
  return possibilities.filter((p) => p.patternNumber !== 4);
}
function computeSellAdvice(possibilities, prices, riskProfile) {
  const currentPriceInfo = getCurrentPriceInfo(prices);
  if (!currentPriceInfo) {
    return void 0;
  }
  const { price: currentPrice, dayIndex: currentDayIndex } = currentPriceInfo;
  const futureStart = Math.max(currentDayIndex + 1, 2 /* MonAM */);
  const isLastChance = futureStart > 13 /* SatPM */;
  const candidates = realPossibilities(possibilities);
  if (isLastChance || candidates.length === 0) {
    return {
      level: "stronglySell",
      currentPrice,
      currentDayIndex,
      expectedFutureMax: currentPrice,
      theoreticalFutureMax: currentPrice,
      upsideProbability: 0,
      isLastChance: true
    };
  }
  let expectedFutureMax = 0;
  let theoreticalFutureMax = 0;
  for (let day = futureStart; day <= 13 /* SatPM */; day++) {
    let expectedValue = 0;
    for (const poss of candidates) {
      const range = poss.prices[day];
      if (!range) continue;
      const midpoint = (range.min + range.max) / 2;
      expectedValue += poss.probability * midpoint;
      theoreticalFutureMax = Math.max(theoreticalFutureMax, range.max);
    }
    expectedFutureMax = Math.max(expectedFutureMax, expectedValue);
  }
  const upMargin = 1.05;
  let upsideProbability = 0;
  for (const poss of candidates) {
    let pathFutureMax = 0;
    for (let day = futureStart; day <= 13 /* SatPM */; day++) {
      const range = poss.prices[day];
      if (range) pathFutureMax = Math.max(pathFutureMax, range.max);
    }
    if (pathFutureMax >= currentPrice * upMargin) {
      upsideProbability += poss.probability;
    }
  }
  const remainingUpsideRatio = Math.max(0, expectedFutureMax - currentPrice) / currentPrice;
  const score = remainingUpsideRatio * upsideProbability;
  const thresholds = RISK_THRESHOLDS[riskProfile];
  let level;
  if (score < thresholds.stronglySell) {
    level = "stronglySell";
  } else if (score < thresholds.shouldSell) {
    level = "shouldSell";
  } else if (score < thresholds.canSell) {
    level = "canSell";
  } else {
    level = "hold";
  }
  return {
    level,
    currentPrice,
    currentDayIndex,
    expectedFutureMax,
    theoreticalFutureMax,
    upsideProbability,
    isLastChance: false
  };
}

// src/engine/sellStrategy/ledger.ts
function summarizeLedger(entry, pricePerUnit) {
  const totalCost = entry.buyPrice * entry.quantity;
  const currentValue = pricePerUnit * entry.quantity;
  const profit = currentValue - totalCost;
  const profitPercent = totalCost === 0 ? 0 : profit / totalCost;
  return {
    buyPrice: entry.buyPrice,
    quantity: entry.quantity,
    totalCost,
    pricePerUnit,
    currentValue,
    profit,
    profitPercent
  };
}

// src/engine/sellStrategy/warnings.ts
var LARGE_SPIKE_RISING_THRESHOLD = 0.4;
var PEAK_IMMINENT_RATIO = 0.95;
var PEAK_ENDED_RATIO = 0.6;
function computeWarnings(params) {
  const { patternProbabilities, advice, nextDayRangeStats, weekTheoreticalMax } = params;
  const warnings = [];
  if (patternProbabilities[1 /* LargeSpike */] > LARGE_SPIKE_RISING_THRESHOLD) {
    warnings.push({
      kind: "largeSpikeRising",
      emoji: "\u{1F525}",
      message: "\u5075\u6E2C\u5230\u5927\u6F32\u578B\u53EF\u80FD\u6027\u6B63\u5728\u63D0\u9AD8"
    });
  }
  if (advice && !advice.isLastChance && nextDayRangeStats && weekTheoreticalMax && weekTheoreticalMax > 0 && nextDayRangeStats.theoretical.max >= weekTheoreticalMax * PEAK_IMMINENT_RATIO) {
    warnings.push({
      kind: "peakWarning",
      emoji: "\u{1F6A8}",
      message: "\u9AD8\u5CF0\u8B66\u544A\uFF1A\u4E0B\u4E00\u500B\u6642\u6BB5\u5C31\u6709\u6A5F\u6703\u78B0\u5230\u672C\u9031\u6700\u9AD8\u50F9"
    });
  }
  if (advice && !advice.isLastChance && patternProbabilities[1 /* LargeSpike */] > 0 && weekTheoreticalMax && weekTheoreticalMax > 0 && advice.currentPrice < weekTheoreticalMax * PEAK_ENDED_RATIO && advice.currentDayIndex >= 8) {
    warnings.push({
      kind: "peakMayHaveEnded",
      emoji: "\u26A0\uFE0F",
      message: "\u9AD8\u5CF0\u53EF\u80FD\u5DF2\u7D93\u7D50\u675F\uFF0C\u76EE\u524D\u50F9\u683C\u660E\u986F\u4F4E\u65BC\u672C\u9031\u89C0\u5BDF\u5230\u7684\u6700\u9AD8\u9EDE"
    });
  }
  if (advice && advice.currentDayIndex >= 11 && !advice.isLastChance) {
    warnings.push({
      kind: "weekEndingSoon",
      emoji: "\u{1F6A8}",
      message: "\u672C\u9031\u5373\u5C07\u7D50\u675F\uFF0C\u5927\u982D\u83DC\u904E\u9031\u6703\u8150\u721B\uFF0C\u8A18\u5F97\u8D95\u5FEB\u8CE3\u6389"
    });
  }
  return warnings;
}

// src/web/chart.ts
var WIDTH = 640;
var HEIGHT = 260;
var PADDING_LEFT = 44;
var PADDING_RIGHT = 12;
var PADDING_TOP = 16;
var PADDING_BOTTOM = 32;
function renderChartSvg(params) {
  const { days, buyPrice } = params;
  const plotWidth = WIDTH - PADDING_LEFT - PADDING_RIGHT;
  const plotHeight = HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const values = [];
  if (buyPrice !== void 0) values.push(buyPrice);
  for (const day of days) {
    if (day.known !== void 0) values.push(day.known);
    if (day.theoretical) values.push(day.theoretical.min, day.theoretical.max);
  }
  if (values.length === 0) values.push(0, 100);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const span = Math.max(1, rawMax - rawMin);
  const yMin = Math.max(0, rawMin - span * 0.1);
  const yMax = rawMax + span * 0.1;
  const xAt = (i) => PADDING_LEFT + plotWidth * i / (days.length - 1 || 1);
  const yAt = (v) => PADDING_TOP + plotHeight - (v - yMin) / (yMax - yMin || 1) * plotHeight;
  const parts = [];
  parts.push(
    `<svg viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="\u5927\u982D\u83DC\u50F9\u683C\u8DA8\u52E2\u5716" class="turnip-chart">`
  );
  const theoreticalTop = days.map((d, i) => `${xAt(i)},${yAt(d.theoretical?.max ?? d.known ?? yMin)}`);
  const theoreticalBottom = days.slice().reverse().map((d, i) => {
    const idx = days.length - 1 - i;
    return `${xAt(idx)},${yAt(d.theoretical?.min ?? d.known ?? yMin)}`;
  });
  parts.push(
    `<polygon points="${[...theoreticalTop, ...theoreticalBottom].join(" ")}" class="chart-theoretical-band" />`
  );
  const hpTop = days.map((d, i) => `${xAt(i)},${yAt(d.highProbability?.max ?? d.known ?? yMin)}`);
  const hpBottom = days.slice().reverse().map((d, i) => {
    const idx = days.length - 1 - i;
    return `${xAt(idx)},${yAt(d.highProbability?.min ?? d.known ?? yMin)}`;
  });
  parts.push(`<polygon points="${[...hpTop, ...hpBottom].join(" ")}" class="chart-highprob-band" />`);
  if (buyPrice !== void 0) {
    const y = yAt(buyPrice);
    parts.push(
      `<line x1="${PADDING_LEFT}" y1="${y}" x2="${WIDTH - PADDING_RIGHT}" y2="${y}" class="chart-buyline" />`
    );
    parts.push(`<text x="${WIDTH - PADDING_RIGHT}" y="${y - 4}" class="chart-buyline-label" text-anchor="end">\u8CFC\u5165\u50F9 ${Math.round(buyPrice)}</text>`);
  }
  let segment = [];
  const segments = [];
  days.forEach((d, i) => {
    if (d.known !== void 0) {
      segment.push(`${xAt(i)},${yAt(d.known)}`);
    } else if (segment.length) {
      segments.push(segment);
      segment = [];
    }
  });
  if (segment.length) segments.push(segment);
  for (const seg of segments) {
    parts.push(`<polyline points="${seg.join(" ")}" class="chart-actual-line" />`);
  }
  days.forEach((d, i) => {
    if (d.known !== void 0) {
      parts.push(`<circle cx="${xAt(i)}" cy="${yAt(d.known)}" r="3.5" class="chart-actual-dot" />`);
    }
  });
  days.forEach((d, i) => {
    parts.push(
      `<text x="${xAt(i)}" y="${HEIGHT - PADDING_BOTTOM + 16}" class="chart-x-label" text-anchor="middle">${d.label}</text>`
    );
  });
  parts.push("</svg>");
  return parts.join("");
}

// src/web/format.ts
function formatBells(value) {
  const rounded = Math.round(value);
  return `${rounded.toLocaleString("zh-TW")} \u9234\u9322`;
}
function formatPercent(ratio, digits = 1) {
  const sign = ratio > 0 ? "+" : "";
  return `${sign}${(ratio * 100).toFixed(digits)}%`;
}
function formatProbabilityPercent(ratio, digits = 0) {
  return `${(ratio * 100).toFixed(digits)}%`;
}
function formatPriceRange(min, max) {
  if (min === max) return `${Math.round(min)}`;
  return `${Math.round(min)} \uFF5E ${Math.round(max)}`;
}

// src/web/storage.ts
var STORAGE_KEY = "acnh-turnip-predictor:v1";
function createEmptyState() {
  return { riskProfile: "balanced", dayPrices: {} };
}
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyState();
    const parsed = JSON.parse(raw);
    return {
      buyPrice: parsed.buyPrice,
      previousPattern: parsed.previousPattern,
      quantity: parsed.quantity,
      riskProfile: parsed.riskProfile ?? "balanced",
      dayPrices: parsed.dayPrices ?? {}
    };
  } catch {
    return createEmptyState();
  }
}
function saveState(state2) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state2));
  } catch {
  }
}
function clearState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
  }
  return createEmptyState();
}

// src/web/main.ts
var DAY_LABELS_FULL = {
  monAM: "\u9031\u4E00 AM",
  monPM: "\u9031\u4E00 PM",
  tueAM: "\u9031\u4E8C AM",
  tuePM: "\u9031\u4E8C PM",
  wedAM: "\u9031\u4E09 AM",
  wedPM: "\u9031\u4E09 PM",
  thuAM: "\u9031\u56DB AM",
  thuPM: "\u9031\u56DB PM",
  friAM: "\u9031\u4E94 AM",
  friPM: "\u9031\u4E94 PM",
  satAM: "\u9031\u516D AM",
  satPM: "\u9031\u516D PM"
};
var DAY_LABELS_COMPACT = {
  monAM: "\u4E00AM",
  monPM: "\u4E00PM",
  tueAM: "\u4E8CAM",
  tuePM: "\u4E8CPM",
  wedAM: "\u4E09AM",
  wedPM: "\u4E09PM",
  thuAM: "\u56DBAM",
  thuPM: "\u56DBPM",
  friAM: "\u4E94AM",
  friPM: "\u4E94PM",
  satAM: "\u516DAM",
  satPM: "\u516DPM"
};
var PATTERN_META = {
  [1 /* LargeSpike */]: { emoji: "\u{1F525}", label: "\u5927\u6F32\u578B" },
  [3 /* SmallSpike */]: { emoji: "\u{1F4C8}", label: "\u5C0F\u6F32\u578B" },
  [0 /* Fluctuating */]: { emoji: "\u3030\uFE0F", label: "\u6CE2\u52D5\u578B" },
  [2 /* Decreasing */]: { emoji: "\u{1F4C9}", label: "\u905E\u6E1B\u578B" }
};
var VERDICT_META = {
  hold: { emoji: "\u{1F7E2}", title: "\u7E7C\u7E8C\u6301\u6709", className: "verdict-hold" },
  canSell: { emoji: "\u{1F7E1}", title: "\u53EF\u4EE5\u51FA\u552E", className: "verdict-canSell" },
  shouldSell: { emoji: "\u{1F7E0}", title: "\u5EFA\u8B70\u51FA\u552E", className: "verdict-shouldSell" },
  stronglySell: { emoji: "\u{1F534}", title: "\u5F37\u70C8\u5EFA\u8B70\u51FA\u552E", className: "verdict-stronglySell" }
};
function el(id) {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing element #${id}`);
  return found;
}
var buyPriceInput = el("buy-price");
var quantityInput = el("quantity");
var previousPatternSelect = el("previous-pattern");
var riskProfileSelect = el("risk-profile");
var dayGrid = el("day-grid");
var verdictCard = el("verdict-card");
var warningsContainer = el("warnings");
var patternProbabilitiesContainer = el("pattern-probabilities");
var highlightCard = el("highlight-card");
var watchWindowEl = el("watch-window");
var weekMaxRangeEl = el("week-max-range");
var strategyCard = el("strategy-card");
var strategyList = el("strategy-list");
var chartContainer = el("chart-container");
var clearButton = el("clear-button");
var state = loadState();
var dayInputs = /* @__PURE__ */ new Map();
function buildDayGrid() {
  dayGrid.innerHTML = "";
  for (const key of DAY_SLOT_KEYS) {
    const cell = document.createElement("div");
    cell.className = "day-cell";
    const label = document.createElement("div");
    label.className = "day-cell-label";
    label.textContent = DAY_LABELS_FULL[key];
    cell.appendChild(label);
    const input = document.createElement("input");
    input.type = "number";
    input.inputMode = "numeric";
    input.min = "0";
    input.placeholder = "\u5C1A\u672A\u767C\u751F";
    input.id = `day-${key}`;
    input.addEventListener("input", () => {
      const value = input.value.trim();
      if (value === "") {
        delete state.dayPrices[key];
      } else {
        state.dayPrices[key] = Number(value);
      }
      persistAndRecompute();
    });
    dayInputs.set(key, input);
    cell.appendChild(input);
    dayGrid.appendChild(cell);
  }
}
function applyStateToForm() {
  buyPriceInput.value = state.buyPrice === void 0 ? "" : String(state.buyPrice);
  quantityInput.value = state.quantity === void 0 ? "" : String(state.quantity);
  previousPatternSelect.value = state.previousPattern === void 0 ? "" : String(state.previousPattern);
  riskProfileSelect.value = state.riskProfile;
  for (const key of DAY_SLOT_KEYS) {
    const input = dayInputs.get(key);
    const value = state.dayPrices[key];
    input.value = value === void 0 ? "" : String(value);
  }
}
function persistAndRecompute() {
  saveState(state);
  recompute();
}
function renderPatternProbabilities(totals) {
  patternProbabilitiesContainer.innerHTML = "";
  if (!totals) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "\u5C1A\u7121\u8CC7\u6599\u3002";
    patternProbabilitiesContainer.appendChild(p);
    return;
  }
  const ordered = [1 /* LargeSpike */, 3 /* SmallSpike */, 0 /* Fluctuating */, 2 /* Decreasing */];
  for (const pattern of ordered) {
    const meta = PATTERN_META[pattern];
    const percent = totals[pattern] ?? 0;
    const row = document.createElement("div");
    row.className = "pattern-row";
    const labelEl = document.createElement("div");
    labelEl.textContent = `${meta.emoji} ${meta.label}`;
    const track = document.createElement("div");
    track.className = "pattern-bar-track";
    const fill = document.createElement("div");
    fill.className = "pattern-bar-fill";
    fill.style.width = `${Math.round(percent * 100)}%`;
    track.appendChild(fill);
    const percentEl = document.createElement("div");
    percentEl.className = "pattern-percent";
    percentEl.textContent = `${Math.round(percent * 100)}%`;
    row.appendChild(labelEl);
    row.appendChild(track);
    row.appendChild(percentEl);
    patternProbabilitiesContainer.appendChild(row);
  }
}
function renderVerdict(advice) {
  verdictCard.className = "card verdict-card";
  verdictCard.innerHTML = "";
  if (!advice) {
    verdictCard.classList.remove(...Object.values(VERDICT_META).map((m) => m.className));
    const p = document.createElement("p");
    p.className = "verdict-placeholder";
    p.textContent = "\u5148\u5728\u4E0B\u65B9\u8F38\u5165\u672C\u9031\u8CFC\u5165\u50F9\uFF0C\u624D\u80FD\u958B\u59CB\u5206\u6790\u3002";
    verdictCard.appendChild(p);
    return;
  }
  const meta = VERDICT_META[advice.level];
  verdictCard.classList.add(meta.className);
  const emoji = document.createElement("span");
  emoji.className = "verdict-emoji";
  emoji.textContent = meta.emoji;
  const title = document.createElement("p");
  title.className = "verdict-title";
  title.textContent = meta.title;
  const detail = document.createElement("p");
  detail.className = "verdict-detail";
  if (advice.isLastChance) {
    detail.textContent = `\u76EE\u524D\u50F9\u683C ${formatBells(advice.currentPrice)}\uFF0C\u672C\u9031\u5DF2\u7D93\u662F\u6700\u5F8C\u6A5F\u6703\uFF0C\u5927\u982D\u83DC\u904E\u9031\u6703\u8150\u721B\u3002`;
  } else {
    detail.textContent = `\u76EE\u524D\u50F9\u683C ${formatBells(advice.currentPrice)}\uFF0C\u672A\u4F86\u9084\u6709\u66F4\u9AD8\u50F9\u683C\u7684\u6A5F\u7387\u7D04 ${formatProbabilityPercent(
      advice.upsideProbability
    )}`;
  }
  verdictCard.appendChild(emoji);
  verdictCard.appendChild(title);
  verdictCard.appendChild(detail);
}
function renderWarnings(warnings) {
  warningsContainer.innerHTML = "";
  if (warnings.length === 0) {
    warningsContainer.hidden = true;
    return;
  }
  warningsContainer.hidden = false;
  for (const warning of warnings) {
    const item = document.createElement("div");
    item.className = "warning-item";
    item.textContent = `${warning.emoji} ${warning.message}`;
    warningsContainer.appendChild(item);
  }
}
function findWatchWindow(candidates, futureStart) {
  if (futureStart > 13 /* SatPM */) return void 0;
  let bestDay = futureStart;
  let bestScore = -Infinity;
  for (let day = futureStart; day <= 13 /* SatPM */; day++) {
    const stats = computeDayRangeStats(candidates, day);
    const score = stats.theoretical.max;
    if (score > bestScore) {
      bestScore = score;
      bestDay = day;
    }
  }
  const startIndex = Math.max(futureStart, bestDay - 1);
  const endIndex = Math.min(13 /* SatPM */, bestDay + 1);
  return { startIndex, endIndex };
}
function renderHighlights(candidates, advice, aggregate) {
  const futureStart = Math.max(advice.currentDayIndex + 1, 2 /* MonAM */);
  const window2 = advice.isLastChance ? void 0 : findWatchWindow(candidates, futureStart);
  if (!window2) {
    highlightCard.hidden = true;
    return;
  }
  highlightCard.hidden = false;
  const startKey = DAY_SLOT_KEYS[window2.startIndex - 2 /* MonAM */];
  const endKey = DAY_SLOT_KEYS[window2.endIndex - 2 /* MonAM */];
  watchWindowEl.textContent = window2.startIndex === window2.endIndex ? DAY_LABELS_FULL[startKey] : `${DAY_LABELS_FULL[startKey]} \uFF5E ${DAY_LABELS_FULL[endKey]}`;
  let maxHighProbability = 0;
  for (let day = futureStart; day <= 13 /* SatPM */; day++) {
    const stats = computeDayRangeStats(candidates, day);
    maxHighProbability = Math.max(maxHighProbability, stats.highProbability.max);
  }
  const theoreticalMax = aggregate?.weekMax ?? maxHighProbability;
  weekMaxRangeEl.textContent = formatPriceRange(maxHighProbability, theoreticalMax);
}
function renderStrategy(advice) {
  strategyCard.hidden = false;
  strategyList.innerHTML = "";
  const rows = [["\u76EE\u524D\u50F9\u683C", formatBells(advice.currentPrice)]];
  if (state.buyPrice !== void 0) {
    const quantity = state.quantity ?? 0;
    if (quantity > 0) {
      const ledger = summarizeLedger({ buyPrice: state.buyPrice, quantity }, advice.currentPrice);
      rows.push(["\u8CFC\u5165\u50F9\u683C", formatBells(ledger.buyPrice)]);
      rows.push(["\u8CFC\u5165\u6578\u91CF", `${ledger.quantity} \u9846`]);
      rows.push(["\u7E3D\u6210\u672C", formatBells(ledger.totalCost)]);
      rows.push(["\u76EE\u524D\u640D\u76CA", `${formatBells(ledger.profit)}\uFF08${formatPercent(ledger.profitPercent)}\uFF09`]);
    } else {
      const profitPercent = (advice.currentPrice - state.buyPrice) / state.buyPrice;
      rows.push(["\u8CFC\u5165\u50F9\u683C", formatBells(state.buyPrice)]);
      rows.push(["\u76EE\u524D\u640D\u76CA\uFF08\u6BCF\u9846\uFF09", formatPercent(profitPercent)]);
    }
  }
  rows.push(["\u672A\u4F86\u671F\u671B\u9AD8\u50F9", formatBells(advice.expectedFutureMax)]);
  rows.push(["\u7406\u8AD6\u6700\u9AD8\u53EF\u80FD", formatBells(advice.theoreticalFutureMax)]);
  for (const [term, value] of rows) {
    const dt = document.createElement("dt");
    dt.textContent = term;
    const dd = document.createElement("dd");
    dd.textContent = value;
    strategyList.appendChild(dt);
    strategyList.appendChild(dd);
  }
}
function renderChart(candidates, aggregate) {
  const days = DAY_SLOT_KEYS.map((key, i) => {
    const dayIndex = i + 2 /* MonAM */;
    const known = state.dayPrices[key];
    const stats = computeDayRangeStats(candidates, dayIndex);
    return {
      label: DAY_LABELS_COMPACT[key],
      known,
      theoretical: known === void 0 ? stats.theoretical : void 0,
      highProbability: known === void 0 ? stats.highProbability : void 0
    };
  });
  void aggregate;
  chartContainer.innerHTML = renderChartSvg({ days, buyPrice: state.buyPrice });
}
function recompute() {
  if (state.buyPrice === void 0 || Number.isNaN(state.buyPrice) || state.buyPrice <= 0) {
    renderVerdict(void 0);
    renderPatternProbabilities(void 0);
    highlightCard.hidden = true;
    strategyCard.hidden = true;
    renderWarnings([]);
    chartContainer.innerHTML = '<p class="muted">\u8F38\u5165\u8CFC\u5165\u50F9\u5F8C\u6703\u986F\u793A\u5716\u8868\u3002</p>';
    return;
  }
  const result = predictTurnipPrices({
    buyPrice: state.buyPrice,
    previousPattern: state.previousPattern,
    prices: state.dayPrices
  });
  const candidates = result.filter((p) => p.patternNumber !== 4);
  const aggregate = result.find((p) => p.patternNumber === 4);
  const totals = summarizePatternProbabilities(result);
  const weekPrices = buildWeekPriceArray(state.buyPrice, state.dayPrices);
  const advice = computeSellAdvice(result, weekPrices, state.riskProfile);
  renderPatternProbabilities(totals);
  renderVerdict(advice);
  if (advice) {
    renderHighlights(candidates, advice, aggregate);
    renderStrategy(advice);
    const futureStart = Math.max(advice.currentDayIndex + 1, 2 /* MonAM */);
    const nextDayRangeStats = advice.isLastChance || futureStart > 13 /* SatPM */ ? void 0 : computeDayRangeStats(candidates, futureStart);
    const warnings = computeWarnings({
      patternProbabilities: totals,
      advice,
      nextDayRangeStats,
      weekTheoreticalMax: aggregate?.weekMax
    });
    renderWarnings(warnings);
  } else {
    highlightCard.hidden = true;
    strategyCard.hidden = true;
    renderWarnings([]);
  }
  renderChart(candidates, aggregate);
}
function wireEvents() {
  buyPriceInput.addEventListener("input", () => {
    const value = buyPriceInput.value.trim();
    state.buyPrice = value === "" ? void 0 : Number(value);
    persistAndRecompute();
  });
  quantityInput.addEventListener("input", () => {
    const value = quantityInput.value.trim();
    state.quantity = value === "" ? void 0 : Number(value);
    persistAndRecompute();
  });
  previousPatternSelect.addEventListener("change", () => {
    const value = previousPatternSelect.value;
    state.previousPattern = value === "" ? void 0 : Number(value);
    persistAndRecompute();
  });
  riskProfileSelect.addEventListener("change", () => {
    state.riskProfile = riskProfileSelect.value;
    persistAndRecompute();
  });
  clearButton.addEventListener("click", () => {
    const confirmed = window.confirm("\u78BA\u5B9A\u8981\u6E05\u9664\u672C\u9031\u6240\u6709\u5DF2\u8F38\u5165\u7684\u50F9\u683C\u8CC7\u6599\u55CE\uFF1F\u9019\u500B\u52D5\u4F5C\u7121\u6CD5\u5FA9\u539F\u3002");
    if (!confirmed) return;
    state = clearState();
    applyStateToForm();
    recompute();
  });
}
function init() {
  buildDayGrid();
  applyStateToForm();
  wireEvents();
  recompute();
}
init();
//# sourceMappingURL=app.js.map
