export interface ChartDayData {
  label: string;
  known: number | undefined;
  theoretical: { min: number; max: number } | undefined;
  highProbability: { min: number; max: number } | undefined;
}

export interface ChartParams {
  days: ChartDayData[]; // 固定 12 筆，週一AM ~ 週六PM
  buyPrice: number | undefined;
}

const WIDTH = 640;
const HEIGHT = 260;
const PADDING_LEFT = 44;
const PADDING_RIGHT = 12;
const PADDING_TOP = 16;
const PADDING_BOTTOM = 32;

/** 產生趨勢圖的 SVG 字串。純函式、不碰 DOM，方便之後要換成別的渲染方式也能重用。 */
export function renderChartSvg(params: ChartParams): string {
  const { days, buyPrice } = params;
  const plotWidth = WIDTH - PADDING_LEFT - PADDING_RIGHT;
  const plotHeight = HEIGHT - PADDING_TOP - PADDING_BOTTOM;

  const values: number[] = [];
  if (buyPrice !== undefined) values.push(buyPrice);
  for (const day of days) {
    if (day.known !== undefined) values.push(day.known);
    if (day.theoretical) values.push(day.theoretical.min, day.theoretical.max);
  }
  if (values.length === 0) values.push(0, 100);

  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const span = Math.max(1, rawMax - rawMin);
  const yMin = Math.max(0, rawMin - span * 0.1);
  const yMax = rawMax + span * 0.1;

  const xAt = (i: number): number => PADDING_LEFT + (plotWidth * i) / (days.length - 1 || 1);
  const yAt = (v: number): number => PADDING_TOP + plotHeight - ((v - yMin) / (yMax - yMin || 1)) * plotHeight;

  const parts: string[] = [];
  parts.push(
    `<svg viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="大頭菜價格趨勢圖" class="turnip-chart">`,
  );

  // 理論範圍（較淡的色塊）。
  const theoreticalTop = days.map((d, i) => `${xAt(i)},${yAt(d.theoretical?.max ?? d.known ?? yMin)}`);
  const theoreticalBottom = days
    .slice()
    .reverse()
    .map((d, i) => {
      const idx = days.length - 1 - i;
      return `${xAt(idx)},${yAt(d.theoretical?.min ?? d.known ?? yMin)}`;
    });
  parts.push(
    `<polygon points="${[...theoreticalTop, ...theoreticalBottom].join(" ")}" class="chart-theoretical-band" />`,
  );

  // 高機率範圍（較深的色塊）。
  const hpTop = days.map((d, i) => `${xAt(i)},${yAt(d.highProbability?.max ?? d.known ?? yMin)}`);
  const hpBottom = days
    .slice()
    .reverse()
    .map((d, i) => {
      const idx = days.length - 1 - i;
      return `${xAt(idx)},${yAt(d.highProbability?.min ?? d.known ?? yMin)}`;
    });
  parts.push(`<polygon points="${[...hpTop, ...hpBottom].join(" ")}" class="chart-highprob-band" />`);

  // 購入價基準線。
  if (buyPrice !== undefined) {
    const y = yAt(buyPrice);
    parts.push(
      `<line x1="${PADDING_LEFT}" y1="${y}" x2="${WIDTH - PADDING_RIGHT}" y2="${y}" class="chart-buyline" />`,
    );
    parts.push(`<text x="${WIDTH - PADDING_RIGHT}" y="${y - 4}" class="chart-buyline-label" text-anchor="end">購入價 ${Math.round(buyPrice)}</text>`);
  }

  // 已知實際價格：只在連續已知的區段畫實線，並在每個已知點畫圓點。
  let segment: string[] = [];
  const segments: string[][] = [];
  days.forEach((d, i) => {
    if (d.known !== undefined) {
      segment.push(`${xAt(i)},${yAt(d.known)}`);
    } else if (segment.length) {
      segments.push(segment);
      segment = [];
    }
  });
  if (segment.length) segments.push(segment);
  for (const seg of segments) {
    parts.push(`<polyline points="${seg.join(" ")}" class="chart-actual-line" />`);
  }
  days.forEach((d, i) => {
    if (d.known !== undefined) {
      parts.push(`<circle cx="${xAt(i)}" cy="${yAt(d.known)}" r="3.5" class="chart-actual-dot" />`);
    }
  });

  // X 軸標籤。
  days.forEach((d, i) => {
    parts.push(
      `<text x="${xAt(i)}" y="${HEIGHT - PADDING_BOTTOM + 16}" class="chart-x-label" text-anchor="middle">${d.label}</text>`,
    );
  });

  parts.push("</svg>");
  return parts.join("");
}
