// The big moves (heroes and villains). The sky slam: an uppercut launches the
// other one high into the air, the striker flies up past them and hammers them
// back down, and they hit the street in a ring of force that knocks cars aside,
// blows out windows and brings the smallest buildings down; they lie in the crater
// a moment. The space dive (villains): one shoots straight up out of sight, a red
// ring on the ground shows where they will come down, and they race back down
// burning like a meteor to land in a mini nuclear blast (no fallout, no
// radiation). A free hero may race to the spot and catch them before they land.
import * as THREE from 'three';
import { sfx } from './audio.js';
import { toss } from './brawl.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (u) => 1 - (1 - u) * (1 - u);
const MINI = 55; // the space dive's blast radius (a full strike is 170-280)

let K = null;
function kit() {
  if (K) return K;
  const add = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide });
  K = { ring: new THREE.RingGeometry(0.82, 1, 64).rotateX(-Math.PI / 2), ball: new THREE.SphereGeometry(1, 16, 12), add };
  return K;
}

export class Stunts {
  constructor(brawl) { this.B = brawl; this.D = brawl.D; this.slams = []; this.dives = []; this.fx = []; }
  reset() {
    for (const s of this.slams) for (const f of [s.A, s.V]) this.free(f);
    for (const d of this.dives) { this.free(d.v); if (d.hero) this.free(d.hero); }
    for (const e of this.fx) this.dropFx(e);
    this.slams.length = 0; this.dives.length = 0; this.fx.length = 0;
  }
  free(f) { if (!f) return; f.stunt = null; f.move = null; f.gripped = false; f.busyT = 0.3; }
  near(x, z) { const { camera, controls } = this.D.ctx, c = controls.target; return Math.hypot(x - c.x, z - c.z) < camera.position.distanceTo(c) * 1.2; }
  ground(x, z) { return this.D.ctx.people.groundY(x, z); }

  // a ring of light spreading from (x, y, z) out to R over T seconds (flat on the ground, or level in the air)
  ring(x, y, z, R, T, col, o = 0.85) {
    const k = kit(), m = new THREE.Mesh(k.ring, k.add(col, o)); m.position.set(x, y, z); m.frustumCulled = false; m.renderOrder = 8; this.D.ctx.scene.add(m);
    this.fx.push({ m, t: 0, T, R, o, kind: 'ring' });
  }
  dropFx(e) { this.D.ctx.scene.remove(e.m); e.m.material.dispose(); }

  // ---------- the sky slam: A sends V up with an uppercut and hammers them back down
  slam(A, V) {
    if (!A || !V || V.tossed || A.tossed || V.gone || V.beaten || this.slams.some(s => s.A === A || s.V === V || s.A === V || s.V === A)) return false;
    const gy = this.ground(V.x, V.z), y0 = V.y || 0, top = clamp(y0 + 75, gy + 70, gy + 150);
    const s = { A, V, t: 0, y0, top, gy, x: V.x, z: V.z, ay: A.y || 0, hit: false, vy: 0, said: false };
    A.stunt = s; V.stunt = s; V.gripped = true; A.busyT = V.busyT = 0.3;
    A.move = { kind: 'upper', t: 0, T: 0.45, side: 1 };
    this.slams.push(s);
    return true;
  }
  slamStep(s, h) {
    const D = this.D, { fire } = D.ctx, A = s.A, V = s.V;
    s.t += h; A.busyT = 0.3; V.busyT = 0.3; V.gripped = true;
    if (A.move && (A.move.t += h) >= A.move.T) A.move = null;
    if (s.t < 0.2) return false; // the uppercut on its way
    if (!s.hit) { s.hit = true; fire.burst(V.x, (V.y || 0) + 3, V.z, 16, 2); sfx('thud', V.x, V.y + 3, V.z, { gain: 1.5, rate: 0.7 }); if (this.near(V.x, V.z)) D.shake(0.4); }
    const t = s.t - 0.2;
    if (t < 1.0) { // up it goes
      V.y = s.y0 + (s.top - s.y0) * ease(t / 1.0); V.x = s.x; V.z = s.z;
      if (Math.random() < 0.5) fire.burst(V.x, V.y, V.z, 2, 1);
    }
    if (t > 0.25 && t < 1.35) { // the striker flies up after them, to just above
      const u = clamp((t - 0.25) / 1.1, 0, 1); A.y = s.ay + (s.top + 7 - s.ay) * ease(u); A.x += (s.x - A.x) * Math.min(1, h * 5); A.z += (s.z - A.z) * Math.min(1, h * 5);
      A.stuntPose = 'rise';
    }
    if (t >= 1.35 && t < 1.7) { // the hammer blow
      if (!A.move || A.move.kind !== 'hammer') A.move = { kind: 'hammer', t: 0, T: 0.35, side: 0 };
      A.stuntPose = null; A.y = s.top + 7; V.y = s.top;
    }
    if (t >= 1.55 && !s.down) {
      s.down = true; s.vy = -45;
      fire.burst(V.x, V.y + 2, V.z, 26, 2.6); sfx('thud', V.x, V.y + 2, V.z, { gain: 1.6, rate: 0.6 }); sfx('boom', V.x, V.y, V.z, { gain: 0.6 });
      this.ring(V.x, V.y + 2, V.z, 22, 0.5, new THREE.Color(1.6, 1.4, 1.2), 0.7); if (this.near(V.x, V.z)) D.flash(0.15);
    }
    if (s.down) { // straight back down, faster and faster; the striker dives after them
      s.vy -= 160 * h; V.y += s.vy * h; A.y = Math.max(V.y + 9, A.y + s.vy * 0.8 * h); A.stuntPose = 'dive';
      fire.burst(V.x, V.y + 4, V.z, 3, 1.4);
      if (V.y <= s.gy) { this.impact(s); return true; }
    }
    return false;
  }
  // the street where they land: a crater of cracks, dust, a ring of force out across the ground
  impact(s) {
    const D = this.D, { fire, city, traffic, people } = D.ctx, A = s.A, V = s.V, x = V.x, z = V.z, gy = s.gy;
    V.y = gy; A.y = gy + 0.2; A.x = x + Math.sin(A.yaw) * -4; A.z = z + Math.cos(A.yaw) * -4;
    D.decals.add('crack', x, z, 22, 22); D.decals.add('scour', x, z, 9, 9);
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; fire.dustCloud(x + Math.cos(a) * 9, z + Math.sin(a) * 9, 6, 4); }
    fire.burst(x, gy + 1, z, 30, 3); sfx('boomBig', x, gy, z); if (this.near(x, z)) { D.shake(1.3); D.flash(0.2); }
    this.ring(x, gy + 0.6, z, 55, 0.8, new THREE.Color(1.8, 1.4, 1.0), 0.9);
    city.buildingsNear(x, z, 40, (k, d, b) => {
      if (city.dead[k] || b.landmark) return; const bx = (b.x0 + b.x1) / 2 - x, bz = (b.z0 + b.z1) / 2 - z;
      if (d < 6 && b.top - b.baseY < 20) D.destroyBuilding(k, 'collapse', { dir: Math.atan2(-bx, bz) });
      else D.blowWindows(k, bx, bz, d < 15 ? 1 : 0.6);
    });
    traffic.near(x, z, 36, (c) => { if (c.gone || c.mission || c.mode === 4 || c.mode === 5) return; const dx = c.x - x, dz = c.z - z, d = Math.hypot(dx, dz) || 1, p = 1 - d / 36; c.soft = true; traffic.fling(c, dx / d * (8 + 18 * p), 4 + 8 * p, dz / d * (8 + 18 * p)); });
    people.around(x, z, 40, (j) => { if (!people.hittable(j)) return; const dx = people.x[j] - x, dz = people.z[j] - z, d = Math.hypot(dx, dz) || 1; people.move(j, dx / d, dz / d, 4); people.panic(j, x, z, -1); }); // bowled over and running, not hurt
    this.free(A); A.busyT = 0.7; this.free(V); V.busyT = 2.2; V.downT = 2.2; // flat on their back in the crater a moment
    if (V.side === 'villain') this.B.hurt(V, 60, A);
    this.B.say('slam' + A.name, A.name + ' knocked ' + V.name + ' into the sky and slammed them back down!');
  }

  // ---------- the space dive: up out of sight, back down like a meteor, a mini nuke where they land
  dive(v) {
    if (!v || v.gone || v.beaten || v.player || this.dives.some(d => d.v === v)) return false;
    const { city } = this.D.ctx, B = city.bounds, M = 80;
    const tx = clamp(v.x + (Math.random() - 0.5) * 140, B.x0 + M, B.x1 - M), tz = clamp(v.z + (Math.random() - 0.5) * 140, B.z0 + M, B.z1 - M);
    const d = { v, t: 0, phase: 'up', tx, tz, vy: 30, x0: v.x, z0: v.z };
    v.stunt = d; v.busyT = 0.3; if (v.dropHeld) v.dropHeld();
    this.dives.push(d);
    this.B.say('up' + v.name, v.name + ' shot up into space!');
    sfx('whoosh', v.x, v.y + 3, v.z, { gain: 1.2, rate: 0.6 });
    return true;
  }
  diveStep(d, h) {
    const D = this.D, { fire, people } = D.ctx, v = d.v;
    d.t += h; v.busyT = 0.3;
    if (d.phase === 'up') {
      d.vy = Math.min(420, d.vy + h * 260); v.y = (v.y || 0) + d.vy * h; v.stuntPose = 'rise';
      fire.burst(v.x, v.y - 3, v.z, 3, 1.6);
      if (v.y > 520) { // out of sight: where they will come down
        d.phase = 'space'; d.t = 0; v.x = d.tx + 90; v.z = d.tz + 50; v.y = 560;
        const gy = this.ground(d.tx, d.tz); // a solid red ring on the ground where they will land (an additive one vanished on the pale streets)
        d.mark = new THREE.Mesh(kit().ring, new THREE.MeshBasicMaterial({ color: '#ff2a12', transparent: true, opacity: 0.8, depthWrite: false, fog: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4 }));
        d.mark.position.set(d.tx, gy + 0.6, d.tz); d.mark.scale.setScalar(MINI * 0.8); d.mark.frustumCulled = false; d.mark.renderOrder = 6; D.ctx.scene.add(d.mark);
        people.scare(d.tx, d.tz, MINI * 1.8, 1);
        D.emit({ type: 'warn', hazard: 'villains', x: d.tx, z: d.tz, r: MINI, exact: true, text: v.name + ' is coming back down from space! Something is about to hit the ' + D.district(d.tx, d.tz) + ' district' });
        // a hero may race to the spot to catch them on the way down
        let best = null, bd = 400; for (const hr of this.B.fighters('hero')) { if (hr.busy || hr.fight || hr.beam || hr.stunt || hr.tossed || hr.gripped) continue; const dd = Math.hypot(hr.x - d.tx, hr.z - d.tz); if (dd < bd) { bd = dd; best = hr; } }
        if (best && Math.random() < 0.6) { d.hero = best; best.stunt = d; best.stuntPose = null; }
      }
      return false;
    }
    if (d.mark) { const p = 0.5 + 0.5 * Math.sin(d.t * 10); d.mark.material.opacity = 0.55 + 0.4 * p; d.mark.scale.setScalar(MINI * (0.75 + 0.08 * p)); }
    const H = d.hero;
    if (H) { // racing to the spot, up above it
      H.busyT = 0.3; const gx = d.tx - H.x, gy = this.ground(d.tx, d.tz) + 70 - H.y, gz = d.tz - H.z, gl = Math.hypot(gx, gy, gz) || 1, sp = Math.min(gl, 110 * h);
      H.x += gx / gl * sp; H.y += gy / gl * sp; H.z += gz / gl * sp; H.yaw = Math.atan2(gx, gz);
    }
    if (d.phase === 'space') { if (d.t > 2.2) { d.phase = 'down'; d.t = 0; sfx('whoosh', d.tx, 80, d.tz, { gain: 1.4, rate: 0.45 }); } return false; }
    // down: from high off to one side, burning, faster and faster
    const k = clamp(d.t / 1.3, 0, 1), q = k * k, gy = this.ground(d.tx, d.tz);
    v.x = d.tx + 90 * (1 - q); v.z = d.tz + 50 * (1 - q); v.y = gy + (560 - gy) * (1 - q); v.stuntPose = 'dive'; v.yaw = Math.atan2(-90, -50);
    fire.burst(v.x, v.y + 3, v.z, 5, 2.4); if (Math.random() < 0.5) fire.burst(v.x + 3, v.y + 8, v.z + 2, 3, 3);
    if (H && v.y < gy + 110 && !d.tried) { // the hero meets them on the way down
      d.tried = true;
      if (Math.hypot(H.x - v.x, H.y - v.y, H.z - v.z) < 70 && Math.random() < 0.5) { this.caught(d); return true; }
      toss(H, (Math.random() - 0.5) * 40, 14, (Math.random() - 0.5) * 40); H.stunt = null; d.hero = null; // knocked aside: it comes down anyway
      this.B.say('miss' + v.name, v.name + ' smashed straight through ' + H.name + '!');
    }
    if (k >= 1) { this.land(d); return true; }
    return false;
  }
  // caught in the air: a burst well above the street, the villain thrown off to one side, no blast
  caught(d) {
    const D = this.D, { fire } = D.ctx, v = d.v, H = d.hero;
    fire.burst(v.x, v.y, v.z, 30, 3); sfx('boomBig', v.x, v.y, v.z, { gain: 0.8 }); this.ring(v.x, v.y, v.z, 45, 0.6, new THREE.Color(1.8, 1.6, 1.3), 0.7); if (this.near(v.x, v.z)) D.shake(0.6);
    this.endDive(d);
    const a = Math.random() * 6.28; toss(v, Math.cos(a) * 45, 12, Math.sin(a) * 45); this.B.hurt(v, 80, H);
    if (H) { toss(H, -Math.cos(a) * 15, 8, -Math.sin(a) * 15); }
    this.B.say('caught' + v.name, H.name + ' caught ' + v.name + ' before the impact!');
  }
  land(d) {
    const D = this.D, v = d.v, gy = this.ground(d.tx, d.tz);
    v.x = d.tx; v.z = d.tz; v.y = gy;
    this.endDive(d);
    D.nukeBlast(d.tx, d.tz, MINI, { clean: true, mini: true }); // a mini nuke: no fallout, no radiation
    D.decals.add('crack', d.tx, d.tz, 30, 30);
    v.busyT = 1.6;
    this.B.say('nuke' + v.name, v.name + ' came down like a meteor: a mini nuke in the ' + D.district(d.tx, d.tz) + ' district!');
  }
  endDive(d) {
    if (d.mark) { this.D.ctx.scene.remove(d.mark); d.mark.material.dispose(); d.mark = null; }
    d.v.stunt = null; d.v.stuntPose = null; d.v.busyT = 0.3;
    if (d.hero) { d.hero.stunt = null; d.hero.busyT = 0.3; }
  }

  // now and then a villain goes up for a dive: not in the first 45 s, then every 100-140 s, one at a time
  update(h) {
    for (const e of this.D.list) {
      if (e.type !== 'villains' || !e.alive || e.leaving) continue;
      if (e.diveT == null) e.diveT = 45 + Math.random() * 30;
      if ((e.diveT -= h) > 0 || this.dives.length) continue;
      const m = this.B.melee, ok = e.who.filter(v => v.inCity && m.free(v));
      if (!ok.length) { e.diveT = 5; continue; }
      if (this.dive(ok[Math.floor(Math.random() * ok.length)])) e.diveT = 100 + Math.random() * 40;
    }
    for (let i = this.slams.length - 1; i >= 0; i--) { const s = this.slams[i]; if (s.A.gone || s.V.gone || s.A.tossed) { this.free(s.A); this.free(s.V); this.slams.splice(i, 1); continue; } if (this.slamStep(s, h)) this.slams.splice(i, 1); }
    for (let i = this.dives.length - 1; i >= 0; i--) { const d = this.dives[i]; if (d.v.gone || d.v.tossed) { this.endDive(d); this.dives.splice(i, 1); continue; } if (this.diveStep(d, h)) this.dives.splice(i, 1); }
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const e = this.fx[i]; e.t += h; const k = e.t / e.T;
      e.m.scale.setScalar(1 + e.R * Math.sqrt(Math.min(1, k))); e.m.material.opacity = e.o * Math.max(0, 1 - k);
      if (k >= 1) { this.dropFx(e); this.fx.splice(i, 1); }
    }
    for (const f of this.B.fighters('hero').concat(this.B.fighters('villain'))) if (f.downT > 0) f.downT -= h;
  }
}
