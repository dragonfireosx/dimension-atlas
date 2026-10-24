import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const html = readFileSync('src/index.template.html', 'utf8').replace('/*CSS*/', '').replace('<script>/*JS*/</script>', '');
const dom = new JSDOM(html, { pretendToBeVisual: true, url: 'http://localhost/' });
const { window } = dom;
globalThis.window = window; globalThis.document = window.document;
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window);
globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);

const errors = [];
window.addEventListener('error', (e) => errors.push(e.error || e.message));

const renderer = {
  domElement: window.document.createElement('canvas'), calls: 0,
  setClearColor() {}, setPixelRatio() {}, setSize() {}, render() { this.calls++; }, dispose() {},
};
renderer.domElement.setPointerCapture = () => {};

const { initApp } = await import('../src/main.js');
const app = initApp(window.document, { createRenderer: () => renderer });
const $ = (id) => window.document.getElementById(id);
let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
const click = (node) => node.dispatchEvent(new window.MouseEvent('click', { bubbles: true, clientY: 0 }));
const cell = (c, r) => window.document.querySelector(`.cell[data-c="${c}"][data-r="${r}"]`);
const frames = (n = 3) => { for (let i = 0; i < n; i++) app.viewer._frame(performance.now() + 16 * (i + 1)); };

// start state: tesseract, stereographic
ok($('p-name').textContent.includes('Tesseract'), 'starts on the tesseract: ' + $('p-name').textContent);
ok(app.viewer.view.mode === 'stereo', 'tesseract opens stereographic');
ok(window.document.querySelectorAll('.cell').length > 20, 'cells rendered');
ok(window.document.querySelectorAll('.cell.sel').length === 1, 'exactly one selected cell');
frames(); ok(renderer.calls >= 3, 'renderer called');

// click each shape cell in D3 and D4
const names = { '3,0': 'Tetrahedron', '3,1': 'Octahedron', '3,2': 'Cube', '3,3': 'Icosahedron', '3,4': 'Dodecahedron', '4,0': '5-cell', '4,1': '16-cell', '4,3': '600-cell', '4,4': '120-cell', '4,5': '24-cell' };
for (const [k, name] of Object.entries(names)) {
  const [c, r] = k.split(',').map(Number);
  const node = cell(c, r); ok(node, `cell ${k} exists`);
  click(node); frames();
  ok($('p-name').textContent.includes(name), `${k} -> ${$('p-name').textContent}`);
  ok($('detail').textContent.includes(name), `${name} in detail`);
}
ok($('detail').textContent.includes('96') && $('detail').textContent.includes('24'), '24-cell counts shown');

// the gap the user asked about: no 3D version of the 24-cell
click(cell(3, 5));
ok($('detail').textContent.includes('24-cell has no 3D twin') && $('detail').textContent.includes('24-cell'), 'gap explanation');
ok(cell(3, 5).classList.contains('hot'), 'hot gap flagged');
ok(app.viewer.view.nv === 24, 'player keeps last shape on gap');

// polygons
click(cell(2, 6));
ok($('detail').querySelector('#polyrange'), 'polygon slider');
app.setPolyN(600); frames();
ok($('p-name').textContent.includes('600-gon'), 'n=600: ' + $('p-name').textContent);
ok(app.viewer.view.nv === 600, '600 corners drawn');
app.setPolyN(5); ok(app.S.cur.r0 === 3, 'pentagon lives in the icosahedron/dodecahedron cell');
app.setPolyN(3); ok(app.S.cur.r0 === 0, 'triangle in simplex row');

// walk the whole timeline for every family
let walked = 0;
for (let row = 0; row < 7; row++) {
  app.selectCell(row, 3);
  for (const d of [0, 1, 2, 3, 4, 5, 6, 7, 9, 12, 13, 40, 150, 599, 600]) {
    app.setDimension(d); frames(2); walked++;
    ok(app.S.col === d, `slider D${d}`);
    ok($('p-name').textContent.length > 0, 'card follows');
    ok(app.viewer.view && app.viewer.view.pos.every(Number.isFinite), `finite positions row ${row} D${d}`);
  }
}
ok(walked === 105, 'walked');

// the numbers from the brief
app.selectCell(2, 3); app.setDimension(600);
ok($('p-note').textContent.includes('4,096') || $('p-note').textContent.includes('12-cube'), 'big hypercube is flagged as a sample');
ok($('detail').textContent.includes('4.15×10^180'), '2^600 shown');
app.selectCell(0, 3); app.setDimension(600);
ok($('detail').textContent.includes('601'), 'D600 simplex has 601 corners');
app.selectCell(1, 3); app.setDimension(600);
ok($('detail').textContent.includes('1,200'), 'D600 cross has 1,200 corners');
ok(window.document.querySelector('[data-far="1"]').classList.contains('sel'), 'D600 lights up the forever column');

// view modes
app.selectCell(0, 3);
for (const m of ['stereo', 'direct', 'petrie']) {
  const b = window.document.querySelector(`#modes button[data-mode="${m}"]`);
  ok(b, 'mode button ' + m); click(b); frames();
  ok(app.viewer.view.mode === m, 'mode ' + m);
}
app.selectCell(4, 4); ok(window.document.querySelector('#modes button[data-mode="petrie"]').disabled, 'no flat pattern for the 120-cell');

// the dimension table: D0..D8, then one column for everything after
ok(window.document.querySelectorAll('.dt-col[data-col]').length === 9, 'nine dimension columns');
ok(window.document.querySelectorAll('.step').length === 21, 'step badges on the three endless lines');
const far = $('far'); far.value = '20'; far.dispatchEvent(new window.Event('input', { bubbles: true }));
ok(window.document.querySelector('[data-far="2"]').textContent.includes('1.05×10^6'), '2^20 in the forever column');
click(window.document.querySelector('[data-far="0"]'));
ok(app.S.col === 20 && $('p-name').textContent.includes('20-simplex'), 'forever column opens the 20-simplex: ' + $('p-name').textContent);
click(window.document.querySelector('.dt-col[data-col="3"]'));
ok(app.S.col === 3, 'column header picks the dimension');

// chips + sequence buttons
app.selectCell(2, 3);
const chip = window.document.querySelector('#chips [data-chip="5"]'); ok(chip, 'chip D5');
click(chip); ok(app.S.col === 5, 'chip jumps to D5');
click(window.document.querySelector('#chips [data-chip="600"]')); ok(app.S.col === 600, 'path jumps to 600D');

// corners view: what has n corners?
const cardNames = () => [...window.document.querySelectorAll('.vg-card b')].map((b) => b.textContent);
const expectCol = { 1: ['Point'], 2: ['Line segment'], 4: ['Square', 'Tetrahedron'], 5: ['Pentagon', '5-cell (4-simplex)'],
  6: ['Hexagon', 'Octahedron', '5-simplex'], 8: ['Octagon', 'Cube', '16-cell', '7-simplex'], 12: ['Dodecagon', 'Icosahedron', '6-orthoplex', '11-simplex'],
  24: ['24-gon', '24-cell', '12-orthoplex', '23-simplex'], 120: ['120-gon', '600-cell', '60-orthoplex', '119-simplex'], 600: ['600-gon', '120-cell', '300-orthoplex', '599-simplex'] };
for (const [v, names] of Object.entries(expectCol)) {
  app.grid.showCol(+v);
  ok(JSON.stringify(cardNames()) === JSON.stringify(names), `${v} corners: ${cardNames().join(', ')}`);
}
app.grid.showCol(5);
click(window.document.querySelector('.vg-card[data-id="simplex::4:"]'));
ok($('p-name').textContent.includes('5-cell'), 'card loads the 5-cell');
ok(window.document.querySelector('.vg-card.on[data-id="simplex::4:"]'), 'loaded card is marked');
click(window.document.querySelector('.vg-card[data-id="polygon::2:5"]'));
ok($('p-name').textContent === 'Pentagon', 'card loads the pentagon');
app.selectCell(2, 3);
ok(app.grid.col === 8 && window.document.querySelector('.vg-card.on[data-id="cube::3:"]'), 'selecting the cube opens the 8-corner list');
app.setPolyN(37);
ok(app.grid.col === 37 && cardNames().includes('37-gon'), 'polygon slider follows into the list');

// advanced mode: the Archimedean solids join the lists
app.grid.setAdvanced(true);
app.grid.showCol(24);
for (const n of ['Truncated cube', 'Truncated octahedron', 'Rhombicuboctahedron', 'Snub cube', '24-cell'])
  ok(cardNames().includes(n), `24 corners lists ${n}: ${cardNames().join(', ')}`);
app.grid.showCol(120);
ok(cardNames().includes('Omnitruncated 5-cell') && cardNames().includes('600-cell') && cardNames().includes('Truncated icosidodecahedron'), '120 corners: ' + cardNames().join(', '));
click(window.document.querySelector('.vg-card[data-id="arch:to:4:"]'));
ok($('p-name').textContent === 'Omnitruncated 5-cell', 'Archimedean card loads in the player: ' + $('p-name').textContent);
ok($('detail').textContent.includes('(n+1)!'), 'Archimedean detail panel shows the rule');
click(window.document.querySelector('[data-achip="5"]'));
ok($('p-name').textContent === '5D permutohedron', 'sequence button steps the family: ' + $('p-name').textContent);
click(window.document.querySelector('[data-achip="3"]'));
ok($('p-name').textContent === 'Truncated octahedron', 'path chip steps back down');
app.selectSpec({ fam: 'arch', a: 'co', N: 4 });
ok($('p-name').textContent.includes('24-cell'), 'the 4D cuboctahedron opens the 24-cell');
frames();
app.grid.setAdvanced(false);
app.grid.showCol(24);
ok(!cardNames().includes('Truncated cube'), 'advanced off hides them again');

// learn pages
click($('learnbtn'));
ok(!$('learn').hidden, 'learn opens');
for (const id of ['patterns', 'nest', 'nature', 'centre', 'line', 'room', 'count', 'arch']) {
  click(window.document.querySelector(`[data-page="${id}"]`));
  ok(window.document.querySelector('.ln-page h2'), `learn page ${id} renders`);
}
click(window.document.querySelector('[data-page="patterns"]'));
const pd = window.document.querySelector('[data-pd]');
pd.value = '4'; pd.dispatchEvent(new window.Event('input'));
const pr = window.document.querySelector('[data-read]').textContent;
ok(/Simplex 5/.test(pr) && /Cross-polytope 8/.test(pr) && /Hypercube 16/.test(pr), 'D4 reads 5, 8, 16: ' + pr);
click(window.document.querySelector('[data-page="nest"]'));
ok(window.document.querySelectorAll('.ln-nest circle').length === 8 + 4 + 4 + 6 + 1, 'nest draws cube, two tetrahedra, octahedron and centre');
ok(window.document.querySelectorAll('.ln-nest line').length === 12 + 6 + 6 + 12, 'nest edge counts 12 + 6 + 6 + 12');
click(window.document.querySelector('[data-page="nature"]'));
const sr = window.document.querySelector('[data-shell]');
for (const [n, e] of [[1, 2], [2, 8], [3, 18], [4, 32]]) { sr.value = String(n); sr.dispatchEvent(new window.Event('input')); ok(window.document.querySelector('[data-read]').textContent.includes(`= ${e}`), `shell ${n} holds ${e}`); }
click(window.document.querySelector('[data-coord="1"]'));
ok(window.document.querySelector('[data-cread]').textContent.includes('octahedron'), 'salt is octahedral');
click(window.document.querySelector('[data-page="centre"]'));
const kr = window.document.querySelector('[data-k]');
kr.value = '0'; kr.dispatchEvent(new window.Event('input'));
ok(window.document.querySelector('[data-read]').textContent.includes('8 corners on 1 spot'), 'cube collapses to its centre: ' + window.document.querySelector('[data-read]').textContent);
kr.value = '200'; kr.dispatchEvent(new window.Event('input'));
ok(window.document.querySelector('[data-read]').textContent.includes('on 4 spots'), 'cube squashed to 2D: 4 spots');
click(window.document.querySelector('[data-page="room"]'));
const vr = window.document.querySelector('[data-vc]');
vr.value = '6'; vr.dispatchEvent(new window.Event('input'));
ok(window.document.querySelector('[data-read]').textContent.includes('spans D5'), '6 corners span D5');
click(window.document.querySelector('[data-page="count"]'));
click(window.document.querySelector('[data-goto="8"]'));
ok($('learn').hidden && app.grid.col === 8 && app.S.view === 'corners', 'bar jumps to 8 corners on the chart');

// the chart follows the sidebar: same zoom, glides to the picked cell, bottom-left stays locked
app.setView('corners');
app.grid.frame(9);
const s0 = app.grid.s;
app.selectCell(0, 3);
await new Promise((r) => setTimeout(r, 400));
ok(app.grid.s === s0, 'following never changes the zoom');
click(window.document.querySelector('#chips [data-chip="40"]') || window.document.querySelector('#chips [data-chip="8"]'));
await new Promise((r) => setTimeout(r, 400));
ok(app.S.col === 8 && app.grid.cy > 1, 'chart slides up to follow the 8-simplex: cy ' + app.grid.cy.toFixed(2));
app.grid.panTo(200, 2); await new Promise((r) => setTimeout(r, 400));
ok(app.grid.cx > 150 && app.grid.cy === -0.2, 'far right along the floor: moves sideways, stays on the baseline: ' + app.grid.cx.toFixed(1) + ',' + app.grid.cy.toFixed(2));
app.selectCell(0, 1);
await new Promise((r) => setTimeout(r, 400));
ok(app.grid.cx === 0.7 && app.grid.cy === -0.2, 'back near the start, it rests on the locked corner');

// full screen: step through every shape in the dimension
app.grid.setAdvanced(false);
app.selectCell(2, 4);
click($('full'));
ok(app.el.app.dataset.full === '1', 'full screen on');
const strip = () => [...window.document.querySelectorAll('.fs-strip button')].map((b) => b.title);
ok(JSON.stringify(strip()) === JSON.stringify(['5-cell (4-simplex)', '16-cell', 'Tesseract (8-cell)', '600-cell', '120-cell', '24-cell']), '4D strip: ' + strip().join(', '));
const seen = new Set();
for (let i = 0; i < 6; i++) { click(window.document.querySelector('[data-fs="next"]')); seen.add(app.viewer.view.nv); }
ok(seen.size === 6 && app.S.spec.fam === 'cube', 'next walks all six 4D shapes and wraps round');
click(window.document.querySelector('[data-fs="dimup"]'));
ok(app.S.col === 5 && window.document.querySelectorAll('.fs-strip button').length === 3, '5D has three shapes');
click(window.document.querySelector('.fs-strip [data-fs-i="0"]'));
ok($('p-name').textContent.includes('5-simplex'), 'strip button loads a shape');
app.grid.setAdvanced(true);
app.selectCell(2, 3);
ok(window.document.querySelectorAll('.fs-strip button').length === 5 + 13, '3D with Archimedean: 18 shapes');
app.grid.setAdvanced(false);
click(window.document.querySelector('[data-fs="close"]'));
ok(app.el.app.dataset.full === '0', 'full screen off');

// too big for this computer: a freeze-frame circle, never a crash
app.selectSpec({ fam: 'arch', a: 'tco', N: 8 });
ok(app.viewer.view.shape.fam === 'standin' && app.viewer.view.frozen, 'omnitruncated 8-cube (10 million corners) shows the stand-in');
ok(!$('oob').hidden, 'out-of-bounds badge shown');
ok($('p-note').textContent.includes('Too big to draw on this computer') && $('p-note').textContent.includes('10,321,920') && /GB/.test($('p-note').textContent), 'note explains: ' + $('p-note').textContent.slice(0, 120));
ok([...window.document.querySelectorAll('#modes button')].every((b) => b.disabled), 'view modes off for the stand-in');
ok(window.document.querySelector('#chips [data-achip="8"]').classList.contains('big') && window.document.querySelector('#chips [data-achip="7"]').classList.contains('big'), 'too-big chips marked');
ok(!window.document.querySelector('#chips [data-achip="6"]').classList.contains('big'), '46,080 corners fits the full budget');
{ const rot = app.viewer.group.rotation.y; frames(5); ok(app.viewer.group.rotation.y === rot, 'stand-in stays still'); }
click(window.document.querySelector('#chips [data-achip="5"]'));
ok(app.viewer.view.shape.fam === 'arch' && app.viewer.view.nv === 3840 && $('oob').hidden, 'stepping back down draws the real shape again');

// big but drawable: say "Building…", let the page paint, then build
app.selectSpec({ fam: 'arch', a: 'to', N: 7 });
ok(!$('busy').hidden && $('busy').textContent.includes('40,320'), 'busy message before a big build');
await new Promise((r) => setTimeout(r, 120));
ok($('busy').hidden && app.viewer.view.nv === 40320, 'big build lands');
app.selectSpec({ fam: 'arch', a: 'to', N: 7 }); app.selectCell(2, 4);
await new Promise((r) => setTimeout(r, 120));
ok(app.viewer.view.shape.fam === 'cube' && $('busy').hidden, 'a newer pick wins over a pending big build');

// the graphics card resets: stop drawing, say so, rebuild when it comes back
renderer.domElement.dispatchEvent(new window.Event('webglcontextlost', { cancelable: true }));
{ const c = renderer.calls; frames(3); ok(renderer.calls === c && !$('busy').hidden, 'no drawing while the context is lost'); }
renderer.domElement.dispatchEvent(new window.Event('webglcontextrestored'));
frames(2); ok($('busy').hidden && app.viewer.view.nv === 16 && !app.viewer.lost, 'rebuilt after the context comes back');

// a smaller computer: the light budget turns the 7168-corner cantellated 8-cube into a stand-in
const { TIERS, pickTier, describeMachine } = await import('../src/budget.js');
ok(pickTier({ availableMb: 1800, cores: 8 }) === TIERS.light && pickTier({ availableMb: 4000, cores: 8 }) === TIERS.standard
  && pickTier({ availableMb: 30000, cores: 16 }) === TIERS.full && pickTier({ availableMb: 30000, cores: 16, gpu: 'llvmpipe (LLVM 15.0.7, 256 bits)' }) === TIERS.light
  && pickTier({}) === TIERS.standard && pickTier({ availableMb: 9000, cores: 4 }) === TIERS.standard, 'tiers follow memory, cores and GPU');
ok(describeMachine({ cores: 24, availableMb: 50000 }, TIERS.full) === '24 cores · 49 GB free · Full detail', 'machine line: ' + describeMachine({ cores: 24, availableMb: 50000 }, TIERS.full));
{
  const dom2 = new JSDOM(html, { pretendToBeVisual: true, url: 'http://localhost/' });
  const r2 = { ...renderer, domElement: dom2.window.document.createElement('canvas') };
  const small = initApp(dom2.window.document, { createRenderer: () => r2, tier: TIERS.light });
  small.selectSpec({ fam: 'arch', a: 'rco', N: 8 });
  ok(small.viewer.view.shape.fam === 'standin' && small.viewer.view.nv === TIERS.light.ring, 'light budget: 7168 corners becomes a 180-dot stand-in');
  small.selectSpec({ fam: 'arch', a: 'to', N: 6 });
  ok(small.viewer.view.nv === 5040, 'light budget still draws 5040 corners');
}

// About: credits, licence, outside links leave the app
app.learn.open('about');
{
  const pg = window.document.querySelector('.ln-page');
  ok(pg.querySelector('a[href="https://in2infinity.com"]') && pg.querySelector('a[href="https://dragonfire1.com"]'), 'about links In2infinity and Dragonfire');
  ok(/Free for non-commercial use/.test(pg.textContent) && /PolyForm Noncommercial/.test(pg.textContent), 'about states the licence');
  ok(/three\.js/.test(pg.textContent), 'about credits three.js');
  ok(window.document.querySelector('.ln-credit a[href="https://dragonfire1.com"]'), 'Learn side bar carries the credit');
  const opened = [];
  window.__TAURI__ = { opener: { openUrl: (u) => { opened.push(u); return Promise.resolve(); } } };
  const ev = new window.MouseEvent('click', { bubbles: true, cancelable: true });
  pg.querySelector('a[href="https://in2infinity.com"]').dispatchEvent(ev);
  ok(ev.defaultPrevented && opened[0] === 'https://in2infinity.com/', 'desktop app opens links in the system browser: ' + opened[0]);
  delete window.__TAURI__;
}
app.learn.close();

ok(errors.length === 0, 'no uncaught errors: ' + errors.join('; '));
console.log(`app: ${checks} checks passed`);
process.exit(0);
