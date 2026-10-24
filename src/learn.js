// learn.js — a few short pages on the ideas behind the chart, each with something to try.
import { buildShape } from './geometry.js';
import { ARCH, archCorners, colorOf, describe, fmt } from './catalog.js';
import { thumbSVG } from './thumbs.js';
import { gridShapes } from './vgrid.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

const PAGES = [
  { id: 'patterns', title: 'Count, even, double' },
  { id: 'nest', title: 'The nested set' },
  { id: 'nature', title: 'The same numbers in nature' },
  { id: 'centre', title: 'The dot holds everything' },
  { id: 'line', title: 'Filling a line' },
  { id: 'room', title: 'Corners need room' },
  { id: 'count', title: 'How many shapes?' },
  { id: 'arch', title: 'Archimedean patterns' },
  { id: 'about', title: 'About' },
];

const COLLAPSE = [
  ['Square', { fam: 'cube', N: 2 }], ['Cube', { fam: 'cube', N: 3 }], ['Tesseract', { fam: 'cube', N: 4 }], ['5-cube', { fam: 'cube', N: 5 }],
  ['Octahedron', { fam: 'cross', N: 3 }], ['16-cell', { fam: 'cross', N: 4 }], ['Triangle', { fam: 'simplex', N: 2 }],
  ['Tetrahedron', { fam: 'simplex', N: 3 }], ['5-cell', { fam: 'simplex', N: 4 }], ['Cuboctahedron', { fam: 'arch', a: 'co', N: 3 }],
  ['24-cell', { fam: 'c24', N: 4 }], ['600-cell', { fam: 'ico', N: 4 }],
];

export function initLearn(doc, { onShowCorners, about = () => ({}) } = {}) {
  const win = doc.defaultView;
  const root = doc.createElement('div');
  root.id = 'learn';
  root.hidden = true;
  root.innerHTML = `<div class="ln-box" role="dialog" aria-modal="true" aria-label="Learn">
    <nav class="ln-nav">${PAGES.map((p, i) => `<button type="button" data-page="${p.id}"><small>${p.id === 'about' ? 'i' : i + 1}</small>${p.title}</button>`).join('')}
      <p class="ln-credit"><a href="https://in2infinity.com">In2infinity</a><br>Powered by <a href="https://dragonfire1.com">Dragonfire</a></p></nav>
    <article class="ln-page"></article>
    <button type="button" class="ln-close" aria-label="Close">×</button></div>`;
  doc.body.appendChild(root);
  const page = root.querySelector('.ln-page');
  let cur = 'patterns', anim = 0;

  const open = (id = cur) => { root.hidden = false; show(id); };
  const close = () => { root.hidden = true; win.cancelAnimationFrame(anim); };
  root.querySelector('.ln-close').addEventListener('click', close);
  root.addEventListener('click', (e) => { if (e.target === root) close(); });
  doc.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !root.hidden) close(); });
  root.querySelector('.ln-nav').addEventListener('click', (e) => { const b = e.target.closest('[data-page]'); if (b) show(b.dataset.page); });

  function show(id) {
    cur = id;
    win.cancelAnimationFrame(anim);
    for (const b of root.querySelectorAll('[data-page]')) b.setAttribute('aria-current', String(b.dataset.page === id));
    ({ patterns: pagePatterns, nest: pageNest, nature: pageNature, centre: pageCentre, line: pageLine, room: pageRoom, count: pageCount, arch: pageArch, about: pageAbout })[id]();
  }

  // ---------- A. the three regular lines: count, even, double ----------
  function pagePatterns() {
    const LINES = [
      { key: 'simplex', name: 'Simplex', rule: 'counting', step: '+1', v: (n) => n + 1, how: 'adds one new corner, out in the new direction' },
      { key: 'cross', name: 'Cross-polytope', rule: 'even numbers', step: '+2', v: (n) => 2 * n, how: 'adds two corners, one each way along the new axis' },
      { key: 'cube', name: 'Hypercube', rule: 'doubling', step: '×2', v: (n) => 2 ** n, how: 'slides a copy of itself along the new axis, so every corner doubles' },
    ];
    const col = (key) => colorOf({ fam: key, N: 3 });
    const head = Array.from({ length: 9 }, (_, n) => `<th>D${n}</th>`).join('');
    const rows = LINES.map((l) => `<tr style="--fc:${col(l.key)}"><th><span><i></i>${l.name}</span></th><td>${l.rule} (${l.step})</td>${Array.from({ length: 9 }, (_, n) => `<td data-n="${n}">${n === 0 && l.key === 'cross' ? '<s title="the pattern says 0; the real shape is the dot">0</s>' : fmt(l.v(n))}</td>`).join('')}</tr>`).join('');
    const sums = [];
    for (let n = 1, t = 0; n <= 6; n++) { t += 2 * n; sums.push(t); }
    page.innerHTML = `<h2>Count, even, double</h2>
      <p>Three regular shapes carry on into every dimension, and each one grows by its own simple rule. The <b>simplex</b> (triangle, tetrahedron, …) counts: 3, 4, 5, 6. The <b>cross-polytope</b> (square, octahedron, …) steps through the even numbers: 4, 6, 8, 10. The <b>hypercube</b> (square, cube, tesseract, …) doubles: 4, 8, 16, 32.</p>
      <div class="ln-demo">
        <canvas class="ln-cv" width="560" height="330"></canvas>
        <div class="ln-ctl">
          <label>Dimension <input type="range" data-pd min="0" max="8" value="3"><output data-po></output></label>
          <label class="ln-check"><input type="checkbox" data-pa checked> Show the Archimedean families in between</label>
          <p class="ln-read" data-read></p>
        </div>
      </div>
      <table class="ln-table ln-pat"><thead><tr><th>Shape</th><th>Rule</th>${head}</tr></thead><tbody>${rows}</tbody></table>
      <p>Follow each rule back down and they meet. In D1 all three are the same line with 2 corners. Follow the even line one step further and it reaches 0 at D0. The real shape there is the dot, with 1 corner, which is where counting and doubling both start.</p>
      <h3>Why these three rules</h3>
      <p>Each rule says what happens to the corners when you add a dimension:</p>
      <ul>${LINES.map((l) => `<li><b>${l.name}</b> ${l.how} (${l.step}).</li>`).join('')}</ul>
      <p>Those are the only three ways to grow a regular shape that work in every dimension, so these are the only three lines that go on forever. Everything else lands between them. The polygons fill the D2 floor. The 4D specials (24, 120 and 600 corners) sit on the D4 row. The Archimedean families grow from the floor along their own curves between the lines.</p>
      <p class="ln-note">The lines also build each other. Add up the even line, 2 + 4 + 6 + … , and you get ${sums.join(', ')}: exactly the truncated-tetrahedron family, one Archimedean line, from its hexagon in D2 upwards.</p>`;
    const cv = page.querySelector('canvas'), ctx = cv.getContext ? cv.getContext('2d') : null;
    const d = page.querySelector('[data-pd]'), dout = page.querySelector('[data-po]'), arch = page.querySelector('[data-pa]'), read = page.querySelector('[data-read]');
    const VMAX = 34, DMAX = 8;
    function draw() {
      const n = +d.value;
      dout.textContent = String(n);
      const vals = LINES.map((l) => (n === 0 ? 1 : l.v(n)));
      read.innerHTML = n === 0
        ? 'D0: every line starts from the <b>dot</b>, 1 corner.'
        : `D${n}: ${LINES.map((l, i) => `<span style="color:${col(l.key)}">■</span> ${l.name} <b>${fmt(vals[i])}</b>`).join(' · ')}` +
          (n < DMAX ? `<br>Next step to D${n + 1}: ${LINES.map((l) => `${l.step}`).join(', ')} → ${LINES.map((l) => fmt(l.v(n + 1))).join(', ')}` : '');
      for (const td of page.querySelectorAll('.ln-pat td[data-n]')) td.classList.toggle('on', +td.dataset.n === n);
      if (!ctx) return;
      const W = cv.width, H = cv.height, L = 34, R = 14, T = 14, B = 26;
      const X = (v) => L + ((W - L - R) * v) / VMAX, Y = (dd) => H - B - ((H - T - B) * dd) / DMAX;
      ctx.clearRect(0, 0, W, H);
      ctx.font = '600 11px system-ui, sans-serif'; ctx.fillStyle = '#7d869c'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (let dd = 0; dd <= DMAX; dd++) {
        ctx.fillText(`D${dd}`, L - 6, Y(dd));
        ctx.strokeStyle = dd === n ? 'rgba(255,148,77,0.55)' : '#e4e8f0'; ctx.lineWidth = dd === n ? 10 : 1;
        ctx.beginPath(); ctx.moveTo(L, Y(dd)); ctx.lineTo(W - R, Y(dd)); ctx.stroke();
      }
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (let v = 0; v <= VMAX; v += 2) ctx.fillText(String(v), X(v), H - B + 6);
      const dot = (v, dd, c, r, hollow) => { ctx.beginPath(); ctx.arc(X(v), Y(dd), r, 0, 7); if (hollow) { ctx.strokeStyle = c; ctx.lineWidth = 1.5; ctx.stroke(); } else { ctx.fillStyle = c; ctx.fill(); } };
      for (let v = 3; v <= VMAX; v++) dot(v, 2, '#9aa3ba', 2.2);
      if (arch.checked) for (const a of ARCH.filter((q) => q.grows)) for (let dd = 2; dd <= DMAX; dd++) { const v = Number(archCorners(a, dd)); if (v <= VMAX) dot(v, dd, a.color, 3.2, true); }
      for (const l of LINES) {
        const c = col(l.key), pts = [];
        for (let dd = 0; dd <= DMAX; dd++) pts.push([dd === 0 ? 1 : l.v(dd), dd]);
        ctx.strokeStyle = c; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(X(1), Y(0));
        for (let i = 1; i < pts.length; i++) {
          const [v, dd] = pts[i], [pv] = pts[i - 1];
          if (v <= VMAX) { ctx.lineTo(X(v), Y(dd)); continue; }
          const f = (VMAX - pv) / (v - pv);
          ctx.lineTo(X(VMAX), Y(dd - 1 + f)); break;
        }
        ctx.stroke();
        for (const [v, dd] of pts) if (v <= VMAX) dot(v, dd, c, dd === n ? 6 : 4);
      }
      ctx.setLineDash([3, 3]); ctx.strokeStyle = col('cross'); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(X(2), Y(1)); ctx.lineTo(X(0), Y(0)); ctx.stroke(); ctx.setLineDash([]);
      dot(0, 0, col('cross'), 4, true);
      dot(1, 0, '#121a33', 5);
    }
    d.addEventListener('input', draw); arch.addEventListener('change', draw);
    draw();
  }

  // ---------- B. tetrahedron, octahedron and cube nest inside each other ----------
  function pageNest() {
    const C = [];
    for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) C.push([x, y, z]);
    const even = C.filter(([x, y, z]) => x * y * z > 0), odd = C.filter(([x, y, z]) => x * y * z < 0);
    const O = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
    const edgesAt = (P, d2) => { const E = []; for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) if (Math.abs(dist2(P[i], P[j]) - d2) < 1e-9) E.push([P[i], P[j]]); return E; };
    const PARTS = [
      { key: 'cube', label: 'Cube', P: C, E: edgesAt(C, 4), color: colorOf({ fam: 'cube', N: 3 }) },
      { key: 'ta', label: 'Tetrahedron', P: even, E: edgesAt(even, 8), color: colorOf({ fam: 'simplex', N: 3 }) },
      { key: 'tb', label: 'Second tetrahedron', P: odd, E: edgesAt(odd, 8), color: '#ca8a04' },
      { key: 'oct', label: 'Octahedron', P: O, E: edgesAt(O, 2), color: colorOf({ fam: 'cross', N: 3 }) },
    ];
    page.innerHTML = `<h2>The nested set</h2>
      <p>The tetrahedron, the octahedron and the cube are not three separate ideas. They fit inside each other exactly.</p>
      <div class="ln-demo">
        <svg class="ln-nest" viewBox="-1.9 -1.9 3.8 3.8" role="img" aria-label="Cube with two tetrahedra and an octahedron inside"></svg>
        <div class="ln-ctl">
          ${PARTS.map((p) => `<label class="ln-check"><input type="checkbox" data-part="${p.key}" checked> <i class="ln-sw" style="background:${p.color}"></i>${p.label}</label>`).join('')}
          <label class="ln-check"><input type="checkbox" data-spin checked> Spin</label>
          <p class="ln-read" data-read></p>
        </div>
      </div>
      <ul>
        <li><b>Two tetrahedra make the cube.</b> Take every other corner of a cube and you get a tetrahedron (4 corners). The other 4 make a second one, pointing the opposite way. Together, 4 + 4 = 8: the cube's corners. This is the star tetrahedron.</li>
        <li><b>Where they cross is the octahedron.</b> Each tetrahedron edge runs diagonally across one face of the cube. The two tetrahedra cross at the centre of every face, and those 6 crossing points are the corners of an octahedron.</li>
        <li><b>The octahedron and cube are each other's inside-out.</b> The cube has 6 faces and 8 corners. The octahedron has 8 faces and 6 corners. Put a dot in the middle of every face of one and you get the other.</li>
      </ul>
      <p>So the nest holds all three patterns at once: <b>4</b> (counting), <b>6</b> (even) and <b>8</b> (doubling), all in one cube.</p>
      <h3>Higher up</h3>
      <p>The nest keeps working. In any dimension, the face centres of a hypercube are the corners of a cross-polytope (2n faces, 2n corners). In 4D, taking every other corner of the tesseract (8 of its 16) gives the 16-cell, the 4D octahedron. Put the tesseract's 16 corners and the 16-cell's 8 together, at the same distance from the centre, and 16 + 8 = 24: the corners of the 24-cell, the 4D cuboctahedron.</p>
      <p class="ln-note">From 5D up, every other corner of the hypercube no longer gives a regular shape. The 4D case is the last place the nest closes up perfectly, the same dimension where the cuboctahedron turns regular.</p>`;
    const svg = page.querySelector('svg'), read = page.querySelector('[data-read]'), spin = page.querySelector('[data-spin]');
    let ang = 0.6;
    const proj = ([x, y, z]) => { const c = Math.cos(ang), s = Math.sin(ang), x1 = c * x + s * z, z1 = -s * x + c * z, t = 0.42, y1 = Math.cos(t) * y - Math.sin(t) * z1, z2 = Math.sin(t) * y + Math.cos(t) * z1; return [x1, -y1, z2]; };
    const on = (k) => page.querySelector(`[data-part="${k}"]`).checked;
    function draw() {
      let out = '';
      for (const p of PARTS) {
        if (!on(p.key)) continue;
        for (const [a, b] of p.E) { const A = proj(a), B = proj(b), back = A[2] + B[2] < 0; out += `<line x1="${A[0].toFixed(3)}" y1="${A[1].toFixed(3)}" x2="${B[0].toFixed(3)}" y2="${B[1].toFixed(3)}" stroke="${p.color}" stroke-width="${back ? 0.025 : 0.045}" stroke-opacity="${back ? 0.45 : 0.95}" stroke-linecap="round"/>`; }
        for (const v of p.P) { const A = proj(v); out += `<circle cx="${A[0].toFixed(3)}" cy="${A[1].toFixed(3)}" r="0.065" fill="${p.color}"/>`; }
      }
      out += '<circle cx="0" cy="0" r="0.05" fill="#121a33"/>';
      svg.innerHTML = out;
      const shown = PARTS.filter((p) => on(p.key));
      read.innerHTML = shown.length ? shown.map((p) => `<span style="color:${p.color}">■</span> ${p.label} <b>${p.P.length}</b>`).join('<br>') : 'Tick a shape to show it.';
    }
    page.querySelectorAll('[data-part]').forEach((b) => b.addEventListener('change', draw));
    const tick = () => { if (spin.checked) { ang += 0.006; draw(); } anim = win.requestAnimationFrame(tick); };
    draw();
    if (win.requestAnimationFrame) anim = win.requestAnimationFrame(tick);
  }

  // ---------- C. the same numbers in atoms and crystals ----------
  function pageNature() {
    const SUB = ['s', 'p', 'd', 'f'];
    const COORD = [
      { n: 4, spec: { fam: 'simplex', N: 3 }, shape: 'tetrahedron', where: 'Diamond, silicon and ice. Each carbon in diamond bonds to 4 neighbours at the corners of a tetrahedron, and methane (CH₄) has the same shape.' },
      { n: 6, spec: { fam: 'cross', N: 3 }, shape: 'octahedron', where: 'Table salt. Each sodium sits between 6 chlorides at the corners of an octahedron, and each chloride between 6 sodiums.' },
      { n: 8, spec: { fam: 'cube', N: 3 }, shape: 'cube', where: 'Iron at room temperature, and caesium chloride. Each atom sits at the centre of a cube of 8 neighbours.' },
      { n: 12, spec: { fam: 'arch', a: 'co', N: 3 }, shape: 'cuboctahedron', where: 'Copper, gold, silver and aluminium. Packing equal balls as tightly as possible gives each one 12 touching neighbours, at the corners of a cuboctahedron.' },
    ];
    page.innerHTML = `<h2>The same numbers in nature</h2>
      <p>Counting, odd and even numbers, squares and the shapes on this chart turn up in atoms and crystals. The reason is shared: all of them come from the symmetry of three-dimensional space. Here are two places to see it.</p>
      <h3>Electron shells</h3>
      <p>The rings of an atom hold <b>2, 8, 18, 32</b> electrons. That is not doubling (doubling would give 16 next, not 18). It is <b>2 × the square numbers</b>: 2 × 1, 2 × 4, 2 × 9, 2 × 16.</p>
      <div class="ln-demo">
        <div class="ln-shell" data-shellview></div>
        <div class="ln-ctl">
          <label>Shell <input type="range" data-shell min="1" max="4" value="3"><output data-so></output></label>
          <p class="ln-read" data-read></p>
        </div>
      </div>
      <p>Each shell is built from sub-shells (s, p, d, f) holding <b>1, 3, 5, 7</b> orbitals: the odd numbers. Those come from the ways a wave can wrap around a sphere, called spherical harmonics. Adding odd numbers gives squares (1, 1 + 3 = 4, 1 + 3 + 5 = 9). Each orbital holds a pair of electrons, which doubles everything into even numbers. So the counting, odd, square and even patterns are all inside one atom.</p>
      <p>The shapes show up too. The three p orbitals point along the three axes, so together their six lobes point at the six corners of an octahedron. When carbon mixes its s and p orbitals, the four bonds point at the corners of a tetrahedron.</p>
      <h3>Crystals</h3>
      <p>Count the nearest neighbours around one atom in a crystal and you usually get 4, 6, 8 or 12. Those neighbours sit at the corners of a tetrahedron, octahedron, cube or cuboctahedron. Pick one:</p>
      <div class="ln-demo">
        <div class="ln-thumb" data-cthumb></div>
        <div class="ln-ctl">
          <div class="ln-coord">${COORD.map((c, i) => `<button type="button" data-coord="${i}" aria-pressed="${i === 3}">${c.n}</button>`).join('')}</div>
          <p class="ln-read" data-cread></p>
        </div>
      </div>
      <p>The gaps in a tightly packed crystal have shapes too: they are tetrahedra and octahedra, two tetrahedra for every octahedron. Those two shapes together fill space with nothing left over. Around every point where they meet, the corners of the neighbouring pieces form a cuboctahedron: the nested set and the 12-neighbour packing are the same picture.</p>
      <p class="ln-note">A fair caution: nature doesn't use every pattern on the chart. Most numbers in physics and chemistry come from many causes. But the small ones (4, 6, 8, 12, the odd numbers and the squares) keep returning because they are what 3D space allows.</p>`;
    const sh = page.querySelector('[data-shell]'), so = page.querySelector('[data-so]'), view = page.querySelector('[data-shellview]'), read = page.querySelector('[data-read]');
    function drawShell() {
      const n = +sh.value;
      so.textContent = String(n);
      let html = '', total = 0;
      for (let l = 0; l < n; l++) {
        const k = 2 * l + 1; total += 2 * k;
        html += `<div><b>${n}${SUB[l]}</b>${'<span>↑↓</span>'.repeat(k)}<small>${k} × 2 = ${2 * k}</small></div>`;
      }
      view.innerHTML = html;
      read.innerHTML = `Shell ${n}: ${Array.from({ length: n }, (_, l) => 2 * l + 1).join(' + ')} = <b>${n * n}</b> orbitals (a square number) × 2 electrons = <b>${total}</b>`;
    }
    const cthumb = page.querySelector('[data-cthumb]'), cread = page.querySelector('[data-cread]');
    function pick(i) {
      const c = COORD[i];
      page.querySelectorAll('[data-coord]').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.coord === i)));
      cthumb.innerHTML = thumbSVG(c.spec);
      cthumb.style.color = colorOf(c.spec);
      cread.innerHTML = `<b>${c.n} neighbours: ${c.shape}.</b> ${c.where}`;
    }
    sh.addEventListener('input', drawShell);
    page.querySelectorAll('[data-coord]').forEach((b) => b.addEventListener('click', () => pick(+b.dataset.coord)));
    drawShell(); pick(3);
  }

  // ---------- 1. every shape has a centre; in D0 every corner lands on it ----------
  function pageCentre() {
    page.innerHTML = `<h2>The dot holds everything</h2>
      <p>Every regular shape has a centre: one point, the same distance from every corner. Squash the shape one dimension at a time and its corners pile up. When no dimensions are left, every corner sits on that single dot.</p>
      <p>This is ordinary maths, not just a picture. Zero-dimensional space has room for exactly one point, so 5 corners in D0, or 600, look exactly like one dot. Read the other way, the dot already holds every shape: each one unfolds from its centre as dimensions are added.</p>
      <div class="ln-demo">
        <canvas class="ln-cv" width="520" height="340"></canvas>
        <div class="ln-ctl">
          <label>Shape <select data-shape>${COLLAPSE.map(([n], i) => `<option value="${i}"${n === 'Cube' ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
          <label>Dimensions kept <input type="range" data-k min="0" max="300" value="300"><output data-ko></output></label>
          <button type="button" data-play>Collapse ▶</button>
          <p class="ln-read" data-read></p>
        </div>
      </div>
      <p class="ln-note">Watch the cube: squash its depth and 8 corners become 4 spots with 2 on each. Squash its height and they become 2 spots with 4 on each. Then the last dimension goes and all 8 sit on the centre. Shapes whose corners line up with the axes fold neatly like this. The others keep their corners apart until the very end.</p>`;
    const cv = page.querySelector('canvas'), ctx = cv.getContext ? cv.getContext('2d') : null;
    const sel = page.querySelector('[data-shape]'), k = page.querySelector('[data-k]'), ko = page.querySelector('[data-ko]'), read = page.querySelector('[data-read]');
    let shape, N;
    const load = () => {
      const spec = COLLAPSE[+sel.value][1];
      shape = buildShape(spec); N = spec.N;
      k.max = String(N * 100); k.value = String(N * 100);
      draw();
    };
    const axis = (j) => (j === 0 ? [1, 0] : j === 1 ? [0, -1] : [Math.cos(0.5 + j * 2.4) * 0.55, Math.sin(0.5 + j * 2.4) * 0.55]);
    function draw() {
      const t = +k.value / 100;
      ko.textContent = t.toFixed(1);
      const { nv, d, V, edges } = shape;
      const pts = [];
      for (let i = 0; i < nv; i++) {
        let x = 0, y = 0;
        for (let j = 0; j < d; j++) { const sc = clamp(t - j, 0, 1), [ax, ay] = axis(j); x += V[i * d + j] * sc * ax; y += V[i * d + j] * sc * ay; }
        pts.push([x, y]);
      }
      const spots = new Map();
      for (const [x, y] of pts) { const key = `${Math.round(x * 400)},${Math.round(y * 400)}`; spots.set(key, (spots.get(key) || 0) + 1); }
      read.innerHTML = `<b>${nv}</b> corners on <b>${spots.size}</b> ${spots.size === 1 ? 'spot' : 'spots'}${spots.size === 1 ? ': the centre' : ''}`;
      if (!ctx) return;
      const W = cv.width, H = cv.height, R = Math.min(W, H) * 0.36, cx = W / 2, cy = H / 2;
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = colorOf(COLLAPSE[+sel.value][1]); ctx.globalAlpha = Math.min(0.8, 40 / Math.max(1, edges.length / 2) + 0.15); ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let e = 0; e < edges.length; e += 2) {
        const [ax, ay] = pts[edges[e]], [bx, by] = pts[edges[e + 1]];
        ctx.moveTo(cx + ax * R, cy + ay * R); ctx.lineTo(cx + bx * R, cy + by * R);
      }
      ctx.stroke(); ctx.globalAlpha = 1;
      ctx.font = '600 12px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      for (const [key, n] of spots) {
        const [x, y] = key.split(',').map((q) => +q / 400);
        ctx.fillStyle = '#121a33';
        ctx.beginPath(); ctx.arc(cx + x * R, cy + y * R, n > 1 ? 5 : 3.5, 0, 7); ctx.fill();
        if (n > 1 && spots.size <= 40) ctx.fillText(`×${n}`, cx + x * R + 7, cy + y * R - 3);
      }
      ctx.strokeStyle = '#ff944d'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, 9, 0, 7); ctx.stroke();
    }
    sel.addEventListener('change', load);
    k.addEventListener('input', draw);
    page.querySelector('[data-play]').addEventListener('click', () => {
      win.cancelAnimationFrame(anim);
      if (+k.value === 0) k.value = k.max;
      const step = () => { k.value = String(Math.max(0, +k.value - 1.2)); draw(); if (+k.value > 0) anim = win.requestAnimationFrame(step); };
      anim = win.requestAnimationFrame(step);
    });
    load();
  }

  // ---------- 2. points on a line ----------
  function pageLine() {
    page.innerHTML = `<h2>Filling a line</h2>
      <p>A line segment needs exactly two corners. Every other point on it lies between them. Put a dot at the middle and you have 3. Halve every gap again and you have 5, then 9, 17, 33… The dots crowd closer and closer, and the line starts to look solid.</p>
      <div class="ln-demo">
        <canvas class="ln-cv" width="560" height="150"></canvas>
        <div class="ln-ctl">
          <label>Halvings <input type="range" data-h min="0" max="14" value="0"><output data-ho></output></label>
          <label class="ln-check"><input type="checkbox" data-third> Mark the point one third of the way along</label>
          <p class="ln-read" data-read></p>
        </div>
      </div>
      <p>The usual view in maths goes one step further. Halving never lands on the point one third of the way along: 1/3 is never a whole number divided by a power of two. So a list of dots, even an endless one, leaves gaps. Georg Cantor showed in 1874 that the points on a line are a bigger kind of infinity than any list can reach. Mathematicians call it the continuum.</p>
      <p class="ln-note">So "from 2 to infinity" fills the line in one sense: no gap is left that has any length. In another sense it never quite fills it: some points are always missed. Both are true.</p>`;
    const cv = page.querySelector('canvas'), ctx = cv.getContext ? cv.getContext('2d') : null;
    const h = page.querySelector('[data-h]'), ho = page.querySelector('[data-ho]'), third = page.querySelector('[data-third]'), read = page.querySelector('[data-read]');
    function draw() {
      const k = +h.value, n = 2 ** k + 1;
      ho.textContent = String(k);
      let nearest = Infinity;
      for (let i = 0; i < n; i++) nearest = Math.min(nearest, Math.abs(i / (n - 1) - 1 / 3));
      read.innerHTML = `<b>${fmt(n)}</b> points · gap between neighbours 1/${fmt(2 ** k)}${third.checked ? ` · closest point to 1/3 misses it by ${nearest.toExponential(2)}` : ''}`;
      if (!ctx) return;
      const W = cv.width, H = cv.height, x0 = 30, x1 = W - 30, y = H / 2;
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = '#c9d1e0'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
      ctx.fillStyle = '#121a33';
      const r = Math.max(0.8, Math.min(5, 220 / n));
      for (let i = 0; i < n; i++) { ctx.beginPath(); ctx.arc(x0 + ((x1 - x0) * i) / (n - 1), y, i === 0 || i === n - 1 ? 6 : r, 0, 7); ctx.fill(); }
      if (third.checked) {
        const x = x0 + (x1 - x0) / 3;
        ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y - 26); ctx.lineTo(x, y + 26); ctx.stroke();
        ctx.fillStyle = '#ef4444'; ctx.font = '600 12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('1/3', x, y - 32);
      }
    }
    h.addEventListener('input', draw); third.addEventListener('change', draw);
    draw();
  }

  // ---------- 3. corners need room ----------
  function pageRoom() {
    page.innerHTML = `<h2>Corners need room</h2>
      <p>A dot fits in every dimension. A line fits in D1 and in every dimension above it: the whole endless list of dimensions, minus one (D0). A triangle needs D2 and fits everywhere from there up: the endless list minus two. Every extra corner can reach one more direction, so <b>v corners can span at most v − 1 dimensions</b>. The simplex is the shape that uses all of them.</p>
      <div class="ln-demo">
        <div class="ln-thumb" data-thumb></div>
        <div class="ln-ctl">
          <label>Corners <input type="range" data-vc min="1" max="12" value="4"><output data-vo></output></label>
          <p class="ln-read" data-read></p>
          <div class="ln-dims" data-dims></div>
        </div>
      </div>
      <p class="ln-note">On the corners chart, this is the shaded triangle above the diagonal. Those cells have fewer corners than the dimension needs. A shape there still fits, but it lies flat inside the space, like a sheet of paper in a room.</p>`;
    const v = page.querySelector('[data-vc]'), vo = page.querySelector('[data-vo]'), read = page.querySelector('[data-read]');
    const thumb = page.querySelector('[data-thumb]'), dims = page.querySelector('[data-dims]');
    function draw() {
      const n = +v.value, top = n - 1;
      vo.textContent = String(n);
      const spec = n === 1 ? { fam: 'point', N: 0 } : n === 2 ? { fam: 'line', N: 1 } : n === 3 ? { fam: 'polygon', N: 2, n: 3 } : { fam: 'simplex', N: top };
      thumb.innerHTML = thumbSVG(spec);
      read.innerHTML = `<b>${describe(spec).name}</b>: ${n} ${n === 1 ? 'corner' : 'corners'}, spans D${top}. It fits in D${top}, D${top + 1}, D${top + 2}, … forever; it does not fit below D${top}.`;
      let html = '';
      for (let d = 0; d <= 14; d++) html += `<span class="${d < top ? 'no' : d === top ? 'own' : 'yes'}">D${d}</span>`;
      dims.innerHTML = html + '<span class="yes">…∞</span>';
    }
    v.addEventListener('input', draw);
    draw();
  }

  // ---------- 4. how many shapes ----------
  function pageCount() {
    const shapes = gridShapes(600);
    const reg = shapes.filter((s) => s.spec.fam !== 'arch');
    const perV = (list, v) => list.filter((s) => s.v === v).length;
    const bars = (list, max) => {
      let html = '';
      for (let v = 1; v <= max; v++) {
        const n = perV(list, v);
        html += `<button type="button" data-goto="${v}" title="${v} corners: ${n} ${n === 1 ? 'shape' : 'shapes'}" style="--h:${n}"><i></i><small>${v % 4 === 0 || v <= 4 ? v : ''}</small></button>`;
      }
      return html;
    };
    let most = 0, mostAt = [], mostReg = 0;
    for (let v = 1; v <= 64; v++) mostReg = Math.max(mostReg, perV(reg, v));
    for (let v = 1; v <= 600; v++) { const n = perV(shapes, v); if (n > most) { most = n; mostAt = [v]; } else if (n === most) mostAt.push(v); }
    page.innerHTML = `<h2>How many shapes?</h2>
      <p><b>By dimension</b> (reading up the chart): D0 has 1 shape, D1 has 1, D2 has infinitely many (every polygon), D3 has 5, D4 has 6, and from D5 on, exactly 3 forever. Dimensions go on without end, one for each whole number: the smallest kind of infinity, the kind you can list.</p>
      <p><b>By corners</b> (reading across): every count from 4 up has at least two regular shapes, a polygon and a simplex. Every even count from 6 up adds a cross-polytope. Every power of two from 8 up adds a hypercube. So 8 corners gives four shapes: octagon, cube, 16-cell and 7-simplex.</p>
      <div class="ln-bars" style="--max:${mostReg}">${bars(reg, 64)}</div>
      <p class="ln-cap">Regular shapes per corner count, 1 to 64. Click a bar to open it on the chart.</p>
      <p>Add the Archimedean solids and their families and the busiest count on the chart is <b>${mostAt.join(' and ')} corners, with ${most} shapes</b>.</p>
      <div class="ln-bars" style="--max:${most}">${bars(shapes, 64)}</div>
      <p class="ln-cap">Regular and Archimedean together, 1 to 64.</p>`;
    page.querySelectorAll('[data-goto]').forEach((b) => b.addEventListener('click', () => { close(); onShowCorners && onShowCorners(+b.dataset.goto); }));
  }

  // ---------- 5. Archimedean patterns ----------
  function pageArch() {
    const grows = ARCH.filter((a) => a.grows);
    const rows = grows.map((a) => `<tr style="--fc:${a.color}"><th><span><i></i>${a.label}</span></th><td>${a.formula}</td>${[2, 3, 4, 5, 6, 7].map((n) => `<td>${fmt(archCorners(a, n))}</td>`).join('')}</tr>`).join('');
    page.innerHTML = `<h2>Archimedean patterns</h2>
      <p>There are 13 Archimedean solids: every corner looks the same and every face is a regular polygon, but they mix two or three kinds of face. Six of them belong to families that carry on into every dimension. The other seven stop at 3D: the five built on the dodecahedron and icosahedron (their 4D cousins have 720 to 14,400 corners) and the two twisted snubs.</p>
      <table class="ln-table"><thead><tr><th>Family</th><th>Rule</th><th>D2</th><th>D3</th><th>D4</th><th>D5</th><th>D6</th><th>D7</th></tr></thead><tbody>${rows}</tbody></table>
      <h3>What stands out</h3>
      <ul>
        <li><b>The cuboctahedron becomes regular in 4D.</b> Its rule gives 24 corners in 4D, and that shape is the 24-cell, the one regular shape that lives in a single dimension. In 3D and from 5D up, the same rule is only semi-regular.</li>
        <li><b>The truncated octahedron counts the factorials:</b> 6, 24, 120, 720, 5040. Its corners are every ordering of 1, 2, 3, …. In 4D it has 120 corners, the same as the 600-cell; in 5D it has 720, the same as the 4D rectified 600-cell.</li>
        <li><b>The truncated tetrahedron counts the pronic numbers</b> n × (n+1): 6, 12, 20, 30, 42. In 4D it has 20 corners like the dodecahedron; in 5D it has 30 like the icosidodecahedron.</li>
        <li><b>The cuboctahedron counts four times the triangle numbers:</b> 4, 12, 24, 40, 60, 84. In 6D it has 60 corners, the same count as the football (truncated icosahedron).</li>
        <li><b>Every family starts on the polygon floor.</b> In 2D the rules give a hexagon (6), a square (4) or an octagon (8), so each Archimedean line grows out of a polygon, just as the regular families do.</li>
        <li><b>Corners count symmetries.</b> The "omnitruncated" shapes (the truncated octahedron, truncated cuboctahedron and truncated icosidodecahedron) have one corner for every symmetry of their parent: 24, 48 and 120. The others divide those numbers evenly, because each corner is shared by a small group of symmetries.</li>
      </ul>
      <p class="ln-note">Switch on <b>Archimedean</b> in the corners view to see these families as dotted lines, and click any corner count to list everything that lands there.</p>`;
  }

  // ---------- about: who made it, the licence, this computer ----------
  function pageAbout() {
    const a = about();
    page.innerHTML = `<h2>About Dimension Atlas</h2>
      <p>Every shape is dots in space. Count the corners and the patterns appear. Dimension Atlas puts the regular shapes on one chart, from a single dot up to dimension 600, so the counting, even and doubling lines are there to see.</p>
      <div class="ln-about">
        <a class="ln-brand" href="https://in2infinity.com"><b>In2infinity</b><span>Made by In2infinity. More apps and info at in2infinity.com</span></a>
        <a class="ln-brand fire" href="https://dragonfire1.com"><b>Powered by Dragonfire</b><span>dragonfire1.com</span></a>
      </div>
      <h3>Free for non-commercial use</h3>
      <p>Use it, share it and change it for anything that is not commercial: learning, teaching, schools, research, hobbies and charities. It is licensed under the <a href="https://polyformproject.org/licenses/noncommercial/1.0.0">PolyForm Noncommercial License 1.0.0</a>. For commercial use, get in touch through <a href="https://in2infinity.com">in2infinity.com</a>.</p>
      <h3>This copy</h3>
      <dl class="ln-facts"><dt>Version</dt><dd>${a.version || 'dev'}</dd>${a.machine ? `<dt>This computer</dt><dd>${a.machine}</dd>` : ''}</dl>
      <details class="ln-notices"><summary>Built with</summary>
        <p>The 3D player uses <a href="https://threejs.org">three.js</a> (MIT licence) and the desktop app uses <a href="https://tauri.app">Tauri</a> (MIT / Apache-2.0) with other open-source Rust crates. Their licences apply to those parts.</p>
        ${a.notices ? `<pre>${a.notices.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre>` : ''}
      </details>
      <p class="ln-note">Required Notice: Copyright 2026 In2infinity (https://in2infinity.com)</p>`;
  }

  return { open, close, show, root };
}
