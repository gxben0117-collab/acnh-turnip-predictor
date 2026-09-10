import { describe, expect, it } from "vitest";
import { summarizeLedger, projectLedgerRange } from "../src/engine/sellStrategy/ledger.js";
import { getCurrentPriceInfo } from "../src/engine/sellStrategy/currentPrice.js";
import { computeSellAdvice } from "../src/engine/sellStrategy/advice.js";
import { buildWeekPriceArray, predictTurnipPrices } from "../src/engine/predictor/publicApi.js";
import { computeDayRangeStats } from "../src/engine/probability/priceRangeStats.js";
import { DaySlotIndex } from "../src/engine/data/types.js";

describe("記帳（買價 × 數量）", () => {
  it("成本、目前總值與損益百分比計算正確", () => {
    const summary = summarizeLedger({ buyPrice: 98, quantity: 40 }, 143);
    expect(summary.totalCost).toBe(98 * 40);
    expect(summary.currentValue).toBe(143 * 40);
    expect(summary.profit).toBe((143 - 98) * 40);
    expect(summary.profitPercent).toBeCloseTo((143 - 98) / 98, 9);
  });

  it("成本為 0（數量為 0）時損益百分比回傳 0，不會除以 0 壞掉", () => {
    const summary = summarizeLedger({ buyPrice: 0, quantity: 0 }, 100);
    expect(summary.profitPercent).toBe(0);
  });

  it("projectLedgerRange 同時算出區間最低/最高價的損益", () => {
    const { atMin, atMax } = projectLedgerRange({ buyPrice: 100, quantity: 10 }, { min: 90, max: 300 });
    expect(atMin.profit).toBe((90 - 100) * 10);
    expect(atMax.profit).toBe((300 - 100) * 10);
  });
});

describe("目前價格判定", () => {
  it("取本週已知資料中最晚的一格當作目前價格", () => {
    const prices = buildWeekPriceArray(100, { monAM: 90, monPM: 85, tueAM: 143 });
    const info = getCurrentPriceInfo(prices);
    expect(info).toEqual({ price: 143, dayIndex: DaySlotIndex.TueAM, isBuyPrice: false });
  });

  it("完全沒有本週資料時，回傳購入價當作參考價", () => {
    const prices = buildWeekPriceArray(100, {});
    const info = getCurrentPriceInfo(prices);
    expect(info).toEqual({ price: 100, dayIndex: 0, isBuyPrice: true });
  });

  it("連購入價都沒有時回傳 undefined", () => {
    const prices = buildWeekPriceArray(undefined, {});
    expect(getCurrentPriceInfo(prices)).toBeUndefined();
  });
});

describe("出售建議", () => {
  it("週六 PM 已經是最後時段，強制回傳強烈建議出售", () => {
    const prices = buildWeekPriceArray(100, { satPM: 120 });
    const result = predictTurnipPrices({ buyPrice: 100, prices: { satPM: 120 } });
    const advice = computeSellAdvice(result, prices, "balanced");
    expect(advice?.level).toBe("stronglySell");
    expect(advice?.isLastChance).toBe(true);
  });

  it("只知道購入價，尚未有任何時段資料時，仍能算出建議（傾向持有，因為一週才剛開始）", () => {
    const prices = buildWeekPriceArray(100, {});
    const result = predictTurnipPrices({ buyPrice: 100, prices: {} });
    const advice = computeSellAdvice(result, prices, "balanced");
    expect(advice).toBeDefined();
    expect(advice?.isLastChance).toBe(false);
    expect(advice?.currentPrice).toBe(100);
  });

  it("風險偏好不同，同一份資料可能給出不同等級（冒險策略應比保守策略更傾向持有）", () => {
    const knownPrices = { monAM: 90, monPM: 85, tueAM: 80, tuePM: 76 };
    const prices = buildWeekPriceArray(100, knownPrices);
    const result = predictTurnipPrices({ buyPrice: 100, prices: knownPrices });

    const conservative = computeSellAdvice(result, prices, "conservative");
    const aggressive = computeSellAdvice(result, prices, "aggressive");

    const levelRank = { stronglySell: 0, shouldSell: 1, canSell: 2, hold: 3 };
    expect(levelRank[aggressive!.level]).toBeGreaterThanOrEqual(levelRank[conservative!.level]);
  });
});

describe("理論範圍 vs 高機率範圍", () => {
  it("高機率範圍應該包含在理論範圍之內（是子集合）", () => {
    const result = predictTurnipPrices({ buyPrice: 100, prices: {} });
    const candidates = result.filter((p) => p.patternNumber !== 4);
    const stats = computeDayRangeStats(candidates, DaySlotIndex.ThuAM, 0.8);

    expect(stats.highProbability.min).toBeGreaterThanOrEqual(stats.theoretical.min);
    expect(stats.highProbability.max).toBeLessThanOrEqual(stats.theoretical.max);
  });
});
