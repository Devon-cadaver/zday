// Searchlights at night: white beams that point out the trouble. Helicopters
// shine down on the disaster nearest them (or sweep the street below), rescue
// vehicles on a scene aim theirs at it, and lamps on the tallest roofs near each
// disaster track it. Each beam is a soft additive cone with a pool of light
// where it lands - no real lights, so the city's own shading costs nothing more.
// They fade in after dusk and out at dawn.
import * as THREE from 'three';

const MAX = 18, COL = new THREE.Color(1.0, 0.94, 0.78);
const VS = /* glsl */`varying float vL; varying vec3 vN, vW;
void main() { vL = uv.y; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`;
const FS = /* glsl */`uniform float uOp; uniform vec3 uCol, uAx; varying float vL; varying vec3 vN, vW;
void main() {
  vec3 V = normalize(cameraPosition - vW); float side = abs(dot(normalize(vN), V)); // brightest through the middle of the cone, soft at its edges
  float endOn = 1.0 - smoothstep(0.72, 0.95, abs(dot(uAx, V))); // looked at down its length, a cone shows as rings: it fades out
  gl_FragColor = vec4(uCol * uOp * pow(side, 1.6) * pow(1.0 - vL, 1.3) * smoothstep(0.0, 0.05, vL) * endOn, 1.0); // fading away to nothing at the far end (an open end showed as a hard ring)
}`;
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function poolTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.55, 'rgba(255,255,255,0.4)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Searchlights {
  constructor(scene, { game, traffic, helis, city, daylight }) {
    Object.assign(this, { scene, game, traffic, helis, city, daylight });
    const cone = new THREE.CylinderGeometry(1, 0.06, 1, 18, 12, true).translate(0, 0.5, 0); // the lamp at the origin, the wide end one unit up (rings along it, to bend with the world's curve)
    const quad = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), tex = poolTexture();
    this.slots = [];
    for (let i = 0; i < MAX; i++) {
      const beam = new THREE.Mesh(cone, new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: { uOp: { value: 0 }, uCol: { value: COL }, uAx: { value: new THREE.Vector3(0, 1, 0) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      const pool = new THREE.Mesh(quad, new THREE.MeshBasicMaterial({ map: tex, color: COL, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
      beam.renderOrder = 7; pool.renderOrder = 2; beam.frustumCulled = pool.frustumCulled = false; beam.visible = pool.visible = false;
      scene.add(beam, pool);
      this.slots.push({ beam, pool, a: new THREE.Vector3(), b: new THREE.Vector3(), wa: new THREE.Vector3(), wb: new THREE.Vector3(), on: 0, want: false, key: null });
    }
    this.t = 0; this.planT = 0; this.roofFor = new Map(); this._up = new THREE.Vector3(0, 1, 0); this._d = new THREE.Vector3();
  }
  // what to light: the bad guys the Follow button knows (with their height), and the other disasters' centres
  targets() {
    const out = [], g = this.game, D = g.disasters; if (!D) return out;
    for (const s of g.subjects('bad')) { const p = s.pos(); if (p) out.push({ key: s.obj, x: p[0], y: p[1], z: p[2] }); }
    for (const e of D.list) {
      if (!e.alive || !e.poi || ['villains', 'kaiju', 'worm', 'riot', 'aliens', 'heroes'].includes(e.type)) continue;
      const p = e.poi(g.controls.target.x, g.controls.target.z); if (p && p.danger > 0) out.push({ key: e, x: p.x, y: 6, z: p.z });
    }
    return out;
  }
  // who aims where, worked out a few times a second
  plan() {
    const T = this.targets(), slots = this.slots, cam = this.game.controls.target; let n = 0;
    for (const s of slots) s.want = false;
    if (!T.length && !this.helis.list.length) return;
    const nearest = (x, z, R) => { let best = null, bd = R; for (const q of T) { const d = Math.hypot(q.x - x, q.z - z); if (d < bd) { bd = d; best = q; } } return best; };
    const use = (key, ax, ay, az, bx, by, bz) => { if (n >= MAX) return; const s = slots[n++]; s.want = true; if (s.key !== key) { s.key = key; s.a.set(ax, ay, az); s.b.set(bx, by, bz); } s.wa.set(ax, ay, az); s.wb.set(bx, by, bz); };
    // helicopters: on the nearest trouble, or sweeping the street below
    for (const hl of this.helis.list) { // the lamp under the nose
      const q = nearest(hl.x, hl.z, 240), a = this.t * 0.6 + (hl.bob || 0), nx = hl.x + (hl.hx || 0) * 6, ny = hl.y + 1.4, nz = hl.z + (hl.hz || 0) * 6;
      if (q) use(hl, nx, ny, nz, q.x + Math.cos(a) * 4, q.y * 0.5, q.z + Math.sin(a) * 4);
      else use(hl, nx, ny, nz, nx + Math.cos(a) * 22, 0, nz + Math.sin(a) * 22);
    }
    if (!T.length) return;
    // lamps on the tallest roof near each disaster (up to four), tracking it
    for (const q of T.slice(0, 4)) {
      let k = this.roofFor.get(q.key);
      if (k == null || this.city.dead[k]) {
        let best = -1, top = 0; this.city.buildingsNear(q.x, q.z, 170, (kk, d, b) => { if (d > 45 && !this.city.dead[kk] && !b.landmark && b.top > top) { top = b.top; best = kk; } });
        k = best; this.roofFor.set(q.key, k);
      }
      if (k < 0) continue;
      const b = this.city.buildings[k], sw = Math.sin(this.t * 0.5 + k) * 5;
      use('roof' + k, (b.x0 + b.x1) / 2, b.top + 1.5, (b.z0 + b.z1) / 2, q.x + sw, q.y * 0.6, q.z - sw);
    }
    // rescue vehicles on a scene (the six nearest the view): their lamps on the trouble
    const cars = this.traffic.missions.filter(c => !c.gone).map(c => [Math.hypot(c.x - cam.x, c.z - cam.z), c]).sort((p, q) => p[0] - q[0]).slice(0, 6);
    for (const [, c] of cars) { const q = nearest(c.x, c.z, 140); if (q) use(c, c.x, 3.2, c.z, q.x, q.y * 0.4, q.z); }
  }
  update(dt) {
    this.t += dt;
    const k = sstep(0.25, 0.75, this.daylight ? this.daylight.night : 0);
    if (k <= 0) { if (this.lit) { for (const s of this.slots) { s.beam.visible = s.pool.visible = false; s.on = 0; s.key = null; } this.lit = false; } return; }
    this.lit = true;
    if ((this.planT -= dt) <= 0) { this.planT = 0.25; this.plan(); }
    const e = 1 - Math.exp(-dt * 4);
    for (const s of this.slots) {
      s.on += ((s.want ? 1 : 0) - s.on) * Math.min(1, dt * 2.5);
      if (s.on < 0.01) { s.beam.visible = s.pool.visible = false; if (!s.want) s.key = null; continue; }
      s.a.lerp(s.wa, e); s.b.lerp(s.wb, e);
      const d = this._d.subVectors(s.b, s.a), len = d.length(); if (len < 1) continue;
      d.multiplyScalar(1 / len);
      // a real beam goes on past what it lights, fading, until it meets the ground
      const toGround = d.y < -0.03 ? (s.a.y - 0.2) / -d.y : 1e9, L = Math.min(len * 1.7 + 25, toGround), R = Math.min(12, Math.max(2.5, L * 0.055));
      s.beam.visible = L > 16; // a lamp right on top of what it lights: only the pool
      if (s.beam.visible) { s.beam.position.copy(s.a); s.beam.quaternion.setFromUnitVectors(this._up, d); s.beam.scale.set(R, L, R); const u = s.beam.material.uniforms; u.uOp.value = 0.32 * k * s.on; u.uAx.value.copy(d); }
      const low = toGround < 1e8 && toGround <= L + 1; s.pool.visible = low; // where it lands on the ground
      if (low) { s.pool.position.set(s.a.x + d.x * toGround, 0.15, s.a.z + d.z * toGround); s.pool.scale.setScalar(Math.max(4, R * 1.3)); s.pool.material.opacity = 0.65 * k * s.on; }
    }
  }
}
