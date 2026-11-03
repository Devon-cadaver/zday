// A hero's powers against the disasters (HERO-PLAN item 4). In free flight two buttons on the bar: the power (it goes round them) and
// Use. Use works on the nearest disaster (the ones that fill the town count from anywhere; the others within REACH). Each disaster has
// a meter; what beats it (WEAK) takes a big bite, what it shrugs off a small one, with a hint. Empty, the disaster ends its own way
// (finish). Villains are fought with Lock on instead.
import * as THREE from 'three';
import { sfx } from './audio.js';
import { LAB } from './lab.js';
import { loadKit, MELEES } from './kit.js';

export const POWER = {
  freeze: { name: 'Freeze', icon: '❄', col: [0.5, 1.8, 3.0], snd: 'glass' }, fire: { name: 'Fire', icon: '🔥', col: [3.2, 1.2, 0.3], snd: 'whoomph' }, lightning: { name: 'Lightning', icon: '⚡', col: [1.8, 2.4, 4], snd: 'zap' }, sonic: { name: 'Sonic clap', icon: '🔊', col: [1.2, 1.6, 2.2], snd: 'boom', ring: 1 },
  gravity: { name: 'Gravity pulse', icon: '🪐', col: [1.2, 0.9, 2.0], snd: 'warp', ring: 1 }, laser: { name: 'Laser', icon: '🔴', col: [2.4, 0.3, 1.5], snd: 'laser' }, kick: { name: 'Flying kick', icon: '🦶', col: [1.8, 1.3, 0.5], snd: 'crash', ring: 1 }, gust: { name: 'Gust', icon: '🌬', col: [1.4, 1.5, 1.5], snd: 'whoomph', ring: 1 }, wind: { name: 'Wind blast', icon: '🌬', col: [1.4, 1.5, 1.5], snd: 'whoomph', ring: 1 }, shield: { name: 'Shield', icon: '🛡', col: [0.6, 1.4, 2.4], snd: 'chime', ring: 1 }, tk: { name: 'Telekinesis', icon: '🧠', col: [1.4, 0.8, 2.2], snd: 'warp' },
};
// what beats what (HERO-PLAN's table): 3 a big bite, 2 a fair one, anything else 0.5
export const WEAK = {
  tornado: { wind: 3, freeze: 2 }, haboob: { sonic: 3, wind: 3 }, flood: { freeze: 3, tk: 2 }, tsunami: { freeze: 3, shield: 2 }, quake: { tk: 3, gravity: 2 }, sinkhole: { gravity: 3, tk: 2 }, volcano: { freeze: 3, gravity: 2 }, meteor: { tk: 3, gravity: 3, shield: 2 },
  blackhole: { gravity: 3, tk: 2 }, rift: { tk: 3, lightning: 2 }, aliens: { lightning: 3, gravity: 2 }, worm: { sonic: 3, lightning: 2, freeze: 2 }, kaiju: { lightning: 3, fire: 2 }, spill: { sonic: 3, lightning: 2, wind: 2 }, riot: { sonic: 3, wind: 2 }, nuclear: { shield: 3, tk: 3 }, meltdown: { shield: 3, freeze: 2 },
  solar: { shield: 3 }, coldwave: { fire: 3, shield: 2 }, plant: { fire: 3, freeze: 2 },
};
const MELEE_ON = { kaiju: 2, worm: 2, riot: 2, aliens: 2, plant: 2, meteor: 1, tornado: 1, rift: 1, blackhole: 0.5 }, LASER_ON = { aliens: 3, kaiju: 2, worm: 2, rift: 2, plant: 2, meteor: 2, blackhole: 1, tornado: 1 };
for (const t in WEAK) { WEAK[t].gust = WEAK[t].wind || 0.5; WEAK[t].kick = MELEE_ON[t] || 0.5; WEAK[t].ram = MELEE_ON[t] || 0.5; WEAK[t].laser = LASER_ON[t] || 0.5; }
const NAME = { tornado: 'tornado', haboob: 'dust storm', flood: 'flood', tsunami: 'tsunami', quake: 'earthquake', sinkhole: 'sinkhole', volcano: 'volcano', meteor: 'meteor', blackhole: 'black hole', rift: 'rift', aliens: 'invasion', worm: 'giant worm', kaiju: 'kaiju', spill: 'outbreak', riot: 'riot', nuclear: 'nuclear attack', meltdown: 'meltdown', solar: 'solar storm', coldwave: 'cold wave', plant: 'killer plant' };
const REACH = 320, WHOLE = { haboob: 1, flood: 1, tsunami: 1, solar: 1, coldwave: 1, meltdown: 1, aliens: 1 };
const where = (e) => (e.tw ? e.tw : e.x != null ? e : null);
// the disaster over, its own way; time run out for those that have only a clock
export function finish(e) {
  if (e.type === 'tornado') e.tw.life = 0; else if (e.type === 'kaiju') e.retreat('The kaiju is retreating from the hero'); else if (e.type === 'blackhole') e.collapse(); else if (e.type === 'plant') e.wither('burned'); else if (e.type === 'rift') e.close('hero'); else if (e.type === 'riot') e.end(true);
  else if (e.type === 'flood') e.t = Math.max(e.t, e.rise + e.hold); else if (e.type === 'tsunami') { if (e.phase !== 'recede') { e.D.water.front = null; if (e.wave) e.wave.visible = false; e.phase = 'recede'; e.recedeT = 35; } } else if (e.type === 'volcano') { e.alive = false; if (e.vent) e.vent.cool = 0.03; } else if (e.vanish) { e.vanish(); e.alive = false; }
  else if (e.type === 'aliens') e.t = Math.max(e.t, e.life + 1); else if (e.endT != null) e.t = Math.max(e.t, e.endT); else if (e.dur != null) e.t = Math.max(e.t, e.dur); else if (e.life != null) e.t = Math.max(e.t, e.life); else e.alive = false;
}
export class HeroPower {
  constructor(F) { this.F = F; this.i = 0; this.cool = 0; this.fx = []; this.geo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true).translate(0, 0.5, 0); this.up = new THREE.Vector3(0, 1, 0); this.d = new THREE.Vector3(); }
  list() { if (this.F.heroGame) { const k = loadKit(); return [k.stun, k.knock]; } const on = Object.keys(POWER).filter(k => LAB.moves[k]); return on.length ? on : Object.keys(POWER); } // the hero game: the kit's two
  get id() { const L = this.list(); return L[this.i % L.length]; }
  cycle() { this.i = (this.i + 1) % this.list().length; this.show(); }
  show() { const P = POWER[this.id]; if (this.F.powerBtn) this.F.powerBtn.textContent = P.icon + ' ' + P.name; }
  target() { const F = this.F; let best = null, bd = 1e9; for (const e of F.g.disasters.list) { if (!e.alive || !WEAK[e.type] || e.heroHp <= 0) continue; const w = where(e), d = w && w.x != null ? Math.hypot(w.x - F.pos.x, w.z - F.pos.z) : 9e8; if (d > REACH && !WHOLE[e.type]) continue; if (d < bd) { bd = d; best = e; } } return best; }
  use() {
    const F = this.F, g = F.g; if (this.cool > 0 || F.state !== 'fly') return false; this.cool = 1.3; const id = this.id, P = POWER[id], H0 = F.fromHorde; const froze = !!(H0 && id === loadKit().stun && H0.freezeIt()); if (H0 && H0.o.fleet) { const mc = H0.nearMachine(F.pos.x, F.pos.y, F.pos.z, 110); this.show(); F.punch = 0.4; sfx(P.snd, F.pos.x, F.pos.y, F.pos.z, { gain: 0.8 }); if (!mc) { this.effect(id, P, F.pos.x + Math.cos(F.yaw) * 40, Math.max(2, F.pos.y - 10), F.pos.z - Math.sin(F.yaw) * 40); F.tip('Nothing near enough: get closer to a saucer or a tripod'); return false; } this.effect(id, P, mc.m.x, mc.m.y, mc.m.z); H0.hitMachine(mc.m, (WEAK.aliens[id] || 0.5) * 6, 'POWER'); return true; } const e = this.target();
    const fx = Math.cos(F.yaw), fz = -Math.sin(F.yaw), w = e && where(e), tx = w && w.x != null ? w.x : F.pos.x + fx * 40, tz = w && w.x != null ? w.z : F.pos.z + fz * 40, ty = w && w.x != null ? Math.max(2, Math.min(40, (w.y || 0) + 8)) : Math.max(2, F.pos.y - 10);
    this.show(); F.punch = 0.4; sfx(P.snd, F.pos.x, F.pos.y, F.pos.z, { gain: 0.8 }); this.effect(id, P, tx, ty, tz);
    if (!e) { F.tip('Nothing near enough to use ' + P.name + ' on'); return false; }
    const W = WEAK[e.type], k = W[id] || 0.5; const bossF = F.fromHorde && F.fromHorde.o.boss === e; if (bossF && Math.hypot(tx - F.pos.x, tz - F.pos.z) > 90) { F.tip('Too far: get closer to it, or Lock on'); return false; } const ringF = F.storyTornado && F.storyTornado() === e; if (ringF) { F.tip('It shrugs that off: Lock on and unwind it'); return true; } e.heroHp = (e.heroHp ?? 100) - k * 7 * (bossF ? 0.12 : 1); // a giant fight is not won by pressing Use from the air LAB.stats.saved = LAB.stats.saved || 0;
    if (e.type === 'plant' && id === 'fire') g.disasters.burnPlants(tx, tz, 14, 2);
    if (e.type === 'kaiju' && e.damage) e.damage(k * 20);
    if (e.heroHp <= 0) { finish(e); LAB.stats.stopped = (LAB.stats.stopped || 0) + 1; g.disasters.flash(0.2); F.tip('You stopped the ' + NAME[e.type] + '!'); if (F.onStopped) F.onStopped(e); return true; }
    const left = Math.round(e.heroHp), best = Object.keys(W).filter(q => W[q] === 3).map(q => POWER[q].name)[0];
    F.tip(froze ? 'Frozen! Hit it now' : k >= 3 ? 'Direct hit on the ' + NAME[e.type] + '! ' + left + '% left' : k >= 2 ? 'That hurts the ' + NAME[e.type] + '. ' + left + '% left' : P.name + ' barely touches the ' + NAME[e.type] + '. Try ' + best + '. ' + left + '% left');
    return true;
  }
  effect(id, P, x, y, z) {
    const F = this.F, g = F.g, D = g.disasters, col = new THREE.Color(P.col[0], P.col[1], P.col[2]);
    if (P.ring) D.brawl.stunts.ring(id === 'shield' ? F.pos.x : x, id === 'shield' ? F.pos.y : y, id === 'shield' ? F.pos.z : z, id === 'shield' ? 14 : 26, 0.6, col, 0.8);
    if (id === 'shield') return;
    const m = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); m.frustumCulled = false; m.renderOrder = 7; D.ctx.scene.add(m);
    const ax = F.pos.x, ay = F.pos.y + 1.2, az = F.pos.z; this.d.set(x - ax, y - ay, z - az); const len = this.d.length() || 1; m.position.set(ax, ay, az); m.quaternion.setFromUnitVectors(this.up, this.d.normalize()); m.scale.set(id === 'lightning' ? 0.35 : 0.8, len, id === 'lightning' ? 0.35 : 0.8); this.fx.push({ m, t: 0 });
    if (id === 'fire') g.fire.burst(x, y, z, 12, 2); else if (id === 'freeze') g.fire.spray(x, z, y, 8, 4, 1); else if (id === 'lightning') { g.fire.burst(x, y, z, 8, 1.4); D.flash(0.15); } else g.fire.spray(x, z, y, 6, 4, 1);
  }
  // flown through a disaster's heart at speed: a blow of the melee slot's (the hammer fists hit hardest), once a second
  ram(h) { const F = this.F; this.ramT = Math.max(0, (this.ramT || 0) - h); if (this.ramT > 0 || F.state !== 'fly' || !F.heroGame || F.speed < 22) return; { const H0 = F.fromHorde; if (H0 && H0.o.fleet) { const mc = H0.nearMachine(F.pos.x, F.pos.y, F.pos.z, 12); if (mc && !(F.lock && F.lock.machine)) { this.ramT = 0.8; F.punch = 0.4; H0.hitMachine(mc.m, 25, 'RAM'); } return; } } if (F.lock && F.lock.worm) return; const e = this.target(); if (!e) return; if (F.storyTornado && F.storyTornado() === e) return; const w = where(e), d = w && w.x != null ? Math.hypot(w.x - F.pos.x, w.z - F.pos.z) : 9e8; if (d > 14 || F.pos.y > ((w.y || 0) + 40)) return; this.ramT = 1; const k = WEAK[e.type].ram || 0.5, m = loadKit().melee, pw = m === 'hammer' ? 1.4 : m === 'flurry' ? 0.8 : 1; e.heroHp = (e.heroHp ?? 100) - k * 6 * pw; F.punch = 0.4; F.g.disasters.flash(0.08); sfx('crash', F.pos.x, F.pos.y, F.pos.z, { gain: 0.9, rate: 0.9 }); F.g.disasters.brawl.stunts.ring(F.pos.x, F.pos.y, F.pos.z, 8, 0.3, new THREE.Color(1.8, 1.4, 0.6), 0.8); if (e.type === 'kaiju' && e.damage) e.damage(k * 15 * pw); if (e.heroHp <= 0) { finish(e); LAB.stats.stopped = (LAB.stats.stopped || 0) + 1; F.g.disasters.flash(0.2); F.tip('You rammed the ' + NAME[e.type] + ' down!'); if (F.onStopped) F.onStopped(e); return; } F.tip((k >= 2 ? 'RAMMED the ' : 'Rammed the ') + NAME[e.type] + ' with ' + MELEES[m].name + '! ' + Math.round(e.heroHp) + '% left'); }
  step(h) { this.ram(h); this.cool = Math.max(0, this.cool - h); if (this.fx.length) { for (const f of this.fx) { f.t += h; f.m.material.opacity = Math.max(0, 0.8 * (1 - f.t / 0.35)); if (f.t > 0.35) { f.done = true; f.m.parent.remove(f.m); f.m.material.dispose(); } } this.fx = this.fx.filter(f => !f.done); } }
  dispose() { for (const f of this.fx) { f.m.parent.remove(f.m); f.m.material.dispose(); } this.fx = []; this.geo.dispose(); }
}

if (typeof window !== "undefined") window.__WEAK = WEAK; // the test scripts read it
