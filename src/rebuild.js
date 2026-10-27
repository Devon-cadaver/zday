// Putting the city back together after a disaster (Commander mode).
// Construction crews clear the rubble of a fallen building and raise it again
// floor by floor inside scaffolding and green netting, with a tower crane
// swinging overhead; when the last floor is done the netting comes down on the
// building as it was. Medical camps (white tents with red crosses) take in people
// from the streets round them, treat anyone bitten not long ago, and keep them
// there, safe, until the rebuilding nearby is finished. Hazmat teams clear the
// radiation a nuke or a meltdown leaves behind (nothing can be rebuilt inside it),
// clean up people who took a dose before they turn, and foam down burning wrecks.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { AMBER, RED, WHITE } from './sirens.js';

// ---------- shared pieces
const paint = (g, hex) => { const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
const box = (w, h, d, x, y, z, hex) => paint(new THREE.BoxGeometry(w, h, d).translate(x, y, z), hex);
const merge = (parts) => mergeGeometries(parts.map(p => p.index ? p.toNonIndexed() : p));
let K = null;
function kit() {
  if (K) return K;
  const c = document.createElement('canvas'); c.width = 128; c.height = 64; const x = c.getContext('2d');
  x.fillStyle = '#35594a'; x.fillRect(0, 0, 128, 64);
  x.strokeStyle = 'rgba(120,170,140,0.35)'; x.lineWidth = 1;
  for (let i = -64; i < 128; i += 6) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 64, 64); x.stroke(); x.beginPath(); x.moveTo(i + 64, 0); x.lineTo(i, 64); x.stroke(); }
  x.fillStyle = '#b8b4aa'; x.fillRect(0, 0, 128, 3); x.fillRect(0, 61, 128, 3); x.fillRect(0, 0, 3, 64); x.fillRect(64, 0, 3, 64); // the scaffold poles show through
  const net = new THREE.CanvasTexture(c); net.wrapS = THREE.RepeatWrapping; net.colorSpace = THREE.SRGBColorSpace;
  const tent = (body, roof, cross) => {
    const p = [box(3.2, 1.7, 3.2, 0, 0.85, 0, body), paint(new THREE.CylinderGeometry(1.75, 2.4, 0.5, 4, 1).rotateY(Math.PI / 4).translate(0, 1.95, 0), roof)];
    if (cross) p.push(box(1.6, 0.06, 0.45, 0, 2.22, 0, '#c8201a'), box(0.45, 0.06, 1.6, 0, 2.22, 0, '#c8201a'), box(0.06, 0.7, 0.7, 1.62, 1.1, 0, '#c8201a'), box(0.06, 0.25, 0.7, 1.62, 1.1, 0, '#f4f4f0'));
    return merge(p);
  };
  K = {
    net: new THREE.MeshStandardMaterial({ map: net, roughness: 0.9, side: THREE.DoubleSide }),
    deck: new THREE.MeshStandardMaterial({ color: '#aaa69e', roughness: 0.95 }),
    yellow: new THREE.MeshStandardMaterial({ color: '#e8b020', roughness: 0.55, metalness: 0.2 }),
    grey: new THREE.MeshStandardMaterial({ color: '#77736c', roughness: 0.8 }),
    cable: new THREE.MeshBasicMaterial({ color: '#1c1c1c' }),
    vc: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }),
    medTent: tent('#f4f4f0', '#ecebe6', true),
    decon: tent('#f2b000', '#e09a00', false),
    load: box(3.0, 0.6, 1.0, 0, -0.3, 0, '#b07a40'),
    unit: new THREE.BoxGeometry(1, 1, 1),
    line: new THREE.CylinderGeometry(0.06, 0.06, 1, 4).translate(0, -0.5, 0),
  };
  return K;
}
// four walls of netting one floor high, centred on the origin, bottom at 0; the texture repeats every 4 m
function floorRing(w, d, h) {
  const pos = [], uv = [], nrm = [], idx = [];
  const side = (ax, az, bx, bz, nx, nz) => { const L = Math.hypot(bx - ax, bz - az), o = pos.length / 3; pos.push(ax, 0, az, bx, 0, bz, bx, h, bz, ax, h, az); uv.push(0, 0, L / 4, 0, L / 4, 1, 0, 1); for (let k = 0; k < 4; k++) nrm.push(nx, 0, nz); idx.push(o, o + 1, o + 2, o, o + 2, o + 3); };
  const x0 = -w / 2, x1 = w / 2, z0 = -d / 2, z1 = d / 2;
  side(x0, z1, x1, z1, 0, 1); side(x1, z1, x1, z0, 1, 0); side(x1, z0, x0, z0, 0, -1); side(x0, z0, x0, z1, -1, 0);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g.setIndex(idx);
  return g;
}
const RING_VS = /* glsl */`varying vec2 vP; void main() { vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
// a dashed ring on the ground: yellow and black hazard stripes (cordons), or a pale green glow (radiation)
const RING_FS = /* glsl */`
uniform vec3 uA, uB; uniform float uTime, uOp, uFill, uR; varying vec2 vP;
void main() {
  float r = length(vP); if (r > 1.0) discard;
  float edge = smoothstep(1.0 - 1.4 / uR, 1.0 - 0.6 / uR, r) * (1.0 - smoothstep(1.0 - 0.2 / uR, 1.0, r));
  float a = atan(vP.y, vP.x), stripe = step(0.5, fract(a * uR / 3.0 + uTime * 0.4));
  vec3 col = mix(uA, uB, stripe);
  float al = edge + uFill * (1.0 - r * 0.6);
  gl_FragColor = vec4(mix(uA, col, edge), al * uOp);
}`;
function ring(scene, R, a, b, fill) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(1, 72).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({ vertexShader: RING_VS, fragmentShader: RING_FS, transparent: true, depthWrite: false,
    uniforms: { uA: { value: new THREE.Color(...a) }, uB: { value: new THREE.Color(...b) }, uTime: { value: 0 }, uOp: { value: 0 }, uFill: { value: fill }, uR: { value: R } } }));
  m.scale.set(R, 1, R); m.renderOrder = 3; scene.add(m); return m;
}
const dropMesh = (scene, m) => { scene.remove(m); if (m.material && m.material.isShaderMaterial) m.material.dispose(); };

// ---------- radiation left by nukes and meltdowns: nothing is rebuilt inside it until a hazmat team clears it
export class Zones {
  constructor(D) { this.D = D; this.list = []; }
  add(x, z, R) {
    const o = this.list.find(q => Math.hypot(q.x - x, q.z - z) < Math.max(q.R, R) * 0.5);
    if (o) { o.R = Math.max(o.R, R); o.m.scale.set(o.R, 1, o.R); o.m.material.uniforms.uR.value = o.R; return o; }
    const q = { x, z, R, m: ring(this.D.ctx.scene, R, [0.75, 0.95, 0.25], [0.12, 0.12, 0.1], 0.07) };
    q.m.position.set(x, 0.34, z); this.list.push(q); return q;
  }
  at(x, z) { return this.list.find(q => Math.hypot(q.x - x, q.z - z) < q.R) || null; }
  // a clean-up of radius R at (x, z): zones inside it go, bigger ones shrink back from it
  clean(x, z, R) {
    let n = 0;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const q = this.list[i], d = Math.hypot(q.x - x, q.z - z); if (d > q.R + R) continue;
      n++; q.R = Math.min(q.R - R * 0.75, Math.max(d + q.R - 2 * R, q.R * 0.55));
      if (q.R < 30 || d + q.R < R * 1.1) { dropMesh(this.D.ctx.scene, q.m); this.list.splice(i, 1); continue; }
      q.m.scale.set(q.R, 1, q.R); q.m.material.uniforms.uR.value = q.R;
    }
    return n;
  }
  sync(t) { for (const q of this.list) { const u = q.m.material.uniforms; u.uTime.value = t; u.uOp.value = 0.55; } }
  reset() { for (const q of this.list) dropMesh(this.D.ctx.scene, q.m); this.list.length = 0; }
}

// ---------- a construction site: clear the rubble, raise the building inside netting, take the netting down
export class Site {
  constructor(D, k, o = {}) {
    const { city, scene } = D.ctx, b = city.buildings[k];
    this.D = D; this.k = k; this.b = b; this.t = 0; this.phase = 'clear'; this.alive = true; this.onDone = o.onDone; this.car = o.car || null;
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, w = b.x1 - b.x0, d = b.z1 - b.z0, hgt = Math.max(4, b.top - b.baseY);
    this.cx = cx; this.cz = cz; this.hgt = hgt; this.n = Math.max(1, Math.min(40, Math.round(hgt / 3.4))); this.clearT = 6; this.buildT = 16 + this.n * 1.6;
    const K = kit(), fh = hgt / this.n;
    this.g = new THREE.Group(); this.g.position.set(cx, b.baseY, cz); scene.add(this.g);
    const ringGeo = floorRing(w + 0.6, d + 0.6, fh); this.geos = [ringGeo];
    this.floors = [];
    for (let i = 0; i < this.n; i++) { const m = new THREE.Mesh(ringGeo, K.net); m.position.y = i * fh; m.visible = false; m.castShadow = true; this.g.add(m); this.floors.push(m); }
    this.deck = new THREE.Mesh(K.unit, K.deck); this.deck.scale.set(w - 0.2, 0.35, d - 0.2); this.deck.position.y = 0.2; this.deck.receiveShadow = true; this.g.add(this.deck);
    this.fh = fh;
    // the tower crane at one corner: mast, slewing jib, counterweight, trolley and hook
    const H = Math.max(22, hgt + 10), mx = -w / 2 + 1.6, mz = -d / 2 + 1.6;
    this.crane = new THREE.Group(); this.crane.position.set(mx, 0, mz); this.g.add(this.crane);
    const part = (geo, mat, sx, sy, sz, x, y, z, parent) => { const m = new THREE.Mesh(geo, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
    part(K.unit, K.yellow, 1.3, H, 1.3, 0, H / 2, 0, this.crane);
    this.slew = new THREE.Group(); this.slew.position.y = H; this.slew.rotation.y = Math.random() * 6.28; this.crane.add(this.slew);
    const L = Math.min(26, Math.max(14, Math.hypot(w, d) * 0.9));
    part(K.unit, K.yellow, L, 0.9, 0.9, L / 2, 0.45, 0, this.slew); part(K.unit, K.yellow, 8, 0.8, 0.8, -4, 0.4, 0, this.slew);
    part(K.unit, K.grey, 2.2, 1.6, 1.5, -7.2, 0.2, 0, this.slew); part(K.unit, K.yellow, 1.5, 1.5, 1.5, 1.2, -0.9, 1.1, this.slew); part(K.unit, K.yellow, 0.4, 4.2, 0.4, 0, 2.5, 0, this.slew);
    this.trolley = part(K.unit, K.grey, 0.9, 0.4, 1.0, L * 0.6, -0.2, 0, this.slew);
    this.cable = new THREE.Mesh(K.line, K.cable); this.trolley.add(this.cable);
    this.hook = new THREE.Mesh(K.load, K.vc); this.hook.castShadow = true; this.trolley.add(this.hook);
    this.L = L; this.H = H; this.aimA = this.slew.rotation.y; this.aimR = L * 0.6;
    // flashing amber at the corners of the site, a red light on top of the crane
    const sir = D.sirens, hw = w / 2 + 1.2, hd = d / 2 + 1.2;
    this.beacons = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([ox, oz], i) => ({ x: cx + ox, y: b.baseY + 1.3, z: cz + oz, c: AMBER, rate: 1.4, phase: i * 0.25, kind: 'flash', pool: 7 }));
    this.beacons.push({ x: cx + mx, y: b.baseY + H + 4.8, z: cz + mz, c: RED, rate: 0.8, phase: 0, kind: 'blink' });
    if (sir) sir.beacons.push(...this.beacons);
    D.ctx.fire.dustCloud(cx, cz, Math.max(w, d) * 0.5, 6);
  }
  get progress() { return this.phase === 'clear' ? 0 : this.phase === 'build' ? Math.min(1, this.t / this.buildT) : 1; }
  update(h) {
    if (!this.alive) return;
    const D = this.D, { city, fire } = D.ctx;
    this.t += h;
    if (this.phase === 'clear') {
      if (Math.random() < h * 0.8) fire.dustCloud(this.cx + (Math.random() - 0.5) * 6, this.cz + (Math.random() - 0.5) * 6, 3, 4);
      if (this.t >= this.clearT) { city.clearRubble(this.k); this.phase = 'build'; this.t = 0; }
    } else if (this.phase === 'build') {
      const k = Math.min(1, this.t / this.buildT), up = Math.min(this.n, Math.ceil(k * this.n + 0.001));
      for (let i = 0; i < this.n; i++) this.floors[i].visible = i < up;
      this.deck.position.y = up * this.fh + 0.18;
      if (k >= 1) this.finish();
    }
    // the crane swings loads round to the top of the work
    const sl = this.slew; let da = this.aimA - sl.rotation.y; da = Math.atan2(Math.sin(da), Math.cos(da));
    sl.rotation.y += Math.sign(da) * Math.min(Math.abs(da), h * 0.35);
    const tr = this.trolley; tr.position.x += Math.sign(this.aimR - tr.position.x) * Math.min(Math.abs(this.aimR - tr.position.x), h * 2.5);
    if (Math.abs(da) < 0.02 && Math.abs(this.aimR - tr.position.x) < 0.1) { this.aimA = Math.random() * 6.28; this.aimR = this.L * (0.3 + Math.random() * 0.6); }
    const drop = Math.max(3, this.H - (this.deck.position.y + 3 + Math.sin(this.t * 0.6) * 2));
    this.cable.scale.set(1, drop, 1); this.hook.position.y = -drop;
  }
  // the last floor is up: the netting comes down on the building as it was
  finish() {
    const D = this.D, { city, fire, people } = D.ctx, k = this.k;
    city.restoreBuilding(k);
    if (fire.bFire) { fire.bFire[k] = 0; if (fire.soaked) fire.soaked[k] = 0; }
    if (people.bld && people.bld[k]) { people.bIn[k] = 0; people.bPile[k] = 0; }
    this.phase = 'done'; this.dispose();
    if (this.onDone) this.onDone(this);
  }
  dispose() {
    if (!this.alive) return;
    this.alive = false;
    const D = this.D; D.ctx.scene.remove(this.g); for (const g of this.geos) g.dispose();
    if (D.sirens) D.sirens.beacons = D.sirens.beacons.filter(bc => !this.beacons.includes(bc));
  }
}

// ---------- a medical camp: tents round a central aid station; people come in from the streets around and stay
let CAMP_ID = 2000;
export class Camp {
  constructor(D, x, z, o = {}) {
    const { scene } = D.ctx, K = kit();
    this.D = D; this.x = x; this.z = z; this.id = CAMP_ID++; this.t = 0; this.alive = true; this.callT = 0; this.cap = o.cap ?? 60; this.R = 7; this.minT = o.minT ?? 60; this.peak = 0;
    this.g = new THREE.Group(); this.g.position.set(x, D.ctx.people.groundY(x, z), z); scene.add(this.g);
    for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28 + 0.4, m = new THREE.Mesh(K.medTent, K.vc); m.position.set(Math.cos(a) * 6.5, 0, Math.sin(a) * 6.5); m.rotation.y = -a; m.castShadow = true; m.receiveShadow = true; this.g.add(m); }
    const c = new THREE.Mesh(K.medTent, K.vc); c.scale.set(1.3, 1.2, 1.3); c.castShadow = true; this.g.add(c);
    this.beacons = [{ x, y: this.g.position.y + 3.9, z, c: RED, rate: 0.9, kind: 'blink', pool: 9 }];
    if (D.sirens) D.sirens.beacons.push(...this.beacons);
  }
  get held() { return this.D.ctx.people.heldBy(this.id); }
  update(h) {
    if (!this.alive) return;
    this.t += h;
    if ((this.callT -= h) <= 0) {
      this.callT = 3;
      const p = this.D.ctx.people, now = p.heldBy(this.id), room = this.cap - now;
      if (room > 0) p.callToCamp(this.x, this.z, 70, room, this.id, this.R);
      this.peak = Math.max(this.peak, now);
    }
  }
  // close up and send everyone home
  close() {
    if (!this.alive) return 0;
    const n = this.D.ctx.people.releaseHeld(this.id);
    this.dispose(); return n;
  }
  dispose() {
    if (!this.alive) return;
    this.alive = false; this.D.ctx.scene.remove(this.g);
    if (this.D.sirens) this.D.sirens.beacons = this.D.sirens.beacons.filter(bc => !this.beacons.includes(bc));
  }
}

// ---------- a hazmat clean-up: a cordon and a decontamination tent; when the work is done the area inside is clean
export class Hazmat {
  constructor(D, x, z, o = {}) {
    const { scene } = D.ctx, K = kit();
    this.D = D; this.x = x; this.z = z; this.R = o.R ?? 70; this.t = 0; this.dur = o.dur ?? 20; this.alive = true; this.onDone = o.onDone; this.cleaned = 0;
    this.tent = new THREE.Mesh(K.decon, K.vc); this.tent.position.set(x + 4, D.ctx.people.groundY(x, z), z + 3); this.tent.castShadow = true; scene.add(this.tent);
    this.cordon = ring(scene, this.R, [0.95, 0.75, 0.1], [0.08, 0.08, 0.08], 0.0); this.cordon.position.set(x, 0.36, z);
    this.beacons = [0, 1, 2, 3].map(i => { const a = i * Math.PI / 2 + 0.6; return { x: x + Math.cos(a) * this.R, y: 1.4, z: z + Math.sin(a) * this.R, c: AMBER, rate: 1.2, phase: i * 0.3, kind: 'flash', pool: 8 }; });
    if (D.sirens) D.sirens.beacons.push(...this.beacons);
  }
  update(h) {
    if (!this.alive) return;
    const D = this.D, { people, fire } = D.ctx;
    this.t += h;
    const u = this.cordon.material.uniforms; u.uTime.value = this.t; u.uOp.value = Math.min(1, this.t * 2) * (this.t > this.dur ? Math.max(0, 1 - (this.t - this.dur) / 2) : 0.85);
    if ((this.tick = (this.tick || 0) - h) <= 0) { // the crews work through the area: anyone with a dose is scrubbed down
      this.tick = 1;
      const k = Math.min(1, this.t / this.dur), R = this.R * (0.35 + 0.65 * k);
      people.around(this.x, this.z, R, (j) => { if (people.zrad[j] && people.kind[j] === 0 && people.inf[j]) { people.inf[j] = 0; people.zrad[j] = 0; people.dirty[j] = 0; people.setLook(j, people.base[j]); people.stats.treated++; this.cleaned++; } });
      fire.quench((fx, fz) => (Math.hypot(fx - this.x, fz - this.z) < R ? 9 : -9)); // foam on anything burning
    }
    if (this.t >= this.dur && !this.done) { this.done = true; this.zones = D.zones ? D.zones.clean(this.x, this.z, this.R) : 0; if (this.onDone) this.onDone(this); }
    if (this.t >= this.dur + 2.2) this.dispose();
  }
  dispose() {
    if (!this.alive) return;
    this.alive = false; const sc = this.D.ctx.scene; sc.remove(this.tent); dropMesh(sc, this.cordon);
    if (this.D.sirens) this.D.sirens.beacons = this.D.sirens.beacons.filter(bc => !this.beacons.includes(bc));
  }
}
