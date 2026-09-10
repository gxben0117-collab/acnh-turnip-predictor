// 把 src/web/main.ts（含它 import 的整個 src/engine）打包成單一瀏覽器可用的 app.js，
// 輸出到專案根目錄，讓 index.html 用 <script type="module" src="./app.js"> 直接載入。
// GitHub Pages 只服務靜態檔案，沒有建置流程，所以打包後的 app.js 要一起 commit 進 repo。
import { build } from "esbuild";

await build({
  entryPoints: ["src/web/main.ts"],
  bundle: true,
  outfile: "app.js",
  format: "esm",
  target: "es2020",
  minify: process.argv.includes("--minify"),
  sourcemap: true,
  logLevel: "info",
});
