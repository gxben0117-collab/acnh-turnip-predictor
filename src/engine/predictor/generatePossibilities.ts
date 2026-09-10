import { TurnipPattern, type WeekPriceArray } from "../data/types.js";
import { generatePattern0 } from "../patterns/pattern0.js";
import { generatePattern1 } from "../patterns/pattern1.js";
import { generatePattern2 } from "../patterns/pattern2.js";
import { generatePattern3 } from "../patterns/pattern3.js";
import { multiplyGeneratorProbability, type RawPossibility } from "../patterns/shared.js";
import { getTransitionProbability } from "./constants.js";
import type { GenerationContext } from "./priceGenerators.js";

const PATTERN_GENERATORS = [generatePattern0, generatePattern1, generatePattern2, generatePattern3] as const;

/** 把四種 Pattern 的生成器依轉移機率矩陣加權後合併成一串候選路徑。 */
export function* generateAllPatterns(
  ctx: GenerationContext,
  sellPrices: WeekPriceArray,
  previousPattern: TurnipPattern | undefined,
): Generator<RawPossibility> {
  const transitionProbability = getTransitionProbability(previousPattern);

  for (let i = 0; i < 4; i++) {
    yield* multiplyGeneratorProbability(PATTERN_GENERATORS[i]!(ctx, sellPrices), transitionProbability[i]!);
  }
}

/**
 * 產生所有候選路徑。
 *
 * - 若週日購入價未知（NaN）或 firstBuy 為真，會把購入價 90～110（21 種等機率）都各自展開一次。
 * - firstBuy 為真時（玩家在該座島有史以來第一次買大頭菜），只會枚舉 Pattern 3（小漲型），
 *   不套用轉移機率矩陣——這是 vendor 原始碼寫死的行為，見
 *   docs/演算法原始數據規格表.md 第 4 節。
 */
export function* generatePossibilities(
  ctx: GenerationContext,
  sellPrices: WeekPriceArray,
  firstBuy: boolean,
  previousPattern: TurnipPattern | undefined,
): Generator<RawPossibility> {
  if (firstBuy || Number.isNaN(sellPrices[0])) {
    for (let buyPrice = 90; buyPrice <= 110; buyPrice++) {
      const tempSellPrices = sellPrices.slice();
      tempSellPrices[0] = buyPrice;
      tempSellPrices[1] = buyPrice;
      if (firstBuy) {
        yield* generatePattern3(ctx, tempSellPrices);
      } else {
        // 所有購入價機率相同，且已經處在最外層，不需要再乘一次機率權重。
        yield* generateAllPatterns(ctx, tempSellPrices, previousPattern);
      }
    }
  } else {
    yield* generateAllPatterns(ctx, sellPrices, previousPattern);
  }
}
