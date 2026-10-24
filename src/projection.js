// projection.js — turns an N-dimensional shape into 3D points that three.js can draw.
//
// Modes
//   direct   N <= 3: the shape itself.   N >= 4: a rotating 3D shadow.
//   stereo   corners are pushed onto a sphere, rotated in 4D, then stereographically
//            projected into 3D. Edges become circular arcs (we sample the true great-circle arc).
//   petrie   flat "Petrie polygon" picture for the three families that exist in every dimension.
//
// Spinning is done by rotating the *viewing frame* (4 rows of length A) with small Givens rotations.
// That costs O(1) per rotation plane, and projecting a corner is a single 4 x A product.

export const EDGE_DRAW_CAP = 60000;    // most edges we draw while spinning
export const PETRIE_EDGE_CAP = 2700;   // beyond this a flat pattern turns into a white disc
export const POINT_BUDGET = 80000;     // total curve samples across all edges
export const MAX_SAMPLES = 24;         // segments per curved edge
// The live limits: lowered at start-up on a smaller computer (see budget.js).
export const LIMITS = { edges: EDGE_DRAW_CAP, points: POINT_BUDGET };
export function setLimits({ edges, points }) { LIMITS.edges = edges; LIMITS.points = points; }

const TAU = Math.PI * 2;

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

function givens(F, A, p, q, th) {
  const c = Math.cos(th), s = Math.sin(th);
  for (let r = 0; r < 4; r++) {
    const a = F[r * A + p], b = F[r * A + q];
    F[r * A + p] = a * c - b * s;
    F[r * A + q] = a * s + b * c;
  }
}

// Rotate two *rows* of the frame: a rotation in the viewer's own xw / yw / zw planes.
function rotateRows(F, A, p, q, th) {
  const c = Math.cos(th), s = Math.sin(th);
  for (let j = 0; j < A; j++) {
    const a = F[p * A + j], b = F[q * A + j];
    F[p * A + j] = a * c - b * s;
    F[q * A + j] = a * s + b * c;
  }
}

// The direction furthest from every corner (a "deep hole"): used when a shape has no hint.
function deepHole(V, nv, d) {
  const rand = rng(99);
  let best = null, bestDot = 2;
  for (let t = 0; t < 4000; t++) {
    const u = [0, 0, 0, 0];
    let n = 0;
    for (let j = 0; j < 4; j++) { u[j] = rand() + rand() + rand() - 1.5; n += u[j] * u[j]; }
    n = Math.sqrt(n);
    let worst = -2;
    for (let v = 0; v < nv && worst < bestDot; v++) {
      let dot = 0;
      for (let j = 0; j < d; j++) dot += V[v * d + j] * u[j] / n;
      if (dot > worst) worst = dot;
    }
    if (worst < bestDot) { bestDot = worst; best = u.map((x) => x / n); }
  }
  return best;
}

export function orthonormalize(F, A) {
  for (let r = 0; r < 4; r++) {
    for (let k = 0; k < r; k++) {
      let dot = 0;
      for (let j = 0; j < A; j++) dot += F[r * A + j] * F[k * A + j];
      for (let j = 0; j < A; j++) F[r * A + j] -= dot * F[k * A + j];
    }
    let n = 0;
    for (let j = 0; j < A; j++) n += F[r * A + j] ** 2;
    n = Math.sqrt(n) || 1;
    for (let j = 0; j < A; j++) F[r * A + j] /= n;
  }
}

// Colour ramp for depth along the 4th axis: deep blue -> white -> warm orange.
const RAMP = [[0.28, 0.5, 1.0], [0.92, 0.95, 1.0], [1.0, 0.58, 0.28]];
export function ramp(t, out, o) {
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const x = t * 2, i = x >= 1 ? 1 : 0, f = x - i;
  const a = RAMP[i], b = RAMP[i + 1];
  out[o] = a[0] + (b[0] - a[0]) * f;
  out[o + 1] = a[1] + (b[1] - a[1]) * f;
  out[o + 2] = a[2] + (b[2] - a[2]) * f;
}

export class ShapeView {
  constructor(shape, mode = 'direct') {
    this.shape = shape;
    const petrieOk = ['simplex', 'cross', 'cube'].includes(shape.fam) && shape.N >= 2;
    if (mode === 'petrie' && !petrieOk) mode = 'direct';
    this.mode = mode;
    this.nv = shape.nv;
    this.static = mode === 'petrie' || (mode === 'direct' && shape.N <= 3);
    this.fit = 1;

    // ---- which edges do we draw, and how finely ----
    const total = shape.edges.length / 2;
    const stride = Math.max(1, Math.ceil(total / (mode === 'petrie' ? PETRIE_EDGE_CAP : LIMITS.edges)));
    const ne = Math.ceil(total / stride);
    const ed = new Uint32Array(ne * 2);
    for (let e = 0, i = 0; e < total; e += stride, i++) { ed[2 * i] = shape.edges[2 * e]; ed[2 * i + 1] = shape.edges[2 * e + 1]; }
    this.ed = ed; this.ne = ne;
    this.info = { edgesTotal: total, edgesShown: ne, sampled: shape.sampled || null };
    const curved = mode === 'stereo' && shape.N >= 2 && ne > 0;
    this.k = curved ? Math.max(1, Math.min(MAX_SAMPLES, Math.floor(LIMITS.points / Math.max(1, ne)))) : 1;
    this.npts = this.nv + ne * (this.k - 1);

    // ---- segment index buffer ----
    const k = this.k;
    const idx = new Uint32Array(ne * k * 2);
    let p = 0;
    for (let e = 0; e < ne; e++) {
      const a = ed[2 * e], b = ed[2 * e + 1];
      let prev = a;
      for (let s = 1; s <= k; s++) {
        const cur = s === k ? b : this.nv + e * (k - 1) + (s - 1);
        idx[p++] = prev; idx[p++] = cur; prev = cur;
      }
    }
    this.index = idx;

    // ---- translucent faces (only when the corners are drawn as-is) ----
    this.faceIndex = null;
    if (k === 1 && shape.faces && mode !== 'petrie') {
      const tris = [];
      for (const f of shape.faces) for (let i = 1; i + 1 < f.length; i++) tris.push(f[0], f[i], f[i + 1]);
      if (tris.length / 3 <= 6000) this.faceIndex = Uint32Array.from(tris);
    }

    this.pos = new Float32Array(this.npts * 3);
    this.col = new Float32Array(this.npts * 3);

    if (mode === 'petrie') this._petrie();
    else if (this.static) this._staticDirect();
    else this._initDynamic();
  }

  // ---------- static pictures ----------

  _staticDirect() {
    const { shape, pos } = this, d = shape.d;
    let maxY = 1e-9;
    for (let i = 0; i < this.nv; i++) {
      for (let j = 0; j < 3; j++) pos[3 * i + j] = j < d ? shape.V[i * d + j] : 0;
      maxY = Math.max(maxY, Math.abs(pos[3 * i + 1]));
    }
    // a lone dot or a flat shape would otherwise be a single colour
    for (let i = 0; i < this.nv; i++) ramp(0.5 + 0.5 * (pos[3 * i + 1] / maxY) * 0.8, this.col, 3 * i);
    this.fit = 1;
  }

  _petrie() {
    const { shape, pos } = this;
    const nv = this.nv, N = shape.fam === 'cube' ? (shape.sampled ? shape.sampled.shownN : shape.N) : shape.N;
    let maxR = 1e-9;
    if (shape.fam === 'simplex') {
      for (let i = 0; i < nv; i++) { const a = (TAU * i) / nv; pos[3 * i] = Math.cos(a); pos[3 * i + 1] = Math.sin(a); }
    } else if (shape.fam === 'cross') {
      for (let i = 0; i < nv; i++) {
        const kk = (i & 1) ? (i >> 1) + N : i >> 1;          // order e1..en, -e1..-en
        const a = (Math.PI * kk) / N;
        pos[3 * i] = Math.cos(a); pos[3 * i + 1] = Math.sin(a);
      }
    } else {
      for (let v = 0; v < nv; v++) {
        let x = 0, y = 0;
        for (let j = 0; j < N; j++) { const s = (v >> j) & 1 ? 1 : -1, a = (Math.PI * j) / N; x += s * Math.cos(a); y += s * Math.sin(a); }
        pos[3 * v] = x; pos[3 * v + 1] = y; maxR = Math.max(maxR, Math.hypot(x, y));
      }
      for (let v = 0; v < nv; v++) { pos[3 * v] /= maxR; pos[3 * v + 1] /= maxR; }
    }
    for (let i = 0; i < nv; i++) ramp(0.5 + 0.5 * Math.atan2(pos[3 * i + 1], pos[3 * i]) / Math.PI, this.col, 3 * i);
    this.fit = 1;
  }

  // ---------- spinning N-dimensional views ----------

  _initDynamic() {
    const { shape } = this;
    const d = shape.d, A = Math.max(d, 4);
    this.A = A;
    const VA = new Float64Array(this.nv * A);
    for (let i = 0; i < this.nv; i++) for (let j = 0; j < d; j++) VA[i * A + j] = shape.V[i * d + j];
    this.VA = VA;
    this.y = new Float64Array(this.nv * 4);
    this.F = new Float64Array(4 * A);
    this.planes = [];
    this.frames = 0;

    if (A === 4) {
      // Row 3 of the frame is the projection pole. Put it at the middle of a cell, so the first
      // picture is the classic nested one and no corner sits on the pole.
      const pole = d < 4 ? [0, 0, 0, 1] : (shape.poleHint || deepHole(shape.V, this.nv, d));
      const F = this.F;
      const pn = Math.hypot(...pole);
      for (let j = 0; j < 4; j++) F[12 + j] = pole[j] / pn;
      let r = 0;                                        // complete to an orthonormal frame
      for (let c = 0; c < 4 && r < 3; c++) {
        const u = [0, 0, 0, 0]; u[c] = 1;
        for (const k of [3, ...Array.from({ length: r }, (_, i) => i)]) {
          let dot = 0; for (let j = 0; j < 4; j++) dot += u[j] * F[k * 4 + j];
          for (let j = 0; j < 4; j++) u[j] -= dot * F[k * 4 + j];
        }
        const n = Math.hypot(...u);
        if (n < 1e-3) continue;
        for (let j = 0; j < 4; j++) F[r * 4 + j] = u[j] / n;
        r++;
      }
      orthonormalize(F, 4);
      rotateRows(F, 4, 0, 1, 0.5); rotateRows(F, 4, 1, 2, 0.35);   // a pleasant 3D tilt
      this.rowPlanes = true;
      this.planes = [[0, 3, 0.30], [1, 3, 0.21], [2, 3, 0.15], [0, 1, 0.08], [1, 2, 0.05]];
    } else {
      const rand = rng(1234567 + A);
      for (let i = 0; i < 4 * A; i++) this.F[i] = rand() + rand() + rand() - 1.5;
      orthonormalize(this.F, A);
      const K = Math.min(48, A * 2);
      for (let i = 0; i < K; i++) {
        const p = Math.floor(rand() * A);
        let q = Math.floor(rand() * A);
        if (q === p) q = (q + 1) % A;
        this.planes.push([p, q, (0.08 + 0.3 * rand()) * (rand() < 0.5 ? -1 : 1)]);
      }
    }

    // edge sample weights along the great-circle arc between the two end corners
    const k = this.k, ne = this.ne;
    if (k > 1) {
      const w = new Float32Array(ne * (k - 1) * 2);
      for (let e = 0; e < ne; e++) {
        const a = this.ed[2 * e], b = this.ed[2 * e + 1];
        let dot = 0;
        for (let j = 0; j < d; j++) dot += shape.V[a * d + j] * shape.V[b * d + j];
        const om = Math.acos(Math.max(-1, Math.min(1, dot))), sn = Math.sin(om) || 1;
        for (let s = 1; s < k; s++) {
          const t = s / k;
          w[(e * (k - 1) + s - 1) * 2] = Math.sin((1 - t) * om) / sn;
          w[(e * (k - 1) + s - 1) * 2 + 1] = Math.sin(t * om) / sn;
        }
      }
      this.wts = w;
    }
    this.update(true);
  }

  step(dt) {
    if (this.static) return;
    const { F, A, planes } = this;
    if (this.rowPlanes) for (const [p, q, w] of planes) rotateRows(F, A, p, q, w * dt);
    else for (const [p, q, w] of planes) givens(F, A, p, q, w * dt);
    if (++this.frames % 300 === 0) orthonormalize(F, A);
  }

  // Map a 4-vector (already rotated) to 3D and write it, with depth colour.
  _put(y0, y1, y2, y3, o, cMax) {
    const stereo = this.mode === 'stereo';
    let x = y0, y = y1, z = y2;
    if (stereo) {
      const den = Math.sqrt((1 - y3) * (1 - y3) + 0.01);   // soft clamp: smooth as a corner crosses the pole
      x /= den; y /= den; z /= den;
    }
    const f = this.fit;
    x *= f; y *= f; z *= f;
    if (this.A === 4) {                                   // keep runaway corners on screen
      const r = Math.hypot(x, y, z);
      if (r > 8) { const s = 8 / r; x *= s; y *= s; z *= s; }
    }
    const pos = this.pos;
    pos[o] = x; pos[o + 1] = y; pos[o + 2] = z;
    ramp(0.5 + 0.5 * (y3 / cMax), this.col, o);
    return x * x + y * y + z * z;
  }

  update(first = false) {
    if (this.static) return;
    const { nv, A, F, VA, y } = this;
    let cMax = 1e-9;
    for (let v = 0; v < nv; v++) {
      const vo = v * A;
      let s0 = 0, s1 = 0, s2 = 0, s3 = 0;
      for (let j = 0; j < A; j++) {
        const t = VA[vo + j];
        if (t === 0) continue;
        s0 += F[j] * t; s1 += F[A + j] * t; s2 += F[2 * A + j] * t; s3 += F[3 * A + j] * t;
      }
      y[4 * v] = s0; y[4 * v + 1] = s1; y[4 * v + 2] = s2; y[4 * v + 3] = s3;
      if (Math.abs(s3) > cMax) cMax = Math.abs(s3);
    }
    if (A === 4) cMax = 1;

    // fit the picture when the shadow is much smaller than the sphere (N > 4)
    if (A > 4) {
      let rMax = 1e-9;
      for (let v = 0; v < nv; v++) {
        let x = y[4 * v], yy = y[4 * v + 1], z = y[4 * v + 2];
        if (this.mode === 'stereo') { const den = Math.sqrt((1 - y[4 * v + 3]) ** 2 + 0.01); x /= den; yy /= den; z /= den; }
        rMax = Math.max(rMax, Math.hypot(x, yy, z));
      }
      const target = 1.7 / rMax;
      this.fit = first ? target : this.fit + (target - this.fit) * 0.08;
    } else this.fit = 1;

    for (let v = 0; v < nv; v++) this._put(y[4 * v], y[4 * v + 1], y[4 * v + 2], y[4 * v + 3], 3 * v, cMax);

    const k = this.k;
    if (k > 1) {
      const { ed, ne, wts } = this;
      for (let e = 0; e < ne; e++) {
        const a = ed[2 * e] * 4, b = ed[2 * e + 1] * 4;
        for (let s = 1; s < k; s++) {
          const wi = (e * (k - 1) + s - 1) * 2, wa = wts[wi], wb = wts[wi + 1];
          this._put(
            wa * y[a] + wb * y[b], wa * y[a + 1] + wb * y[b + 1], wa * y[a + 2] + wb * y[b + 2], wa * y[a + 3] + wb * y[b + 3],
            3 * (nv + e * (k - 1) + s - 1), cMax,
          );
        }
      }
    }
  }
}
