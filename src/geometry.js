// geometry.js — pure maths for the regular convex polytopes. No DOM, no three.js.
//
// Every builder returns:
//   { fam, N, d, nv, V, edges, faces, sampled? }
//   N      intrinsic dimension of the shape
//   d      number of coordinates stored per corner (== N except for the capped hypercube)
//   V      Float64Array(nv * d), every corner on the unit sphere
//   edges  Uint32Array of corner-index pairs
//   faces  array of corner-index loops (2-faces), or null when there are too many to draw

export const PHI = (1 + Math.sqrt(5)) / 2;
export const CUBE_CAP = 12;        // biggest hypercube we really build: 2^12 = 4096 corners
export const FACE_BUDGET = 3000;   // max triangles we are willing to draw for translucent faces

// ---------- exact counting (BigInt) ----------

export function binom(n, k) {
  n = BigInt(n); k = BigInt(k);
  if (k < 0n || k > n) return 0n;
  if (k > n - k) k = n - k;
  let r = 1n;
  for (let i = 1n; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}

// ---------- small helpers ----------

function toUnit(V, nv, d) {
  for (let i = 0; i < nv; i++) {
    let s = 0;
    for (let j = 0; j < d; j++) s += V[i * d + j] * V[i * d + j];
    s = Math.sqrt(s) || 1;
    for (let j = 0; j < d; j++) V[i * d + j] /= s;
  }
}

function dist2(V, d, a, b) {
  let s = 0;
  for (let j = 0; j < d; j++) { const t = V[a * d + j] - V[b * d + j]; s += t * t; }
  return s;
}

// All our polytopes are vertex-transitive, so the edge length is the
// smallest distance from corner 0 to any other corner.
function edgesByMinDistance(V, nv, d) {
  let min = Infinity;
  for (let j = 1; j < nv; j++) min = Math.min(min, dist2(V, d, 0, j));
  const tol = min * 1e-6;
  if (nv > GRID_FROM) return edgesByGrid(V, nv, d, min, tol);
  const out = [];
  for (let a = 0; a < nv; a++)
    for (let b = a + 1; b < nv; b++)
      if (Math.abs(dist2(V, d, a, b) - min) < tol) out.push(a, b);
  return Uint32Array.from(out);
}

// Same answer, same order, without comparing every pair: drop the corners into boxes one edge wide
// (using the first few coordinates) and only compare corners in neighbouring boxes.
const GRID_FROM = 1500;
function edgesByGrid(V, nv, d, min, tol) {
  const L = Math.sqrt(min) * (1 + 1e-6), k = Math.min(d, 4), R = Math.ceil(2 / L) + 3;
  const cellOf = (i, j) => Math.floor((V[i * d + j] + 1) / L) + 1;
  const boxes = new Map(), keys = new Float64Array(nv);
  for (let i = 0; i < nv; i++) {
    let key = 0;
    for (let j = 0; j < k; j++) key = key * R + cellOf(i, j);
    keys[i] = key;
    const box = boxes.get(key);
    if (box) box.push(i); else boxes.set(key, [i]);
  }
  const offsets = [0];
  for (let j = 0; j < k; j++) { const next = []; for (const o of offsets) for (const s of [-1, 0, 1]) next.push(o * R + s); offsets.splice(0, offsets.length, ...next); }
  // offsets were built most-significant first, matching the key, so key + offset is the neighbour box
  const out = [], near = [];
  for (let a = 0; a < nv; a++) {
    near.length = 0;
    for (const o of offsets) {
      const box = boxes.get(keys[a] + o);
      if (box) for (const b of box) if (b > a && Math.abs(dist2(V, d, a, b) - min) < tol) near.push(b);
    }
    near.sort((x, y) => x - y);
    for (const b of near) out.push(a, b);
  }
  return Uint32Array.from(out);
}

function graphOf(nv, edges) {
  const adj = Array.from({ length: nv }, () => []);
  const mat = new Uint8Array(nv * nv);
  for (let i = 0; i < edges.length; i += 2) {
    const a = edges[i], b = edges[i + 1];
    adj[a].push(b); adj[b].push(a);
    mat[a * nv + b] = 1; mat[b * nv + a] = 1;
  }
  return { adj, mat };
}

function triangles(nv, g) {
  const out = [];
  for (let a = 0; a < nv; a++)
    for (const b of g.adj[a]) {
      if (b <= a) continue;
      for (const c of g.adj[b]) if (c > b && g.mat[a * nv + c]) out.push([a, b, c]);
    }
  return out;
}

function tetrahedra(nv, g, tris) {
  const out = [];
  for (const [a, b, c] of tris)
    for (const d of g.adj[a])
      if (d > c && g.mat[b * nv + d] && g.mat[c * nv + d]) out.push([a, b, c, d]);
  return out;
}

// Walk a set of items into a cycle, given a neighbour test.
function orderCycle(items, isNeighbour) {
  const order = [items[0]];
  const used = new Set([items[0]]);
  while (order.length < items.length) {
    const last = order[order.length - 1];
    const next = items.find((x) => !used.has(x) && isNeighbour(last, x));
    if (next === undefined) break;
    order.push(next); used.add(next);
  }
  return order;
}

function centroidsUnit(loops, V, d) {
  const out = new Float64Array(loops.length * d);
  loops.forEach((loop, i) => {
    for (const v of loop) for (let j = 0; j < d; j++) out[i * d + j] += V[v * d + j];
  });
  toUnit(out, loops.length, d);
  return out;
}

const key = (arr) => arr.slice().sort((x, y) => x - y).join(',');

// ---------- point, line, polygons ----------

export function buildPoint() {
  return { fam: 'point', N: 0, d: 0, nv: 1, V: new Float64Array(0), edges: new Uint32Array(0), faces: null };
}

export function buildLine() {
  return { fam: 'line', N: 1, d: 1, nv: 2, V: Float64Array.of(-1, 1), edges: Uint32Array.of(0, 1), faces: null };
}

export function buildPolygon(n) {
  n = Math.max(3, Math.round(n));
  const V = new Float64Array(n * 2);
  const edges = new Uint32Array(n * 2);
  for (let k = 0; k < n; k++) {
    const a = (2 * Math.PI * k) / n;
    V[2 * k] = Math.cos(a); V[2 * k + 1] = Math.sin(a);
    edges[2 * k] = k; edges[2 * k + 1] = (k + 1) % n;
  }
  return { fam: 'polygon', N: 2, d: 2, n, nv: n, V, edges, faces: [Array.from({ length: n }, (_, i) => i)] };
}

// ---------- the three families that exist in every dimension ----------

export function buildSimplex(N) {
  const nv = N + 1, d = N;
  const V = new Float64Array(nv * d);
  // Helmert basis: exact N-dimensional coordinates for the N+1 corners.
  for (let j = 1; j <= N; j++) {
    const s = 1 / Math.sqrt(j * (j + 1));
    for (let i = 0; i < nv; i++) V[i * d + (j - 1)] = i < j ? s : i === j ? -j * s : 0;
  }
  toUnit(V, nv, d);
  const edges = new Uint32Array((nv * (nv - 1)));
  let p = 0;
  for (let a = 0; a < nv; a++) for (let b = a + 1; b < nv; b++) { edges[p++] = a; edges[p++] = b; }
  let faces = null;
  if (Number(binom(nv, 3)) <= FACE_BUDGET) {
    faces = [];
    for (let a = 0; a < nv; a++) for (let b = a + 1; b < nv; b++) for (let c = b + 1; c < nv; c++) faces.push([a, b, c]);
  }
  return { fam: 'simplex', N, d, nv, V, edges, faces, poleHint: N === 4 ? [-V[0], -V[1], -V[2], -V[3]] : null };
}

export function buildCross(N) {
  const nv = 2 * N, d = N;
  const V = new Float64Array(nv * d);
  for (let i = 0; i < N; i++) { V[(2 * i) * d + i] = 1; V[(2 * i + 1) * d + i] = -1; }
  const edges = new Uint32Array(nv * (nv - 1) - 2 * N);
  let p = 0;
  for (let a = 0; a < nv; a++)
    for (let b = a + 1; b < nv; b++) {
      if ((a ^ 1) === b) continue; // antipodal corners are not joined
      edges[p++] = a; edges[p++] = b;
    }
  let faces = null;
  if (8 * Number(binom(N, 3)) <= FACE_BUDGET) {
    faces = [];
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) for (let k = j + 1; k < N; k++)
      for (let s = 0; s < 8; s++) faces.push([2 * i + (s & 1), 2 * j + ((s >> 1) & 1), 2 * k + ((s >> 2) & 1)]);
  }
  return { fam: 'cross', N, d, nv, V, edges, faces, poleHint: N === 4 ? [0.5, 0.5, 0.5, 0.5] : null };
}

export function buildCube(N) {
  const shown = Math.min(N, CUBE_CAP);
  const nv = 1 << shown, d = shown;
  const V = new Float64Array(nv * d);
  const s = 1 / Math.sqrt(shown);
  for (let v = 0; v < nv; v++) for (let j = 0; j < shown; j++) V[v * d + j] = ((v >> j) & 1 ? 1 : -1) * s;
  const edges = new Uint32Array(shown * (nv / 2) * 2);
  let p = 0;
  for (let v = 0; v < nv; v++) for (let j = 0; j < shown; j++) { const w = v ^ (1 << j); if (v < w) { edges[p++] = v; edges[p++] = w; } }
  let faces = null;
  if (shown >= 2 && 2 * Number(binom(shown, 2)) * 2 ** (shown - 2) <= FACE_BUDGET) {
    faces = [];
    for (let j = 0; j < shown; j++) for (let k = j + 1; k < shown; k++)
      for (let v = 0; v < nv; v++) {
        if ((v >> j) & 1 || (v >> k) & 1) continue;
        faces.push([v, v | (1 << j), v | (1 << j) | (1 << k), v | (1 << k)]);
      }
  }
  const out = { fam: 'cube', N, d, nv, V, edges, faces };
  if (N === 4) out.poleHint = [1, 0, 0, 0];
  if (shown < N) out.sampled = { shownN: shown, realN: N };
  return out;
}

// ---------- the pentagon family and the lone 24-cell ----------

export function buildIco() {
  const raw = [];
  for (const s1 of [1, -1]) for (const s2 of [1, -1]) {
    raw.push(0, s1, s2 * PHI, s1, s2 * PHI, 0, s2 * PHI, 0, s1);
  }
  const V = Float64Array.from(raw);
  toUnit(V, 12, 3);
  const edges = edgesByMinDistance(V, 12, 3);
  const g = graphOf(12, edges);
  return { fam: 'ico', N: 3, d: 3, nv: 12, V, edges, faces: triangles(12, g) };
}

export function buildDodeca() {
  const ico = buildIco();
  const tris = ico.faces;                       // 20 triangles -> 20 corners
  const V = centroidsUnit(tris, ico.V, 3);
  const edgeList = [];
  for (let a = 0; a < tris.length; a++)
    for (let b = a + 1; b < tris.length; b++)
      if (tris[a].filter((x) => tris[b].includes(x)).length === 2) edgeList.push(a, b);
  const edges = Uint32Array.from(edgeList);
  const g = graphOf(tris.length, edges);
  const faces = [];
  for (let v = 0; v < ico.nv; v++) {            // each icosahedron corner -> one pentagon
    const around = tris.map((t, i) => (t.includes(v) ? i : -1)).filter((i) => i >= 0);
    faces.push(orderCycle(around, (x, y) => g.mat[x * tris.length + y] === 1));
  }
  return { fam: 'dodeca', N: 3, d: 3, nv: tris.length, V, edges, faces };
}

function evenPermutations4() {
  const out = [];
  const perms = [];
  const rec = (arr, rest) => {
    if (!rest.length) { perms.push(arr); return; }
    rest.forEach((x, i) => rec([...arr, x], rest.filter((_, j) => j !== i)));
  };
  rec([], [0, 1, 2, 3]);
  for (const p of perms) {
    let inv = 0;
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) if (p[i] > p[j]) inv++;
    if (inv % 2 === 0) out.push(p);
  }
  return out;
}

let cell600Cache = null;
function cell600Raw() {
  if (cell600Cache) return cell600Cache;
  const raw = [];
  for (let i = 0; i < 4; i++) for (const s of [1, -1]) { const v = [0, 0, 0, 0]; v[i] = s; raw.push(...v); }
  for (let m = 0; m < 16; m++) raw.push(...[0, 1, 2, 3].map((i) => ((m >> i) & 1 ? 0.5 : -0.5)));
  const vals = [PHI / 2, 0.5, 1 / (2 * PHI)];
  for (const p of evenPermutations4())
    for (let m = 0; m < 8; m++) {
      const v = [0, 0, 0, 0];
      for (let i = 0; i < 3; i++) v[p[i]] = ((m >> i) & 1 ? 1 : -1) * vals[i];
      raw.push(...v);                           // p[3] keeps the zero
    }
  const V = Float64Array.from(raw);
  toUnit(V, 120, 4);
  const edges = edgesByMinDistance(V, 120, 4);
  const g = graphOf(120, edges);
  const tris = triangles(120, g);
  const tets = tetrahedra(120, g, tris);
  cell600Cache = { V, edges, tris, tets };
  return cell600Cache;
}

export function build600() {
  const c = cell600Raw();
  const hint = [0, 0, 0, 0];
  for (const v of c.tets[0]) for (let j = 0; j < 4; j++) hint[j] += c.V[v * 4 + j] / 4;
  return { fam: 'ico', N: 4, d: 4, nv: 120, V: c.V, edges: c.edges, faces: c.tris, poleHint: hint };
}

export function build120() {
  const c = cell600Raw();
  const tets = c.tets;                          // 600 tetrahedra -> 600 corners
  const V = centroidsUnit(tets, c.V, 4);
  const faceMap = new Map();                    // triangle -> the two tetrahedra sharing it
  const edgeMap = new Map();                    // 600-cell edge -> the five tetrahedra around it
  tets.forEach((t, i) => {
    for (let skip = 0; skip < 4; skip++) {
      const k = key(t.filter((_, j) => j !== skip));
      if (!faceMap.has(k)) faceMap.set(k, []);
      faceMap.get(k).push(i);
    }
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
      const k = key([t[a], t[b]]);
      if (!edgeMap.has(k)) edgeMap.set(k, []);
      edgeMap.get(k).push(i);
    }
  });
  const edgeList = [];
  for (const pair of faceMap.values()) edgeList.push(pair[0], pair[1]);
  const edges = Uint32Array.from(edgeList);
  const g = graphOf(tets.length, edges);
  const faces = [];
  for (const ring of edgeMap.values()) faces.push(orderCycle(ring, (x, y) => g.mat[x * tets.length + y] === 1));
  return { fam: 'dodeca', N: 4, d: 4, nv: tets.length, V, edges, faces, poleHint: [1, 0, 0, 0] };
}

export function build24() {
  const raw = [];
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++)
    for (const si of [1, -1]) for (const sj of [1, -1]) { const v = [0, 0, 0, 0]; v[i] = si; v[j] = sj; raw.push(...v); }
  const V = Float64Array.from(raw);
  toUnit(V, 24, 4);
  const edges = edgesByMinDistance(V, 24, 4);
  const g = graphOf(24, edges);
  return { fam: 'c24', N: 4, d: 4, nv: 24, V, edges, faces: triangles(24, g), poleHint: [1, 0, 0, 0] };
}

// ---------- Archimedean solids and their higher-dimensional families ----------
// a: tt truncated tetrahedron → truncated simplex, co cuboctahedron → rectified orthoplex (the 24-cell in 4D),
//    tc truncated cube → truncated hypercube, to truncated octahedron → permutohedron,
//    rco rhombicuboctahedron → cantellated hypercube, tco truncated cuboctahedron → omnitruncated hypercube,
//    and seven that stop at 3D: sc, id, ti, td, rid, tid, sd.

const SQ2 = Math.SQRT2;

// Every distinct ordering of a list (repeats allowed).
function multisetPerms(vals) {
  const out = [];
  const sorted = vals.slice().sort((x, y) => x - y);
  const used = new Array(sorted.length).fill(false);
  const cur = [];
  const rec = () => {
    if (cur.length === sorted.length) { out.push(cur.slice()); return; }
    for (let i = 0; i < sorted.length; i++) {
      if (used[i] || (i > 0 && sorted[i] === sorted[i - 1] && !used[i - 1])) continue;
      used[i] = true; cur.push(sorted[i]); rec(); cur.pop(); used[i] = false;
    }
  };
  rec();
  return out;
}

// Every ordering, then every sign on the non-zero entries.
function signedPerms(vals) {
  const out = [];
  for (const p of multisetPerms(vals)) {
    const nz = p.map((x, i) => (x !== 0 ? i : -1)).filter((i) => i >= 0);
    for (let m = 0; m < 1 << nz.length; m++) {
      const q = p.slice();
      nz.forEach((i, b) => { if ((m >> b) & 1) q[i] = -q[i]; });
      out.push(q);
    }
  }
  return out;
}

// Points in R^(N+1) that sum to a constant → exact N-dimensional coordinates (Helmert basis).
function dropSumAxis(pts, N) {
  return pts.map((x) => {
    const y = new Array(N).fill(0);
    for (let j = 1; j <= N; j++) {
      const s = 1 / Math.sqrt(j * (j + 1));
      let t = 0;
      for (let i = 0; i < j; i++) t += x[i];
      y[j - 1] = s * (t - j * x[j]);
    }
    return y;
  });
}

const evenPerms3 = [[0, 1, 2], [1, 2, 0], [2, 0, 1]];
const oddPerms3 = [[1, 0, 2], [0, 2, 1], [2, 1, 0]];
function evenPermSigned(rows) {             // even (cyclic) orderings of each row, every sign on non-zeros
  const out = [];
  for (const r of rows) for (const p of evenPerms3) {
    const base = p.map((i) => r[i]);
    for (const q of signedPerms(base).filter((q) => q.every((x, i) => Math.abs(x) === Math.abs(base[i])))) out.push(q);
  }
  return dedupe(out);
}
function dedupe(pts) {
  const seen = new Set(), out = [];
  for (const p of pts) { const k = p.map((x) => x.toFixed(9)).join(','); if (!seen.has(k)) { seen.add(k); out.push(p); } }
  return out;
}

// The rotation group of the icosahedron (60) or the cube (24), as 3×3 matrices.
function rotationGroup(kind) {
  const mul = (A, B) => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
  const rot = (ax, th) => {
    const n = Math.hypot(...ax), [x, y, z] = ax.map((v) => v / n), c = Math.cos(th), s = Math.sin(th), C = 1 - c;
    return [[c + x * x * C, x * y * C - z * s, x * z * C + y * s], [y * x * C + z * s, c + y * y * C, y * z * C - x * s], [z * x * C - y * s, z * y * C + x * s, c + z * z * C]];
  };
  const gens = kind === 'ico' ? [rot([0, 1, PHI], (2 * Math.PI) / 5), rot([1, 1, 1], (2 * Math.PI) / 3)] : [rot([0, 0, 1], Math.PI / 2), rot([1, 1, 1], (2 * Math.PI) / 3)];
  const k = (M) => M.flat().map((v) => Math.round(v * 1e6) + 0).join(',');
  const group = [[[1, 0, 0], [0, 1, 0], [0, 0, 1]]], seen = new Set([k(group[0])]);
  for (let i = 0; i < group.length; i++) for (const g of gens) {
    const M = mul(group[i], g);
    if (!seen.has(k(M))) { seen.add(k(M)); group.push(M); }
  }
  return group;
}

// Snub: the point inside the symmetry triangle whose three rotated copies are all one edge away.
// |p − R(2π/k)p| = 2·sin(π/k)·(distance from p to the axis), so solve sin(π/a)·r_a = sin(π/3)·r_3 = r_2.
function snubPoints(kind) {
  const nrm = (v) => { const n = Math.hypot(...v); return v.map((x) => x / n); };
  const [A, B, C] = kind === 'ico'
    ? [nrm([0, 1, PHI]), nrm([PHI / 3, 0, (2 * PHI + 1) / 3]), nrm([0, 0, PHI])]
    : [nrm([0, 0, 1]), nrm([1, 1, 1]), nrm([1, 0, 1])];
  const ka = kind === 'ico' ? 5 : 4;
  const axisDist = (p, a) => Math.sqrt(Math.max(0, 1 - (p[0] * a[0] + p[1] * a[1] + p[2] * a[2]) ** 2));
  const P = (u, v) => nrm([0, 1, 2].map((i) => A[i] * (1 - u - v) + B[i] * u + C[i] * v));
  const err = (u, v) => {
    const p = P(u, v);
    const x = Math.sin(Math.PI / ka) * axisDist(p, A), y = Math.sin(Math.PI / 3) * axisDist(p, B), z = axisDist(p, C);
    return (x - y) ** 2 + (y - z) ** 2;
  };
  let u = 1 / 3, v = 1 / 3, step = 0.1;           // pattern search, deterministic
  while (step > 1e-15) {
    let moved = false;
    for (const [du, dv] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      const nu = u + du * step, nv = v + dv * step;
      if (nu < 0 || nv < 0 || nu + nv > 1) continue;
      if (err(nu, nv) < err(u, v)) { u = nu; v = nv; moved = true; break; }
    }
    if (!moved) step /= 2;
  }
  const p = P(u, v);
  return rotationGroup(kind).map((M) => M.map((r) => r[0] * p[0] + r[1] * p[1] + r[2] * p[2]));
}

function archPoints(a, N) {
  const ones = (n, x) => new Array(Math.max(0, n)).fill(x);
  const t = 1 + SQ2;
  const f = PHI, f2 = PHI * PHI, f3 = PHI * PHI * PHI;
  switch (a) {
    case 'tt': return dropSumAxis(multisetPerms([...ones(N - 1, 0), 1, 2]), N);
    case 'to': return dropSumAxis(multisetPerms(Array.from({ length: N + 1 }, (_, i) => i)), N);
    case 'co': return signedPerms([1, 1, ...ones(N - 2, 0)]);
    case 'tc': return signedPerms([1, ...ones(N - 1, t)]);
    case 'rco': return signedPerms([1, 1, ...ones(N - 2, t)]);
    case 'tco': return signedPerms(Array.from({ length: N }, (_, i) => 1 + i * SQ2));
    case 'sc': return snubPoints('oct');
    case 'sd': return snubPoints('ico');
    case 'id': return evenPermSigned([[0, 0, f], [0.5, f / 2, f2 / 2]]);
    case 'ti': return evenPermSigned([[0, 1, 3 * f], [1, 2 + f, 2 * f], [f, 2, f3]]);
    case 'td': return evenPermSigned([[0, 1 / f, 2 + f], [1 / f, f, 2 * f], [f, 2, f + 1]]);
    case 'rid': return evenPermSigned([[1, 1, f3], [f2, f, 2 * f], [2 + f, 0, f2]]);
    case 'tid': return evenPermSigned([[1 / f, 1 / f, 3 + f], [2 / f, f, 1 + 2 * f], [1 / f, f2, -1 + 3 * f], [2 * f - 1, 2, 2 + f], [f, 3, 2 * f]]);
  }
  throw new Error('unknown Archimedean ' + a);
}

export function buildArch(a, N) {
  const pts = archPoints(a, N);
  const nv = pts.length, d = N;
  const V = new Float64Array(nv * d);
  pts.forEach((p, i) => { for (let j = 0; j < d; j++) V[i * d + j] = p[j]; });
  toUnit(V, nv, d);
  const edges = edgesByMinDistance(V, nv, d);
  return { fam: 'arch', a, N, d, nv, V, edges, faces: null, poleHint: N === 4 ? [1, 0, 0, 0] : null };
}

// ---------- the stand-in for shapes too big to build ----------
// Seen flat, a polytope with this many corners puts them round a circle and fills it with criss-crossing edges.
// So we draw just that: n dots on a ring, each joined to a spread of others.

export function buildStandIn(n) {
  n = Math.max(12, Math.round(n));
  const V = new Float64Array(n * 2);
  for (let i = 0; i < n; i++) { const a = (2 * Math.PI * i) / n; V[2 * i] = Math.cos(a); V[2 * i + 1] = Math.sin(a); }
  const steps = [1];
  for (let k = 1; k <= 11; k++) steps.push(Math.max(2, Math.round((n / 2) * Math.pow(k / 11, 1.6))));
  const edges = [];
  for (const st of new Set(steps)) for (let i = 0; i < n; i++) { const j = (i + st) % n; if (st * 2 !== n || i < j) edges.push(i, j); }
  return { fam: 'standin', N: 2, d: 2, nv: n, V, edges: Uint32Array.from(edges), faces: null };
}

// ---------- dispatcher with a small cache ----------
// Bounded by memory, not by count: one big Archimedean shape can weigh as much as a hundred small ones.

const cache = new Map();
const CACHE_BYTES = 96 * 1024 * 1024;
let cacheBytes = 0;
const weight = (s) => s.V.byteLength + s.edges.byteLength + (s.faces ? s.faces.length * 48 : 0) + s.nv * 64;
export function cacheInfo() { return { shapes: cache.size, bytes: cacheBytes }; }
export function clearCache() { cache.clear(); cacheBytes = 0; }

export function buildShape(spec) {
  const k = spec.fam === 'polygon' ? `polygon:${Math.round(spec.n)}` : spec.fam === 'standin' ? `standin:${Math.round(spec.n)}` : spec.fam === 'arch' ? `arch:${spec.a}:${spec.N}` : `${spec.fam}:${spec.N}`;
  if (cache.has(k)) { const hit = cache.get(k); cache.delete(k); cache.set(k, hit); return hit; }   // most recent last
  let s;
  switch (spec.fam) {
    case 'point': s = buildPoint(); break;
    case 'line': s = buildLine(); break;
    case 'polygon': s = buildPolygon(spec.n); break;
    case 'simplex': s = buildSimplex(spec.N); break;
    case 'cross': s = buildCross(spec.N); break;
    case 'cube': s = buildCube(spec.N); break;
    case 'ico': s = spec.N === 3 ? buildIco() : build600(); break;
    case 'dodeca': s = spec.N === 3 ? buildDodeca() : build120(); break;
    case 'c24': s = build24(); break;
    case 'arch': s = buildArch(spec.a, spec.N); break;
    case 'standin': s = buildStandIn(spec.n); break;
    default: throw new Error('unknown shape ' + spec.fam);
  }
  const w = weight(s);
  while (cache.size && (cache.size >= 48 || cacheBytes + w > CACHE_BYTES)) {
    const [oldK, old] = cache.entries().next().value;
    cache.delete(oldK); cacheBytes -= weight(old);
  }
  if (w <= CACHE_BYTES) { cache.set(k, s); cacheBytes += w; }
  return s;
}
