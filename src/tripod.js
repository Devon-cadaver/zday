// Alien tripods: the ground units of an invasion. A domed metal head forty
// metres up on three long legs that bend and ripple like octopus arms. It
// strides across the city on them (a foot that lands on a car, a person or a
// small building crushes it), sweeps lines of fire with a heat ray from its
// eye, and hauls people up a tractor beam into its head, where they are ground
// up and spat out again as bones and blood across the streets. Soldiers,
// police and airstrikes can bring one down: the legs go limp and the head
// crashes into the street. The player can drive one in Be The Disaster.
import * as THREE from 'three';
import { beamMesh } from './aliens.js';
import { Splash, NOISE } from './water.js';
import { ST, KIND } from './people.js';
import { Body } from './flesh.js';
import { sfx } from './audio.js';

const HEAD_Y = 40, MAX_Y = 80, HIP_R = 4, STANCE = 17, SEG = 18, TENT = 6;
const STURDY = 26;
const k0 = (b) => b.x0 * 7 + b.z0; // a key for a building (for remembering which way round it we are going) // a foot crushes anything lower than this; taller roofs take its weight

// the tallest roof within R of (x, z)
export function roofTop(city, x, z, R) { let top = 0, k = -1; city.buildingsNear(x, z, R, (kb, d, b) => { if (b.top > top) { top = b.top; k = kb; } }); return { top, k }; }

const GLASS_VS = /* glsl */`
varying vec3 vN, vW;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`;
const GLASS_FS = /* glsl */`
uniform float uLight; uniform vec3 uSun;
varying vec3 vN, vW;
void main() {
  vec3 V = normalize(cameraPosition - vW), N = normalize(vN); if (!gl_FrontFacing) N = -N;
  float f = pow(1.0 - abs(dot(N, V)), 3.0), spec = pow(max(dot(reflect(-V, N), uSun), 0.0), 70.0);
  vec3 col = mix(vec3(0.5, 0.72, 0.68), vec3(0.95, 1.0, 0.98), f) * uLight + vec3(1.2) * spec;
  gl_FragColor = vec4(col, clamp(0.1 + 0.6 * f + spec, 0.0, 0.92));
}`;
const MEAT_VS = /* glsl */`
uniform float uTime, uChurn;
varying vec3 vP, vN, vW;
void main() {
  vec3 c = position - vec3(0.0, 3.7, 0.0), n = normalize(c);
  float lump = sin(n.x * 5.0 + uTime * uChurn * 1.7) * sin(n.y * 6.0 - uTime * uChurn) * sin(n.z * 5.0 + uTime * uChurn * 1.3); // it heaves and writhes
  vec3 p = vec3(0.0, 3.7, 0.0) + c * (1.0 + 0.16 * lump);
  vP = p; vW = (modelMatrix * vec4(p, 1.0)).xyz; vN = normalize(mat3(modelMatrix) * n); gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const MEAT_FS = /* glsl */`
uniform float uTime, uChurn, uLight;
varying vec3 vP, vN, vW;
${NOISE}
void main() {
  vec2 q = vec2(atan(vP.z, vP.x) * 2.0 + uTime * uChurn, vP.y * 1.6 - uTime * uChurn * 0.6);
  float n = fbm(q * 1.3), v = fbm(q * 3.1 + 4.0);
  vec3 col = mix(vec3(0.24, 0.03, 0.03), vec3(0.62, 0.14, 0.12), n);
  col = mix(col, vec3(0.16, 0.02, 0.03), smoothstep(0.47, 0.5, v) * (1.0 - smoothstep(0.5, 0.53, v)) * 0.9); // veins
  vec3 N = normalize(vN), L = normalize(vec3(0.3, 0.9, 0.2));
  float l = 0.4 + 0.6 * max(dot(N, L), 0.0), wet = pow(max(dot(reflect(-L, N), normalize(cameraPosition - vW)), 0.0), 24.0); // a wet sheen
  gl_FragColor = vec4(col * l * uLight + vec3(0.9, 0.6, 0.55) * wet * 0.5 * uLight, 1.0);
}`;
let shared = null;
function parts() {
  if (shared) return shared;
  const prof = [[0, 3.4], [2.6, 3.1], [5, 2.1], [6.8, 0.8], [7.4, 0], [7, -0.8], [5.2, -1.7], [2.4, -2.3], [0, -2.5]].map(p => new THREE.Vector2(p[0], p[1]));
  shared = {
    head: new THREE.LatheGeometry(prof, 40),
    band: new THREE.TorusGeometry(7.3, 0.35, 6, 48).rotateX(Math.PI / 2),
    collar: new THREE.TorusGeometry(5.3, 0.32, 6, 40).rotateX(Math.PI / 2).translate(0, 2.0, 0),
    dome: new THREE.SphereGeometry(5.3, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 2.0, 0),
    meat: new THREE.SphereGeometry(2.5, 22, 14).translate(0, 3.7, 0),
    chunk: new THREE.BoxGeometry(0.5, 0.18, 0.18),
    boneMat: new THREE.MeshStandardMaterial({ color: '#e8e0cc', roughness: 0.7 }),
    arm: new THREE.CylinderGeometry(0.45, 0.6, 3.6, 8).rotateZ(Math.PI / 2).translate(8.4, -0.6, 0),
    eye: new THREE.SphereGeometry(1.15, 14, 10).translate(10.4, -0.6, 0),
    vent: new THREE.CylinderGeometry(0.9, 1.3, 1.6, 10).translate(-5.6, -2.0, 0),
    seg: new THREE.CylinderGeometry(1, 1, 1, 8, 1),
    ray: new THREE.CylinderGeometry(0.55, 0.55, 1, 8, 1, true).translate(0, 0.5, 0),
    hull: new THREE.MeshStandardMaterial({ color: '#6b6258', metalness: 0.35, roughness: 0.45 }),
    dark: new THREE.MeshStandardMaterial({ color: '#3a342e', metalness: 0.3, roughness: 0.55 }),
    skin: new THREE.MeshStandardMaterial({ color: '#5a5048', metalness: 0.25, roughness: 0.5 }),
    eyeMat: new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 1.6, 0.5), fog: false }),
    rayMat: new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 2.6, 0.9), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
  };
  return shared;
}

// a tripod standing still, for the roster: the head, its glass dome over the grinder, three bowed legs and the little tentacles
export function tripodModel() {
  const P = parts(), g = new THREE.Group(), head = new THREE.Group(), hy = 26; head.position.y = hy; g.add(head);
  for (const [geo, mat] of [[P.head, P.hull], [P.band, P.dark], [P.collar, P.dark], [P.arm, P.dark], [P.vent, P.dark], [P.eye, P.eyeMat]]) { const m = new THREE.Mesh(geo, mat); m.castShadow = true; head.add(m); }
  head.add(new THREE.Mesh(P.meat, new THREE.MeshStandardMaterial({ color: '#6a2620', roughness: 0.4 })));
  head.add(new THREE.Mesh(P.dome, new THREE.MeshStandardMaterial({ color: '#a8e0d4', transparent: true, opacity: 0.35, roughness: 0.1, depthWrite: false })));
  for (let i = 0; i < 3; i++) {
    const a = i * 2.094, ox = Math.cos(a), oz = Math.sin(a), hip = new THREE.Vector3(ox * HIP_R, hy - 1.5, oz * HIP_R), foot = new THREE.Vector3(ox * 14, 0.3, oz * 14);
    const curve = new THREE.CubicBezierCurve3(hip, hip.clone().add(new THREE.Vector3(ox * 6, 6, oz * 6)), foot.clone().add(new THREE.Vector3(ox * 4, (hip.y - foot.y) * 0.45, oz * 4)), foot);
    const leg = new THREE.Mesh(new THREE.TubeGeometry(curve, 30, 0.8, 8), P.skin); leg.castShadow = true; g.add(leg);
  }
  for (let i = 0; i < TENT; i++) {
    const a = i / TENT * 6.28, ox = Math.cos(a), oz = Math.sin(a);
    const c = new THREE.CatmullRomCurve3([new THREE.Vector3(ox * 2.2, hy - 2.2, oz * 2.2), new THREE.Vector3(ox * 3.2, hy - 5, oz * 3.2), new THREE.Vector3(ox * 3, hy - 8.5, oz * 3.6)]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(c, 10, 0.25, 5), P.skin));
  }
  return g;
}

const bez = (a, b, c, d, t, out) => { const u = 1 - t; for (let k = 0; k < 3; k++) out[k] = u * u * u * a[k] + 3 * u * u * t * b[k] + 3 * u * t * t * c[k] + t * t * t * d[k]; return out; };

export class Tripod {
  constructor(D, x, z, o = {}) {
    this.D = D; this.x = x; this.z = z; this.y = o.fromY ?? HEAD_Y; this.yaw = Math.random() * 6.28; this.t = 0;
    this.vx = 0; this.vz = 0; this.tx = x; this.tz = z; this.player = !!o.player;
    this.state = this.y > HEAD_Y + 2 ? 'drop' : 'walk'; this.hp = o.hp ?? 140; this.hitT = 0; this.alive = true;
    this.rayT = 2 + Math.random() * 2; this.ray = null; this.beamT = 4 + Math.random() * 3; this.tb = null; this.lift = []; this.gut = 0; this.spitT = 0; this.eaten = 0;
    const P = parts(), scene = D.ctx.scene;
    this.obj = new THREE.Group();
    const add = (g, m) => { const me = new THREE.Mesh(g, m); me.castShadow = true; this.obj.add(me); return me; };
    add(P.head, P.hull); add(P.band, P.dark); add(P.collar, P.dark); add(P.arm, P.dark); add(P.vent, P.dark); add(P.eye, P.eyeMat);
    // under a glass dome on top: the grinder, a churning mass of meat, with bones tumbling round it while it feeds
    this.meatMat = new THREE.ShaderMaterial({ vertexShader: MEAT_VS, fragmentShader: MEAT_FS, uniforms: { uTime: { value: 0 }, uChurn: { value: 0.3 }, uLight: { value: 1 } } });
    this.meat = add(P.meat, this.meatMat);
    this.chunks = new THREE.InstancedMesh(P.chunk, P.boneMat, 12); this.chunks.count = 0; this.obj.add(this.chunks);
    this.glassMat = new THREE.ShaderMaterial({ vertexShader: GLASS_VS, fragmentShader: GLASS_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uLight: { value: 1 }, uSun: { value: new THREE.Vector3(0, 1, 0) } } });
    this.glass = new THREE.Mesh(P.dome, this.glassMat); this.glass.renderOrder = 6; this.obj.add(this.glass);
    scene.add(this.obj);
    // legs and the little tentacles under the head: one instanced mesh of tapered segments
    this.segs = new THREE.InstancedMesh(P.seg, P.skin, 3 * SEG + TENT * 6); this.segs.castShadow = true; this.segs.frustumCulled = false; scene.add(this.segs);
    this.legs = [0, 1, 2].map(i => { const a = i * 2.094; return { a, fx: x + Math.cos(a + this.yaw) * STANCE, fz: z + Math.sin(a + this.yaw) * STANCE, step: null }; }); // a: the hip angle around the body
    this.beam = beamMesh(); this.beam.material.uniforms.uColor.value.setRGB(1.2, 1.6, 0.6); scene.add(this.beam);
    this.rayMesh = new THREE.Mesh(P.ray, P.rayMat); this.rayMesh.visible = false; this.rayMesh.renderOrder = 8; scene.add(this.rayMesh);
    this.gore = new Splash(scene, 600); this.gore.mat.uniforms.uColor.value.setRGB(0.32, 0.03, 0.02); this.gore.mat.blending = THREE.NormalBlending;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._v = new THREE.Vector3(); this._up = new THREE.Vector3(0, 1, 0); this._a = [0, 0, 0]; this._p = new THREE.Vector3(); this._s = new THREE.Vector3(); this._e = new THREE.Euler();
  }
  get ground() { return [this.x, this.z]; }
  steer(x, z) { this.tx = x; this.tz = z; }

  update(h) {
    const D = this.D;
    this.t += h;
    if (this.state === 'wreck' || this.state === 'held' || this.state === 'hurled') return; // held, hurled: a hero has it (herofight.js)
    if (this.state === 'fall') { this.fallStep(h); return; }
    if (this.state === 'rise') { this.y += h * (8 + (this.y - HEAD_Y) * 0.4); for (const L of this.legs) { L.fx += (this.x - L.fx) * h * 0.8; L.fz += (this.z - L.fz) * h * 0.8; L.fy = Math.max(0, this.y - HEAD_Y - 10); } if (this.y > 280) this.gone = true; return; } // winched back up into the mothership
    if (this.state === 'drop') { // lowered out of the mothership, legs dangling, then they plant
      this.y += (this.standY() + 1 - this.y) * Math.min(1, h * 0.6);
      for (const L of this.legs) { L.fx += (this.x + Math.cos(L.a + this.yaw) * STANCE - L.fx) * h * 2; L.fz += (this.z + Math.sin(L.a + this.yaw) * STANCE - L.fz) * h * 2; }
      if (this.y < this.standY() + 1.5) { this.state = 'walk'; for (const L of this.legs) this.land(L); D.shake(0.6); }
      return;
    }
    // walk towards the target, steering round towers too tall to stand over
    const dx = this.tx - this.x, dz = this.tz - this.z, d = Math.hypot(dx, dz);
    const sp = d > 4 && !this.tb ? Math.min(5.2, d * 0.5) : 0;
    let ux = d > 0.1 ? dx / d : 0, uz = d > 0.1 ? dz / d : 0;
    const city = D.ctx.city, tall = MAX_Y - 8;
    if (sp > 0) city.buildingsNear(this.x, this.z, 24, (kb, e, b) => {
      if (b.top < tall) return;
      const cx = Math.max(b.x0, Math.min(b.x1, this.x)), cz = Math.max(b.z0, Math.min(b.z1, this.z)), al = Math.hypot(this.x - cx, this.z - cz) || 1, nx = (this.x - cx) / al, nz = (this.z - cz) / al;
      const into = ux * nx + uz * nz; if (into >= 0) return; // not heading into it
      const w = Math.min(1, (24 - e) / 12); ux -= nx * into * w; uz -= nz * into * w; // what is left runs along the wall
      if (this.side == null || this.sideK !== k0(b)) { const tx = -nz, tz = nx; this.side = (tx * (this.tx - cx) + tz * (this.tz - cz)) >= 0 ? 1 : -1; this.sideK = k0(b); } // pick the shorter way round once
      ux += -nz * this.side * w * 0.9; uz += nx * this.side * w * 0.9;
    });
    const ul = Math.hypot(ux, uz) || 1; ux /= ul; uz /= ul;
    this.vx += (ux * sp - this.vx) * Math.min(1, h * 1.5); this.vz += (uz * sp - this.vz) * Math.min(1, h * 1.5);
    this.x += this.vx * h; this.z += this.vz * h;
    city.buildingsNear(this.x, this.z, 9, (k, e, b) => { // never inside one
      if (b.top < tall) return;
      const cx = Math.max(b.x0, Math.min(b.x1, this.x)), cz = Math.max(b.z0, Math.min(b.z1, this.z)), ax = this.x - cx, az = this.z - cz, al = Math.hypot(ax, az);
      if (al < 0.01) { this.x = (this.x - b.x0 < b.x1 - this.x ? b.x0 - 9 : b.x1 + 9); return; }
      this.x = cx + ax / al * 9; this.z = cz + az / al * 9;
    });
    if (sp > 0.5) { let dy = Math.atan2(dz, dx) - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); this.yaw += dy * Math.min(1, h * 0.8); }
    this.ty = this.ty ?? HEAD_Y; this.ty += (this.standY() - this.ty) * Math.min(1, h * 0.9); // rises on its legs to clear the roofs below it
    this.y = this.ty + Math.sin(this.t * 2.6) * 0.5;
    this.stepLegs(h);
    if (!this.player) this.think(h);
    this.rayStep(h); this.beamStep(h); this.gutStep(h);
    this.hits(h);
  }

  // the highest roof a foot can reach from where the head is
  get reachY() { return this.y - 12; }
  // how high the head rides here: high enough to clear every roof under it
  standY() { return Math.min(MAX_Y, Math.max(HEAD_Y, roofTop(this.D.ctx.city, this.x, this.z, 11).top + 8)); }
  // what a foot stands on at (x, z): the ground, or the roof of a building too strong to crush
  footing(x, z) { let gy = 0, bk = -1; this.D.ctx.city.buildingsNear(x, z, 0.4, (k, d, b) => { if (d === 0 && b.top - b.baseY >= STURDY && b.top > gy && b.top <= this.reachY) { gy = b.top; bk = k; } }); return { gy, bk }; }
  // a foot never comes down inside a tower it cannot stand on: it lands just outside the wall
  footSpot(x, z) {
    this.D.ctx.city.buildingsNear(x, z, 0.4, (k, d, b) => {
      if (d !== 0 || b.top <= this.reachY) return;
      const e = [x - b.x0, b.x1 - x, z - b.z0, b.z1 - z], m = Math.min(...e);
      if (m === e[0]) x = b.x0 - 1.5; else if (m === e[1]) x = b.x1 + 1.5; else if (m === e[2]) z = b.z0 - 1.5; else z = b.z1 + 1.5;
    });
    return [x, z];
  }

  // a tripod gait: one leg at a time steps to where it should be, given the way the body is moving
  stepLegs(h) {
    let busy = this.legs.some(L => L.step);
    for (const L of this.legs) {
      const ix = this.x + Math.cos(L.a + this.yaw) * STANCE + this.vx * 1.2, iz = this.z + Math.sin(L.a + this.yaw) * STANCE + this.vz * 1.2;
      if (L.step) {
        const s = L.step; s.t += h / 0.7;
        const k = Math.min(1, s.t), e = k * k * (3 - 2 * k);
        L.fx = s.x0 + (s.x1 - s.x0) * e; L.fz = s.z0 + (s.z1 - s.z0) * e; L.fy = Math.sin(k * Math.PI) * 7;
        const top = Math.max(s.g0, s.g1) + 2, lift = (a, b, u) => a + (b - a) * u * u * (3 - 2 * u); // up over the higher of the two, then down
        L.gy = k < 0.5 ? lift(s.g0, top, k * 2) : lift(top, s.g1, (k - 0.5) * 2);
        if (k >= 1) { L.step = null; L.fy = 0; this.land(L); }
      } else if (!busy && Math.hypot(L.fx - ix, L.fz - iz) > 8) {
        const [x1, z1] = this.footSpot(ix + this.vx * 0.5, iz + this.vz * 0.5), f = this.footing(x1, z1);
        L.step = { x0: L.fx, z0: L.fz, x1, z1, t: 0, g0: L.gy || 0, g1: f.gy }; busy = true;
      } else if (L.bk >= 0 && this.D.ctx.city.dead[L.bk]) { L.gy = Math.max(0, (L.gy || 0) - h * 30); if (!L.gy) L.bk = -1; } // its roof gave way
    }
  }
  // a foot comes down: whatever is under it is crushed
  land(L) {
    const D = this.D, { people, traffic, city, fire } = D.ctx, x = L.fx, z = L.fz, f = this.footing(x, z);
    L.gy = f.gy; L.bk = f.bk;
    if (f.gy > 0) { fire.burst(x, f.gy + 0.5, z, 10, 1.6); const c = D.ctx.controls.target; if (Math.hypot(c.x - x, c.z - z) < 250) D.shake(0.2); return; } // planted on a roof
    people.crushNear(x, z, 2.6);
    traffic.near(x, z, 4, (car) => { if (!car.gone && car.mode !== 4 && car.mode !== 5 && Math.hypot(car.x - x, car.z - z) < 3.5) { traffic.fling(car, (Math.random() - 0.5) * 3, 1, (Math.random() - 0.5) * 3); car.ignite = Math.random() < 0.3; } });
    for (const pc of traffic.parkedNear(x, z, 3)) traffic.burnParked(pc);
    city.buildingsNear(x, z, 0.5, (k, d, b) => { if (d === 0 && b.top - b.baseY < 26) D.destroyBuilding(k, 'collapse', { dir: Math.random() * 6.28 }); });
    fire.dustCloud(x, z, 3, 4);
    const c = D.ctx.controls.target; if (Math.hypot(c.x - x, c.z - z) < 250) D.shake(0.25);
  }

  // the machine's own choices: wander to crowds, burn what is near, beam people up
  think(h) {
    if ((this.goT = (this.goT ?? 0) - h) <= 0 || Math.hypot(this.tx - this.x, this.tz - this.z) < 6) {
      this.goT = 14 + Math.random() * 10;
      const { people, city } = this.D.ctx, B = city.bounds;
      let best = -1, bx = this.x, bz = this.z;
      for (let n = 0; n < 8; n++) {
        const i = Math.floor(Math.random() * people.active), s = people.st[i];
        if (s === ST.DEAD || s === ST.EVAC || s === ST.INSIDE) continue;
        let c = 0; people.around(people.x[i], people.z[i], 14, () => { c++; });
        if (c > best) { best = c; bx = people.x[i]; bz = people.z[i]; }
      }
      this.tx = Math.max(B.x0 + 30, Math.min(B.x1 - 30, bx)); this.tz = Math.max(B.z0 + 30, Math.min(B.z1 - 30, bz));
    }
    if (!this.ray && (this.rayT -= h) <= 0) { this.rayT = 3 + Math.random() * 3; this.fireAt(); }
    if ((this.hornT = (this.hornT ?? 6 + Math.random() * 10) - h) <= 0) { this.hornT = 22 + Math.random() * 18; sfx('horn', this.x, this.y, this.z); }
    if (!this.tb && (this.beamT -= h) <= 0) { this.beamT = 7 + Math.random() * 5; const p = this.crowd(30); if (p) this.beamAt(p[0], p[1]); }
  }
  crowd(R) {
    const { people } = this.D.ctx; let best = 0, at = null;
    for (let n = 0; n < 10; n++) {
      const a = Math.random() * 6.28, r = 6 + Math.random() * R, px = this.x + Math.cos(a) * r, pz = this.z + Math.sin(a) * r;
      let c = 0; people.around(px, pz, 7, (j) => { if (people.hittable(j) && people.kind[j] !== KIND.ALIEN) c++; });
      if (c > best) { best = c; at = [px, pz]; }
    }
    return best >= 2 ? at : null;
  }

  // the heat ray: a sweep of fire along a line on the ground (or up a building)
  fireAt(tx, tz) {
    const { city, traffic } = this.D.ctx;
    let x0, z0, y0 = 0.5;
    if (tx != null) { x0 = tx; z0 = tz; }
    else {
      const r = Math.random();
      if (r < 0.5) { const ks = []; city.buildingsNear(this.x, this.z, 60, (k) => { if (!city.dead[k]) ks.push(k); }); if (!ks.length) return; const b = city.buildings[ks[Math.floor(Math.random() * ks.length)]]; x0 = Math.max(b.x0, Math.min(b.x1, this.x)); z0 = Math.max(b.z0, Math.min(b.z1, this.z)); y0 = b.baseY + (b.top - b.baseY) * (0.3 + Math.random() * 0.6); }
      else { let c = null; traffic.near(this.x, this.z, 55, (car) => { if (!c && !car.gone && car.mode === 0) c = car; }); const p = c ? [c.x, c.z] : this.crowd(45); if (!p) return; x0 = p[0]; z0 = p[1]; }
    }
    const a = Math.random() * 6.28, L = 14 + Math.random() * 14;
    this.ray = { x0: x0 - Math.cos(a) * L / 2, z0: z0 - Math.sin(a) * L / 2, x1: x0 + Math.cos(a) * L / 2, z1: z0 + Math.sin(a) * L / 2, y0, t: 0, dur: 1.8, hitT: 0 };
    sfx('laser', this.x, this.y, this.z, { rate: 0.7, reach: 1.6 });
  }
  rayStep(h) {
    const R = this.ray; if (!R) return;
    R.t += h; const k = Math.min(1, R.t / R.dur), x = R.x0 + (R.x1 - R.x0) * k, z = R.z0 + (R.z1 - R.z0) * k;
    R.ex = x; R.ez = z; R.ey = R.y0 > 1 ? R.y0 - k * (R.y0 - 1) * 0.6 : 0.4;
    const { people, traffic, city, fire } = this.D.ctx;
    if ((R.hitT -= h) <= 0) {
      R.hitT = 0.1;
      fire.burst(x, R.ey, z, 6, 1.8);
      people.around(x, z, 3.2, (j) => { if (people.hittable(j) && people.kind[j] !== KIND.ALIEN) { people.wz[j] = people.st[j] === ST.ZOMBIE ? 1 : 0; people.kill(j, 0, 0, 'burn'); } });
      traffic.near(x, z, 4, (car) => { if (!car.gone && Math.hypot(car.x - x, car.z - z) < 4) traffic.burn(car); });
      city.buildingsNear(x, z, 3, (kb, d, b) => { city.char(kb, 0.7); if (Math.random() < 0.25) fire.igniteBuilding(kb); if (b.top - b.baseY < 12 && Math.random() < 0.04) this.D.destroyBuilding(kb, 'collapse'); });
      if (Math.random() < 0.3) this.D.decals.add('scour', x, z, 4, 4);
    }
    if (k >= 1) this.ray = null;
  }

  // the tractor beam: everyone under it is hauled up into the head
  beamAt(x, z) { this.tb = { x, z, t: 0, dur: 8, n: 0 }; }
  beamStep(h) {
    const T = this.tb, { people } = this.D.ctx;
    if (T) {
      T.t += h;
      if ((T.n -= h) <= 0) { T.n = 0.25; let got = 0; people.around(T.x, T.z, 7, (j) => { if (got < 3 && this.lift.length < 24 && people.lvl[j] === -1 && people.kind[j] !== KIND.ALIEN && people.grab(j)) { this.lift.push(j); got++; } }); }
      if (T.t > T.dur) this.tb = null;
    }
    const hx = this.x, hy = this.y - 2.5, hz = this.z;
    for (let k = this.lift.length - 1; k >= 0; k--) {
      const j = this.lift[k];
      if (people.st[j] !== ST.EXT) { this.lift.splice(k, 1); continue; }
      if (!this.tb) { people.fling(j, (Math.random() - 0.5) * 3, 0, (Math.random() - 0.5) * 3); this.lift.splice(k, 1); continue; } // dropped when the beam cuts out
      const up = Math.min(1, (people.y[j] - 0.5) / (hy - 0.5)); // drawn in towards the beam's top as they rise
      people.x[j] += (hx - people.x[j]) * Math.min(1, h * (0.4 + up * 2)); people.z[j] += (hz - people.z[j]) * Math.min(1, h * (0.4 + up * 2)); people.y[j] += 10 * h;
      if (Math.hypot(people.x[j] - hx, people.y[j] - hy, people.z[j] - hz) < 3) { // into the head
        people.st[j] = ST.EVAC; people.lvl[j] = -1; people.stats.disasterCiv += people.kind[j] === 0 ? 1 : 0; people.stats.abducted++;
        this.gut++; this.eaten++; this.lift.splice(k, 1);
      }
    }
  }
  // what goes in comes out of the vent at the back: bones and blood sprayed over the street
  gutStep(h) {
    if (this.gut <= 0 || (this.spitT -= h) > 0) return;
    this.spitT = 0.9; this.gut--;
    const D = this.D, { people } = D.ctx, a = this.yaw + Math.PI + (Math.random() - 0.5) * 0.8, c = Math.cos(a), s = Math.sin(a);
    const vx = this.x + Math.cos(this.yaw) * -5.6, vz = this.z + Math.sin(this.yaw) * -5.6, vy = this.y - 3;
    this.gore.emit(vx, vy, vz, 26, { up: [-2, 3], dir: [c * 9, s * 9], spread: 4, life: 2.2, size: 1.4 });
    for (let n = 0; n < 4; n++) { const sz = 0.18 + Math.random() * 0.35; D.debris.add(vx, vy, vz, sz * (Math.random() < 0.5 ? 2.2 : 1), sz * 0.45, sz * 0.45, Math.random() < 0.75 ? 0xe8e0cc : 0xd2c8b0, 'fly', { v: [c * (5 + Math.random() * 7) + (Math.random() - 0.5) * 3, 1 + Math.random() * 3, s * (5 + Math.random() * 7) + (Math.random() - 0.5) * 3] }); }
    for (let n = 0; n < 5; n++) { const d = 8 + Math.random() * 14, px = this.x + c * d + (Math.random() - 0.5) * 6, pz = this.z + s * d + (Math.random() - 0.5) * 6; people.addBlood(px, pz, 0.8 + Math.random() * 1.6); }
  }

  // soldiers and police shoot back
  hits(h) {
    if (this.player || (this.hitT -= h) > 0) return;
    this.hitT = 0.5;
    const { people, fire } = this.D.ctx; let dmg = 0, shooter = -1;
    people.around(this.x, this.z, 55, (j) => {
      const k = people.kind[j]; if ((k !== KIND.OFFICER && k !== KIND.SOLDIER) || people.st[j] !== ST.COP) return;
      dmg += k === KIND.SOLDIER ? 0.6 : 0.25; shooter = j; people.hx[j] = this.x - people.x[j]; people.hz[j] = this.z - people.z[j];
      if (people.flashList.length < people.flashMax && Math.random() < 0.6) people.flashList.push({ x: people.x[j], y: people.y[j] + 1.3, z: people.z[j], t: 0.08 });
    });
    if (!dmg) return;
    this.damage(dmg * 0.5);
    if (Math.random() < 0.5) fire.burst(this.x + (Math.random() - 0.5) * 10, this.y + (Math.random() - 0.5) * 3, this.z + (Math.random() - 0.5) * 10, 3, 0.8);
    if (shooter >= 0 && !this.ray && Math.random() < 0.15) { this.fireAt(people.x[shooter], people.z[shooter]); }
  }
  recall() { if (this.state === 'walk' || this.state === 'drop') { this.state = 'rise'; this.ray = null; this.tb = null; const { people } = this.D.ctx; for (const j of this.lift) if (people.st[j] === ST.EXT) people.fling(j, 0, 0, 0); this.lift.length = 0; } }
  damage(n) { if (this.state === 'fall' || this.state === 'wreck' || this.state === 'held' || this.state === 'hurled') return; this.hp -= n; if (this.hp <= 0) this.down(); }
  down() {
    if (this.state === 'fall' || this.state === 'wreck') return;
    this.state = 'fall'; this.ft = 0; this.ray = null; this.tb = null; this.fallA = Math.random() * 6.28;
    const { people } = this.D.ctx; for (const j of this.lift) if (people.st[j] === ST.EXT) people.fling(j, 0, 0, 0); this.lift.length = 0;
    this.D.emit({ type: 'tripoddown', x: this.x, z: this.z, text: 'A tripod is down!' });
  }
  // legs buckle, the head drops and hits the street
  fallStep(h) {
    const D = this.D, { fire, people } = D.ctx;
    this.ft += h;
    const k = Math.min(1, this.ft / 2.4), ty = 3.2;
    this.y = HEAD_Y + (ty - HEAD_Y) * k * k; this.x += Math.cos(this.fallA) * h * 6 * k; this.z += Math.sin(this.fallA) * h * 6 * k;
    for (const L of this.legs) L.fy = 0;
    if (Math.random() < 0.6) fire.burst(this.x, this.y, this.z, 4, 2);
    if (k >= 1) {
      this.state = 'wreck';
      fire.burst(this.x, 2, this.z, 40, 4); fire.carFire(this.x, this.z); fire.dustCloud(this.x, this.z, 12, 14); people.crushNear(this.x, this.z, 9); D.shake(1.2);
      D.ctx.city.buildingsNear(this.x, this.z, 8, (kb) => D.destroyBuilding(kb, 'collapse'));
    }
  }

  // close to the camera, the legs and tentacles are smooth tubes swept through the same joints (flesh.js); further off
  // the chain of cylinders, which costs less and looks the same from there
  smoothLegs(n) {
    const cam = this.D.ctx.camera, near = cam.position.distanceToSquared(this.obj.position) < 400 * 400 && n === 3 * SEG + TENT * 6;
    if (near && !this.smooth) {
      const body = new Body(parts().skin);
      for (let i = 0; i < 3; i++) body.add({ rings: 46, cols: 10, len: 60, radii: Array.from({ length: SEG + 1 }, (_, k) => 1.15 - (k / SEG) * 0.75), capStart: true, capEnd: true, pt: true, lumps: 0.02 });
      for (let i = 0; i < TENT; i++) body.add({ rings: 12, cols: 6, len: 8, radii: Array.from({ length: 7 }, (_, k) => k === 6 ? 0 : 0.42 - (k / 6) * 0.3), capStart: true, capEnd: true, pt: true, lumps: 0 });
      const mesh = body.build([0, 0, 0], 1); mesh.frustumCulled = false; this.D.ctx.scene.add(mesh);
      this.smooth = { body, mesh };
    }
    if (!this.smooth) return;
    this.smooth.mesh.visible = near; this.segs.visible = !near;
    if (!near) return;
    const pts = this._pts, B = this.smooth.body;
    for (let i = 0; i < 3 + TENT; i++) {
      const T = B.tubes[i], m = i < 3 ? SEG : 6, base = i < 3 ? i * SEG : 3 * SEG + (i - 3) * 6;
      for (let k = 0; k <= m; k++) { const e = pts[base + Math.min(m - 1, k)], o = k < m ? 0 : 3; T.P[k].set(e[o], e[o + 1], e[o + 2]); }
      T.update(0);
    }
    B.commit();
  }
  sync(dt, realT) {
    if (this.gone) { this.obj.visible = this.segs.visible = this.beam.visible = this.rayMesh.visible = false; if (this.smooth) this.smooth.mesh.visible = false; return; }
    const P = this.obj, wreck = this.state === 'wreck' || this.state === 'fall';
    P.position.set(this.x, this.y, this.z);
    P.rotation.set(wreck ? Math.min(0.5, (this.ft || 0) * 0.25) : Math.sin(this.t * 1.3) * 0.04, -this.yaw, wreck ? Math.min(0.35, (this.ft || 0) * 0.15) : Math.cos(this.t * 1.1) * 0.03);
    if (this.rot) { P.rotation.x = this.rot[0]; P.rotation.z = this.rot[1]; } // swung round or tumbling through the air
    // legs: a cubic curve from the hip, bowing out and up, down to the foot, rippling along its length
    const m = this._m, q = this._q, v = this._v, A = this._a;
    let n = 0;
    const pts = this._pts || (this._pts = []); let np = 0; // every joint, for the smooth legs
    const put = (p0, p1, r) => {
      if (!pts[np]) pts[np] = [0, 0, 0, 0, 0, 0]; const e = pts[np++]; e[0] = p0[0]; e[1] = p0[1]; e[2] = p0[2]; e[3] = p1[0]; e[4] = p1[1]; e[5] = p1[2];
      v.set(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]); const len = v.length() || 0.01; v.multiplyScalar(1 / len);
      q.setFromUnitVectors(this._up, v);
      m.compose(this._p.set((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2), q, this._s.set(r, len * 1.18, r));
      this.segs.setMatrixAt(n++, m);
    };
    for (let i = 0; i < 3; i++) {
      const L = this.legs[i], a = L.a + this.yaw, ox = Math.cos(a), oz = Math.sin(a);
      const hip = [this.x + ox * HIP_R, this.y - 1.5, this.z + oz * HIP_R], foot = [L.fx, (L.gy || 0) + (L.fy || 0) + 0.3, L.fz];
      const reach = Math.hypot(foot[0] - hip[0], foot[2] - hip[2]), slack = wreck ? 0.2 : 1;
      const c1 = [hip[0] + ox * reach * 0.55, hip[1] + 6 * slack, hip[2] + oz * reach * 0.55], c2 = [foot[0] + ox * 4, foot[1] + (hip[1] - foot[1]) * 0.45 * slack, foot[2] + oz * 4];
      let prev = hip.slice();
      for (let k = 1; k <= SEG; k++) {
        const s = k / SEG, p = bez(hip, c1, c2, foot, s, A);
        const w = Math.sin(s * Math.PI) * (wreck ? 0.3 : 1.4) * Math.sin(s * 9 - this.t * 3 + i * 2), px = -oz * w, pz = ox * w;
        const cur = [p[0] + px, p[1], p[2] + pz];
        put(prev, cur, 1.15 - s * 0.75); prev = cur;
      }
    }
    // small tentacles hanging under the head, idly waving
    for (let i = 0; i < TENT; i++) {
      const a = i / TENT * 6.28 + 0.3, ox = Math.cos(a - this.yaw), oz = Math.sin(a - this.yaw);
      let prev = [this.x + ox * 2.2, this.y - 2.2, this.z + oz * 2.2];
      for (let k = 1; k <= 6; k++) {
        const s = k / 6, sw = Math.sin(this.t * 2.2 + i * 1.7 + s * 3) * 1.6 * s;
        const cur = [this.x + ox * (2.2 + s * 1.5) + Math.cos(a + 1.6) * sw, this.y - 2.2 - s * 7, this.z + oz * (2.2 + s * 1.5) + Math.sin(a + 1.6) * sw];
        put(prev, cur, 0.42 - s * 0.3); prev = cur;
      }
    }
    this.segs.count = n; this.segs.instanceMatrix.needsUpdate = true;
    this.smoothLegs(n);
    // the heat ray from the eye
    const R = this.ray;
    if (R && R.ex != null) {
      const ex = this.x + Math.cos(this.yaw) * 10.4, ez = this.z + Math.sin(this.yaw) * 10.4, ey = this.y - 0.6;
      v.set(R.ex - ex, R.ey - ey, R.ez - ez); const len = v.length(); v.normalize();
      this.rayMesh.position.set(ex, ey, ez); this.rayMesh.quaternion.setFromUnitVectors(this._up, v); this.rayMesh.scale.set(1 + Math.sin(realT * 40) * 0.25, len, 1 + Math.sin(realT * 40) * 0.25);
      this.rayMesh.visible = true;
    } else this.rayMesh.visible = false;
    // the tractor beam: a cone from under the head to the ground
    const T = this.tb;
    if (T) {
      const top = new THREE.Vector3(this.x, this.y - 2.5, this.z); v.set(T.x - top.x, 0.2 - top.y, T.z - top.z); const len = v.length(); v.normalize();
      this.beam.position.copy(top); this.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), v); this.beam.scale.set(1, len, 1);
      this.beam.material.uniforms.uTime.value = realT; this.beam.material.uniforms.uOn.value = Math.min(1, T.t * 2, (T.dur - T.t) * 2); this.beam.visible = true;
    } else this.beam.visible = false;
    this.gore.update(dt); this.gore.sync(this.D.lightK, this.D.ctx.fire.uniforms.uScale.value);
    const sun = this.D.ctx.sun, mu = this.meatMat.uniforms, churn = 0.3 + Math.min(4, this.gut) * 0.7;
    this.glassMat.uniforms.uLight.value = this.D.lightK; this.glassMat.uniforms.uSun.value.copy(sun.position).sub(sun.target.position).normalize();
    mu.uTime.value = realT; mu.uChurn.value += (churn - mu.uChurn.value) * Math.min(1, dt * 2); mu.uLight.value = this.D.lightK;
    this.meat.rotation.y += dt * mu.uChurn.value * 0.6; this.meat.scale.setScalar(1 + Math.sin(realT * (2 + churn * 2)) * 0.03 * churn);
    const nc = Math.min(12, this.gut * 3 + (this.lift.length ? 2 : 0)); this.chunks.count = nc;
    for (let i = 0; i < nc; i++) { const a = realT * (1.5 + churn) + i * 0.52, r = 2.9 + Math.sin(i * 1.7 + realT * 3) * 0.6; this._p.set(Math.cos(a) * r, 3.4 + Math.sin(a * 1.3 + i) * 1.2, Math.sin(a) * r); this._q.setFromEuler(this._e.set(a * 2 + i, a + i * 0.7, a * 1.4)); m.compose(this._p, this._q, this._s.set(1, 1, 1)); this.chunks.setMatrixAt(i, m); }
    this.chunks.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    const { scene, people } = this.D.ctx;
    for (const j of this.lift) if (people.st[j] === ST.EXT) people.fling(j, 0, 0, 0);
    scene.remove(this.obj, this.segs, this.beam, this.rayMesh, this.gore.points); if (this.smooth) { scene.remove(this.smooth.mesh); this.smooth.body.geo.dispose(); }
    this.segs.dispose(); this.beam.material.dispose(); this.glassMat.dispose(); this.meatMat.dispose(); this.chunks.dispose(); this.gore.points.geometry.dispose(); this.gore.mat.dispose();
  }
}
