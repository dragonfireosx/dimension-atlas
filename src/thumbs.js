// thumbs.js — small line drawings for the table cells, as SVG strings.
import { buildShape } from './geometry.js';
import { ShapeView } from './projection.js';
import { colorOf } from './catalog.js';

const cache = new Map();
const f2 = (x) => (Math.round(x * 100) / 100).toString();

function hull(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  const up = [];
  for (const q of p.reverse()) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

// Outline of the flat (Petrie) picture of the three big families, without building every edge.
function outline(fam, N) {
  const pts = [];
  if (fam === 'simplex') {
    const n = N + 1;
    for (let i = 0; i < n; i++) { const a = (2 * Math.PI * i) / n; pts.push([Math.cos(a), Math.sin(a)]); }
  } else if (fam === 'cross') {
    for (let k = 0; k < 2 * N; k++) { const a = (Math.PI * k) / N; pts.push([Math.cos(a), Math.sin(a)]); }
  } else {
    const n = Math.min(N, 600), g = [];
    for (let j = 0; j < n; j++) g.push([Math.cos((Math.PI * j) / n), Math.sin((Math.PI * j) / n)]);
    const half = [];
    for (let m = 0; m <= n; m++) {
      let x = 0, y = 0;
      for (let j = 0; j < n; j++) { const s = j < m ? 1 : -1; x += s * g[j][0]; y += s * g[j][1]; }
      half.push([x, y]);
    }
    const all = half.concat(half.map(([x, y]) => [-x, -y]));
    const r = Math.max(...all.map(([x, y]) => Math.hypot(x, y)));
    return hull(all.map(([x, y]) => [x / r, y / r]));
  }
  return pts;
}

function path(points) {
  return 'M' + points.map(([x, y]) => `${f2(x)} ${f2(y)}`).join('L') + 'Z';
}

export function thumbSVG(spec) {
  const key = spec.fam === 'polygon' ? `p${spec.free ? 'x' : spec.n}` : spec.fam === 'arch' ? `a${spec.a}${spec.N}` : `${spec.fam}${spec.N}`;
  if (cache.has(key)) return cache.get(key);
  const color = colorOf(spec);
  let body = '';
  const stroke = (w) => `fill="none" stroke="currentColor" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;

  if (spec.fam === 'point') {
    body = '<circle r="0.16" fill="currentColor"/>';
  } else if (spec.fam === 'line') {
    body = `<path d="M-0.9 0L0.9 0" ${stroke(0.08)}/><circle cx="-0.9" r="0.12" fill="currentColor"/><circle cx="0.9" r="0.12" fill="currentColor"/>`;
  } else if (spec.fam === 'polygon') {
    const n = spec.free ? 7 : spec.n;
    const pts = [];
    for (let i = 0; i < n; i++) { const a = (2 * Math.PI * i) / n - Math.PI / 2; pts.push([Math.cos(a) * 0.95, Math.sin(a) * 0.95]); }
    body = `<path d="${path(pts)}" ${stroke(0.07)}/>`;
  } else {
    const shape = buildShape(spec);
    const big = ['simplex', 'cross', 'cube'].includes(spec.fam) && spec.N >= 5;
    const edgeCount = shape.edges.length / 2;
    if (big && (spec.fam === 'cube' ? spec.N > 7 : spec.fam === 'cross' ? spec.N > 16 : spec.N > 31)) {
      body = `<path d="${path(outline(spec.fam, spec.N).map(([x, y]) => [x * 0.95, y * 0.95]))}" ${stroke(0.05)}/>`;
    } else {
      const v = new ShapeView(shape, big ? 'petrie' : 'direct');
      let pts = [];
      for (let i = 0; i < v.nv; i++) pts.push([v.pos[3 * i], v.pos[3 * i + 1], v.pos[3 * i + 2]]);
      if (v.static && !big) {                       // fixed 3/4 view for flat and 3D shapes
        const cy = Math.cos(0.6), sy = Math.sin(0.6), cp = Math.cos(-0.45), sp = Math.sin(-0.45);
        pts = pts.map(([x, y, z]) => {
          const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
          return [x1, y * cp - z1 * sp, y * sp + z1 * cp];
        });
      } else if (!big) {                            // 4D: orthographic shadow with a touch of perspective
        pts = pts.map(([x, y, z]) => { const s = 3.2 / (3.2 - z); return [x * s, y * s, z]; });
      }
      const r = Math.max(1e-6, ...pts.map(([x, y]) => Math.hypot(x, y)));
      pts = pts.map(([x, y]) => [(x / r) * 0.92, (y / r) * 0.92]);
      let d = '';
      const ed = v.ed;
      for (let e = 0; e < v.ne; e++) {
        const a = pts[ed[2 * e]], b = pts[ed[2 * e + 1]];
        d += `M${f2(a[0])} ${f2(a[1])}L${f2(b[0])} ${f2(b[1])}`;
      }
      const w = edgeCount > 800 ? 0.018 : edgeCount > 200 ? 0.03 : edgeCount > 40 ? 0.05 : 0.07;
      body = `<path d="${d}" ${stroke(w)}/>`;
      if (v.nv <= 40) body += pts.map(([x, y]) => `<circle cx="${f2(x)}" cy="${f2(y)}" r="0.08" fill="currentColor"/>`).join('');
    }
  }
  const svg = `<svg viewBox="-1.1 -1.1 2.2 2.2" aria-hidden="true" style="color:${color}">${body}</svg>`;
  cache.set(key, svg);
  return svg;
}
