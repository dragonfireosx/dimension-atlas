// budget.js — how big a shape this computer can draw. Decided once at start-up from a scan of the machine.
// In the desktop app Rust reads the real memory and core count (system_scan in src-tauri/src/lib.rs);
// in a plain browser we fall back to what the browser is willing to say.

// corners  most corners we build for real; anything bigger gets the circle stand-in
// edges    most edges drawn while spinning      points  curve samples in the Bubble view
// ring     corners on the stand-in circle       pixelRatio  sharpest the 3D canvas renders
export const TIERS = {
  light: { id: 'light', label: 'Light', corners: 6000, edges: 20000, points: 30000, ring: 180, pixelRatio: 1 },
  standard: { id: 'standard', label: 'Standard', corners: 20000, edges: 40000, points: 60000, ring: 270, pixelRatio: 1.5 },
  full: { id: 'full', label: 'Full', corners: 50000, edges: 60000, points: 80000, ring: 360, pixelRatio: 2 },
};

const SOFTWARE_GPU = /llvmpipe|softpipe|swiftshader|software|basic render/i;

export function pickTier(m) {
  const mem = m.availableMb ?? m.totalMb;
  if (m.gpu && SOFTWARE_GPU.test(m.gpu)) return TIERS.light;
  if ((mem != null && mem < 2500) || (m.cores != null && m.cores <= 2)) return TIERS.light;
  if (mem == null && m.cores == null) return TIERS.standard;
  if ((mem != null && mem < 6000) || (m.cores != null && m.cores <= 4)) return TIERS.standard;
  return TIERS.full;
}

function gpuName(doc) {
  try {
    const c = doc.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return null;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();               // hand the context straight back
    return String(name || '');
  } catch { return null; }
}

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('timeout')), ms))]);

export async function scanMachine(win = window) {
  const m = { source: 'browser', totalMb: null, availableMb: null, cores: null, cpu: '', os: '', gpu: gpuName(win.document) };
  const invoke = win.__TAURI__ && win.__TAURI__.core && win.__TAURI__.core.invoke;
  if (invoke) {
    try {
      const r = await withTimeout(invoke('system_scan'), 2000);
      Object.assign(m, { source: 'app', totalMb: r.total_mb, availableMb: r.available_mb, cores: r.cores, cpu: r.cpu, os: r.os });
    } catch { /* fall through to the browser's guess */ }
  }
  if (m.source === 'browser') {
    const nav = win.navigator || {};
    if (nav.deviceMemory) m.totalMb = nav.deviceMemory * 1024;   // capped at 8 GB by the browser
    if (nav.hardwareConcurrency) m.cores = nav.hardwareConcurrency;
  }
  return { machine: m, tier: pickTier(m) };
}

// One line for people: "24 cores · 49 GB free · Full detail".
export function describeMachine(m, tier) {
  const bits = [];
  if (m.cores) bits.push(`${m.cores} cores`);
  if (m.availableMb != null) bits.push(`${(m.availableMb / 1024).toFixed(m.availableMb < 10240 ? 1 : 0)} GB free`);
  else if (m.totalMb != null) bits.push(`${(m.totalMb / 1024).toFixed(0)} GB memory`);
  bits.push(`${tier.label} detail`);
  return bits.join(' · ');
}
