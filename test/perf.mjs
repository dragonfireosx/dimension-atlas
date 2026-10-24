import { buildShape } from '../src/geometry.js';
import { ShapeView } from '../src/projection.js';
for (const [fam, N] of [['simplex', 600], ['cross', 600], ['cube', 600], ['cube', 12], ['dodeca', 4], ['ico', 4]]) {
  for (const mode of ['petrie', 'stereo', 'direct']) {
    if (mode === 'petrie' && !['simplex', 'cross', 'cube'].includes(fam)) continue;
    const t0 = performance.now();
    const shape = buildShape({ fam, N });
    const t1 = performance.now();
    const v = new ShapeView(shape, mode);
    const t2 = performance.now();
    for (let i = 0; i < 30; i++) { v.step(1 / 60); v.update(); }
    const t3 = performance.now();
    console.log(`${fam}${N}/${mode}: build ${(t1 - t0).toFixed(0)} ms, view ${(t2 - t1).toFixed(0)} ms, frame ${((t3 - t2) / 30).toFixed(2)} ms, edges drawn ${v.info.edgesShown}/${v.info.edgesTotal}, pts ${v.npts}`);
  }
}
