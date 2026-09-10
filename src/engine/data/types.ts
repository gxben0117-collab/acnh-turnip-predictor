/** 大頭菜價格四種 Pattern，編號與 vendor 原始碼的 PATTERN 常數一致。 */
export enum TurnipPattern {
  Fluctuating = 0, // 波動型
  LargeSpike = 1, // 大漲型
  Decreasing = 2, // 遞減型
  SmallSpike = 3, // 小漲型
}

/** 一週 14 個價位格：index 0、1 = 週日購入價，index 2～13 = 週一 AM ～ 週六 PM。 */
export const WEEK_SLOT_COUNT = 14;

/** 每個時段在 14 格陣列中的索引，對應使用者輸入介面的 12 個時段。 */
export enum DaySlotIndex {
  MonAM = 2,
  MonPM = 3,
  TueAM = 4,
  TuePM = 5,
  WedAM = 6,
  WedPM = 7,
  ThuAM = 8,
  ThuPM = 9,
  FriAM = 10,
  FriPM = 11,
  SatAM = 12,
  SatPM = 13,
}

/** UI 友善的時段鍵值，依序對應 DaySlotIndex.MonAM ~ SatPM。 */
export const DAY_SLOT_KEYS = [
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
  "satPM",
] as const;

export type DaySlotKey = (typeof DAY_SLOT_KEYS)[number];

/**
 * 內部運算用的一週價格陣列，長度固定 14，未知時段用 NaN 表示。
 * 這個型別刻意貼近 vendor 原始碼的 sell_prices 陣列格式，方便逐行比對移植正確性。
 */
export type WeekPriceArray = number[];

export interface PriceRange {
  min: number;
  max: number;
}

/**
 * 一個「候選價格路徑」的分析結果。
 * pattern_number = 4 是 vendor 原始碼用來代表「所有存活路徑聚合後的全域最小/最大值」的特殊列，
 * 不是真正的第五種 Pattern。
 */
export interface PatternPossibility {
  patternNumber: TurnipPattern | 4;
  prices: PriceRange[];
  probability: number;
  weekGuaranteedMinimum?: number;
  weekMax?: number;
  categoryTotalProbability?: number;
}

/** RATE_MULTIPLIER：所有倍率內部運算時的放大尺度。 */
export const RATE_MULTIPLIER = 10000;
