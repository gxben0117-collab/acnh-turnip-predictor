import { floatSum, prefixFloatSum } from "./floatSum.js";
import { rangeIntersectLength, rangeLength, type NumRange } from "./rangeMath.js";

/**
 * 倍率 (rate) 的機率密度函式，離散近似版。
 *
 * 移植自 vendor/ac-nh-turnip-prices/predictions.js 的 `class PDF`。
 * 因為真實的機率密度是連續的，這裡用「區間 [x, x+1) 內均勻分布」的離散機率
 * `prob[x - value_start]` 去逼近它。所有倍率都在 (* RATE_MULTIPLIER) 的整數尺度下運算。
 *
 * 這個類別是「遞減型」與「大漲型高峰前遞減段」計算價格區間與機率密度的核心，
 * 不可簡化成單純的線性插值，否則遞減段的機率分布會與原始演算法不一致。
 */
export class PDF {
  valueStart: number;
  valueEnd: number;
  prob: number[];

  /**
   * 建立一個定義域在 [a, b] 的 PDF，a、b 可以不是整數。
   * uniform 為 true 時初始化成均勻分布，否則初始化成全零（無效）分布。
   */
  constructor(a: number, b: number, uniform = true) {
    // 需確保 [a, b] 完全被包含在 [value_start, value_end] 內。
    this.valueStart = Math.floor(a);
    this.valueEnd = Math.ceil(b);
    const range: NumRange = [a, b];
    const totalLength = rangeLength(range);
    this.prob = new Array(this.valueEnd - this.valueStart).fill(0);
    if (uniform) {
      for (let i = 0; i < this.prob.length; i++) {
        this.prob[i] = rangeIntersectLength(this.rangeOf(i), range) / totalLength;
      }
    }
  }

  /** 計算 this.prob[idx] 代表的區間。 */
  rangeOf(idx: number): [number, number] {
    // 刻意把區間右端點也含進去：取到剛好端點的機率是零，
    // 所以可以假設這些「機率區間」是首尾相接的。
    return [this.valueStart + idx, this.valueStart + idx + 1];
  }

  minValue(): number {
    return this.valueStart;
  }

  maxValue(): number {
    return this.valueEnd;
  }

  /** @returns 正規化之前的機率總和。 */
  normalize(): number {
    const totalProbability = floatSum(this.prob);
    for (let i = 0; i < this.prob.length; i++) {
      this.prob[i]! /= totalProbability;
    }
    return totalProbability;
  }

  /**
   * 把值限制在 range 範圍內，並回傳「值原本就落在這個範圍內」的機率。
   */
  rangeLimit(range: NumRange): number {
    let [start, end] = range;
    start = Math.max(start, this.minValue());
    end = Math.min(end, this.maxValue());
    if (start >= end) {
      // 設成無效值。
      this.valueStart = this.valueEnd = 0;
      this.prob = [];
      return 0;
    }
    start = Math.floor(start);
    end = Math.ceil(end);

    const startIdx = start - this.valueStart;
    const endIdx = end - this.valueStart;
    for (let i = startIdx; i < endIdx; i++) {
      this.prob[i]! *= rangeIntersectLength(this.rangeOf(i), range);
    }

    this.prob = this.prob.slice(startIdx, endIdx);
    this.valueStart = start;
    this.valueEnd = end;

    // 「值落在這個範圍內」的機率，等於這個範圍內「未正規化」數值的總和。
    return this.normalize();
  }

  /**
   * 用一個 [rateDecayMin, rateDecayMax] 範圍內的均勻分布去對這個 PDF 做「減法卷積」。
   *
   * 為了簡化計算，假設 rateDecayMin 與 rateDecayMax 都是整數。
   */
  decay(rateDecayMin: number, rateDecayMax: number): void {
    // 如果參數不是整數，四捨五入成整數。
    rateDecayMin = Math.round(rateDecayMin);
    rateDecayMax = Math.round(rateDecayMax);

    // 取得這個分布的前綴和 / CDF，讓區間和可以在 O(1) 內算出來。
    const prefix = prefixFloatSum(this.prob);
    const maxX = this.prob.length;
    const maxY = rateDecayMax - rateDecayMin;
    const newProb = new Array<number>(this.prob.length + maxY);
    for (let i = 0; i < newProb.length; i++) {
      // 這裡的 left、right 都是「包含」端點。
      const left = Math.max(0, i - maxY);
      const right = Math.min(maxX - 1, i);
      const numbersToSum = [
        prefix[right + 1]![0],
        prefix[right + 1]![1],
        -prefix[left]![0],
        -prefix[left]![1],
      ];
      if (left === i - maxY) {
        // 需要把左端點減半。
        numbersToSum.push(-this.prob[left]! / 2);
      }
      if (right === i) {
        // 需要把右端點減半。
        // 這裡保證不會意外被「減半兩次」，因為那需要 i-maxY = i，也就是 maxY = 0，這是不可能的。
        numbersToSum.push(-this.prob[right]! / 2);
      }
      newProb[i] = floatSum(numbersToSum) / maxY;
    }

    this.prob = newProb;
    this.valueStart -= rateDecayMax;
    this.valueEnd -= rateDecayMin;
    // 不需要正規化，因為 this.prob 的總和保證是 1。
  }
}
