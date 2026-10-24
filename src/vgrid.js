// vgrid.js — the corners view: corners across, dimension up. Every shape sits at
// (its corner count, the dimension it lives in), so each family draws its own line:
// simplex the diagonal, cross-polytope half that slope, hypercube a 2ⁿ curve, polygons the D2 floor.
// Advanced mode adds the 13 Archimedean solids and the families six of them grow into.
import { ROWS, ARCH, ARCH_BY_ID, archCorners, describe, fVector, fmt } from './catalog.js';
import { thumbSVG } from './thumbs.js';

export const MAX_V = 600;
const TOP_D = MAX_V - 1;                 // a 600-corner simplex lives in D599
const ML = 56, MB = 30, MT = 44, MR = 8;  // axis margins (px)
const MIN_S = 0.3, MAX_S = 160;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

const COLOR = {
  ...Object.fromEntries(ROWS.map((r) => [r.id, r.color])), polygon: '#8a94a8', point: '#121a33', line: '#121a33',
  ...Object.fromEntries(ARCH.map((a) => [a.id, a.color])),
};
const FAMS = ['simplex', 'cross', 'cube', 'ico', 'dodeca', 'c24', 'polygon'];
const RULE = {
  simplex: 'corners = D + 1 · the diagonal', cross: 'corners = 2 × D · half slope', cube: 'corners = 2^D · bends away',
  ico: '12 in 3D, 120 in 4D', dodeca: '20 in 3D, 600 in 4D', c24: '24 corners, 4D only', polygon: 'every corner count, all in 2D',
};
const ARCH_WHY = {
  tt: (n) => `${n} × ${n + 1}`, co: (n) => `2 × ${n} × ${n - 1}`, tc: (n) => `${n} × 2^${n}`, to: (n) => `${n + 1}!`,
  rco: (n) => `${n} × ${n - 1} × 2^${n - 1}`, tco: (n) => `${n}! × 2^${n}`,
};
const isArch = (f) => !!ARCH_BY_ID[f];

function tint(hex, k) {           // mix toward white by k
  const n = parseInt(hex.slice(1), 16);
  const ch = (s) => Math.round(((n >> s) & 255) * (1 - k) + 255 * k);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

const specId = (sp) => `${sp.fam}:${sp.a || ''}:${sp.N}:${sp.fam === 'polygon' ? Math.round(sp.n) : ''}`;

// Every shape with at most MAX_V corners, with its place on the grid and the families it belongs to.
export function gridShapes(maxV = MAX_V) {
  const out = [];
  const add = (v, d, spec, fams) => out.push({ v, d, spec, fams, id: specId(spec) });
  add(1, 0, { fam: 'point', N: 0 }, ['point']);
  add(2, 1, { fam: 'line', N: 1 }, ['line']);
  for (let v = 3; v <= maxV; v++) {
    const fams = v === 3 ? ['simplex', 'polygon'] : v === 4 ? ['cross', 'cube', 'polygon'] : v === 5 ? ['ico', 'dodeca', 'polygon'] : ['polygon'];
    add(v, 2, { fam: 'polygon', N: 2, n: v }, fams);
  }
  for (let d = 3; d + 1 <= maxV; d++) add(d + 1, d, { fam: 'simplex', N: d }, ['simplex']);
  for (let d = 3; 2 * d <= maxV; d++) add(2 * d, d, { fam: 'cross', N: d }, ['cross']);
  for (let d = 3; 2 ** d <= maxV; d++) add(2 ** d, d, { fam: 'cube', N: d }, ['cube']);
  [[12, 3, 'ico'], [120, 4, 'ico'], [20, 3, 'dodeca'], [600, 4, 'dodeca'], [24, 4, 'c24']]
    .filter(([v]) => v <= maxV).forEach(([v, d, fam]) => add(v, d, { fam, N: d }, [fam]));
  // Archimedean: the 3D solid, then (for six of them) every dimension that stays on the chart.
  for (const a of ARCH) {
    for (let n = 3; ; n++) {
      if (!a.grows && n > 3) break;
      const v = Number(archCorners(a, n));
      if (v > maxV) break;
      if (a.id === 'co' && n === 4) { out.find((s) => s.spec.fam === 'c24').fams.push('co'); continue; }   // the rectified 16-cell is the 24-cell
      add(v, n, { fam: 'arch', a: a.id, N: n }, [a.id]);
    }
  }
  return out;
}

// Where a family's line runs: [corners, dimension] points in order.
function familyPath(fam) {
  const p = [];
  if (fam === 'simplex') for (let d = 0; d + 1 <= MAX_V; d++) p.push([d + 1, d]);
  if (fam === 'cross') { p.push([1, 0], [2, 1]); for (let d = 2; 2 * d <= MAX_V; d++) p.push([2 * d, d]); }
  if (fam === 'cube') for (let d = 0; 2 ** d <= MAX_V; d++) p.push([2 ** d, d]);
  if (fam === 'ico') p.push([1, 0], [2, 1], [5, 2], [12, 3], [120, 4]);
  if (fam === 'dodeca') p.push([1, 0], [2, 1], [5, 2], [20, 3], [600, 4]);
  if (fam === 'polygon') p.push([3, 2], [MAX_V, 2]);
  const a = ARCH_BY_ID[fam];
  if (a && a.grows) {                     // each one starts from a polygon on the D2 floor (hexagon, square or octagon)
    for (let n = 2; ; n++) { const v = Number(archCorners(a, n)); if (v > MAX_V) break; p.push([v, n]); }
  }
  return p;
}

export class VertexGrid {
  constructor(host, { onPick } = {}) {
    this.host = host;
    this.onPick = onPick || (() => {});
    this.doc = host.ownerDocument;
    this.win = this.doc.defaultView;
    this.shapes = gridShapes();
    this.byId = new Map(this.shapes.map((s) => [s.id, s]));
    this.cells = new Map();             // "v,d" → shapes in that cell
    for (const s of this.shapes) {
      const k = `${s.v},${s.d}`;
      if (!this.cells.has(k)) this.cells.set(k, []);
      this.cells.get(k).push(s);
    }
    this.hidden = new Set();
    this.showPaths = true;
    this.advanced = this.load('atlas.advanced') === '1';
    this.centres = false;
    this.sel = null;
    this.selId = null;
    this.hover = null;
    this.col = null;                    // the corner count shown in the side panel
    this.s = 40; this.cx = 0.5; this.cy = -0.5;    // cell size (px) and world point at the bottom-left of the plot
    this.build();
  }

  load(k) { try { return this.win.localStorage.getItem(k); } catch (e) { return null; } }
  save(k, v) { try { this.win.localStorage.setItem(k, v); } catch (e) { /* storage off */ } }

  build() {
    this.host.innerHTML = `
      <canvas class="vg-canvas"></canvas>
      <div class="vg-tools">
        <div class="vg-seg" role="group" aria-label="How much to show">
          <button type="button" data-z="start" title="Up to 9 corners">Close</button>
          <button type="button" data-z="40" title="Up to 40 corners">Wide</button>
          <button type="button" data-z="all" title="All 600 corners">Everything</button>
        </div>
        <div class="vg-seg" role="group" aria-label="Zoom">
          <button type="button" data-z="out" aria-label="Zoom out">−</button>
          <button type="button" data-z="in" aria-label="Zoom in">+</button>
        </div>
        <label title="Join each family with a line"><input type="checkbox" data-opt="paths" checked> Lines</label>
        <label title="Every shape has a centre. In D0 all its corners fall onto that one dot."><input type="checkbox" data-opt="centres"> Centres</label>
        <label class="adv" title="Add the 13 Archimedean solids and the families they grow into"><input type="checkbox" data-opt="advanced"${this.advanced ? ' checked' : ''}> Archimedean</label>
      </div>
      <button type="button" class="vg-open" hidden>Shapes by corners</button>
      <aside class="vg-side">
        <div class="vg-col"></div>
        <details class="vg-key"><summary>Key</summary><div class="vg-legend"></div></details>
      </aside>
      <div class="vg-tip" hidden></div>`;
    this.canvas = this.host.querySelector('canvas');
    this.ctx = this.canvas.getContext ? this.canvas.getContext('2d') : null;
    this.tip = this.host.querySelector('.vg-tip');
    this.legend = this.host.querySelector('.vg-legend');
    this.colEl = this.host.querySelector('.vg-col');
    this.renderLegend();
    this.renderCol();
    this.side = this.host.querySelector('.vg-side');
    this.openBtn = this.host.querySelector('.vg-open');
    this.openBtn.addEventListener('click', () => this.setSide(true));
    this.colEl.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) { this.setSide(false); return; }
      const step = e.target.closest('[data-step]');
      if (step) { this.showCol((this.col || 1) + +step.dataset.step); this.panTo(this.col, null); return; }
      const card = e.target.closest('[data-id]');
      if (card) { const sh = this.byId.get(card.dataset.id); if (sh) this.onPick(sh.spec); }
    });
    this.colEl.addEventListener('change', (e) => {
      if (e.target.matches('input[data-v]')) { this.showCol(Math.round(+e.target.value || 1)); this.panTo(this.col, null); }
    });

    const tools = this.host.querySelector('.vg-tools');
    tools.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-z]');
      if (!b) return;
      const z = b.dataset.z;
      if (z === 'in' || z === 'out') this.zoomAt(z === 'in' ? 1.4 : 1 / 1.4);
      else this.frame(z === 'start' ? 9 : z === 'all' ? MAX_V : +z);
    });
    tools.addEventListener('change', (e) => {
      const o = e.target.dataset.opt;
      if (o === 'paths') this.showPaths = e.target.checked;
      if (o === 'centres') this.centres = e.target.checked;
      if (o === 'advanced') this.setAdvanced(e.target.checked);
      this.draw();
    });
    this.legend.addEventListener('click', (e) => {
      const b = e.target.closest('[data-fam]');
      if (!b) return;
      const f = b.dataset.fam;
      this.hidden.has(f) ? this.hidden.delete(f) : this.hidden.add(f);
      this.renderLegend(); this.renderCol(); this.draw();
    });

    const c = this.canvas;
    let drag = null;
    c.addEventListener('pointerdown', (e) => {
      this.win.cancelAnimationFrame(this.panAnim);
      drag = { x: e.clientX, y: e.clientY, cx: this.cx, cy: this.cy, moved: false };
      this.host.classList.add('dragging');
      c.setPointerCapture && c.setPointerCapture(e.pointerId);
    });
    c.addEventListener('pointermove', (e) => {
      if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
        if (drag.moved) { this.cx = drag.cx - dx / this.s; this.cy = drag.cy + dy / this.s; this.clampCam(); this.draw(); }
      }
      const axisV = this.axisAt(e);
      c.style.cursor = axisV ? 'pointer' : '';
      this.setHover(axisV ? { v: axisV, d: -1 } : this.cellAt(e));
      this.placeTip(e);
    });
    c.addEventListener('pointerup', (e) => {
      if (drag && !drag.moved) {
        const axisV = this.axisAt(e);
        const h = axisV ? null : this.cellAt(e);
        const here = h ? this.visibleAt(h.v, h.d) : [];
        if (axisV) this.showCol(axisV);
        else if (here.length) {             // a crowded cell: step through its shapes on each click
          const i = here.findIndex((s) => s.id === this.selId);
          this.fromChart = true;
          this.onPick(here[(i + 1) % here.length].spec);
          this.fromChart = false;
        } else if (h) this.showCol(h.v);
      }
      drag = null;
      this.host.classList.remove('dragging');
    });
    c.addEventListener('pointerleave', () => { if (!drag) this.setHover(null); });
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = c.getBoundingClientRect();
      this.zoomAt(Math.exp(-e.deltaY * 0.0022), e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });

    if (this.win.ResizeObserver) new this.win.ResizeObserver(() => this.draw()).observe(this.host);
    else this.win.addEventListener('resize', () => this.draw());
  }

  setSide(open) {
    this.side.hidden = !open;
    this.openBtn.hidden = open;
  }

  setAdvanced(on) {
    this.advanced = on;
    this.save('atlas.advanced', on ? '1' : '0');
    const box = this.host.querySelector('[data-opt="advanced"]');
    if (box) box.checked = on;
    this.renderLegend(); this.renderCol(); this.draw();
  }

  renderLegend() {
    const item = (f, label, rule) => `<button type="button" data-fam="${f}" aria-pressed="${!this.hidden.has(f)}" style="--fc:${COLOR[f]}" class="${isArch(f) ? 'arch' : ''}"><i></i><b>${label}</b><span>${rule}</span></button>`;
    let html = FAMS.map((f) => item(f, ROWS.find((x) => x.id === f).label, RULE[f])).join('');
    if (this.advanced) {
      html += '<h5>Archimedean · grow into every dimension</h5>' + ARCH.filter((a) => a.grows).map((a) => item(a.id, a.label, a.formula)).join('');
      html += '<h5>Archimedean · stop at 3D</h5>' + ARCH.filter((a) => !a.grows).map((a) => item(a.id, a.label, `${a.v3} corners`)).join('');
    }
    html += '<p><i class="shade"></i>Shaded: fewer corners than the dimension needs. A shape here fits, but lies flat inside the space.</p>';
    this.legend.innerHTML = html;
  }

  famOn(f) { return f === 'point' || f === 'line' || (isArch(f) ? this.advanced && !this.hidden.has(f) : !this.hidden.has(f)); }
  visible(shape) { return shape.fams.some((f) => this.famOn(f)); }
  visibleAt(v, d) { return (this.cells.get(`${v},${d}`) || []).filter((s) => this.visible(s)); }

  // ---------- camera ----------
  size() {
    const w = this.host.clientWidth || 800, h = this.host.clientHeight || 400;
    return { w, h, pw: Math.max(10, w - ML - MR), ph: Math.max(10, h - MB - MT) };
  }
  clampCam() {
    const { pw, ph } = this.size();
    // the 0D baseline and the 1-corner edge stay pinned: you can move up and right, never into empty space below or left
    this.cx = clamp(this.cx, 0.7, Math.max(0.7, MAX_V + 1.3 - pw / this.s));
    this.cy = clamp(this.cy, -0.2, Math.max(-0.2, TOP_D + 1.2 - ph / this.s));
  }
  frame(n) {                      // show corners 1..n and dimensions 0..n-1, square
    const { pw, ph } = this.size();
    this.win.cancelAnimationFrame(this.panAnim);
    this.s = clamp(Math.min(pw, ph) / (n + 0.6), MIN_S, MAX_S);
    this.cx = 0.7; this.cy = -0.2;
    this.draw();
  }
  zoomAt(k, px, py) {
    this.win.cancelAnimationFrame(this.panAnim);
    const { w, h } = this.size();
    px = px ?? (ML + w) / 2; py = py ?? (h - MB) / 2;
    const [wx, wy] = this.toWorld(px, py);
    const { pw, ph } = this.size();
    this.s = clamp(this.s * k, Math.max(MIN_S, Math.min(pw, ph) / (MAX_V + 0.6)), MAX_S);   // never smaller than "Everything"
    this.cx = wx - (px - ML) / this.s;
    this.cy = wy - (this.size().h - MB - py) / this.s;
    this.clampCam();
    this.draw();
  }
  toWorld(px, py) { const { h } = this.size(); return [this.cx + (px - ML) / this.s, this.cy + (h - MB - py) / this.s]; }
  X(wx) { return ML + (wx - this.cx) * this.s; }
  Y(wy) { return this.size().h - MB - (wy - this.cy) * this.s; }
  cellAt(e) {
    const r = this.canvas.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    if (px < ML || py > this.size().h - MB) return null;
    const [wx, wy] = this.toWorld(px, py);
    const v = Math.floor(wx), d = Math.floor(wy);
    if (v < 1 || v > MAX_V || d < 0 || d > TOP_D) return null;
    const near = this.nearest(wx, wy);
    return near || { v, d };
  }
  axisAt(e) {                     // a click on the corner numbers under the plot
    const r = this.canvas.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    if (px < ML || py < this.size().h - MB) return 0;
    const v = Math.floor(this.toWorld(px, 0)[0]);
    return v >= 1 && v <= MAX_V ? v : 0;
  }
  nearest(wx, wy) {               // zoomed far out, snap to the closest shape within a few pixels
    if (this.s >= 6) return null;
    const rad = 6 / this.s;
    let best = null, bd = Infinity;
    for (const sh of this.shapes) {
      const dx = sh.v + 0.5 - wx, dy = sh.d + 0.5 - wy, dd = dx * dx + dy * dy;
      if (dd < bd && Math.abs(dx) < rad && Math.abs(dy) < rad && this.visible(sh)) { bd = dd; best = { v: sh.v, d: sh.d }; }
    }
    return best;
  }

  // ---------- hover + selection ----------
  select(spec) {
    const sh = this.byId.get(specId(spec));
    this.sel = sh ? { v: sh.v, d: sh.d } : null;
    this.selId = sh ? sh.id : null;
    if (sh && isArch(sh.fams[0]) && !this.advanced) this.setAdvanced(true);
    if (sh) this.showCol(sh.v, false);
    if (sh && !this.fromChart) this.panTo(sh.v, sh.d);
    else this.draw();
  }

  // Glide (same zoom) so corner count v and dimension d sit in the middle of the visible plot.
  // d = null keeps the height. The bottom and left stay locked by clampCam.
  panTo(v, d) {
    const { pw, ph } = this.size();
    const cover = this.side && !this.side.hidden && this.host.clientWidth > 760 ? this.side.offsetWidth + 20 : 0;
    const from = [this.cx, this.cy];
    this.cx = v + 0.5 - Math.max(40, pw - cover) / this.s / 2;
    if (d !== null) this.cy = d + 0.5 - ph / this.s / 2;
    this.clampCam();
    const to = [this.cx, this.cy];
    this.win.cancelAnimationFrame(this.panAnim);
    const reduce = this.win.matchMedia && this.win.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || (Math.abs(to[0] - from[0]) + Math.abs(to[1] - from[1])) * this.s < 2) { this.draw(); return; }
    const t0 = this.win.performance ? this.win.performance.now() : Date.now(), T = 260;
    const step = (now) => {
      const k = clamp((now - t0) / T, 0, 1), e = 1 - (1 - k) ** 3;
      this.cx = k < 1 ? from[0] + (to[0] - from[0]) * e : to[0];
      this.cy = k < 1 ? from[1] + (to[1] - from[1]) * e : to[1];
      this.draw();
      if (k < 1) this.panAnim = this.win.requestAnimationFrame(step);
    };
    this.cx = from[0]; this.cy = from[1];
    this.panAnim = this.win.requestAnimationFrame(step);
  }
  setHover(h) {
    const same = (h && this.hover && h.v === this.hover.v && h.d === this.hover.d) || (!h && !this.hover);
    this.hover = h;
    if (!h) this.tip.hidden = true;
    else this.tip.innerHTML = this.tipHTML(h);
    if (!same) this.draw();
  }
  tipHTML({ v, d }) {
    const inCol = this.shapes.filter((s) => s.v === v && this.visible(s)).sort((a, b) => a.d - b.d);
    if (d < 0) return `<b>${v} corners</b> · ${inCol.length} ${inCol.length === 1 ? 'shape' : 'shapes'}<br><span>Click to list them</span>`;
    const row = this.shapes.filter((s) => s.d === d && this.visible(s));
    const here = this.visibleAt(v, d);
    const nm = (s) => describe(s.spec).short;
    let html = here.length ? `<b>${here.map((s) => describe(s.spec).name).join(' · ')}</b> · ${v} corners · ${d}D<br>` : `<b>${v} corners · ${d}D</b>${d >= v ? ' · too few corners to fill this space' : ''}<br>`;
    if (d === 0 && this.centres) html += `<span>In D0 there is room for one point only, so any ${v} corners land on the same dot: the shape's centre.</span><br>`;
    html += `<span>${v} corners: ${inCol.length ? inCol.map((s) => `${nm(s)} (${s.d}D)`).join(', ') : 'no shape'}</span><br>`;
    const rowText = d === 2 ? 'every polygon, 3 sides upward' : row.length ? row.slice(0, 12).map((s) => `${nm(s)} (${s.v})`).join(', ') + (row.length > 12 ? '…' : '') : 'nothing under 600 corners';
    html += `<span>D${d}: ${rowText}${d >= 10 && d <= TOP_D ? ` · the ${d}-cube has 2^${d} corners, off the chart` : ''}</span>`;
    if (here.length > 1) html += '<br><span>Click again to step through the shapes in this cell.</span>';
    return html;
  }
  placeTip(e) {
    if (this.tip.hidden && !this.hover) return;
    this.tip.hidden = !this.hover;
    const r = this.host.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const tw = this.tip.offsetWidth || 260, th = this.tip.offsetHeight || 60;
    this.tip.style.left = `${clamp(x + 14, 4, r.width - tw - 4)}px`;
    this.tip.style.top = `${y + 18 + th > r.height ? y - th - 10 : y + 18}px`;
  }

  // ---------- side panel: every shape with this many corners ----------
  showCol(v, redraw = true) {
    this.col = clamp(Math.round(v), 1, MAX_V);
    if (redraw) this.setSide(true);
    this.renderCol();
    if (redraw) this.draw();
  }
  renderCol() {
    const v = this.col;
    if (!v) {
      this.colEl.innerHTML = `<div class="vg-colhead"><label>Shapes by corners</label><button type="button" class="x" data-close aria-label="Close list">×</button></div><p class="vg-hint">Click a corner number along the bottom, or any shape, to list every shape with that many corners.</p>`;
      return;
    }
    const list = this.shapes.filter((s) => s.v === v && this.visible(s)).sort((a, b) => a.d - b.d || isArch(a.fams[0]) - isArch(b.fams[0]));
    const famName = (x) => (isArch(x) ? `${ARCH_BY_ID[x].label} family` : ROWS.find((r) => r.id === x).label);
    const cards = list.map((sh) => {
      const d = describe(sh.spec), f = fVector(sh.spec);
      const arch = isArch(sh.fams[0]);
      const extra = f.length >= 2 ? `${fmt(f[1])} edges` : sh.d === 0 ? 'no edges' : '';
      const fams = sh.fams.filter((x) => x !== 'point' && x !== 'line' && this.famOn(x)).map(famName).join(' + ') || 'shared by all';
      return `<button type="button" class="vg-card${sh.id === this.selId ? ' on' : ''}${arch ? ' arch' : ''}" data-id="${sh.id}" style="--fc:${COLOR[sh.fams[0]]}">
        <span class="th">${thumbSVG(sh.spec)}</span>
        <span class="tx"><b>${d.name}</b><small>${fams}${extra ? ' · ' + extra : ''}</small></span>
        <em>${sh.d}D</em></button>`;
    }).join('');
    const why = [];
    if (v >= 3 && this.famOn('polygon')) why.push(`every count from 3 has a ${v}-sided polygon in 2D`);
    if (v - 1 >= 3 && this.famOn('simplex')) why.push(`${v} = ${v - 1} + 1, so a ${v - 1}D simplex`);
    if (v % 2 === 0 && v >= 6 && this.famOn('cross')) why.push(`${v} = 2 × ${v / 2}, so a ${v / 2}D cross-polytope`);
    if (v >= 8 && (v & (v - 1)) === 0 && this.famOn('cube')) why.push(`${v} = 2^${Math.log2(v)}, so a ${Math.log2(v)}D hypercube`);
    for (const sh of list) {
      const a = ARCH_BY_ID[sh.fams[sh.fams.length - 1]];
      if (a && a.grows && this.famOn(a.id)) why.push(`${v} = ${ARCH_WHY[a.id](sh.d)}, the ${a.label.toLowerCase()} family in ${sh.d}D`);
    }
    const nArch = list.filter((s) => isArch(s.fams[0])).length;
    const count = `${list.length - nArch} regular ${list.length - nArch === 1 ? 'shape' : 'shapes'}${nArch ? ` and ${nArch} Archimedean` : ''}`;
    this.colEl.innerHTML = `<div class="vg-colhead"><button type="button" data-step="-1" aria-label="Fewer corners">◀</button>
        <label><input type="number" min="1" max="${MAX_V}" value="${v}" data-v aria-label="Corners"> corners</label>
        <button type="button" data-step="1" aria-label="More corners">▶</button>
        <button type="button" class="x" data-close aria-label="Close list">×</button></div>
      <p class="vg-count">${count}${why.length ? ': ' + why.join('; ') + '.' : '.'}</p>
      <div class="vg-cards">${cards}</div>`;
  }

  // ---------- drawing ----------
  draw() {
    const ctx = this.ctx;
    if (!ctx) return;
    const { w, h } = this.size();
    const dpr = this.win.devicePixelRatio || 1;
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
      this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr);
      this.canvas.style.width = `${w}px`; this.canvas.style.height = `${h}px`;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const s = this.s;
    const v0 = Math.max(1, Math.floor(this.cx)), v1 = Math.min(MAX_V, Math.ceil(this.cx + (w - ML) / s));
    const d0 = Math.max(0, Math.floor(this.cy)), d1 = Math.min(TOP_D, Math.ceil(this.cy + (h - MB) / s));

    ctx.save();
    ctx.beginPath(); ctx.rect(ML, MT, w - ML - MR, h - MB - MT); ctx.clip();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(this.X(1), this.Y(TOP_D + 1), (MAX_V) * s, (TOP_D + 1) * s);

    // shaded region: d ≥ v, fewer corners than the space needs (a staircase above the diagonal)
    ctx.beginPath();
    ctx.moveTo(this.X(1), this.Y(TOP_D + 1));
    ctx.lineTo(this.X(1), this.Y(1));
    for (let v = 1; v <= MAX_V - 1; v++) { ctx.lineTo(this.X(v + 1), this.Y(v)); ctx.lineTo(this.X(v + 1), this.Y(v + 1)); }
    ctx.lineTo(this.X(MAX_V), this.Y(TOP_D + 1));
    ctx.closePath();
    ctx.fillStyle = '#eef1f6'; ctx.fill();

    if (this.col) {
      ctx.fillStyle = 'rgba(255,138,61,0.13)';
      ctx.fillRect(this.X(this.col), MT, s, h);
    }
    // hover bands: the column (shapes with this many corners) and the row (this dimension)
    if (this.hover) {
      ctx.fillStyle = 'rgba(59,74,143,0.08)';
      ctx.fillRect(this.X(this.hover.v), MT, s, h);
      if (this.hover.d >= 0) ctx.fillRect(ML, this.Y(this.hover.d + 1), w, s);
    }

    // grid
    const step = this.step();
    ctx.lineWidth = 1;
    if (s >= 9) {
      ctx.strokeStyle = 'rgba(120,132,160,0.12)';
      ctx.beginPath();
      for (let v = v0; v <= v1 + 1; v++) { const x = Math.round(this.X(v)) + 0.5; ctx.moveTo(x, MT); ctx.lineTo(x, h - MB); }
      for (let d = d0; d <= d1 + 1; d++) { const y = Math.round(this.Y(d)) + 0.5; ctx.moveTo(ML, y); ctx.lineTo(w, y); }
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(120,132,160,0.24)';
    ctx.beginPath();
    for (let v = Math.ceil(v0 / step) * step; v <= v1; v += step) { const x = Math.round(this.X(v + 0.5)) + 0.5; ctx.moveTo(x, MT); ctx.lineTo(x, h - MB); }
    for (let d = Math.ceil(d0 / step) * step; d <= d1; d += step) { const y = Math.round(this.Y(d + 0.5)) + 0.5; ctx.moveTo(ML, y); ctx.lineTo(w, y); }
    ctx.stroke();

    // centres: every shape's corners fall onto one dot in D0
    if (this.centres) this.drawCentres(ctx, v0, v1);

    // family lines through the cell centres
    if (this.showPaths) {
      ctx.lineJoin = 'round';
      const fams = [...FAMS, ...(this.advanced ? ARCH.filter((a) => a.grows).map((a) => a.id) : [])];
      for (const f of fams) {
        if (!this.famOn(f)) continue;
        const p = familyPath(f);
        if (p.length < 2) continue;
        ctx.strokeStyle = COLOR[f]; ctx.globalAlpha = isArch(f) ? 0.6 : 0.75;
        ctx.lineWidth = clamp(s * (isArch(f) ? 0.05 : 0.08), 1, 3);
        ctx.setLineDash(f === 'ico' || f === 'dodeca' ? [5, 4] : isArch(f) ? [2, 3] : []);
        ctx.beginPath();
        p.forEach(([v, d], i) => { const x = this.X(v + 0.5), y = this.Y(d + 0.5); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
        ctx.stroke();
      }
      ctx.setLineDash([]); ctx.globalAlpha = 1;
    }

    // the shapes, one cell at a time
    for (const [k, list] of this.cells) {
      const [v, d] = k.split(',').map(Number);
      if (v < v0 - 1 || v > v1 + 1 || d < d0 - 1 || d > d1 + 1) continue;
      const here = list.filter((x) => this.visible(x));
      if (here.length) this.drawCell(ctx, v, d, here);
    }
    if (this.sel) {
      const pad = s >= 9 ? 1 : -3;
      ctx.strokeStyle = '#121a33'; ctx.lineWidth = 2.5;
      ctx.strokeRect(this.X(this.sel.v) + pad, this.Y(this.sel.d + 1) + pad, s - 2 * pad, s - 2 * pad);
    }
    ctx.restore();

    this.drawAxes(ctx, w, h, v0, v1, d0, d1, step);
  }

  drawCentres(ctx, v0, v1) {
    const s = this.s, y = this.Y(0.5);
    const r = Math.max(1.5, Math.min(s * 0.16, 7));
    ctx.fillStyle = 'rgba(18,26,51,0.06)';
    ctx.fillRect(this.X(1), this.Y(1), MAX_V * s, s);
    ctx.fillStyle = '#121a33';
    for (let v = Math.max(2, v0); v <= v1; v++) {
      if (!this.shapes.some((sh) => sh.v === v && this.visible(sh))) continue;
      ctx.beginPath(); ctx.arc(this.X(v + 0.5), y, r, 0, 7); ctx.fill();
    }
    const h = this.hover;                       // the hovered shape drops a line to its centre
    if (h && h.d > 0 && this.visibleAt(h.v, h.d).length) {
      ctx.strokeStyle = '#121a33'; ctx.globalAlpha = 0.5; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(this.X(h.v + 0.5), this.Y(h.d + 0.5)); ctx.lineTo(this.X(h.v + 0.5), y); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
  }

  step() {
    for (const k of [1, 2, 5, 10, 20, 50, 100, 200]) if (k * this.s >= 30) return k;
    return 200;
  }

  drawCell(ctx, v, d, here) {
    const s = this.s;
    const fams = [...new Set(here.flatMap((sh) => sh.fams.filter((f) => this.famOn(f))))];
    const archOnly = here.every((sh) => isArch(sh.fams[0]));
    const x = this.X(v), y = this.Y(d + 1);
    if (s < 9) {                                   // a dot (Archimedean ones hollow)
      const r = Math.max(1.6, s * 0.45);
      ctx.beginPath(); ctx.arc(x + s / 2, y + s / 2, r, 0, 7);
      if (archOnly) { ctx.strokeStyle = COLOR[fams[0]]; ctx.lineWidth = 1.2; ctx.stroke(); } else { ctx.fillStyle = COLOR[fams[0]]; ctx.fill(); }
      return;
    }
    const pad = s >= 24 ? Math.max(2, s * 0.08) : 1;
    const cw = s - 2 * pad;
    const big = s >= 24;
    const r = big ? cw * (archOnly ? 0.5 : 0.22) : archOnly ? cw * 0.4 : 1;
    const outline = () => { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x + pad, y + pad, cw, cw, r); else ctx.rect(x + pad, y + pad, cw, cw); };
    ctx.save();
    outline(); ctx.clip();
    fams.forEach((f, i) => {                       // shared cells get a band per family
      ctx.fillStyle = big ? tint(COLOR[f], archOnly ? 0.86 : 0.55) : COLOR[f];
      ctx.fillRect(x + pad, y + pad + (cw * i) / fams.length, cw, cw / fams.length + 0.5);
    });
    ctx.restore();
    if (big) { ctx.strokeStyle = COLOR[fams[0]]; ctx.lineWidth = archOnly ? 2 : 1.5; outline(); ctx.stroke(); }
    if (s < 52) return;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const name = here.length > 1 ? `${here.length} shapes` : describe(here[0].spec).short;
    const fs = clamp(s * 0.15, 10, 15);
    ctx.font = `600 ${fs}px system-ui, sans-serif`;
    ctx.fillStyle = '#151b2e';
    ctx.fillText(name, x + s / 2, y + s / 2, cw - 8);
  }

  drawAxes(ctx, w, h, v0, v1, d0, d1, step) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, ML, h); ctx.fillRect(0, h - MB, w, MB);
    ctx.fillStyle = '#667089'; ctx.font = '600 11px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (let v = Math.ceil(v0 / step) * step || step; v <= v1; v += step) {
      const x = this.X(v + 0.5);
      if (x > ML) ctx.fillText(String(v), x, h - MB + 5);
    }
    if (step > 1 && this.X(1.5) > ML) ctx.fillText('1', this.X(1.5), h - MB + 5);
    if (this.col && this.X(this.col + 0.5) > ML) {
      const x = this.X(this.col + 0.5), t = String(this.col), tw = ctx.measureText(t).width + 10;
      ctx.fillStyle = '#121a33'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - tw / 2, h - MB + 2, tw, 17, 5) : ctx.rect(x - tw / 2, h - MB + 2, tw, 17); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillText(t, x, h - MB + 5);
      ctx.fillStyle = '#667089';
    }
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let d = Math.ceil(d0 / step) * step; d <= d1; d += step) {
      const y = this.Y(d + 0.5);
      if (y < h - MB && y > MT + 4) ctx.fillText(`${d}D`, ML - 6, y);
    }
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillText('corners →', ML + 4, h - 2);
    ctx.save(); ctx.translate(10, h - MB - 6); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'left'; ctx.fillText('dimension →', 0, 0); ctx.restore();
  }
}
