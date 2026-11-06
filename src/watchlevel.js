// Watch's story levels (Sean, 2026-11-05: the disasters as they are now, the heroes fighting them and able to lose, and the villain behind
// it after). A HeroGame (herogame.js) run inside Disaster TV (tv.js): its levels, its update and its villain fights, none of its saves or
// XP. One hero plays it with nobody at the controls (the team comes in on TEAM); down once and the heroes have lost. The result is drawn
// first at the odds on the slip (W.win) and steered to without showing: the one drawn to win cannot be put down and, past 150 s, the team
// sweeps in to finish it; drawn to lose, the blows on her grow until she falls, to the disaster or to the villain after (W.lossAt).
import { HeroGame, HS } from './herogame.js';
import { LAB } from './lab.js';
import { placeKey } from './places.js';
import { Squad } from './squad.js';
import { ALIEN_MIX } from './figures.js';
import { CreatureLayer } from './creaturekit.js';
import { finish as endDisaster } from './heropower.js';
import { stickTo, dashWorld } from './fightbot.js';

export const FOOT = ['aliens', 'zombies', 'worm', 'kaiju', 'riot', 'quake']; // fought on foot (horde.js)
export const AIR = ['tornado', 'flood', 'tsunami', 'haboob', 'coldwave']; // fought in the air (livestorm.js): the storm, then the villain in it
export const AFTER = { worm: 'THE BURROWER', kaiju: 'THE BEAST KEEPER', zombies: 'the zombie general', aliens: 'the alien general', riot: 'the instigators', tornado: 'TWISTER', flood: 'CAPTAIN DELUGE', tsunami: 'RIPTIDE', haboob: 'THE DUST DEVIL', coldwave: 'JACK FROST' }; // the villain after the disaster
const RUSH_T = 150; // s: a level drawn to be won and still going: the team sweeps in

export class WatchLevel extends HeroGame {
  constructor(g, tv) { g.heroGo = false; super(g, 'hero'); this.tv = tv; } // HeroGame's own start waits for g.mode to be it, which it never is
  // the kind on foot, sized for television; o: { who (id), ix, win, lossAt }
  go(kind, o) {
    const g = this.g, D = HS.load(), P = g.people, B = g.city.bounds, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2, key = placeKey();
    this.W = o; this.kind = kind; this.lastWas = D.last.hero; D.last.hero = o.who; this.s = D.hero; this.ix = o.ix || 0; this.t = 0; this.rushSaid = false; this.vLost = false;
    this.labWas = { hero: LAB.hero, villain: LAB.villain, moves: LAB.moves, army: LAB.army }; LAB.hero = this.level; LAB.villain = this.ix + 1; LAB.moves = this.moves(); LAB.powerK = 1 + 0.06 * this.count('power'); LAB.energyK = 1 + 0.1 * this.count('energy'); LAB.teamK = 1 + 0.15 * this.count('team'); LAB.spotK = 1; LAB.toughK = 1 + 0.2 * this.count('tough'); LAB.army = false; LAB.reset();
    const pool = (n, near) => { const out = []; for (let j = 0; j < P.active && out.length < n; j++) { if (P.kind[j] === 0 && P.isCivilian(j) && P.lvl[j] === -1 && Math.hypot(P.x[j] - cx, P.z[j] - cz) > near && P.hide(j)) out.push(j); } return out; };
    const end = (won, H, why) => { if (this.round) this.round.horde = H; this.finish(won, why); }, hitK = 1 + 0.05 * this.ix, bot = (dt) => this.bot(dt), watchK = () => this.biteK(), bossK = () => this.bossK();
    const R = this.round = { evs: [], need: 0, t: 0, downs: 0, hero: true, key, ended: false, zombie: true, n: 100, noun: '' };
    this.squad = new Squad(this); this.squad.ids = [this.squad.cur]; this.squad.draw(); // one life on television
    if (kind === 'zombies') { const q = pool(140, 60); R.n = q.length; g.horde.start({ n: q.length, pool: q, level: true, hitK, generals: 'zombie', bot, watchK, bossK, onEnd: (w, H) => end(w, H, 'Overrun by the horde') }); g.horde.genQ = []; this.genLater = 'zombie'; }
    else if (kind === 'aliens') { const q = pool(100, 60), e = g.disasters.start('aliens', cx, cz, { life: 99999, noSquads: true, tripods: 2, n: 3 }); if (e) { e.launchT = 0.5; e.dropT = 8; R.evs.push(e); } R.n = q.length; P.crLayer = new CreatureLayer(g.disasters.ctx.scene, P.active + 64); g.horde.start({ n: q.length, pool: q, level: true, generals: 'alien', hitK, fleet: e, types: ALIEN_MIX, label: 'ALIENS', verb: ' DOWN', bot, watchK, bossK, onEnd: (w, H) => end(w, H, 'The invasion won') }); g.horde.genQ = []; this.genLater = 'alien'; }
    else if (kind === 'worm' || kind === 'kaiju') { const e = g.disasters.start(kind, cx, cz, { life: 99999, quiet: true }); if (!e) return false; if (kind === 'kaiju') { e.x = cx + 80; e.z = cz; e.yaw = Math.PI; } e.heroHp = 100; e.heroTough = 1 + 0.08 * this.ix; R.evs.push(e); R.boss = e; g.horde.start({ boss: e, n: 100, level: true, hitK, label: kind.toUpperCase(), bot, watchK, bossK, onEnd: (w, H) => end(w, H, 'The ' + kind + ' was too much') }); }
    else if (kind === 'riot') { const e = g.disasters.start('riot', cx + (Math.random() - 0.5) * 80, cz + (Math.random() - 0.5) * 80); if (!e) return false; R.evs.push(e); R.riot = true; R.n = e.members.length; g.horde.start({ mode: 'riot', riot: e, level: true, hitK, bot, watchK, bossK, onEnd: (w, H) => { if (w) e.end(true); end(w, H, 'The mob won'); } }); }
    else if (kind === 'quake') { const q = pool(140, 60), asia = !!(this.tv.placeStyle && this.tv.placeStyle()); g.horde.start({ n: 100, pool: q, level: true, ground: true, label: 'FAULTLINE', verb: ' DOWN', hitK, quake: { design: asia ? 'brute' : 'mountain', size: 50, tough: 1 + 0.1 * this.ix }, bot, watchK, bossK, onEnd: (w, H) => end(w, H, 'The Faultline won') }); }
    else if (AIR.includes(kind)) {
      this.air = true;
      if (kind === 'tornado') { const a0 = Math.random() * 6.28, e = g.disasters.start('tornado', cx + Math.cos(a0) * 170, cz + Math.sin(a0) * 170, { life: 99999, size: 2.2 }); if (!e) return false; this.round = { evs: [e], allies: [], need: 0, t: 0, downs: 0, wasDown: false, hero: true, hunted: false, rivals: [], key, ended: false, nothing: false }; this.flyUp(cx, cz); }
      else { this.wallLevel(key, kind, cx, cz); if (!this.round || this.round.ended) return false; const L = g.flight.live; if (this.keepUp() && L && L.sw) { L.sw.speed *= 0.55; this.round.evs[0].speed = L.sw.speed; } } // drawn to win: time to beat it before it crosses the town
      this.ev0 = this.round.evs[0];
    }
    else return false;
    if (this.rep) this.rep.remove(); this.rep = document.createElement('div'); this.rep.id = 'zd-rep'; this.rep.style.display = 'none'; document.body.appendChild(this.rep);
    this.B = { tap: 0, cd: 1.5, act: 0, held: 0, stuck: 0, sx: 0, sz: 0, air: 0, tellAt: null };
    return true;
  }
  // drawn to win, or to lose to the villain after: she cannot be put down by the disaster
  keepUp() { return this.W.win || this.W.lossAt === 'villain'; }
  biteK() { return this.keepUp() ? 0.6 : this.t < 40 ? 0.8 : 1.1 + (this.t - 40) / 15; }
  bossK() { return this.keepUp() ? 1.8 + Math.max(0, this.t - 90) / 30 : 1.2; } // about a minute and a half to bring a giant down; drawn to lose to it, she is down first
  // a street fight the level starts (a general, the instigators, the one behind the worm or the kaiju; fighttest.js start): who wins it
  fightWatch() { let win = 'h'; if (!this.W.win && this.W.lossAt === 'villain' && !this.vLost) { win = 'v'; this.vLost = true; } return { win, wait: false, skill: 0.6 }; }
  update() {
    const R = this.round; if (!R || R.ended) return; const g = this.g, H = g.horde, F = g.flight; this.t += 1 / 60;
    super.update(); if (!this.round || this.round.ended) return;
    // the general comes in after the crowd (Sean: the villain after the disaster), or after a while anyway
    if (this.genLater && H.active && (H.left - H.machinesLeft() < 25 || this.t > 100)) { H.genQ = [H.genT + 1]; this.genLater = null; }
    // the hero's health and the disaster's, held to the draw
    if (this.keepUp()) { if (H.active && H.h && H.h.hp < 15) H.h.hp = 15; if (F.active && F.fromHorde && F.hull < (F.hullMax || 100) * 0.15) F.hull = (F.hullMax || 100) * 0.15; }
    if (!this.W.win && this.W.lossAt === 'disaster' && R.boss && R.boss.heroHp < 20) R.boss.heroHp = 20; // she falls before it does
    if (this.W.win && this.t > RUSH_T && H.active && !H.over) this.rush(1 / 60);
    if (this.air) { this.airFate(1 / 60); this.airBot(1 / 60); return; }
    // up in the air after a fight in it: back down into the street, or at the next general
    if (F.active && F.fromHorde && F.state === 'fly' && !g.fightTest.active && !F.lock && !F.smashing) { if ((this.B.air += 1 / 60) > 1.2) { this.B.air = 0; if (H.nearGen(F.pos.x, F.pos.z, 240)) F.lockOn(); else if (!this.lockNearest()) F.landHorde(true); } } else if (this.B) this.B.air = 0;
  }
  // up in the air: straight at the nearest of them, and down there (flight.js homeIn lands her within 7 m)
  lockNearest() { const g = this.g, H = g.horde, F = g.flight, P = g.people; if (H.o.boss) return false; let bj = -1, bd = 1e9; for (const j of H.ids) { if (!H.isT(j)) continue; const d = (P.x[j] - F.pos.x) ** 2 + (P.z[j] - F.pos.z) ** 2; if (d < bd) { bd = d; bj = j; } } if (bj < 0) return false; F.lock = { zombie: bj, name: 'it', get x() { return P.x[bj]; }, get z() { return P.z[bj]; }, get y() { return P.y[bj]; }, get gone() { return !H.isT(bj); } }; F.hovering = false; return true; }
  // the storm's health and hers, held to the draw (no hooks in livestorm.js: what each frame took is added to, or put back)
  stormHp() { const L = this.g.flight.live, e = this.ev0; if (L && L.drain && !L.gone) return L.hp; if (e && e.heroHp != null && e.alive !== false && !(e.heroHp <= 0)) return e.heroHp; return null; }
  stormSet(v) { const L = this.g.flight.live, e = this.ev0; if (L && L.drain && !L.gone) L.hp = v; else if (e) e.heroHp = v; }
  airFate(dt) {
    const F = this.g.flight, L = F.live, up = this.keepUp(), sh = this.stormHp();
    if (sh != null) { if (this.lastSh != null && sh < this.lastSh && up && sh > 0) this.stormSet(Math.max(1, sh - (this.lastSh - sh) * Math.max(0, this.t - 50) / 40)); if (!up && this.W.lossAt === 'disaster' && sh < 35) this.stormSet(35); /* a blow can take 30: it must not reach 0 */ if (up && this.W.win && this.t > RUSH_T && (this.rushT = (this.rushT || 0) - dt) <= 0) { this.rushT = 1; if (this.stormHp() > 1) this.stormSet(Math.max(1, this.stormHp() - 4)); if (L && L.laser && !L.drain) { L.pow = 100; L.armed = true; } if (!this.rushSaid) { this.rushSaid = true; F.bigText('THE TEAM SWEEPS IN!', '#8affb0', 1.6); } } this.lastSh = this.stormHp(); } else this.lastSh = null;
    if (F.active && F.state === 'fly') { const mx = F.hullMax || 100; if (up) { if (F.hull < mx * 0.15) F.hull = mx * 0.15; } else if (this.t < 55) { if (F.hull < mx * 0.25) F.hull = mx * 0.25; } else if (this.lastHull != null && F.hull < this.lastHull) { const extra = (this.lastHull - F.hull) * (this.t - 55) / 25; this.lastHull = null; F.damage(extra, 'Too much!'); } /* drawn to lose: a fight first, then worn down */ this.lastHull = F.state === 'fly' ? F.hull : null; if (!up && this.t > 210) F.damage(mx * 2, 'It was too much!'); } else this.lastHull = null;
  }
  // in the air: PUNCH what is thrown at her as it comes in (or GRAB it), the laser when it is full, TAP TAP TAP when it asks, DRAIN when the water is high; nothing coming, LOCK ON (at the face, at the man with the hose, at the villain)
  airBot(dt) {
    const g = this.g, F = g.flight, L = F.live, B = this.B, up = this.keepUp(); if (!F.active || F.state !== 'fly' || g.fightTest.active || !B) return; B.tap -= dt; B.cd -= dt;
    if (L && L.mash) { if (B.tap <= 0) { B.tap = up ? 0.1 + Math.random() * 0.05 : 0.24 + Math.random() * 0.1; L.mash.tap(); } return; }
    if (F.ring) return;
    if (L && L.laser && !L.drain) { if (L.armed && !L.lasing) L.laser(true); else if (L.lasing && !L.armed) L.laser(false); }
    if (L && L.nearest && L.parry && !L.drain) { const q = L.nearest(22); if (q && !q.tried) { q.tried = true; if (Math.random() < (up ? 0.72 : this.t < 55 ? 0.6 : 0.3)) { const d = q.m.position.distanceTo(F.pos); if (d < 15 && L.grab && Math.random() < 0.35) L.grab(); else L.parry(); } return; } }
    if (L && L.drain && L.water > 0.55 && !(L.diveCd > 0)) { L.drain(); return; }
    if (B.cd <= 0) { B.cd = L && L.drain ? 4 + Math.random() * 2 : 3.5 + Math.random() * 2; if (L && L.wall) F.lockOn(); }
  }
  // a level drawn to be won, still going: the rest of the team sweeps in
  rush(dt) {
    const g = this.g, H = g.horde, P = g.people, e = H.o.fleet; if ((this.rushT = (this.rushT || 0) - dt) > 0) return; this.rushT = 1;
    if (!this.rushSaid) { this.rushSaid = true; const m = H.mates[0]; H.say((m ? HS.disp(m).toUpperCase() : 'THE TEAM') + ' SWEEPS IN!', 1.6, '#8affb0'); }
    H.team = 100; let n = 0; for (const j of H.ids) { if (n >= 4) break; if (H.isT(j) && P.st[j] !== undefined && H.dust(j)) n++; }
    if (e) { const s = e.saucers.find((q) => H.machineUp(q)); if (s) e.shootDown(s); else { const t = e.tripods.find((q) => H.machineUp(q)); if (t) t.damage(200); } }
    if (H.o.boss && H.o.boss.alive) H.bossHit(6);
    if (H.fl) for (const q of H.fl.giants) { if (!q.alive || ['rise', 'sink', 'crumble', 'fall'].includes(q.state)) continue; if (q.stage < 3) H.fl.stoneHit(q, q.x, q.size * 0.6, q.z); else H.fl.sweepHit(q.x, q.z, 1, 3, 'blow'); break; }
  }
  // ---------- the bot on foot: what a player would press (horde.js frame calls it before her step)
  bot(dt) {
    const g = this.g, H = g.horde, h = H.h, B = this.B, P = g.people; if (!B || H.over) return; B.tap -= dt; B.cd -= dt; B.held -= dt;
    const fl = H.fl, d2 = (x, z) => Math.hypot(x - h.x, z - h.z), away = (x, z) => { const dx = h.x - x, dz = h.z - z, l = Math.hypot(dx, dz) || 1, s = Math.random() < 0.5 ? 0.5 : -0.5; dashWorld(H, dx / l - dz / l * s, dz / l + dx / l * s); };
    const can = ['idle', 'attack', 'lunge', 'land'].includes(h.state);
    if (h.state === 'clutch') { if (B.tap <= 0) { B.tap = 0.3; H.tap(); } return; } // seized one: thrown
    if (H.held) { if (B.held <= 0) { H.release(); B.held = 0.6; } H.stick = null; return; } // carrying: let it fly (a boulder homes in on the giant)
    // what is about to land on her: dash off it
    if (can || h.state === 'block') {
      const T = H.tell; if (T && T.t > 0.45 && d2(T.x, T.z) < (T.r || 4) + 1.2 && B.tellAt !== T) { B.tellAt = T; away(T.x, T.z); return; }
      if (fl) {
        for (const w of fl.waves) { const d = d2(w.x, w.z), gap = d - w.r; if (gap > 1.5 && gap < 6 && !w.hit) { dashWorld(H, w.x - h.x, w.z - h.z); return; } } // through the quake ring: a dash passes under it
        for (const f of fl.flying) if (!f.air && f.T - f.t < 0.7 && d2(f.x, f.z) < f.r + 2.5) { away(f.x, f.z); return; }
        for (const q of fl.giants) if (q.alive && q.mk && q.at && d2(q.at[0], q.at[1]) < 5) { away(q.at[0], q.at[1]); return; }
      }
    }
    if (!can) return;
    // the boulders back at the big giants
    if (fl && fl.stones.length && fl.giants.some((q) => q.alive && q.stage < 3 && !['sink', 'crumble', 'fall'].includes(q.state))) {
      let s = null, bd = 1e9; for (const q of fl.stones) { const d = d2(q.x, q.z) - q.r; if (d < bd) { bd = d; s = q; } }
      if (s && bd < 40) { if (bd < 2) { H.stick = null; if (H.grabOn()) { B.held = 0.5; return; } } else { stickTo(H, s.x - h.x, s.z - h.z); this.stuckStep(dt); return; } }
    }
    // the team, a power, now and then
    if (B.cd <= 0) { B.cd = 1 + Math.random() * 1.2; const K = H.kit, near = H.nearest(6); if (H.team >= 100 && !H.mateR && H.mates.length && (near || H.o.boss || fl)) { H.teamGo(Math.floor(Math.random() * H.mates.length)); return; } if (near && Math.random() < 0.3 && H.energy >= (H.COST[K.knock] || 99) + 12) { H.cast(K.knock); setTimeout(() => H.castUp(K.knock), 300 + Math.random() * 500); return; } }
    // someone to hit
    const n = H.nearest(11);
    if (n) { H.stick = null; if (B.tap <= 0) { B.tap = 0.24 + Math.random() * 0.14; H.tap(); } return; }
    // the giant, the boss, a tripod's foot: go in and hit
    let tx = null, tz = null, R = 2.6;
    if (fl) { const q = fl.giants.filter((q) => q.alive && q.stage === 3 && !['rise', 'sink', 'crumble'].includes(q.state)).sort((a, b) => d2(a.x, a.z) - d2(b.x, b.z))[0]; if (q) { tx = q.x; tz = q.z; R = q.size * 0.2 + 1.6; } }
    if (tx == null && H.o.boss && H.o.boss.alive) { const q = H.bossPt(); if (q) { tx = q[0]; tz = q[1]; R = (q[2] || 2) + 1.5; } }
    if (tx == null && H.o.fleet) { const f = H.footNear(80); if (f) { tx = f[0]; tz = f[1]; R = 2.5; } }
    if (tx == null) { const far = H.nearest(160); if (far) { tx = far[0]; tz = far[1]; R = 9; } }
    if (tx == null) { const q = (H.gens || []).find((q) => !q.gone && q.ground); if (q) { tx = q.x; tz = q.z; R = 2; } }
    if (tx == null) { H.stick = null; return; }
    if (d2(tx, tz) > R) { const d = d2(tx, tz); if (B.goD == null || d < B.goD - 3) { B.goD = d; B.goT = 0; } else if ((B.goT += dt) > 5 && R >= 9) { B.goT = 0; B.goD = null; H.stick = null; H.takeOff(); return; } /* walled off from them: up, and down by the nearest (update) */ stickTo(H, tx - h.x, tz - h.z); this.stuckStep(dt); return; }
    H.stick = null; B.goD = null; h.yaw = Math.atan2(tx - h.x, tz - h.z); if (B.tap <= 0) { B.tap = 0.28 + Math.random() * 0.14; H.tap(); }
  }
  // walking and getting nowhere (a wall, a car): a dash to one side
  stuckStep(dt) { const B = this.B, h = this.g.horde.h; if ((B.stuck += dt) < 1.4) return; const moved = Math.hypot(h.x - B.sx, h.z - B.sz); B.stuck = 0; B.sx = h.x; B.sz = h.z; if (moved < 1) { const a = Math.random() * 6.28; dashWorld(this.g.horde, Math.cos(a), Math.sin(a)); } }
  // over: what HeroGame.finish does to the town and the engines, none of the saves; then the TV
  finish(won, why) {
    const R = this.round; if (!R || R.ended) return; R.ended = true; const g = this.g, F = g.flight, H = g.horde, D = HS.load(), n = H.kills || 0;
    if (this.squad) { this.squad.end(); this.squad = null; } D.last.hero = this.lastWas;
    if (F.storm) { F.storm.dispose(); F.storm = null; } if (this.rep) { this.rep.remove(); this.rep = null; }
    if (g.fightTest.active) g.fightTest.stop(true); if (F.live && F.live.dispose) F.live.dispose(); F.wallE = null; this.air = false;
    if (g.base && g.base.active) { g.base.level = null; g.base.stop(true); }
    if (H.active) H.stop(true); if (H.flying) { H.flying = false; if (H.el) H.el.remove(); } if (F.active) F.stop(true); F.heroGame = false; F.inLevel = false; F.onStopped = null; F.fromHorde = null;
    for (const e of R.evs) { if (!e.alive) continue; if (e.own) { e.alive = false; if (e.cleanup) { e.cleanup(); e.cleanup = null; } continue; } if (e.type === 'villains') { for (const w of e.who) if (!w.gone) { w.state = 'gone'; w.rig.root.visible = false; } } else endDisaster(e); }
    for (const q of H.gens || []) if (q.rig) g.disasters.ctx.scene.remove(q.rig.root);
    if (this.labWas) Object.assign(LAB, this.labWas, { spotK: 1, toughK: 1, powerK: 1, energyK: 1, teamK: 1 });
    g.people.heroOnly = false; this.round = null; this.tv.levelEnd(won, why, { kills: n });
  }
  // the TV leaves mid-level (Next town, the menu)
  abort() { if (this.round && !this.round.ended) { const tv = this.tv; this.tv = { levelEnd() {} }; this.finish(false, 'off air'); this.tv = tv; } }
}
