// Keyframed moves for the figures (HERO-PLAN item 3e; Sean: the moves looked clunky because each was one pose and a timer).
// A pose names joints and their angles (radians); a clip is poses at times, each reached with an easing, so a move has
// its anticipation, its contact and its follow-through. playClip blends the joints every frame; the moves fire their
// events (damage, sound, the villain's reaction) at the key they belong to. Joints: body (the whole figure's lean), bodyY
// (the hips dropped or lifted), torso (the waist), chest, head, shL shR elL elR wrL wrR (arms), hipL hipR kneeL kneeR
// ankL ankR (legs). x bends forward and back (an arm's x negative raises it ahead and up: -1.6 straight ahead, -3 overhead),
// y turns, z spreads out to the side (arms: positive is outward on either side). Missing joints sit at rest.
import { relax } from './villains.js';

const EASE = {
  linear: (u) => u,
  out: (u) => 1 - (1 - u) * (1 - u), // fast then slow: a blow landing, a figure settling
  in: (u) => u * u, // slow then fast: an anticipation gathering
  snap: (u) => 1 - Math.pow(1 - u, 4), // all at once
  soft: (u) => u * u * (3 - 2 * u),
};
const J = (r, name) => { // the joint object for a pose name, or null
  const A = r.arms, L = r.legs;
  switch (name) {
    case 'torso': return r.torso; case 'chest': return r.chest || r.torso; case 'head': return r.head; case 'body': return r.body;
    case 'shL': return A[0].sh; case 'shR': return A[1].sh; case 'elL': return A[0].el; case 'elR': return A[1].el; case 'wrL': return A[0].wr; case 'wrR': return A[1].wr;
    case 'hipL': return L[0].hip; case 'hipR': return L[1].hip; case 'kneeL': return L[0].knee; case 'kneeR': return L[1].knee; case 'ankL': return L[0].ank; case 'ankR': return L[1].ank;
    default: return null;
  }
};
const REST_Z = { shL: -0.08, shR: 0.08 }; // relax() sets the arms a little out
const val = (pose, name, c) => { const p = pose[name]; if (p == null) return name === 'bodyY' ? 0 : (c === 'z' && REST_Z[name]) || 0; return typeof p === 'number' ? (c === 'x' ? p : (c === 'z' && REST_Z[name]) || 0) : (p[c] ?? ((c === 'z' && REST_Z[name]) || 0)); };
const NAMES = ['body', 'torso', 'chest', 'head', 'shL', 'shR', 'elL', 'elR', 'wrL', 'wrR', 'hipL', 'hipR', 'kneeL', 'kneeR', 'ankL', 'ankR'];
// the clip at time t written into the rig (call relax(r) first): the two keys round t blended. Returns false once past the end
export function playClip(r, clip, t) {
  const K = clip.keys; let i = 0; while (i < K.length - 1 && t >= K[i + 1].t) i++;
  const a = K[i], b = K[Math.min(i + 1, K.length - 1)], span = b.t - a.t, u = span > 0 ? Math.max(0, Math.min(1, (t - a.t) / span)) : 1, e = (EASE[b.ease] || EASE.soft)(u);
  for (const n of NAMES) { const j = J(r, n); if (!j) continue; for (const c of ['x', 'y', 'z']) { const va = val(a.p, n, c), vb = val(b.p, n, c); j.rotation[c] = va + (vb - va) * e; } }
  const ya = val(a.p, 'bodyY', 'x'), yb = val(b.p, 'bodyY', 'x'); r.hips.position.y = 0.94 + ya + (yb - ya) * e;
  return t < K[K.length - 1].t;
}
// a villain's reaction: f.react = { clip, t } played over its held pose while it lasts (villains.js pinPose)
export function playReact(r, f) { if (!f.react) return false; if (!playClip(r, f.react.clip, f.react.t) && f.react.t > f.react.clip.keys[f.react.clip.keys.length - 1].t + (f.react.hold || 0)) { f.react = null; return false; } return true; }
const key = (t, p, ease) => ({ t, p, ease });

// ---------- the hero's moves
const GUARD = { torso: 0.12, chest: { y: 0.1 }, shL: { x: -0.9, z: -0.15 }, elL: -1.8, shR: { x: -0.8, z: 0.2 }, elR: -1.9, hipL: -0.25, kneeL: 0.35, kneeR: 0.25, head: -0.1 };
const JAB_L_WOUND = { ...GUARD, chest: { y: 0.4 }, shL: { x: -0.7, z: -0.25 }, elL: -2.1 };
const JAB_L_HIT = { torso: 0.15, chest: { y: -0.4 }, shL: { x: -1.65, z: -0.05 }, elL: -0.05, wrL: -0.1, shR: { x: -0.8, z: 0.2 }, elR: -1.9, hipL: -0.4, kneeL: 0.3, kneeR: 0.2, head: { x: -0.05, y: -0.2 } };
const mirror = (p) => { const o = {}; for (const k in p) { const m = k.endsWith('L') ? k.slice(0, -1) + 'R' : k.endsWith('R') ? k.slice(0, -1) + 'L' : k; const v = p[k]; o[m] = typeof v === 'number' ? v : { x: v.x, y: v.y != null ? -v.y : undefined, z: v.z != null ? -v.z : undefined }; } return o; };
export const CLIPS = {
  // a jab: wound, snapped out (the contact at 0.08), back to the guard
  jabL: { keys: [key(0, JAB_L_WOUND), key(0.08, JAB_L_HIT, 'snap'), key(0.3, GUARD, 'out')] },
  jabR: { keys: [key(0, mirror(JAB_L_WOUND)), key(0.08, mirror(JAB_L_HIT), 'snap'), key(0.3, GUARD, 'out')] },
  guardL: { keys: [key(0, GUARD), key(0.15, JAB_L_WOUND, 'in')] }, guardR: { keys: [key(0, GUARD), key(0.15, mirror(JAB_L_WOUND), 'in')] },
  // the cross that ends the combo: the hips and chest turn into it
  cross: { keys: [key(0, { ...mirror(JAB_L_WOUND), torso: { x: 0.15, y: 0.35 }, bodyY: -0.06 }), key(0.1, { torso: { x: 0.1, y: -0.5 }, chest: { y: -0.55 }, shR: { x: -1.75, z: 0.05 }, elR: 0, wrR: -0.15, shL: { x: -0.6, z: -0.3 }, elL: -1.7, hipR: 0.25, kneeR: 0.3, hipL: -0.45, kneeL: 0.35, bodyY: -0.1, head: { y: -0.3 } }, 'snap'), key(0.4, GUARD, 'out')] },
  // the uppercut: coiled low, exploding up through the chin (contact at 0.28), the follow-through overhead
  uppercut: { keys: [
    key(0, { bodyY: -0.22, torso: 0.55, chest: 0.25, head: -0.35, shR: { x: 0.9, z: 0.3 }, elR: -1.7, wrR: -0.3, shL: { x: -0.9, z: -0.2 }, elL: -1.5, hipL: -0.55, hipR: -0.75, kneeL: 1.0, kneeR: 1.2, ankL: 0.3, ankR: 0.4 }),
    key(0.28, { bodyY: 0.12, torso: -0.3, chest: -0.3, head: -0.5, shR: { x: -3.0, z: 0.15 }, elR: -0.2, wrR: -0.5, shL: { x: 0.3, z: -0.3 }, elL: -1.2, hipL: 0.1, hipR: -0.3, kneeL: 0.15, kneeR: 0.5, ankR: -0.3 }, 'in'),
    key(0.55, { bodyY: 0.05, torso: -0.2, chest: -0.15, head: -0.3, shR: { x: -3.1, z: 0.3 }, elR: -0.1, shL: { x: 0.1, z: -0.2 }, elL: -0.9, kneeL: 0.2, kneeR: 0.3 }, 'out'),
  ] },
  // in the air over them: pulled right back, then the dash down after them head first, fist ahead
  windup: { keys: [key(0, { shR: { x: -3.0, z: 0.2 }, shL: { x: 0.2, z: -0.2 }, elL: -0.9 }), key(0.3, { body: -0.45, torso: -0.25, chest: -0.2, head: 0.25, shL: { x: 1.0, z: -0.6 }, shR: { x: 1.0, z: 0.6 }, elL: -0.8, elR: -0.8, hipL: -0.9, hipR: -0.9, kneeL: 1.4, kneeR: 1.4 }, 'in')] },
  dash: { keys: [key(0, { body: -0.45, torso: -0.25, chest: -0.2, head: 0.25, shL: { x: 1.0, z: -0.6 }, shR: { x: 1.0, z: 0.6 }, elL: -0.8, elR: -0.8, hipL: -0.9, hipR: -0.9, kneeL: 1.4, kneeR: 1.4 }), key(0.18, { body: 2.7, torso: -0.1, chest: -0.1, head: -0.4, shR: { x: -3.0, z: 0.1 }, elR: 0, shL: { x: 0.6, z: -0.3 }, elL: -1.3, kneeL: 0.1, kneeR: 0.1 }, 'snap')] },
  // a flying kick: the knee up, the leg driven out (contact at 0.22), back to the guard
  kick: { keys: [key(0, { body: -0.15, torso: 0.1, chest: 0.1, hipR: -1.4, kneeR: 1.6, shR: { x: 0.4, z: 0.3 }, elR: -0.9, shL: { x: -0.8, z: -0.3 }, elL: -1.2, kneeL: 0.3 }), key(0.22, { body: -0.3, torso: -0.3, chest: -0.2, head: -0.1, hipR: -1.75, kneeR: 0.1, ankR: -0.4, hipL: 0.3, kneeL: 0.6, shL: { x: -0.5, z: -0.9 }, shR: { x: 0.3, z: 0.9 }, elL: -0.3, elR: -0.3 }, 'snap'), key(0.55, GUARD, 'out')] },
  // fists together overhead, the back arched (held while a circle is held); and the hammer blow down from it (contact at 0.12)
  hammerUp: { keys: [key(0, { torso: -0.2, chest: -0.3, head: -0.3, shL: { x: -3.0, z: -0.1 }, shR: { x: -3.0, z: 0.1 }, elL: 0, elR: 0, kneeL: 0.2, kneeR: 0.2 }), key(0.8, { torso: -0.25, chest: -0.35, head: -0.35, shL: { x: -3.08, z: -0.12 }, shR: { x: -3.08, z: 0.12 }, elL: 0, elR: 0, kneeL: 0.25, kneeR: 0.25 }, 'soft')] },
  hammerDown: { keys: [key(0, { torso: -0.25, chest: -0.35, head: -0.35, shL: { x: -3.08, z: -0.12 }, shR: { x: -3.08, z: 0.12 }, elL: 0, elR: 0, kneeL: 0.25, kneeR: 0.25 }), key(0.12, { torso: 0.55, chest: 0.35, head: 0.2, shL: { x: -0.9, z: -0.15 }, shR: { x: -0.9, z: 0.15 }, elL: -0.2, elR: -0.2, kneeL: 0.6, kneeR: 0.6, hipL: -0.3, hipR: -0.3, bodyY: -0.15 }, 'snap'), key(0.45, { torso: 0.2, chest: 0.1, shL: { x: -0.6, z: -0.3 }, shR: { x: -0.6, z: 0.3 }, elL: -0.8, elR: -0.8, kneeL: 0.3, kneeR: 0.3 }, 'out')] },
  // the villain held overhead, and the throw: a step and both arms hurled forward (release at 0.14)
  liftOverhead: { keys: [key(0, { torso: -0.15, chest: -0.1, head: -0.2, shL: { x: -2.9, z: -0.45 }, shR: { x: -2.9, z: 0.45 }, elL: -0.2, elR: -0.2, wrL: -0.3, wrR: -0.3, hipL: -0.2, hipR: -0.2, kneeL: 0.35, kneeR: 0.35, bodyY: -0.08 }), key(0.7, { torso: -0.12, chest: -0.12, head: -0.2, shL: { x: -2.95, z: -0.5 }, shR: { x: -2.95, z: 0.5 }, elL: -0.2, elR: -0.2, wrL: -0.3, wrR: -0.3, hipL: -0.2, hipR: -0.2, kneeL: 0.4, kneeR: 0.4, bodyY: -0.1 }, 'soft')] },
  throw: { keys: [key(0, { torso: -0.15, chest: -0.1, head: -0.2, shL: { x: -2.9, z: -0.45 }, shR: { x: -2.9, z: 0.45 }, elL: -0.2, elR: -0.2, kneeL: 0.35, kneeR: 0.35, bodyY: -0.08 }), key(0.14, { torso: 0.5, chest: 0.3, head: 0.2, shL: { x: -1.3, z: -0.2 }, shR: { x: -1.3, z: 0.2 }, elL: -0.1, elR: -0.1, hipL: -0.4, kneeL: 0.4, bodyY: -0.1 }, 'snap'), key(0.5, GUARD, 'out')] },
  // the elbow cocked high over them, then the drop, elbow first, and the landing crouch
  elbowUp: { keys: [key(0, { body: -0.3, torso: -0.2, chest: -0.2, head: -0.2, shR: { x: -2.6, z: 0.4 }, elR: -2.6, shL: { x: 0.3, z: -0.4 }, elL: -0.6, hipL: -0.8, hipR: -0.8, kneeL: 1.3, kneeR: 1.3 }), key(0.8, { body: -0.35, torso: -0.25, chest: -0.25, head: -0.25, shR: { x: -2.7, z: 0.45 }, elR: -2.7, shL: { x: 0.3, z: -0.45 }, elL: -0.6, hipL: -0.85, hipR: -0.85, kneeL: 1.35, kneeR: 1.35 }, 'soft')] },
  elbowDrop: { keys: [key(0, { body: -0.3, torso: -0.2, chest: -0.2, shR: { x: -2.6, z: 0.4 }, elR: -2.6, shL: { x: 0.3, z: -0.4 }, elL: -0.6, hipL: -0.8, hipR: -0.8, kneeL: 1.3, kneeR: 1.3 }), key(0.2, { body: 1.6, torso: 0.1, chest: 0.05, head: -0.2, shR: { x: -1.7, z: 0.5 }, elR: -2.7, shL: { x: 0.4, z: -0.5 }, elL: -0.6, hipL: -0.3, hipR: -0.3, kneeL: 0.6, kneeR: 0.6 }, 'snap')] },
  land: { keys: [key(0, { torso: 0.6, chest: 0.3, head: 0.1, hipL: -0.7, hipR: -0.7, kneeL: 1.3, kneeR: 1.3, ankL: 0.3, ankR: 0.3, shR: { x: -0.6, z: 0.5 }, elR: -1.8, shL: { x: -0.7, z: -0.6 }, elL: -1.2, bodyY: -0.3 }), key(0.45, GUARD, 'out')] },
  // after any move: from the guard back to rest
  settle: { keys: [key(0, GUARD), key(0.5, {}, 'soft')] },
  // ---------- the villain's reactions
  hitUp: { keys: [key(0, {}), key(0.08, { head: -0.9, chest: -0.55, torso: -0.25, shL: { x: -1.4, z: -1.1 }, shR: { x: -1.4, z: 1.1 }, elL: -0.3, elR: -0.3, hipL: 0.4, hipR: 0.4, kneeL: 0.3, kneeR: 0.3 }, 'snap'), key(0.6, { head: -0.7, chest: -0.4, torso: -0.15, shL: { x: -1.2, z: -1.0 }, shR: { x: -1.2, z: 1.0 }, elL: -0.4, elR: -0.4, hipL: 0.3, hipR: 0.3, kneeL: 0.4, kneeR: 0.4 }, 'out')] },
  hitHeadL: { keys: [key(0, {}), key(0.06, { head: { x: -0.3, y: 0.7, z: 0.3 }, chest: { x: -0.15, y: 0.35 }, shR: { x: -0.4, z: 0.9 }, elR: -0.6, shL: { x: -0.2, z: -0.3 }, elL: -0.9 }, 'snap'), key(0.35, { torso: 0.1, shL: { x: -0.5, z: -0.3 }, elL: -0.9, shR: { x: -0.5, z: 0.3 }, elR: -0.9 }, 'out')] },
  hitHeadR: { keys: [key(0, {}), key(0.06, { head: { x: -0.3, y: -0.7, z: -0.3 }, chest: { x: -0.15, y: -0.35 }, shL: { x: -0.4, z: -0.9 }, elL: -0.6, shR: { x: -0.2, z: 0.3 }, elR: -0.9 }, 'snap'), key(0.35, { torso: 0.1, shL: { x: -0.5, z: -0.3 }, elL: -0.9, shR: { x: -0.5, z: 0.3 }, elR: -0.9 }, 'out')] },
  blownBack: { keys: [key(0, {}), key(0.08, { torso: -0.5, chest: -0.4, head: -0.6, shL: { x: -1.6, z: -1.0 }, shR: { x: -1.6, z: 1.0 }, elL: -0.2, elR: -0.2, hipL: -0.5, hipR: -0.5, kneeL: 0.4, kneeR: 0.4 }, 'snap'), key(0.5, { torso: -0.35, chest: -0.3, head: -0.4, shL: { x: -1.3, z: -0.9 }, shR: { x: -1.3, z: 0.9 }, elL: -0.3, elR: -0.3, hipL: -0.3, hipR: -0.3, kneeL: 0.5, kneeR: 0.5 }, 'out')] },
  crushed: { keys: [key(0, {}), key(0.07, { torso: 0.9, chest: 0.4, head: 0.5, shL: { x: 0.9, z: -0.6 }, shR: { x: 0.9, z: 0.6 }, elL: -0.8, elR: -0.8, hipL: -1.1, hipR: -1.1, kneeL: 1.4, kneeR: 1.4, bodyY: -0.5 }, 'snap'), key(0.6, { torso: 0.7, chest: 0.3, head: 0.4, shL: { x: 0.7, z: -0.5 }, shR: { x: 0.7, z: 0.5 }, elL: -0.9, elR: -0.9, hipL: -1.0, hipR: -1.0, kneeL: 1.3, kneeR: 1.3, bodyY: -0.45 }, 'out')] },
  hitBody: { keys: [key(0, {}), key(0.07, { torso: 0.65, chest: 0.3, head: 0.3, shL: { x: 0.6, z: -0.2 }, shR: { x: 0.6, z: 0.2 }, elL: -1.3, elR: -1.3, kneeL: 0.6, kneeR: 0.6, bodyY: -0.12 }, 'snap'), key(0.5, { torso: 0.3, chest: 0.1, head: 0.1, shL: { x: 0.3, z: -0.2 }, shR: { x: 0.3, z: 0.2 }, elL: -1.0, elR: -1.0, kneeL: 0.4, kneeR: 0.4, bodyY: -0.06 }, 'out')] },
};
CLIPS.coil = { keys: [key(0, CLIPS.uppercut.keys[0].p), key(0.7, { ...CLIPS.uppercut.keys[0].p, bodyY: -0.26, torso: 0.6 }, 'soft')] }; // coiled low, held (the sky slam's charge)
CLIPS.punchUp = { keys: [key(0, CLIPS.uppercut.keys[0].p), key(0.12, CLIPS.uppercut.keys[1].p, 'snap'), key(0.4, CLIPS.uppercut.keys[2].p, 'out')] }; // the same punch, let go all at once
export { relax };
