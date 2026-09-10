import { TurnipPattern } from "../data/types.js";
import type { DayRangeStats } from "../probability/priceRangeStats.js";
import type { SellAdvice } from "./advice.js";

/**
 * 警告訊息層。同樣屬於本專案自己設計的判斷邏輯（見 advice.ts 開頭的說明），
 * 用途是把已經算好的 Pattern 機率／出售建議／區間統計，轉成使用者一眼就懂的提醒。
 */
export type WarningKind = "largeSpikeRising" | "peakWarning" | "peakMayHaveEnded" | "weekEndingSoon";

export interface Warning {
  kind: WarningKind;
  emoji: string;
  message: string;
}

const LARGE_SPIKE_RISING_THRESHOLD = 0.4;
const PEAK_IMMINENT_RATIO = 0.95;
const PEAK_ENDED_RATIO = 0.6;

export interface ComputeWarningsParams {
  patternProbabilities: Record<TurnipPattern, number>;
  advice: SellAdvice | undefined;
  /** 下一個尚未發生時段的區間統計（用來判斷是否即將碰到高峰）。 */
  nextDayRangeStats: DayRangeStats | undefined;
  /** 本週理論最高價（pattern 4 聚合列的 weekMax）。 */
  weekTheoreticalMax: number | undefined;
}

export function computeWarnings(params: ComputeWarningsParams): Warning[] {
  const { patternProbabilities, advice, nextDayRangeStats, weekTheoreticalMax } = params;
  const warnings: Warning[] = [];

  if (patternProbabilities[TurnipPattern.LargeSpike] > LARGE_SPIKE_RISING_THRESHOLD) {
    warnings.push({
      kind: "largeSpikeRising",
      emoji: "🔥",
      message: "偵測到大漲型可能性正在提高",
    });
  }

  if (
    advice &&
    !advice.isLastChance &&
    nextDayRangeStats &&
    weekTheoreticalMax &&
    weekTheoreticalMax > 0 &&
    nextDayRangeStats.theoretical.max >= weekTheoreticalMax * PEAK_IMMINENT_RATIO
  ) {
    warnings.push({
      kind: "peakWarning",
      emoji: "🚨",
      message: "高峰警告：下一個時段就有機會碰到本週最高價",
    });
  }

  if (
    advice &&
    !advice.isLastChance &&
    patternProbabilities[TurnipPattern.LargeSpike] > 0 &&
    weekTheoreticalMax &&
    weekTheoreticalMax > 0 &&
    advice.currentPrice < weekTheoreticalMax * PEAK_ENDED_RATIO &&
    advice.currentDayIndex >= 8 // 週四 AM 之後
  ) {
    warnings.push({
      kind: "peakMayHaveEnded",
      emoji: "⚠️",
      message: "高峰可能已經結束，目前價格明顯低於本週觀察到的最高點",
    });
  }

  if (advice && advice.currentDayIndex >= 11 && !advice.isLastChance) {
    // 週五 PM（index 11）之後，只剩週六 AM/PM。
    warnings.push({
      kind: "weekEndingSoon",
      emoji: "🚨",
      message: "本週即將結束，大頭菜過週會腐爛，記得趕快賣掉",
    });
  }

  return warnings;
}
