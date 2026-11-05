// The kit (Sean): what a fighter fights with, one pick in each slot. Every one of the six has their own (Sean, 2026-11-04: make one your main, the others alternates with different powers), kept in localStorage zday_kits by fighter. Stuns stop the enemy a moment and do no harm; knockbacks shove them, and the longer the button is held the more power it costs and the further they go; melee is the tap combo; two finishers, chosen at zero health. The order of each list is the order they open as a fighter levels (opensAt); the Sandbox has everything open. Picked on the base's computer and the Sandbox card (kitmenu.js); the fights read it when they start.
const KEY = 'zday_kits', OLD = 'zday_kit';
export const STUNS = {
  freeze: { name: 'Freeze', icon: '❄', cost: 50, blurb: 'A block of ice for 2 s; hits land in full' },
  sonic: { name: 'Sonic clap', icon: '👏', cost: 40, blurb: 'A clap that staggers them 1.5 s and shoves them off' },
  guardian: { name: 'Guardian Shield', icon: '🛡', cost: 40, self: true, blurb: 'A shield and a small heal on you. On an alternate: they fly in and put it on you, instead of attacking' },
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
export const FINISHERS = {
  neck: { name: 'Neck drag', icon: '🤜', tip: 'HOLD and steer, let go to fling', blurb: 'By the neck through the town, punching on the way; let go to fling them' },
  sky: { name: 'To the sky', icon: '☄', tip: 'HOLD, TAP, HOLD, HOLD', blurb: 'Up past them, grab them, and down with a shockwave, up to a mini nuke' },
};
export const SLOTS = { stun: STUNS, knock: KNOCKS, melee: MELEES, fin1: FINISHERS, fin2: FINISHERS };
export const SLOT_NAME = { stun: 'Stun', knock: 'Knockback', melee: 'Melee', fin1: 'Finisher 1', fin2: 'Finisher 2' };
// what each of the six starts with, so they differ from the first fight; always open to them
const START = {
  nova: { stun: 'freeze', knock: 'laser', melee: 'boxer', fin1: 'neck', fin2: 'sky' },
  dragonfly: { stun: 'sonic', knock: 'gust', melee: 'capoeira', fin1: 'sky', fin2: 'neck' },
  tempo: { stun: 'guardian', knock: 'kick', melee: 'flurry', fin1: 'neck', fin2: 'sky' },
  tyrant: { stun: 'gravity', knock: 'car', melee: 'hammer', fin1: 'neck', fin2: 'sky' },
  blur: { stun: 'flash', knock: 'kick', melee: 'kungfu', fin1: 'sky', fin2: 'neck' },
  weaver: { stun: 'web', knock: 'water', melee: 'muay', fin1: 'neck', fin2: 'sky' },
};
const idOf = (w) => String(w || '').toLowerCase();
let all = null;
const write = () => { try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) { /* no storage */ } };
// the one kit of an older save goes to whoever was last played on each side, and those picks stay open to them; the others start with their own
function read() {
  if (all) return all; let o = null; try { o = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { /* no storage */ } all = o || {};
  if (!o) { let old = null, last = null; try { old = JSON.parse(localStorage.getItem(OLD) || 'null'); last = (JSON.parse(localStorage.getItem('zday_hero') || 'null') || {}).last; } catch (e) { /* no storage */ } if (old) { for (const id of [(last && last.hero) || 'nova', (last && last.villain) || 'tyrant']) { const k = {}, keep = []; for (const s of ['stun', 'knock', 'melee']) if (old[s] && SLOTS[s][old[s]] && !(s === 'melee' && old[s] === 'combo')) { k[s] = old[s]; keep.push(old[s]); } all[id] = { ...k, keep }; } } write(); }
  return all;
}
export function loadKit(who) { const id = idOf(who), base = START[id] || START.nova, k = { ...base, ...(read()[id] || {}) }; for (const s in SLOTS) if (!SLOTS[s][k[s]]) k[s] = base[s]; if (k.fin1 === k.fin2) k.fin2 = Object.keys(FINISHERS).find((q) => q !== k.fin1); return k; }
export function saveKit(who, k) { const id = idOf(who); read()[id] = { ...(all[id] || {}), ...k }; write(); }
// the level a pick opens at: the first few of a list from the start, the rest spread over the levels to 20
const FREE = { stun: 3, knock: 3, melee: 3, fin1: 2, fin2: 2 };
export function opensAt(slot, id) { const L = Object.keys(SLOTS[slot]), i = L.indexOf(id), f = FREE[slot], rest = L.length - f; return i < f ? 1 : 1 + Math.ceil((i - f + 1) * 19 / Math.max(19, rest)); }
export function isOpen(who, slot, id, level) { const q = idOf(who), K = read()[q] || {}; return level >= opensAt(slot, id) || (START[q] && START[q][slot] === id) || (K.keep || []).includes(id); }
// the two gold buttons at zero health
export const finBtns = (k) => [k.fin1, k.fin2].map((f) => '<button type="button" data-f="' + f + '">' + FINISHERS[f].icon + ' ' + FINISHERS[f].name.toUpperCase() + '<small>' + FINISHERS[f].tip + '</small></button>').join('');

// how fast a street fight runs (Sean: too fast to follow); Slower unless changed in the pause menu. Crowds on foot keep their own speed
export const FIGHT_SPEEDS = { Normal: 1, Slower: 0.8, Slowest: 0.65 };
let paceName = null;
export function fightSpeedName() { if (paceName) return paceName; let s = null; try { s = localStorage.getItem('zday_fight_speed'); } catch (e) { /* no storage */ } paceName = FIGHT_SPEEDS[s] ? s : 'Slower'; return paceName; }
export function cycleFightSpeed() { const L = Object.keys(FIGHT_SPEEDS), n = L[(L.indexOf(fightSpeedName()) + 1) % L.length]; paceName = n; try { localStorage.setItem('zday_fight_speed', n); } catch (e) { /* no storage */ } return n; }
export function fightPace() { return FIGHT_SPEEDS[fightSpeedName()]; }
