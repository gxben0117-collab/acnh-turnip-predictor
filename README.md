# 動物森友會－大頭菜價格預測器

版本：V1.00　建立日期：2026-09-10

## 目標

輸入每週大頭菜的購入價與已觀察到的價格，用《集合啦！動物森友會》真實的大頭菜價格生成演算法（而非簡單的漲跌規則）
反推目前仍可能成立的價格型態，預測未來時段的價格範圍，並給出「現在該不該賣」的明確建議。第一版不接 AI、不接
付費 API，純演算法計算。

完整需求見 [docs/專案規格書.md](docs/專案規格書.md)；演算法細節與公式見
[docs/演算法原始數據規格表.md](docs/演算法原始數據規格表.md)；授權與致謝見 [docs/License說明.md](docs/License說明.md)。

## 使用方式

第一版完成前：專案仍在 Phase 1（演算法研究）之後、Phase 2（TypeScript engine 開發）之前，尚無可執行的網頁。
之後入口固定為 `index.html`（或 React 建置後的產物），啟動方式待 Phase 2～8 完成後在此補上。

## 結構

```text
/docs                          需求規格、演算法規格表、授權說明、開發日誌
/vendor/ac-nh-turnip-prices    Turnip Prophet 原始碼快照（Apache-2.0），僅供比對，不參與實際網站執行
/src
  /engine
    /patterns                  四種 Pattern 的價格生成/反推邏輯（依演算法規格表撰寫）
    /predictor                 依已知價格排除不可能路徑、彙整候選路徑
    /probability                Pattern 機率、價格區間統計
    /sellStrategy               出售建議（保守/平衡/冒險）
  /components                  UI 元件（僅負責顯示，不寫演算法邏輯）
  /data                        型別定義、常數
/tests                         單元測試，含與 Turnip Prophet 官網的交叉驗證案例
```

上列 `src/`、`tests/` 目前只有目錄骨架，實際程式碼從 Phase 2 開始撰寫。

## 演算法來源與授權

- 反編譯研究：Ninji（Treeki）。
- JavaScript 實作：Mike Bryant 與社群，[Turnip Prophet](https://github.com/mikebryant/ac-nh-turnip-prices)
  （Apache License 2.0）。
- 本專案的預測引擎是依據該專案演算法邏輯，用 TypeScript 重新撰寫（非直接引用其程式碼執行），細節見
  [docs/License說明.md](docs/License說明.md)。

## 開發紀錄

見 [docs/development-log/](docs/development-log/)。
