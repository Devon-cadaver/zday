// Disaster TV's director in a level (Sean, 2026-11-15: the fights visible at all times, easy to see what is going on). Each shot is a
// helicopter (or now and then a viewer's rooftop phone) at an angle chosen so the hero and what she fights are both inside the clear part
// of the screen (between the labels at the top and the calls at the bottom) and no building stands between them and the lens. Within a shot
// the helicopter keeps both framed as they move; the moment either is lost (off the frame, or behind a building) for a third of a second it
// cuts to another angle that sees them. The kinds of shot: from the side (both in profile), over the hero's shoulder at what she fights (a
// giant or a storm looming behind her: the forced perspective), over the foe's shoulder at her, high and wide over the town, a viewer's video.
import * as THREE from 'three';

const _v = new THREE.Vector3(), _f = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3(), _d = new THREE.Vector3(), _C = new THREE.Vector3(), _dd = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
const rnd = (a, b) => a + Math.random() * (b - a);
const ORDER = ['side', 'behind', 'side', 'reverse', 'high', 'behind', 'side', 'roof']; // the run of shots, round and round (a viewer's video only sometimes)

// what the camera must see in a level: a (the hero) and b (what she fights), each {x, y, z, h (height), big}; b may be null
export function subjects(tv) { const S = subjects0(tv); if (S && S.b) { const d = Math.hypot(S.b.x - S.a.x, S.b.z - S.a.z); if (d > (S.b.big ? 700 : 260)) S.b = null; else if (S.b.big && d > 90) S.b.far = true; } return S; } // what she fights far off: a storm she is flying at looms behind her (far: only she must be in the shot); a crowd across town, her alone (never a shot from a kilometre up)
function subjects0(tv) {
  const g = tv.g, H = g.horde, F = g.flight, T = g.fightTest, lv = tv.lv; if (!lv) return null;
  if (T.active && T.h && T.v) return { a: { x: T.h.x, y: T.h.y, z: T.h.z, h: 1.9 }, b: { x: T.v.x, y: T.v.y, z: T.v.z, h: 2 }, fight: true };
  if (H.active && H.h) {
    const a = { x: H.h.x, y: H.h.y || 0, z: H.h.z, h: 1.9 * ((H.h.r && H.h.r.root && H.h.r.root.scale.y) || 1) }; let b = null; // drawn bigger from far off (horde.js bigK): the tag over her real head
    const f = H.fl && H.fl.focus ? H.fl.focus() : null, e = H.o.boss && H.o.boss.alive ? H.o.boss : null;
    if (f && Number.isFinite(f.x)) { const s = f.size || f.up || 20; b = { x: f.x, y: 0, z: f.z, h: Math.max(8, s), big: true }; }
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
  constructor(cam) { this.cam = cam; this.tv = cam.tv; this.g = cam.g; this.P = new THREE.Vector3(); this.F = new THREE.Vector3(); this.L = new THREE.Vector3(); this.fov = cam.fov0 || 18; this.shot = null; this.i = 0; this.badT = 0; this.boxT = 0; this.box = null; this.focus = null; }
  reset() { this.shot = null; this.badT = 0; this.i = Math.floor(Math.random() * 3); }

  // the clear part of the screen in NDC, between the labels at the top and the calls and the ticker at the bottom (measured now and then)
  safe() {
    if (this.box && (this.boxT -= 1 / 60) > 0) return this.box; this.boxT = 0.5;
    const H = innerHeight || 636, W = innerWidth || 375, top = 108, tk = document.getElementById('zd-tick'), pin = document.querySelector('#zd-ask .pin'); let bot = H - 150;
    if (tk) { const r = tk.getBoundingClientRect(); if (r.height > 0 && r.top > H * 0.5) bot = r.top - 8; }
    bot -= 100 + (pin && !pin.hidden ? 26 : 0); // the calls' card is up most of the time: always kept clear of it, so the shot does not jump when it comes and goes
    const y0 = 1 - 2 * (top + 26) / H, y1 = 1 - 2 * bot / H, x = 1 - 2 * 22 / W; // the top keeps room for the name tags over their heads
    return (this.box = { y0, y1, x, aspect: W / H });
  }
  // a camera looking down -d at L from D away: where p lands (ndc x, y, depth)
  proj(p, C, fov, aspect) {
    _f.subVectors(this.L, C).normalize(); _r.crossVectors(_f, UP); if (_r.lengthSq() < 1e-6) _r.set(1, 0, 0); _r.normalize(); _u.crossVectors(_r, _f);
    _v.set(p.x - C.x, p.y - C.y, p.z - C.z); const z = _v.dot(_f); if (z < 1) return null; const tv = Math.tan(fov * Math.PI / 360), th = tv * aspect;
    return [_v.dot(_r) / (z * th), _v.dot(_u) / (z * tv), z];
  }
  // the points that must be in the frame: her feet and head; a foe's feet and head (a giant or a storm: its middle and a little more)
  pts(S) {
    const a = S.a, b = S.b, out = [{ x: a.x, y: a.y, z: a.z }, { x: a.x, y: a.y + a.h, z: a.z }], top = this.shot && this.shot.k === 'high' ? 0.78 : 0.5; // a giant: its body in the shot and her big enough to see (the test pass: a speck under its leg); its head too from high and wide
    if (b && !b.far) { if (b.big) { out.push({ x: b.x, y: b.y + b.h * 0.2, z: b.z }, { x: b.x, y: b.y + b.h * top, z: b.z }); } else out.push({ x: b.x, y: b.y, z: b.z }, { x: b.x, y: b.y + b.h, z: b.z }); }
    return out;
  }
  // fit: from direction d (unit, from what is filmed to the lens), the nearest distance and the look point that frame every point inside the
  // clear part, centred in it. A fixed lens position (a rooftop): the narrowest lens that does
  fit(S, d, fov, Dmin, Dmax) {
    const B = this.safe(), pts = this.pts(S), n = pts.length; let lx = 0, ly = 0, lz = 0; for (const p of pts) { lx += p.x; ly += p.y; lz += p.z; } this.L.set(lx / n, ly / n, lz / n);
    const C = _C, ok = (D) => { C.copy(this.L).addScaledVector(d, D); for (const p of pts) { const q = this.proj(p, C, fov, B.aspect); if (!q || Math.abs(q[0]) > B.x || q[1] > B.y0 || q[1] < B.y1) return false; } return true; };
    let D = Dmin;
    for (let it = 0; it < 2; it++) {
      let lo = Dmin, hi = Dmax; if (ok(lo)) hi = lo; else { if (!ok(hi)) return null; for (let k = 0; k < 14; k++) { const m = (lo + hi) / 2; if (ok(m)) hi = m; else lo = m; } } D = hi * 1.06;
      // centre what is framed in the clear part: the box of the points, moved to the middle of it
      C.copy(this.L).addScaledVector(d, D); let x0 = 9, x1 = -9, y0 = 9, y1 = -9, zm = 0; for (const p of pts) { const q = this.proj(p, C, fov, B.aspect); if (!q) continue; x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); zm += q[2] / n; }
      const tv = Math.tan(fov * Math.PI / 360), dx = ((x0 + x1) / 2) * tv * B.aspect * zm, dy = ((y0 + y1) / 2 - (B.y0 + B.y1) / 2) * tv * zm;
      _f.subVectors(this.L, C).normalize(); _r.crossVectors(_f, UP).normalize(); _u.crossVectors(_r, _f); this.L.addScaledVector(_r, dx).addScaledVector(_u, dy);
    }
    return Math.min(Dmax, D);
  }
  // nothing standing between the lens and p (a building, not one she is inside)
  clear(C, p) {
    const c = this.g.city, dx = p.x - C.x, dy = p.y - C.y, dz = p.z - C.z, len = Math.hypot(dx, dy, dz); if (len < 2) return true; const t1 = 1 - 2.5 / len;
    const mx0 = Math.min(C.x, p.x), mx1 = Math.max(C.x, p.x), mz0 = Math.min(C.z, p.z), mz1 = Math.max(C.z, p.z);
    for (let k = 0; k < c.buildings.length; k++) {
      if (c.dead[k]) continue; const b = c.buildings[k]; if (b.x1 < mx0 || b.x0 > mx1 || b.z1 < mz0 || b.z0 > mz1) continue;
      if (p.x > b.x0 && p.x < b.x1 && p.z > b.z0 && p.z < b.z1 && p.y < b.top) continue; // in it (a giant among the blocks)
      let t0 = 0.02, t = t1; const o = [C.x, C.y, C.z], v = [dx, dy, dz], lo = [b.x0, b.baseY, b.z0], hi = [b.x1, b.top, b.z1]; let hit = true;
      for (let i = 0; i < 3 && hit; i++) { if (Math.abs(v[i]) < 1e-6) { if (o[i] < lo[i] || o[i] > hi[i]) hit = false; continue; } let a = (lo[i] - o[i]) / v[i], e = (hi[i] - o[i]) / v[i]; if (a > e) { const s = a; a = e; e = s; } t0 = Math.max(t0, a); t = Math.min(t, e); if (t0 > t) hit = false; }
      if (hit) return false;
    }
    const H = this.g.horde, e = H.active && H.o && H.o.boss; if (e && e.type === 'worm' && e.path) { const ll = len * len; for (let i = 0; i < e.path.length; i += 4) { const q = e.path[i]; if (q.y < -2) continue; const t = ((q.x - C.x) * dx + (q.y - C.y) * dy + (q.z - C.z) * dz) / ll; if (t < 0.02 || t > t1) continue; if (Math.hypot(C.x + dx * t - q.x, C.y + dy * t - q.y, C.z + dz * t - q.z) < 5.5) return false; } } // the worm's body in the way too (the test pass: a shot from inside it)
    return true;
  }
  // is each of them in the clear part and in sight, from C with this lens
  seen(S, C, F, fov) {
    const B = this.safe(), L0 = this.L.clone(); this.L.copy(F); const a = S.a, b = S.b, ha = { x: a.x, y: a.y + a.h * 0.55, z: a.z }, hb = b && !b.far ? { x: b.x, y: b.y + b.h * (b.big ? 0.45 : 0.55), z: b.z } : null;
    const inBox = (p, m = 1) => { const q = this.proj(p, C, fov, B.aspect); return !!q && Math.abs(q[0]) < B.x * m && q[1] < B.y0 + 0.02 && q[1] > B.y1 - 0.02; };
    const r = { a: inBox(ha) && this.clear(C, ha), b: !hb || (inBox(hb, 1.05) && this.clear(C, hb)) };
    { const q = this.proj({ x: a.x, y: a.y + a.h, z: a.z }, C, fov, B.aspect), q0 = this.proj(a, C, fov, B.aspect); r.px = q && q0 ? Math.abs(q[1] - q0[1]) / 2 * (innerHeight || 636) : 0; }
    this.L.copy(L0); return r;
  }
  // a shot of kind k: its direction and lens; null if there is no way to see them from there
  make(k, S, cur) {
    const a = S.a, b = S.b || { x: a.x + 10, y: a.y, z: a.z, h: 1 }, ax = Math.atan2(b.z - a.z, b.x - a.x), big = !!(S.b && S.b.big), fov0 = this.cam.fov0 || 18;
    const az0 = cur ? cur.az : ax + Math.PI / 2; let az, el, fov = fov0, Dmin = big ? 70 : 38, Dmax = big ? 900 : 420;
    if (k === 'side') { const s = Math.cos(az0 - (ax + Math.PI / 2)) > 0 ? 1 : -1; az = ax + s * (Math.PI / 2 + rnd(-0.45, 0.45)); el = rnd(0.42, 0.62); fov = fov0 * rnd(1, 1.25); }
    else if (k === 'behind') { const far = S.b && S.b.far; az = ax + Math.PI + rnd(far ? -0.2 : -0.38, far ? 0.2 : 0.38); el = far ? rnd(0.1, 0.2) : big ? rnd(0.2, 0.34) : rnd(0.32, 0.5); fov = big ? fov0 * rnd(1.6, 2.1) : fov0 * rnd(1.05, 1.3); Dmin = big ? 40 : 34; } // a giant or a storm looming over her shoulder
    else if (k === 'reverse') { if (big) return null; az = ax + rnd(-0.38, 0.38); el = rnd(0.36, 0.55); fov = fov0 * rnd(1.05, 1.3); }
    else if (k === 'high') { az = az0 + rnd(-0.8, 0.8); el = rnd(0.95, 1.15); fov = fov0 * (big ? 1.3 : 1); Dmin = big ? 110 : 70; }
    else if (k === 'top') { az = az0; el = 1.35; fov = fov0 * 1.4; Dmin = 60; Dmax = 1400; }
    else return null;
    return { k, az, el, fov, Dmin, Dmax, drift: (Math.random() < 0.5 ? -1 : 1) * rnd(0.025, 0.05) };
  }
  dir(s, out = _dd) { return out.set(Math.cos(s.el) * Math.cos(s.az), Math.sin(s.el), Math.cos(s.el) * Math.sin(s.az)); }
  // a viewer's rooftop video: a camera that sees both from where it stands, not too far or too near
  roof(S) {
    const cams = this.cam.cams || [], c0 = { x: (S.a.x + (S.b ? S.b.x : S.a.x)) / 2, z: (S.a.z + (S.b ? S.b.z : S.a.z)) / 2 }; let best = null, bs = -1;
    for (const c of cams) { if (c.kind !== 'roof' || !c.alive || this.g.city.dead[c.k]) continue; const dd = Math.hypot(c.x - c0.x, c.z - c0.z); if (dd < 50 || dd > 260) continue; const C = new THREE.Vector3(c.x, c.y, c.z), fov = this.roofFov(S, C); if (!fov) continue; const r = this.seen(S, C, this.L, fov); if (!r.a || !r.b || r.px < 26) continue; if (r.px > bs) { bs = r.px; best = { k: 'roof', cam: c, C, fov }; } }
    return best;
  }
  roofFov(S, C) { const B = this.safe(), pts = this.pts(S); let lx = 0, ly = 0, lz = 0; for (const p of pts) { lx += p.x; ly += p.y; lz += p.z; } this.L.set(lx / pts.length, ly / pts.length, lz / pts.length); const ok = (f) => pts.every((p) => { const q = this.proj(p, C, f, B.aspect); return q && Math.abs(q[0]) < B.x && q[1] < B.y0 && q[1] > B.y1 - 0.3; }); for (let f = 14; f <= 40; f += 2) if (ok(f)) return f + 2; return null; }

  // a new shot: the next kind in the run that sees both of them (several tries at its angle), else any kind that does, else straight down
  cut(S, why) {
    const cur = this.shot, tries = [];
    if (S.b && S.b.far) tries.push('behind', 'behind'); // flying at a storm: it behind her
    for (let j = 0; j < ORDER.length; j++) { const k = ORDER[(this.i + j) % ORDER.length]; if (cur && k === cur.k && why === 'lost') continue; tries.push(k); }
    this.i = (this.i + 1) % ORDER.length; let pick = null;
    for (const k of tries) {
      if (k === 'roof') { if (Math.random() < 0.6 || why === 'lost') continue; const r = this.roof(S); if (r) { pick = r; break; } continue; }
      let best = null, bp = -1; for (let n = 0; n < 5; n++) { const s = this.make(k, S, cur); if (!s) break; const was = this.shot; this.shot = s; const D = this.fit(S, this.dir(s), s.fov, s.Dmin, s.Dmax); this.shot = was; if (D == null) continue; const C = new THREE.Vector3().copy(this.L).addScaledVector(this.dir(s), D), r = this.seen(S, C, this.L, s.fov); if (!r.a || !r.b) continue; if (r.px > bp) { bp = r.px; best = s; } }
      if (best && (bp >= (S.b && S.b.big ? 22 : 26) || k === 'high')) { pick = best; break; }
    }
    if (!pick) pick = this.make('top', S, cur) || { k: 'top', az: 0, el: 1.35, fov: 25, Dmin: 60, Dmax: 1400, drift: 0 };
    pick.t = 0; pick.T = pick.k === 'roof' ? rnd(4, 6) : pick.k === 'high' ? rnd(3.5, 5) : rnd(5, 8.5); this.shot = pick; this.badT = 0; this.snap = true;
    this.cam.onShot(pick); // the label: which helicopter, or the viewer's video
  }

  // each frame: keep them framed, and cut when they are lost or the shot has run its time
  step(dt) {
    const S = subjects(this.tv); if (!S || !Number.isFinite(S.a.x)) return false; this.S = S;
    if (!this.shot) this.cut(S, 'start');
    let s = this.shot; s.t += dt;
    if (s.t > s.T) { this.cut(S, 'time'); s = this.shot; }
    let C, F, fov;
    if (s.k === 'roof') { if (!s.cam.alive || this.g.city.dead[s.cam.k]) { this.cut(S, 'lost'); return true; } C = s.C; fov = this.roofFov(S, C) || s.fov; F = this.L.clone(); s.fov = fov; }
    else { s.az += s.drift * dt; const d = this.dir(s, new THREE.Vector3()); let D = this.fit(S, d, s.fov, s.Dmin, s.Dmax); if (D == null) D = s.Dmax; F = this.L.clone(); C = F.clone().addScaledVector(d, D); fov = s.fov; }
    // eased into place, quicker when one of them is near the edge (a fighter flung across the street)
    const r0 = this.seen(S, this.P, this.F, this.fov), k = this.snap ? 1 : 1 - Math.exp(-dt * (r0.a && r0.b ? 3.2 : 11));
    this.snap = false; this.P.lerp(C, k); this.F.lerp(F, k); this.fov += (fov - this.fov) * k;
    if (s.k !== 'roof') { this.P.x += Math.sin(this.tv.t * 0.6) * 0.04; this.P.y += Math.sin(this.tv.t * 0.9) * 0.03; } // a helicopter: never quite still
    // lost (off the clear part, or behind a building) a third of a second: cut
    const r = this.seen(S, this.P, this.F, this.fov); this.vis = r; this.badT = r.a && r.b ? Math.max(0, this.badT - dt * 2) : this.badT + dt;
    if (this.badT > 0.32 && s.t > 0.6) this.cut(S, 'lost');
    // the depth of field across both of them: sharp from her to it, the town behind soft
    { const da = this.P.distanceTo(_v.set(S.a.x, S.a.y + 1, S.a.z)), db = S.b ? this.P.distanceTo(_v.set(S.b.x, S.b.y + S.b.h * 0.45, S.b.z)) : da, f = (da + db) / 2, half = Math.abs(da - db) / 2 + (S.b && S.b.big ? S.b.h * 0.4 : 3); this.focus = { d: f, bandK: Math.min(0.45, Math.max(0.1, half / f)), rangeK: Math.min(1.2, Math.max(0.3, half / f * 2.5 + 0.2)) }; }
    return true;
  }
}
