# 動物森友會－大頭菜價格預測器

版本：v0.02　更新日期：2026-09-10

## 目標

輸入每週大頭菜的購入價與已觀察到的價格，用《集合啦！動物森友會》真實的大頭菜價格生成演算法（而非簡單的漲跌規則）
反推目前仍可能成立的價格型態，預測未來時段的價格範圍，並給出「現在該不該賣」的明確建議。第一版不接 AI、不接
付費 API，純演算法計算。

完整需求見 [docs/專案規格書.md](docs/專案規格書.md)；演算法細節與公式見
[docs/演算法原始數據規格表.md](docs/演算法原始數據規格表.md)；授權與致謝見 [docs/License說明.md](docs/License說明.md)。

## 線上使用

<https://gxben0117-collab.github.io/acnh-turnip-predictor/>

GitHub Pages 從 `master` 分支根目錄直接服務靜態檔案（legacy 模式，無 CI 建置），所以每次改動
`src/web/` 或 `src/engine/` 之後要記得 `npm.cmd run build` 產生新的 `app.js`，再 commit＋push。

## 本機開發

```bash
npm.cmd install        # 安裝依賴（PowerShell 下用 npm.cmd，見 Vault 環境陷阱）
npm.cmd test            # 跑自動化測試（含與 vendor 原始碼的交叉驗證）
npm.cmd run typecheck   # TypeScript 型別檢查
npm.cmd run build       # 用 esbuild 把 src/web 打包成根目錄的 app.js
npm.cmd run serve       # 本機起一個靜態伺服器，開 http://localhost:5173 預覽
```

`index.html` 是正式入口，直接載入打包好的 `./app.js`（純靜態檔案，GitHub Pages 不需要建置流程，
所以 `app.js`／`app.js.map` 打包後要一起 commit 進 repo，每次改 `src/web` 或 `src/engine` 都要重新
`npm.cmd run build` 再 commit）。

## 結構

```text
/index.html                    正式入口（純靜態頁面）
/style.css                     頁面樣式
/app.js, app.js.map            npm run build 產出的打包檔（commit 進 repo，GitHub Pages 直接讀）
/build.mjs                     esbuild 打包腳本
/docs                          需求規格、演算法規格表、授權說明、開發日誌
/vendor/ac-nh-turnip-prices    Turnip Prophet 原始碼快照（Apache-2.0），僅供測試時交叉驗證比對，不參與網站執行
/src
  /engine                      預測核心，與 UI 完全分離，可單獨測試
    /data                      型別定義、常數（Pattern 編號、14 格價位陣列等）
    /probability                Kahan 加總、區間運算、PDF 機率密度、理論/高機率範圍統計
    /patterns                   四種 Pattern 的價格生成/反推邏輯（依演算法規格表撰寫）
    /predictor                  轉移機率矩陣、依已知價格排除不可能路徑、彙整候選路徑
    /sellStrategy                目前價格判定、記帳（買價×數量）、出售建議、警告訊息
  /web                          瀏覽器端 UI（DOM 操作、圖表、localStorage），只呼叫 engine，不寫演算法邏輯
/tests                          單元測試 + 與 vendor 原始碼的交叉驗證測試
```

## 演算法來源與授權

- 反編譯研究：Ninji（Treeki）。
- JavaScript 實作：Mike Bryant 與社群，[Turnip Prophet](https://github.com/mikebryant/ac-nh-turnip-prices)
  （Apache License 2.0）。
- 本專案的預測引擎是依據該專案演算法邏輯，用 TypeScript 重新撰寫（非直接引用其程式碼執行），細節見
  [docs/License說明.md](docs/License說明.md)。
- `src/engine/sellStrategy/`（出售建議等級、警告訊息）是本專案自己設計的決策邏輯，**不是**從 vendor 移植——
  vendor 原始碼只提供 Pattern 機率與價格區間，沒有「該不該賣」的建議演算法，詳見該資料夾內程式碼開頭的說明。

## 測試

```bash
npm.cmd test
```

含三類測試：

- `tests/crossValidation.spec.ts`：把同一組輸入分別餵給 vendor 原始 `predictions.js` 與本專案 TypeScript
  移植版，比對兩邊算出的 Pattern 機率與價格區間是否一致。
- `tests/patternShapes.spec.ts`：驗證每種 Pattern 的「形狀」符合演算法規格表（遞減型單調遞減、小漲型帽子形、
  排除邏輯、轉移機率矩陣穩態分布）。
- `tests/sellStrategy.spec.ts`：記帳（買價×數量）、目前價格判定、出售建議等級、高機率範圍統計。

## 開發紀錄

見 [docs/development-log/](docs/development-log/)。
