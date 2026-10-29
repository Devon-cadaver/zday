// Commander profile: XP, level, unlocks and upgrades, how far along the road of
// towns each mode has got, saved in localStorage.
import { PATH } from './places.js';
const KEY = 'zday_profile';

// cumulative XP needed to reach each level (index = level - 1)
export const LEVELS = [0, 6000, 14000, 26000, 44000, 70000, 105000, 150000, 210000, 290000, 390000, 520000];
export const MAX_LEVEL = LEVELS.length;

// level at which each unit becomes available
export const UNLOCK = { flamer: 5, napalm: 6, mininuke: 1, build: 1, camp: 2, hazmat: 3, heroes: 4, police: 1, bus: 1, chaser: 2, boat: 2, coast: 3, barrier: 4, fire: 1, seeder: 3, water: 3, rescue: 3, apc: 4, strike: 5, nuke: 6 };

// level from which each kind of incident and weather can turn up in a Commander round
export const HAZARD_LEVEL = { plant: 6, rift: 9, zombies: 1, quake: 1, riot: 1, flood: 2, sinkhole: 2, tornado: 3, coldwave: 3, tsunami: 4, haboob: 4, aliens: 5, villains: 5, solar: 6, worm: 6, kaiju: 8, volcano: 7, meteor: 8, nuclear: 9, meltdown: 10, blackhole: 11 };
export const WEATHER_LEVEL = { clear: 1, rain: 2, fog: 2, storm: 4, snow: 4, heat: 5, sand: 5 };

// Be The Disaster: the level at which each disaster can be played
// the big spectacles come later (playtests: the earthquake and meteors out-scored everything that opened after them)
export const BE_LEVEL = { tornado: 1, sinkhole: 1, zombies: 1, riot: 2, quake: 6, flood: 3, meteor: 8, lava: 4, haboob: 4, coldwave: 5, tsunami: 5, saucer: 6, solar: 6, tripod: 7, volcano: 9, blackhole: 8, nuclear: 9, meltdown: 10, villains: 3, worm: 6, kaiju: 8 };

export const UPGRADES = [
  { id: 'squad4', name: 'Four-officer cruisers', cost: 3000, level: 7, desc: 'Every cruiser carries four officers instead of two.' },
  { id: 'drone', name: 'Drone recon', cost: 4000, level: 7, desc: 'Bitten civilians are marked with an amber ring before they turn.' },
  { id: 'bigbus', name: 'Articulated buses', cost: 3000, level: 8, desc: 'Evacuation buses take 45 people and wait longer.' },
  { id: 'doubledrop', name: 'Double water drop', cost: 4000, level: 8, desc: 'Water helicopters make a second drop further along their run.' },
  { id: 'fastcops', name: 'Rapid response', cost: 5000, level: 9, desc: 'Police and fire cooldowns are halved.' },
];

export class Profile {
  constructor() {
    this.data = { xp: 0, spent: 0, upgrades: {}, rounds: 0, best: 0, stars: 0, lastLevel: 1, stormBest: 0, stormRuns: 0 };
    try { const s = localStorage.getItem(KEY); if (s) Object.assign(this.data, JSON.parse(s)); } catch (e) { /* no storage */ }
    this.ok = true;
  }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { this.ok = false; } }
  reset() { this.data = { xp: 0, spent: 0, upgrades: {}, rounds: 0, best: 0, stars: 0, lastLevel: 1 }; this.save(); }

  get xp() { return this.data.xp; }
  get bank() { return this.data.xp - this.data.spent; } // XP free to spend on upgrades
  levelFor(xp) { let l = 1; for (let k = 1; k < LEVELS.length; k++) if (xp >= LEVELS[k]) l = k + 1; return l; }
  // the level: from XP, and in a mode with a road of towns (this.mode, set by the mode) at least one per town opened, so the
  // road and the level keep step (playtests: XP alone left the whole road at level 1 to 3)
  get level() { const x = this.levelFor(this.data.xp); return this.mode ? Math.min(MAX_LEVEL, Math.max(x, this.reach(this.mode) + 1)) : x; }
  get nextXp() { const l = this.level; return l >= MAX_LEVEL ? null : LEVELS[l]; }
  get progress() { const l = this.level; if (l >= MAX_LEVEL) return 1; const a = LEVELS[l - 1], b = LEVELS[l]; return (this.data.xp - a) / (b - a); }
  unlocked(unitId) { return this.level >= (UNLOCK[unitId] ?? 1); }
  has(id) { return !!this.data.upgrades[id]; }
  canBuy(id) { const u = UPGRADES.find(x => x.id === id); return u && !this.has(id) && this.level >= u.level && this.bank >= u.cost; }
  buy(id) {
    if (!this.canBuy(id)) return false;
    const u = UPGRADES.find(x => x.id === id);
    this.data.upgrades[id] = 1; this.data.spent += u.cost; this.save();
    return true;
  }
  // the road of towns (PATH), for 'commander' and 'be': how far it has opened (an index), where it was played last, and
  // the town to go to next time (the last one played, else the furthest open)
  reach(mode) { return Math.min((this.data.path || {})[mode] || 0, PATH.length - 1); }
  town(mode) { const last = (this.data.last || {})[mode], i = PATH.indexOf(last); return i >= 0 && i <= this.reach(mode) ? last : PATH[this.reach(mode)]; }
  played(mode, key) { const i = PATH.indexOf(key); if (i < 0) return; (this.data.last || (this.data.last = {}))[mode] = key; const b = this.data.been || (this.data.been = {}); b[mode] = Math.max(b[mode] ?? -1, i); this.save(); }
  // the furthest town along the road played in mode (both modes: null); -1 none. Older saves: the towns cleared and the last one played
  been(mode) {
    if (!mode) return Math.max(this.been('commander'), this.been('be'));
    const last = PATH.indexOf((this.data.last || {})[mode]);
    return Math.min(PATH.length - 1, Math.max((this.data.been || {})[mode] ?? -1, last, this.reach(mode) - 1));
  }
  // won in the furthest open town: the next one opens; returns its key (null if nothing new opened)
  clear(mode, key) {
    const i = PATH.indexOf(key); if (i < 0 || i !== this.reach(mode) || i + 1 >= PATH.length) return null;
    (this.data.path || (this.data.path = {}))[mode] = i + 1; this.save();
    return PATH[i + 1];
  }

  // settle a round; returns { xp, levelUp, level }
  addRound(score, stars) {
    const before = this.level;
    const xp = Math.max(200, Math.round(score / 10));
    this.data.xp += xp; this.data.rounds++; this.data.stars += stars;
    if (score > this.data.best) this.data.best = score;
    const level = this.level;
    this.data.lastLevel = level;
    this.save();
    return { xp, levelUp: level > before, level, before };
  }

  // a Be The Disaster run: XP for the damage done, best score kept per disaster
  addBe(kind, score) {
    const before = this.level;
    const xp = Math.max(100, Math.round(Math.min(score, 95000) / 10)); // capped, so one disaster isn't the only way up
    this.data.xp += xp; this.data.stormRuns = (this.data.stormRuns || 0) + 1;
    const bests = this.data.beBest || (this.data.beBest = {}), best = score > (bests[kind] || 0);
    if (best) bests[kind] = score;
    this.save();
    return { xp, best, levelUp: this.level > before, level: this.level };
  }

  // round difficulty for the current level
  difficulty() {
    const l = this.level;
    return {
      incidents: l <= 1 ? 2 : l <= 3 ? 3 : l <= 6 ? 4 : 5, // incidents per round
      sites: l <= 1 ? 1 : l <= 4 ? 2 : 3,                 // outbreak sites in a zombie incident (the first is the tanker spill)
      spill: l <= 1 ? 8 : l <= 3 ? 12 : l <= 6 ? 16 : 22, // how many the tanker's gas can infect (playtests: 22 at level 1 outran any response)
      incubate: l <= 1 ? [24, 34] : l === 2 ? [18, 28] : l <= 4 ? [14, 22] : [10, 18],
      seeds: l >= 8 ? 5 : 4,
      runners: l >= 10,
      policeCd: (l >= 5 ? 15 : 20) * (this.has('fastcops') ? 0.5 : 1),
      fireCd: 30 * (this.has('fastcops') ? 0.5 : 1),
    };
  }
}
