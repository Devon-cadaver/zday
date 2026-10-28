// Lives: every civilian has a home and most have a job, a personality, and a day
// to get through. Out of the door in the morning and along the pavements to work,
// in through its door; out at lunch to a park or a square where people gather;
// errands at the shops; home in the evening; strolling round their own block in
// between. What they do next is weighed from the hour, their job and their
// character (fear, greed, loyalty, curiosity, bravery, sociability), with a little
// chance in it. Indoors they are hidden but still there: a building that falls or
// burns has them inside. While a disaster is on nobody sets out on an errand.
// In danger each person weighs what to do the same way: run, stand and fight,
// grab a car, pray, get indoors, hurry home to their family, loot a shop and run
// home with it, freeze, or get up a building out of the water. What tips it is
// who they are (a coward runs, the loyal go home, the greedy loot, the curious
// stay to film), how close the danger is and what kind it is (indoors is safe
// from a tornado, not from an earthquake). A choice that takes some doing is a
// plan of steps (loot the shop, then home), carried through unless the danger
// gets right up close.
// People know each other: a household sharing their home, two friends (from work
// or their block), and now and then someone on the block they cannot stand.
// Friends stop to chat and bring each other along to the park or the shops;
// enemies have it out in the street; families gather at home in the evening. In
// danger the loyal run to a friend or family member in trouble and bring them in;
// losing one leaves a mark (they grieve; they are more afraid afterwards, or, if
// brave, harder). And the whole city has a mood: how far it trusts the police and
// rescuers, up with every rescue and arrest, down with every civilian killed. It
// decides whether people get on the evacuation bus, do as the police say, gather
// round officers for safety, or loot.
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
const WORK = 1, HOME = 2, SHOP = 3, HANG = 4, SHELTER = 5, LOOT = 6, GATHER = 7, POLICE = 8;
// what kind of trouble it is: safer indoors from these; buildings are the danger in these (out into the open); up a
// building out of these
const INDOORS = new Set(['tornado', 'haboob', 'coldwave', 'solar', 'aliens', 'nuclear', 'meltdown', 'volcano', 'villains', 'riot', 'meteor', 'blackhole', 'spill']);
const OPEN = new Set(['quake', 'sinkhole', 'kaiju', 'worm']);
const UP = new Set(['tsunami', 'flood']);

export class Lives {
  constructor(P, S, KIND, TRAIT) {
    this.P = P; this.S = S; this.KIND = KIND; this.TRAIT = TRAIT;
    const N = P.N, U8 = () => new Uint8Array(N);
    this.home = new Int32Array(N).fill(-1); this.work = new Int32Array(N).fill(-1); this.arch = U8(); this.done = U8();
    this.nextT = new Float32Array(N); this.t = {}; for (const k of TRAITS) this.t[k] = U8();
    this.hh = new Int32Array(N).fill(-1); this.households = []; this.f1 = new Int32Array(N).fill(-1); this.f2 = new Int32Array(N).fill(-1); this.foe = new Int32Array(N).fill(-1);
    this.lost = U8(); this.chatT = new Float32Array(N); this.trust = 0.6; this.st0 = null; this.trustAcc = 0; // lost: bits for which of their people they have mourned
    this.trips = new Map(); this.after = new Map(); this.respT = new Float32Array(N); this.cur = 0; this.lastHour = 8; // after: the rest of a plan, for someone indoors
    this.off = RW / 2 + SW * 0.55; // the middle of the pavement, from the street's centre line
  }

  // a new day for everyone: homes, jobs and characters (the same every time for this place)
  reset(seed) {
    const P = this.P, bl = P.bld; let s = (seed * 7919 + 13) % 2147483647 || 1; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    this.trips.clear(); this.after.clear(); this.respT.fill(0); this.done.fill(0); this.cur = 0;
    this.lost.fill(0); this.chatT.fill(0); this.trust = 0.6; this.st0 = null; this.trustAcc = 0; this.saidArgue = this.saidMourn = false;
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
    this.relate(r);
  }
  // who knows whom: households of one to four in each home, two friends among their workmates and neighbours, and for
  // about one in eight someone nearby they cannot stand
  relate(r) {
    const P = this.P, n = P.nHuman, byHome = new Map(), byWork = new Map();
    this.hh.fill(-1); this.f1.fill(-1); this.f2.fill(-1); this.foe.fill(-1); this.households = [];
    for (let i = 0; i < n; i++) {
      if (this.home[i] >= 0) { let L = byHome.get(this.home[i]); if (!L) byHome.set(this.home[i], L = []); L.push(i); }
      if (this.work[i] >= 0) { let L = byWork.get(this.work[i]); if (!L) byWork.set(this.work[i], L = []); L.push(i); }
    }
    for (const L of byHome.values()) { // households
      for (let k = L.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [L[k], L[j]] = [L[j], L[k]]; }
      for (let k = 0; k < L.length;) { const q = r(), size = q < 0.2 ? 1 : q < 0.55 ? 2 : q < 0.8 ? 3 : 4, g = L.slice(k, k + size); for (const i of g) this.hh[i] = this.households.length; this.households.push(g); k += size; }
    }
    const pickFrom = (L, i, not) => { if (!L || L.length < 2) return -1; for (let t = 0; t < 6; t++) { const j = L[Math.floor(r() * L.length)]; if (j !== i && this.hh[j] !== this.hh[i] && !not.includes(j)) return j; } return -1; };
    const nearby = (i, not) => { for (let t = 0; t < 12; t++) { const j = Math.floor(r() * n); if (j !== i && !not.includes(j) && this.hh[j] !== this.hh[i] && Math.abs(P.x[j] - P.x[i]) + Math.abs(P.z[j] - P.z[i]) < 160) return j; } return -1; };
    for (let i = 0; i < n; i++) {
      const w = byWork.get(this.work[i]), h = byHome.get(this.home[i]);
      let a = pickFrom(w, i, []); if (a < 0) a = pickFrom(h, i, []); if (a < 0) a = nearby(i, []);
      let b = pickFrom(h, i, [a]); if (b < 0) b = pickFrom(w, i, [a]); if (b < 0) b = nearby(i, [a]);
      this.f1[i] = a; this.f2[i] = b;
      if (r() < 0.12) this.foe[i] = nearby(i, [a, b]);
    }
  }
  // their people: family first, then friends
  people(i) { const out = [], H = this.hh[i] >= 0 ? this.households[this.hh[i]] : null; if (H) for (const j of H) if (j !== i) out.push(j); if (this.f1[i] >= 0) out.push(this.f1[i]); if (this.f2[i] >= 0) out.push(this.f2[i]); return out; }
  // free to stop and talk: out and about on their own account (not on a plan, not already standing about)
  free(j) { const P = this.P, S = this.S, s = P.st[j]; if (P.kind[j] !== this.KIND.CIVILIAN || P.inf[j] || P.lvl[j] !== -1) return false; if (s === S.WALK) return true; if (s !== S.GO) return false; const T = this.trips.get(j); return !!T && !T.plan && !T.at; }
  // standing a moment facing someone (talking, arguing, grieving), then back to what they were doing
  pause(i, secs, j, talk) {
    const P = this.P, S = this.S, was = P.st[i] === S.GO ? this.trips.get(i) : null;
    this.trips.set(i, { pts: [], k: 0, at: true, stay: secs, resume: was || null, with: j, talk }); // talk: chat, argue or grieve (for their card)
    P.st[i] = S.GO; P.fx[i] = 8; P.face(i, P.x[j], P.z[j]);
  }
  // friends or enemies who meet in the street (each one's think, every two seconds or so)
  social(i) {
    const P = this.P;
    if (P.time < this.chatT[i] || !this.free(i)) return false;
    const close = (j, d) => j >= 0 && Math.abs(P.x[j] - P.x[i]) < d && Math.abs(P.z[j] - P.z[i]) < d && this.free(j);
    for (const j of [this.f1[i], this.f2[i]]) if (close(j, 3.5)) { // a chat
      const t = 3 + P.r() * 5; this.pause(i, t, j, 'chat'); this.pause(j, t, i, 'chat'); this.chatT[i] = this.chatT[j] = P.time + 45; return true;
    }
    const e = this.foe[i];
    if (close(e, 4)) { // words, and maybe a shove
      const t = 3 + P.r() * 3; this.pause(i, t, e, 'argue'); this.pause(e, t, i, 'argue'); this.chatT[i] = this.chatT[e] = P.time + 60;
      if ((this.t.brave[i] + this.t.greed[i] - this.t.loyal[i]) / 255 > 0.45) { const dx = P.x[e] - P.x[i], dz = P.z[e] - P.z[i], d = Math.hypot(dx, dz) || 1, nx = P.x[e] + dx / d * 0.9, nz = P.z[e] + dz / d * 0.9; if (P.walkable(nx, nz)) { P.x[e] = nx; P.z[e] = nz; } }
      if (!this.saidArgue) { this.saidArgue = true; P.events.push({ type: 'argue', x: P.x[i], z: P.z[i] }); }
      return true;
    }
    return false;
  }
  // one of their people dead or turned: it leaves a mark; seen up close, they grieve (or, brave, go for what it became)
  mourn(i) {
    const P = this.P, S = this.S, ps = this.people(i);
    for (let k = 0; k < ps.length && k < 6; k++) {
      const j = ps[k], s = P.st[j], gone = s === S.DEAD || s === S.ZOMBIE || s === S.TURNING;
      if (!gone || (this.lost[i] & (1 << k))) continue;
      this.lost[i] |= 1 << k;
      const b = this.t.brave[i]; if (b > 165) this.t.brave[i] = Math.min(255, b + 20); else this.t.fear[i] = Math.min(255, this.t.fear[i] + 30);
      const d = Math.hypot(P.x[j] - P.x[i], P.z[j] - P.z[i]);
      if (d > 40 || P.kind[i] !== this.KIND.CIVILIAN || P.inf[i] || P.lvl[i] !== -1) continue;
      if (s === S.ZOMBIE && b > 150 && d < 15 && P.st[i] !== S.FIGHT) { P.fightBack(i, j); return; } // going for what their friend became
      if (this.free(i) || P.st[i] === S.FLEE) { this.pause(i, 4 + P.r() * 4, j, 'grieve'); if (!this.saidMourn) { this.saidMourn = true; P.events.push({ type: 'mourn', x: P.x[i], z: P.z[i] }); } return; }
    }
  }
  // the city's trust in the police and rescuers: up with rescues, arrests, zombies shot, people treated; down with
  // civilians killed (by bombs above all) and a city overrun; drifting back towards the usual (once a second)
  trustTick() {
    const s = this.P.stats, o = this.st0, K = ['shot', 'rescued', 'bused', 'arrests', 'treated', 'jailed', 'bombed', 'bombedCiv', 'nukedCiv', 'nukedZ', 'aliensKilled', 'dead'];
    if (o) {
      const d = (k) => (s[k] || 0) - (o[k] || 0), civ = Math.max(0, d('dead') - d('shot') - d('bombed') - d('nukedZ') - d('aliensKilled')); // the dead who were people, not zombies or aliens
      let t = this.trust + d('shot') * 0.0015 + d('rescued') * 0.004 + d('bused') * 0.002 + d('arrests') * 0.003 + d('treated') * 0.003 + d('jailed') * 0.001
        - d('bombedCiv') * 0.02 - d('nukedCiv') * 0.003 - civ * 0.0012 - (s.zombies > 60 ? 0.001 : 0);
      t += (0.6 - t) * 0.004;
      this.trust = Math.max(0.05, Math.min(0.98, t));
    }
    this.st0 = {}; for (const k of K) this.st0[k] = s[k] || 0;
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
    if ((this.trustAcc += 0.25) >= 1) { this.trustAcc = 0; this.trustTick(); }
    for (let c = 0; c < per; c++) {
      const i = this.cur; this.cur = (this.cur + 1) % n;
      if (P.st[i] === S.DEAD || P.st[i] === S.EVAC) { this.trips.delete(i); continue; } // gone: nothing more to plan
      if (P.inf[i] || P.kind[i] !== this.KIND.CIVILIAN || P.lvl[i] !== -1) continue;
      this.mourn(i);
      if (!calm) { this.sense(i); continue; } // a disaster on: those within its reach decide what to do about it
      if (this.social(i)) continue;
      if (P.time < this.nextT[i]) continue;
      if (P.st[i] === S.WALK) this.decide(i, false);
      else if (P.st[i] === S.IDLE && i >= P.nWalk && P.r() < 0.008) this.decide(i, true); // one of a crowd off on an errand (they come back to their spot)
    }
  }
  // a disaster within reach (not yet on top of them): decide what to do about it, once in a while
  sense(i) {
    const P = this.P, S = this.S, s = P.st[i];
    if ((s !== S.WALK && s !== S.IDLE && !(s === S.GO && !this.inPlan(i))) || P.time < this.respT[i] || !P.poi) return;
    const p = P.poi(P.x[i], P.z[i]); if (!p) return;
    const d = Math.hypot(p.x - P.x[i], p.z - P.z[i]); if (d > p.range * 0.75) return;
    this.respT[i] = P.time + 20 + P.r() * 15;
    if (!this.respond(i, p.x, p.z, -1, p.type || '') && d < Math.max(30, p.danger * 2.5)) P.fleeFrom(i, p.x, p.z, -1); // running: only from what is close
  }
  inPlan(i) { const T = this.trips.get(i); return !!(T && T.plan); }
  // what to do about it: each choice scored from who they are and the situation (utility), a little chance in it; true
  // if they did something other than run (running is the people code's own: away, or up onto a roof)
  respond(i, fromX, fromZ, threat, kind) {
    const P = this.P, S = this.S, TR = this.TRAIT, x = P.x[i], z = P.z[i], d = Math.hypot(x - fromX, z - fromZ), tr = (k) => this.t[k][i] / 255;
    const f = tr('fear'), g = tr('greed'), l = tr('loyal'), c = tr('curious'), b = tr('brave'), old = P.trait[i];
    const zombie = threat >= 0 && P.st[threat] === S.ZOMBIE;
    if (kind == null) { const p = P.poi && P.poi(x, z); kind = p && Math.hypot(p.x - x, p.z - z) < p.range ? p.type || '' : zombie ? 'zombies' : ''; }
    const U = { flee: 0.45 + f * 0.5 + (d < 8 ? 0.35 : 0) + (OPEN.has(kind) ? 0.3 : 0) };
    if (zombie && P.zombiesNear(x, z, 12) <= 3) U.fight = b * 0.9 - f * 0.5 + (old === TR.FIGHTER ? 0.45 : 0);
    U.steal = (old === TR.DRIVER ? 0.45 : 0) + g * 0.25 + f * 0.2 - l * 0.15;
    const circle = P.circles.find(q => Math.hypot(q.x - x, q.z - z) < 40 && q.n < 16);
    U.pray = (old === TR.FAITHFUL ? 0.7 : 0) + f * 0.15 - c * 0.2 + (circle && circle.n >= 3 ? 0.25 : 0);
    const ref = OPEN.has(kind) ? -1 : this.refuge(x, z, 45);
    if (ref >= 0) U.shelter = 0.35 + (1 - b) * 0.3 + f * 0.2 + (INDOORS.has(kind) ? 0.45 : 0) + (zombie ? 0.15 : 0);
    const hm = this.home[i];
    if (hm >= 0 && !OPEN.has(kind) && !UP.has(kind) && !P.city.dead[hm]) { const hd = Math.hypot(P.bld[hm].door[0] - x, P.bld[hm].door[1] - z); if (hd < 260) U.home = 0.2 + l * 0.7 - hd / 600 + (d > 15 ? 0.1 : -0.4); }
    let shop = -1;
    if (g > 0.6 && d > 18 && (kind === 'riot' || P.danger || zombie)) { shop = this.refuge(x, z, 40); if (shop >= 0) U.loot = 0.25 + (g - 0.5) * 2 - f * 0.3 - l * 0.3 + (kind === 'riot' ? 0.3 : 0); } // every building has its shopfront; a riot brings it out in them
    if (d < 10 && f > 0.62 && b < 0.42) U.freeze = f * 0.7 - b * 0.6;
    if (UP.has(kind)) U.up = 0.55 + (1 - b) * 0.2 + f * 0.2;
    let who = -1; // one of their people in trouble nearby: the loyal go and get them
    for (const j of this.people(i)) { if (P.kind[j] !== this.KIND.CIVILIAN || P.inf[j] || P.st[j] === S.INSIDE || P.st[j] === S.DEAD || P.st[j] === S.EVAC || P.lvl[j] !== -1) continue; const dj = Math.hypot(P.x[j] - x, P.z[j] - z); if (dj < 60 && Math.hypot(P.x[j] - fromX, P.z[j] - fromZ) < 25) { who = j; break; } }
    if (who >= 0) U.gather = 0.1 + l * 0.8 + b * 0.3 - f * 0.35;
    let cop = -1; // trusting the police: stay close to an officer
    if (this.trust > 0.35) { let cd = 50 * 50; P.around(x, z, 50, (j, d2) => { if (P.st[j] === S.COP && d2 < cd) { cd = d2; cop = j; } }); if (cop >= 0) U.police = 0.25 + this.trust * 0.8 + (1 - b) * 0.15; }
    if (U.loot != null) U.loot += (0.6 - this.trust) * 0.5; // the less they trust the police, the more they help themselves
    let best = 'flee', bv = -9;
    for (const k in U) { const v = U[k] + P.r() * 0.25; if (v > bv) { bv = v; best = k; } }
    switch (best) {
      case 'fight': return P.fightBack(i, threat);
      case 'steal': return P.stealCar(i, fromX, fromZ);
      case 'pray': P.pray(i, circle); return true;
      case 'shelter': this.plan(i, [{ act: SHELTER, b: ref }]); return true;
      case 'home': this.plan(i, [{ act: SHELTER, b: hm }]); return true;
      case 'loot': this.plan(i, [{ act: LOOT, b: shop }, { act: SHELTER, b: hm >= 0 ? hm : ref }]); return true;
      case 'freeze': this.trips.set(i, { pts: [], k: 0, at: true, stay: 1 + P.r() * 2.2, plan: true, fromX, fromZ }); P.st[i] = S.GO; P.fx[i] = 7; P.face(i, fromX, fromZ); return true; // frozen to the spot, then they run
      case 'up': return P.trySeek(i);
      case 'gather': this.go(i, GATHER, -1, 0, P.x[who], P.z[who]); { const T = this.trips.get(i); if (T) { T.plan = true; T.who = who; P.t1[i] = 90; } } return true;
      case 'police': this.go(i, POLICE, -1, 0, P.x[cop] + (P.r() - 0.5) * 6, P.z[cop] + (P.r() - 0.5) * 6); { const T = this.trips.get(i); if (T) { T.plan = true; P.t1[i] = 60; } } return true;
      default: return false;
    }
  }
  // the nearest building they could get into (a shop: a low one) within R
  refuge(x, z, R, shop = false) {
    const P = this.P; let bk = -1, bd = R * R;
    P.refugesNear(x, z, R, (k) => {
      const b = P.bld[k]; if (P.city.dead[k] || P.bBreach[k] || (P.fire && P.fire.bFire[k]) || (shop && b.roofY - b.baseY > 11)) return;
      const d = (b.door[0] - x) ** 2 + (b.door[1] - z) ** 2; if (d < bd) { bd = d; bk = k; }
    });
    return bk;
  }
  // a plan: steps of [where, what to do there], one after another; carried through (the danger has to come right up
  // close to change their mind)
  plan(i, steps) {
    const s = steps.find(q => q.b >= 0 && !this.P.city.dead[q.b]); if (!s) { this.P.fleeFrom(i, this.P.x[i] + 1, this.P.z[i], -1); return; }
    const rest = steps.slice(steps.indexOf(s) + 1);
    this.go(i, s.act, s.b, s.act === LOOT ? 3 + this.P.r() * 3 : 70 + this.P.r() * 80);
    const T = this.trips.get(i); if (T) { T.plan = true; T.rest = rest; this.P.t1[i] = 120; }
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
      home: hm >= 0 ? (night ? 1.0 : evening ? 0.55 : 0.12) + (1 - tr('social')) * 0.25 + (evening || night ? this.famHome(i) * 0.3 : 0) : 0,
      hang: (lunch ? 0.85 : evening ? 0.6 : night ? 0.15 : 0.3) * (0.4 + tr('social')) + tr('curious') * 0.1 + (i >= P.nWalk ? 0.6 : 0), // a crowd's regulars go back to it
      shop: (H >= 8 && H < 20 ? 0.38 : 0.02) * (0.5 + tr('greed')),
      stroll: out ? 0.5 : 0.42 + tr('curious') * 0.3,
    };
    let best = 'stroll', bv = -1;
    for (const k in U) { const v = U[k] > 0 ? U[k] + r() * 0.35 : -1; if (v > bv) { bv = v; best = k; } }
    const T = () => P.r();
    if (best === 'work') return this.go(i, WORK, w, 45 + T() * 45);
    if (best === 'home') return this.go(i, HOME, hm, night ? 60 + T() * 60 : 25 + T() * 25);
    if (best === 'shop') { const k = this.pick(this.pools.shop, P.x[i], P.z[i], 30, 170, T); this.go(i, SHOP, k, 10 + T() * 15); this.bring(i, SHOP, k, 10 + T() * 15); return; }
    if (best === 'hang') { // a park or a square where people gather (a regular: their own spot in its crowd)
      if (i >= P.nWalk) { const c = P.crowdPts[i - P.nWalk]; return this.go(i, HANG, -1, 0, c[0], c[2]); }
      const C = P.city.crowds; if (C && C.length) {
        let c = C[Math.floor(T() * C.length)];
        for (let n = 0; n < 6; n++) { const q = C[Math.floor(T() * C.length)]; if (Math.hypot(q.x - P.x[i], q.z - P.z[i]) < Math.hypot(c.x - P.x[i], c.z - P.z[i])) c = q; }
        const a = T() * 6.28, rr = (c.rad || 6) * (0.5 + T() * 0.7), dw = 25 + T() * 45;
        this.go(i, HANG, -1, dw, c.x + Math.cos(a) * rr, c.z + Math.sin(a) * rr); this.bring(i, HANG, -1, dw, c.x + Math.cos(a + 0.4) * rr, c.z + Math.sin(a + 0.4) * rr); return;
      }
    }
    this.nextT[i] = P.time + 15 + T() * 25; // on round the block a while
    if (out) P.startReturn(i);
  }
  // someone of their household at home now
  famHome(i) { const H = this.hh[i] >= 0 ? this.households[this.hh[i]] : null, P = this.P; if (!H) return 0; for (const j of H) if (j !== i && P.st[j] === this.S.INSIDE && P.fx[j] === 9 && P.bt[j] === this.home[i]) return 1; return 0; }
  // the sociable bring a friend along, if one is nearby and free
  bring(i, act, k, dwell, x, z) {
    const P = this.P; if (P.r() > this.t.social[i] / 255) return;
    for (const j of [this.f1[i], this.f2[i]]) if (j >= 0 && j < P.nWalk && this.free(j) && Math.hypot(P.x[j] - P.x[i], P.z[j] - P.z[i]) < 60) { this.go(j, act, k, dwell, x, z); return; }
  }
  // off along the pavements to building k's door (or to a spot)
  go(i, act, k, dwell, x, z) {
    const P = this.P;
    if (k >= 0) { if (P.city.dead[k]) { this.nextT[i] = P.time + 8; return; } x = P.bld[k].door[0]; z = P.bld[k].door[1]; }
    if (x == null) return;
    if (P.quar && act !== SHELTER && act !== GATHER && act !== POLICE && P.quar.closed(x, z)) { this.nextT[i] = P.time + 10; return; } // quarantined: the police turn them away (they can still run in for their family)
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
    if (T.at) {
      if ((T.stay -= h) > 0) return;
      this.trips.delete(i); P.fx[i] = 0;
      if (T.fromX != null) P.fleeFrom(i, T.fromX, T.fromZ, -1); // out of the freeze: run
      else if (T.resume) this.trips.set(i, T.resume); // the chat over: on their way again
      else if (T.near) this.plan(i, [{ act: SHELTER, b: this.refuge(P.x[i], P.z[i], 60) }]); // a while near the police: then indoors
      else this.decide(i, true);
      return;
    }
    if ((P.t1[i] -= h) <= 0) { this.trips.delete(i); P.startReturn(i); return; } // could not get there: back to their block
    if (T.who >= 0 && T.who != null) { // going for one of their people: they may have moved on
      const j = T.who, dj = Math.hypot(P.x[j] - P.x[i], P.z[j] - P.z[i]);
      if (dj < 3) { this.arrive(i, T); return; }
      const ex = T.pts[T.pts.length - 2], ez = T.pts[T.pts.length - 1];
      if (Math.hypot(P.x[j] - ex, P.z[j] - ez) > 8) { T.pts = this.route(P.x[i], P.z[i], P.x[j], P.z[j], P.lat[i] * 0.6); T.k = 0; T.best = 1e9; }
    }
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
    if (T.act === GATHER) { // with them: both indoors together
      this.trips.delete(i); const j = T.who, ref = this.refuge(P.x[i], P.z[i], 60);
      if (ref < 0) { P.fleeFrom(i, P.x[i] + 1, P.z[i], -1); return; }
      this.plan(i, [{ act: SHELTER, b: ref }]);
      if (j >= 0 && (this.free(j) || P.st[j] === S.FLEE || P.st[j] === S.IDLE) && !P.inf[j]) this.plan(j, [{ act: SHELTER, b: ref }]);
      return;
    }
    if (T.act === POLICE) { T.at = true; T.stay = 8 + P.r() * 8; T.near = true; T.plan = true; P.fx[i] = 8; return; }
    if (T.act === HANG && i >= P.nWalk) { this.trips.delete(i); const c = P.crowdPts[i - P.nWalk]; P.x[i] = c[0]; P.y[i] = c[1]; P.z[i] = c[2]; P.st[i] = S.IDLE; P.fx[i] = 0; return; } // back in the crowd
    if (T.act === HANG) { T.at = true; T.stay = T.dwell; P.fx[i] = 8; const a = P.r() * 6.28; P.hx[i] = Math.cos(a); P.hz[i] = Math.sin(a); return; }
    this.trips.delete(i);
    const k = T.b;
    if (k < 0 || P.city.dead[k] || (P.fire && P.fire.bFire[k] === 1) || P.bBreach[k]) { P.startReturn(i); return; } // gone, burning or broken into
    P.st[i] = S.INSIDE; P.lvl[i] = -2; P.bt[i] = k; P.bIn[k]++; P.fx[i] = 9; P.t1[i] = T.dwell; // fx 9: in for the routine (or sheltering by their own choice), hidden
    if (T.act === WORK) this.done[i] = 1;
    if (T.act === LOOT || (T.rest && T.rest.length)) this.after.set(i, { rest: T.rest || [], loot: T.act === LOOT });
  }
  // indoors for the routine: out of the door again when the time is up, and on to whatever is next
  indoorStep(i, h) {
    const P = this.P, k = P.bt[i];
    if ((P.t1[i] -= h) > 0) return;
    const A = this.after.get(i);
    if (P.danger && !(A && A.loot)) { P.t1[i] = 6 + P.r() * 6; return; } // trouble outside: they stay in for now (looters come out with what they grabbed)
    P.bIn[k] = Math.max(0, P.bIn[k] - 1);
    const d = P.bld[k].door; P.x[i] = d[0] + (P.r() - 0.5) * 0.8; P.z[i] = d[1] + (P.r() - 0.5) * 0.8; P.y[i] = P.groundY(P.x[i], P.z[i]);
    P.st[i] = this.S.WALK; P.lvl[i] = -1; P.bt[i] = -1; P.fx[i] = 0;
    if (A) {
      this.after.delete(i);
      if (A.loot) P.looted(i, k); // out with an armful
      if (A.rest.length) { this.plan(i, A.rest); return; }
    }
    this.decide(i, true);
  }
}
