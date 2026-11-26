import type { Item, Product, Trip } from './model.ts';
import {
  legacyLedIds,
  ledItems,
  mounting,
  panelKind,
  panelPixels,
  panelPlan,
  suitableProcessors,
} from './led.ts';

export type CurveDocument = {
  version: 2;
  angles: number[];
  rotation: number;
  horizontal: boolean;
  pins: { i: number; kind: 'mid' | 'end'; x: number; y: number }[];
  selected: number;
  selection: number[];
  pointKind: 'mid' | 'end';
  shapeInfo: null | {
    kind: 'circle' | 'stadium' | 'ellipse' | 'wave';
    width: number;
    depth: number;
    title: string;
    method: string;
    signature: string;
    cycles?: number;
    flip: boolean;
    curvatureLimited: boolean;
    rangeLimited: boolean;
  };
};
export type LedConfiguration = {
  selectedPanel: string;
  long: string;
  half: string;
  processor: string;
  width: number;
  height: number;
  powerLimit: number | null;
  mount: 'none' | 'legs' | 'feet' | 'hanging' | 'wall';
  start: number;
  bindings: Record<string, string>;
};
export type LedProjectDraft = {
  id: string;
  name: string;
  configuration: LedConfiguration;
  curve: CurveDocument | null;
};
export type LedProject = LedProjectDraft & {
  version: number;
  updatedAt: string;
  appliedVersion: number;
};
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw Error('Suunnitelman tiedot ovat virheelliset.');
  return value as Record<string, unknown>;
};
function number(value: unknown, min: number, max: number) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
    throw Error('Suunnitelman mitat tai kulmat ovat virheelliset.');
  return value;
}
function text(value: unknown, max = 200) {
  if (typeof value !== 'string' || value.length > max)
    throw Error('Suunnitelman tekstikenttä on virheellinen.');
  return value;
}
export function parseCurveDocument(value: unknown): CurveDocument {
  const d = record(value);
  if (d.version !== 2 || !Array.isArray(d.angles) || !d.angles.length || d.angles.length > 200)
    throw Error('Kaari-suunnitelmassa tarvitaan 1–200 palaa.');
  const angles = d.angles.map((v) => {
    const angle = number(v, -30, 30);
    if (Math.abs(angle / 2.5 - Math.round(angle / 2.5)) > 1e-9)
      throw Error('Palan kulman pitää olla 2,5° askelissa.');
    return angle;
  });
  if (typeof d.horizontal !== 'boolean') throw Error('Kaari-suunnitelman suunta puuttuu.');
  const pins = d.pins ?? [];
  if (!Array.isArray(pins) || pins.length > 400)
    throw Error('Kaari-suunnitelman lukitukset ovat virheelliset.');
  const result: CurveDocument = {
    version: 2,
    angles,
    rotation: number(d.rotation, -100000, 100000),
    horizontal: d.horizontal,
    pins: pins.map((v) => {
      const p = record(v),
        i = number(p.i, 0, angles.length - 1);
      if (!Number.isInteger(i) || !['mid', 'end'].includes(String(p.kind)))
        throw Error('Kaari-suunnitelman lukitus on virheellinen.');
      return {
        i,
        kind: p.kind as 'mid' | 'end',
        x: number(p.x, -1e8, 1e8),
        y: number(p.y, -1e8, 1e8),
      };
    }),
    selected:
      Number.isInteger(d.selected) && Number(d.selected) >= 0 && Number(d.selected) < angles.length
        ? Number(d.selected)
        : 0,
    selection: Array.isArray(d.selection)
      ? [
          ...new Set(
            d.selection.filter(
              (i): i is number =>
                Number.isInteger(i) && Number(i) >= 0 && Number(i) < angles.length,
            ),
          ),
        ]
      : [0],
    pointKind: d.pointKind === 'end' ? 'end' : 'mid',
    shapeInfo: null,
  };
  if (d.shapeInfo) {
    const s = record(d.shapeInfo),
      kind = s.kind;
    if (!['circle', 'stadium', 'ellipse', 'wave'].includes(String(kind)))
      throw Error('Tuntematon Kaari-muoto.');
    const cycles = kind === 'wave' ? number(s.cycles, 1, 12) : undefined;
    if (cycles !== undefined && !Number.isInteger(cycles))
      throw Error('Aaltojen määrän pitää olla kokonaisluku.');
    result.shapeInfo = {
      kind: kind as NonNullable<CurveDocument['shapeInfo']>['kind'],
      width: number(s.width, 0.001, 1e7),
      depth: number(s.depth, kind === 'wave' ? 0 : 0.001, 1e7),
      title:
        kind === 'wave'
          ? 'Aalto'
          : kind === 'circle'
            ? 'Ympyrä'
            : kind === 'stadium'
              ? 'Suorakylkinen soikio'
              : 'Ellipsi',
      method: 'Tallennettu muotosovitus',
      signature: typeof s.signature === 'string' ? s.signature.slice(0, 3000) : '',
      ...(cycles === undefined ? {} : { cycles }),
      flip: !!s.flip,
      curvatureLimited: !!s.curvatureLimited,
      rangeLimited: !!s.rangeLimited,
    };
  }
  return result;
}
export function parseLedProject(value: unknown): LedProjectDraft {
  const p = record(value),
    c = record(p.configuration),
    id = text(p.id, 100),
    name = text(p.name, 120).trim();
  if (
    !id ||
    /[.#$\[\]/]/.test(id) ||
    ['__proto__', 'constructor', 'prototype'].includes(id) ||
    !name
  )
    throw Error('Anna LED-suunnitelmalle nimi ja kelvollinen tunniste.');
  if (!['none', 'legs', 'feet', 'hanging', 'wall'].includes(String(c.mount)))
    throw Error('Asennustapa on virheellinen.');
  const curve = p.curve ? parseCurveDocument(p.curve) : null;
  const b = record(c.bindings);
  return {
    id,
    name,
    curve,
    configuration: {
      selectedPanel: text(c.selectedPanel),
      long: text(c.long),
      half: text(c.half),
      processor: text(c.processor),
      width: curve ? curve.angles.length * 500 : number(c.width, 1, 100000),
      height: number(c.height, 1, 100000),
      powerLimit: c.powerLimit === null ? null : number(c.powerLimit, 1, 100000),
      mount: c.mount as LedConfiguration['mount'],
      start: number(c.start, 0, 100000),
      bindings: Object.fromEntries(
        Object.keys(legacyLedIds).map((key) => [key, text(b[key] ?? '')]),
      ),
    },
  };
}
/** One source of truth for the preview and the transactional update. */
export function projectMaterials(
  project: LedProjectDraft,
  products: Record<string, Product>,
): Item[] {
  const { configuration: c, curve } = parseLedProject(project),
    kind = panelKind(products[c.selectedPanel]),
    surface = kind === 'long' || kind === 'half';
  if (!kind) throw Error('Valitse LED-paneeli varastosta.');
  if (curve && kind !== 'standard')
    throw Error(
      'Kaari käyttää 500 × 500 mm LED-paneeleja. Pintaledin eri palakoot mitoitetaan tavallisessa LED-suunnittelussa.',
    );
  const plan = panelPlan(
    curve ? curve.angles.length * 500 : c.width,
    c.height,
    500,
    500,
    surface,
    c.powerLimit,
  );
  if (
    (plan.long && panelKind(products[c.long]) !== (surface ? 'long' : 'standard')) ||
    (plan.half && panelKind(products[c.half]) !== 'half')
  )
    throw Error('Valitse tarvittavat LED-paneelit.');
  if (plan.powerFeeds === null) throw Error('Vahvista Pintaledin virtaketjun enimmäispalamäärä.');
  const lp = panelPixels(products[c.long]),
    hp = panelPixels(products[c.half]);
  const pixels =
    (!plan.long || lp) && (!plan.half || hp)
      ? ((plan.long ? (lp!.w * plan.long) / plan.rows : 0) + (plan.half ? hp!.w : 0)) *
        (plan.long ? lp!.h : hp!.h) *
        plan.rows
      : null;
  if (
    c.processor &&
    !suitableProcessors(Object.values(products), pixels).some((p) => p.id === c.processor)
  )
    throw Error('Valitse seinän pikselimäärälle riittävä prosessori.');
  const m = mounting(plan, c.mount, c.start),
    b = c.bindings;
  return ledItems(
    [
      { productId: c.long, quantity: plan.long, label: 'LED-paneeli' },
      { productId: c.half, quantity: plan.half, label: 'Pintaled 500 mm' },
      { productId: b.dataMid, quantity: plan.midCables, label: 'DATA-välikaapeli' },
      { productId: b.powerMid, quantity: plan.midCables, label: 'VIRTA-välikaapeli' },
      { productId: b.dataFeed, quantity: plan.dataFeeds, label: 'DATA-syöttö' },
      { productId: b.powerFeed, quantity: plan.powerFeeds, label: 'VIRTA-syöttö' },
      { productId: b.shortPole, quantity: m.shortPoles, label: 'Lyhyt tolppa' },
      { productId: b.longPole, quantity: m.longPoles, label: 'Pitkä tolppa' },
      { productId: b.plate, quantity: m.plates, label: 'Plate' },
      { productId: b.feet, quantity: m.feet, label: 'Tassut' },
      { productId: c.processor, quantity: c.processor ? 1 : 0, label: 'Prosessori' },
    ],
    products,
    `${project.name} · LED ${plan.widthMm} × ${plan.heightMm} mm${curve ? ' · Kaari: pintapituus, kulmat tallennetussa suunnitelmassa' : ''}`,
  );
}
export function projectChanges(
  trip: Trip,
  project: LedProjectDraft,
  products: Record<string, Product>,
) {
  const desired = projectMaterials(project, products),
    owned = trip.items.filter((i) => i.ledPlanId === project.id);
  return [...new Set([...owned.map((i) => i.productId), ...desired.map((i) => i.productId)])].map(
    (productId) => ({
      productId,
      name:
        products[productId]?.name ??
        owned.find((i) => i.productId === productId)?.name ??
        productId,
      before: owned.filter((i) => i.productId === productId).reduce((s, i) => s + i.quantity, 0),
      after: desired.find((i) => i.productId === productId)?.quantity ?? 0,
    }),
  );
}
export function updateProjectItems(
  trip: Trip,
  project: LedProject,
  products: Record<string, Product>,
  operationId: string,
  bundled: boolean,
): Item[] {
  const desired = projectMaterials(project, products),
    previous = trip.items.filter((i) => i.ledPlanId === project.id),
    result = trip.items.filter((i) => i.ledPlanId !== project.id);
  for (const [index, next] of desired.entries()) {
    const matches = previous.filter((i) => i.productId === next.productId);
    if (matches.length > 1)
      throw Error('Suunnitelman saman tuotteen rivejä on yhdistettävä ennen päivitystä.');
    const old = matches[0];
    if (old && !bundled && next.quantity < old.packed)
      throw Error(
        `${next.name}: tarve ${next.quantity} alittaa pakatun määrän ${old.packed}. Pura ylimääräiset ensin.`,
      );
    result.push(
      old
        ? { ...old, quantity: next.quantity, note: next.note }
        : { ...next, id: `${operationId}-${index}`, ledPlanId: project.id },
    );
  }
  for (const old of previous.filter((i) => !desired.some((n) => n.productId === i.productId))) {
    if (old.packed && !bundled)
      throw Error(`${old.name}: pakattua kalustoa ei voi poistaa. Pura ylimääräiset ensin.`);
    if (old.packed) result.push({ ...old, quantity: 0 });
  }
  return result;
}
