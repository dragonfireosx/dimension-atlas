// viewer.js — the three.js player. Draws whatever ShapeView gives it.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ShapeView } from './projection.js';
import { buildShape } from './geometry.js';

function dotTexture() {
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    if (!g) return null;
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 30);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.55, 'rgba(255,255,255,0.95)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(32, 32, 30, 0, Math.PI * 2); g.fill();
    return new THREE.CanvasTexture(c);
  } catch { return null; }
}

export class Viewer {
  constructor(container, { createRenderer, onError, onLost, pixelRatio = 2 } = {}) {
    this.container = container;
    this.playing = true;
    this.speed = 1;
    this.view = null;
    this.spec = null;
    this.mode = 'direct';
    this.failed = false;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.05, 400);
    this.camera.position.set(0, 0.6, 4.6);

    try {
      this.renderer = createRenderer ? createRenderer() : new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch (e) {
      this.failed = true;
      if (onError) onError(e);
      return;
    }
    this.renderer.setClearColor(0x0c1330, 1);
    this.renderer.setPixelRatio(Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, pixelRatio));
    const el = this.renderer.domElement;
    // If the graphics card gives up (out of memory, driver reset), stop drawing, say so, and rebuild when it comes back.
    this.lost = false;
    el.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; if (onLost) onLost(true); });
    el.addEventListener('webglcontextrestored', () => { this.lost = false; if (this.spec) this.setShape(this.spec, this.mode, this.color); if (onLost) onLost(false); });
    el.style.width = '100%'; el.style.height = '100%'; el.style.display = 'block'; el.style.touchAction = 'none';
    container.appendChild(el);

    this.controls = new OrbitControls(this.camera, el);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 0.6;
    this.controls.maxDistance = 60;

    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.tex = dotTexture();

    this._resize = () => {
      const w = Math.max(40, container.clientWidth), h = Math.max(40, container.clientHeight);
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    };
    this._resize();
    if (typeof ResizeObserver !== 'undefined') { this.ro = new ResizeObserver(this._resize); this.ro.observe(container); }

    this.last = performance.now();
    this._frame = this._frame.bind(this);
    this.raf = requestAnimationFrame(this._frame);
  }

  _clear() {
    for (const o of [this.lines, this.points, this.mesh]) {
      if (!o) continue;
      this.group.remove(o);
      o.geometry.dispose();
      o.material.dispose();
    }
    this.lines = this.points = this.mesh = null;
  }

  // Returns facts about what is on screen.
  setShape(spec, mode, color = '#9db4ff') {
    if (this.failed) return null;
    this.spec = spec; this.mode = mode; this.color = color;
    this._clear();
    const shape = buildShape(spec);
    const view = new ShapeView(shape, mode);
    view.frozen = shape.fam === 'standin';          // a freeze frame: nothing real to turn
    this.view = view;
    this.mode = view.mode;

    const posAttr = new THREE.BufferAttribute(view.pos, 3).setUsage(THREE.DynamicDrawUsage);
    const colAttr = new THREE.BufferAttribute(view.col, 3).setUsage(THREE.DynamicDrawUsage);
    this.posAttr = posAttr; this.colAttr = colAttr;

    const density = Math.max(1, view.ne);
    const lineOpacity = density <= 150 ? 0.9 : Math.max(0.02, 0.9 * Math.pow(150 / density, 0.8));   // dense patterns need faint lines

    if (view.index.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', posAttr); g.setAttribute('color', colAttr);
      g.setIndex(new THREE.BufferAttribute(view.index, 1));
      const m = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: lineOpacity, blending: THREE.AdditiveBlending, depthWrite: false });
      this.lines = new THREE.LineSegments(g, m);
      this.lines.frustumCulled = false;
      this.group.add(this.lines);
    }

    const nv = view.nv;
    const size = nv <= 40 ? 11 : nv <= 300 ? 7 : nv <= 3000 ? 4 : 2.5;
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', posAttr); pg.setAttribute('color', colAttr);
    pg.setDrawRange(0, nv);
    const pm = new THREE.PointsMaterial({
      size, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false,
      map: this.tex || null, alphaTest: this.tex ? 0.02 : 0,
    });
    this.points = new THREE.Points(pg, pm);
    this.points.frustumCulled = false;
    this.group.add(this.points);

    if (view.faceIndex) {
      const fg = new THREE.BufferGeometry();
      fg.setAttribute('position', posAttr);
      fg.setIndex(new THREE.BufferAttribute(view.faceIndex, 1));
      const fm = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: Math.max(0.015, Math.min(0.14, 1.2 / Math.sqrt(view.faceIndex.length / 3))), side: THREE.DoubleSide, depthWrite: false });
      this.mesh = new THREE.Mesh(fg, fm);
      this.mesh.frustumCulled = false;
      this.group.add(this.mesh);
    }

    this.group.rotation.set(0, 0, 0);
    const dist = view.mode === 'stereo' ? 5.8 : view.A > 4 ? 5 : 4.4;
    this.camera.position.setLength(dist);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
    return { mode: view.mode, ...view.info, k: view.k, faces: !!view.faceIndex };
  }

  resetCamera() {
    if (this.failed) return;
    this.camera.position.set(0, 0.6, 4.6).setLength(this.mode === 'stereo' ? 5.8 : 4.4);
    this.controls.target.set(0, 0, 0);
    this.group.rotation.set(0, 0, 0);
    this.controls.update();
  }

  _frame(now) {
    this.raf = requestAnimationFrame(this._frame);
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const v = this.view;
    if (v && this.playing) {
      if (v.static) { if (!v.frozen) this.group.rotation.y += dt * 0.45 * this.speed; }
      else {
        v.step(dt * this.speed);
        v.update();
        this.posAttr.needsUpdate = true;
        this.colAttr.needsUpdate = true;
      }
    }
    this.controls.update();
    if (!this.lost) this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    if (this.ro) this.ro.disconnect();
    if (this.failed) return;
    this._clear();
    this.controls.dispose();
    this.renderer.dispose();
  }
}
