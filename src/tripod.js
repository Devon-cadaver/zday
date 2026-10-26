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
import { Splash } from './water.js';
import { ST, KIND } from './people.js';

const HEAD_Y = 40, HIP_R = 4, STANCE = 17, SEG = 18, TENT = 6;
let shared = null;
function parts() {
  if (shared) return shared;
  const prof = [[0, 3.4], [2.6, 3.1], [5, 2.1], [6.8, 0.8], [7.4, 0], [7, -0.8], [5.2, -1.7], [2.4, -2.3], [0, -2.5]].map(p => new THREE.Vector2(p[0], p[1]));
  shared = {
    head: new THREE.LatheGeometry(prof, 40),
    band: new THREE.TorusGeometry(7.3, 0.35, 6, 48).rotateX(Math.PI / 2),
    hood: new THREE.SphereGeometry(2.4, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 2.8, 0),
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
    add(P.head, P.hull); add(P.band, P.dark); add(P.hood, P.dark); add(P.arm, P.dark); add(P.vent, P.dark); add(P.eye, P.eyeMat);
    scene.add(this.obj);
    // legs and the little tentacles under the head: one instanced mesh of tapered segments
    this.segs = new THREE.InstancedMesh(P.seg, P.skin, 3 * SEG + TENT * 6); this.segs.castShadow = true; this.segs.frustumCulled = false; scene.add(this.segs);
    this.legs = [0, 1, 2].map(i => { const a = i * 2.094; return { a, fx: x + Math.cos(a + this.yaw) * STANCE, fz: z + Math.sin(a + this.yaw) * STANCE, step: null }; }); // a: the hip angle around the body
    this.beam = beamMesh(); this.beam.material.uniforms.uColor.value.setRGB(1.2, 1.6, 0.6); scene.add(this.beam);
    this.rayMesh = new THREE.Mesh(P.ray, P.rayMat); this.rayMesh.visible = false; this.rayMesh.renderOrder = 8; scene.add(this.rayMesh);
    this.gore = new Splash(scene, 600); this.gore.mat.uniforms.uColor.value.setRGB(0.32, 0.03, 0.02); this.gore.mat.blending = THREE.NormalBlending;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._v = new THREE.Vector3(); this._up = new THREE.Vector3(0, 1, 0); this._a = [0, 0, 0]; this._p = new THREE.Vector3(); this._s = new THREE.Vector3();
  }
  get ground() { return [this.x, this.z]; }
  steer(x, z) { this.tx = x; this.tz = z; }

  update(h) {
    const D = this.D;
    this.t += h;
    if (this.state === 'wreck') return;
    if (this.state === 'fall') { this.fallStep(h); return; }
    if (this.state === 'rise') { this.y += h * (8 + (this.y - HEAD_Y) * 0.4); for (const L of this.legs) { L.fx += (this.x - L.fx) * h * 0.8; L.fz += (this.z - L.fz) * h * 0.8; L.fy = Math.max(0, this.y - HEAD_Y - 10); } if (this.y > 280) this.gone = true; return; } // winched back up into the mothership
    if (this.state === 'drop') { // lowered out of the mothership, legs dangling, then they plant
      this.y += (HEAD_Y - this.y) * Math.min(1, h * 0.6);
      for (const L of this.legs) { L.fx += (this.x + Math.cos(L.a + this.yaw) * STANCE - L.fx) * h * 2; L.fz += (this.z + Math.sin(L.a + this.yaw) * STANCE - L.fz) * h * 2; }
      if (this.y < HEAD_Y + 1.5) { this.state = 'walk'; for (const L of this.legs) this.land(L); D.shake(0.6); }
      return;
    }
    // walk towards the target
    const dx = this.tx - this.x, dz = this.tz - this.z, d = Math.hypot(dx, dz);
    const sp = d > 4 && !this.tb ? Math.min(5.2, d * 0.5) : 0;
    this.vx += ((d > 0.1 ? dx / d : 0) * sp - this.vx) * Math.min(1, h * 1.5); this.vz += ((d > 0.1 ? dz / d : 0) * sp - this.vz) * Math.min(1, h * 1.5);
    this.x += this.vx * h; this.z += this.vz * h;
    if (sp > 0.5) { let dy = Math.atan2(dz, dx) - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); this.yaw += dy * Math.min(1, h * 0.8); }
    this.y = HEAD_Y + Math.sin(this.t * 2.6) * 0.5;
    this.stepLegs(h);
    if (!this.player) this.think(h);
    this.rayStep(h); this.beamStep(h); this.gutStep(h);
    this.hits(h);
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
        if (k >= 1) { L.step = null; L.fy = 0; this.land(L); }
      } else if (!busy && Math.hypot(L.fx - ix, L.fz - iz) > 8) {
        L.step = { x0: L.fx, z0: L.fz, x1: ix + this.vx * 0.5, z1: iz + this.vz * 0.5, t: 0 }; busy = true;
      }
    }
  }
  // a foot comes down: whatever is under it is crushed
  land(L) {
    const D = this.D, { people, traffic, city, fire } = D.ctx, x = L.fx, z = L.fz;
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
  damage(n) { if (this.state === 'fall' || this.state === 'wreck') return; this.hp -= n; if (this.hp <= 0) this.down(); }
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

  sync(dt, realT) {
    if (this.gone) { this.obj.visible = this.segs.visible = this.beam.visible = this.rayMesh.visible = false; return; }
    const P = this.obj, wreck = this.state === 'wreck' || this.state === 'fall';
    P.position.set(this.x, this.y, this.z);
    P.rotation.set(wreck ? Math.min(0.5, (this.ft || 0) * 0.25) : Math.sin(this.t * 1.3) * 0.04, -this.yaw, wreck ? Math.min(0.35, (this.ft || 0) * 0.15) : Math.cos(this.t * 1.1) * 0.03);
    // legs: a cubic curve from the hip, bowing out and up, down to the foot, rippling along its length
    const m = this._m, q = this._q, v = this._v, A = this._a;
    let n = 0;
    const put = (p0, p1, r) => {
      v.set(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]); const len = v.length() || 0.01; v.multiplyScalar(1 / len);
      q.setFromUnitVectors(this._up, v);
      m.compose(this._p.set((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2), q, this._s.set(r, len * 1.18, r));
      this.segs.setMatrixAt(n++, m);
    };
    for (let i = 0; i < 3; i++) {
      const L = this.legs[i], a = L.a + this.yaw, ox = Math.cos(a), oz = Math.sin(a);
      const hip = [this.x + ox * HIP_R, this.y - 1.5, this.z + oz * HIP_R], foot = [L.fx, (L.fy || 0) + 0.3, L.fz];
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
  }

  dispose() {
    const { scene, people } = this.D.ctx;
    for (const j of this.lift) if (people.st[j] === ST.EXT) people.fling(j, 0, 0, 0);
    scene.remove(this.obj, this.segs, this.beam, this.rayMesh, this.gore.points);
    this.segs.dispose(); this.beam.material.dispose(); this.gore.points.geometry.dispose(); this.gore.mat.dispose();
  }
}
