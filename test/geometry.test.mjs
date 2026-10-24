import assert from 'node:assert/strict';
import { buildShape, CUBE_CAP, buildStandIn, cacheInfo } from '../src/geometry.js';
import { fVector, cellsForColumn, countInColumn, MAX_D, ARCH } from '../src/catalog.js';

let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };

function check(spec, label) {
  const s = buildShape(spec);
  const f = fVector(spec);
  const { nv, d, V, edges } = s;
  const real = s.sampled ? null : f; // sampled hypercubes are checked against the capped cube instead
  const f2 = s.sampled ? fVector({ fam: 'cube', N: s.sampled.shownN }) : real;

  ok(BigInt(nv) === f2[0], `${label}: corners ${nv} vs ${f2[0]}`);
  ok(BigInt(edges.length / 2) === (f2.length > 1 ? f2[1] : (spec.fam === 'line' ? 1n : 0n)) || spec.fam === 'line' || spec.fam === 'point',
    `${label}: edges ${edges.length / 2} vs ${f2[1]}`);

  // every corner on the unit sphere
  for (let i = 0; i < nv; i++) {
    let r = 0; for (let j = 0; j < d; j++) r += V[i * d + j] ** 2;
    ok(Math.abs(Math.sqrt(r) - 1) < 1e-9 || nv === 1, `${label}: corner ${i} radius`);
  }

  // all edges the same length, and no two corners closer than that (regularity)
  if (edges.length) {
    const len = (a, b) => { let t = 0; for (let j = 0; j < d; j++) t += (V[a * d + j] - V[b * d + j]) ** 2; return Math.sqrt(t); };
    const L = len(edges[0], edges[1]);
    for (let i = 0; i < edges.length; i += 2) ok(Math.abs(len(edges[i], edges[i + 1]) - L) < 1e-9, `${label}: uneven edge`);
    if (nv <= 700) {
      let min = Infinity;
      for (let a = 0; a < nv; a++) for (let b = a + 1; b < nv; b++) min = Math.min(min, len(a, b));
      ok(Math.abs(min - L) < 1e-9, `${label}: shortest distance ${min} is not the edge length ${L}`);
    }
  }

  // vertex degree is constant
  if (edges.length) {
    const deg = new Array(nv).fill(0);
    for (let i = 0; i < edges.length; i++) deg[edges[i]]++;
    ok(deg.every((x) => x === deg[0]), `${label}: degree not constant`);
  }

  // faces
  if (s.faces) {
    if (f2.length > 2) ok(BigInt(s.faces.length) === f2[2] || s.fam === 'polygon', `${label}: faces ${s.faces.length} vs ${f2[2]}`);
    const edgeSet = new Set();
    for (let i = 0; i < edges.length; i += 2) edgeSet.add(`${Math.min(edges[i], edges[i + 1])},${Math.max(edges[i], edges[i + 1])}`);
    for (const face of s.faces) {
      for (let i = 0; i < face.length; i++) {
        const a = face[i], b = face[(i + 1) % face.length];
        ok(edgeSet.has(`${Math.min(a, b)},${Math.max(a, b)}`), `${label}: face side ${a}-${b} is not an edge`);
      }
    }
  }
  return s;
}

// every cell in the table, for the shapes we can actually build
for (let col = 0; col <= 14; col++) {
  for (const c of cellsForColumn(col)) {
    if (c.kind !== 'shape') continue;
    const spec = c.spec.free ? { ...c.spec, n: 7 } : c.spec;
    check(spec, `D${col} ${spec.fam}${spec.n ? '-' + spec.n : ''}`);
  }
}

// Euler's formula
function euler(spec, expected) {
  const f = fVector(spec);
  let sum = 0n;
  f.forEach((x, k) => { sum += (k % 2 === 0 ? 1n : -1n) * x; });
  ok(sum === expected, `Euler for ${spec.fam}${spec.N}: ${sum}`);
}
for (const spec of [
  { fam: 'simplex', N: 3 }, { fam: 'cube', N: 3 }, { fam: 'cross', N: 3 }, { fam: 'ico', N: 3 }, { fam: 'dodeca', N: 3 },
]) euler(spec, 2n);                   // 3D: V - E + F = 2
for (const spec of [
  { fam: 'simplex', N: 4 }, { fam: 'cube', N: 4 }, { fam: 'cross', N: 4 }, { fam: 'ico', N: 4 }, { fam: 'dodeca', N: 4 }, { fam: 'c24', N: 4 },
]) euler(spec, 0n);                   // 4D: V - E + F - C = 0
for (const N of [5, 7, 10, 25, 100, 600]) {
  const want = N % 2 === 0 ? 0n : 2n; // general rule: sum of (-1)^k f_k = 1 - (-1)^N
  euler({ fam: 'simplex', N }, want); euler({ fam: 'cube', N }, want); euler({ fam: 'cross', N }, want);
}

// the user's three counting rules, straight from the catalog
const corners = (fam, N) => fVector({ fam, N })[0];
ok([...Array(8)].map((_, i) => corners('simplex', i + 1)).join() === '2,3,4,5,6,7,8,9', 'simplex +1');
ok([...Array(5)].map((_, i) => corners('cross', i + 1)).join() === '2,4,6,8,10', 'cross +2');
ok([...Array(6)].map((_, i) => corners('cube', i + 1)).join() === '2,4,8,16,32,64', 'cube doubles');
ok(corners('cube', 600) === 2n ** 600n, '2^600');
ok(corners('cross', 600) === 1200n && corners('simplex', 600) === 601n, 'D600 counts');

// duals swap their counts
const [ico3v, , ico3f] = fVector({ fam: 'ico', N: 3 }), [dod3v, , dod3f] = fVector({ fam: 'dodeca', N: 3 });
ok(ico3v === dod3f && ico3f === dod3v, 'icosahedron/dodecahedron swap');
const a = fVector({ fam: 'ico', N: 4 }), b = fVector({ fam: 'dodeca', N: 4 });
ok(a[0] === b[3] && a[3] === b[0] && a[1] === b[2] && a[2] === b[1], '600-cell/120-cell swap');

// existence counts
ok([0, 1, 2, 3, 4, 5, 6, 300, MAX_D].map(countInColumn).join() === '1,1,Infinity,5,6,3,3,3,3', 'shapes per dimension');
for (let c = 5; c <= MAX_D; c++) ok(cellsForColumn(c).filter((x) => x.kind === 'shape').length === 3, `D${c} has three shapes`);

// capped cube
const big = buildShape({ fam: 'cube', N: 600 });
ok(big.sampled && big.sampled.shownN === CUBE_CAP && big.nv === 2 ** CUBE_CAP, 'capped cube');

// Archimedean solids: uniform (equal edges, equal degree, nothing closer than an edge), counts match the formulas
const known3 = { tt: [12, 18, 8], co: [12, 24, 14], tc: [24, 36, 14], to: [24, 36, 14], rco: [24, 48, 26], tco: [48, 72, 26], sc: [24, 60, 38],
  id: [30, 60, 32], ti: [60, 90, 32], td: [60, 90, 32], rid: [60, 120, 62], tid: [120, 180, 62], sd: [60, 150, 92] };
for (const a of ARCH) {
  check({ fam: 'arch', a: a.id, N: 3 }, `${a.label}`);
  const f = fVector({ fam: 'arch', a: a.id, N: 3 });
  ok(f.map(Number).join() === known3[a.id].join(), `${a.label}: ${f.join()} vs ${known3[a.id].join()}`);
  if (a.grows) for (let N = 4; N <= 7 && Number(fVector({ fam: 'arch', a: a.id, N })[0]) <= 5040; N++) check({ fam: 'arch', a: a.id, N }, `${a.label} ${N}D`);
}
const c24 = buildShape({ fam: 'arch', a: 'co', N: 4 });
ok(c24.nv === 24 && c24.edges.length / 2 === 96, 'the 4D cuboctahedron family member is the 24-cell');

// big shapes find their edges with boxes, not every pair: the answer must be identical, in the same order
const bruteEdges = (S) => {
  const D = (a, b) => { let t = 0; for (let j = 0; j < S.d; j++) { const u = S.V[a * S.d + j] - S.V[b * S.d + j]; t += u * u; } return t; };
  let min = Infinity; for (let j = 1; j < S.nv; j++) min = Math.min(min, D(0, j));
  const out = []; for (let a = 0; a < S.nv; a++) for (let b = a + 1; b < S.nv; b++) if (Math.abs(D(a, b) - min) < min * 1e-6) out.push(a, b);
  return out;
};
for (const [a, N] of [['to', 6], ['tco', 5], ['rco', 7], ['rco', 8], ['tc', 8]]) {
  const S = buildShape({ fam: 'arch', a, N }), r = bruteEdges(S);
  ok(r.length === S.edges.length && r.every((x, i) => x === S.edges[i]), `${a}${N}: box edges match every-pair edges`);
}
{
  const t0 = performance.now(), S = buildShape({ fam: 'arch', a: 'tco', N: 6 }), ms = performance.now() - t0;
  ok(S.nv === 46080 && S.edges.length / 2 === 46080 * 6 / 2, 'omnitruncated 6-cube: 46,080 corners, 138,240 edges');
  ok(ms < 3000, `omnitruncated 6-cube builds quickly (${ms.toFixed(0)} ms)`);
}
// the stand-in circle, and the cache staying inside its memory bound
const ring = buildStandIn(360);
ok(ring.nv === 360 && ring.N === 2 && ring.edges.length > 360 * 2, 'stand-in: 360 dots on a ring, criss-crossed');
for (let i = 0; i < ring.edges.length; i++) ok(ring.edges[i] < 360, 'stand-in edge in range');
ok(cacheInfo().bytes <= 96 * 1024 * 1024 && cacheInfo().shapes <= 48, `cache bounded: ${cacheInfo().shapes} shapes, ${(cacheInfo().bytes / 1e6).toFixed(0)} MB`);

console.log(`geometry: ${checks} checks passed`);
