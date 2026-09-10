import type { DaySlotKey } from "../engine/data/types.js";
import type { RiskProfile } from "../engine/sellStrategy/advice.js";

export interface AppState {
  buyPrice?: number;
  previousPattern?: 0 | 1 | 2 | 3;
  quantity?: number;
  riskProfile: RiskProfile;
  dayPrices: Partial<Record<DaySlotKey, number>>;
}

const STORAGE_KEY = "acnh-turnip-predictor:v1";

export function createEmptyState(): AppState {
  return { riskProfile: "balanced", dayPrices: {} };
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyState();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      buyPrice: parsed.buyPrice,
      previousPattern: parsed.previousPattern,
      quantity: parsed.quantity,
      riskProfile: parsed.riskProfile ?? "balanced",
      dayPrices: parsed.dayPrices ?? {},
    };
  } catch {
    return createEmptyState();
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage 不可用（例如私密瀏覽模式），安靜略過，不影響當次使用。
  }
}

export function clearState(): AppState {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 略過。
  }
  return createEmptyState();
}
