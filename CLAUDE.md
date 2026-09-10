# CLAUDE.md — 動物森友會大頭菜價格預測器

> 同內容複製一份給 Codex 用，檔名 `AGENTS.md`。兩檔內容需保持同步。

## 共通規範

先讀 `C:\AIProjects\000AI-Vault\INDEX.md`（工作區規範、命名版本規則、環境陷阱都在那裡，本檔不重複）。

## 本專案特有

- 專案目標：輸入大頭菜購入價與已知價格，用遊戲真實的價格生成演算法反推目前仍可能的 Pattern，預測未來價格區間，
  給出「現在該不該賣」的建議。第一版不接 AI／LLM／付費 API。
- 技術棧：HTML／CSS／TypeScript（如需框架用 React + TypeScript）。
- 主入口：`index.html`（Phase 2 開始建立）。
- 建置/測試指令：待 Phase 2 選定框架後在此補上（預期會是 `npm.cmd install`、`npm.cmd run build`、`npm.cmd test`；
  PowerShell 下務必用 `npm.cmd`，不要用 `npm`）。
- **最重要的鐵則**：四種 Pattern 的公式、倍率區間、轉移機率矩陣、取整方式，一律以
  [docs/演算法原始數據規格表.md](docs/演算法原始數據規格表.md) 與 `vendor/ac-nh-turnip-prices/predictions.js` 為準。
  **禁止**自行憑印象或「看起來合理」的方式簡化、發明或調整這些公式。若懷疑規格表有誤，先回頭核對 vendor 原始碼，
  再回寫修正規格表，不要直接改程式碼繞過。
- 特殊禁區：`vendor/ac-nh-turnip-prices/` 是唯讀的原始碼快照（含 Apache-2.0 LICENSE/NOTICE），只能讀取比對，
  不可修改、不可被 `src/` 直接 import 執行——實際網站邏輯要用 TypeScript 重新撰寫在 `src/engine/`。
- 開發順序：嚴格按照 [docs/專案規格書.md](docs/專案規格書.md) 第十六節的 Phase 1～8 循序推進，不要一次把所有功能寫完。
  Phase 1（演算法研究與 License 確認）已完成，下一步是 Phase 2：建立純 TypeScript prediction engine。
- 測試優先：Phase 3 要用 [docs/演算法原始數據規格表.md](docs/演算法原始數據規格表.md) 第 7 節列的案例，
  並與 Turnip Prophet 官網（<https://turnipprophet.io/>）交叉驗證，確保相同輸入得到一致的 Pattern 與價格範圍。

## 目前狀態與下一步

- 2026-09-10：Phase 1 完成。已取得 Turnip Prophet 原始碼（`predictions.js`／`scripts.js`，Apache-2.0）存於
  `vendor/ac-nh-turnip-prices/`，並整理成中文版《演算法原始數據規格表》與《專案規格書》。專案目錄骨架
  （`src/engine/{patterns,predictor,probability,sellStrategy}`、`src/components`、`src/data`、`tests`）已建立，
  尚無程式碼。
- 下一步（Phase 2）：選定 TypeScript 專案初始化方式（純 TS 或 React + TS），依演算法規格表把
  `generate_pattern_0~3`、`PROBABILITY_MATRIX`、`PDF`／機率密度計算等邏輯移植成 `src/engine/` 下的模組，
  預測核心要能脫離 UI 單獨被測試呼叫。
