// Searchlights at night: white beams that point out the trouble. Helicopters
// shine down on the disaster nearest them (or sweep the street below), rescue
// vehicles on a scene aim theirs at it, and lamps on the tallest roofs near each
// disaster track it. Each beam is a light shaft: a flat strip along the beam that
// turns about its own length to face the camera, soft across its width and fading
// out along it (a cone showed its outline and its open end as hard rings from some
// angles), with a pool of light where it lands - no real lights, so the city's own
// shading costs nothing more.
// They fade in after dusk and out at dawn.
import * as THREE from 'three';

const MAX = 18, COL = new THREE.Color(1.0, 0.94, 0.78);
// the shaft: x across it (-0.5..0.5), y along it (0 at the lamp, 1 at the far end); laid out in the world facing the camera
const VS = /* glsl */`uniform vec3 uA, uD; uniform float uL, uR0, uR; varying vec2 vUv; varying float vEnd, vNear;
void main() {
  float y = position.y; vec3 P = uA + uD * (y * uL);
  vec3 V = cameraPosition - P; float dv = length(V); V /= max(dv, 0.001);
  vec3 S = cross(uD, V); float sl = length(S); S = sl > 0.001 ? S / sl : vec3(1.0, 0.0, 0.0);
  float R = mix(uR0, uR, y);
  vec3 w = P + S * position.x * 2.0 * R;
  vUv = vec2(position.x * 2.0, y);
  vEnd = abs(dot(uD, V)); // 1 looking straight down its length
  vNear = smoothstep(R * 1.2, R * 4.0, dv); // the camera right in it: gone
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}`;
const FS = /* glsl */`uniform float uOp; uniform vec3 uCol; varying vec2 vUv; varying float vEnd, vNear;
void main() {
  float across = exp(-vUv.x * vUv.x * 4.5); // soft at its edges, brightest down the middle
  float along = pow(1.0 - vUv.y, 1.4) * smoothstep(0.0, 0.04, vUv.y);
  float side = 1.0 - smoothstep(0.7, 0.96, vEnd); // seen down its length it would be a blob: it fades out
  gl_FragColor = vec4(uCol * uOp * across * along * side * vNear, 1.0);
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
    const shaft = new THREE.PlaneGeometry(1, 1, 1, 12).translate(0, 0.5, 0); // laid out by the vertex shader (12 steps along it, to bend with the world's curve)
    const quad = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), tex = poolTexture();
    this.slots = [];
    for (let i = 0; i < MAX; i++) {
      const beam = new THREE.Mesh(shaft, new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: { uOp: { value: 0 }, uCol: { value: COL }, uA: { value: new THREE.Vector3() }, uD: { value: new THREE.Vector3(0, 1, 0) }, uL: { value: 1 }, uR0: { value: 0.35 }, uR: { value: 3 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
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
      if (s.beam.visible) { const u = s.beam.material.uniforms; u.uA.value.copy(s.a); u.uD.value.copy(d); u.uL.value = L; u.uR.value = R; u.uOp.value = 0.42 * k * s.on; }
      const low = toGround < 1e8 && toGround <= L + 1; s.pool.visible = low; // where it lands on the ground
      if (low) { s.pool.position.set(s.a.x + d.x * toGround, 0.15, s.a.z + d.z * toGround); s.pool.scale.setScalar(Math.max(4, R * 1.3)); s.pool.material.opacity = 0.65 * k * s.on; }
    }
  }
}
