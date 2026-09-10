import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * 動態載入 vendor/ac-nh-turnip-prices/predictions.js（未經修改的原始檔）。
 *
 * 這個檔案本身不是用 CommonJS/ESM 模組系統寫的（沒有 export），所以用
 * `new Function` 包一層 CommonJS 風格的 module wrapper 在執行期把它需要的
 * 符號（PATTERN、Predictor、PDF、PROBABILITY_MATRIX）掛到 module.exports 上。
 * **不會**修改磁碟上的 vendor 檔案本身，只是在測試執行期動態包一層外殼。
 *
 * 用途：讓我們的 TypeScript 移植版可以直接跟「原始參考實作」跑同一組輸入，
 * 逐項比對輸出，取代「拿到 turnipprophet.io 網站上手動比對」這種不穩定的做法。
 */
export interface VendorPatternPrice {
  min: number;
  max: number;
}

export interface VendorPossibility {
  pattern_number: number;
  prices: VendorPatternPrice[];
  probability: number;
  weekGuaranteedMinimum?: number;
  weekMax?: number;
  category_total_probability?: number;
}

export interface VendorPredictorCtor {
  new (prices: number[], firstBuy: boolean, previousPattern?: number): {
    analyze_possibilities(): VendorPossibility[];
  };
}

export interface VendorModule {
  PATTERN: { FLUCTUATING: 0; LARGE_SPIKE: 1; DECREASING: 2; SMALL_SPIKE: 3 };
  PROBABILITY_MATRIX: Record<number, Record<number, number>>;
  Predictor: VendorPredictorCtor;
}

const VENDOR_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../vendor/ac-nh-turnip-prices/predictions.js",
);

let cached: VendorModule | undefined;

export function loadVendorPredictor(): VendorModule {
  if (cached) return cached;

  const source = readFileSync(VENDOR_PATH, "utf-8");
  // vendor 檔案用 `console.log` 印偵錯訊息，測試時不需要看到，靜音掉。
  const wrapped = `
    const console = { log: () => {} };
    ${source}
    module.exports = { PATTERN, Predictor, PDF, PROBABILITY_MATRIX };
  `;
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const factory = new Function("module", "exports", wrapped);
  const mod: { exports: Partial<VendorModule> } = { exports: {} };
  factory(mod, mod.exports);

  cached = mod.exports as VendorModule;
  return cached;
}
