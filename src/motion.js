// The one table of what a fighter can be doing (Sean, 2026-11-15, the movement overhaul's section 9: "a centralized animation state machine").
// Every figure posed by Body (fighttest.js: the heroes, the foes, the team mates, the storm's rider, in the fights one on one, the crowd fights, the giants on foot and the base) changes state through
// Body.go, and the flying hero (flight.js) through Flight.setState. The engines still decide WHEN a state changes (they know the game's events: a blow landed, the stick let go, a finisher's step);
// this table says, in one place for all of them,
//   - what each state is (its family, below),
//   - what the body may show in it (may the walking legs play: not while lying, held, hit or in a blow),
//   - how the pose comes in (how long the blend from the last pose takes, and its curve),
//   - what may follow what (family by family). A change the table does not allow is still made, since the engine knows the game, but it is counted (AUDIT) so the tests can show that none happens.
// And label() names what the figure is doing from its real conditions (its speed over the ground, whether it is speeding up or braking, turning, in the air, landing), in the words of the brief: idle,
// starting, walking, jogging, sprinting, stopping, turning, jumping, falling, landing, attacking, blocking, staggering, knocked back, falling down, lying, getting up.
//
// Families:
//   free    standing ready or walking about by the stick or by its own wits (the walk, the lean, the bank and the guard at ease are layers over it, sized by the real speed)
//   move    a run the engine drives to somewhere (a lunge to the foe, the run up to a finisher, a charge): the walking legs play
//   act     its own blow, cast or charge: a new order of the player's may cut it short (a finisher's run in)
//   bound   a move that must run its course: someone in its hands (a lift, a spin, a drag), a jump up to hit, a signature move, a held charge. No new order cuts it; it ends itself
//   script  a step of a scripted finisher (the doer's and the taker's)
//   guard   blocking, dodging
//   react   hit and reeling on its feet
//   held    in someone's hands or in a power's grip, not its own master
//   thrown  off its feet and through the air
//   floor   lying on the ground
//   rise    getting up
//   land    the moment of coming down on its feet
const FAM = {
  free: { say: 'idle', blend: 0.14, curve: 1, legs: true },
  move: { say: 'running in', blend: 0.09, curve: 1, legs: true },
  act: { say: 'attacking', blend: 0.07, curve: 2, legs: false },
  bound: { say: 'attacking', blend: 0.08, curve: 0, legs: false },
  script: { say: 'attacking', blend: 0.08, curve: 0, legs: false },
  guard: { say: 'blocking', blend: 0.06, curve: 2, legs: false },
  react: { say: 'staggering', blend: 0.05, curve: 2, legs: false },
  held: { say: 'held', blend: 0.06, curve: 2, legs: false },
  thrown: { say: 'knocked back', blend: 0.06, curve: 2, legs: false },
  floor: { say: 'lying', blend: 0.08, curve: 0, legs: false },
  rise: { say: 'getting up', blend: 0.12, curve: 1, legs: false },
  land: { say: 'landing', blend: 0.07, curve: 2, legs: false },
};
// blend: seconds from the last pose to this state's. curve: 0 straight, 1 eased at both ends (settling into a stance), 2 fast then easing (a blow, a hit: there at once)
// Each family's states. The v-states are the foe's finisher on the hero (fighttest.js), the sky-states the hero's sky finisher, fdo and fget the doer and the taker of a scripted finisher (finishers.js)
const NAMES = {
  free: 'idle fly',
  move: 'lunge finRun close rush vfin',
  act: 'attack strike wind cast vcast charge vcharge vpunch vdone',
  bound: 'clutch carry ankles spin smash drag suplex slamH hold vdrag juggle jugUp jugWait jugFall sig gslam liftoff kickCharge glide',
  script: 'fdo fget skyCharge skyRise skyTop skyGrab skyDive vrise vgrab vdive shotMove',
  guard: 'block dodge',
  react: 'hurt stun stumble pushed dazed',
  held: 'frozen hang vhang pinned dragged vdragged dived vdived swung grabbed',
  thrown: 'flung air vair slammed tossed',
  floor: 'down',
  rise: 'getup',
  land: 'land',
};
// What may follow what, family by family. Fitted on 2026-11-15 to the changes that really happen (the tally over 23 test scripts and whole fights played by the bot, state-test: all in here but the ones that were wrong, below).
// The rules that matter: nothing of its own doing (free, move, act, bound, guard) follows the floor or a throw directly: off the floor it gets up first, out of the air it lands, lies or is caught first;
// a run in (move) does not start from a hit, a hold, the air, the floor or a move that must run its course: the engines ask follows() and wait (the finisher's run in, both engines' finPick)
const NEXT = {
  free: 'free move act bound script guard react held thrown floor land',
  move: 'free move act bound script guard react held thrown',
  act: 'free move act bound script guard react held thrown land',
  bound: 'free act bound script react held thrown land',
  script: 'free move act bound script guard react held thrown floor rise land',
  guard: 'free move act guard react held thrown',
  react: 'free act react held thrown floor script', /* act: a foe whose turn has come strikes back through the blow that staggered it (fighttest.js, its turn) */
  held: 'free held react thrown floor rise script land', /* rise: pinned to the floor and let go, they get up */
  thrown: 'thrown floor land held script react', /* react: in a fight in the air there is no floor to hit, they are stopped and reel */
  floor: 'rise held script thrown floor',
  rise: 'free react held thrown',
  land: 'free move act bound guard react held thrown script',
};
export const STATES = {};
for (const f in NAMES) for (const n of NAMES[f].split(' ')) STATES[n] = { name: n, fam: f, ...FAM[f] };
STATES.frozen.legs = true; // in a power's grip, but one of them (the spiral) walks them round in a ring
const OK = {}; for (const f in NEXT) OK[f] = new Set(NEXT[f].split(' '));
// By name, outside the families' rules. down>fly: the flyer down in the street has no getting up of its own, its take-off is that (flight.js getUp). *>vfin: when the hero is beaten the foe walks up to finish
// her from whatever it was doing, a stumble included (fighttest.js vfStart: it does not wait as her finisher does, since a wait there could leave the two of them standing dazed for good)
const ALSO = new Set(['down>fly', '*>vfin']);
const UNKNOWN = { name: '?', fam: 'act', ...FAM.act, blend: 0.08, curve: 0 };

// the tally of every change of state since the page loaded: pairs (from>to: how many), bad (the pairs the table does not allow), unknown (names not in the table)
export const AUDIT = { n: 0, pairs: new Map(), bad: new Map(), unknown: new Set() };
export function stateOf(name) { const s = STATES[name]; if (s) return s; if (!AUDIT.unknown.has(name)) { AUDIT.unknown.add(name); if (globalThis.__motionLog) console.log('[motion] ?' + name); } return UNKNOWN; }
export function follows(from, to) { return OK[stateOf(from).fam].has(stateOf(to).fam) || ALSO.has(from + '>' + to) || ALSO.has('*>' + to); }
// a change of state, counted. from may be nothing (a figure just made). A fresh start (a fight begun again, Body.go's third argument) is not a change and does not come here
export function note(from, to) {
  if (from == null) return; AUDIT.n++; const k = from + '>' + to, c = AUDIT.pairs.get(k) || 0; AUDIT.pairs.set(k, c + 1);
  if (!c) { const ok = follows(from, to); if (!ok) AUDIT.bad.set(k, 0); if (globalThis.__motionLog) console.log('[motion] ' + k + (ok ? '' : ' !')); }
  if (AUDIT.bad.has(k)) AUDIT.bad.set(k, AUDIT.bad.get(k) + 1);
}
// What the figure is doing, in words, from its state's family and its real conditions. b: a Body after its pose (spd its speed over the ground, accF how fast that is changing, yawR its turn rate, vyM its
// speed up or down, jK its landing's weight, fly, sprK). grounded: on its feet
export function label(b, grounded) {
  const M = stateOf(b.state), f = M.fam;
  if (f === 'thrown') return (b.vyM || 0) < -1.5 ? 'falling down' : 'knocked back';
  if (f !== 'free' && f !== 'move') return M.say;
  const v = b.spd || 0, a = b.accF || 0, w = Math.abs(b.yawR || 0);
  if (b.fly) return v > 1.5 ? 'gliding' : 'floating';
  if (!grounded) return (b.vyM || 0) > 0.5 ? 'jumping' : 'falling';
  if (b.jK > 0) return 'landing';
  if (v < 0.3) return w > 2.5 ? 'turning' : 'idle';
  if (a > 6 && v < 3.5) return 'starting';
  if (a < -6) return 'stopping';
  if (w > 4) return 'turning';
  return v < 2.6 ? 'walking' : v < 6.2 && !((b.sprK || 0) > 0.4) ? 'jogging' : 'sprinting';
}
if (typeof window !== 'undefined') window.__motion = { STATES, AUDIT, follows, label, report: () => ({ n: AUDIT.n, pairs: [...AUDIT.pairs].map(([k, c]) => k + ' ' + c), bad: [...AUDIT.bad].map(([k, c]) => k + ' ' + c), unknown: [...AUDIT.unknown] }) };
