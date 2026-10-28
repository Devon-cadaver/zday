// Heroes against the alien invasion (Sean). A hero takes a tripod by one leg,
// heaves the whole machine up off its feet, swings it round twice and lets go:
// it sails off across the town, tumbling, and comes down in a wreck where it
// lands. The saucers: a hero flies straight through one, which bursts into flame
// and spirals down; or grabs one, spins with it and slings it up out of sight
// into space. Now and then a tripod is too much for them and kicks them off.
import { heroesWin } from './heroes.js';
import { toss } from './brawl.js';
import { sfx } from './audio.js';

const LEG = 32; // how far the tripod's head swings out from the hand holding its foot
const live = (s) => s.state === 'cruise' || s.state === 'act';

// what a hero on the aliens goes for: the nearest walking tripod nobody has hold of, else the nearest saucer
export function pickAlien(hero, I) {
  let best = null, bd = 1e9;
  for (const t of I.tripods) {
    if (t.state !== 'walk' || t.heroBy || t.heroLost) continue;
    const d = Math.hypot(t.x - hero.x, t.z - hero.z) - 60; if (d < bd) { bd = d; best = { t }; } // a tripod first, a little
  }
  for (const s of I.saucers) {
    if (!live(s) || s.heroBy) continue;
    const d = Math.hypot(s.x - hero.x, s.z - hero.z); if (d < bd) { bd = d; best = { s }; }
  }
  return best;
}

// one step of a hero's alien job J ({ kind: 'alien', I, t | s, phase })
export function alienStep(hero, h, J) {
  const I = J.I;
  if (!I.alive) { hero.job = null; return; }
  if (!J.t && !J.s) { const p = pickAlien(hero, I); if (!p) { hero.job = null; return; } Object.assign(J, p, { phase: 'go', k: 0 }); (J.t || J.s).heroBy = hero; if (J.s) J.through = Math.random() < 0.5; }
  if (J.t) tripodStep(hero, h, J); else saucerStep(hero, h, J);
}
function done(hero, J) { const o = J.t || J.s; if (o && o.heroBy === hero) o.heroBy = null; hero.spinning = false; hero.job = null; }

// ---------- a tripod by the leg
function tripodStep(hero, h, J) {
  const t = J.t, D = hero.D, { fire, city } = D.ctx;
  if (J.phase === 'go') {
    if (t.state !== 'walk') { done(hero, J); return; }
    const L = t.legs[0], fy = (L.gy || 0) + 1.5, d = hero.fly(L.fx, fy, L.fz, h, 70, 20);
    if (d > 4) return;
    if (!heroesWin(t)) { // it kicks them off
      t.heroLost = true; done(hero, J); toss(hero, (hero.x - t.x) * 0.6, 14, (hero.z - t.z) * 0.6);
      D.emit({ type: 'herolost', x: t.x, z: t.z, text: 'The tripod kicked ' + hero.name + ' away!' }); return;
    }
    // hold: the machine stops dead, its rays off, anyone it held dropped
    t.state = 'held'; t.ray = null; t.tb = null; const P = D.ctx.people; for (const j of t.lift) if (P.st[j] === 19) P.fling(j, 0, 0, 0); t.lift.length = 0;
    J.phase = 'lift'; J.k = 0; J.h0 = [t.x, t.y, t.z]; J.a = Math.atan2(t.z - hero.z, t.x - hero.x); hero.spinning = true; // arms out, holding on
    D.emit({ type: 'herotripod', x: t.x, z: t.z, text: hero.name + ' grabbed a tripod by the leg!' });
    sfx('thud', hero.x, hero.y, hero.z, { gain: 1.4, rate: 0.6 });
    return;
  }
  if (J.phase === 'lift' || J.phase === 'spin') {
    J.k += h; hero.busyT = 0; hero.vx = hero.vy = hero.vz = 0;
    const up = J.phase === 'lift' ? Math.min(1, J.k / 1.0) : 1;
    hero.y += ((J.hy || (J.hy = Math.max(45, hero.y + 30))) - hero.y) * Math.min(1, h * 3 * up); // up into the air with it
    hero.spinning = true; if (J.phase === 'spin') J.a += h * Math.PI * 2 * (0.6 + Math.min(1, J.k / 1.2) * 0.7); // round, faster and faster
    const R = LEG * (J.phase === 'lift' ? 0.6 + 0.4 * up : 1), hx = hero.x + Math.cos(J.a) * R, hz = hero.z + Math.sin(J.a) * R, hy = hero.y - 6 + (J.phase === 'lift' ? -18 * (1 - up) : 0);
    const k = J.phase === 'lift' ? up : 1;
    t.x = J.h0[0] + (hx - J.h0[0]) * k; t.y = J.h0[1] + (hy - J.h0[1]) * k; t.z = J.h0[2] + (hz - J.h0[2]) * k;
    hero.yaw = Math.atan2(t.x - hero.x, t.z - hero.z);
    // the held foot in the hand, the other two trailing behind the swing
    const L = t.legs, tx = -Math.sin(J.a), tz = Math.cos(J.a);
    L[0].fx = hero.x; L[0].fz = hero.z; L[0].gy = 0; L[0].fy = hero.y + 2;
    for (const [i, s] of [[1, 1], [2, -1]]) { L[i].fx = t.x + Math.cos(J.a) * 10 - tx * 9 + s * tz * 4; L[i].fz = t.z + Math.sin(J.a) * 10 - tz * 9 - s * tx * 4; L[i].gy = 0; L[i].fy = t.y - 14; }
    t.yaw = J.a + Math.PI; t.rot = [0.9 * k, 0.5 * k];
    if (J.phase === 'lift' && up >= 1) { J.phase = 'spin'; J.k = 0; }
    if (J.phase === 'spin' && J.k > 1.6) { // let go: across the town, to come down in its streets on the far side of the middle
      const B = city.bounds, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2, M = 50;
      let gx = cx + (cx - t.x) * 0.7 + (Math.random() - 0.5) * 80, gz = cz + (cz - t.z) * 0.7 + (Math.random() - 0.5) * 80;
      gx = Math.max(B.x0 + M, Math.min(B.x1 - M, gx)); gz = Math.max(B.z0 + M, Math.min(B.z1 - M, gz));
      let dx = gx - t.x, dz = gz - t.z, d = Math.hypot(dx, dz); if (d < 120) { const a0 = Math.atan2(dz, dx); dx = Math.cos(a0) * 120; dz = Math.sin(a0) * 120; d = 120; } // a long way, whatever
      const vy = 22, T = (vy + Math.sqrt(vy * vy + 2 * 9.8 * Math.max(1, t.y))) / 9.8; // its time in the air
      t.state = 'hurled'; J.phase = 'throw'; J.v = [dx / T, vy, dz / T]; J.k = 0; hero.spinning = false;
      D.emit({ type: 'herothrow', x: t.x, z: t.z, text: hero.name + ' threw a tripod across the town!' });
      sfx('whoosh', t.x, t.y, t.z, { gain: 1.4, rate: 0.5 });
    }
    return;
  }
  if (J.phase === 'throw') { // tumbling through the air, legs flailing, until it hits the ground
    J.k += h; J.v[1] -= 9.8 * h; t.x += J.v[0] * h; t.y += J.v[1] * h; t.z += J.v[2] * h;
    t.rot = [J.k * 2.2, J.k * 1.4]; t.yaw += h * 2;
    for (const [i, L] of t.legs.entries()) { const a = J.k * 3 + i * 2.1; L.fx = t.x + Math.cos(a) * 14; L.fz = t.z + Math.sin(a) * 14; L.gy = 0; L.fy = t.y - 8 + Math.sin(a * 1.3) * 8; }
    if (Math.random() < 0.6) fire.burst(t.x, t.y, t.z, 3, 2);
    hero.fly(hero.x, hero.cruiseY(), hero.z, h, 30);
    const gy = D.ctx.people.groundY(t.x, t.z);
    if (t.y > gy + 3 && J.k < 12) return;
    // down: a wreck where it lands, flattening what it falls on
    t.y = 3.2; t.state = 'wreck'; t.ft = 2.4; t.rot = null;
    for (const L of t.legs) { L.fy = 0; L.gy = 0; }
    fire.burst(t.x, 2, t.z, 50, 4.5); fire.carFire(t.x, t.z); fire.dustCloud(t.x, t.z, 14, 16); D.ctx.people.crushNear(t.x, t.z, 10); D.shake(1.4);
    city.buildingsNear(t.x, t.z, 12, (kb) => D.destroyBuilding(kb, 'collapse'));
    sfx('boomBig', t.x, 4, t.z);
    I_down(J.I, t);
    done(hero, J);
  }
}
function I_down(I, t) { I.D.emit({ type: 'tripoddown', x: t.x, z: t.z, text: 'A tripod is down!' }); }

// ---------- a saucer: straight through it, or round and up into space
function saucerStep(hero, h, J) {
  const s = J.s, I = J.I, D = hero.D, { fire } = D.ctx;
  if (J.phase === 'go') {
    if (!live(s)) { done(hero, J); return; }
    if (J.through) { // a run at it, flat out
      const d = hero.fly(s.x, s.y, s.z, h, 95, 45);
      if (d > 3.5) return;
      fire.burst(s.x, s.y, s.z, 40, 3.5); sfx('boomBig', s.x, s.y, s.z, { gain: 0.9 }); if (I.D) D.shake(0.5);
      I.shootDown(s); s.vx = hero.vx * 0.3; s.vz = hero.vz * 0.3;
      D.emit({ type: 'herosaucer', x: s.x, z: s.z, text: hero.name + ' flew straight through a saucer!' });
      J.phase = 'past'; J.k = 0; J.d = [hero.vx, hero.vz]; return;
    }
    const d = hero.fly(s.x, s.y + 1, s.z, h, 80, 30);
    if (d > 5) return;
    s.state = 'held'; s.beam.visible = false; for (const j of s.lift) I.drop(j); s.lift.length = 0; if (s.car) { D.ctx.traffic.fling(s.car, 0, 0, 0); s.car = null; }
    J.phase = 'spin'; J.k = 0; J.a = Math.atan2(s.z - hero.z, s.x - hero.x);
    D.emit({ type: 'herograbsaucer', x: s.x, z: s.z, text: hero.name + ' grabbed a saucer!' });
    return;
  }
  if (J.phase === 'past') { // on through and out the other side
    J.k += h; hero.x += J.d[0] * h; hero.z += J.d[1] * h; hero.vx = J.d[0]; hero.vz = J.d[1];
    if (J.k > 0.6) done(hero, J);
    return;
  }
  if (J.phase === 'spin') {
    J.k += h; hero.vx = hero.vy = hero.vz = 0; hero.spinning = true;
    J.a += h * Math.PI * 2 * (0.7 + Math.min(1, J.k) * 0.8);
    s.x = hero.x + Math.cos(J.a) * 7; s.z = hero.z + Math.sin(J.a) * 7; s.y = hero.y + 1; hero.yaw = Math.atan2(s.x - hero.x, s.z - hero.z);
    if (J.k > 1.4) { s.state = 'tossed'; J.phase = 'up'; J.k = 0; J.v = [Math.cos(J.a + Math.PI / 2) * 20, 140, Math.sin(J.a + Math.PI / 2) * 20]; hero.spinning = false; sfx('whoosh', s.x, s.y, s.z, { gain: 1.3, rate: 0.7 }); D.emit({ type: 'herotoss', x: s.x, z: s.z, text: hero.name + ' threw a saucer into space!' }); }
    return;
  }
  if (J.phase === 'up') { // up and up, out of sight
    J.k += h; s.x += J.v[0] * h; s.y += J.v[1] * h; s.z += J.v[2] * h; J.v[1] += 30 * h;
    if (Math.random() < 0.5) fire.burst(s.x, s.y - 2, s.z, 2, 2);
    hero.fly(hero.x, hero.cruiseY(), hero.z, h, 30);
    if (s.y > 700 || J.k > 6) { s.state = 'gone'; s.spaced = true; D.ctx.scene.remove(s.obj, s.beam); I.stats.down++; done(hero, J); }
  }
}

// a machine a hero had hold of when the hero was knocked away (or left): it does not hang in the air
export function orphans(I) {
  const holding = (o) => { const hr = o.heroBy, J = hr && hr.job; return !!(J && J.kind === 'alien' && (J.t === o || J.s === o) && !hr.tossed && hr.state === 'fly'); };
  for (const t of I.tripods) {
    if ((t.state === 'held' || t.state === 'hurled') && !holding(t)) { t.heroBy = null; t.rot = null; t.state = 'fall'; t.ft = 0; t.fallA = Math.random() * 6.28; } // it drops and crumples
  }
  for (const s of I.saucers) {
    if (s.state === 'held' && !holding(s)) { s.heroBy = null; s.state = 'cruise'; I.pickTarget(s); } // it gets away
    if (s.state === 'tossed' && !holding(s)) { s.heroBy = null; s.state = 'gone'; s.spaced = true; I.D.ctx.scene.remove(s.obj, s.beam); } // already on its way up: gone
  }
}
