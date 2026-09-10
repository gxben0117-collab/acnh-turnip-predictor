/**
 * 精準浮點數加總（Kahan–Babuska / Neumaier 演算法）。
 *
 * 移植自 vendor/ac-nh-turnip-prices/predictions.js 的 float_sum() / prefix_float_sum()。
 * 原始演算法用這個方法避免大量浮點數相加時的誤差累積，這裡逐行照抄，
 * 不可用簡單的 `array.reduce((a,b)=>a+b, 0)` 取代，否則長序列加總會產生
 * 與原始遊戲/vendor 引擎不一致的機率誤差。
 *
 * 參考：https://en.wikipedia.org/wiki/Kahan_summation_algorithm#Further_enhancements
 */
export function floatSum(input: readonly number[]): number {
  let sum = 0;
  // sum 遺失的誤差量
  let c = 0;
  for (let i = 0; i < input.length; i++) {
    const cur = input[i]!;
    const t = sum + cur;
    if (Math.abs(sum) >= Math.abs(cur)) {
      c += sum - t + cur;
    } else {
      c += cur - t + sum;
    }
    sum = t;
  }
  return sum + c;
}

/**
 * 精準浮點數前綴和。
 *
 * output[i] = [前 i 個數字的和, 該和的誤差量]。
 * 「真正」的前綴和等於這一對數字相加，但刻意拆成兩個數字回傳，
 * 避免相減前綴和時把誤差部分弄丟。
 */
export function prefixFloatSum(input: readonly number[]): Array<[number, number]> {
  const prefixSum: Array<[number, number]> = [[0, 0]];
  let sum = 0;
  let c = 0;
  for (let i = 0; i < input.length; i++) {
    const cur = input[i]!;
    const t = sum + cur;
    if (Math.abs(sum) >= Math.abs(cur)) {
      c += sum - t + cur;
    } else {
      c += cur - t + sum;
    }
    sum = t;
    prefixSum.push([sum, c]);
  }
  return prefixSum;
}
