// entry.js — the start-up sequence behind the loading screen: scan the computer, lay out the chart, start the viewer.
import { initApp } from './main.js';
import { scanMachine, describeMachine } from './budget.js';

const boot = document.getElementById('boot');
const note = document.getElementById('boot-note');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const painted = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

async function step(id, work) {
  const li = boot.querySelector(`[data-step="${id}"]`);
  li.classList.add('on');
  await painted();                       // let the spinner show before any heavy work
  const t0 = performance.now();
  const out = await work();
  const left = 220 - (performance.now() - t0);
  if (left > 0) await wait(left);        // long enough to read, never longer
  li.classList.replace('on', 'done');
  return out;
}

(async () => {
  try {
    const { machine, tier } = await step('scan', () => scanMachine(window));
    note.textContent = describeMachine(machine, tier);
    /* global __APP_VERSION__ */
    const app = await step('chart', () => initApp(document, { tier, version: __APP_VERSION__, machineLine: describeMachine(machine, tier) }));
    app.machine = machine;
    window.__atlas = app;
    await step('view', () => painted());
    boot.classList.add('gone');
    setTimeout(() => boot.remove(), 400);
  } catch (e) {
    note.textContent = `Something went wrong while starting: ${e && e.message ? e.message : e}`;
    console.error(e);
  }
})();
