// The kit (Sean, 10c): what a hero fights with, one pick in each slot, dozens to come. Stuns stop the enemy a moment and do no
// harm; knockbacks shove them, and the longer the button is held the more power it costs and the further they go (the laser kept
// on them as they fly back, a kick wound up before it lands); melee is the tap combo. Picked in the Sandbox's Fight test card
// (and later the tower), kept in localStorage zday_kit; the fight test and the horde read it when they start.
const KEY = 'zday_kit';
export const STUNS = {
  freeze: { name: 'Freeze', icon: '❄', cost: 50, blurb: 'A block of ice for 2 s; hits land in full' },
  sonic: { name: 'Sonic clap', icon: '👏', cost: 40, blurb: 'A clap that staggers them 1.5 s and shoves them off' },
  gravity: { name: 'Gravity pin', icon: '🌀', cost: 45, blurb: 'Pinned to the ground 2.4 s, open to everything' },
};
export const KNOCKS = {
  laser: { name: 'Laser', icon: '🔴', cost: 35, hold: 12, blurb: 'A beam that shoves them back; hold to keep it on them as they fly' },
  kick: { name: 'Flying kick', icon: '🦶', cost: 25, hold: 14, blurb: 'Hold to wind it up: the longer, the further they fly' },
  gust: { name: 'Gust', icon: '🌬', cost: 30, hold: 10, blurb: 'A wind that carries them away while held; no harm done' },
};
export const MELEES = {
  combo: { name: 'Jab, jab, cross', icon: '🥊', combo: ['jabL', 'jabR', 'cross'], blurb: 'Two quick jabs and a cross that knocks them down' },
  hammer: { name: 'Hammer fists', icon: '🔨', combo: ['hamA', 'hamB'], blurb: 'Two slow heavy blows; the second knocks them down' },
  flurry: { name: 'Flurry', icon: '⚡', combo: ['jabL', 'jabR', 'jabL', 'cross'], blurb: 'Four quick blows, lighter, the last a cross' },
};
export const SLOTS = { stun: STUNS, knock: KNOCKS, melee: MELEES };
const DEF = { stun: 'freeze', knock: 'laser', melee: 'combo' };
export function loadKit() { let o = null; try { o = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { /* no storage */ } const k = { ...DEF, ...(o || {}) }; for (const s in SLOTS) if (!SLOTS[s][k[s]]) k[s] = DEF[s]; return k; }
export function saveKit(k) { try { localStorage.setItem(KEY, JSON.stringify(k)); } catch (e) { /* no storage */ } }
