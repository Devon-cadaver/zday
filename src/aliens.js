// Alien invasion: a mothership parks over the city and lets loose a flight of
// saucers. Each saucer cruises the streets and, wherever it stops, beams people
// and cars up, burns buildings with its laser or drops off a squad of armed
// aliens. Saucers that fly low come in range of police and army guns; an
// airstrike or a nuke brings them down too. The fleet leaves after a few
// minutes, or once every saucer is down.
import * as THREE from 'three';
import { ST, KIND } from './people.js';

const PROFILE = [[0, 1.5], [1.9, 1.35], [3.4, 0.75], [6.6, 0.16], [7, 0], [6.6, -0.14], [4.6, -0.55], [2.4, -0.85], [0, -0.95]];
const BEAM_VS = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const BEAM_FS = /* glsl */`
uniform float uTime, uOn; uniform vec3 uColor;
varying vec2 vUv;
void main() {
  float bands = 0.6 + 0.4 * sin(vUv.y * 40.0 - uTime * 6.0);
  float edge = 0.55 + 0.45 * sin(vUv.x * 6.2832 * 6.0 + uTime * 2.0);
  float a = uOn * bands * edge * (0.12 + 0.2 * vUv.y) * smoothstep(0.0, 0.08, vUv.y);
  gl_FragColor = vec4(uColor, a);
}`;

let shared = null;
function parts() {
  if (shared) return shared;
  const body = new THREE.LatheGeometry(PROFILE.map(p => new THREE.Vector2(p[0], p[1])), 32);
  const dome = new THREE.SphereGeometry(2.1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2); dome.translate(0, 1.2, 0);
  const rim = new THREE.TorusGeometry(6.0, 0.22, 6, 40); rim.rotateX(Math.PI / 2); rim.translate(0, -0.12, 0);
  const core = new THREE.CircleGeometry(2.0, 24); core.rotateX(Math.PI / 2); core.translate(0, -0.97, 0);
  const beam = new THREE.CylinderGeometry(1.4, 7.5, 1, 28, 1, true); beam.translate(0, -0.5, 0);
  const laser = new THREE.CylinderGeometry(0.16, 0.16, 1, 5, 1, true); laser.translate(0, 0.5, 0);
  shared = {
    body, dome, rim, core, beam, laser,
    hull: new THREE.MeshStandardMaterial({ color: '#b9bec6', metalness: 0.45, roughness: 0.32 }),
    hullDark: new THREE.MeshStandardMaterial({ color: '#4d5158', metalness: 0.5, roughness: 0.4 }),
    glass: new THREE.MeshStandardMaterial({ color: '#7fe8c8', emissive: new THREE.Color(0.25, 0.9, 0.6), roughness: 0.15, metalness: 0.2 }),
    lights: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.7, 3.2, 1.3), fog: false }),
    glow: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 3.6, 2.0), fog: false }),
    laserMat: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 6, 2.2), fog: false }),
  };
  return shared;
}

function saucerMesh(dark = false) {
  const P = parts(), g = new THREE.Group();
  const spin = new THREE.Group();
  const body = new THREE.Mesh(P.body, dark ? P.hullDark : P.hull); body.castShadow = true;
  spin.add(body, new THREE.Mesh(P.rim, P.lights));
  g.add(spin, new THREE.Mesh(P.dome, P.glass), new THREE.Mesh(P.core, P.glow));
  g.userData.spin = spin;
  return g;
}

function beamMesh() {
  const mat = new THREE.ShaderMaterial({ vertexShader: BEAM_VS, fragmentShader: BEAM_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uOn: { value: 0 }, uColor: { value: new THREE.Color(0.6, 1.6, 1.0) } } });
  const m = new THREE.Mesh(parts().beam, mat); m.visible = false; m.frustumCulled = false; m.renderOrder = 7;
  return m;
}

export class Invasion {
  constructor(D, opts = {}) {
    this.type = 'aliens'; this.D = D; this.t = 0; this.alive = true; this.leaving = false;
    const { city, scene } = D.ctx, B = city.bounds;
    this.life = opts.life ?? 150;
    const cx = (B.x0 + B.x1) / 2 + (Math.random() - 0.5) * 120, cz = (B.z0 + B.z1) / 2 + (Math.random() - 0.5) * 120;
    this.mx = cx; this.mz = cz; this.my = 700; this.mAlt = 230;
    this.mother = saucerMesh(true); this.mother.scale.setScalar(7.5); this.mother.position.set(cx, this.my, cz);
    scene.add(this.mother);
    this.saucers = []; this.toLaunch = opts.n ?? 5; this.launchT = 9;
    this.lasers = []; this.stats = { down: 0, abducted: 0, aliens: 0 };
    D.emit({ type: 'warn', hazard: 'aliens', x: cx, z: cz, r: 160, exact: true, text: 'UFOs over the city! Alien saucers are abducting people. Send soldiers and police to shoot them down' });
  }
  get x() { return this.mx; } get z() { return this.mz; }

  pickTarget(s) {
    const B = this.D.ctx.city.bounds, { people } = this.D.ctx;
    // head for a crowd: sample a few people, take the busiest spot
    let best = -1, bx = 0, bz = 0;
    for (let n = 0; n < 6; n++) {
      const i = Math.floor(Math.random() * people.active);
      if (people.st[i] === ST.DEAD || people.st[i] === ST.EVAC || people.st[i] === ST.INSIDE) continue;
      let c = 0; people.around(people.x[i], people.z[i], 12, () => { c++; });
      if (c > best) { best = c; bx = people.x[i]; bz = people.z[i]; }
    }
    if (best < 0) { bx = B.x0 + 60 + Math.random() * (B.x1 - B.x0 - 120); bz = B.z0 + 60 + Math.random() * (B.z1 - B.z0 - 120); }
    s.tx = bx; s.tz = bz;
  }

  launch() {
    const s = { obj: saucerMesh(), beam: beamMesh(), x: this.mx, y: this.mAlt - 10, z: this.mz, tx: 0, tz: 0, alt: 46, state: 'cruise', t: 0, hp: 60, act: null, n: 0, lift: [], tilt: 0, hitT: 0, vx: 0, vz: 0 };
    s.obj.scale.setScalar(1.15);
    this.D.ctx.scene.add(s.obj, s.beam);
    this.pickTarget(s);
    this.saucers.push(s);
  }

  update(h) {
    const D = this.D, { people, traffic, fire, city } = D.ctx;
    this.t += h;
    // the mothership comes down out of the clouds, then hangs there
    const goal = this.leaving ? 900 : this.mAlt;
    this.my += (goal - this.my) * Math.min(1, h * (this.leaving ? 0.25 : 0.35));
    if (!this.leaving && this.toLaunch > 0 && (this.launchT -= h) <= 0) { this.launchT = 2.2; this.toLaunch--; this.launch(); }
    if (!this.leaving && (this.t > this.life || (this.toLaunch === 0 && this.saucers.every(s => s.state === 'down' || s.state === 'wreck')))) {
      this.leaving = true;
      const won = this.saucers.every(s => s.state === 'down' || s.state === 'wreck');
      D.emit({ type: 'aliensend', won, text: won ? 'Every saucer is down. The mothership is retreating' : 'The aliens are leaving with their captives' });
    }
    for (const s of this.saucers) this.saucerStep(s, h);
    for (let i = this.lasers.length - 1; i >= 0; i--) { const l = this.lasers[i]; l.t -= h; if (l.t <= 0) { D.ctx.scene.remove(l.m); this.lasers.splice(i, 1); } }
    if (this.leaving && this.my > 860 && this.saucers.every(s => s.state === 'wreck' || s.state === 'gone')) this.alive = false;
  }

  saucerStep(s, h) {
    const D = this.D, { people, traffic, fire, city } = D.ctx;
    s.t += h;
    if (s.state === 'wreck' || s.state === 'gone') return;
    if (s.state === 'down') { // spiral down trailing smoke and hit the ground
      s.vy = (s.vy || 0) - 9.8 * h; s.y += s.vy * h; s.x += s.vx * h; s.z += s.vz * h; s.tilt += h * 1.6;
      if (Math.random() < 0.5) fire.burst(s.x, s.y, s.z, 4, 1.6);
      if (s.y <= 1.2) {
        s.y = 1.0; s.state = 'wreck';
        fire.burst(s.x, 1, s.z, 30, 3); fire.carFire(s.x, s.z); people.crushNear(s.x, s.z, 4); D.shake(0.5);
        for (const j of s.lift) this.drop(j);
        s.lift.length = 0;
      }
      return;
    }
    if (this.leaving) { s.state = 'home'; }
    if (s.state === 'home') { // back up into the mothership
      for (const j of s.lift) this.drop(j); s.lift.length = 0; s.beam.visible = false;
      const dx = this.mx - s.x, dz = this.mz - s.z, d = Math.hypot(dx, dz) || 1;
      s.x += dx / d * Math.min(d, 30 * h); s.z += dz / d * Math.min(d, 30 * h); s.y += (this.my - 10 - s.y) * Math.min(1, h * 0.6);
      if (d < 4 && Math.abs(this.my - 10 - s.y) < 10) { s.state = 'gone'; D.ctx.scene.remove(s.obj, s.beam); }
      return;
    }
    this.hits(s, h);
    if (s.state === 'down') return;
    if (s.state === 'cruise') {
      const dx = s.tx - s.x, dz = s.tz - s.z, d = Math.hypot(dx, dz) || 0.001, v = Math.min(18, 3 + d * 0.4);
      s.vx = dx / d * v; s.vz = dz / d * v;
      s.x += s.vx * h; s.z += s.vz * h; s.y += (s.alt - s.y) * Math.min(1, h * 0.8);
      if (d < 2) {
        const r = Math.random();
        s.act = r < 0.45 ? 'abduct' : r < 0.75 ? 'zap' : 'drop';
        if (s.act === 'drop' && people.stats.aliens > 70) s.act = 'abduct';
        s.state = 'act'; s.t = 0; s.n = 0; s.vx = s.vz = 0;
      }
      return;
    }
    // acting over the target
    if (s.act === 'abduct') {
      s.y += (22 - s.y) * Math.min(1, h * 0.9);
      s.beam.visible = s.t > 1.2;
      if (s.t > 1.2 && s.t < 9) {
        if ((s.n -= h) <= 0) {
          s.n = 0.35;
          let got = 0;
          people.around(s.x, s.z, 6.5, (j) => { if (got < 2 && s.lift.length < 14 && people.lvl[j] === -1 && people.grab(j)) { s.lift.push(j); got++; } });
          if (Math.random() < 0.15) traffic.near(s.x, s.z, 7, (car) => { if (!s.car && !car.mission && !car.gone && (car.mode === 0 || car.mode === 2) && Math.hypot(car.x - s.x, car.z - s.z) < 7 && traffic.grab(car)) s.car = car; });
        }
      }
      for (let k = s.lift.length - 1; k >= 0; k--) { // drawn up the beam, slowly turning
        const j = s.lift[k], a = s.t * 1.5 + j;
        if (people.st[j] !== ST.EXT) { s.lift.splice(k, 1); continue; } // shot, or dropped
        people.x[j] += (s.x + Math.cos(a) * 1.5 - people.x[j]) * Math.min(1, h * 1.5); people.z[j] += (s.z + Math.sin(a) * 1.5 - people.z[j]) * Math.min(1, h * 1.5);
        people.y[j] += 3.2 * h;
        if (people.y[j] > s.y - 1.5) { people.st[j] = ST.EVAC; people.lvl[j] = -1; people.stats.abducted++; this.stats.abducted++; s.lift.splice(k, 1); }
      }
      if (s.car) {
        const c = s.car; c.x += (s.x - c.x) * Math.min(1, h * 1.2); c.z += (s.z - c.z) * Math.min(1, h * 1.2); c.y = (c.y || 0) + 2.4 * h; c.yaw += h * 0.8; c.roll = Math.sin(s.t) * 0.3;
        if (c.y > s.y - 2) { traffic.remove(c); s.car = null; }
      }
      if (s.t > 16) { for (const j of s.lift) this.drop(j); s.lift.length = 0; if (s.car) { traffic.fling(s.car, 0, 0, 0); s.car = null; } }
      if (s.t > 11 && !s.lift.length && !s.car) { s.beam.visible = false; this.pickTarget(s); s.state = 'cruise'; }
    } else if (s.act === 'zap') {
      s.y += (38 - s.y) * Math.min(1, h * 0.8);
      if (s.t > 1 && (s.n -= h) <= 0) {
        s.n = 0.9 + Math.random() * 0.6;
        this.zapNear(s);
        if (s.t > 8) { this.pickTarget(s); s.state = 'cruise'; }
      }
    } else if (s.act === 'drop') {
      s.y += (16 - s.y) * Math.min(1, h * 0.9);
      s.beam.visible = s.t > 1.5 && s.t < 3.5;
      if (s.t > 2.4 && !s.n) { s.n = 1; const got = people.spawnAliens(s.x, s.z, 4); this.stats.aliens += got.length; D.emit({ type: 'aliendrop', x: s.x, z: s.z, n: got.length }); }
      if (s.t > 4.5) { s.beam.visible = false; this.pickTarget(s); s.state = 'cruise'; }
    }
  }

  // police and soldiers below shoot at low saucers; the saucer fires back
  hits(s, h) {
    if ((s.hitT -= h) > 0) return;
    s.hitT = 0.5;
    if (s.y > 50) return;
    const { people, fire } = this.D.ctx;
    let dmg = 0, shooter = -1;
    people.around(s.x, s.z, 45, (j) => {
      const k = people.kind[j];
      if ((k !== KIND.OFFICER && k !== KIND.SOLDIER) || people.st[j] !== ST.COP) return;
      dmg += k === KIND.SOLDIER ? 0.6 : 0.25; shooter = j; // damage per second
      people.hx[j] = s.x - people.x[j]; people.hz[j] = s.z - people.z[j];
      if (people.flashList.length < people.flashMax && Math.random() < 0.6) people.flashList.push({ x: people.x[j], y: people.y[j] + 1.3, z: people.z[j], t: 0.08 });
    });
    if (!dmg) return;
    s.hp -= dmg * 0.5; // every half second
    if (Math.random() < 0.5) fire.burst(s.x + (Math.random() - 0.5) * 8, s.y - 0.5, s.z + (Math.random() - 0.5) * 8, 3, 0.7);
    if (shooter >= 0 && Math.random() < 0.08) { this.laser(s, people.x[shooter], people.y[shooter] + 1, people.z[shooter]); people.kill(shooter, 0, 0, 'zap'); }
    if (s.hp <= 0) this.shootDown(s);
  }

  shootDown(s) {
    if (s.state === 'down' || s.state === 'wreck' || s.state === 'gone') return;
    s.state = 'down'; s.beam.visible = false; s.vy = 2;
    for (const j of s.lift) this.drop(j); s.lift.length = 0; s.vx = (Math.random() - 0.5) * 10; s.vz = (Math.random() - 0.5) * 10;
    if (s.car) { this.D.ctx.traffic.fling(s.car, 0, 0, 0); s.car = null; }
    this.stats.down++;
    this.D.emit({ type: 'saucerdown', x: s.x, z: s.z, text: 'Saucer shot down!' });
  }

  drop(j) { const p = this.D.ctx.people; if (p.st[j] === ST.EXT) p.fling(j, (Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2); }

  zapNear(s) {
    const { city, traffic, fire, people } = this.D.ctx;
    const r = Math.random();
    if (r < 0.55) { // a building
      const ks = []; city.buildingsNear(s.x, s.z, 30, (k) => { if (!city.dead[k]) ks.push(k); });
      if (!ks.length) return;
      const k = ks[Math.floor(Math.random() * ks.length)], b = city.buildings[k];
      const px = Math.max(b.x0, Math.min(b.x1, s.x)), pz = Math.max(b.z0, Math.min(b.z1, s.z)), py = b.baseY + Math.random() * (b.top - b.baseY);
      this.laser(s, px, py, pz); fire.burst(px, py, pz, 8, 1.6);
      if (b.top - b.baseY < 22 && Math.random() < 0.14) this.D.destroyBuilding(k, 'collapse');
      else if (Math.random() < 0.4) fire.igniteBuilding(k);
    } else if (r < 0.8) { // a car
      let tgt = null; traffic.near(s.x, s.z, 28, (car) => { if (!tgt && !car.gone && (car.mode === 0 || car.mode === 2) && !car.burning) tgt = car; });
      if (!tgt) return;
      this.laser(s, tgt.x, 1, tgt.z); fire.burst(tgt.x, 1, tgt.z, 8, 1.4); traffic.burn(tgt);
    } else { // people in the street
      let tgt = -1; people.around(s.x + (Math.random() - 0.5) * 20, s.z + (Math.random() - 0.5) * 20, 14, (j) => { if (tgt < 0 && people.hittable(j)) tgt = j; });
      if (tgt < 0) return;
      this.laser(s, people.x[tgt], 0.3, people.z[tgt]); fire.burst(people.x[tgt], 0.4, people.z[tgt], 5, 1);
      people.around(people.x[tgt], people.z[tgt], 2.5, (j) => { if (people.hittable(j) && people.kind[j] !== KIND.ALIEN) { people.wz[j] = people.st[j] === ST.ZOMBIE ? 1 : 0; people.kill(j, 0, 0, 'zap'); } });
    }
  }

  laser(s, x, y, z) {
    const m = new THREE.Mesh(parts().laser, parts().laserMat), from = new THREE.Vector3(s.x, s.y - 1, s.z), d = new THREE.Vector3(x, y, z).sub(from);
    m.position.copy(from); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()); m.scale.set(1, d.length(), 1);
    this.D.ctx.scene.add(m); this.lasers.push({ m, t: 0.18 });
  }

  // airstrikes and nukes: saucers caught in the blast come down
  onEvent(e) {
    if (e.type !== 'blast' && e.type !== 'nuked') return;
    const R = e.type === 'nuked' ? 170 : 32;
    for (const s of this.saucers) if (s.state !== 'down' && s.state !== 'wreck' && s.state !== 'gone' && s.y < 90 && Math.hypot(s.x - e.x, s.z - e.z) < R) this.shootDown(s);
  }

  sync(dt, realT) {
    this.mother.position.set(this.mx, this.my, this.mz); this.mother.userData.spin.rotation.y += dt * 0.08;
    for (const s of this.saucers) {
      if (s.state === 'gone') continue;
      const o = s.obj, hover = s.state === 'wreck' ? 0 : Math.sin(realT * 2 + s.x) * 0.3;
      o.position.set(s.x, s.y + hover, s.z);
      if (s.state === 'wreck') { o.rotation.set(0.35, 0, 0.2); continue; }
      o.userData.spin.rotation.y += dt * (s.state === 'down' ? 6 : 1.4);
      o.rotation.x = s.state === 'down' ? Math.sin(s.tilt) * 0.6 : -s.vz * 0.012; o.rotation.z = s.state === 'down' ? Math.cos(s.tilt) * 0.4 : s.vx * 0.012;
      if (s.beam.visible) { s.beam.position.set(s.x, s.y - 0.8, s.z); s.beam.scale.set(1, Math.max(1, s.y - 0.8), 1); s.beam.material.uniforms.uTime.value = realT; s.beam.material.uniforms.uOn.value = 1; }
    }
  }

  dispose() {
    const { scene, people } = this.D.ctx;
    scene.remove(this.mother);
    for (const s of this.saucers) { scene.remove(s.obj, s.beam); s.beam.material.dispose(); for (const j of s.lift) if (people.st[j] === ST.EXT) this.drop(j); if (s.car) this.D.ctx.traffic.remove(s.car); }
    for (const l of this.lasers) scene.remove(l.m);
    this.saucers.length = 0; this.lasers.length = 0;
  }
}
