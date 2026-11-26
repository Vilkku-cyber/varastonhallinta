import type { CurveDocument } from './ledProjects.ts';
const RAD = Math.PI / 180,
  L = 500;
type Point = { x: number; y: number };
export function arcPoint(x: number, y: number, t: number, angle: number, u = 1): Point {
  const q = angle * RAD;
  return Math.abs(q) < 1e-12
    ? { x: x + L * u * Math.cos(t), y: y + L * u * Math.sin(t) }
    : {
        x: x + (L / q) * (Math.sin(t + q * u) - Math.sin(t)),
        y: y + (L / q) * (Math.cos(t) - Math.cos(t + q * u)),
      };
}
export function curveGeometry(d: CurveDocument) {
  let x = 0,
    y = 0,
    t = 0,
    center: Point = { x: 0, y: 0 },
    centerT = 0;
  for (const [i, a] of d.angles.entries()) {
    if (i <= d.angles.length / 2 && i + 1 >= d.angles.length / 2) {
      center = arcPoint(x, y, t, a, d.angles.length / 2 - i);
      centerT = t + a * RAD * (d.angles.length / 2 - i);
    }
    const p = arcPoint(x, y, t, a);
    x = p.x;
    y = p.y;
    t += a * RAD;
  }
  const rotation = d.horizontal
    ? Math.hypot(x, y) < 0.001
      ? -centerT
      : -Math.atan2(y, x)
    : d.rotation * RAD;
  const rotate = (p: Point): Point => ({
    x: center.x + (p.x - center.x) * Math.cos(rotation) - (p.y - center.y) * Math.sin(rotation),
    y: center.y + (p.x - center.x) * Math.sin(rotation) + (p.y - center.y) * Math.cos(rotation),
  });
  const start = rotate({ x: 0, y: 0 });
  x = start.x;
  y = start.y;
  t = rotation;
  const bounds = { minX: x, maxX: x, minY: y, maxY: y };
  const include = (p: Point) => {
    bounds.minX = Math.min(bounds.minX, p.x);
    bounds.maxX = Math.max(bounds.maxX, p.x);
    bounds.minY = Math.min(bounds.minY, p.y);
    bounds.maxY = Math.max(bounds.maxY, p.y);
  };
  const segments = d.angles.map((a, i) => {
    const q = a * RAD,
      points = Array.from({ length: 17 }, (_, j) => arcPoint(x, y, t, a, j / 16));
    include(points[16]);
    if (q)
      for (
        let k = Math.ceil(Math.min(t, t + q) / (Math.PI / 2));
        k <= Math.floor(Math.max(t, t + q) / (Math.PI / 2));
        k++
      ) {
        const u = ((k * Math.PI) / 2 - t) / q;
        if (u >= 0 && u <= 1) include(arcPoint(x, y, t, a, u));
      }
    const result = {
      i,
      angle: a,
      points,
      start: { x, y },
      end: points[16],
      heading: t / RAD,
      endHeading: (t + q) / RAD,
    };
    x = points[16].x;
    y = points[16].y;
    t += q;
    return result;
  });
  return {
    bounds,
    segments,
    width: bounds.maxX - bounds.minX,
    depth: bounds.maxY - bounds.minY,
    length: d.angles.length * L,
    start,
    end: { x, y },
    gap: Math.hypot(x - start.x, y - start.y),
  };
}
