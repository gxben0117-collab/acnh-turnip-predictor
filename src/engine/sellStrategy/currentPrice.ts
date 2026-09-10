import { DaySlotIndex, type WeekPriceArray } from "../data/types.js";

export interface CurrentPriceInfo {
  /** 目前價格（鈴錢/顆）。 */
  price: number;
  /** 這個價格所在的 14 格陣列索引（2~13）；若還沒有任何一格資料，回傳購入價格所在的索引 0。 */
  dayIndex: number;
  /** 是否為「購入價」本身（代表本週還沒有任何一個時段被填過）。 */
  isBuyPrice: boolean;
}

/**
 * 取得「目前價格」：本週已輸入資料中，索引最大（最晚）的那一格。
 * 若還沒有任何一個時段（週一 AM ~ 週六 PM）被填過，回傳購入價當作參考價。
 */
export function getCurrentPriceInfo(prices: WeekPriceArray): CurrentPriceInfo | undefined {
  for (let i = DaySlotIndex.SatPM; i >= DaySlotIndex.MonAM; i--) {
    const value = prices[i];
    if (value !== undefined && !Number.isNaN(value)) {
      return { price: value, dayIndex: i, isBuyPrice: false };
    }
  }
  const buyPrice = prices[0];
  if (buyPrice !== undefined && !Number.isNaN(buyPrice)) {
    return { price: buyPrice, dayIndex: 0, isBuyPrice: true };
  }
  return undefined;
}
