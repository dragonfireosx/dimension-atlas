// main.js — the two charts, the shape card and the wiring to the player.
import {
  ROWS, MAX_D, ARCH, ARCH_BY_ID, archCorners, colorOf, cellsForColumn, cellAt, locate, pickForColumn, countInColumn, fVector, fmt, fmtShort, describe,
} from './catalog.js';
import { thumbSVG } from './thumbs.js';
import { Viewer } from './viewer.js';
import { VertexGrid } from './vgrid.js';
import { initLearn } from './learn.js';
import { TIERS } from './budget.js';
import { setLimits } from './projection.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const KN = (k) => ['corners', 'edges', 'faces', 'cells'][k] || `${k}D faces`;
const LAST = 8;                                  // the dimension table shows D0..D8, then one column for everything after

// Friendly names for the rows: what each line is, and the rule it follows.
const LINE = [
  { name: 'Tetrahedron line', rule: 'counts', step: '+1', more: 'D + 1', at: (n) => fmt(BigInt(n) + 1n) },
  { name: 'Octahedron line', rule: 'even numbers', step: '+2', more: '2 × D', at: (n) => fmt(2n * BigInt(n)) },
  { name: 'Cube line', rule: 'doubles', step: '×2', more: '2 to the D', at: (n) => fmt(2n ** BigInt(n)) },
  { name: 'Icosahedron', rule: '3D and 4D only', end: 'Ends at 4D' },
  { name: 'Dodecahedron', rule: '3D and 4D only', end: 'Ends at 4D' },
  { name: '24-cell', rule: 'a 4D one-off', end: 'Only in 4D' },
  { name: 'Polygons', rule: 'any number of sides', end: 'Only in 2D' },
];
const HOW = { solid: 'Drag to turn it, scroll to zoom.', shadow: 'A 3D shadow of a shape with more dimensions than we can see, turning through the extra ones.',
  stereo: 'Bubble view: the corners are pushed onto a sphere, then flattened from one pole, so straight edges look curved.',
  stereoHigh: 'Bubble view through a turning 4D window. Beyond 4D this blurs by nature.',
  petrie: 'Flat view: looking straight down the shape\'s longest zig-zag of edges. The cleanest picture of a high-dimensional shape.' };

const BUSY_FROM = 8000;                         // build shapes with more corners than this after a 'Building…' frame
// Rough memory a full build takes: coordinates twice over (lists, then typed arrays), the edges, and list overhead.
const buildBytes = (corners, N, deg) => Number(corners) * (16 * N + 4 * deg + 200);
const fmtBytes = (b) => (b >= 1e9 ? `${(b / 1e9).toFixed(b >= 1e10 ? 0 : 1)} GB` : `${Math.max(1, Math.round(b / 1e6))} MB`);

const polyFromPos = (p) => Math.round(3 * Math.pow(200, p / 1000));
const posFromPoly = (n) => (1000 * Math.log(n / 3)) / Math.log(200);

export function initApp(doc = document, opts = {}) {
  const $ = (id) => doc.getElementById(id);
  const win = doc.defaultView || window;
  const el = {
    stage: $('stage'), modes: $('modes'), play: $('play'), speed: $('speed'), reset: $('reset'), detail: $('detail'),
    full: $('full'), busy: $('busy'), oob: $('oob'), fsTop: $('fs-top'), fsBottom: $('fs-bottom'), player: $('player'),
    app: $('app'), vgrid: $('vgrid'), dtable: $('dtable'), vCorners: $('v-corners'), vDims: $('v-dims'),
  };

  const reduce = !!(win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const S = { row: 2, col: 4, spec: { fam: 'cube', N: 4 }, cur: null, gap: null, polyN: 7, pref: null, info: null, far: 600, view: 'corners' };
  const rowColor = (r) => (r === 6 ? '#8a94a8' : ROWS[r].color);

  // How much this computer can draw (see budget.js). Tests and the plain page get the full budget.
  const tier = opts.tier || TIERS.full;
  setLimits(tier);
  const archOf = (spec) => ARCH_BY_ID[spec.a];
  const tooBig = (spec) => spec.fam === 'arch' && archCorners(archOf(spec), spec.N) > BigInt(tier.corners);

  // ================= viewer =================
  const viewer = new Viewer(el.stage, {
    createRenderer: opts.createRenderer,
    pixelRatio: tier.pixelRatio,
    onLost: (lost) => setBusy(lost ? 'The graphics card reset. Waiting for it to come back…' : null),
    onError: () => {
      el.stage.innerHTML = '<div class="nowebgl"><p>The 3D view needs WebGL, which is not available here.<br>The charts and numbers still work.</p></div>';
    },
  });
  viewer.playing = !reduce;

  // ================= corners view =================
  let grid = null;
  if (el.vgrid) {
    grid = new VertexGrid(el.vgrid, {
      onPick: (spec) => {
        if (spec.fam === 'arch') { selectSpec(spec); return; }
        if (spec.fam === 'polygon' && spec.n > 5) { setPolyN(spec.n); return; }
        const { row, col } = locate(spec);
        selectCell(row, col);
      },
    });
  }
  function setView(v) {
    S.view = v;
    if (el.app) el.app.dataset.view = v;
    el.vCorners.setAttribute('aria-pressed', String(v === 'corners'));
    el.vDims.setAttribute('aria-pressed', String(v === 'dims'));
    try { win.localStorage.setItem('atlas.view', v); } catch (e) { /* storage off */ }
    if (v === 'corners' && grid) grid.draw();
  }

  // ================= dimension table: D0..D8, then "and forever" =================
  function cellHTML(cell, col) {
    const place = `grid-column:${col + 2};grid-row:${cell.r0 + 2} / ${cell.r1 + 3}`;
    const base = `data-c="${col}" data-r="${cell.r0}"`;
    if (cell.kind === 'gap') {
      const label = cell.hot ? 'No 3D version' : '';
      return `<div class="cell gap${cell.hot ? ' hot' : ''}" ${base} role="button" tabindex="0" style="${place}" title="${cell.reason.replace(/"/g, '&quot;')}" aria-label="Empty: ${cell.reason.replace(/"/g, '&quot;')}"><span class="nm">${label}</span></div>`;
    }
    const free = !!cell.spec.free;
    const spec = free ? { ...cell.spec, n: S.polyN } : cell.spec;
    const common = spec.fam === 'point' || spec.fam === 'line';
    const name = free ? 'Any polygon' : describe(spec).short;
    const num = free ? '3 … ∞' : fmtShort(fVector(spec)[0]);
    const color = common ? '#121a33' : rowColor(cell.r0);
    return `<div class="cell shape${common ? ' common' : ''}${free ? ' free' : ''}" ${base} role="button" tabindex="0" style="${place};--fc:${color}" title="${name}: ${num} corners" aria-label="${name}, ${num} corners">
      <span class="th">${thumbSVG(common ? spec : free ? { fam: 'polygon', N: 2, n: 7 } : spec)}</span>
      <span class="nm">${name}</span><span class="num">${num}${common ? `<small>${spec.fam === 'point' ? ' corner' : ' corners'}</small>` : ''}</span></div>`;
  }

  function renderTable() {
    let html = '<div class="dt-corner"><span>Numbers are corners</span><span>Dimension →</span></div>';
    for (let c = 0; c <= LAST; c++) html += `<button type="button" class="dt-col" data-col="${c}" style="grid-column:${c + 2}">${c}D</button>`;
    html += `<div class="dt-col far" style="grid-column:${LAST + 3}"><span>${LAST + 1}D → forever</span><label>Try<input id="far" type="number" min="${LAST + 1}" max="${MAX_D}" value="${S.far}" aria-label="Any dimension">D</label></div>`;
    LINE.forEach((l, r) => {
      html += `<div class="dt-row" style="grid-row:${r + 2};--fc:${rowColor(r)}"><b>${l.name}</b><span>${l.step ? `<em>${l.step}</em> ` : ''}${l.rule}</span></div>`;
    });
    for (let c = 0; c <= LAST; c++) for (const cell of cellsForColumn(c)) html += cellHTML(cell, c);
    // the step from one dimension to the next, on the three lines that never end
    for (let r = 0; r <= 2; r++) for (let c = 2; c <= LAST; c++) html += `<span class="step" style="grid-column:${c + 2};grid-row:${r + 2};--fc:${rowColor(r)}" aria-hidden="true">${LINE[r].step}</span>`;
    LINE.forEach((l, r) => {
      const style = `grid-column:${LAST + 3};grid-row:${r + 2};--fc:${rowColor(r)}`;
      html += l.end
        ? `<div class="farcell end" style="${style}">${l.end}</div>`
        : `<button type="button" class="farcell" data-far="${r}" style="${style}"><span class="rule">${l.more}</span><span class="val"><i data-farn>${S.far}</i>D: <b data-farv>${l.at(S.far)}</b></span></button>`;
    });
    html += '<div class="dt-foot-h"><b>How many shapes</b></div>';
    for (let c = 0; c <= LAST; c++) { const n = countInColumn(c); html += `<div class="dt-foot${n === Infinity ? ' inf' : ''}" style="grid-column:${c + 2}">${n === Infinity ? '∞' : n}</div>`; }
    html += `<div class="dt-foot far" style="grid-column:${LAST + 3}"><b>3</b>&nbsp;forever</div>`;
    el.dtable.innerHTML = `<div class="dt-scroll"><div class="dt">${html}</div></div>
      <p class="dt-note">Read across a row to follow one family up through the dimensions. Read down a column to see everything that fits in that dimension. After 4D only the three endless lines are left, and they keep their rules forever.</p>`;
    updateTable();
  }

  function updateTable() {
    if (!el.dtable.firstChild) return;
    const far = S.col > LAST;
    for (const node of el.dtable.querySelectorAll('.cell')) {
      const on = !!S.cur && !far && +node.dataset.c === S.cur.col && +node.dataset.r === S.cur.r0;
      node.classList.toggle('sel', on);
      if (on && S.view === 'dims' && node.scrollIntoView) node.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    for (const node of el.dtable.querySelectorAll('.dt-col[data-col]')) node.classList.toggle('on', +node.dataset.col === S.col);
    el.dtable.querySelector('.dt-col.far').classList.toggle('on', far);
    for (const node of el.dtable.querySelectorAll('[data-far]')) node.classList.toggle('sel', far && +node.dataset.far === S.row);
    for (const node of el.dtable.querySelectorAll('.dt-row')) node.classList.toggle('on', +node.style.gridRow.split('/')[0] - 2 === S.row && !S.spec.a);
  }

  function setFar(n) {
    S.far = clamp(Math.round(n) || LAST + 1, LAST + 1, MAX_D);
    const inp = $('far');
    if (inp && doc.activeElement !== inp) inp.value = String(S.far);
    el.dtable.querySelectorAll('[data-farn]').forEach((i) => { i.textContent = String(S.far); });
    el.dtable.querySelectorAll('[data-far]').forEach((b) => { b.querySelector('[data-farv]').textContent = LINE[+b.dataset.far].at(S.far); });
  }

  // ================= selection =================
  function effectiveMode(spec) {
    const petrieOk = ['simplex', 'cross', 'cube'].includes(spec.fam) && spec.N >= 2;
    if (S.pref && (S.pref !== 'petrie' || petrieOk)) return S.pref;
    if (spec.N <= 3) return 'direct';
    if (spec.N === 4) return 'stereo';
    return petrieOk ? 'petrie' : 'direct';
  }

  function selectCell(row, col, { keepRow = false } = {}) {
    const cell = cellAt(row, col);
    if (!cell) return;
    S.col = col;
    if (!keepRow) S.row = row;
    if (col > LAST) setFar(col);
    if (cell.kind === 'gap') {
      S.gap = cell;
      S.cur = { col, r0: cell.r0, kind: 'gap' };
    } else {
      S.gap = null;
      let spec = cell.spec;
      if (spec.fam === 'polygon' && !spec.free) S.polyN = spec.n;
      if (spec.free) spec = { ...spec, n: S.polyN };
      S.spec = spec;
      S.cur = { col, r0: cell.r0, kind: 'shape' };
      loadShape();
    }
    renderPanel();
    updateTable();
    if (!S.gap && grid) grid.select(S.spec);
  }

  function setDimension(col) {
    col = clamp(Math.round(col), 0, MAX_D);
    const cell = pickForColumn(col, S.row);
    selectCell(S.row >= cell.r0 && S.row <= cell.r1 ? S.row : cell.r0, col, { keepRow: true });
  }

  function setPolyN(n) {
    S.polyN = clamp(Math.round(n), 3, 600);
    const { row } = locate({ fam: 'polygon', N: 2, n: S.polyN });
    const cell = cellAt(row, 2);
    S.col = 2; S.row = row; S.gap = null;
    S.spec = { fam: 'polygon', N: 2, n: S.polyN, ...(cell.spec.free ? { free: true } : {}) };
    S.cur = { col: 2, r0: cell.r0, kind: 'shape' };
    loadShape();
    renderPanel({ keepPoly: true });
    updateTable();
    if (grid) grid.select(S.spec);
  }

  // Archimedean shapes live only in the corners view, outside the table.
  function selectSpec(spec) {
    if (spec.a === 'co' && spec.N === 4) { const { row, col } = locate({ fam: 'c24', N: 4 }); selectCell(row, col); return; }   // the rectified 16-cell is the 24-cell
    S.spec = spec; S.gap = null; S.cur = null; S.col = spec.N;
    loadShape();
    renderPanel();
    updateTable();
    if (grid) grid.select(spec);
  }

  // ================= player =================
  let loadToken = 0;
  function loadShape() {
    const spec = S.spec, token = ++loadToken;
    if (tooBig(spec)) { showStandIn(spec, false); return; }
    const n = spec.fam === 'arch' ? Number(archCorners(archOf(spec), spec.N)) : 0;
    if (n > BUSY_FROM && !opts.sync) {          // say so first, so the page paints before the heavy work
      setBusy(`Building ${fmt(n)} corners…`);
      win.setTimeout(() => { if (token === loadToken) buildNow(spec); }, 40);
      return;
    }
    buildNow(spec);
  }
  function buildNow(spec) {
    try {
      S.info = viewer.setShape(spec, effectiveMode(spec), colorOf(spec));
      S.standIn = null;
    } catch (e) {                               // ran out of room part-way: show the stand-in instead of crashing
      showStandIn(spec, true);
      return;
    }
    shown();
  }
  // Too big for this computer: a freeze frame of a circle, which is what the flat view of a shape this size becomes.
  function showStandIn(spec, failed) {
    const a = archOf(spec);
    S.standIn = { corners: archCorners(a, spec.N), failed, bytes: buildBytes(archCorners(a, spec.N), spec.N, a.deg(spec.N)) };
    try { S.info = viewer.setShape({ fam: 'standin', n: tier.ring }, 'direct', colorOf(spec)); } catch (e) { S.info = null; }
    shown();
  }
  function shown() {
    setBusy(null);
    if (el.oob) el.oob.hidden = !S.standIn;
    el.modes.hidden = !!S.standIn;              // nothing to switch between on a stand-in
    renderModes();
    renderNote();
  }
  function setBusy(text) {
    if (!el.busy) return;
    el.busy.hidden = !text;
    if (text) el.busy.querySelector('span').textContent = text;
  }

  function renderModes() {
    const spec = S.spec;
    const petrieOk = ['simplex', 'cross', 'cube'].includes(spec.fam) && spec.N >= 2;
    const mode = S.info ? S.info.mode : effectiveMode(spec);
    const list = [['direct', spec.N <= 3 ? 'Solid' : 'Shadow', true], ['stereo', 'Bubble', true], ['petrie', 'Flat', petrieOk]];
    const off = !!S.standIn;
    el.modes.innerHTML = list.map(([id, label, ok]) => `<button type="button" data-mode="${id}" aria-pressed="${!off && mode === id}" ${ok && !off ? '' : 'disabled'}>${label}</button>`).join('');
  }

  function renderNote() {
    const note = $('p-note');
    if (!note) return;
    const spec = S.spec, info = S.info, mode = info ? info.mode : 'direct';
    if (S.standIn) {
      const { corners, failed, bytes } = S.standIn;
      note.textContent = `${failed ? 'This computer ran out of room building' : 'Too big to draw on this computer:'} all ${corners < 10n ** 15n ? Number(corners).toLocaleString('en-US') : fmt(corners)} corners${failed ? '' : ` would need about ${fmtBytes(bytes)} of memory`}. `
        + 'What you see is a stand-in. Seen flat, a shape this big puts its corners round a circle and fills it with criss-crossing edges, so it really does look like a glowing disc.';
      return;
    }
    let t = mode === 'direct' ? (spec.N <= 3 ? HOW.solid : HOW.shadow) : mode === 'stereo' ? (spec.N <= 4 ? HOW.stereo : HOW.stereoHigh) : HOW.petrie;
    if (info && info.sampled) t += ` ${fmt(2n ** BigInt(info.sampled.realN))} corners are too many to draw, so a ${info.sampled.shownN}-cube (${fmt(2 ** info.sampled.shownN)} corners) stands in for the pattern.`;
    else if (info && info.edgesShown < info.edgesTotal) t += ` Showing ${fmt(info.edgesShown)} of ${fmt(info.edgesTotal)} edges.`;
    note.textContent = t;
  }

  // ================= the shape card =================
  const statsHTML = (f) => {
    const all = f.map((v, k) => [KN(k), v]);
    const show = all.length <= 4 ? all : [all[0], all[1], all[2], [all.length >= 6 ? 'outer cells' : KN(all.length - 1), all[all.length - 1][1]]];
    return `<div class="stats">${show.map(([k, v]) => { const t = fmt(v); return `<div class="stat"><b${t.length > 8 ? ' class="long"' : ''}>${t}</b><span>${k}</span></div>`; }).join('')}</div>`;
  };
  const firstSentence = (t) => (t || '').split('. ')[0].replace(/\.$/, '') + '.';

  function renderPanel({ keepPoly = false } = {}) {
    renderFull();
    const color = S.gap ? rowColor(S.gap.r0) : colorOf(S.spec);
    el.detail.style.setProperty('--fc', color === '#e5e7eb' ? '#8a94a8' : color);
    let polyEl = el.detail.querySelector('#polynum') && el.detail.querySelector('#d-poly');
    const wantPoly = !S.gap && S.spec.fam === 'polygon';
    if (!(keepPoly && polyEl && wantPoly)) {
      el.detail.innerHTML = '<div id="d-head"></div><div id="d-poly"></div><div id="d-body"></div>';
      polyEl = null;
    }
    const head = el.detail.querySelector('#d-head'), body = el.detail.querySelector('#d-body');

    if (S.gap) {
      const col = S.col, here = cellsForColumn(col).filter((c) => c.kind === 'shape');
      const names = [...new Set(here.map((c) => (c.spec.free ? 'polygons' : describe(c.spec).short)))];
      head.innerHTML = `<h2 id="p-name">Nothing here</h2><p class="tag"><span class="pill">${col}D</span>${LINE[S.gap.r0].name}</p>`;
      body.innerHTML = `<div class="gapnote"><b>${S.gap.hot ? 'The 24-cell has no 3D twin' : 'No shape in this spot'}</b>${S.gap.reason}</div>
        <p>${col}D holds ${names.join(', ')}.</p>`;
      return;
    }

    const spec = S.spec, d = describe(spec), f = fVector(spec);
    const corners = spec.free ? S.polyN : f[0];
    if (spec.fam === 'arch') {
      const a = d.arch;
      head.innerHTML = `<h2 id="p-name">${d.name}</h2><p class="tag"><span class="pill">${spec.N}D</span>${a.label} family · ${fmt(corners)} corners</p>`;
      let path = '';
      if (a.grows) for (let n = 3; n <= 8; n++) path += `<button type="button" data-achip="${n}" ${spec.N === n ? 'aria-current="true"' : ''}${tooBig({ fam: 'arch', a: a.id, N: n }) ? ' class="big" title="Too big to draw on this computer: shows a stand-in"' : ''}><b>${fmtShort(archCorners(a, n))}</b><small>${n}D</small></button>`;
      body.innerHTML = `${statsHTML(f)}
        ${a.grows ? `<h4>Along this family</h4><div class="path" id="chips">${path}<span class="more">…</span></div>` : ''}
        <div class="rule"><b>${a.grows ? '∞' : '3D'}</b><span>${a.grows ? `${a.formula}. Grows into every dimension.` : `Stops at 3D. ${a.cousin}`}</span></div>
        <p>${a.note}</p>
        <p class="view" id="p-note"></p>`;
      renderNote();
      return;
    }

    const row = S.row, line = LINE[row];
    const where = spec.fam === 'point' || spec.fam === 'line' ? 'Where every line starts' : line.name;
    head.innerHTML = `<h2 id="p-name">${d.name}</h2><p class="tag"><span class="pill">${spec.N}D</span>${where} · ${fmt(corners)} ${corners === 1 ? 'corner' : 'corners'}</p>`;

    if (wantPoly && !polyEl) {
      el.detail.querySelector('#d-poly').innerHTML = `<div class="polyctl"><label>Sides<input id="polyrange" type="range" min="0" max="1000" step="1" value="${Math.round(posFromPoly(S.polyN))}" aria-label="Number of sides"></label><input id="polynum" type="number" min="3" max="600" value="${S.polyN}" aria-label="Sides"></div>`;
      const pr = el.detail.querySelector('#polyrange'), pn = el.detail.querySelector('#polynum');
      pr.addEventListener('input', () => { setPolyN(polyFromPos(+pr.value)); });
      pn.addEventListener('change', () => { setPolyN(+pn.value || 3); });
    } else if (wantPoly) {
      const pn = el.detail.querySelector('#polynum'), pr = el.detail.querySelector('#polyrange');
      if (doc.activeElement !== pn) pn.value = String(S.polyN);
      if (doc.activeElement !== pr) pr.value = String(Math.round(posFromPoly(S.polyN)));
    }

    // the family path: corners at each step, read straight off the table
    let path = '';
    const dims = row === 5 ? [4] : [0, 1, 2, 3, 4, 5, 6, 7, 8];
    for (const n of dims) {
      const cell = cellAt(row, n);
      if (cell.kind === 'gap') continue;
      const v = cell.spec.free ? 'n' : fmtShort(fVector(cell.spec)[0]);
      path += `<button type="button" data-chip="${n}" ${S.col === n ? 'aria-current="true"' : ''}><b>${v}</b><small>${n}D</small></button>`;
    }
    if (row <= 2) path += `<span class="more">…</span><button type="button" data-chip="${MAX_D}" ${S.col === MAX_D ? 'aria-current="true"' : ''}><b>${fmtShort(fVector({ fam: ['simplex', 'cross', 'cube'][row], N: MAX_D })[0])}</b><small>${MAX_D}D</small></button>`;
    const fam = ROWS[row];
    const rule = fam.rule ? `<div class="rule"><b>${fam.rule}</b><span>${firstSentence(d.grows)}</span></div>` : '';
    const more = [
      d.symbol && d.symbol !== '—' ? `<dt>Schläfli symbol</dt><dd>${d.symbol}</dd>` : '',
      d.bounded ? `<dt>Made of</dt><dd>${d.bounded}</dd>` : '',
      fam.rule ? `<dt>Rule</dt><dd>${fam.formula}. ${d.grows}</dd>` : `<dt>About</dt><dd>${d.grows}</dd>`,
      d.dual ? `<dt>Inside-out twin (dual)</dt><dd>${d.dual}</dd>` : '',
    ].join('');

    body.innerHTML = `${statsHTML(f)}
      <h4>Along the ${spec.fam === 'point' || spec.fam === 'line' ? 'cube' : line.name.toLowerCase().replace(/s$/, '')}${row >= 3 ? ' row' : ''}</h4>
      <div class="path" id="chips">${path}</div>
      ${rule}
      ${d.fact ? `<p>${d.fact}</p>` : ''}
      <p class="view" id="p-note"></p>
      <details class="more"><summary>More detail</summary><dl>${more}</dl></details>`;
    renderNote();
  }

  // ================= full screen: the player fills the window, with every shape of this dimension to step through =================
  const sameSpec = (a, b) => a.fam === b.fam && a.N === b.N && (a.a || '') === (b.a || '') && (a.fam !== 'polygon' || a.n === b.n);
  function shapesInDim(col) {
    const list = [];
    for (const c of cellsForColumn(col)) {
      if (c.kind !== 'shape') continue;
      list.push(c.spec.free ? { fam: 'polygon', N: 2, n: S.polyN > 5 ? S.polyN : 6 } : c.spec);
    }
    if (grid && grid.advanced && col >= 3) {          // the Archimedean shapes that live here, while they stay drawable
      for (const a of ARCH) {
        if ((!a.grows && col !== 3) || (a.id === 'co' && col === 4)) continue;
        const sp = { fam: 'arch', a: a.id, N: col };
        if (!tooBig(sp)) list.push(sp);
      }
    }
    return list;
  }
  function pick(spec) {
    if (spec.fam === 'arch') selectSpec(spec);
    else if (spec.fam === 'polygon' && spec.n > 5) setPolyN(spec.n);
    else { const { row, col } = locate(spec); selectCell(row, col); }
  }
  function stepShape(k) {
    const list = shapesInDim(S.col);
    const i = list.findIndex((x) => sameSpec(x, S.spec));
    pick(list[(i + k + list.length) % list.length]);
  }
  function stepDim(k) {
    const n = clamp(S.col + k, 0, MAX_D);
    if (S.spec.fam === 'arch') {
      const a = ARCH_BY_ID[S.spec.a];
      if (a.grows && n >= 3 && n <= LAST) { selectSpec({ fam: 'arch', a: a.id, N: n }); return; }
      const { row } = locate({ fam: 'cube', N: 3 }); S.row = row;
    }
    setDimension(n);
  }
  function renderFull() {
    if (el.app.dataset.full !== '1' || S.gap) return;
    const spec = S.spec, d = describe(spec), f = fVector(spec);
    const list = shapesInDim(S.col);
    const i = list.findIndex((x) => sameSpec(x, spec));
    const counts = f.slice(0, 4).map((v, k) => `<span><b>${fmt(v)}</b> ${KN(k)}</span>`).join('');
    el.fsTop.innerHTML = `<div class="fs-title" style="--fc:${colorOf(spec)}"><h2>${d.name}</h2><p><span class="pill">${spec.N}D</span>${i >= 0 ? `Shape ${i + 1} of ${list.length} in ${spec.N}D` : ''}</p><p class="fs-counts">${counts}</p></div>
      <button type="button" class="fs-close" data-fs="close" aria-label="Leave full screen">×</button>`;
    const strip = list.map((x, j) => `<button type="button" data-fs-i="${j}" ${j === i ? 'aria-current="true"' : ''} style="--fc:${colorOf(x)}" title="${describe(x).name}"><span class="th">${thumbSVG(x)}</span><small>${describe(x).short}</small></button>`).join('');
    el.fsBottom.innerHTML = `<div class="fs-dim"><button type="button" data-fs="dimdown" aria-label="One dimension down" ${S.col <= 0 ? 'disabled' : ''}>▼</button><b>${S.col}D</b><button type="button" data-fs="dimup" aria-label="One dimension up" ${S.col >= MAX_D ? 'disabled' : ''}>▲</button></div>
      <button type="button" class="fs-arrow" data-fs="prev" aria-label="Previous shape">◀</button>
      <div class="fs-strip">${strip}</div>
      <button type="button" class="fs-arrow" data-fs="next" aria-label="Next shape">▶</button>`;
    const cur = el.fsBottom.querySelector('[aria-current="true"]');
    if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest', inline: 'center' });
  }
  function setFull(on) {
    el.app.dataset.full = on ? '1' : '0';
    el.full.textContent = on ? '⤡' : '⤢';
    el.full.setAttribute('aria-label', on ? 'Leave full screen' : 'Full screen');
    const de = doc.documentElement;
    try {
      if (on && !doc.fullscreenElement && de.requestFullscreen) de.requestFullscreen().catch(() => {});
      if (!on && doc.fullscreenElement && doc.exitFullscreen) doc.exitFullscreen().catch(() => {});
    } catch (e) { /* the window stays as it is; the player still fills it */ }
    if (on) renderFull();
  }
  el.full.addEventListener('click', () => setFull(el.app.dataset.full !== '1'));
  doc.addEventListener('fullscreenchange', () => { if (!doc.fullscreenElement && el.app.dataset.full === '1') setFull(false); });
  const onFs = (e) => {
    const b = e.target.closest('[data-fs], [data-fs-i]');
    if (!b) return;
    if (b.dataset.fsI !== undefined) { pick(shapesInDim(S.col)[+b.dataset.fsI]); return; }
    ({ close: () => setFull(false), prev: () => stepShape(-1), next: () => stepShape(1), dimup: () => stepDim(1), dimdown: () => stepDim(-1) })[b.dataset.fs]();
  };
  el.fsTop.addEventListener('click', onFs);
  el.fsBottom.addEventListener('click', onFs);

  // ================= events =================
  const notices = $('notices');
  const learn = initLearn(doc, {
    about: () => ({ version: opts.version, machine: opts.machineLine, notices: notices ? notices.textContent.trim() : '' }),
    onShowCorners: (v) => {
      setView('corners');
      if (grid) { if (v + 2 > grid.s && grid.toWorld(grid.size().w, 0)[0] < v + 2) grid.frame(Math.max(9, v + 4)); grid.showCol(v); }
    },
  });
  $('learnbtn').addEventListener('click', () => learn.open());
  // Outside links: in the desktop app hand them to the system browser, never navigate the app window away.
  doc.addEventListener('click', (e) => {
    const link = e.target.closest && e.target.closest('a[href^="http"]');
    if (!link) return;
    e.preventDefault();
    const opener = win.__TAURI__ && win.__TAURI__.opener;
    if (opener) opener.openUrl(link.href).catch(() => {});
    else win.open(link.href, '_blank', 'noopener');
  });
  el.vCorners.addEventListener('click', () => setView('corners'));
  el.vDims.addEventListener('click', () => setView('dims'));

  el.dtable.addEventListener('click', (e) => {
    const node = e.target.closest('.cell');
    if (node) { selectCell(+node.dataset.r, +node.dataset.c); return; }
    const col = e.target.closest('[data-col]');
    if (col) { setDimension(+col.dataset.col); return; }
    const far = e.target.closest('[data-far]');
    if (far) selectCell(+far.dataset.far, S.far);
  });
  el.dtable.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const node = e.target.closest('.cell');
    if (!node) return;
    e.preventDefault();
    selectCell(+node.dataset.r, +node.dataset.c);
  });
  el.dtable.addEventListener('input', (e) => { if (e.target.id === 'far') setFar(+e.target.value); });
  el.dtable.addEventListener('change', (e) => {
    if (e.target.id !== 'far') return;
    setFar(+e.target.value);
    selectCell(S.row <= 2 ? S.row : 2, S.far);
  });
  el.detail.addEventListener('click', (e) => {
    const ab = e.target.closest('[data-achip]');
    if (ab) { selectSpec({ fam: 'arch', a: S.spec.a, N: +ab.dataset.achip }); return; }
    const b = e.target.closest('[data-chip]');
    if (b) selectCell(S.row, +b.dataset.chip);
  });
  el.modes.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-mode]');
    if (!b || b.disabled) return;
    S.pref = b.dataset.mode;
    loadShape();
  });

  el.play.addEventListener('click', () => {
    viewer.playing = !viewer.playing;
    el.play.textContent = viewer.playing ? 'Pause' : 'Play';
    el.play.setAttribute('aria-label', el.play.textContent);
  });
  el.speed.addEventListener('input', () => { viewer.speed = +el.speed.value; });
  el.reset.addEventListener('click', () => viewer.resetCamera());

  doc.addEventListener('keydown', (e) => {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
    if (el.app.dataset.full === '1') {
      const go = { ArrowRight: () => stepShape(1), ArrowLeft: () => stepShape(-1), ArrowUp: () => stepDim(1), ArrowDown: () => stepDim(-1), Escape: () => setFull(false) }[e.key];
      if (go) { e.preventDefault(); go(); }
      return;
    }
    if (S.spec.fam === 'arch') return;
    if (e.key === 'ArrowRight') { e.preventDefault(); setDimension(S.col + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); setDimension(S.col - 1); }
  });

  // ================= start =================
  if (reduce) { el.play.textContent = 'Play'; el.play.setAttribute('aria-label', 'Play'); }
  renderTable();
  selectCell(2, 4);
  let saved = null;
  try { saved = win.localStorage.getItem('atlas.view'); } catch (e) { /* storage off */ }
  setView(saved === 'dims' ? 'dims' : 'corners');
  if (grid) { grid.frame(9); if ((win.innerWidth || 1200) < 760) grid.setSide(false); }

  return { S, el, viewer, grid, tier, learn, setFull, stepShape, stepDim, setView, selectSpec, selectCell, setDimension, setPolyN, setFar, renderPanel };
}
