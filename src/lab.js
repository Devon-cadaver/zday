// The hero lab (HERO-PLAN.md item 2; Sean: the Sandbox is where every move and skill gets tested against any enemy at
// any level). One shared record: the hero's level and the villains' level (1 to 20), which moves are on, and the
// readout of a flight: damage dealt and taken, fights won, buildings brought down, people scared, and a fear number
// made of them (the collateral meter to come, item 5). Everywhere else the levels sit at 1 and the moves all on, so
// nothing outside the Sandbox changes. Kept in localStorage (zday_lab) so the bench is as you left it.
const KEY = 'zday_lab';
export const LAB = {
  on: false, army: false, hero: 1, villain: 1, moves: { spin: true, kick: true, laser: true, drag: true, slam: true, jab: true, upper: true, pound: true, fling: true, hammer: true, elbow: true, freeze: true, fire: true, lightning: true, sonic: true, gravity: true, wind: true, shield: true, tk: true },
  stats: { dealt: 0, taken: 0, fights: 0, won: 0, buildings: 0, scared: 0, hurt: 0, saved: 0 },
  // the hero's level: more health, harder hits
  heroHealth() { return 100 + 10 * (this.hero - 1); },
  heroPow() { return 1 + 0.06 * (this.hero - 1); },
  // the villains' level: more to wear down, harder hits, less time on each weak spot
  villainHp() { return 1 + 0.1 * (this.villain - 1); },
  villainHit(n) { return n * (1 + 0.05 * (this.villain - 1)); },
  spotLife() { return 1 - 0.015 * (this.villain - 1); },
  // the readout, in two short lines (a phone's HUD is narrow)
  fear() { const s = this.stats; return Math.max(0, Math.round(s.scared + s.buildings * 20 + s.hurt * 50 - s.saved * 30)); },
  reset() { const s = this.stats; for (const k in s) s[k] = 0; },
  line() { const s = this.stats; return 'LAB L' + this.hero + ' v L' + this.villain + ' · dealt ' + Math.round(s.dealt) + ' · taken ' + Math.round(s.taken) + ' · won ' + s.won + '/' + s.fights + String.fromCharCode(10) + 'buildings ' + s.buildings + ' · scared ' + s.scared + ' · fear ' + this.fear();  },
  load() { try { const o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (o) { this.on = !!o.on; this.army = !!o.army; this.hero = clampL(o.hero); this.villain = clampL(o.villain); if (o.moves) for (const k in this.moves) if (k in o.moves) this.moves[k] = !!o.moves[k]; } } catch (e) { /* no storage */ } return this; },
  save() { try { localStorage.setItem(KEY, JSON.stringify({ on: this.on, army: this.army, hero: this.hero, villain: this.villain, moves: this.moves })); } catch (e) { /* no storage */ } },
};
const clampL = (v) => Math.max(1, Math.min(20, Math.round(+v || 1)));
LAB.load();
if (typeof window !== 'undefined') window.__lab = LAB; // the fight scripts read it
