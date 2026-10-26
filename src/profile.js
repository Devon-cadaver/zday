// Commander profile: XP, level, unlocks and upgrades, saved in localStorage.
const KEY = 'zday_profile';

// cumulative XP needed to reach each level (index = level - 1)
export const LEVELS = [0, 6000, 14000, 26000, 44000, 70000, 105000, 150000, 210000, 290000, 390000, 520000];
export const MAX_LEVEL = LEVELS.length;

// level at which each unit becomes available
export const UNLOCK = { police: 1, bus: 1, fire: 2, water: 3, rescue: 3, apc: 4, strike: 5, nuke: 6 };

// level from which each disaster and kind of weather can turn up in a Commander round
export const HAZARD_LEVEL = { quake: 2, riot: 2, flood: 3, sinkhole: 3, tornado: 4, tsunami: 5, coldwave: 5, aliens: 6, haboob: 6, solar: 7, volcano: 8, meteor: 9 };
export const WEATHER_LEVEL = { clear: 1, rain: 2, fog: 2, storm: 4, snow: 4, heat: 5, sand: 5 };

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
  get level() { return this.levelFor(this.data.xp); }
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

  // a Storm run: XP for the damage done, best score kept
  addStorm(score) {
    const before = this.level;
    const xp = Math.max(100, Math.round(score / 20));
    this.data.xp += xp; this.data.stormRuns = (this.data.stormRuns || 0) + 1;
    const best = score > (this.data.stormBest || 0);
    if (best) this.data.stormBest = score;
    this.save();
    return { xp, best, levelUp: this.level > before, level: this.level };
  }

  // round difficulty for the current level
  difficulty() {
    const l = this.level;
    return {
      outbreaks: l <= 1 ? 1 : l === 2 ? 2 : 3,
      incubate: l <= 1 ? [20, 30] : l === 2 ? [15, 24] : [10, 18],
      seeds: l >= 8 ? 4 : 3,
      runners: l >= 10,
      policeCd: (l >= 5 ? 15 : 20) * (this.has('fastcops') ? 0.5 : 1),
      fireCd: 30 * (this.has('fastcops') ? 0.5 : 1),
      hazards: l >= 7 ? 2 : l >= 2 ? 1 : 0, // disasters per round
      hazardChance: l >= 4 ? 0.85 : 0.65,     // odds the first one happens at all
    };
  }
}
