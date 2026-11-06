// Watch's fights (tv.js, Sean's plan item 9): the street fight (fighttest.js) with nobody at the controls. The bot presses what a player would
// (tap, swipe, hold, GRAB, the two powers, TEAM, a finisher) for the fighter on the hero side; the foe has its own AI as always.
// The result is drawn first at the odds the viewers bet on (T.o.watch.win: 'h' or 'v'), and the fight is steered to it without showing:
// the one who is to win takes less while behind and is never brought below a tenth of their health while the other still stands, so a
// fight can swing either way before it ends the way it was drawn.
import { FIN_SCRIPTS } from './finishers.js';

const WINDS = ['wind', 'strike', 'rush'];
// the stick that walks her towards (wx, wz) in the world, in the screen's frame the way stickDir reads it
export function stickTo(T, wx, wz) {
  const m = T.ctx.camera.matrixWorld.elements, al = Math.hypot(m[0], m[2]) || 1, ax = m[0] / al, az = m[2] / al, fl = Math.hypot(m[8], m[10]) || 1, fx = -m[8] / fl, fz = -m[10] / fl, l = Math.hypot(wx, wz) || 1;
  T.stick = [(wx * ax + wz * az) / l, -(wx * fx + wz * fz) / l];
}
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export function botStep(T, dt) {
  const W = T.o.watch, h = T.h, v = T.v, B = T.bot || (T.bot = { cd: 1.2, tap: 0, fin: 0, drag: 0, up: null, read: null, clutch: 0, chg: 0, k0: T.kAI }), d = T.dist(), fh = h.hp / h.hpMax, fv = v.hp / v.hpMax;
  // the one drawn to win digs in while behind; the other tires while ahead (her guard drops, the foe's AI sharpens)
  const sk0 = W.skill ?? 0.7, sk = W.win === 'h' ? (fh < fv + 0.1 ? Math.min(0.95, sk0 + 0.25) : sk0) : (fh > fv - 0.1 ? sk0 * 0.35 : sk0);
  T.kAI = W.win === 'v' && fv < fh + 0.1 ? Math.min(1, B.k0 + 0.5) : B.k0;
  const slack = W.win === 'v' && fh > fv - 0.1; // drawn to lose and not behind: no shield, no team, a guard that is mostly down, slow to break free
  const coast = W.win === 'h' && fh > fv + 0.3; // drawn to win and well clear: she eases off and lets them back in it
  W.t = (W.t || 0) + dt; B.cd -= dt; B.tap -= dt; fateFloor(T);
  if (B.up && (B.up.t -= dt) <= 0) { T.castUp(B.up.id); B.up = null; } // a charged power let go
  if (T.over || T.hDazed) { T.stick = null; return; }
  if (h.state === 'grabbed') { if (B.tap <= 0) { B.tap = slack ? 0.3 : 0.1 + (1 - sk) * 0.12 + Math.random() * 0.05; T.tap(); } return; } // held: mash to break free
  // the foe at zero: a finisher from her two, a scripted one by choice (they run themselves; taps add to the last blow)
  if (v.state === 'dazed' && !T.finKind) { T.stick = null; if ((B.fin += dt) > 0.5) { B.fin = 0; const k = T.kit, opts = [k.fin1, k.fin2].filter(Boolean), s = opts.filter((f) => FIN_SCRIPTS[f]); T.finPick(pick(s.length && Math.random() < 0.8 ? s : opts)); } return; }
  if (T.finKind) { T.stick = null; if (T.finRun && B.tap <= 0) { B.tap = 0.16 + Math.random() * 0.1; T.tap(); } if (h.state === 'drag') { if ((B.drag += dt) > 1.4 + Math.random() * 0.6) { B.drag = 0; T.release(); } } else B.drag = 0; return; }
  if (h.state === 'clutch') { if ((B.clutch += dt) > 0.3) { B.clutch = 0; T.grabPick(pick(['suplex', 'slam', 'throw', 'throw', 'drag'])); } return; }
  if (h.state === 'spin') { if (h.t > 1.2) T.toss(); else if (B.tap <= 0) { B.tap = 0.12; T.tap(); } return; }
  if (h.state === 'ankles') { if (B.tap <= 0) { B.tap = 0.3; T.tap(); } return; }
  if (h.state === 'charge') { if ((B.chg += dt) > 0.5) { B.chg = 0; T.release(); } return; } // a heavy wound up (GRAB out of reach): let it go
  B.chg = 0;
  // the foe winding up: read once each time, block or dash at the last moment, or be caught
  if (v.state === 'wind') {
    if (B.read !== v.T + ':' + v.kind) { B.read = v.T + ':' + v.kind; const good = Math.random() < (slack ? 0.12 : coast ? 0.25 : 0.3 + 0.55 * sk); B.act = !good ? null : v.kind === 'grab' || v.kind === 'charge' || v.kind === 'shot' || Math.random() < 0.45 ? 'dash' : 'block'; }
    const near = d < (v.kind === 'charge' || v.kind === 'shot' ? 18 : 5.5);
    if (B.act && near && v.T - v.t < 0.24) {
      if (B.act === 'block' && T.energy > 8) { T.hold(); } else { const ax = h.x - v.x, az = h.z - v.z, l = Math.hypot(ax, az) || 1, s = Math.random() < 0.5 ? 1 : -1, wx = (-az / l) * s * 0.8 + (ax / l) * 0.6, wz = (ax / l) * s * 0.8 + (az / l) * 0.6; dashWorld(T, wx, wz); }
      B.act = null; return;
    }
  } else B.read = null;
  if (h.state === 'block' && !WINDS.includes(v.state)) T.release();
  if (T.counterT > 0 && B.tap <= 0) { B.tap = 0.1; T.tap(); return; } // dashed in time: the counter
  // now and then: the team, a power, a grab
  if (B.cd <= 0 && ['idle', 'attack', 'land'].includes(h.state) && !slack) {
    B.cd = 0.7 + Math.random() * 1.1; const q = Math.random(), K = T.kit;
    if (T.team >= 100 && !T.mateR && T.mates.length && q < 0.6) { T.teamGo(Math.floor(Math.random() * T.mates.length)); return; }
    if (q < 0.22 && T.energy >= T.COST[K.stun] + 10 && T.canTarget(K.stun)) { T.cast(K.stun); B.up = { id: K.stun, t: 0.15 }; return; }
    if (q < 0.4 && T.energy >= T.COST[K.knock] + 10 && T.canTarget(K.knock)) { T.cast(K.knock); B.up = { id: K.knock, t: 0.3 + Math.random() * 0.8 }; return; }
    if (q < 0.55 && d < 3 && !['down', 'air', 'flung', 'getup'].includes(v.state)) { if (T.grabOn()) return; }
    if (q < 0.65 && v.state === 'down' && v.hp > 0) { if (T.grabOn()) return; } // by the feet
  }
  // in to hit: walk in from far, then the combo (a tap from a little way off lunges the rest)
  if (d > 7 && ['idle'].includes(h.state)) { stickTo(T, v.x - h.x, v.z - h.z); return; }
  T.stick = null;
  if (B.tap <= 0 && ['idle', 'attack', 'lunge', 'land', 'dodge', 'jugWait'].includes(h.state) && !['down', 'getup'].includes(v.state)) { B.tap = (0.24 + (1 - sk) * 0.18 + Math.random() * 0.12) * (coast ? 1.5 : 1); T.tap(); }
}
// a swipe that sends her (wx, wz) in the world: the inverse of swipe()'s screen to world
export function dashWorld(T, wx, wz) {
  const m = T.ctx.camera.matrixWorld.elements, al = Math.hypot(m[0], m[2]) || 1, ax = m[0] / al, az = m[2] / al, bl = Math.hypot(m[8], m[10]) || 1, bx = -m[8] / bl, bz = -m[10] / bl;
  T.swipe((wx * ax + wz * az) * 40, -(wx * bx + wz * bz) * 40);
}
const FLOOR = 0.1;
// the drawn winner held off the floor while the other is still up (blocks and a few blows take health straight off)
function fateFloor(T) { const W = T.o.watch, win = W.win === 'h' ? T.h : T.v, lose = win === T.h ? T.v : T.h; if (lose.hp > 0 && win.hp < win.hpMax * FLOOR) win.hp = win.hpMax * FLOOR; }
// a blow on f (fighttest.js hurtH, hurtV): the drawn winner takes less while behind and never goes under the floor; the other takes more
// the further it is ahead, less while the winner is well clear (so it stays close), and more and more once the fight passes a minute
export function fateN(T, f, n) {
  const W = T.o.watch; if (!W || !W.win || !(n > 0) || n >= 9000) return n; const win = W.win === 'h' ? T.h : T.v, lose = win === T.h ? T.v : T.h, fw = win.hp / win.hpMax, fl = lose.hp / lose.hpMax;
  if (f === win) { n *= fw > fl + 0.15 ? 1 : fw > fl ? 0.7 : 0.45; if (lose.hp > 0) n = Math.min(n, Math.max(0, win.hp - win.hpMax * FLOOR)); return n; }
  let k = 1 + 1.2 * Math.max(0, fl - fw); if (fw > fl + 0.25) k *= 0.6; k *= 1 + Math.max(0, (W.t || 0) - 60) / 25;
  return n * k;
}
