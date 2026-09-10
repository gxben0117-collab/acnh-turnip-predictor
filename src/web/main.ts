import {
  DAY_SLOT_KEYS,
  DaySlotIndex,
  TurnipPattern,
  type DaySlotKey,
  type PatternPossibility,
} from "../engine/data/types.js";
import { buildWeekPriceArray, predictTurnipPrices, summarizePatternProbabilities } from "../engine/predictor/publicApi.js";
import { computeDayRangeStats } from "../engine/probability/priceRangeStats.js";
import { computeSellAdvice, type SellAdvice, type SellAdviceLevel } from "../engine/sellStrategy/advice.js";
import { summarizeLedger } from "../engine/sellStrategy/ledger.js";
import { computeWarnings } from "../engine/sellStrategy/warnings.js";
import { renderChartSvg } from "./chart.js";
import { formatBells, formatPercent, formatPriceRange, formatProbabilityPercent } from "./format.js";
import { clearState, loadState, saveState, type AppState } from "./storage.js";

const DAY_LABELS_FULL: Record<DaySlotKey, string> = {
  monAM: "週一 AM",
  monPM: "週一 PM",
  tueAM: "週二 AM",
  tuePM: "週二 PM",
  wedAM: "週三 AM",
  wedPM: "週三 PM",
  thuAM: "週四 AM",
  thuPM: "週四 PM",
  friAM: "週五 AM",
  friPM: "週五 PM",
  satAM: "週六 AM",
  satPM: "週六 PM",
};

const DAY_LABELS_COMPACT: Record<DaySlotKey, string> = {
  monAM: "一AM",
  monPM: "一PM",
  tueAM: "二AM",
  tuePM: "二PM",
  wedAM: "三AM",
  wedPM: "三PM",
  thuAM: "四AM",
  thuPM: "四PM",
  friAM: "五AM",
  friPM: "五PM",
  satAM: "六AM",
  satPM: "六PM",
};

const PATTERN_META: Record<TurnipPattern, { emoji: string; label: string }> = {
  [TurnipPattern.LargeSpike]: { emoji: "🔥", label: "大漲型" },
  [TurnipPattern.SmallSpike]: { emoji: "📈", label: "小漲型" },
  [TurnipPattern.Fluctuating]: { emoji: "〰️", label: "波動型" },
  [TurnipPattern.Decreasing]: { emoji: "📉", label: "遞減型" },
};

const VERDICT_META: Record<SellAdviceLevel, { emoji: string; title: string; className: string }> = {
  hold: { emoji: "🟢", title: "繼續持有", className: "verdict-hold" },
  canSell: { emoji: "🟡", title: "可以出售", className: "verdict-canSell" },
  shouldSell: { emoji: "🟠", title: "建議出售", className: "verdict-shouldSell" },
  stronglySell: { emoji: "🔴", title: "強烈建議出售", className: "verdict-stronglySell" },
};

function el<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing element #${id}`);
  return found as T;
}

const buyPriceInput = el<HTMLInputElement>("buy-price");
const quantityInput = el<HTMLInputElement>("quantity");
const previousPatternSelect = el<HTMLSelectElement>("previous-pattern");
const riskProfileSelect = el<HTMLSelectElement>("risk-profile");
const dayGrid = el<HTMLDivElement>("day-grid");
const verdictCard = el<HTMLDivElement>("verdict-card");
const warningsContainer = el<HTMLDivElement>("warnings");
const patternProbabilitiesContainer = el<HTMLDivElement>("pattern-probabilities");
const highlightCard = el<HTMLDivElement>("highlight-card");
const watchWindowEl = el<HTMLDivElement>("watch-window");
const weekMaxRangeEl = el<HTMLDivElement>("week-max-range");
const strategyCard = el<HTMLDivElement>("strategy-card");
const strategyList = el<HTMLDivElement>("strategy-list");
const chartContainer = el<HTMLDivElement>("chart-container");
const clearButton = el<HTMLButtonElement>("clear-button");

let state: AppState = loadState();

const dayInputs = new Map<DaySlotKey, HTMLInputElement>();

function buildDayGrid(): void {
  dayGrid.innerHTML = "";
  for (const key of DAY_SLOT_KEYS) {
    const cell = document.createElement("div");
    cell.className = "day-cell";

    const label = document.createElement("div");
    label.className = "day-cell-label";
    label.textContent = DAY_LABELS_FULL[key];
    cell.appendChild(label);

    const input = document.createElement("input");
    input.type = "number";
    input.inputMode = "numeric";
    input.min = "0";
    input.placeholder = "尚未發生";
    input.id = `day-${key}`;
    input.addEventListener("input", () => {
      const value = input.value.trim();
      if (value === "") {
        delete state.dayPrices[key];
      } else {
        state.dayPrices[key] = Number(value);
      }
      persistAndRecompute();
    });

    dayInputs.set(key, input);
    cell.appendChild(input);
    dayGrid.appendChild(cell);
  }
}

function applyStateToForm(): void {
  buyPriceInput.value = state.buyPrice === undefined ? "" : String(state.buyPrice);
  quantityInput.value = state.quantity === undefined ? "" : String(state.quantity);
  previousPatternSelect.value = state.previousPattern === undefined ? "" : String(state.previousPattern);
  riskProfileSelect.value = state.riskProfile;
  for (const key of DAY_SLOT_KEYS) {
    const input = dayInputs.get(key)!;
    const value = state.dayPrices[key];
    input.value = value === undefined ? "" : String(value);
  }
}

function persistAndRecompute(): void {
  saveState(state);
  recompute();
}

function renderPatternProbabilities(totals: Record<TurnipPattern, number> | undefined): void {
  patternProbabilitiesContainer.innerHTML = "";
  if (!totals) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "尚無資料。";
    patternProbabilitiesContainer.appendChild(p);
    return;
  }

  const ordered = [TurnipPattern.LargeSpike, TurnipPattern.SmallSpike, TurnipPattern.Fluctuating, TurnipPattern.Decreasing];
  for (const pattern of ordered) {
    const meta = PATTERN_META[pattern];
    const percent = totals[pattern] ?? 0;

    const row = document.createElement("div");
    row.className = "pattern-row";

    const labelEl = document.createElement("div");
    labelEl.textContent = `${meta.emoji} ${meta.label}`;

    const track = document.createElement("div");
    track.className = "pattern-bar-track";
    const fill = document.createElement("div");
    fill.className = "pattern-bar-fill";
    fill.style.width = `${Math.round(percent * 100)}%`;
    track.appendChild(fill);

    const percentEl = document.createElement("div");
    percentEl.className = "pattern-percent";
    percentEl.textContent = `${Math.round(percent * 100)}%`;

    row.appendChild(labelEl);
    row.appendChild(track);
    row.appendChild(percentEl);
    patternProbabilitiesContainer.appendChild(row);
  }
}

function renderVerdict(advice: SellAdvice | undefined): void {
  verdictCard.className = "card verdict-card";
  verdictCard.innerHTML = "";

  if (!advice) {
    verdictCard.classList.remove(...Object.values(VERDICT_META).map((m) => m.className));
    const p = document.createElement("p");
    p.className = "verdict-placeholder";
    p.textContent = "先在下方輸入本週購入價，才能開始分析。";
    verdictCard.appendChild(p);
    return;
  }

  const meta = VERDICT_META[advice.level];
  verdictCard.classList.add(meta.className);

  const emoji = document.createElement("span");
  emoji.className = "verdict-emoji";
  emoji.textContent = meta.emoji;

  const title = document.createElement("p");
  title.className = "verdict-title";
  title.textContent = meta.title;

  const detail = document.createElement("p");
  detail.className = "verdict-detail";
  if (advice.isLastChance) {
    detail.textContent = `目前價格 ${formatBells(advice.currentPrice)}，本週已經是最後機會，大頭菜過週會腐爛。`;
  } else {
    detail.textContent = `目前價格 ${formatBells(advice.currentPrice)}，未來還有更高價格的機率約 ${formatProbabilityPercent(
      advice.upsideProbability,
    )}`;
  }

  verdictCard.appendChild(emoji);
  verdictCard.appendChild(title);
  verdictCard.appendChild(detail);
}

function renderWarnings(warnings: ReturnType<typeof computeWarnings>): void {
  warningsContainer.innerHTML = "";
  if (warnings.length === 0) {
    warningsContainer.hidden = true;
    return;
  }
  warningsContainer.hidden = false;
  for (const warning of warnings) {
    const item = document.createElement("div");
    item.className = "warning-item";
    item.textContent = `${warning.emoji} ${warning.message}`;
    warningsContainer.appendChild(item);
  }
}

function findWatchWindow(
  candidates: PatternPossibility[],
  futureStart: number,
): { startIndex: number; endIndex: number } | undefined {
  if (futureStart > DaySlotIndex.SatPM) return undefined;

  let bestDay = futureStart;
  let bestScore = -Infinity;
  for (let day = futureStart; day <= DaySlotIndex.SatPM; day++) {
    const stats = computeDayRangeStats(candidates, day);
    const score = stats.theoretical.max;
    if (score > bestScore) {
      bestScore = score;
      bestDay = day;
    }
  }
  const startIndex = Math.max(futureStart, bestDay - 1);
  const endIndex = Math.min(DaySlotIndex.SatPM, bestDay + 1);
  return { startIndex, endIndex };
}

function renderHighlights(candidates: PatternPossibility[], advice: SellAdvice, aggregate: PatternPossibility | undefined): void {
  const futureStart = Math.max(advice.currentDayIndex + 1, DaySlotIndex.MonAM);
  const window = advice.isLastChance ? undefined : findWatchWindow(candidates, futureStart);

  if (!window) {
    highlightCard.hidden = true;
    return;
  }
  highlightCard.hidden = false;

  const startKey = DAY_SLOT_KEYS[window.startIndex - DaySlotIndex.MonAM]!;
  const endKey = DAY_SLOT_KEYS[window.endIndex - DaySlotIndex.MonAM]!;
  watchWindowEl.textContent =
    window.startIndex === window.endIndex
      ? DAY_LABELS_FULL[startKey]
      : `${DAY_LABELS_FULL[startKey]} ～ ${DAY_LABELS_FULL[endKey]}`;

  let maxHighProbability = 0;
  for (let day = futureStart; day <= DaySlotIndex.SatPM; day++) {
    const stats = computeDayRangeStats(candidates, day);
    maxHighProbability = Math.max(maxHighProbability, stats.highProbability.max);
  }
  const theoreticalMax = aggregate?.weekMax ?? maxHighProbability;
  weekMaxRangeEl.textContent = formatPriceRange(maxHighProbability, theoreticalMax);
}

function renderStrategy(advice: SellAdvice): void {
  strategyCard.hidden = false;
  strategyList.innerHTML = "";

  const rows: Array<[string, string]> = [["目前價格", formatBells(advice.currentPrice)]];

  if (state.buyPrice !== undefined) {
    const quantity = state.quantity ?? 0;
    if (quantity > 0) {
      const ledger = summarizeLedger({ buyPrice: state.buyPrice, quantity }, advice.currentPrice);
      rows.push(["購入價格", formatBells(ledger.buyPrice)]);
      rows.push(["購入數量", `${ledger.quantity} 顆`]);
      rows.push(["總成本", formatBells(ledger.totalCost)]);
      rows.push(["目前損益", `${formatBells(ledger.profit)}（${formatPercent(ledger.profitPercent)}）`]);
    } else {
      const profitPercent = (advice.currentPrice - state.buyPrice) / state.buyPrice;
      rows.push(["購入價格", formatBells(state.buyPrice)]);
      rows.push(["目前損益（每顆）", formatPercent(profitPercent)]);
    }
  }

  rows.push(["未來期望高價", formatBells(advice.expectedFutureMax)]);
  rows.push(["理論最高可能", formatBells(advice.theoreticalFutureMax)]);

  for (const [term, value] of rows) {
    const dt = document.createElement("dt");
    dt.textContent = term;
    const dd = document.createElement("dd");
    dd.textContent = value;
    strategyList.appendChild(dt);
    strategyList.appendChild(dd);
  }
}

function renderChart(candidates: PatternPossibility[], aggregate: PatternPossibility | undefined): void {
  const days = DAY_SLOT_KEYS.map((key, i) => {
    const dayIndex = i + DaySlotIndex.MonAM;
    const known = state.dayPrices[key];
    const stats = computeDayRangeStats(candidates, dayIndex);
    return {
      label: DAY_LABELS_COMPACT[key],
      known,
      theoretical: known === undefined ? stats.theoretical : undefined,
      highProbability: known === undefined ? stats.highProbability : undefined,
    };
  });
  void aggregate;

  chartContainer.innerHTML = renderChartSvg({ days, buyPrice: state.buyPrice });
}

function recompute(): void {
  if (state.buyPrice === undefined || Number.isNaN(state.buyPrice) || state.buyPrice <= 0) {
    renderVerdict(undefined);
    renderPatternProbabilities(undefined);
    highlightCard.hidden = true;
    strategyCard.hidden = true;
    renderWarnings([]);
    chartContainer.innerHTML = '<p class="muted">輸入購入價後會顯示圖表。</p>';
    return;
  }

  const result = predictTurnipPrices({
    buyPrice: state.buyPrice,
    previousPattern: state.previousPattern,
    prices: state.dayPrices,
  });
  const candidates = result.filter((p): p is PatternPossibility & { patternNumber: TurnipPattern } => p.patternNumber !== 4);
  const aggregate = result.find((p) => p.patternNumber === 4);
  const totals = summarizePatternProbabilities(result);

  const weekPrices = buildWeekPriceArray(state.buyPrice, state.dayPrices);
  const advice = computeSellAdvice(result, weekPrices, state.riskProfile);

  renderPatternProbabilities(totals);
  renderVerdict(advice);

  if (advice) {
    renderHighlights(candidates, advice, aggregate);
    renderStrategy(advice);

    const futureStart = Math.max(advice.currentDayIndex + 1, DaySlotIndex.MonAM);
    const nextDayRangeStats = advice.isLastChance || futureStart > DaySlotIndex.SatPM ? undefined : computeDayRangeStats(candidates, futureStart);
    const warnings = computeWarnings({
      patternProbabilities: totals,
      advice,
      nextDayRangeStats,
      weekTheoreticalMax: aggregate?.weekMax,
    });
    renderWarnings(warnings);
  } else {
    highlightCard.hidden = true;
    strategyCard.hidden = true;
    renderWarnings([]);
  }

  renderChart(candidates, aggregate);
}

function wireEvents(): void {
  buyPriceInput.addEventListener("input", () => {
    const value = buyPriceInput.value.trim();
    state.buyPrice = value === "" ? undefined : Number(value);
    persistAndRecompute();
  });

  quantityInput.addEventListener("input", () => {
    const value = quantityInput.value.trim();
    state.quantity = value === "" ? undefined : Number(value);
    persistAndRecompute();
  });

  previousPatternSelect.addEventListener("change", () => {
    const value = previousPatternSelect.value;
    state.previousPattern = value === "" ? undefined : (Number(value) as 0 | 1 | 2 | 3);
    persistAndRecompute();
  });

  riskProfileSelect.addEventListener("change", () => {
    state.riskProfile = riskProfileSelect.value as AppState["riskProfile"];
    persistAndRecompute();
  });

  clearButton.addEventListener("click", () => {
    const confirmed = window.confirm("確定要清除本週所有已輸入的價格資料嗎？這個動作無法復原。");
    if (!confirmed) return;
    state = clearState();
    applyStateToForm();
    recompute();
  });
}

function init(): void {
  buildDayGrid();
  applyStateToForm();
  wireEvents();
  recompute();
}

init();
