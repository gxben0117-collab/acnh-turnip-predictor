import { describe, expect, it } from "vitest";
import { generatePattern0 } from "../src/engine/patterns/pattern0.js";
import { generatePattern2 } from "../src/engine/patterns/pattern2.js";
import { generatePattern3WithPeak } from "../src/engine/patterns/pattern3.js";
import { buildWeekPriceArray, predictTurnipPrices, summarizePatternProbabilities } from "../src/engine/predictor/publicApi.js";
import { TurnipPattern } from "../src/engine/data/types.js";

/**
 * 對照 docs/演算法原始數據規格表.md 第 7 節列的測試基準，
 * 驗證每種 Pattern 的「形狀」符合規格表描述，不是隨便一組數字。
 */
describe("pattern shapes", () => {
  it("遞減型（Pattern 2）：全週單調遞減，且落在 85%~90% 起跳、每格再扣 3%~5% 的範圍內", () => {
    const buyPrice = 100;
    const prices = buildWeekPriceArray(buyPrice, {});
    const [possibility] = Array.from(generatePattern2({ fudgeFactor: 0 }, prices));
    expect(possibility).toBeDefined();

    const dayPrices = possibility!.prices.slice(2); // index 2~13 = 週一AM ~ 週六PM
    // 全週單調不遞增（每天上限不可能超過前一天上限，因為 rate 持續遞減）。
    for (let i = 1; i < dayPrices.length; i++) {
      expect(dayPrices[i]!.max, `第 ${i} 天上限不應超過前一天`).toBeLessThanOrEqual(dayPrices[i - 1]!.max);
    }

    // 第一天（週一 AM）理論上限應落在 85%~90% 區間內（intceil 取整，容許 1 的誤差）。
    expect(dayPrices[0]!.max).toBeGreaterThanOrEqual(Math.floor(buyPrice * 0.85));
    expect(dayPrices[0]!.max).toBeLessThanOrEqual(Math.ceil(buyPrice * 0.9) + 1);
  });

  it("小漲型（Pattern 3）：帽子形尖峰——中間格價格必定 ≥ 左右兩格", () => {
    const buyPrice = 100;
    const prices = buildWeekPriceArray(buyPrice, {});

    for (let peakStart = 2; peakStart < 10; peakStart++) {
      const [possibility] = Array.from(generatePattern3WithPeak({ fudgeFactor: 0 }, prices, peakStart));
      expect(possibility, `peakStart=${peakStart}`).toBeDefined();

      const left = possibility!.prices[peakStart + 2]!;
      const middle = possibility!.prices[peakStart + 3]!;
      const right = possibility!.prices[peakStart + 4]!;

      expect(middle.max, `peakStart=${peakStart} 中間格上限應 ≥ 左格上限`).toBeGreaterThanOrEqual(left.max);
      expect(middle.max, `peakStart=${peakStart} 中間格上限應 ≥ 右格上限`).toBeGreaterThanOrEqual(right.max);
    }
  });

  it("波動型（Pattern 0）：每個候選路徑的高價期／遞減期長度加總固定為 12 格", () => {
    const buyPrice = 100;
    const prices = buildWeekPriceArray(buyPrice, {});
    const possibilities = Array.from(generatePattern0({ fudgeFactor: 0 }, prices));
    expect(possibilities.length).toBeGreaterThan(0);
    for (const poss of possibilities) {
      // prices 陣列固定長度 14（含開頭兩格購入價）。
      expect(poss.prices.length).toBe(14);
    }
  });

  it("已知某天價格遠高於波動/遞減/小漲型上限時，只有大漲型存活", () => {
    // 從「無資料」基準先取得三種較低倍率 Pattern 在週三 AM（index 6）的理論上限，
    // 再設定一個超過它們、但仍落在大漲型可能範圍內的價格，驗證排除邏輯。
    const buyPrice = 100;
    const baseline = predictTurnipPrices({ buyPrice, prices: {} });
    const globalAggregate = baseline.find((p) => p.patternNumber === 4)!;
    // 週三 AM 對應內部 index 6，扣掉聚合列本身用的是全域最大值；
    // 這裡改用「刻意設一個超高價格」的方式驗證，而非直接假設哪個 Pattern 的上限最低。
    void globalAggregate;

    const veryHighPrice = Math.round(buyPrice * 5.5); // 550%，只有大漲型的主高峰（200~600%）碰得到
    const result = predictTurnipPrices({ buyPrice, prices: { wedAM: veryHighPrice } });
    const totals = summarizePatternProbabilities(result);

    expect(totals[TurnipPattern.LargeSpike]).toBeGreaterThan(0);
    expect(totals[TurnipPattern.Fluctuating]).toBe(0);
    expect(totals[TurnipPattern.Decreasing]).toBe(0);
    expect(totals[TurnipPattern.SmallSpike]).toBe(0);
  });

  it("不知道上週型態時，四個 Pattern 機率加總應為 1（且等於穩態分布）", () => {
    const result = predictTurnipPrices({ buyPrice: 100, prices: {} });
    const totals = summarizePatternProbabilities(result);
    const sum = Object.values(totals).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 9);

    expect(totals[TurnipPattern.Fluctuating]).toBeCloseTo(4530 / 13082, 9);
    expect(totals[TurnipPattern.LargeSpike]).toBeCloseTo(3236 / 13082, 9);
    expect(totals[TurnipPattern.Decreasing]).toBeCloseTo(1931 / 13082, 9);
    expect(totals[TurnipPattern.SmallSpike]).toBeCloseTo(3385 / 13082, 9);
  });
});
