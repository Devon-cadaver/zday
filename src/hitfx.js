// What a blow looks like where it lands (Sean, 2026-11-05: the sparks look like cubes; more realistic sparks, and the best lighting there
// can be). Five to choose from, shown on the options page (hits.html), made to drop into the fights after:
//   cubes   today's: little flying boxes and a flat star
//   streaks hot sparks: thin streaks that stretch with their speed, white hot cooling to orange and red, falling and skipping off the ground
//   lit     the streaks, a hot core and a real light flashing out of the blow onto both fighters and the street
//   energy  a superhero hit: a flare with a sideways lens streak, a ring of light, streaks in the hero's colour, and the light
//   impact  a person being hit, no sparks: a white flash, a shock ring and dust off their clothes
// The game draws in HDR and blooms what is brighter than white (post.js), so the colours here go well over 1.
import * as THREE from 'three';

let TEX = null;
function canvasTex(s, draw) { const c = document.createElement('canvas'); c.width = c.height = s; draw(c.getContext('2d'), s); return new THREE.CanvasTexture(c); }
function tex() {
  if (TEX) return TEX;
  TEX = {
    glow: canvasTex(128, (x, s) => { const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.15, 'rgba(255,255,255,0.75)'); g.addColorStop(0.4, 'rgba(255,255,255,0.2)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, s, s); }),
    // across a streak: bright in the middle, nothing at its edges (along it the colour does the fading)
    streak: canvasTex(32, (x, s) => { const g = x.createLinearGradient(0, 0, 0, s); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.3, 'rgba(255,255,255,0.08)'); g.addColorStop(0.5, 'rgba(255,255,255,1)'); g.addColorStop(0.7, 'rgba(255,255,255,0.08)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, s, s); }),
    // a camera's lens streak: long and thin, sideways
    flare: canvasTex(256, (x, s) => { x.translate(s / 2, s / 2); x.scale(1, 0.06); const g = x.createRadialGradient(0, 0, 0, 0, 0, s / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.4)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.beginPath(); x.arc(0, 0, s / 2, 0, 7); x.fill(); }),
    ring: canvasTex(128, (x, s) => { const g = x.createRadialGradient(s / 2, s / 2, s * 0.3, s / 2, s / 2, s / 2); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.7, 'rgba(255,255,255,0.9)'); g.addColorStop(0.85, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, s, s); }),
    puff: canvasTex(128, (x, s) => { for (let i = 0; i < 14; i++) { const a = Math.random() * 6.28, r = Math.random() * s * 0.18, cx = s / 2 + Math.cos(a) * r, cy = s / 2 + Math.sin(a) * r, R = s * (0.16 + Math.random() * 0.16), g = x.createRadialGradient(cx, cy, 0, cx, cy, R); g.addColorStop(0, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, s, s); } }),
    star: canvasTex(64, (x) => { x.fillStyle = '#fff'; x.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? 7 : 31; x.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } x.closePath(); x.fill(); }),
  };
  return TEX;
}

export const HIT_FX = {
  cubes: { name: 'Today', note: 'Little flying boxes and a flat star' },
  streaks: { name: 'Hot sparks', note: 'Thin streaks, white hot cooling to orange, falling and skipping off the street' },
  lit: { name: 'Sparks and light', note: 'The hot sparks, a glowing core, and a real flash of light on both fighters and the street' },
  energy: { name: 'Energy hit', note: 'A superhero blow: a flare with a lens streak, a ring of light, sparks in the hero\'s colour, and the light' },
  impact: { name: 'Impact, no sparks', note: 'A person being hit: a white flash, a shock ring and dust off their clothes' },
};

// a fighter's colour (Sean, 2026-11-05: the hit's colour from the power of whoever throws it): the knockback's if it has one of its own,
// else the stun's; the physical ones (a kick, a car, a boulder...) have none. The villains behind the disasters by what they throw (foepower.js)
export const POWER_COL = { freeze: '#7fe0ff', sonic: '#cfe4ff', guardian: '#6cff9a', gravity: '#9a5cff', web: '#4aa8ff', flash: '#ffd66a', sleep: '#c39bff', mud: '#c98a4a', vine: '#5cff6a', dizzy: '#ffe24a', whistle: '#bfefff', foam: '#e8f0ff', bubble: '#8fe8ff', staticz: '#7ab8ff', icefloor: '#a8eaff', stone: '#c8b494', gas: '#9cff5a', fear: '#ff4a4a', shadow: '#7a3cff', hypno: '#ff5ad5', magnet: '#ff6a5a', slow: '#5affd2', mirror: '#d8f0ff', timestop: '#ffd23d',
  laser: '#ff3a6a', gust: '#a8f0ff', stomp: '#ffb060', firejet: '#ff7a20', water: '#2a9dff', air: '#d8f6ff', palm: '#ffd27a', iceram: '#7fe0ff', bolt: '#8ac8ff', cone: '#5ae0ff', whirl: '#b8fff0', clap: '#fff2a0', tidal: '#1f8aff', meteor: '#ff6a1a', boom: '#c8e8ff', solar: '#ffcf3a', hole: '#8a3cff' };
export const FOE_COL = { tornado: '#b8e0f0', water: '#2a9dff', dust: '#e8a850', ice: '#9fe8ff', tremor: '#ff7a2a', roar: '#ff3ad0' };
export function tintOf(kit, o = {}) { if (o.robot) return '#ff3a2a'; if (o.foePow && FOE_COL[o.foePow]) return FOE_COL[o.foePow]; return (kit && (POWER_COL[kit.knock] || POWER_COL[kit.stun])) || (o.villain ? '#ff4a3a' : '#ff5ad5'); }
// the game's one: made the first time a blow lands, on the town's scene, with the town's light if it has one (main.js)
export function hitFxOf(g, camera) { const S = g.disasters.ctx.scene; if (g.hitFx && g.hitFx.scene === S) return g.hitFx; if (g.hitFx) g.hitFx.dispose(); const L = S.userData.hitLight, F = g.hitFx = new HitFx(S, camera, { lights: L ? [L] : [], viewH: innerHeight }); F.handed = true; F.spill = !L; return F; }

// white hot, yellow, orange, deep red, out: a spark cooling (u 0 to 1), as HDR colour
function hot(u, o) { const k = 1 - u; if (u < 0.25) { const t = u / 0.25; o.setRGB(5 - 1.6 * t, 4.2 - 1.9 * t, 2.8 - 2 * t); } else if (u < 0.6) { const t = (u - 0.25) / 0.35; o.setRGB(3.4 - 1.4 * t, 2.3 - 1.7 * t, 0.8 - 0.7 * t); } else { const t = (u - 0.6) / 0.4; o.setRGB((2 - 1.6 * t) * k * 2.5, 0.6 * (1 - t) * k * 2.5, 0.1 * (1 - t) * k); } return o; }
const _c = new THREE.Color(), _d = new THREE.Vector3(), _v = new THREE.Vector3(), _s = new THREE.Vector3();

export class HitFx {
  // scene, the camera (streaks face it), the ground's height (sparks skip off it)
  constructor(scene, camera, o = {}) {
    this.scene = scene; this.camera = camera; this.floor = o.floor ?? 0; this.viewH = o.viewH || innerHeight; const T = tex();
    // the streaks: one mesh, four corners a spark, rebuilt each frame
    const N = this.N = 260, pos = new Float32Array(N * 12), col = new Float32Array(N * 12), uv = new Float32Array(N * 8), idx = new Uint16Array(N * 6);
    for (let i = 0; i < N; i++) { uv.set([0, 0, 0, 1, 1, 0, 1, 1], i * 8); idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 2, i * 4 + 1, i * 4 + 3], i * 6); }
    const g = this.geo = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(new THREE.BufferAttribute(idx, 1));
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: T.streak, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, fog: false })); this.mesh.frustumCulled = false; this.mesh.renderOrder = 6; scene.add(this.mesh);
    this.sp = []; // { p, v, t, T, w, tint }
    this.sprites = []; // flashes, rings, puffs, stars, flares
    this.cubes = [];
    // the lights, always there and dark till a blow: adding a light later would make every material rebuild its shader (a stutter). The game hands in
    // its own (one, made with the town; none on a phone, where a light costs every pixel); the options page makes two
    this.lights = (o.lights || [0, 1].map(() => { const L = new THREE.PointLight('#ffb070', 0, 9, 2); scene.add(L); return L; })).map((L) => ({ L, t: 9, T: 0.15, I: 0 })); this.li = 0;
    this.free = []; this.spills = []; this.n = 0; // sprites to use again; light thrown on the ground; blows this frame
  }
  // a blow at (x, y, z), going the way (nx, nz) (out of the one hit), k its strength 0 to 1, tint the hero's colour (energy)
  hit(kind, x, y, z, nx = 0, nz = 0, k = 0.5, tint = '#ff5ad5') {
    const big = 0.6 + 0.8 * k, many = ++this.n > 3; // a sweep through a crowd: past the third blow in a frame, a small one each
    if (kind === 'cubes') { for (let i = 0; i < 8 + 3 * k; i++) { const s = 0.1 + Math.random() * 0.12, sp = 5 + Math.random() * 12, m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), new THREE.MeshBasicMaterial({ color: [0xffffff, 0xffe27a, 0xffa030][i % 3] })); m.position.set(x, y, z); this.scene.add(m); this.cubes.push({ m, v: new THREE.Vector3(nx * sp + (Math.random() - 0.5) * 10, 1 + Math.random() * 7, nz * sp + (Math.random() - 0.5) * 10), t: 0, T: 0.4 }); } this.sprite('star', x, y, z, 0.3 + big * 0.6, 0.3 + big * 0.6, [2.2, 1.9, 1.3], 0.12, { grow: 0 }); return; }
    if (kind === 'streaks' || kind === 'lit') {
      this.spray(x, y, z, nx, nz, Math.round(14 + 18 * k), 6 + 9 * k, null);
      this.sprite('glow', x, y, z, 0.28 * big, 0.28 * big, [4.5, 3.6, 2.4], 0.07, { grow: 0.5 });
      if (kind === 'lit') { this.sprite('glow', x, y, z, 0.8 * big, 0.8 * big, [1.1, 0.6, 0.25], 0.14, { grow: 0.3 }); this.light(x + nx * 0.35, y + 0.1, z + nz * 0.35, '#ffb066', 22 + 30 * k, 0.16); }
      return;
    }
    if (kind === 'energy') {
      const c = new THREE.Color(tint), hdr = [c.r * 6 + 1.5, c.g * 6 + 1.5, c.b * 6 + 1.5];
      if (many) { this.spray(x, y, z, nx, nz, 5, 6 + 6 * k, c); this.sprite('glow', x, y, z, 0.5 * big, 0.5 * big, [c.r * 2 + 1, c.g * 2 + 1, c.b * 2 + 1], 0.1, { grow: 0.4 }); return; }
      this.spray(x, y, z, nx, nz, Math.round(12 + 16 * k), 7 + 9 * k, c);
      if (this.spill) this.spillAt(x, z, c, 2.4 * big, 0.22); // the light it throws, on the street under it
      this.sprite('glow', x, y, z, 0.35 * big, 0.35 * big, [5, 4.5, 4.5], 0.06, { grow: 0.5 });
      this.sprite('glow', x, y, z, 0.9 * big, 0.9 * big, [c.r * 1.6, c.g * 1.6, c.b * 1.6], 0.18, { grow: 0.4 });
      this.sprite('flare', x, y, z, 1.5 * big, 1.5 * big, hdr.map((v) => v * 0.32), 0.1, { grow: 0.15 });
      this.sprite('ring', x, y, z, 0.2, 0.2, [c.r * 1.8, c.g * 1.8, c.b * 1.8], 0.2, { grow: 6 * big });
      this.light(x + nx * 0.35, y + 0.1, z + nz * 0.35, tint, 30 + 34 * k, 0.2);
      return;
    }
    if (kind === 'impact') {
      this.sprite('glow', x, y, z, 0.32 * big, 0.32 * big, [4, 4, 4], 0.06, { grow: 0.4 });
      this.sprite('ring', x, y, z, 0.2, 0.2, [1.1, 1.1, 1.1], 0.16, { grow: 3.5 * big });
      for (let i = 0; i < 4 + 3 * k; i++) { const a = Math.random() * 6.28; this.sprite('puff', x + Math.cos(a) * 0.1, y + (Math.random() - 0.3) * 0.2, z + Math.sin(a) * 0.1, 0.24, 0.24, [0.85, 0.8, 0.72], 0.5 + Math.random() * 0.3, { grow: 1 + 0.8 * k, normal: true, op: 0.55, v: [nx * (1 + Math.random() * 2) + Math.cos(a) * 0.8, 0.3 + Math.random() * 0.8, nz * (1 + Math.random() * 2) + Math.sin(a) * 0.8] }); }
      for (let i = 0; i < 6 + 6 * k; i++) this.sprite('glow', x, y, z, 0.05, 0.05, [0.9, 0.85, 0.8], 0.4, { normal: true, op: 0.8, g: 6, v: [nx * (2 + Math.random() * 3) + (Math.random() - 0.5) * 3, 0.5 + Math.random() * 2.5, nz * (2 + Math.random() * 3) + (Math.random() - 0.5) * 3] });
    }
  }
  // sparks thrown out of the blow, mostly the way it went, some back at the one who threw it
  spray(x, y, z, nx, nz, n, sp0, tint) { for (let i = 0; i < n && this.sp.length < this.N; i++) { const back = Math.random() < 0.25 ? -0.6 : 1, sp = sp0 * (0.4 + Math.random() * 0.9); this.sp.push({ p: new THREE.Vector3(x, y, z), v: new THREE.Vector3((nx * back + (Math.random() - 0.5) * 1.3) * sp, (Math.random() * 1.1 - 0.15) * sp, (nz * back + (Math.random() - 0.5) * 1.3) * sp), t: 0, T: 0.22 + Math.random() * 0.35, w: 1.1 + Math.random() * 1.1, tint }); } } // w: half its width in screen pixels
  sprite(map, x, y, z, sx, sy, c, T, o = {}) { const m = this.free.pop() || new THREE.Sprite(new THREE.SpriteMaterial({ map: tex().glow, transparent: true, depthWrite: false, toneMapped: false, fog: false })), M = m.material; M.map = tex()[map]; M.color.setRGB(c[0], c[1], c[2]); M.opacity = o.op ?? 1; M.blending = o.normal ? THREE.NormalBlending : THREE.AdditiveBlending; M.depthTest = !!o.normal; M.rotation = map === 'flare' ? 0 : Math.random() * 6.28; m.position.set(x, y, z); m.scale.set(sx, map === 'flare' ? sy : sy, 1); m.renderOrder = 7; this.scene.add(m); this.sprites.push({ m, t: 0, T, sx, sy, o, c0: m.material.color.clone(), op0: o.op ?? 1, v: o.v ? new THREE.Vector3(...o.v) : null }); }
  // a pool of light on the ground, flat, in the blow's colour: what a light would throw there, for next to nothing
  spillAt(x, z, c, R, T) { let q = this.spills.find((s) => s.t >= s.T); if (!q) { if (this.spills.length >= 4) return; const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tex().glow, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false })); m.renderOrder = 5; this.scene.add(m); q = { m, t: 9, T }; this.spills.push(q); } q.m.position.set(x, this.floor + 0.04, z); q.m.scale.set(R, 1, R); q.c = c.clone().multiplyScalar(1.3); q.t = 0; q.T = T; q.m.visible = true; }
  light(x, y, z, col, I, T) { if (!this.lights.length) return; const q = this.lights[this.li = (this.li + 1) % this.lights.length]; q.L.position.set(x, y, z); q.L.color.set(col); q.I = I; q.t = 0; q.T = T; }
  step(dt) {
    // the streaks: falling, slowing, skipping off the ground; drawn from where they are back along their speed
    const P = this.geo.attributes.position.array, C = this.geo.attributes.color.array, cam = this.camera.position; this.n = 0;
    for (let i = this.sp.length - 1; i >= 0; i--) { const s = this.sp[i]; s.t += dt; if (s.t >= s.T) { this.sp.splice(i, 1); continue; } s.v.y -= 14 * dt; s.v.multiplyScalar(Math.exp(-2.2 * dt)); s.p.addScaledVector(s.v, dt); if (s.p.y < this.floor && s.v.y < 0) { s.p.y = this.floor; s.v.y *= -0.35; s.v.x *= 0.6; s.v.z *= 0.6; } }
    for (let i = 0; i < this.N; i++) {
      const s = this.sp[i], o = i * 12; if (!s) { P.fill(0, o, o + 12); C.fill(0, o, o + 12); continue; }
      const u = s.t / s.T; _v.copy(cam).sub(s.p); const wpp = 2 * _v.length() * Math.tan(this.camera.fov * Math.PI / 360) / this.viewH; _d.copy(s.v).multiplyScalar(0.028); if (_d.length() < wpp * 5) _d.setLength(wpp * 5); const a = s.p, bx = a.x - _d.x, by = a.y - _d.y, bz = a.z - _d.z;
      _s.copy(_d).cross(_v).normalize().multiplyScalar(s.w * wpp * (1 + 0.6 * (1 - u))); // across the streak, facing the camera, a few pixels wide however far
      P[o] = a.x + _s.x; P[o + 1] = a.y + _s.y; P[o + 2] = a.z + _s.z; P[o + 3] = a.x - _s.x; P[o + 4] = a.y - _s.y; P[o + 5] = a.z - _s.z;
      P[o + 6] = bx + _s.x; P[o + 7] = by + _s.y; P[o + 8] = bz + _s.z; P[o + 9] = bx - _s.x; P[o + 10] = by - _s.y; P[o + 11] = bz - _s.z;
      if (s.tint) { const k = 1 - u; _c.setRGB((s.tint.r * 4.5 + 1.2 * (1 - u)) * k, (s.tint.g * 4.5 + 1.2 * (1 - u)) * k, (s.tint.b * 4.5 + 1.2 * (1 - u)) * k); } else hot(u, _c);
      C[o] = C[o + 3] = _c.r; C[o + 1] = C[o + 4] = _c.g; C[o + 2] = C[o + 5] = _c.b; C[o + 6] = C[o + 9] = _c.r * 0.15; C[o + 7] = C[o + 10] = _c.g * 0.15; C[o + 8] = C[o + 11] = _c.b * 0.15; // the head hot, the tail fading
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.color.needsUpdate = true;
    for (let i = this.sprites.length - 1; i >= 0; i--) { const q = this.sprites[i]; q.t += dt; const u = q.t / q.T; if (u >= 1) { this.scene.remove(q.m); this.free.push(q.m); this.sprites.splice(i, 1); continue; } const g = 1 + (q.o.grow || 0) * (1 - (1 - u) * (1 - u)); q.m.scale.set(q.sx * g, q.sy * g, 1); if (q.v) { q.v.y -= (q.o.g || 0.6) * dt; q.v.multiplyScalar(Math.exp(-2 * dt)); q.m.position.addScaledVector(q.v, dt); } const f = (1 - u) * (1 - u); if (q.o.normal) q.m.material.opacity = q.op0 * (1 - u); else q.m.material.color.copy(q.c0).multiplyScalar(f); }
    for (let i = this.cubes.length - 1; i >= 0; i--) { const q = this.cubes[i]; q.t += dt; if (q.t >= q.T) { this.scene.remove(q.m); q.m.geometry.dispose(); q.m.material.dispose(); this.cubes.splice(i, 1); continue; } q.v.y -= 20 * dt; q.m.position.addScaledVector(q.v, dt); q.m.rotation.x += dt * 9; q.m.rotation.y += dt * 7; }
    for (const q of this.spills) { q.t += dt; const u = q.t / q.T; if (u >= 1) { q.m.visible = false; continue; } q.m.material.color.copy(q.c).multiplyScalar((1 - u) * Math.min(1, q.t / 0.02)); }
    for (const q of this.lights) { q.t += dt; const u = q.t / q.T; q.L.intensity = u >= 1 ? 0 : q.I * Math.min(1, q.t / 0.012) * (1 - u) * (1 - u); }
  }
  // all of it gone at once (a fight over)
  clear() { this.sp.length = 0; for (const q of this.sprites) { this.scene.remove(q.m); this.free.push(q.m); } this.sprites.length = 0; for (const q of this.cubes) this.scene.remove(q.m); this.cubes.length = 0; for (const q of this.spills) { q.t = 9; q.m.visible = false; } for (const q of this.lights) { q.t = 9; q.L.intensity = 0; } this.step(0); }
  dispose() { this.clear(); this.scene.remove(this.mesh); this.geo.dispose(); for (const q of this.spills) this.scene.remove(q.m); if (!this.handed) for (const q of this.lights) this.scene.remove(q.L); }
}
