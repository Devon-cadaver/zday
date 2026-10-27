// Sound, all of it synthesized in code (no sound files to download): explosions
// with a deep sub-bass thump under a roaring fireball and a long rolling rumble,
// car crashes (a dull hit, sheet metal ringing as it folds, a window and a
// headlamp going, a scrape down the road), windows shattering (a crack, a burst
// of glass shards ringing out, then the tinkle of the pieces landing), collapses,
// gunfire echoing down the streets, thunder. Each is rendered once into a few
// short sample buffers (variations, so repeats do not sound alike) in the moments
// after sound is first switched on; playing one is then a single buffer voice,
// cheap even on a phone. Sounds sit in the world: quieter the further they are
// from the camera and muffled with distance (the bass carries, the crack does
// not), panned by where they are on screen. Loops - the city's hum, wind, rushing
// water, fire, rain, rotor blades, a siren - fade in and out with what is near.
import * as THREE from 'three';

const SR = 24000;
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const white = () => rnd() * 2 - 1;
const len = (sec) => new Float32Array(Math.ceil(sec * SR));

// ---------- a little DSP: noise, filters, envelopes, ringing partials
function noise(n, kind = 'white') {
  const x = new Float32Array(n);
  if (kind === 'white') for (let i = 0; i < n; i++) x[i] = white();
  else if (kind === 'brown') { let b = 0; for (let i = 0; i < n; i++) { b = (b + 0.02 * white()) / 1.02; x[i] = b * 3.5; } }
  else { let b0 = 0, b1 = 0, b2 = 0; for (let i = 0; i < n; i++) { const w = white(); b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; x[i] = (b0 + b1 + b2 + w * 0.1848) * 0.18; } }
  return x;
}
// RBJ biquad, in place: 'lp', 'hp' or 'bp'
function biquad(x, type, f, q = 0.707) {
  const w = 2 * Math.PI * Math.min(f, SR * 0.45) / SR, c = Math.cos(w), s = Math.sin(w), a = s / (2 * q);
  let b0, b1, b2;
  if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; } else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; } else { b0 = a; b1 = 0; b2 = -a; }
  const a0 = 1 + a, a1 = -2 * c / a0, a2 = (1 - a) / a0; b0 /= a0; b1 /= a0; b2 /= a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const v = x[i], y = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = v; y2 = y1; y1 = y; x[i] = y; }
  return x;
}
// a low-pass whose cutoff moves (f(t) in Hz), two poles
function sweep(x, f) {
  let y = 0, z = 0, a = 0;
  for (let i = 0; i < x.length; i++) { if ((i & 31) === 0) a = 1 - Math.exp(-2 * Math.PI * Math.min(f(i / SR), SR * 0.45) / SR); y += a * (x[i] - y); z += a * (y - z); x[i] = z; }
  return x;
}
// shape: rise over atk, die away with time constant dec, starting at t0
function env(x, atk, dec, t0 = 0) {
  for (let i = 0; i < x.length; i++) { const t = i / SR - t0; x[i] *= t < 0 ? 0 : Math.min(1, t / atk) * Math.exp(-t / dec); }
  return x;
}
function add(dst, src, t0 = 0, g = 1) { const o = Math.floor(t0 * SR); for (let i = 0; i < src.length && o + i < dst.length; i++) if (o + i >= 0) dst[o + i] += src[i] * g; return dst; }
// a struck partial: a decaying sine from t0 (a two-pole resonator, so it costs a multiply-add a sample)
function ping(x, t0, f, dec, amp) {
  const i0 = Math.floor(t0 * SR); if (i0 >= x.length || f >= SR * 0.48) return;
  const w = 2 * Math.PI * f / SR, r = Math.exp(-1 / (dec * SR)), c = 2 * r * Math.cos(w), r2 = r * r, end = Math.min(x.length, i0 + Math.ceil(dec * SR * 5));
  let a = 0, b = amp * r * Math.sin(w);
  for (let i = i0 + 1; i < end; i++) { x[i] += b; const n = c * b - r2 * a; a = b; b = n; }
}
// a falling sine: a thump
function thump(x, t0, f0, f1, fall, dec, amp) {
  let ph = 0; const i0 = Math.floor(t0 * SR), end = Math.min(x.length, i0 + Math.ceil(dec * SR * 6));
  for (let i = i0; i < end; i++) { const t = (i - i0) / SR, f = f1 + (f0 - f1) * Math.exp(-t / fall); ph += 2 * Math.PI * f / SR; x[i] += Math.sin(ph) * Math.exp(-t / dec) * Math.min(1, t / 0.003) * amp; }
}
// a short burst of filtered noise
function grain(x, t0, dur, f, q, amp, type = 'bp') { const g = biquad(noise(Math.ceil(dur * SR)), type, f, q); env(g, Math.min(0.002, dur * 0.2), dur * 0.35); add(x, g, t0, amp); }
function clip(x, drive) { const k = Math.tanh(drive); for (let i = 0; i < x.length; i++) x[i] = Math.tanh(x[i] * drive) / k; return x; }
function norm(x, peak = 0.9) { let m = 0; for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i])); if (m > 0) for (let i = 0; i < x.length; i++) x[i] *= peak / m; return x; }
function fadeOut(x, sec) { const n = Math.min(x.length, Math.ceil(sec * SR)); for (let i = 0; i < n; i++) x[x.length - 1 - i] *= i / n; return x; }
// seamless loop: the tail crossfaded into the head
function loopify(x, sec) { const F = Math.ceil(sec * SR), n = x.length - F, o = new Float32Array(n); for (let i = 0; i < n; i++) o[i] = x[i]; for (let i = 0; i < F; i++) { const k = i / F; o[i] = x[i] * k + x[n + i] * (1 - k); } return o; }

// ---------- the sounds
// an explosion. size 0 a car or a grenade, 1 an airstrike or a gas main, 2 a nuke
function boom(size) {
  const L = [1.8, 3.4, 8][size], x = len(L);
  thump(x, 0, [120, 95, 70][size], [42, 34, 26][size], [0.08, 0.12, 0.3][size], [0.3, 0.55, 1.4][size], 1.4); // the sub-bass punch
  thump(x, 0.01, [70, 58, 44][size], [30, 26, 20][size], 0.2, [0.45, 0.9, 2.2][size], 0.8);
  const punch = len(1); thump(punch, 0, 190, 70, 0.03, [0.09, 0.14, 0.3][size], 1); clip(punch, 5); biquad(punch, 'lp', 900); add(x, punch, 0, [0.9, 1.1, 1.2][size]); // overdriven, so its harmonics carry the bass even on a phone speaker
  const body = noise(x.length, 'brown'); sweep(body, (t) => 110 + [2400, 2800, 2200][size] * Math.exp(-t / [0.12, 0.22, 0.6][size])); env(body, 0.002, [0.4, 0.9, 2.8][size]); add(x, body, 0, 3.2); // the fireball's roar, closing down
  const crack = biquad(noise(Math.ceil(0.06 * SR)), 'hp', 700); env(crack, 0.0005, [0.01, 0.016, 0.03][size]); add(x, crack, 0, [0.9, 1.1, 1.2][size]);
  const rum = biquad(noise(x.length, 'brown'), 'lp', [110, 90, 70][size]); // rumbling on, rolling round the buildings
  for (let i = 0; i < rum.length; i++) { const t = i / SR; rum[i] *= (1 - Math.exp(-t / 0.15)) * Math.exp(-t / [0.6, 1.4, 3.6][size]) * (0.7 + 0.3 * Math.sin(t * 5.3 + Math.sin(t * 1.7) * 2)); }
  add(x, rum, 0, [3, 4, 5.5][size]);
  if (size === 2) { const wave = biquad(noise(x.length, 'brown'), 'lp', 400); env(wave, 0.5, 1.6, 0.4); add(x, wave, 0, 2.5); } // the pressure wave rolling in behind the flash
  const pops = [16, 45, 90][size]; // debris coming down, things popping in the heat
  for (let k = 0; k < pops; k++) { const t = 0.12 + Math.pow(rnd(), 1.4) * L * 0.75; grain(x, t, 0.01 + rnd() * 0.04, 400 + rnd() * 2600, 1.2, 0.5 * (1 - t / L)); }
  return norm(clip(x, 1.8), 0.95);
}
// glass breaking. size 0 a car window or a pane, 1 a whole shopfront or a building's worth
function glass(size) {
  const L = [1.1, 2.0][size], x = len(L);
  const tick = biquad(noise(Math.ceil(0.012 * SR)), 'hp', 2500); env(tick, 0.0003, 0.003); add(x, tick, 0, 1); // the break
  const n = [55, 170][size], spread = [0.22, 0.45][size];
  for (let k = 0; k < n; k++) { // shards ringing out, most in the first instant
    const t = Math.pow(rnd(), 2.3) * spread, f = 2200 + Math.pow(rnd(), 0.8) * 8200, dec = 0.012 + rnd() * 0.06, a = (0.2 + rnd() * 0.7) * (1 - t * 0.8);
    ping(x, t, f, dec, a); ping(x, t, f * 2.76, dec * 0.45, a * 0.3);
  }
  const wash = biquad(noise(Math.ceil(0.4 * SR)), 'bp', 5200, 0.7); env(wash, 0.001, [0.05, 0.1][size]); add(x, wash, 0, 0.7); // the burst of it
  for (let k = 0; k < [22, 70][size]; k++) { const t = [0.3, 0.45][size] + rnd() * (L - 0.6); ping(x, t, 3000 + rnd() * 6000, 0.008 + rnd() * 0.03, 0.18 * (1.1 - t / L)); } // pieces landing
  return norm(x, 0.9);
}
// a car crash: the hit, the crumple of sheet metal, glass, a scrape
function crash() {
  const L = 1.7, x = len(L);
  thump(x, 0, 85, 42, 0.04, 0.09, 1.3);
  const hit = biquad(noise(Math.ceil(0.12 * SR)), 'lp', 500); env(hit, 0.001, 0.035); add(x, hit, 0, 1.4);
  const modes = []; for (let m = 0; m < 22; m++) modes.push([170 * Math.pow(16, rnd()), 0.025 + rnd() * 0.11]); // inharmonic panel modes, 170 Hz to 2.7 kHz, damped (crumpled, not a bell)
  for (let s = 0; s < 14; s++) { const t = Math.pow(rnd(), 1.8) * 0.26, a = 0.3 * (1 - t * 2.5); for (const [f, d] of modes) ping(x, t, f * (1 + (rnd() - 0.5) * 0.08), d, a * rnd()); } // struck again and again as it folds, never quite the same note
  for (let k = 0; k < 70; k++) { const t = Math.pow(rnd(), 1.6) * 0.34; grain(x, t, 0.006 + rnd() * 0.022, 600 + rnd() * 3800, 1.4, 0.6 * (1 - t * 2)); } // plastic and metal crumpling
  add(x, glass(0), 0.012, 0.45); // a window and a headlamp going
  const scr = biquad(noise(Math.ceil(0.9 * SR), 'pink'), 'bp', 1300, 1.6); // a scrape down the road
  for (let i = 0; i < scr.length; i++) { const t = i / SR; scr[i] *= (0.4 + 0.6 * rnd()) * Math.min(1, t / 0.05) * Math.exp(-t / 0.28); }
  add(x, scr, 0.14, 0.9);
  return norm(clip(x, 1.4), 0.95);
}
// a building coming down: a deep crack, the roar of it falling, concrete grinding, glass, chunks landing
function collapse() {
  const L = 5, x = len(L);
  thump(x, 0, 70, 30, 0.2, 0.6, 1.2);
  const roar = sweep(noise(x.length, 'brown'), (t) => 140 + 260 * Math.exp(-t / 1.5)); env(roar, 0.35, 1.7); add(x, roar, 0, 4);
  for (let k = 0; k < 90; k++) { const t = rnd() * 3.4; grain(x, t, 0.02 + rnd() * 0.08, 250 + rnd() * 1200, 1, 0.5 * Math.exp(-t / 2)); } // concrete grinding
  for (let k = 0; k < 22; k++) { const t = 0.4 + rnd() * 3.4; thump(x, t, 120 + rnd() * 60, 50, 0.03, 0.07, 0.5 * Math.exp(-t / 2.5)); } // chunks hitting the street
  add(x, glass(1), 0.08, 0.35);
  return norm(clip(x, 1.5), 0.92);
}
// a gunshot in a street: the crack, the body of it, then the buildings throwing it back
function shot(rifle) {
  const L = 1.0, x = len(L), s = len(0.12);
  const crack = biquad(noise(Math.ceil(0.01 * SR)), 'hp', 1500); env(crack, 0.0002, 0.0025); add(s, crack, 0, 1);
  const body = biquad(noise(Math.ceil(0.1 * SR)), 'bp', rifle ? 700 : 1000, 0.8); env(body, 0.0004, rifle ? 0.025 : 0.016); add(s, body, 0, 1.2);
  thump(s, 0, rifle ? 150 : 200, 80, 0.01, rifle ? 0.035 : 0.022, 0.7);
  add(x, s, 0, 1);
  const echo = biquad(Float32Array.from(s), 'lp', 2200);
  for (const [d, g] of [[0.085, 0.38], [0.16, 0.24], [0.27, 0.15], [0.41, 0.09], [0.6, 0.05]]) add(x, echo, d * (rifle ? 1.1 : 1), g);
  return norm(clip(x, 1.6), 0.9);
}
function thunder() {
  const L = 5.5, x = len(L);
  const crack = biquad(noise(Math.ceil(0.25 * SR)), 'hp', 600); env(crack, 0.002, 0.06); add(x, crack, 0, 0.7);
  const rum = biquad(noise(x.length, 'brown'), 'lp', 260), rolls = []; for (let k = 0; k < 5; k++) rolls.push([0.1 + rnd() * 3, 0.25 + rnd() * 0.6, 0.4 + rnd() * 0.6]);
  for (let i = 0; i < rum.length; i++) { const t = i / SR; let a = 0; for (const [c, w, g] of rolls) a += g * Math.exp(-(((t - c) / w) ** 2)); rum[i] *= a * Math.exp(-t / 2.4); }
  add(x, rum, 0, 4);
  return norm(clip(x, 1.4), 0.9);
}
// fire catching: a whoomph
function whoomph() {
  const L = 1.4, x = len(L), b = sweep(noise(x.length, 'brown'), (t) => 200 + 1600 * Math.sin(Math.min(Math.PI, t / 0.5 * Math.PI)) * Math.exp(-t / 0.6));
  env(b, 0.06, 0.35); add(x, b, 0, 3); thump(x, 0.02, 90, 50, 0.08, 0.15, 0.7);
  for (let k = 0; k < 20; k++) grain(x, 0.1 + rnd() * 1.1, 0.006, 2000 + rnd() * 3000, 1.5, 0.2);
  return norm(clip(x, 1.3), 0.85);
}
// an alien zapper
function zap() { const L = 0.35, x = len(L); let ph = 0; for (let i = 0; i < x.length; i++) { const t = i / SR, f = 300 + 1700 * Math.exp(-t / 0.08) + Math.sin(t * 260) * 60; ph += 2 * Math.PI * f / SR; x[i] = (Math.sin(ph) + 0.4 * Math.sign(Math.sin(ph * 0.5))) * Math.exp(-t / 0.1); } return norm(x, 0.6); }
// a heavy splash: water dumped from the sky, a wave slamming into the street
function splash(size) {
  const L = [1.2, 3][size], x = len(L), w = biquad(noise(x.length, 'pink'), 'bp', 900, 0.5); env(w, 0.02, [0.3, 0.9][size]); add(x, w, 0, 2.2);
  thump(x, 0, 80, 40, 0.05, [0.12, 0.4][size], 0.8);
  for (let k = 0; k < [40, 90][size]; k++) { const t = rnd() * L * 0.7, i0 = Math.floor(t * SR); let ph = 0; const f0 = 300 + rnd() * 500, d = 0.01 + rnd() * 0.03, a = 0.15 * (1 - t / L); for (let i = 0; i < d * SR * 4 && i0 + i < x.length; i++) { const tt = i / SR; ph += 2 * Math.PI * f0 * (1 + tt * 40) / SR; x[i0 + i] += Math.sin(ph) * Math.exp(-tt / d) * a; } } // bubbles
  return norm(clip(x, 1.2), 0.85);
}
// a punch, a body landing
function thud() { const x = len(0.4); thump(x, 0, 110, 50, 0.02, 0.06, 1); const c = biquad(noise(Math.ceil(0.03 * SR)), 'lp', 1800); env(c, 0.0005, 0.008); add(x, c, 0, 0.6); return norm(x, 0.8); }

// ---------- loops
function loop(sec, fn) { const x = len(sec + 0.5); fn(x); return loopify(x, 0.5); }
const LOOPS = {
  city: () => loop(6, (x) => { add(x, biquad(noise(x.length, 'brown'), 'lp', 160), 0, 1); add(x, biquad(noise(x.length, 'pink'), 'hp', 2500), 0, 0.05); norm(x, 0.5); }), // traffic far off, the hum of the place
  wind: () => loop(6, (x) => { const w = biquad(noise(x.length, 'pink'), 'bp', 420, 0.5), r = biquad(noise(x.length, 'brown'), 'lp', 180); for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] = w[i] * (0.6 + 0.4 * Math.sin(t * 2 * Math.PI / 3 + Math.sin(t * 2.1))) * 1.4 + r[i] * 2.2; } norm(x, 0.8); }),
  water: () => loop(5, (x) => { add(x, biquad(noise(x.length, 'pink'), 'bp', 850, 0.45), 0, 2); add(x, biquad(noise(x.length, 'brown'), 'lp', 220), 0, 2.5); norm(x, 0.8); }),
  fire: () => loop(5, (x) => { add(x, biquad(noise(x.length, 'brown'), 'lp', 300), 0, 2); for (let k = 0; k < 140; k++) grain(x, rnd() * 4.9, 0.004 + rnd() * 0.01, 1500 + rnd() * 4000, 1.5, 0.3 + rnd() * 0.5); norm(x, 0.75); }),
  rain: () => loop(4, (x) => { add(x, biquad(noise(x.length, 'pink'), 'hp', 1400), 0, 1); for (let k = 0; k < 500; k++) grain(x, rnd() * 3.9, 0.003, 2500 + rnd() * 5000, 2, 0.15); norm(x, 0.6); }),
  rotor: () => loop(2, (x) => { for (let b = 0; b < 2 * 17; b++) { const t = b / 17; thump(x, t, 95, 60, 0.01, 0.03, 0.8); grain(x, t, 0.04, 260, 0.8, 0.7, 'lp'); } let ph = 0; for (let i = 0; i < x.length; i++) { ph += 2 * Math.PI * 1650 / SR; x[i] += Math.sin(ph) * 0.03; } norm(x, 0.8); }),
};
// what to render, in the order it is wanted most, and how many variations
const ONE = [['crash', crash, 3], ['glass', () => glass(0), 3], ['glassBig', () => glass(1), 2], ['boom', () => boom(0), 2], ['boomBig', () => boom(1), 2], ['shot', () => shot(false), 2], ['rifle', () => shot(true), 2],
  ['collapse', collapse, 2], ['thunder', thunder, 2], ['nuke', () => boom(2), 1], ['whoomph', whoomph, 2], ['splash', () => splash(0), 1], ['splashBig', () => splash(1), 1], ['zap', zap, 2], ['thud', thud, 2]];
// how far each carries (m; full volume closer than this), how loud, the least time between two, the most at once
const REACH = { boom: 700, boomBig: 1300, nuke: 4000, crash: 340, glass: 260, glassBig: 420, collapse: 900, shot: 380, rifle: 520, thunder: 3000, whoomph: 300, splash: 400, splashBig: 1200, zap: 260, thud: 200 };
const VOL = { boom: 0.9, boomBig: 1, nuke: 1, crash: 0.75, glass: 0.55, glassBig: 0.6, collapse: 0.85, shot: 0.45, rifle: 0.5, thunder: 0.8, whoomph: 0.5, splash: 0.6, splashBig: 0.8, zap: 0.35, thud: 0.5 };
const GAP = { nuke: 2, thunder: 0.4, splashBig: 1, glass: 0.07, glassBig: 0.12, crash: 0.1, collapse: 0.3, shot: 0.04, rifle: 0.05, boom: 0.08, boomBig: 0.12, thud: 0.06, zap: 0.05, whoomph: 0.2 };
const CAP = { shot: 5, rifle: 5, glass: 4, crash: 4, collapse: 3, zap: 3 };
const MAXV = 22;

let AUDIO = null;
// play a sound at a place in the world (the game's code calls this; it does nothing while sound is off)
export function sfx(name, x, y, z, o) { if (AUDIO) AUDIO.play(name, x, y, z, o); }

export class Audio {
  constructor(camera, controls) {
    AUDIO = this; this.camera = camera; this.controls = controls;
    this.ctx = null; this.bufs = {}; this.loops = {}; this.last = {}; this.live = {}; this.voices = 0; this.t = 0; this._v = new THREE.Vector3();
    let off = false; try { off = localStorage.getItem('zday_sound') === 'off'; } catch (e) { /* no storage */ }
    this.muted = off;
    this.button();
    const go = () => this.unlock(); // browsers only allow sound after a tap
    for (const ev of ['pointerdown', 'touchend', 'keydown']) window.addEventListener(ev, go, { passive: true });
    document.addEventListener('visibilitychange', () => { if (!this.ctx) return; if (document.hidden) this.ctx.suspend(); else if (!this.muted) this.ctx.resume(); });
  }
  button() {
    const b = this.btn = document.createElement('button'); b.type = 'button'; b.id = 'zd-sound'; b.title = 'Sound';
    b.style.cssText = 'position:fixed;right:10px;top:42%;z-index:30;opacity:0.85;width:38px;height:38px;border-radius:19px;border:1px solid rgba(255,255,255,0.15);background:rgba(20,18,16,0.72);color:#f2ead8;font-size:17px;line-height:36px;padding:0;cursor:pointer';
    const show = () => { b.textContent = this.muted ? '🔇' : '🔊'; };
    b.onclick = (e) => { e.stopPropagation(); this.muted = !this.muted; show(); try { localStorage.setItem('zday_sound', this.muted ? 'off' : 'on'); } catch (er) { /* no storage */ } if (this.ctx) { this.master.gain.setTargetAtTime(this.muted ? 0 : 0.85, this.ctx.currentTime, 0.05); if (!this.muted) this.ctx.resume(); } else this.unlock(); };
    show(); document.body.appendChild(b);
  }
  unlock() {
    if (this.ctx) { if (this.ctx.state !== 'running' && !this.muted && !document.hidden) this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* older Safari */ } // play even with the phone's silent switch on
    const c = this.ctx = new AC();
    this.comp = c.createDynamicsCompressor(); this.comp.threshold.value = -16; this.comp.ratio.value = 4; this.comp.attack.value = 0.004; this.comp.release.value = 0.25;
    this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : 0.85;
    this.bus = c.createGain(); this.bus.connect(this.comp); this.comp.connect(this.master); this.master.connect(c.destination);
    // render the sounds a few at a time so the first tap does not stall a frame
    const jobs = [];
    for (const [name, fn, n] of ONE) for (let k = 0; k < n; k++) jobs.push(() => { seed = 1000 + jobs.length * 7919 + k * 104729; (this.bufs[name] || (this.bufs[name] = [])).push(this.toBuf(fn())); });
    for (const name in LOOPS) jobs.push(() => { seed = 777 + name.length * 31; this.startLoop(name, this.toBuf(LOOPS[name]())); });
    const run = () => { const t0 = performance.now(); while (jobs.length && performance.now() - t0 < 12) jobs.shift()(); if (jobs.length) setTimeout(run, 30); };
    setTimeout(run, 50);
  }
  toBuf(x) { const b = this.ctx.createBuffer(1, x.length, SR); b.copyToChannel ? b.copyToChannel(x, 0) : b.getChannelData(0).set(x); return b; }
  startLoop(name, buf) {
    const c = this.ctx, src = c.createBufferSource(), g = c.createGain(), p = c.createStereoPanner ? c.createStereoPanner() : null;
    src.buffer = buf; src.loop = true; g.gain.value = 0;
    src.connect(g); if (p) { g.connect(p); p.connect(this.bus); } else g.connect(this.bus);
    src.start(c.currentTime + Math.random() * 0.1); this.loops[name] = { src, g, p };
  }
  // how loud and how muffled a sound at (x, y, z) is from the camera, and where it sits left to right
  place(x, y, z, reach) {
    const cam = this.camera.position, d = Math.hypot(x - cam.x, y - cam.y, z - cam.z), g = Math.min(1, reach / Math.max(1, d));
    const v = this._v.set(x, y, z).project(this.camera), pan = Math.max(-1, Math.min(1, v.x)) * (v.z > 1 ? 0.25 : 0.75);
    return { g, pan, lp: Math.max(900, Math.min(14000, 14000 * Math.pow(reach * 0.6 / Math.max(1, d), 1.3))) };
  }
  play(name, x, y = 0, z = 0, o = {}) {
    const c = this.ctx; if (!c || this.muted || c.state !== 'running') return;
    const list = this.bufs[name]; if (!list) return;
    const now = c.currentTime;
    if (now - (this.last[name] || -9) < (GAP[name] || 0.03) || this.voices >= MAXV || (this.live[name] || 0) >= (CAP[name] || 8)) return;
    const P = this.place(x, y, z, (REACH[name] || 300) * (o.reach || 1)), g = P.g * (VOL[name] || 0.6) * (o.gain ?? 1);
    if (g < 0.025) return;
    this.last[name] = now;
    const src = c.createBufferSource(), f = c.createBiquadFilter(), gn = c.createGain(), p = c.createStereoPanner ? c.createStereoPanner() : null;
    src.buffer = list[Math.floor(Math.random() * list.length)]; src.playbackRate.value = (o.rate || 1) * (0.93 + Math.random() * 0.14);
    f.type = 'lowpass'; f.frequency.value = P.lp; gn.gain.value = g;
    src.connect(f); f.connect(gn); if (p) { p.pan.value = P.pan; gn.connect(p); p.connect(this.bus); } else gn.connect(this.bus);
    this.voices++; this.live[name] = (this.live[name] || 0) + 1;
    src.onended = () => { this.voices--; this.live[name]--; src.disconnect(); f.disconnect(); gn.disconnect(); if (p) p.disconnect(); };
    src.start(now + (o.delay || 0));
  }
  // what happened in the world this frame (people, traffic, fire, helicopters and disasters all post events)
  event(e) {
    if (!this.ctx || this.muted || e.x == null) return;
    const x = e.x, z = e.z;
    switch (e.type) {
      case 'crash': this.play('crash', x, 1, z); break;
      case 'carland': this.play('crash', x, 1, z, { gain: 0.7, rate: 0.9 }); break;
      case 'carfire': this.play('boom', x, 1, z, { gain: 0.6 }); break;
      case 'carfall': this.play('crash', x, -5, z, { gain: 0.8, delay: 0.6 }); break;
      case 'blast': this.play('boomBig', x, 2, z); break;
      case 'boom': this.play(e.size ? 'boomBig' : 'boom', x, 1, z); break;
      case 'nuked': case 'nukeflash': case 'meltdownboom': this.play('nuke', x, 30, z); break;
      case 'detonation': case 'eruption': case 'saucerdown': case 'tripoddown': this.play('boomBig', x, 10, z); break;
      case 'collapse': this.play('collapse', x, 5, z); break;
      case 'shot': this.play(Math.random() < 0.35 ? 'rifle' : 'shot', x, 1.5, z); break;
      case 'zap': this.play('zap', x, 1.5, z); break;
      case 'bolt': this.play('thunder', x, 100, z, { delay: 0.05 }); break;
      case 'fire': case 'gasfire': this.play('whoomph', x, 5, z); break;
      case 'waterdrop': this.play('splash', x, 10, z); break;
      case 'tsunamihit': this.play('splashBig', x, 6, z); this.play('collapse', x, 0, z, { rate: 0.6, gain: 0.7 }); break;
      case 'tripodland': this.play('collapse', x, 0, z, { rate: 0.7 }); break;
      default: break;
    }
  }
  // the loops: ten times a second, each faded towards how much of it is near the view
  update(dt, g) {
    if (!this.ctx || !this.loops.city || (this.t += dt) < 0.1) return;
    this.t = 0;
    const c = this.ctx, now = c.currentTime, tg = this.controls.target, cam = this.camera.position, zoom = Math.min(1, 500 / Math.max(1, cam.distanceTo(tg)));
    const D = g.disasters, W = D && D.water, want = { city: 0.32 * (0.4 + 0.6 * zoom), wind: 0, water: 0, fire: 0, rain: 0, rotor: 0 }, pan = {};
    if (D) for (const e of D.list) {
      if (!e.alive || !e.poi) continue;
      const p = e.poi(tg.x, tg.z); if (!p) continue;
      const near = Math.max(0, 1 - Math.hypot(p.x - tg.x, p.z - tg.z) / 700);
      if (e.type === 'tornado' || e.type === 'haboob' || e.type === 'coldwave' || e.type === 'blackhole') want.wind = Math.max(want.wind, 0.25 + 0.75 * near);
      if (e.type === 'tsunami' && e.phase === 'wave') want.water = Math.max(want.water, 0.3 + 0.7 * near);
    }
    if (W && W.active) want.water = Math.max(want.water, 0.25);
    if (D && (D.weather.type === 'dust' || D.weather.type === 'sand')) want.wind = Math.max(want.wind, 0.3);
    if (D && (D.weather.type === 'rain' || D.weather.type === 'storm')) want.rain = D.weather.type === 'storm' ? 0.7 : 0.45;
    if (g.fire) want.fire = Math.min(0.8, g.fire.firesWithin(tg.x, tg.z, 160).length * 0.2) * (0.5 + 0.5 * zoom);
    if (g.helis) { let best = 1e9, hl = null; for (const h of g.helis.list) { const d = Math.hypot(h.x - cam.x, h.y - cam.y, h.z - cam.z); if (d < best) { best = d; hl = h; } } if (hl) { want.rotor = Math.min(0.8, 220 / best); pan.rotor = this.place(hl.x, hl.y, hl.z, 1).pan; } }
    for (const name in this.loops) {
      const L = this.loops[name]; L.g.gain.setTargetAtTime((want[name] || 0) * 0.9, now, 0.4);
      if (L.p && pan[name] != null) L.p.pan.setTargetAtTime(pan[name], now, 0.2);
    }
    this.siren(g, now);
  }
  // the nearest rescue unit on its way somewhere: a wailing siren (a live oscillator, made when wanted)
  siren(g, now) {
    let best = 1e9, car = null; const cam = this.camera.position;
    for (const m of g.traffic.missions) { if (m.gone || m.mode !== 0 || m.leaving) continue; const d = Math.hypot(m.x - cam.x, m.z - cam.z, cam.y); if (d < best) { best = d; car = m; } }
    const want = car ? Math.min(0.22, 90 / best) : 0;
    if (want > 0.01 && !this.sir) {
      const c = this.ctx, o = c.createOscillator(), lfo = c.createOscillator(), dep = c.createGain(), f = c.createBiquadFilter(), gn = c.createGain(), p = c.createStereoPanner ? c.createStereoPanner() : null;
      o.type = 'sawtooth'; o.frequency.value = 900; lfo.type = 'triangle'; lfo.frequency.value = 0.23; dep.gain.value = 420; lfo.connect(dep); dep.connect(o.frequency);
      f.type = 'lowpass'; f.frequency.value = 2400; gn.gain.value = 0; o.connect(f); f.connect(gn); if (p) { gn.connect(p); p.connect(this.bus); } else gn.connect(this.bus);
      o.start(); lfo.start(); this.sir = { o, lfo, gn, p, f };
    }
    if (!this.sir) return;
    this.sir.gn.gain.setTargetAtTime(want, now, 0.3);
    if (car) { const P = this.place(car.x, 2, car.z, 300); if (this.sir.p) this.sir.p.pan.setTargetAtTime(P.pan, now, 0.2); this.sir.f.frequency.setTargetAtTime(P.lp * 0.4, now, 0.3); }
    if (want <= 0.01 && (this.sirOff = (this.sirOff || 0) + 0.1) > 3) { this.sir.o.stop(); this.sir.lfo.stop(); this.sir.gn.disconnect(); this.sir = null; this.sirOff = 0; } else if (want > 0.01) this.sirOff = 0;
  }
}
