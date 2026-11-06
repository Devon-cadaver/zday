// Punch sounds to choose from (Sean, 2026-11-05: today's hits sound like tin cans being hit, not a person). Made the way audio.js makes
// every sound (24 kHz, noise, filters, falling sines), so the one picked drops straight into the game. Today's smack rings at 1900 and
// 3100 Hz: that ring is the tin can. The others have no ringing partials: a body is soft, so a blow is a thump, a slap of skin or
// cloth and, for the big ones, a crunch. k: 0 a light blow (a jab) to 1 a heavy one (a cross, a finisher).
export const SR = 24000;
let seed = 11;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const white = () => rnd() * 2 - 1;
const len = (sec) => new Float32Array(Math.ceil(sec * SR));
function noise(n, kind = 'white') {
  const x = new Float32Array(n);
  if (kind === 'white') for (let i = 0; i < n; i++) x[i] = white();
  else { let b0 = 0, b1 = 0, b2 = 0; for (let i = 0; i < n; i++) { const w = white(); b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; x[i] = (b0 + b1 + b2 + w * 0.1848) * 0.18; } }
  return x;
}
function biquad(x, type, f, q = 0.707) {
  const w = 2 * Math.PI * Math.min(f, SR * 0.45) / SR, c = Math.cos(w), s = Math.sin(w), a = s / (2 * q);
  let b0, b1, b2;
  if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; } else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; } else { b0 = a; b1 = 0; b2 = -a; }
  const a0 = 1 + a, a1 = -2 * c / a0, a2 = (1 - a) / a0; b0 /= a0; b1 /= a0; b2 /= a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const v = x[i], y = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = v; y2 = y1; y1 = y; x[i] = y; }
  return x;
}
function env(x, atk, dec, t0 = 0) { for (let i = 0; i < x.length; i++) { const t = i / SR - t0; x[i] *= t < 0 ? 0 : Math.min(1, t / atk) * Math.exp(-t / dec); } return x; }
function add(dst, src, t0 = 0, g = 1) { const o = Math.floor(t0 * SR); for (let i = 0; i < src.length && o + i < dst.length; i++) if (o + i >= 0) dst[o + i] += src[i] * g; return dst; }
function ping(x, t0, f, dec, amp) {
  const i0 = Math.floor(t0 * SR); if (i0 >= x.length || f >= SR * 0.48) return;
  const w = 2 * Math.PI * f / SR, r = Math.exp(-1 / (dec * SR)), c = 2 * r * Math.cos(w), r2 = r * r, end = Math.min(x.length, i0 + Math.ceil(dec * SR * 5));
  let a = 0, b = amp * r * Math.sin(w);
  for (let i = i0 + 1; i < end; i++) { x[i] += b; const n = c * b - r2 * a; a = b; b = n; }
}
function thump(x, t0, f0, f1, fall, dec, amp) {
  let ph = 0; const i0 = Math.floor(t0 * SR), end = Math.min(x.length, i0 + Math.ceil(dec * SR * 6));
  for (let i = i0; i < end; i++) { const t = (i - i0) / SR, f = f1 + (f0 - f1) * Math.exp(-t / fall); ph += 2 * Math.PI * f / SR; x[i] += Math.sin(ph) * Math.exp(-t / dec) * Math.min(1, t / 0.003) * amp; }
}
function grain(x, t0, dur, f, q, amp, type = 'bp', kind = 'white') { const g = biquad(noise(Math.ceil(dur * SR), kind), type, f, q); env(g, Math.min(0.002, dur * 0.2), dur * 0.35); add(x, g, t0, amp); }
function clip(x, drive) { const k = Math.tanh(drive); for (let i = 0; i < x.length; i++) x[i] = Math.tanh(x[i] * drive) / k; return x; }
function norm(x, peak = 0.9) { let m = 0; for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i])); if (m > 0) for (let i = 0; i < x.length; i++) x[i] *= peak / m; return x; }
// a crackle: noise cut into little bursts, like knuckles on bone and gristle (kept short: a crunch, not a break)
function crackle(x, t0, dur, f, amp) { const n = Math.ceil(dur * SR), c = biquad(noise(n), 'bp', f, 0.9); let on = 0; for (let i = 0; i < n; i++) { if (i % 24 === 0) on = rnd() < 0.35 ? 1 : 0.12; c[i] *= on; } env(c, 0.001, dur * 0.4); add(x, c, t0, amp); }

export const HIT_SOUNDS = {
  today: { name: 'Today', note: 'The one in the game now. Two ringing tones in it: the tin can',
    make(k) { const x = len(0.22), c = biquad(noise(Math.ceil(0.04 * SR)), 'hp', 2500); env(c, 0.0003, 0.012); add(x, c, 0, 1); ping(x, 0, 1900 + rnd() * 300, 0.035, 0.5); ping(x, 0, 3100 + rnd() * 500, 0.02, 0.35); thump(x, 0, 150, 70, 0.012, 0.04, 0.8 + 0.3 * k); return norm(clip(x, 1.4), 0.9); } },
  body: { name: 'Body blow', note: 'A deep thump into a body and a dull slap of cloth. No ring at all',
    make(k) { const x = len(0.32); thump(x, 0, 105 - 20 * k, 46 - 8 * k, 0.014 + 0.01 * k, 0.045 + 0.04 * k, 1); grain(x, 0, 0.022, 1300, 0.6, 0.75, 'lp'); grain(x, 0.002, 0.03, 700, 0.8, 0.45, 'bp', 'pink'); return norm(clip(x, 1.7 + k), 0.92); } },
  movie: { name: 'Movie punch', note: 'The film fight sound: a sharp crack on top, a big whump under it, a short tail',
    make(k) { const x = len(0.42); grain(x, 0, 0.012, 2300, 0.7, 0.7); thump(x, 0.003, 135 - 15 * k, 40, 0.02, 0.06 + 0.05 * k, 1.15); grain(x, 0.002, 0.045, 850, 0.7, 0.55, 'lp', 'pink'); grain(x, 0.01, 0.16 + 0.1 * k, 380, 0.7, 0.16 + 0.1 * k, 'lp', 'pink'); return norm(clip(x, 2.2 + k), 0.95); } },
  heavy: { name: 'Heavy hitter', note: 'Deeper and bigger, with a crunch: for a strong hero. Light blows lose the crunch',
    make(k) { const x = len(0.5); thump(x, 0, 92 - 14 * k, 30, 0.028, 0.08 + 0.07 * k, 1.25); grain(x, 0, 0.018, 1600, 0.6, 0.6, 'lp'); if (k > 0.3) crackle(x, 0.004, 0.035 + 0.03 * k, 2000, 0.55 * k); grain(x, 0.006, 0.2 + 0.12 * k, 160, 0.7, 0.25 * k, 'lp', 'pink'); return norm(clip(x, 2.6 + k), 0.95); } },
  jab: { name: 'Snappy', note: 'Short and quick, a tight snap of a hit with a small thump. Fast combos stay clear',
    make(k) { const x = len(0.2); grain(x, 0, 0.022, 1350, 1, 0.85); thump(x, 0, 165 - 30 * k, 85 - 20 * k, 0.008, 0.025 + 0.02 * k, 0.65 + 0.3 * k); return norm(clip(x, 1.5 + k * 0.8), 0.9); } },
  glove: { name: 'Padded', note: 'A boxing glove: a soft, round thwack. The gentlest of them',
    make(k) { const x = len(0.3); grain(x, 0, 0.05, 460, 0.9, 0.9, 'bp', 'pink'); grain(x, 0, 0.012, 1800, 1.5, 0.3); thump(x, 0, 115 - 15 * k, 58, 0.012, 0.04 + 0.03 * k, 0.75); return norm(clip(x, 1.3 + k * 0.6), 0.88); } },
};
// three of each at each strength, so a run of blows is never the same twice
const CACHE = {};
export function hitBuffers(id) {
  if (CACHE[id]) return CACHE[id];
  const S = HIT_SOUNDS[id], out = { light: [], heavy: [] };
  for (let i = 0; i < 3; i++) { seed = 11 + i * 97 + id.length * 13; out.light.push(S.make(0.15 + 0.1 * i)); out.heavy.push(S.make(0.85 + 0.07 * i)); }
  return (CACHE[id] = out);
}
