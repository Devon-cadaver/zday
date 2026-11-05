// New poses for the kit's powers, melee and finishers (Sean, 2026-11-04). Same language as clips.js: joints and angles, an arm's x negative raises it (-1.6 ahead, -3 overhead), z out to the side. The moves' data is read by both the street fight and the crowds.
import { CLIPS } from './clips.js';

const key = (t, p, ease) => ({ t, p, ease });
const still = (p) => ({ keys: [key(0, p)] });
// how someone stands while a stun has them
export const STUN_POSE = {
  eyes: still({ body: -0.08, torso: 0.28, chest: 0.12, head: 0.32, shL: { x: -1.95, z: 0.32 }, shR: { x: -1.95, z: -0.32 }, elL: -2.45, elR: -2.45, hipL: -0.2, kneeL: 0.4, kneeR: 0.3, bodyY: -0.05 }),
  sleep: still({ bodyY: -0.08, torso: 0.3, chest: 0.12, head: 0.85, shL: { x: 0.06, z: -0.05 }, shR: { x: 0.08, z: 0.05 }, elL: -0.25, elR: -0.3, kneeL: 0.22, kneeR: 0.32, hipR: 0.08 }),
  stuck: still({ bodyY: -0.28, torso: 0.2, head: -0.1, shL: { x: -2.5, z: -0.5 }, shR: { x: -2.2, z: 0.6 }, elL: -0.6, elR: -0.9, hipL: -0.5, hipR: -0.25, kneeL: 0.95, kneeR: 0.6 }),
  braced: still({ torso: -0.1, head: -0.25, shL: { x: 0.05, z: 0.02 }, shR: { x: 0.05, z: -0.02 }, elL: -0.1, elR: -0.1, kneeL: 0.1, kneeR: 0.1 }),
  ears: still({ bodyY: -0.1, torso: 0.3, chest: 0.2, head: 0.25, shL: { x: -0.95, z: -1.15 }, shR: { x: -0.95, z: 1.15 }, elL: -2.6, elR: -2.6, hipL: -0.35, hipR: -0.1, kneeL: 0.6, kneeR: 0.35 }),
  cough: still({ bodyY: -0.14, torso: 0.72, chest: 0.2, head: 0.1, shL: { x: -0.7, z: -0.2 }, elL: -0.5, shR: { x: -1.7, z: -0.18 }, elR: -2.45, hipL: -0.4, kneeL: 0.65, kneeR: 0.5 }),
  stiff: still({ torso: -0.08, chest: -0.12, head: -0.3, shL: { x: -0.25, z: -1.25 }, shR: { x: -0.25, z: 1.25 }, elL: -0.15, elR: -0.15, hipL: 0.14, hipR: -0.14, kneeL: 0.08, kneeR: 0.08 }),
  float: still({ torso: 0.1, head: 0.1, shL: { x: -0.7, z: -1.05 }, shR: { x: -0.7, z: 1.05 }, elL: -0.6, elR: -0.6, hipL: -0.55, hipR: -0.15, kneeL: 1, kneeR: 0.6 }),
  walkin: still({ torso: 0.08, head: 0.22, shL: { x: -1.5, z: -0.12 }, shR: { x: -1.5, z: 0.12 }, elL: -0.15, elR: -0.15 }),
  cower: still({ bodyY: -0.42, torso: 0.7, chest: 0.3, head: 0.55, shL: { x: -2.75, z: 0.25 }, shR: { x: -2.75, z: -0.25 }, elL: -2.3, elR: -2.3, hipL: -1.05, hipR: -0.85, kneeL: 1.6, kneeR: 1.35 }),
  bound: still({ torso: -0.05, head: -0.4, shL: { x: 0.02, z: 0.04 }, shR: { x: 0.02, z: -0.04 }, elL: 0, elR: 0, hipL: 0.04, hipR: -0.04 }),
  swing: { keys: [key(0, { torso: 0.1, shR: { x: 0.4, z: 0.3 }, elR: -2, shL: { x: -1.2, z: -0.2 }, elL: -1.6, kneeL: 0.35, kneeR: 0.2 }), key(0.12, { torso: 0.3, chest: { y: -0.5 }, shR: { x: -1.6, z: 0.05 }, elR: -0.1, shL: { x: -1, z: -0.3 }, elL: -1.8, hipL: -0.6, kneeL: 0.6, kneeR: 0.15 }, 'snap'), key(0.42, { torso: 0.1, shR: { x: 0.4, z: 0.3 }, elR: -2, shL: { x: -1.2, z: -0.2 }, elL: -1.6, kneeL: 0.35, kneeR: 0.2 }, 'soft')] },
};
export { CLIPS, key, still };
