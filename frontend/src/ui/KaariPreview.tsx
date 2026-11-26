import { curveGeometry } from '../domain/kaariGeometry';
import type { CurveDocument } from '../domain/ledProjects';
const mm = (n: number) => n.toLocaleString('fi-FI', { maximumFractionDigits: 1 });
export function KaariPreview({
  document,
  details = false,
}: {
  document: CurveDocument;
  details?: boolean;
}) {
  const g = curveGeometry(document),
    b = g.bounds,
    pad = Math.max(g.width, g.depth, 500) * 0.08;
  return (
    <div className="kaari-preview">
      <svg
        role="img"
        aria-label={`Kaari ylhäältä: leveys ${mm(g.width)} mm, syvyys ${mm(g.depth)} mm`}
        viewBox={`${b.minX - pad} ${b.minY - pad} ${Math.max(g.width, 1) + pad * 2} ${Math.max(g.depth, 1) + pad * 2}`}
      >
        {g.segments.map((s) => (
          <g key={s.i}>
            <polyline
              points={s.points.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke="currentColor"
              strokeWidth="5"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={s.start.x}
              cy={s.start.y}
              r={pad * 0.06}
              fill="white"
              stroke="currentColor"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ))}
        <text x={g.start.x} y={g.start.y + pad * 0.5} fontSize={pad * 0.3}>
          A
        </text>
        <text x={g.end.x} y={g.end.y + pad * 0.5} fontSize={pad * 0.3}>
          B
        </text>
      </svg>
      <p>
        {document.angles.length} palaa / rivi · pintapituus {mm(g.length)} mm · tilantarve{' '}
        {mm(g.width)} × {mm(g.depth)} mm
      </p>
      <p className="hint">
        Ylhäältä katsottuna · numerointi A:sta B:hen · tasainen 500 mm kaari palassa. Rungon paksuus
        ja asennusvarat lisätään erikseen.
      </p>
      {details && (
        <details>
          <summary>Palakulmat ja sijainnit</summary>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Pala</th>
                  <th>Kaarevuus</th>
                  <th>Alku X / Y mm</th>
                  <th>Loppu X / Y mm</th>
                </tr>
              </thead>
              <tbody>
                {g.segments.map((s) => (
                  <tr key={s.i}>
                    <td>{s.i + 1}</td>
                    <td>{mm(s.angle)}°</td>
                    <td>
                      {mm(s.start.x)} / {mm(s.start.y)}
                    </td>
                    <td>
                      {mm(s.end.x)} / {mm(s.end.y)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
