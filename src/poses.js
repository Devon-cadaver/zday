// Poses saved over the built-in moves (the Pose Lab, poselab.js). What Sean has saved on this device (zday_poses) goes over what has been
// made permanent (posedata.js), and both go over the moves as written in clips.js and fighttest.js. A saved move: { keys: [{ t, p, ease, pin, hit, src }], pair }.
// src is the key's place in the move as written, so the game's blow lands on the key it belonged to when keys are moved in time.
import { BAKED } from './posedata.js';
const KEY = 'zday_poses';
export const loadLocal = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } };
export const saveLocal = (o) => { try { localStorage.setItem(KEY, JSON.stringify(o)); return true; } catch (e) { return false; } };
const copy = (x) => JSON.parse(JSON.stringify(x));
// a time in the move as written, moved with its keys
export const warp = (t, base, keys) => {
  const P = keys.filter((k) => k.src != null && base[k.src]).map((k) => [base[k.src].t, k.t]).sort((a, b) => a[0] - b[0]); if (!P.length) return t;
  if (t <= P[0][0]) return t + P[0][1] - P[0][0]; const L = P[P.length - 1]; if (t >= L[0]) return t + L[1] - L[0];
  for (let i = 1; i < P.length; i++) if (t <= P[i][0]) { const a = P[i - 1], b = P[i], u = b[0] > a[0] ? (t - a[0]) / (b[0] - a[0]) : 0; return a[1] + (b[1] - a[1]) * u; }
  return t;
};
// keep each move's first form for Reset, then lay the saved ones over. atk: the fight's blows, whose moment of contact follows the keys
export function applyPoses(moves, atk) {
  const saved = { ...BAKED, ...loadLocal() };
  for (const m of moves) {
    if (m.base) continue; m.base = copy(m.clip.keys); m.basePair = m.clip.pair ? copy(m.clip.pair) : null;
    for (const A of atk) if (A.clip === m.clip && m.at == null) m.at = A.at; // the blow's moment as written, for the lab's timeline
    const s = saved[m.id]; if (!s || !Array.isArray(s.keys) || !s.keys.length || !s.keys.every((k) => k && Number.isFinite(k.t) && k.p && typeof k.p === 'object')) continue; // anything else in the save is ignored, never a reason not to load
    m.clip.keys = copy(s.keys); if (s.pair && m.clip.pair) Object.assign(m.clip.pair, s.pair); m.changed = true;
    for (const A of atk) if (A.clip === m.clip) { A.at = warp(A.at, m.base, m.clip.keys); A.end = warp(A.end, m.base, m.clip.keys); }
  }
}
