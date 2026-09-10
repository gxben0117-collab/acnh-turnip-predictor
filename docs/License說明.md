# 授權說明

版本：V1.00　建立日期：2026-09-10

## 演算法來源

- 反編譯研究：Ninji（Treeki），《集合啦！動物森友會》大頭菜價格生成程式逆向工程。
- JavaScript 實作：Mike Bryant 與社群貢獻者，專案 [Turnip Prophet](https://github.com/mikebryant/ac-nh-turnip-prices)
  （網站 <https://turnipprophet.io/>）。
- 授權：**Apache License 2.0**。
- 原始碼快照存放於本專案 [../vendor/ac-nh-turnip-prices/](../vendor/ac-nh-turnip-prices/)，含 `LICENSE` 與 `NOTICE` 全文，
  抓取日期 2026-09-10（`master` 分支當時內容）。

## 我們的使用方式與義務

Apache-2.0 允許商用、修改、散布，條件是：

1. 保留原始 `LICENSE` 全文（已存放於 `vendor/ac-nh-turnip-prices/LICENSE`）。
2. 保留 `NOTICE` 檔內容（已存放於 `vendor/ac-nh-turnip-prices/NOTICE`，內容為「Originally developed by Mike Bryant,
   with great thanks to Ninji」＋原始專案連結）。
3. 若修改過原始檔案，需在修改處標註「本檔案已修改」。
4. 不得使用「Turnip Prophet」這個名稱替我們的網站背書或誤導使用者以為是同一個專案。

## 本專案的做法

- `vendor/ac-nh-turnip-prices/predictions.js`、`scripts.js` 是**未經修改**的原始檔，僅供 Phase 2 開發時逐函式比對、
  作為 TypeScript 移植的比對基準，**不會被匯入實際網站程式碼中執行**。
- 實際網站使用的 `src/engine/` 是依照 [演算法原始數據規格表.md](演算法原始數據規格表.md) 重新以 TypeScript 撰寫，
  邏輯上等價於 vendor 原始碼，但屬於本專案自己的程式碼。
- README 與本文件會清楚列出演算法來源、授權與致謝，不會宣稱演算法是本專案原創。
- 本網站不會使用「Turnip Prophet」名稱，也不會複製任天堂的美術素材、角色或商標。
