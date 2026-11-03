// The kit (Sean, 10c): what a hero fights with, one pick in each slot, dozens to come. Stuns stop the enemy a moment and do no
// harm; knockbacks shove them, and the longer the button is held the more power it costs and the further they go (the laser kept
// on them as they fly back, a kick wound up before it lands); melee is the tap combo. Picked in the Sandbox's Fight test card
// (and later the tower), kept in localStorage zday_kit; the fight test and the horde read it when they start.
const KEY = 'zday_kit';
export const STUNS = {
  freeze: { name: 'Freeze', icon: '❄', cost: 50, blurb: 'A block of ice for 2 s; hits land in full' },
  sonic: { name: 'Sonic clap', icon: '👏', cost: 40, blurb: 'A clap that staggers them 1.5 s and shoves them off' },
  gravity: { name: 'Gravity pin', icon: '🌀', cost: 45, blurb: 'Pinned to the ground 2.4 s, open to everything' },
  web: { name: 'Shock web', icon: '🕸', cost: 45, blurb: 'Crackling lines hold them 2.2 s', fx: { col: [0.5, 1.6, 3.2], secs: 2.2, cage: true, say: 'WEBBED!', snd: 'zap', r: 6 } },
  flash: { name: 'Blinding flash', icon: '💡', cost: 35, blurb: 'They stagger, arms over their eyes, 1.6 s', fx: { col: [3.4, 3.2, 2], secs: 1.6, flash: true, say: 'BLINDED!', snd: 'zap', r: 9 } },
  sleep: { name: 'Sleep dust', icon: '💤', cost: 45, blurb: 'They nod off for 3 s', fx: { col: [1.5, 0.9, 2.4], secs: 3, say: 'ASLEEP!', snd: 'chime', r: 6 } },
  mud: { name: 'Mud trap', icon: '🟤', cost: 35, blurb: 'Stuck to the knees for 2.4 s', fx: { col: [0.7, 0.42, 0.2], secs: 2.4, say: 'STUCK!', snd: 'thud', r: 7 } },
  vine: { name: 'Vine snare', icon: '🌿', cost: 45, blurb: 'Roots wrap their legs for 2.6 s', fx: { col: [0.4, 1.7, 0.5], secs: 2.6, cage: true, say: 'SNARED!', snd: 'whoosh', r: 6 } },
};
export const KNOCKS = {
  laser: { name: 'Laser', icon: '🔴', cost: 35, hold: 12, blurb: 'A beam that shoves them back; hold to keep it on them as they fly' },
  kick: { name: 'Flying kick', icon: '🦶', cost: 25, hold: 14, blurb: 'Hold to wind it up: the longer, the further they fly' },
  gust: { name: 'Gust', icon: '🌬', cost: 30, hold: 10, blurb: 'A wind that carries them away while held; no harm done' },
  stomp: { name: 'Shockwave stomp', icon: '👣', cost: 30, hold: 0, shot: 'wave', blurb: 'A ring along the ground throws everyone near you' },
  firejet: { name: 'Fire jet', icon: '🔥', cost: 35, hold: 12, as: 'laser', beam: [3.2, 1.2, 0.3], wide: 3, dps: 8, sp: 25, blurb: 'A jet of flame; hold to keep burning them back' },
  water: { name: 'Water cannon', icon: '💧', cost: 30, hold: 10, as: 'gust', beam: [0.4, 1.4, 3], wide: 0.7, dps: 2, sp: 28, blurb: 'Holds them and pushes them down the street' },
  boulder: { name: 'Boulder throw', icon: '🪨', cost: 40, hold: 0, shot: 'rock', blurb: 'Rips up the road and throws it' },
  car: { name: 'Car toss', icon: '🚗', cost: 40, hold: 0, shot: 'car', blurb: 'Picks up a car and throws it' },
};
export const MELEES = {
  combo: { name: 'Jab, jab, cross', icon: '🥊', combo: ['jabL', 'jabR', 'cross'], blurb: 'Two quick jabs and a cross that knocks them down' },
  hammer: { name: 'Hammer fists', icon: '🔨', combo: ['hamA', 'hamB'], blurb: 'Two slow heavy blows; the second knocks them down' },
  flurry: { name: 'Flurry', icon: '⚡', combo: ['jabL', 'jabR', 'jabL2', 'cross'], blurb: 'Four quick blows, lighter, the last a cross' },
  boxer: { name: 'Boxer', icon: '🥊', combo: ['jabL', 'jabR', 'hook', 'boxUp'], blurb: 'Jab, jab, hook and a big uppercut' },
  kungfu: { name: 'Kung fu', icon: '🥋', combo: ['jabL', 'jabR', 'snapKick', 'palm'], blurb: 'Fast hands, a snap kick, a palm that knocks them flat' },
  wrestler: { name: 'Wrestler', icon: '🤼', combo: ['elbowU', 'elbowD', 'slam'], blurb: 'Elbows and a big slam: slow and heavy' },
  muay: { name: 'Muay Thai', icon: '🦵', combo: ['elbowU', 'snapKick', 'elbowU2', 'highKick'], blurb: 'Elbows and kicks, the last a high kick' },
  capoeira: { name: 'Capoeira', icon: '🌀', combo: ['spinKick', 'spinKick2', 'highSpin'], blurb: 'Spinning, dancing kicks' },
};
export const SLOTS = { stun: STUNS, knock: KNOCKS, melee: MELEES };
const DEF = { stun: 'freeze', knock: 'laser', melee: 'combo' };
export function loadKit() { let o = null; try { o = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { /* no storage */ } const k = { ...DEF, ...(o || {}) }; for (const s in SLOTS) if (!SLOTS[s][k[s]]) k[s] = DEF[s]; return k; }
export function saveKit(k) { try { localStorage.setItem(KEY, JSON.stringify(k)); } catch (e) { /* no storage */ } }

// how fast a street fight runs (Sean: too fast to follow); Slower unless changed in the pause menu. Crowds on foot keep their own speed
export const FIGHT_SPEEDS = { Normal: 1, Slower: 0.8, Slowest: 0.65 };
let paceName = null;
export function fightSpeedName() { if (paceName) return paceName; let s = null; try { s = localStorage.getItem('zday_fight_speed'); } catch (e) { /* no storage */ } paceName = FIGHT_SPEEDS[s] ? s : 'Slower'; return paceName; }
export function cycleFightSpeed() { const L = Object.keys(FIGHT_SPEEDS), n = L[(L.indexOf(fightSpeedName()) + 1) % L.length]; paceName = n; try { localStorage.setItem('zday_fight_speed', n); } catch (e) { /* no storage */ } return n; }
export function fightPace() { return FIGHT_SPEEDS[fightSpeedName()]; }
