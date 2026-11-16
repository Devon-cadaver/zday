// Disaster TV's director in a level (Sean, 2026-11-15: the fights visible at all times, easy to see what is going on; then "the camera angles in
// disaster tv should always stay up in the air, from a helicopter view. If the angle has the show the hero through something, the angle should
// change to see him better"). Every shot is a helicopter, up over the roofs: well above the tallest building round the fighters and under the
// lens, and above a giant's head (a shot that would sit lower climbs until it is clear). Its angle is chosen so the hero and what she fights
// are both inside the clear part of the screen (between the labels at the top and the calls at the bottom) with nothing between them and the
// lens: no building, nor the kaiju's or a golem's body, the worm's, or the tornado's funnel. Within a shot the helicopter keeps both framed as
// they move; the moment she is hidden it swings round or climbs to where she is in plain view (within a fifth of a second, and on the same way
// round, so it does not swing back into what hid her), and only cuts to another angle if no swing or climb sees her. The foe is kept in the
// shot too where it can be; seeing her comes first. The kinds of shot: from the side (both in profile), over her shoulder at what she fights
// (a giant or a storm looming beyond her), over the foe's shoulder at her, high and wide over the town.
import * as THREE from 'three';

const _v = new THREE.Vector3(), _f = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3(), _C = new THREE.Vector3(), _dd = new THREE.Vector3(), _pc = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
const rnd = (a, b) => a + Math.random() * (b - a);
const ORDER = ['side', 'behind', 'side', 'reverse', 'high', 'behind', 'side', 'high']; // the run of shots, round and round (no rooftop videos any more: Sean, always a helicopter)
const LIFT = 20; // m: how far over the roofs round the fight (and under the lens), and over a giant's head, the helicopter stays (12 read as low along the fronts: the test pass)
// a swing or a climb from the shot as it is, nearest first: [round by, up by] (radians)
const SWINGS = [[0, 0.15], [0.35, 0], [-0.35, 0], [0.35, 0.15], [-0.35, 0.15], [0, 0.32], [0.7, 0.1], [-0.7, 0.1], [1.05, 0.2], [-1.05, 0.2], [1.5, 0.3], [-1.5, 0.3]];

// what the camera must see in a level: a (the hero) and b (what she fights), each {x, y, z, h (height), big}; b may be null
export function subjects(tv) { const S = subjects0(tv); if (S && S.b) { const d = Math.hypot(S.b.x - S.a.x, S.b.z - S.a.z); if (d > (S.b.big ? 700 : 260)) S.b = null; else if (S.b.big && d > 90) S.b.far = true; } return S; } // what she fights far off: a storm she is flying at looms behind her (far: only she must be in the shot); a crowd across town, her alone (never a shot from a kilometre up)
function subjects0(tv) {
  const g = tv.g, H = g.horde, F = g.flight, T = g.fightTest, lv = tv.lv; if (!lv) return null;
  if (T.active && T.h && T.v) return { a: { x: T.h.x, y: T.h.y, z: T.h.z, h: 1.9 }, b: { x: T.v.x, y: T.v.y, z: T.v.z, h: 2 }, fight: true };
  if (H.active && H.h) {
    const a = { x: H.h.x, y: H.h.y || 0, z: H.h.z, h: 1.9 * ((H.h.r && H.h.r.root && H.h.r.root.scale.y) || 1) }; let b = null; // drawn bigger from far off (horde.js bigK): the tag over her real head
    const f = H.fl && H.fl.focus ? H.fl.focus() : null, e = H.o.boss && H.o.boss.alive ? H.o.boss : null;
    if (f && Number.isFinite(f.x)) { const q = H.fl.giants && H.fl.giants.find((q) => q.alive && Math.abs(q.x - f.x) < 0.01 && Math.abs(q.z - f.z) < 0.01), s = (q && q.size) || f.size || (f.up ? f.up / 0.45 : 20); b = { x: f.x, y: 0, z: f.z, h: Math.max(8, s), big: true }; } // its real height (focus() gives the camera's aim, 0.45 of it): the helicopter over its head
    else if (e) { if (e.type === 'worm') { const q = H.bossPt ? H.bossPt() : null; b = q ? { x: q[0], y: 0, z: q[1], h: 14, big: true } : { x: e.x, y: 0, z: e.z, h: 10, big: true }; } else b = { x: e.x, y: 0, z: e.z, h: e.type === 'kaiju' ? 40 : 16, big: true }; }
    else { const n = H.nearest ? H.nearest(80) : null, g0 = !n && (H.gens || []).find((q) => !q.gone && q.ground && Number.isFinite(q.x)); if (n) b = { x: n[0], y: a.y, z: n[1], h: 1.9, crowd: true }; else if (g0) b = { x: g0.x, y: a.y, z: g0.z, h: 2 }; else if (H.o.fleet && H.footNear) { const q = H.footNear(120); if (q) b = { x: q[0], y: 0, z: q[1], h: 20, big: true }; } } // the mob gone: the next instigator she is going for
    return { a, b };
  }
  if (F.active && F.pos) {
    const k = (F.obj && F.obj.scale && F.obj.scale.y) || 1, a = { x: F.pos.x, y: F.pos.y - k, z: F.pos.z, h: 1.9 * k }, L = F.live; let b = null; // flight.js bigK the same
    if (L && L.drain && Number.isFinite(L.px)) b = { x: L.px, y: L.py - 1, z: L.pz, h: 2.2 }; // the man with the hose
    else if (L && L.at && Number.isFinite(L.at.x) && (L.at.x || L.at.z)) b = { x: L.at.x, y: L.at.y - 9, z: L.at.z, h: 18, big: true }; // the storm's face
    else if (lv.ev0 && lv.ev0.tw) b = { x: lv.ev0.tw.x, y: 0, z: lv.ev0.tw.z, h: 60, big: true };
    return { a, b };
  }
  return null;
}


export class Director {
  constructor(cam) { this.cam = cam; this.tv = cam.tv; this.g = cam.g; this.P = new THREE.Vector3(); this.F = new THREE.Vector3(); this.L = new THREE.Vector3(); this.fov = cam.fov0 || 18; this.shot = null; this.i = 0; this.badT = 0; this.badB = 0; this.boxT = 0; this.box = null; this.focus = null; this.swing = 0; }
  reset() { this.shot = null; this.badT = 0; this.badB = 0; this.i = Math.floor(Math.random() * 3); }

  // the clear part of the screen in NDC, between the labels at the top and the calls and the ticker at the bottom (measured now and then)
  safe() {
    if (this.box && (this.boxT -= 1 / 60) > 0) return this.box; this.boxT = 0.5;
    const H = innerHeight || 636, W = innerWidth || 375, top = 108, tk = document.getElementById('zd-tick'), pin = document.querySelector('#zd-ask .pin'); let bot = H - 150;
    if (tk) { const r = tk.getBoundingClientRect(); if (r.height > 0 && r.top > H * 0.5) bot = r.top - 8; }
    bot -= 100 + (pin && !pin.hidden ? 26 : 0); // the calls' card is up most of the time: always kept clear of it, so the shot does not jump when it comes and goes
    const y0 = 1 - 2 * (top + 26) / H, y1 = 1 - 2 * bot / H, x = 1 - 2 * 22 / W; // the top keeps room for the name tags over their heads
    return (this.box = { y0, y1, x, aspect: W / H });
  }
  // a camera at C looking at L: where p lands (ndc x, y, depth)
  proj(p, C, fov, aspect) {
    _f.subVectors(this.L, C).normalize(); _r.crossVectors(_f, UP); if (_r.lengthSq() < 1e-6) _r.set(1, 0, 0); _r.normalize(); _u.crossVectors(_r, _f);
    _v.set(p.x - C.x, p.y - C.y, p.z - C.z); const z = _v.dot(_f); if (z < 1) return null; const tv = Math.tan(fov * Math.PI / 360), th = tv * aspect;
    return [_v.dot(_r) / (z * th), _v.dot(_u) / (z * tv), z];
  }
  // the points that must be in the frame: her feet and head; a foe's feet and head (a giant or a storm: its body)
  pts(S) {
    const a = S.a, b = S.b, out = [{ x: a.x, y: a.y, z: a.z }, { x: a.x, y: a.y + a.h, z: a.z }], top = this.shot && this.shot.k === 'high' ? 0.78 : 0.5; // a giant: its body in the shot and her big enough to see (the test pass: a speck under its leg); its head too from high and wide
    if (b && !b.far) { if (b.big) { out.push({ x: b.x, y: b.y + b.h * 0.2, z: b.z }, { x: b.x, y: b.y + b.h * top, z: b.z }); } else out.push({ x: b.x, y: b.y, z: b.z }, { x: b.x, y: b.y + b.h, z: b.z }); }
    return out;
  }
  // fit: from direction d (unit, from what is filmed to the lens), the nearest distance and the look point (this.L) that frame every point
  // inside the clear part, centred in it
  fit(S, d, fov, Dmin, Dmax) {
    const B = this.safe(), pts = this.pts(S), n = pts.length; let lx = 0, ly = 0, lz = 0; for (const p of pts) { lx += p.x; ly += p.y; lz += p.z; } this.L.set(lx / n, ly / n, lz / n);
    const C = _C, ok = (D) => { C.copy(this.L).addScaledVector(d, D); for (const p of pts) { const q = this.proj(p, C, fov, B.aspect); if (!q || Math.abs(q[0]) > B.x || q[1] > B.y0 || q[1] < B.y1) return false; } return true; };
    let D = Dmin;
    for (let it = 0; it < 2; it++) {
      let lo = Dmin, hi = Dmax; if (ok(lo)) hi = lo; else { if (!ok(hi)) return null; for (let k = 0; k < 14; k++) { const m = (lo + hi) / 2; if (ok(m)) hi = m; else lo = m; } } D = hi * 1.06;
      C.copy(this.L).addScaledVector(d, D); let x0 = 9, x1 = -9, y0 = 9, y1 = -9, zm = 0; for (const p of pts) { const q = this.proj(p, C, fov, B.aspect); if (!q) continue; x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); zm += q[2] / n; }
      const tv = Math.tan(fov * Math.PI / 360), dx = ((x0 + x1) / 2) * tv * B.aspect * zm, dy = ((y0 + y1) / 2 - (B.y0 + B.y1) / 2) * tv * zm;
      _f.subVectors(this.L, C).normalize(); _r.crossVectors(_f, UP).normalize(); _u.crossVectors(_r, _f); this.L.addScaledVector(_r, dx).addScaledVector(_u, dy);
    }
    return Math.min(Dmax, D);
  }
  // the tallest standing building within R of (x, z): its roof
  roofAt(x, z, R) { const c = this.g.city; let top = 0; c.buildingsNear(x, z, R, (k, d, b) => { if (!c.dead[k] && b.top > top) top = b.top; }); return top; }
  // how high the helicopter at C must be: over the roofs round her and under it, over a giant's head near her, and above her (a flyer looked down on)
  floorFor(S, C) {
    const a = S.a, b = S.b; let f = Math.max(this.roofAt(a.x, a.z, 40), this.roofAt(C.x, C.z, 40));
    if (b && b.big && !b.far && b.h < 70 && Math.hypot(b.x - a.x, b.z - a.z) < 90) f = Math.max(f, b.y + b.h);
    for (const q of this.shapes()) { if (q.f) continue; const top = q.top || (q.c ? q.y1 : q.y + q.r); if (Math.hypot(C.x - q.x, C.z - q.z) < q.r + 25) f = Math.max(f, top); } // never alongside a giant's body (the test pass: a frame full of the worm's or the kaiju's scales)
    return Math.max(f + LIFT, a.y + a.h + 6);
  }
  dir(s, out = _dd) { return out.set(Math.cos(s.el) * Math.cos(s.az), Math.sin(s.el), Math.cos(s.el) * Math.sin(s.az)); }
  // where shot s puts the lens: fitted, and climbed (its angle raised) until it is over the floor; null if they cannot be framed from that side
  place(S, s) {
    const was = this.shot; this.shot = s;
    try { for (let i = 0; i < 14; i++) { const d = this.dir(s), D = this.fit(S, d, s.fov, s.Dmin, s.Dmax); if (D == null) return null; const C = _pc.copy(this.L).addScaledVector(d, D); if (C.y >= this.floorFor(S, C) - 0.5 || s.el >= 1.42) return { C: C.clone(), F: this.L.clone(), D }; s.el = Math.min(1.42, s.el + 0.08); } return null; }
    finally { this.shot = was; }
  }
  // what can stand between the lens and her besides the buildings: the kaiju's body, a golem's, the worm's, the tornado's funnel (once a frame)
  shapes() {
    if (this.shpT === this.tv.t && this.shp) return this.shp; const H = this.g.horde, L = []; this.shpT = this.tv.t; this.shp = L;
    if (H.active && H.o) { const e = H.o.boss; if (e && e.alive && e.type === 'kaiju') L.push({ c: 1, x: e.x, z: e.z, r: 8, y0: 15, y1: 38, top: 54 }); if (e && e.type === 'worm' && e.path) for (let i = 0; i < e.path.length; i += 4) { const q = e.path[i]; if (q.y > -2) L.push({ s: 1, x: q.x, y: q.y, z: q.z, r: 5.5 }); } if (H.fl) for (const q of H.fl.giants) if (q.alive && q.state !== 'crumble') L.push({ c: 1, x: q.x, z: q.z, r: q.size * 0.16, y0: 0, y1: q.size * 0.9 }); } // its body over its legs (under it she is seen between them, from far enough off); its tentacles reach to 54 m: the helicopter stays over them
    const ev = this.tv.lv && this.tv.lv.ev0, tw = ev && ev.tw; if (tw && tw.radiusAt && tw.phase !== 'gone' && tw.H) L.push({ f: 1, tw, x: tw.x, z: tw.z });
    return L;
  }
  inShape(s, p) { if (s.c) return p.y > s.y0 && p.y < s.y1 && (p.x - s.x) ** 2 + (p.z - s.z) ** 2 < s.r * s.r; if (s.s) return (p.x - s.x) ** 2 + (p.y - s.y) ** 2 + (p.z - s.z) ** 2 < s.r * s.r; if (s.f) { if (p.y <= 0 || p.y >= s.tw.H) return false; const r = s.tw.radiusAt(p.y) * 0.8; return (p.x - s.x) ** 2 + (p.z - s.z) ** 2 < r * r; } return false; }
  // nothing standing between the lens and p (a building, a giant, the funnel; not one p is inside)
  clear(C, p, own) {
    const c = this.g.city, dx = p.x - C.x, dy = p.y - C.y, dz = p.z - C.z, len = Math.hypot(dx, dy, dz); if (len < 2) return true; const t1 = 1 - 2.5 / len;
    const mx0 = Math.min(C.x, p.x), mx1 = Math.max(C.x, p.x), mz0 = Math.min(C.z, p.z), mz1 = Math.max(C.z, p.z);
    for (let k = 0; k < c.buildings.length; k++) {
      if (c.dead[k]) continue; const b = c.buildings[k]; if (b.x1 < mx0 || b.x0 > mx1 || b.z1 < mz0 || b.z0 > mz1) continue;
      if (p.x > b.x0 && p.x < b.x1 && p.z > b.z0 && p.z < b.z1 && p.y < b.top) continue; // in it (a giant among the blocks)
      let t0 = 0.02, t = t1; const o = [C.x, C.y, C.z], v = [dx, dy, dz], lo = [b.x0, b.baseY, b.z0], hi = [b.x1, b.top, b.z1]; let hit = true;
      for (let i = 0; i < 3 && hit; i++) { if (Math.abs(v[i]) < 1e-6) { if (o[i] < lo[i] || o[i] > hi[i]) hit = false; continue; } let a = (lo[i] - o[i]) / v[i], e = (hi[i] - o[i]) / v[i]; if (a > e) { const s = a; a = e; e = s; } t0 = Math.max(t0, a); t = Math.min(t, e); if (t0 > t) hit = false; }
      if (hit) return false;
    }
    const L = own ? this.shapes().filter((s) => !this.inShape(s, p)) : this.shapes(); if (!L.length) return true;
    for (let i = 1; i < 40; i++) { const u = i / 40; if (u > t1) break; const q = { x: C.x + dx * u, y: C.y + dy * u, z: C.z + dz * u }; for (const s of L) if (this.inShape(s, q)) return false; }
    return true;
  }
  // is each of them in the clear part and in plain view from C looking at F with this lens: her middle and her head both seen; its body
  seen(S, C, F, fov) {
    const B = this.safe(), L0 = this.L.clone(); this.L.copy(F); const a = S.a, b = S.b, ha = { x: a.x, y: a.y + a.h * 0.55, z: a.z }, hh = { x: a.x, y: a.y + a.h, z: a.z }, hb = b && !b.far ? { x: b.x, y: b.y + b.h * (b.big ? 0.45 : 0.55), z: b.z } : null;
    const inBox = (p, m = 1) => { const q = this.proj(p, C, fov, B.aspect); return !!q && Math.abs(q[0]) < B.x * m && q[1] < B.y0 + 0.02 && q[1] > B.y1 - 0.02; };
    const r = { a: inBox(ha) && this.clear(C, ha) && this.clear(C, hh), b: !hb || (inBox(hb, 1.05) && this.clear(C, hb, true)) };
    { const q = this.proj(hh, C, fov, B.aspect), q0 = this.proj(a, C, fov, B.aspect); r.px = q && q0 ? Math.abs(q[1] - q0[1]) / 2 * (innerHeight || 636) : 0; }
    this.L.copy(L0); return r;
  }
  // a shot of kind k: its direction and lens; null if that kind does not suit what she fights
  make(k, S, cur) {
    const a = S.a, b = S.b || { x: a.x + 10, y: a.y, z: a.z, h: 1 }, ax = Math.atan2(b.z - a.z, b.x - a.x), big = !!(S.b && S.b.big), fov0 = this.cam.fov0 || 18;
    const az0 = cur ? cur.az : ax + Math.PI / 2; let az, el, fov = fov0, Dmin = big ? 100 : 42, Dmax = big ? 900 : 420;
    if (k === 'side') { const s = Math.cos(az0 - (ax + Math.PI / 2)) > 0 ? 1 : -1; az = ax + s * (Math.PI / 2 + rnd(-0.45, 0.45)); el = rnd(0.55, 0.8); fov = fov0 * rnd(1, 1.25); }
    else if (k === 'behind') { const far = S.b && S.b.far; az = ax + Math.PI + rnd(far ? -0.2 : -0.38, far ? 0.2 : 0.38); el = far ? rnd(0.3, 0.42) : big ? rnd(0.42, 0.6) : rnd(0.5, 0.7); fov = big ? fov0 * rnd(1.6, 2.1) : fov0 * rnd(1.05, 1.3); Dmin = big ? 75 : 38; } // a giant or a storm beyond her, from up over her shoulder
    else if (k === 'reverse') { if (big) return null; az = ax + rnd(-0.38, 0.38); el = rnd(0.55, 0.75); fov = fov0 * rnd(1.05, 1.3); }
    else if (k === 'high') { az = az0 + rnd(-0.8, 0.8); el = rnd(0.95, 1.15); fov = fov0 * (big ? 1.3 : 1); Dmin = big ? 140 : 70; }
    else if (k === 'top') { az = az0; el = 1.35; fov = fov0 * 1.4; Dmin = 60; Dmax = 1400; }
    else return null;
    return { k, az, el, fov, Dmin, Dmax, drift: (Math.random() < 0.5 ? -1 : 1) * rnd(0.025, 0.05) };
  }
  // a new shot: the next kind in the run that sees her in plain view (and the foe, where it can), else straight down
  cut(S, why) {
    const cur = this.shot, tries = [];
    if (S.b && S.b.far) tries.push('behind', 'behind'); // flying at a storm: it beyond her
    for (let j = 0; j < ORDER.length; j++) { const k = ORDER[(this.i + j) % ORDER.length]; if (cur && k === cur.k && why === 'lost') continue; tries.push(k); }
    this.i = (this.i + 1) % ORDER.length; let pick = null, herOnly = null, hp = -1;
    for (const k of tries) {
      let best = null, bp = -1; for (let n = 0; n < 5; n++) { const s = this.make(k, S, cur); if (!s) break; const pl = this.place(S, s); if (!pl) continue; const r = this.seen(S, pl.C, pl.F, s.fov); if (!r.a) continue; if (!r.b) { if (r.px > hp) { hp = r.px; herOnly = s; } continue; } if (r.px > bp) { bp = r.px; best = s; } }
      if (best && (bp >= (S.b && S.b.big ? 20 : 24) || k === 'high')) { pick = best; break; }
    }
    if (!pick) pick = herOnly || this.make('top', S, cur) || { k: 'top', az: 0, el: 1.35, fov: 25, Dmin: 60, Dmax: 1400, drift: 0 }; // her in plain view comes first
    pick.t = 0; pick.T = pick.k === 'high' ? rnd(3.5, 5) : rnd(5, 8.5); this.shot = pick; this.badT = 0; this.badB = 0; this.snap = true;
    this.cam.onShot(pick); // the label: which helicopter
  }
  // she is hidden (or the foe has been out of the shot a while): the nearest swing round or climb from here that sees her, on the way it was
  // already going round (so it does not swing back into what hid her); false if none does
  repair(S, s, needB) {
    let best = null, bs = -1e9; const dr = s.drift >= 0 ? 1 : -1;
    const tryT = (t, da, cost) => { const pl = this.place(S, t); if (!pl) return; const r = this.seen(S, pl.C, pl.F, t.fov); if (!r.a || (needB && !r.b)) return; const sc = (r.b ? 2 : 0) - cost; if (sc > bs) { bs = sc; best = { t, da }; } };
    for (const [da, de] of SWINGS) tryT({ ...s, az: s.az + da * dr, el: Math.min(1.42, s.el + de) }, da, Math.abs(da) * 0.8 + de * 0.6);
    if (!best) { const fl = this.floorFor(S, S.a) - S.a.y; for (const [da, k] of [[0, 2], [0.35, 2], [-0.35, 2], [0, 3.2], [0.7, 3.2], [-0.7, 3.2]]) { const D = Math.max(s.Dmin, 90) * k; tryT({ ...s, az: s.az + da * dr, el: Math.max(0.1, Math.asin(Math.min(1, fl / D))), Dmin: D, Dmax: Math.max(s.Dmax, D * 1.5) }, da, 1.5 + Math.abs(da) * 0.8 + k * 0.3); } } // nothing near sees her (under a giant's body): further off and lower, in under it, still over the roofs
    if (!best) return false;
    s.az = best.t.az; s.el = best.t.el; if (best.da) s.drift = Math.abs(s.drift) * Math.sign(best.da * dr); this.swing = 0.45; this.badT = 0; this.badB = 0; return true;
  }

  // each frame: keep them framed from up in the air, and swing, climb or cut when she is hidden or the shot has run its time
  step(dt) {
    const S = subjects(this.tv); if (!S || !Number.isFinite(S.a.x)) return false; this.S = S;
    if (!this.shot) this.cut(S, 'start');
    let s = this.shot; s.t += dt;
    if (s.t > s.T) { this.cut(S, 'time'); s = this.shot; }
    s.az += s.drift * dt;
    let pl = this.place(S, s); if (!pl) { this.cut(S, 'lost'); s = this.shot; pl = this.place(S, s); }
    if (!pl) { const fl = this.floorFor(S, this.P); if (this.P.y < fl) this.P.y += (fl - this.P.y) * Math.min(1, dt * 6); this.F.lerp(_v.set(S.a.x, S.a.y + 1, S.a.z), Math.min(1, dt * 4)); return true; } // nothing frames them just now: up over the roofs, eyes on her
    // where the lens is going: she hidden from there a fifth of a second (the foe, a second and a half), a swing or a climb; none sees her, a cut
    const rT = this.seen(S, pl.C, pl.F, s.fov); this.badT = rT.a ? 0 : this.badT + dt; this.badB = rT.a && !rT.b ? this.badB + dt : 0;
    if (this.badT > 0.2 && s.t > 0.25) { if (!this.repair(S, s, false)) this.cut(S, 'lost'); s = this.shot; pl = this.place(S, s) || pl; }
    else if (this.badB > 1.5) { if (!this.repair(S, s, true)) this.badB = 0; else pl = this.place(S, s) || pl; }
    // eased there: quick while swinging out of a hiding place; a cut is a cut
    const k = this.snap ? 1 : 1 - Math.exp(-dt * (this.vis && !this.vis.a ? 11 : this.swing > 0 ? 7 : 3.2)); this.swing -= dt; // quick when she is not in plain view now (a dive, a throw across the street)
    this.snap = false; this.P.lerp(pl.C, k); this.F.lerp(pl.F, k); this.fov += (s.fov - this.fov) * k;
    { const fl = this.floorFor(S, this.P); if (this.P.y < fl) this.P.y = fl; } // never under the roofs, even on the way
    this.P.x += Math.sin(this.tv.t * 0.6) * 0.04; this.P.y += Math.sin(this.tv.t * 0.9) * 0.03; // a helicopter: never quite still
    this.vis = this.seen(S, this.P, this.F, this.fov);
    // the depth of field across both of them: sharp from her to it, the town behind soft
    { const da = this.P.distanceTo(_v.set(S.a.x, S.a.y + 1, S.a.z)), db = S.b ? this.P.distanceTo(_v.set(S.b.x, S.b.y + S.b.h * 0.45, S.b.z)) : da, f = (da + db) / 2, half = Math.abs(da - db) / 2 + (S.b && S.b.big ? S.b.h * 0.4 : 3); this.focus = { d: f, bandK: Math.min(0.45, Math.max(0.1, half / f)), rangeK: Math.min(1.2, Math.max(0.3, half / f * 2.5 + 0.2)) }; }
    return true;
  }
}
