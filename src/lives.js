// Lives: every civilian has a home and most have a job, a personality, and a day
// to get through. Out of the door in the morning and along the pavements to work,
// in through its door; out at lunch to a park or a square where people gather;
// errands at the shops; home in the evening; strolling round their own block in
// between. What they do next is weighed from the hour, their job and their
// character (fear, greed, loyalty, curiosity, bravery, sociability), with a little
// chance in it. Indoors they are hidden but still there: a building that falls or
// burns has them inside. While a disaster is on nobody sets out on an errand; they
// react as before (deciding what to do about it is the next step).
import { ARCHETYPES } from './figures.js';
import { RW, SW } from './city.js';

export const TRAITS = ['fear', 'greed', 'loyal', 'curious', 'brave', 'social'];
// how each kind of person leans (added to an even 0.5, then a personal spread)
const BIAS = {
  casual: {}, business: { greed: 0.3, social: 0.05 }, construction: { brave: 0.3, fear: -0.2 }, nurse: { loyal: 0.3, brave: 0.2 },
  student: { curious: 0.3, social: 0.25 }, homeless: { fear: 0.1, greed: 0.15, social: -0.1 }, shopper: { greed: 0.25, social: 0.2 },
  traveler: { curious: 0.35 }, offduty: { brave: 0.35, loyal: 0.25, fear: -0.25 },
};
// where each kind works: offices (tall), a building site (anywhere), a clinic or a school (the big ones); shoppers,
// travellers, off-duty officers and the homeless have no job, and some casual people none either
const JOB = { business: 'office', construction: 'any', nurse: 'big', student: 'big', casual: 'any' };
const WORK = 1, HOME = 2, SHOP = 3, HANG = 4;

export class Lives {
  constructor(P, S, KIND) {
    this.P = P; this.S = S; this.KIND = KIND;
    const N = P.N, U8 = () => new Uint8Array(N);
    this.home = new Int32Array(N).fill(-1); this.work = new Int32Array(N).fill(-1); this.arch = U8(); this.done = U8();
    this.nextT = new Float32Array(N); this.t = {}; for (const k of TRAITS) this.t[k] = U8();
    this.trips = new Map(); this.cur = 0; this.lastHour = 8;
    this.off = RW / 2 + SW * 0.55; // the middle of the pavement, from the street's centre line
  }

  // a new day for everyone: homes, jobs and characters (the same every time for this place)
  reset(seed) {
    const P = this.P, bl = P.bld; let s = (seed * 7919 + 13) % 2147483647 || 1; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    this.trips.clear(); this.done.fill(0); this.cur = 0;
    // the buildings: any with a street door; offices are the tall ones; the big ones are clinics and schools; shops are low
    const all = [], office = [], big = [], shop = [];
    bl.forEach((b, k) => { if (!b.door || !b.roof) return; all.push(k); const h = b.roofY - b.baseY; if (h >= 15) office.push(k); if (h <= 11) shop.push(k); });
    const area = (k) => (bl[k].x1 - bl[k].x0) * (bl[k].z1 - bl[k].z0);
    big.push(...[...all].sort((a, c) => area(c) - area(a)).slice(0, Math.max(3, Math.floor(all.length * 0.08))));
    this.pools = { any: all, office: office.length ? office : all, big, shop: shop.length ? shop : all };
    // homes: a building on the block they walk round, else the nearest
    const near = (x, z, list) => { let bk = -1, bd = 1e18; for (const k of list) { const d = (bl[k].door[0] - x) ** 2 + (bl[k].door[1] - z) ** 2; if (d < bd) { bd = d; bk = k; } } return bk; };
    const perBlock = P.blocks.map(bb => all.filter(k => { const d = bl[k].door; return d[0] > bb.x0 - 3 && d[0] < bb.x1 + 3 && d[1] > bb.z0 - 3 && d[1] < bb.z1 + 3; }));
    for (let i = 0; i < P.nHuman; i++) {
      const A = ARCHETYPES[this.arch[i]] || ARCHETYPES[0], id = A.id, b = BIAS[id] || {};
      for (const k of TRAITS) this.t[k][i] = Math.max(0, Math.min(255, Math.round((0.5 + (b[k] || 0) + (r() - 0.5) * 0.6) * 255)));
      const blkList = i < P.nWalk ? perBlock[P.blk[i]] : null;
      this.home[i] = id === 'homeless' ? -1 : id === 'traveler' ? this.pick(this.pools.office, P.x[i], P.z[i], 40, 260, r) : blkList && blkList.length ? blkList[Math.floor(r() * blkList.length)] : near(P.x[i], P.z[i], all);
      const job = JOB[id], employed = job && (id !== 'casual' || r() < 0.6);
      this.work[i] = employed ? this.pick(this.pools[job], P.x[i], P.z[i], 50, 230, r) : -1;
      this.nextT[i] = r() * 90; // a staggered start to the day
    }
  }
  // a building from a pool, preferably between d0 and d1 metres from (x, z)
  pick(list, x, z, d0, d1, r) {
    if (!list.length) return -1;
    const bl = this.P.bld; let best = list[Math.floor(r() * list.length)], bs = 1e9;
    for (let n = 0; n < 10; n++) {
      const k = list[Math.floor(r() * list.length)], d = Math.hypot(bl[k].door[0] - x, bl[k].door[1] - z), sc = d < d0 ? d0 - d : d > d1 ? d - d1 : 0;
      if (sc < bs) { bs = sc; best = k; if (!sc) break; }
    }
    return best;
  }
  trait(k, i) { return this.t[k][i] / 255; }

  // a slice of the strollers each beat: everyone gets a think about every two seconds (the crowds in the parks and
  // squares too: now and then one of them wanders off into their day, while others come and hang about)
  tick() {
    const P = this.P, S = this.S, n = P.nHuman, per = Math.ceil(n / 8), calm = !P.danger && !(P.alarmT > 0);
    if (this.lastHour < 4 && P.hour >= 4) this.done.fill(0); // a new working day
    this.lastHour = P.hour;
    if (!calm) return;
    for (let c = 0; c < per; c++) {
      const i = this.cur; this.cur = (this.cur + 1) % n;
      if (P.inf[i] || P.kind[i] !== this.KIND.CIVILIAN || P.lvl[i] !== -1 || P.time < this.nextT[i]) continue;
      if (P.st[i] === S.WALK) this.decide(i, false);
      else if (P.st[i] === S.IDLE && i >= P.nWalk && P.r() < 0.008) this.decide(i, true); // one of a crowd off on an errand (they come back to their spot)
    }
  }
  // what next: each choice scored from the hour and who they are (utility), a little chance in it, the best one taken.
  // out: they have just come out of a door (no strolling on from there: back to their block)
  decide(i, out) {
    const P = this.P, H = P.hour, r = () => P.r(), tr = (k) => this.t[k][i] / 255;
    if (!out && r() > 0.4) { this.nextT[i] = P.time + 6 + r() * 10; return; } // most of the time: on round the block a bit longer (the streets stay busy)
    const night = H >= 21 || H < 6, workH = H >= 7.5 && H < 17, lunch = H >= 11.5 && H < 13.5, evening = H >= 17 && H < 21;
    const w = this.work[i], hm = this.home[i];
    const U = {
      work: w >= 0 && workH && !this.done[i] ? 1.0 + tr('greed') * 0.4 : 0,
      home: hm >= 0 ? (night ? 1.0 : evening ? 0.55 : 0.12) + (1 - tr('social')) * 0.25 : 0,
      hang: (lunch ? 0.85 : evening ? 0.6 : night ? 0.15 : 0.3) * (0.4 + tr('social')) + tr('curious') * 0.1 + (i >= P.nWalk ? 0.6 : 0), // a crowd's regulars go back to it
      shop: (H >= 8 && H < 20 ? 0.38 : 0.02) * (0.5 + tr('greed')),
      stroll: out ? 0.5 : 0.42 + tr('curious') * 0.3,
    };
    let best = 'stroll', bv = -1;
    for (const k in U) { const v = U[k] > 0 ? U[k] + r() * 0.35 : -1; if (v > bv) { bv = v; best = k; } }
    const T = () => P.r();
    if (best === 'work') return this.go(i, WORK, w, 45 + T() * 45);
    if (best === 'home') return this.go(i, HOME, hm, night ? 60 + T() * 60 : 25 + T() * 25);
    if (best === 'shop') return this.go(i, SHOP, this.pick(this.pools.shop, P.x[i], P.z[i], 30, 170, T), 10 + T() * 15);
    if (best === 'hang') { // a park or a square where people gather (a regular: their own spot in its crowd)
      if (i >= P.nWalk) { const c = P.crowdPts[i - P.nWalk]; return this.go(i, HANG, -1, 0, c[0], c[2]); }
      const C = P.city.crowds; if (C && C.length) {
        let c = C[Math.floor(T() * C.length)];
        for (let n = 0; n < 6; n++) { const q = C[Math.floor(T() * C.length)]; if (Math.hypot(q.x - P.x[i], q.z - P.z[i]) < Math.hypot(c.x - P.x[i], c.z - P.z[i])) c = q; }
        const a = T() * 6.28, rr = (c.rad || 6) * (0.5 + T() * 0.7);
        return this.go(i, HANG, -1, 25 + T() * 45, c.x + Math.cos(a) * rr, c.z + Math.sin(a) * rr);
      }
    }
    this.nextT[i] = P.time + 15 + T() * 25; // on round the block a while
    if (out) P.startReturn(i);
  }
  // off along the pavements to building k's door (or to a spot)
  go(i, act, k, dwell, x, z) {
    const P = this.P;
    if (k >= 0) { if (P.city.dead[k]) { this.nextT[i] = P.time + 8; return; } x = P.bld[k].door[0]; z = P.bld[k].door[1]; }
    if (x == null) return;
    this.trips.set(i, { pts: this.route(P.x[i], P.z[i], x, z, P.lat[i] * 0.6), k: 0, act, b: k, dwell, best: 1e9, stuck: 0, at: false, stay: 0 });
    P.st[i] = this.S.GO; P.fx[i] = 0; P.t1[i] = 280; P.inc[i] = 0; P.target[i] = -1;
  }

  // corner to corner along the pavements, crossing at the corners: east-west then north-south, or the other way round if
  // that runs into a street that is not there (a superblock, open ground)
  route(x0, z0, x1, z1, lane = 0) { // lane: each person's own line along the pavement, so corners do not crowd
    const P = this.P, { sx, sz } = P.city, off = this.off + lane;
    const ni = (v, L) => { let b = 0, d = 1e9; for (let k = 0; k < L.length; k++) { const e = Math.abs(v - L[k]); if (e < d) { d = e; b = k; } } return b; };
    const gi = ni(x0, sx), gj = ni(z0, sz), Gi = ni(x1, sx), Gj = ni(z1, sz);
    const qx0 = x0 >= sx[gi] ? 1 : -1, qz0 = z0 >= sz[gj] ? 1 : -1, Qx = x1 >= sx[Gi] ? 1 : -1, Qz = z1 >= sz[Gj] ? 1 : -1;
    const build = (xFirst) => {
      const pts = []; let i = gi, j = gj, a = qx0, c = qz0;
      const put = () => { const p = P.offRing(sx[i] + a * off, sz[j] + c * off); pts.push(p[0], p[1]); };
      put();
      const alongX = () => { const d = Math.sign(Gi - i); while (i !== Gi) { if (a !== d) { a = d; put(); } i += d; a = -d; put(); } if (a !== Qx) { a = Qx; put(); } };
      const alongZ = () => { const d = Math.sign(Gj - j); while (j !== Gj) { if (c !== d) { c = d; put(); } j += d; c = -d; put(); } if (c !== Qz) { c = Qz; put(); } };
      if (xFirst) { alongX(); alongZ(); } else { alongZ(); alongX(); }
      pts.push(x1, z1);
      return pts;
    };
    const blocked = (pts) => { let n = 0, px = x0, pz = z0; for (let k = 0; k < pts.length; k += 2) { const qx = pts[k], qz = pts[k + 1], L = Math.hypot(qx - px, qz - pz), m = Math.ceil(L / 1.5); for (let s = 1; s < m; s++) if (!P.walkable(px + (qx - px) * s / m, pz + (qz - pz) * s / m)) n++; px = qx; pz = qz; } return n; };
    const A = build(true); if (!blocked(A)) return A;
    const B = build(false); return blocked(B) < blocked(A) ? B : A;
  }

  // on the way: walking briskly from corner to corner; at the end, in through the door, or standing about at the spot
  goStep(i, h) {
    const P = this.P, T = this.trips.get(i);
    if (!T) { P.startReturn(i); return; }
    if (T.at) { if ((T.stay -= h) <= 0) { this.trips.delete(i); P.fx[i] = 0; this.decide(i, true); } return; }
    if ((P.t1[i] -= h) <= 0) { this.trips.delete(i); P.startReturn(i); return; } // could not get there: back to their block
    const n = T.pts.length / 2;
    if (T.k >= n) { this.arrive(i, T); return; }
    const wx = T.pts[T.k * 2], wz = T.pts[T.k * 2 + 1], dx = wx - P.x[i], dz = wz - P.z[i], d = Math.hypot(dx, dz);
    if (d < (T.k * 2 + 2 < T.pts.length ? 1.4 : 0.8)) { T.k++; T.best = 1e9; T.stuck = 0; return; } // near enough a corner; right up to the door
    const onRoad = P.onRoad(P.x[i], P.z[i]), v = Math.abs(P.spd[i]) * (onRoad ? 1.7 : 1.2) * h; // brisk, and quicker still across the road
    if (!onRoad && P.onRoad(P.x[i] + dx / d * 1.2, P.z[i] + dz / d * 1.2) && !this.clearToCross(P.x[i] + dx / d * 3, P.z[i] + dz / d * 3) && (T.wait = (T.wait || 0) + h) < 8) { P.fx[i] = 7; P.hx[i] = dx / d; P.hz[i] = dz / d; return; } // at the kerb: a car coming, wait
    T.wait = 0; P.fx[i] = 0;
    if (P.inc[i] > 0) { P.inc[i] -= h; P.move(i, P.hx[i], P.hz[i], v); } // stepping round someone
    else { P.hx[i] = dx / d; P.hz[i] = dz / d; if (!P.move(i, dx / d, dz / d, v) && P.randomCardinal(i, 1.5)) P.inc[i] = 1; }
    if (d < T.best - 0.3) { T.best = d; T.stuck = 0; } else if ((T.stuck += h) > 5) { T.k++; T.best = 1e9; T.stuck = 0; } // no headway: on to the next corner
  }
  // nothing driving at (x, z) soon: no moving car heading for it within a couple of seconds
  clearToCross(x, z) {
    const Tr = this.P.traffic; if (!Tr) return true;
    let ok = true;
    Tr.near(x, z, 22, (car) => { if (!ok || car.mode !== 0 || car.v < 1) return; const dx = x - car.x, dz = z - car.z, ahead = dx * car.hx + dz * car.hz, side = Math.abs(-dx * car.hz + dz * car.hx); if (ahead > -3 && ahead < 6 + car.v * 1.8 && side < 4) ok = false; });
    return ok;
  }
  arrive(i, T) {
    const P = this.P, S = this.S;
    if (T.act === HANG && i >= P.nWalk) { this.trips.delete(i); const c = P.crowdPts[i - P.nWalk]; P.x[i] = c[0]; P.y[i] = c[1]; P.z[i] = c[2]; P.st[i] = S.IDLE; P.fx[i] = 0; return; } // back in the crowd
    if (T.act === HANG) { T.at = true; T.stay = T.dwell; P.fx[i] = 8; const a = P.r() * 6.28; P.hx[i] = Math.cos(a); P.hz[i] = Math.sin(a); return; }
    this.trips.delete(i);
    const k = T.b;
    if (k < 0 || P.city.dead[k] || (P.fire && P.fire.bFire[k] === 1) || P.bBreach[k]) { P.startReturn(i); return; } // gone, burning or broken into
    P.st[i] = S.INSIDE; P.lvl[i] = -2; P.bt[i] = k; P.bIn[k]++; P.fx[i] = 9; P.t1[i] = T.dwell; // fx 9: in for the routine, not sheltering
    if (T.act === WORK) this.done[i] = 1;
  }
  // indoors for the routine: out of the door again when the time is up, and on to whatever is next
  indoorStep(i, h) {
    const P = this.P, k = P.bt[i];
    if ((P.t1[i] -= h) > 0) return;
    if (P.danger) { P.t1[i] = 6 + P.r() * 6; return; } // trouble outside: they stay in for now
    P.bIn[k] = Math.max(0, P.bIn[k] - 1);
    const d = P.bld[k].door; P.x[i] = d[0] + (P.r() - 0.5) * 0.8; P.z[i] = d[1] + (P.r() - 0.5) * 0.8; P.y[i] = P.groundY(P.x[i], P.z[i]);
    P.st[i] = this.S.WALK; P.lvl[i] = -1; P.bt[i] = -1; P.fx[i] = 0;
    this.decide(i, true);
  }
}
