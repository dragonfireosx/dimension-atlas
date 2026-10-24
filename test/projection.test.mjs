import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { buildShape } from '../src/geometry.js';
import { cellsForColumn } from '../src/catalog.js';
import { ShapeView } from '../src/projection.js';

let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };

const specs = [];
for (const col of [0, 1, 2, 3, 4, 5, 6, 8, 12, 40, 150, 600])
  for (const c of cellsForColumn(col)) if (c.kind === 'shape') specs.push(c.spec.free ? { ...c.spec, n: 600 } : c.spec);

let slowest = 0, slowName = '';
for (const spec of specs) {
  const shape = buildShape(spec);
  for (const mode of ['direct', 'stereo', 'petrie']) {
    const t0 = performance.now();
    const v = new ShapeView(shape, mode);
    for (let f = 0; f < 90; f++) { v.step(1 / 60); v.update(); }
    const dt = (performance.now() - t0) / 90;
    if (dt > slowest) { slowest = dt; slowName = `${spec.fam}${spec.N}/${mode}`; }
    const label = `${spec.fam}${spec.N}${spec.n ? '-' + spec.n : ''}/${mode}`;
    for (let i = 0; i < v.pos.length; i++) ok(Number.isFinite(v.pos[i]), `${label}: non-finite position at ${i}`);
    for (let i = 0; i < v.col.length; i++) ok(Number.isFinite(v.col[i]) && v.col[i] >= 0 && v.col[i] <= 1.0001, `${label}: bad colour`);
    for (let i = 0; i < v.index.length; i++) if (v.index[i] >= v.npts) ok(false, `${label}: index out of range`);
    if (v.F) {                               // frame stays orthonormal
      const A = v.A;
      for (let r = 0; r < 4; r++) for (let s = r; s < 4; s++) {
        let dot = 0; for (let j = 0; j < A; j++) dot += v.F[r * A + j] * v.F[s * A + j];
        ok(Math.abs(dot - (r === s ? 1 : 0)) < 1e-6, `${label}: frame drift ${dot}`);
      }
    }
  }
}
console.log(`projection: ${checks} checks passed; slowest frame ${slowest.toFixed(1)} ms (${slowName})`);

// dump a few snapshots for the matplotlib sanity check
const dump = {};
for (const [name, spec, mode, steps] of [
  ['tesseract_stereo', { fam: 'cube', N: 4 }, 'stereo', 40],
  ['600cell_stereo', { fam: 'ico', N: 4 }, 'stereo', 0],
  ['120cell_stereo', { fam: 'dodeca', N: 4 }, 'stereo', 0],
  ['24cell_stereo', { fam: 'c24', N: 4 }, 'stereo', 20],
  ['cube_sphere', { fam: 'cube', N: 3 }, 'stereo', 0],
  ['5cell_stereo', { fam: 'simplex', N: 4 }, 'stereo', 0],
  ['simplex12_petrie', { fam: 'simplex', N: 12 }, 'petrie', 0],
  ['cube6_petrie', { fam: 'cube', N: 6 }, 'petrie', 0],
  ['cross7_petrie', { fam: 'cross', N: 7 }, 'petrie', 0],
  ['cube8_stereo', { fam: 'cube', N: 8 }, 'stereo', 0],
  ['dodeca_direct', { fam: 'dodeca', N: 3 }, 'direct', 0],
  ['120cell_direct', { fam: 'dodeca', N: 4 }, 'direct', 0],
]) {
  const v = new ShapeView(buildShape(spec), mode);
  for (let i = 0; i < steps; i++) { v.step(1 / 30); v.update(); }
  dump[name] = { pos: Array.from(v.pos), col: Array.from(v.col), index: Array.from(v.index) };
}
writeFileSync(process.env.DUMP_PATH || 'dump.json', JSON.stringify(dump));
