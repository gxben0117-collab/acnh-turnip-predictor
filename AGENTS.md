# CLAUDE.md — 動物森友會大頭菜價格預測器

> 同內容複製一份給 Codex 用，檔名 `AGENTS.md`。兩檔內容需保持同步。

## 共通規範

先讀 `C:\AIProjects\000AI-Vault\INDEX.md`（工作區規範、命名版本規則、環境陷阱都在那裡，本檔不重複）。

## 本專案特有

- 專案目標：輸入大頭菜購入價與已知價格，用遊戲真實的價格生成演算法反推目前仍可能的 Pattern，預測未來價格區間，
  給出「現在該不該賣」的建議，並支援買價×數量的記帳。第一版不接 AI／LLM／付費 API。
- 技術棧：純 TypeScript（無框架），用 esbuild 打包成瀏覽器可執行的單一 `app.js`。
- 主入口：`index.html`（根目錄，純靜態頁面，載入 `./app.js`）。
- 建置/測試指令（PowerShell 下務必用 `npm.cmd`，不要用 `npm`）：
  - `npm.cmd install`
  - `npm.cmd test` — 跑 vitest（含與 vendor 原始碼的交叉驗證）
  - `npm.cmd run typecheck` — `tsc --noEmit`
  - `npm.cmd run build` — 用 `build.mjs`（esbuild）把 `src/web/main.ts`（含它 import 的整個 `src/engine`）
    打包成根目錄的 `app.js`／`app.js.map`
  - `npm.cmd run serve` — 本機起靜態伺服器預覽
- **最重要的鐵則**：四種 Pattern 的公式、倍率區間、轉移機率矩陣、取整方式，一律以
  [docs/演算法原始數據規格表.md](docs/演算法原始數據規格表.md) 與 `vendor/ac-nh-turnip-prices/predictions.js` 為準。
  **禁止**自行憑印象或「看起來合理」的方式簡化、發明或調整這些公式。若懷疑規格表有誤，先回頭核對 vendor 原始碼，
  再回寫修正規格表，不要直接改程式碼繞過。`src/engine/sellStrategy/`（出售建議等級、警告訊息）例外——那是本專案
  自己設計的決策邏輯，vendor 沒有提供，可以依實測回饋調整門檻，但調整時不能影響 Pattern 預測本身（兩者分離）。
- 特殊禁區：`vendor/ac-nh-turnip-prices/` 是唯讀的原始碼快照（含 Apache-2.0 LICENSE/NOTICE），只能讀取比對
  （測試時用 `tests/helpers/loadVendorPredictor.ts` 動態載入），不可修改、不可被 `src/` 直接 import 執行。
- **GitHub Pages 部署是「legacy 靜態」模式**（master 分支根目錄直接服務，沒有 CI 建置流程），所以每次改動
  `src/web/` 或 `src/engine/` 之後，一定要 `npm.cmd run build` 重新產生 `app.js`／`app.js.map`，並把這兩個
  檔案一起 commit＋push，否則線上版本不會更新。部署帳號是 gh CLI 已登入的 `gxben0117-collab`（跟紅兵寫真旅拍
  引擎、JOSE 遊戲同一模式）。
- 開發順序：原則上照 [docs/專案規格書.md](docs/專案規格書.md) 第十六節的 Phase 1～8 推進；因應使用者家人已經
  在實機玩、需要盡快有能用的工具，Phase 2～7 在 2026-09-10 當次一起完成到「堪用的第一版」，細節見下方「目前狀態」。
- 測試優先：`tests/crossValidation.spec.ts` 是最重要的正確性保證——把同一組輸入同時餵給 vendor 原始碼與我們的
  TypeScript port，比對輸出是否一致。改動 `src/engine/patterns/` 或 `src/engine/predictor/` 之後一定要先跑
  `npm.cmd test` 確認交叉驗證仍然通過，才能算改動正確。

## 目前狀態與下一步

- 2026-09-10：Phase 1（演算法研究）～Phase 7（趨勢圖＋手機 UI）一次做到「堪用的第一版」並上線：
  - `src/engine/` 完整移植四種 Pattern、轉移機率矩陣、貝氏排除法，20 項測試全過，含與 vendor 原始碼的
    逐案例交叉驗證（`tests/crossValidation.spec.ts`）。
  - 新增 `src/engine/sellStrategy/`：記帳（買價×數量，`ledger.ts`）、目前價格判定（`currentPrice.ts`）、
    出售建議 🟢🟡🟠🔴（`advice.ts`，四種風險偏好）、警告訊息（`warnings.ts`）——這層是本專案自己設計的，
    不是 vendor 移植，門檻可依之後的實測回饋調整。
  - 新增 `src/web/`：純 TypeScript 手機優先 UI，即時重新計算、localStorage 持久化、清除資料二次確認、
    SVG 趨勢圖（區分實際價格／高機率範圍／理論可能範圍／購入價基準線）。用 Playwright 實際開瀏覽器驗證過
    （輸入 300 元的週三 AM 價格後，正確排除到只剩大漲型 100%，無 console 錯誤）。
  - 已部署 GitHub Pages（見 README「線上使用」的網址）。
- 尚未做（下次可以繼續）：
  - Phase 8「完整測試」的更廣覆蓋（目前 20 項測試涵蓋核心路徑，UI 互動本身沒有自動化測試，只有本次的
    一次性 Playwright 手動驗證）。
  - 出售建議（`sellStrategy/advice.ts`）的門檻是第一版合理猜測，還沒有實機資料驗證，之後可依家人實際玩的
    回饋調整 `RISK_THRESHOLDS`。
  - 十七、十八節提到的「輸入今天星期幾鎖定已過時段」「多筆購入記錄」等進階功能尚未做。
  - 目前只支援單一玩家、單一週的資料（無帳號、無雲端同步，符合十五節「第一階段不做」的範圍）。
