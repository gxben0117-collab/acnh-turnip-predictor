/**
 * 記帳（購入數量 × 價格）計算。
 *
 * 這裡只是單純的成本/損益算術，不涉及大頭菜價格生成演算法本身，
 * 所以不需要比對 vendor 原始碼——公式就是國小數學：
 *   總成本 = 購入單價 × 數量
 *   目前總值 = 目前單價 × 數量
 *   損益 = 目前總值 － 總成本
 */

export interface TurnipLedgerEntry {
  /** 週日購入單價（鈴錢/顆）。 */
  buyPrice: number;
  /** 購入數量（顆）。 */
  quantity: number;
}

export interface LedgerSummary {
  /** 購入單價（鈴錢/顆）。 */
  buyPrice: number;
  /** 購入數量（顆）。 */
  quantity: number;
  /** 總成本 = buyPrice × quantity。 */
  totalCost: number;
  /** 用來計算損益的單價（鈴錢/顆）。 */
  pricePerUnit: number;
  /** 目前總值 = pricePerUnit × quantity。 */
  currentValue: number;
  /** 損益金額（鈴錢）= currentValue － totalCost。 */
  profit: number;
  /** 損益百分比，例如 0.459 代表 +45.9%。購入數量或成本為 0 時回傳 0。 */
  profitPercent: number;
}

/** 依購入紀錄與指定單價，算出成本、總值與損益。 */
export function summarizeLedger(entry: TurnipLedgerEntry, pricePerUnit: number): LedgerSummary {
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
    profitPercent,
  };
}

/** 同時算出「以區間最低價賣出」與「以區間最高價賣出」的兩組損益，方便 UI 顯示「未來可能損益範圍」。 */
export function projectLedgerRange(
  entry: TurnipLedgerEntry,
  priceRange: { min: number; max: number },
): { atMin: LedgerSummary; atMax: LedgerSummary } {
  return {
    atMin: summarizeLedger(entry, priceRange.min),
    atMax: summarizeLedger(entry, priceRange.max),
  };
}
