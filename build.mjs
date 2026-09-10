// 把 src/web/main.ts（含它 import 的整個 src/engine）打包成單一瀏覽器可用的 app.js，
// 輸出到專案根目錄，讓 index.html 用 <script src="./app.js"> 直接載入。
// GitHub Pages 只服務靜態檔案，沒有建置流程，所以打包後的 app.js 要一起 commit 進 repo。
//
// 刻意用 format: "iife"（不是 "esm"）：使用者常會直接雙擊 index.html 用 file:// 協定開啟，
// 瀏覽器的 CORS 規則不允許 file:// 底下用 <script type="module"> 載入外部 .js（會被擋下、
// 整頁 JS 完全不會執行），IIFE 是一般 <script> 標籤，file:// 與 http(s):// 都能正常跑。
import { build } from "esbuild";

await build({
  entryPoints: ["src/web/main.ts"],
  bundle: true,
  outfile: "app.js",
  format: "iife",
  target: "es2020",
  minify: process.argv.includes("--minify"),
  sourcemap: true,
  logLevel: "info",
});
