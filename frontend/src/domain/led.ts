import type { Product, Item } from './model.ts';
export type PanelPlan = {
  widthMm: number;
  heightMm: number;
  rows: number;
  columns: number;
  long: number;
  half: number;
  panels: number;
  midCables: number;
  dataFeeds: number;
  powerFeeds: number | null;
  columnWidths: number[];
  surface: boolean;
  powerChain: number | null;
};
export function panelPlan(
  width: number,
  height: number,
  _pw = 500,
  _ph = 500,
  surface = false,
  surfacePowerChain: number | null = null,
): PanelPlan {
  if (![width, height].every((x) => Number.isFinite(x) && x > 0 && x <= 100000))
    throw Error('Anna positiiviset, enintään 100 m mitat.');
  if (
    surfacePowerChain !== null &&
    (!Number.isSafeInteger(surfacePowerChain) || surfacePowerChain < 1)
  )
    throw Error('Virtaketjun rajan pitää olla positiivinen kokonaisluku.');
  const rows = Math.ceil(height / (surface ? 250 : 500)),
    halfColumns = Math.ceil(width / 500);
  const columnWidths: number[] = surface
    ? [...Array(Math.floor(halfColumns / 2)).fill(1000), ...(halfColumns % 2 ? [500] : [])]
    : Array(halfColumns).fill(500);
  const columns = columnWidths.length,
    long = (surface ? Math.floor(halfColumns / 2) : columns) * rows,
    half = surface ? (halfColumns % 2) * rows : 0,
    panels = long + half;
  return {
    widthMm: halfColumns * 500,
    heightMm: rows * (surface ? 250 : 500),
    rows,
    columns,
    columnWidths,
    long,
    half,
    panels,
    surface,
    midCables: Math.ceil((panels + 3) / 10) * 10,
    dataFeeds: surface ? columns * Math.ceil(rows / 8) : rows,
    powerFeeds: surface
      ? surfacePowerChain === null
        ? null
        : columns * Math.ceil(rows / surfacePowerChain)
      : rows * Math.ceil(columns / 20),
    powerChain: surface ? surfacePowerChain : 20,
  };
}
export function panelKind(p?: Product): 'standard' | 'long' | 'half' | null {
  if (!p) return null;
  if (p.retired || p.category.trim().toLowerCase() !== 'led') return null;
  const text = `${p.name} ${p.dimensions}`.toLowerCase().replace(/\s/g, '').replace(/×/g, 'x');
  if (/left|right/.test(text)) return null;
  if (/1000x250|100x25/.test(text)) return 'long';
  if (/500x250|50x25/.test(text)) return 'half';
  return /pinta/.test(text) ? null : 'standard';
}
export const legacyLedIds = {
  dataMid: '-OJXJ6E56XO1N5XUquNG',
  powerMid: '-OJXJSDQchN5n01ZW5RL',
  dataFeed: '-OKfXOBW5_CLfuLx0O2-',
  powerFeed: '-OKfXHHe0pahKrU5EbpH',
  shortPole: '-OKfTdGlfsaN-R3xt9FJ',
  longPole: '-OKfT8_SHYGM9P0KUCyg',
  plate: '-OKeRz8GnpD7sk5iBTpq',
  feet: '-OPjmirEW4lMeqVC7zqW',
};
export function mounting(plan: PanelPlan, type: string, startMm: number) {
  if (!Number.isFinite(startMm) || startMm < 0 || startMm > 100000)
    throw Error('Tarkista lähtökorkeus.');
  const positions = Math.ceil(plan.widthMm / 1000),
    short = plan.heightMm + startMm <= 3500;
  return {
    shortPoles: type === 'legs' && short ? positions * 2 : 0,
    longPoles: type === 'legs' && !short ? positions * 2 : 0,
    plates: type === 'legs' ? positions : 0,
    feet: type === 'feet' ? 1 : 0,
  };
}
export function panelPixels(p?: Product): { w: number; h: number } | null {
  if (!p) return null;
  const pair = p.notes.match(/(\d+)\s*[x×]\s*(\d+)\s*p?x/i);
  if (pair) return { w: Number(pair[1]), h: Number(pair[2]) };
  const one = p.notes.match(/(?:^|\s)(\d+)\s*px\b/i) ?? p.notes.match(/^\s*(\d+)\s*$/);
  return one ? { w: Number(one[1]), h: Number(one[1]) } : null;
}
export function processorCapacity(p?: Product): number | null {
  if (!p) return null;
  const found = p.notes.match(/MaxPixels\s*=\s*([\d ,._]+)/i);
  if (found) return Number(found[1].replace(/\D/g, '')) || null;
  const old: Record<string, number> = {
    '-OKfPeB_3SA9njkYQAQL': 2300000,
    '-OKfQPJVPDNL_sFztyTk': 3900000,
    '-ONKAWIH9Hgp0e8YBrfi': 13000000,
    '-OKV7hl6DYaYbIXRTiI8': 9000000,
    '-OMQuhjYu26rElpeI45i': 10400000,
    '-OKVFp8b2pLd32dJfwOd': 10400000,
  };
  return old[p.id] ?? null;
}
export function suitableProcessors(products: Product[], pixels: number | null): Product[] {
  if (pixels === null || !Number.isFinite(pixels) || pixels <= 0) return [];
  return products
    .filter(
      (p) =>
        !p.retired &&
        p.category.trim().toLowerCase() === 'led prosessori' &&
        (processorCapacity(p) ?? 0) >= pixels,
    )
    .sort(
      (a, b) => processorCapacity(a)! - processorCapacity(b)! || a.name.localeCompare(b.name, 'fi'),
    );
}
export function ledItems(
  rows: { productId: string; quantity: number; label: string }[],
  products: Record<string, Product>,
  note: string,
): Item[] {
  const merged = new Map<string, Item>();
  for (const row of rows) {
    if (!row.quantity) continue;
    const p = products[row.productId];
    if (!p || p.retired) throw Error(`Valitse varastotuote: ${row.label}.`);
    if (p.review) throw Error(`Tarkista tuotteen määrät ensin: ${p.name}.`);
    const existing = merged.get(p.id);
    if (existing) existing.quantity += row.quantity;
    else
      merged.set(p.id, {
        id: crypto.randomUUID(),
        type: 'inventory',
        productId: p.id,
        name: p.name,
        quantity: row.quantity,
        note,
        packed: 0,
        returned: 0,
        unitIds: [],
        returnedUnitIds: [],
        serialSnapshots: [],
      });
  }
  return [...merged.values()];
}
