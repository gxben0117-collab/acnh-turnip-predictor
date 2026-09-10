import { describe, expect, it } from "vitest";
import { analyzePossibilities } from "../src/engine/predictor/analyze.js";
import { buildWeekPriceArray } from "../src/engine/predictor/publicApi.js";
import { TurnipPattern, type PatternPossibility, type WeekPriceArray } from "../src/engine/data/types.js";
import { loadVendorPredictor, type VendorPossibility } from "./helpers/loadVendorPredictor.js";

/**
 * 交叉驗證：把同一組輸入分別餵給
 *   (a) vendor/ac-nh-turnip-prices/predictions.js 的原始參考實作
 *   (b) 本專案 src/engine 的 TypeScript 移植版
 * 比對兩邊算出的「各 Pattern 總機率」與「全域最小/最大價格區間」是否一致。
 *
 * 這是 docs/演算法原始數據規格表.md 第 7 節要求的交叉驗證，直接對照參考實作的輸出，
 * 比手動貼去 turnipprophet.io 網站比對更嚴謹、更可重複執行。
 */

function vendorCategoryTotals(possibilities: VendorPossibility[]): Record<number, number> {
  const totals: Record<number, number> = {};
  for (const poss of possibilities) {
    if (poss.pattern_number === 4) continue;
    totals[poss.pattern_number] = poss.category_total_probability ?? 0;
  }
  return totals;
}

function ourCategoryTotals(possibilities: PatternPossibility[]): Record<number, number> {
  const totals: Record<number, number> = {};
  for (const poss of possibilities) {
    if (poss.patternNumber === 4) continue;
    totals[poss.patternNumber] = poss.categoryTotalProbability ?? 0;
  }
  return totals;
}

function expectSameAnalysis(vendorResult: VendorPossibility[], ourResult: PatternPossibility[]): void {
  const vendorTotals = vendorCategoryTotals(vendorResult);
  const ourTotals = ourCategoryTotals(ourResult);

  for (const pattern of [0, 1, 2, 3] as const) {
    expect(ourTotals[pattern] ?? 0, `pattern ${pattern} 的總機率應與 vendor 一致`).toBeCloseTo(
      vendorTotals[pattern] ?? 0,
      9,
    );
  }

  const vendorAggregate = vendorResult.find((p) => p.pattern_number === 4)!;
  const ourAggregate = ourResult.find((p) => p.patternNumber === 4)!;

  expect(ourAggregate.prices.length).toBe(vendorAggregate.prices.length);
  for (let day = 0; day < vendorAggregate.prices.length; day++) {
    expect(ourAggregate.prices[day]!.min, `day ${day} min`).toBe(vendorAggregate.prices[day]!.min);
    expect(ourAggregate.prices[day]!.max, `day ${day} max`).toBe(vendorAggregate.prices[day]!.max);
  }
  expect(ourAggregate.weekGuaranteedMinimum).toBe(vendorAggregate.weekGuaranteedMinimum);
  expect(ourAggregate.weekMax).toBe(vendorAggregate.weekMax);
}

describe("cross validation against vendor/ac-nh-turnip-prices", () => {
  const vendor = loadVendorPredictor();

  it("只知道購入價、不知道上週型態", () => {
    const prices = buildWeekPriceArray(100, {});

    const vendorResult = new vendor.Predictor(prices.slice(), false, undefined).analyze_possibilities();
    const ourResult = analyzePossibilities(prices.slice(), false, undefined);

    expectSameAnalysis(vendorResult, ourResult);
  });

  it("只知道購入價、上週是大漲型（先驗機率應等於轉移矩陣該列）", () => {
    const prices = buildWeekPriceArray(100, {});

    const vendorResult = new vendor.Predictor(
      prices.slice(),
      false,
      vendor.PATTERN.LARGE_SPIKE,
    ).analyze_possibilities();
    const ourResult = analyzePossibilities(prices.slice(), false, TurnipPattern.LargeSpike);

    expectSameAnalysis(vendorResult, ourResult);

    // 沒有任何一天的資料可以排除路徑時，四個 Pattern 的總機率應該直接等於
    // PROBABILITY_MATRIX[大漲型] 那一列（0.50 / 0.05 / 0.20 / 0.25）。
    const totals = ourCategoryTotals(ourResult);
    expect(totals[TurnipPattern.Fluctuating]).toBeCloseTo(0.5, 9);
    expect(totals[TurnipPattern.LargeSpike]).toBeCloseTo(0.05, 9);
    expect(totals[TurnipPattern.Decreasing]).toBeCloseTo(0.2, 9);
    expect(totals[TurnipPattern.SmallSpike]).toBeCloseTo(0.25, 9);
  });

  it("全週價格落在遞減型的理論路徑上", () => {
    // 用 vendor 自己的 generate_pattern_2()（只有遞減型、沒有其他 Pattern 混入）
    // 算出的理論下限，當作「已知」的一週價格，確保這組資料是演算法本身認可、
    // 真的能重現的路徑，而不是憑感覺亂編的數字。
    const baseline = buildWeekPriceArray(100, {});
    const vendorPredictorForFixture = new vendor.Predictor(baseline, false, undefined);
    const decreasingEnvelope = Array.from(
      (vendorPredictorForFixture as unknown as { generate_pattern_2: (p: number[]) => Generator<VendorPossibility> }).generate_pattern_2(baseline),
    )[0]!;

    const knownPrices: Partial<Record<string, number>> = {};
    const dayKeys = ["monAM", "monPM", "tueAM", "tuePM", "wedAM", "wedPM", "thuAM", "thuPM", "friAM", "friPM", "satAM", "satPM"];
    dayKeys.forEach((key, i) => {
      knownPrices[key] = decreasingEnvelope.prices[i + 2]!.min;
    });

    const prices = buildWeekPriceArray(100, knownPrices as never);

    const vendorResult = new vendor.Predictor(prices.slice(), false, undefined).analyze_possibilities();
    const ourResult = analyzePossibilities(prices.slice(), false, undefined);

    expectSameAnalysis(vendorResult, ourResult);
    // 這組資料是從遞減型的理論路徑直接取樣的，遞減型理應存活（機率 > 0）。
    expect(ourCategoryTotals(ourResult)[TurnipPattern.Decreasing]).toBeGreaterThan(0);
  });

  it("已知大漲型某天的高峰價格（只留這一天資料，其餘留白）", () => {
    // 用 vendor 自己的 generate_pattern_1_with_peak(given_prices, 4)：peakStart=4
    // 時，index 6（週三 AM）正好是五格主高峰的最高點（200~600%）。
    const baseline = buildWeekPriceArray(100, {});
    const vendorPredictorForFixture = new vendor.Predictor(baseline, false, undefined);
    const spikeEnvelope = Array.from(
      (
        vendorPredictorForFixture as unknown as {
          generate_pattern_1_with_peak: (p: number[], peakStart: number) => Generator<VendorPossibility>;
        }
      ).generate_pattern_1_with_peak(baseline, 4),
    )[0]!;

    // index 6 = 週三 AM，取該路徑下的最高值，這個值遠高於其他三種 Pattern 在同一天的理論上限。
    const peakDayPrice = spikeEnvelope.prices[6]!.max;

    const prices = buildWeekPriceArray(100, { wedAM: peakDayPrice } as never);

    const vendorResult = new vendor.Predictor(prices.slice(), false, undefined).analyze_possibilities();
    const ourResult = analyzePossibilities(prices.slice(), false, undefined);

    expectSameAnalysis(vendorResult, ourResult);

    const totals = ourCategoryTotals(ourResult);
    expect(totals[TurnipPattern.LargeSpike]).toBeGreaterThan(0);
  });

  it("玩家在該座島第一次買大頭菜（購入價未知，firstBuy=true）", () => {
    const prices: WeekPriceArray = buildWeekPriceArray(undefined, {});

    const vendorResult = new vendor.Predictor(prices.slice(), true, undefined).analyze_possibilities();
    const ourResult = analyzePossibilities(prices.slice(), true, undefined);

    expectSameAnalysis(vendorResult, ourResult);

    // firstBuy 分支只會枚舉小漲型，其餘三個 Pattern 總機率應為 0。
    const totals = ourCategoryTotals(ourResult);
    expect(totals[TurnipPattern.Fluctuating] ?? 0).toBe(0);
    expect(totals[TurnipPattern.LargeSpike] ?? 0).toBe(0);
    expect(totals[TurnipPattern.Decreasing] ?? 0).toBe(0);
    expect(totals[TurnipPattern.SmallSpike]).toBeCloseTo(1, 9);
  });
});
