import { DaySlotIndex, type PatternPossibility, type WeekPriceArray } from "../data/types.js";
import { getCurrentPriceInfo } from "./currentPrice.js";

/**
 * 出售建議層。
 *
 * ⚠️ 這一層（風險等級判定、期望值估算）是本專案自己設計的決策邏輯，
 * **不是**從 vendor/ac-nh-turnip-prices 移植來的——vendor 原始碼只算「Pattern 機率」與
 * 「價格區間」，並沒有「該不該賣」的建議演算法。這裡用「機率加權的未來期望漲幅」
 * 當作出售與否的核心指標，門檻依風險偏好（保守/平衡/冒險）調整。
 * 公式與門檻之後可依實測回饋調整，調整時不影響 Pattern 預測本身（兩者完全分離）。
 */

export type RiskProfile = "conservative" | "balanced" | "aggressive";

export type SellAdviceLevel = "hold" | "canSell" | "shouldSell" | "stronglySell";

export interface SellAdvice {
  level: SellAdviceLevel;
  /** 目前價格（鈴錢/顆）。 */
  currentPrice: number;
  /** 目前價格所在時段的索引（2~13），或 0 代表還沒有任何時段資料、僅有購入價。 */
  currentDayIndex: number;
  /** 依機率加權，未來還沒發生的時段中，「期望最高單價」（不是理論極端值）。 */
  expectedFutureMax: number;
  /** 未來還沒發生的時段中，理論上可能出現的全域最高單價（含極端小機率路徑）。 */
  theoreticalFutureMax: number;
  /** 依機率加權估計的「未來還有更高價格」的機率（0~1）。 */
  upsideProbability: number;
  /** 本週是否已經沒有未來時段（已經是週六 PM 或更晚）。 */
  isLastChance: boolean;
}

const RISK_THRESHOLDS: Record<RiskProfile, { stronglySell: number; shouldSell: number; canSell: number }> = {
  // score ≈ 機率加權的期望漲幅（例如 0.05 代表期望還能再漲約 5%）。
  // 保守策略門檻較高，代表「期望漲幅沒有明顯超過門檻」就傾向早點賣。
  conservative: { stronglySell: 0.02, shouldSell: 0.06, canSell: 0.15 },
  balanced: { stronglySell: 0.01, shouldSell: 0.04, canSell: 0.1 },
  aggressive: { stronglySell: 0.005, shouldSell: 0.02, canSell: 0.06 },
};

/** 判斷 patternNumber !== 4 的「真正候選路徑」（排除全域聚合列）。 */
function realPossibilities(possibilities: readonly PatternPossibility[]): PatternPossibility[] {
  return possibilities.filter((p) => p.patternNumber !== 4) as PatternPossibility[];
}

/**
 * 依目前所有存活路徑，計算出售建議。
 *
 * @param possibilities predictTurnipPrices() 的完整回傳結果（含 patternNumber 4 的全域聚合列）。
 * @param prices 本週 14 格價格陣列（用來判斷「目前價格」與「還剩哪些未來時段」）。
 * @param riskProfile 玩家風險偏好。
 */
export function computeSellAdvice(
  possibilities: readonly PatternPossibility[],
  prices: WeekPriceArray,
  riskProfile: RiskProfile,
): SellAdvice | undefined {
  const currentPriceInfo = getCurrentPriceInfo(prices);
  if (!currentPriceInfo) {
    return undefined;
  }

  const { price: currentPrice, dayIndex: currentDayIndex } = currentPriceInfo;
  const futureStart = Math.max(currentDayIndex + 1, DaySlotIndex.MonAM);
  const isLastChance = futureStart > DaySlotIndex.SatPM;

  const candidates = realPossibilities(possibilities);

  if (isLastChance || candidates.length === 0) {
    return {
      level: "stronglySell",
      currentPrice,
      currentDayIndex,
      expectedFutureMax: currentPrice,
      theoreticalFutureMax: currentPrice,
      upsideProbability: 0,
      isLastChance: true,
    };
  }

  // 每個未來時段的「機率加權期望價」= Σ(該路徑機率 × 該路徑在這天的區間中點)。
  let expectedFutureMax = 0;
  let theoreticalFutureMax = 0;
  for (let day = futureStart; day <= DaySlotIndex.SatPM; day++) {
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

  // 「未來還有更高價格」的機率：把每條路徑在未來時段的最大值拿來跟目前價格比較，
  // 只要有 5% 以上的漲幅就算「有意義的上漲」，加總這些路徑的機率。
  const upMargin = 1.05;
  let upsideProbability = 0;
  for (const poss of candidates) {
    let pathFutureMax = 0;
    for (let day = futureStart; day <= DaySlotIndex.SatPM; day++) {
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
  let level: SellAdviceLevel;
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
    isLastChance: false,
  };
}
