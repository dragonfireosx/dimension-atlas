// catalog.js — what exists in each dimension, and what to say about it.
import { binom } from './geometry.js';

export const MAX_D = 600;

export const ROWS = [
  { id: 'simplex', label: 'Simplex',        nick: 'tetrahedron path',  rule: '+1', formula: 'corners = n + 1',  color: '#eab308' },
  { id: 'cross',   label: 'Cross-polytope', nick: 'octahedron path',   rule: '+2', formula: 'corners = 2n',     color: '#ef4444' },
  { id: 'cube',    label: 'Hypercube',      nick: 'cube path',         rule: '×2', formula: 'corners = 2ⁿ',     color: '#22c55e' },
  { id: 'ico',     label: 'Icosahedron',    nick: 'path to the 600-cell', rule: '',  formula: '12 → 120',      color: '#a855f7' },
  { id: 'dodeca',  label: 'Dodecahedron',   nick: 'path to the 120-cell', rule: '',  formula: '20 → 600',      color: '#3b82f6' },
  { id: 'c24',     label: '24-cell',        nick: 'a 4D one-off',      rule: '',   formula: '24 corners',      color: '#f97316' },
  { id: 'polygon', label: 'Polygons',       nick: '3 to ∞ sides',      rule: '',   formula: 'corners = sides', color: '#e5e7eb' },
];

// ---------- the 13 Archimedean solids (advanced mode) ----------
// Six grow into every dimension; seven stop at 3D. Corner and edge counts are exact; edges = corners × degree / 2.
const B = BigInt;
const fact = (n) => { let r = 1n; for (let i = 2n; i <= B(n); i++) r *= i; return r; };
export const ARCH = [
  { id: 'tt', label: 'Truncated tetrahedron', color: '#a16207', from: 'tetrahedron', grows: true, formula: 'corners = n(n+1)',
    v: (n) => B(n) * B(n + 1), deg: (n) => n, name: (n) => (n === 3 ? 'Truncated tetrahedron' : n === 4 ? 'Truncated 5-cell' : `Truncated ${n}-simplex`),
    note: 'Cut every corner off the simplex. Corners 12, 20, 30, 42, 56: the pronic numbers, twice the triangle numbers. In 4D it has 20 corners like the dodecahedron; in 5D 30, like the icosidodecahedron.' },
  { id: 'co', label: 'Cuboctahedron', color: '#db2777', from: 'cube and octahedron', grows: true, formula: 'corners = 2n(n−1)',
    v: (n) => 2n * B(n) * B(n - 1), deg: (n) => 4 * (n - 2), name: (n) => (n === 3 ? 'Cuboctahedron' : n === 4 ? '24-cell (rectified 16-cell)' : `Rectified ${n}-orthoplex`),
    note: 'Cut the cross-polytope down to its edge midpoints. In 3D it is only semi-regular, but in 4D the same rule gives the 24-cell, which is fully regular. Corners 12, 24, 40, 60, 84: four times the triangle numbers.' },
  { id: 'tc', label: 'Truncated cube', color: '#15803d', from: 'cube', grows: true, formula: 'corners = n·2ⁿ',
    v: (n) => B(n) * 2n ** B(n), deg: (n) => n, name: (n) => (n === 3 ? 'Truncated cube' : n === 4 ? 'Truncated tesseract' : `Truncated ${n}-cube`),
    note: 'Cut every corner off the hypercube: each of the 2ⁿ corners becomes n new ones. Corners 24, 64, 160, 384.' },
  { id: 'to', label: 'Truncated octahedron', color: '#991b1b', from: 'octahedron (and tetrahedron)', grows: true, formula: 'corners = (n+1)!',
    v: (n) => fact(n + 1), deg: (n) => n, name: (n) => (n === 3 ? 'Truncated octahedron' : n === 4 ? 'Omnitruncated 5-cell' : `${n}D permutohedron`),
    note: 'The permutohedron: its corners are every ordering of 1, 2, …, n+1. Corners 24, 120, 720, 5040: the factorials. In 4D its 120 corners match the 600-cell; in 5D its 720 match the rectified 600-cell. It also tiles space.' },
  { id: 'rco', label: 'Rhombicuboctahedron', color: '#0f766e', from: 'cube and octahedron', grows: true, formula: 'corners = n(n−1)·2ⁿ⁻¹',
    v: (n) => B(n) * B(n - 1) * 2n ** B(n - 1), deg: (n) => 2 * (n - 1), name: (n) => (n === 3 ? 'Rhombicuboctahedron' : n === 4 ? 'Cantellated tesseract' : `Cantellated ${n}-cube`),
    note: 'Push the hypercube faces apart and fill the gaps. Corners 24, 96, 320, 960.' },
  { id: 'tco', label: 'Truncated cuboctahedron', color: '#4d7c0f', from: 'cube and octahedron', grows: true, formula: 'corners = n!·2ⁿ',
    v: (n) => fact(n) * 2n ** B(n), deg: (n) => n, name: (n) => (n === 3 ? 'Truncated cuboctahedron' : n === 4 ? 'Omnitruncated tesseract' : `Omnitruncated ${n}-cube`),
    note: 'Every corner of this shape is one symmetry of the hypercube, so its corner count is exactly the size of the hypercube symmetry group: 48, 384, 3840.' },
  { id: 'sc', label: 'Snub cube', color: '#57534e', from: 'cube', grows: false, v3: 24, e3: 60, cousin: 'No uniform 4D snub follows it.',
    note: 'Twisted and chiral: it comes in a left-handed and a right-handed form. 24 corners, one for each rotation of the cube.' },
  { id: 'id', label: 'Icosidodecahedron', color: '#6366f1', from: 'dodecahedron and icosahedron', grows: false, v3: 30, e3: 60, cousin: '4D cousin: the rectified 600-cell, 720 corners (beyond this chart).',
    note: 'The edge midpoints of the icosahedron (or of the dodecahedron). 30 corners, one per edge.' },
  { id: 'ti', label: 'Truncated icosahedron', color: '#7e22ce', from: 'icosahedron', grows: false, v3: 60, e3: 90, cousin: '4D cousin: the truncated 600-cell, 1440 corners.',
    note: 'The football and the C60 buckyball molecule. 60 corners, one per rotation of the icosahedron.' },
  { id: 'td', label: 'Truncated dodecahedron', color: '#1d4ed8', from: 'dodecahedron', grows: false, v3: 60, e3: 90, cousin: '4D cousin: the truncated 120-cell, 2400 corners.',
    note: 'Cut every corner off the dodecahedron: 20 × 3 = 60 corners.' },
  { id: 'rid', label: 'Rhombicosidodecahedron', color: '#0e7490', from: 'dodecahedron and icosahedron', grows: false, v3: 60, e3: 120, cousin: '4D cousin: the cantellated 600-cell, 3600 corners.',
    note: 'Pentagons, squares and triangles. 60 corners.' },
  { id: 'tid', label: 'Truncated icosidodecahedron', color: '#4338ca', from: 'dodecahedron and icosahedron', grows: false, v3: 120, e3: 180, cousin: '4D cousin: the omnitruncated 120-cell, 14,400 corners.',
    note: 'The biggest Archimedean solid. Its 120 corners are exactly the 120 symmetries of the icosahedron, reflections included.' },
  { id: 'sd', label: 'Snub dodecahedron', color: '#6d28d9', from: 'dodecahedron', grows: false, v3: 60, e3: 150, cousin: 'No uniform 4D snub follows it.',
    note: 'Twisted and chiral. 60 corners, one for each rotation of the icosahedron.' },
];
export const ARCH_BY_ID = Object.fromEntries(ARCH.map((a) => [a.id, a]));
export function archCorners(a, n) { return a.grows ? a.v(n) : n === 3 ? B(a.v3) : 0n; }

// Colour for any shape, regular or not.
export function colorOf(spec) {
  if (spec.fam === 'arch') return ARCH_BY_ID[spec.a].color;
  return ROWS[locate(spec).row].color;
}

export const ROW_INDEX = Object.fromEntries(ROWS.map((r, i) => [r.id, i]));

// ---------- the table, column by column ----------

const GAP = {
  flat: 'Polygons are flat (2D). One dimension up, the same idea gives exactly five solids instead.',
  c24_2: 'The 24-cell has no 2D version. It only exists in four dimensions.',
  c24_3: 'No regular 3D solid matches the 24-cell. Its 3D relative is the cuboctahedron (12 corners), which is only semi-regular: the same construction becomes fully regular in 4D. Switch on Archimedean in the corners view to see it.',
  c24_5: 'The 24-cell does not continue into 5D. It lives in 4D and nowhere else.',
  stop: 'From 5D upward only three shapes exist: simplex, cross-polytope and hypercube. The pentagon family (icosahedron, dodecahedron and their 4D cousins) stops at 4D, and so does the 24-cell.',
};

const sh = (fam, N, extra = {}) => ({ fam, N, ...extra });

export function cellsForColumn(col) {
  if (col === 0) return [{ r0: 0, r1: 6, kind: 'shape', spec: sh('point', 0) }];
  if (col === 1) return [{ r0: 0, r1: 6, kind: 'shape', spec: sh('line', 1) }];
  if (col === 2) return [
    { r0: 0, r1: 0, kind: 'shape', spec: sh('polygon', 2, { n: 3 }) },
    { r0: 1, r1: 2, kind: 'shape', spec: sh('polygon', 2, { n: 4 }) },
    { r0: 3, r1: 4, kind: 'shape', spec: sh('polygon', 2, { n: 5 }) },
    { r0: 5, r1: 5, kind: 'gap', reason: GAP.c24_2 },
    { r0: 6, r1: 6, kind: 'shape', spec: sh('polygon', 2, { n: 0, free: true }) },
  ];
  if (col === 3) return [
    { r0: 0, r1: 0, kind: 'shape', spec: sh('simplex', 3) },
    { r0: 1, r1: 1, kind: 'shape', spec: sh('cross', 3) },
    { r0: 2, r1: 2, kind: 'shape', spec: sh('cube', 3) },
    { r0: 3, r1: 3, kind: 'shape', spec: sh('ico', 3) },
    { r0: 4, r1: 4, kind: 'shape', spec: sh('dodeca', 3) },
    { r0: 5, r1: 5, kind: 'gap', reason: GAP.c24_3, hot: true },
    { r0: 6, r1: 6, kind: 'gap', reason: GAP.flat },
  ];
  if (col === 4) return [
    { r0: 0, r1: 0, kind: 'shape', spec: sh('simplex', 4) },
    { r0: 1, r1: 1, kind: 'shape', spec: sh('cross', 4) },
    { r0: 2, r1: 2, kind: 'shape', spec: sh('cube', 4) },
    { r0: 3, r1: 3, kind: 'shape', spec: sh('ico', 4) },
    { r0: 4, r1: 4, kind: 'shape', spec: sh('dodeca', 4) },
    { r0: 5, r1: 5, kind: 'shape', spec: sh('c24', 4) },
    { r0: 6, r1: 6, kind: 'gap', reason: GAP.flat },
  ];
  return [
    { r0: 0, r1: 0, kind: 'shape', spec: sh('simplex', col) },
    { r0: 1, r1: 1, kind: 'shape', spec: sh('cross', col) },
    { r0: 2, r1: 2, kind: 'shape', spec: sh('cube', col) },
    { r0: 3, r1: 6, kind: 'gap', reason: col === 5 ? GAP.stop + ' ' + GAP.c24_5 : GAP.stop },
  ];
}

// How many different shapes exist in a column ("∞" for the polygons).
export function countInColumn(col) {
  if (col <= 1) return 1;
  if (col === 2) return Infinity;
  if (col === 3) return 5;
  if (col === 4) return 6;
  return 3;
}

export function cellAt(row, col) {
  return cellsForColumn(col).find((c) => row >= c.r0 && row <= c.r1);
}

// Which cell does a shape spec live in?
export function locate(spec) {
  const rowOf = { point: 0, line: 0, simplex: 0, cross: 1, cube: 2, ico: 3, dodeca: 4, c24: 5, polygon: 6 };
  let row = rowOf[spec.fam];
  let col = spec.N;
  if (spec.fam === 'polygon') {
    row = spec.n === 3 ? 0 : spec.n === 4 ? 1 : spec.n === 5 ? 3 : 6;
  }
  return { row, col };
}

// When the dimension slider lands on a column, pick the cell to show.
export function pickForColumn(col, preferredRow) {
  const cells = cellsForColumn(col).filter((c) => c.kind === 'shape');
  return cells.find((c) => preferredRow >= c.r0 && preferredRow <= c.r1)
    || cells.reduce((best, c) => (Math.abs(c.r0 - preferredRow) < Math.abs(best.r0 - preferredRow) ? c : best), cells[0]);
}

// ---------- counting every kind of face ----------

export function fVector(spec) {
  const { fam, N } = spec;
  const out = [];
  switch (fam) {
    case 'point': return [1n];
    case 'line': return [2n];
    case 'polygon': { const n = BigInt(Math.round(spec.n)); return [n, n]; }
    case 'simplex': for (let k = 0; k < N; k++) out.push(binom(N + 1, k + 1)); return out;
    case 'cross': for (let k = 0; k < N; k++) out.push(binom(N, k + 1) * 2n ** BigInt(k + 1)); return out;
    case 'cube': for (let k = 0; k < N; k++) out.push(binom(N, k) * 2n ** BigInt(N - k)); return out;
    case 'ico': return N === 3 ? [12n, 30n, 20n] : [120n, 720n, 1200n, 600n];
    case 'dodeca': return N === 3 ? [20n, 30n, 12n] : [600n, 1200n, 720n, 120n];
    case 'c24': return [24n, 96n, 96n, 24n];
    case 'arch': {
      const a = ARCH_BY_ID[spec.a];
      const v = archCorners(a, N), e = a.grows ? (v * B(a.deg(N))) / 2n : B(a.e3);
      return N === 3 ? [v, e, 2n - v + e] : [v, e];
    }
  }
  throw new Error('no counts for ' + fam);
}

export function kName(k, N) {
  if (k === N - 1 && N >= 3) return 'facets';
  return ['corners', 'edges', 'faces', 'cells'][k] || `${k}-faces`;
}

// ---------- number formatting ----------

// Mantissa and exponent of a big integer, rounded to `dec` decimals.
function sci(b, dec) {
  const s = b.toString();
  let exp = s.length - 1;
  let m = Math.round((Number(s.slice(0, 4)) / 1000) * 10 ** dec) / 10 ** dec;
  if (m >= 10) { m = 1; exp += 1; }
  return [m.toFixed(dec), exp];
}

export function fmt(x) {
  if (x === Infinity) return '∞';
  const b = typeof x === 'bigint' ? x : BigInt(Math.round(x));
  if (b < 1000000n) return b.toLocaleString('en-GB');
  const [m, e] = sci(b, 2);
  return `${m}×10^${e}`;
}

// Compact for table cells.
export function fmtShort(x) {
  if (x === Infinity) return '∞';
  const b = typeof x === 'bigint' ? x : BigInt(Math.round(x));
  if (b < 10000n) return b.toString();
  if (b < 1000000n) {
    const k = Math.round(Number(b) / 100) / 10;
    if (k < 1000) return `${k}k`;
  }
  const [m, e] = sci(b, 1);
  return `${m}e${e}`;
}

export function cornerCount(spec) { return fVector(spec)[0]; }

// ---------- names, symbols, stories ----------

const simplexName = (N) => ['point', 'line', 'triangle', 'tetrahedron', '5-cell'][N] || `${N}-simplex`;
const cubeName = (N) => ['point', 'line', 'square', 'cube', 'tesseract'][N] || `${N}-cube`;
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const plural = (s) => (s.endsWith('simplex') ? s.slice(0, -2) + 'ices' : s + 's');

export function describe(spec) {
  const { fam, N } = spec;
  const d = {
    spec, dim: N, name: '', short: '', symbol: '', bounded: '', grows: '', dual: '', fact: '',
    family: fam === 'arch' ? null : ROWS[locate(spec).row],
  };
  if (fam === 'arch') {
    const a = ARCH_BY_ID[spec.a];
    const nm = a.grows ? a.name(N) : a.label;
    return Object.assign(d, {
      name: nm, short: nm.replace(' (rectified 16-cell)', ''), symbol: '', arch: a,
      bounded: '', grows: a.grows ? `${a.formula}. ${a.note}` : a.note,
      dual: '', fact: a.grows ? `Starts as the ${a.label.toLowerCase()} in 3D and follows the ${a.from} into every dimension.` : `${a.label}: one of the seven Archimedean solids that stop at 3D. ${a.cousin}`,
    });
  }
  const threes = (m) => (m <= 6 ? Array(m).fill('3').join(', ') : `3, 3, …, 3 (${m}×)`);
  switch (fam) {
    case 'point':
      Object.assign(d, { name: 'Point', short: 'Dot', symbol: '—', bounded: 'nothing: it is the starting point of every shape',
        grows: 'Every shape starts here. Drag the dot sideways and you get a line.', dual: 'itself',
        fact: 'One corner, no edges. The dot stays in the picture in every dimension: it is every shape\'s first corner.' });
      break;
    case 'line':
      Object.assign(d, { name: 'Line segment', short: 'Line', symbol: '{ }', bounded: '2 end points',
        grows: 'Drag the dot along a new direction. The simplex, cross-polytope and hypercube all agree here: 2 corners.', dual: 'itself',
        fact: 'The first split happens in the next step, at 2D, where the three paths part company.' });
      break;
    case 'polygon': {
      const n = Math.round(spec.n);
      const nm = { 3: 'Triangle', 4: 'Square', 5: 'Pentagon', 6: 'Hexagon', 7: 'Heptagon', 8: 'Octagon', 9: 'Nonagon', 10: 'Decagon', 12: 'Dodecagon' }[n];
      Object.assign(d, {
        name: nm || `${n}-gon`, short: nm || `${n}-gon`, symbol: `{${n}}`,
        bounded: `${n} straight edges`,
        grows: 'The only dimension with infinitely many regular shapes: any number of sides from 3 upward. At 600 sides it is almost a circle.',
        dual: 'another polygon with the same number of sides',
        fact: n === 3 ? 'Start of the simplex path: add one corner above the line.' : n === 4 ? 'The square is both the 2D hypercube and the 2D cross-polytope, so those two paths share this cell.'
          : n === 5 ? 'The pentagon opens the icosahedron and dodecahedron paths.' : 'Move the slider to change the number of sides.',
      });
      break;
    }
    case 'simplex':
      Object.assign(d, {
        name: N === 3 ? 'Tetrahedron' : N === 4 ? '5-cell (4-simplex)' : `${N}-simplex`, short: cap(simplexName(N)),
        symbol: `{${threes(N - 1)}}`, bounded: N >= 3 ? `${N + 1} ${N === 3 ? 'triangles' : N === 4 ? 'tetrahedra' : plural(simplexName(N - 1))}` : '',
        grows: 'Add one new corner above the last shape and join it to every corner. So the corner count goes up by one each dimension: 1, 2, 3, 4, 5, 6…',
        dual: 'itself (self-dual)', fact: `${N + 1} corners and every pair of corners is joined by an edge.`,
      });
      break;
    case 'cross':
      Object.assign(d, {
        name: N === 3 ? 'Octahedron' : N === 4 ? '16-cell' : `${N}-orthoplex`, short: N === 3 ? 'Octahedron' : N === 4 ? '16-cell' : `${N}-cross`,
        symbol: `{${N === 2 ? '4' : threes(N - 2) + ', 4'}}`,
        bounded: `${fmt(2n ** BigInt(N))} ${N === 3 ? 'triangles' : N === 4 ? 'tetrahedra' : plural(simplexName(N - 1))}`,
        grows: 'Put two new corners on the new axis, one each way, and join them to every other corner. The corner count goes up by two each dimension: 2, 4, 6, 8, 10…',
        dual: `the ${cubeName(N)}`, fact: `One pair of opposite corners per axis: ${2 * N} corners. Every corner is joined to all but its opposite.`,
      });
      break;
    case 'cube':
      Object.assign(d, {
        name: N === 3 ? 'Cube' : N === 4 ? 'Tesseract (8-cell)' : `${N}-cube`, short: cap(cubeName(N)),
        symbol: `{4${N > 2 ? ', ' + threes(N - 2) : ''}}`,
        bounded: `${2 * N} ${N === 3 ? 'squares' : plural(cubeName(N - 1))}`,
        grows: 'Slide the last shape along a new direction and join matching corners. The corner count doubles each dimension: 1, 2, 4, 8, 16, 32…',
        dual: N === 2 ? 'itself' : `the ${N === 3 ? 'octahedron' : N === 4 ? '16-cell' : `${N}-orthoplex`}`,
        fact: `Each corner is a choice of ± along ${N} axes: 2 to the power ${N}.`,
      });
      break;
    case 'ico':
      Object.assign(d, N === 3 ? {
        name: 'Icosahedron', short: 'Icosahedron', symbol: '{3, 5}', bounded: '20 triangles',
        grows: 'Five triangles meet at every corner.', dual: 'the dodecahedron. The icosahedron has 12 corners and 20 faces; the dodecahedron has 20 corners and 12 faces. The numbers swap.',
        fact: '12 corners. Its 4D cousin has 120.',
      } : {
        name: '600-cell', short: '600-cell', symbol: '{3, 3, 5}', bounded: '600 tetrahedra',
        grows: 'Five tetrahedra meet at every edge. The biggest of the six 4D shapes by cell count.', dual: 'the 120-cell. The 600-cell has 120 corners and 600 cells; the 120-cell has 600 corners and 120 cells. The numbers swap.',
        fact: '120 corners and 600 cells. Nothing further exists in 5D.',
      });
      break;
    case 'dodeca':
      Object.assign(d, N === 3 ? {
        name: 'Dodecahedron', short: 'Dodecahedron', symbol: '{5, 3}', bounded: '12 pentagons',
        grows: 'Three pentagons meet at every corner.', dual: 'the icosahedron. The dodecahedron has 20 corners and 12 faces; the icosahedron has 12 corners and 20 faces. The numbers swap.',
        fact: '20 corners. Its 4D cousin has 600.',
      } : {
        name: '120-cell', short: '120-cell', symbol: '{5, 3, 3}', bounded: '120 dodecahedra',
        grows: 'Three dodecahedra meet at every edge.', dual: 'the 600-cell. The 120-cell has 600 corners and 120 cells; the 600-cell has 120 corners and 600 cells. The numbers swap.',
        fact: '600 corners, the most corners of any regular 4D shape. Nothing further exists in 5D.',
      });
      break;
    case 'c24':
      Object.assign(d, {
        name: '24-cell', short: '24-cell', symbol: '{3, 4, 3}', bounded: '24 octahedra',
        grows: 'The only regular shape that exists in a single dimension. Its 3D relative is the cuboctahedron: take the edge midpoints of the cross-polytope. In 3D that gives a semi-regular solid with 12 corners; in 4D it gives the 24-cell, fully regular. In 5D and up the same rule is semi-regular again.',
        dual: 'itself (self-dual)', fact: '24 corners, 96 edges, 96 triangles, 24 octahedral cells.',
      });
      break;
  }
  return d;
}

// The counting sequence for a family: corners in dimension 0, 1, 2, 3…
export function sequence(rowId, upTo = 9) {
  const out = [];
  for (let n = 0; n <= upTo; n++) {
    let v = null;
    if (rowId === 'simplex') v = BigInt(n + 1);
    else if (rowId === 'cross') v = n === 0 ? null : BigInt(2 * n);
    else if (rowId === 'cube') v = 2n ** BigInt(n);
    else if (rowId === 'ico') v = n === 2 ? 5n : n === 3 ? 12n : n === 4 ? 120n : null;
    else if (rowId === 'dodeca') v = n === 2 ? 5n : n === 3 ? 20n : n === 4 ? 600n : null;
    else if (rowId === 'c24') v = n === 4 ? 24n : null;
    else if (rowId === 'polygon') v = n === 2 ? 'n' : null;
    out.push({ dim: n, value: v });
  }
  return out;
}
