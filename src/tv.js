// Disaster TV: the end of the world, live, in the town's own look: the tilt-shift miniature, filmed from the news helicopters (SKY 7, SKY 4)
// and now and then a viewer's phone on a rooftop (tvcam.js). Sean (2026-11-05): close shots are for playing; on TV the fights are big, the
// heroes, the villains, the disaster, the rescue services and the army. Each town the broadcast lands in gets one battle: what hits it is
// bet on (three kinds at their odds, drawn at them); then the disaster, one of the villains behind it, the heroes on the hero signal, the
// rescue services and the army rolling, and two bets: do the heroes beat the villain (drawn at the odds, set on the heroes' own rolls,
// heroes.js heroesWin) and how much comes down (over or under a line of buildings, the median of what this device has seen of that kind).
// Coins on the device, a stake on every slip. Then on to the next town, often one the broadcast has hit before, the crews still rebuilding.
import { Hits } from './hits.js';
import { Chain } from './chain.js';
import { PLACES, placeKey } from './places.js';
import { TvCam } from './tvcam.js';
import { Responders } from './response.js';
import { Site } from './rebuild.js';
import { damageOf, rememberDamage } from './world.js';
import { HS } from './herogame.js';
import { HAZARDS } from './disasters.js';

const CSS = `
#zd-live{position:fixed;left:max(10px, env(safe-area-inset-left));top:calc(8px + env(safe-area-inset-top));z-index:6;pointer-events:none;display:flex;gap:6px;align-items:center;
  font:800 11px/1 system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.06em;color:#fff}
#zd-live .on{background:#d8321e;padding:5px 7px;border-radius:5px;display:flex;align-items:center;gap:5px}
#zd-live .on i{width:7px;height:7px;border-radius:50%;background:#fff;animation:zdlive 1.2s infinite}
#zd-live .ch{background:rgba(20,14,8,.72);padding:5px 8px;border-radius:5px;color:#f6ead2}
#zd-score{position:fixed;right:max(10px, env(safe-area-inset-right));top:calc(64px + env(safe-area-inset-top));z-index:6;pointer-events:none;background:rgba(20,14,8,.78);border:1px solid rgba(255,236,200,.18);border-radius:8px;padding:5px 9px;
  font:800 10px/1.35 system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.06em;color:#f6ead2;text-align:right}
#zd-score b{font-size:13px;letter-spacing:0;font-variant-numeric:tabular-nums;color:#a6ff4d;margin-left:6px}
#zd-score .pts b{color:#ffd166}
#zd-score.pop{animation:zdpop .5s ease-out}
@keyframes zdpop{30%{transform:scale(1.18)}}
@keyframes zdlive{50%{opacity:.25}}
#zd-tick{position:fixed;left:0;right:0;bottom:calc(var(--zd-bar-h, 64px) + 8px);z-index:6;pointer-events:none;display:flex;align-items:stretch;height:26px;
  font:700 12.5px/26px system-ui,-apple-system,"Segoe UI",sans-serif;color:#f6ead2;background:rgba(20,14,8,.78);border-top:2px solid #d8321e}
#zd-tick .k{flex:none;background:#d8321e;color:#fff;padding:0 9px;font-weight:900;letter-spacing:.05em}
#zd-tick .w{flex:1;overflow:hidden;position:relative}
#zd-tick .m{position:absolute;left:0;top:0;white-space:nowrap;will-change:transform}
#zd-next{position:fixed;left:0;right:0;top:30%;text-align:center;z-index:6;pointer-events:none;font:900 15px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;
  color:#f6ead2;text-shadow:0 1px 3px rgba(0,0,0,.9);letter-spacing:.06em;text-transform:uppercase;transition:opacity .4s;opacity:0}
body.zd-tv #zd-radio{bottom:calc(var(--zd-bar-h, 64px) + 42px)}
#zd-next b{display:block;font-size:30px;color:#ffe08a;letter-spacing:.02em;margin-top:4px}
#zd-mkt{position:fixed;left:0;right:0;bottom:calc(var(--zd-bar-h, 64px) + 96px);z-index:8;display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:none;
  font:700 12px/1.1 system-ui,-apple-system,"Segoe UI",sans-serif;color:#f6ead2}
#zd-mkt[hidden]{display:none}
#zd-mkt .t{background:rgba(20,14,8,.86);padding:6px 11px;border-radius:12px;letter-spacing:.04em;text-align:center;max-width:calc(100vw - 32px);box-sizing:border-box}
#zd-mkt .t .hd{color:#ffe08a;font-weight:900;letter-spacing:.08em}
#zd-mkt .t b{color:#ffb070;font-variant-numeric:tabular-nums}
#zd-mkt .t small{display:block;font-size:10.5px;font-weight:600;opacity:.82;margin-top:3px;letter-spacing:.02em;line-height:1.25}
#zd-mkt .row{display:flex;gap:8px;pointer-events:auto}
#zd-mkt .row[hidden]{display:none}
#zd-mkt button{appearance:none;position:relative;overflow:hidden;border:1px solid rgba(255,236,200,.3);background:rgba(30,22,12,.94);color:#f6ead2;border-radius:12px;width:104px;padding:8px 5px 10px;
  font:700 11.5px/1.15 system-ui,-apple-system,"Segoe UI",sans-serif;display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;touch-action:manipulation}
#zd-mkt .row button.two{width:min(150px, calc(50vw - 24px))}
#zd-mkt button .p{font-size:19px;font-weight:900;color:#7be0ff;font-variant-numeric:tabular-nums}
#zd-mkt button .x{font-size:10px;opacity:.7}
#zd-mkt button .bar{position:absolute;left:0;bottom:0;height:3px;background:#7be0ff}
#zd-mkt button.mine{border-color:#a6ff4d;box-shadow:0 0 0 1px #a6ff4d inset}
#zd-mkt button.mine .p,#zd-mkt button.mine .x{color:#a6ff4d;opacity:1}
#zd-mkt button.mine .bar{background:#a6ff4d}
#zd-mkt button:active{transform:scale(.96)}
#zd-mkt .stake{display:flex;gap:6px;align-items:center;pointer-events:auto;background:rgba(20,14,8,.86);padding:5px 8px;border-radius:12px;font:800 10px/1 system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.08em}
#zd-mkt .stake>span{text-align:center;line-height:1.25}
#zd-mkt .stake>span small{display:block;font-size:10px;color:#ffd166;letter-spacing:.02em}
#zd-mkt .stake button{width:auto;min-width:46px;padding:7px 8px;border-radius:9px;font:800 12px/1 system-ui,-apple-system,"Segoe UI",sans-serif;flex-direction:row;gap:0;color:#ffd166}
#zd-mkt .stake button.on{border-color:#ffd166;box-shadow:0 0 0 1px #ffd166 inset;background:rgba(255,209,102,.18)}
#zd-bet{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(var(--zd-bar-h, 64px) + 42px);z-index:6;pointer-events:none;background:rgba(20,14,8,.86);border:1px solid rgba(166,255,77,.45);border-radius:12px;padding:5px 11px;
  font:800 11px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.04em;color:#f6ead2;text-align:center;max-width:calc(100vw - 32px);box-sizing:border-box}
#zd-bet[hidden]{display:none}
#zd-bet b{color:#a6ff4d}
`;

const POOL = ['aliens', 'zombies', 'worm', 'kaiju', 'riot', 'quake', 'tornado', 'flood', 'tsunami', 'haboob', 'coldwave']; // what hits next (zombies: the chemical spill that starts an outbreak)
const START = { zombies: 'spill' }; // the town's own disaster for each kind
const LIFE = { aliens: 150, worm: 150, kaiju: 150, riot: 150, tornado: 120 }; // the ones that would otherwise stay for minutes, or leave too soon
const VILLAINS = ['Tyrant', 'Blur', 'Weaver']; // the ones the town's villains (villains.js) can be
const TOWN_T = 170, PICK_T = 12, TICK_SPEED = 60, SETTLE_T = 150, AFTER_T = 25; // s in a town at most; s to make a call; ticker px a second; s the heroes have to settle it; s the damage goes on counting after
const STAKES = [50, 100, 250, 'all'];
const KIND = { aliens: 'Aliens', zombies: 'Zombies', worm: 'Giant worm', kaiju: 'Kaiju', riot: 'Riot', quake: 'Earthquake', tornado: 'Tornado', flood: 'Flood', tsunami: 'Tsunami', haboob: 'Dust storm', coldwave: 'Cold wave' };
const THE = { aliens: 'The invasion', zombies: 'The outbreak', worm: 'The worm', kaiju: 'The kaiju', riot: 'The riot', quake: 'The earthquake', tornado: 'The tornado', flood: 'The flood', tsunami: 'The tsunami', haboob: 'The dust storm', coldwave: 'The cold wave' };
const NEWS = { aliens: 'An alien invasion lands in', zombies: 'A chemical spill starts a zombie outbreak in', worm: 'A giant worm surfaces in', kaiju: 'A kaiju stomps into', riot: 'A riot breaks out in', quake: 'An earthquake shakes', tornado: 'A tornado touches down in', flood: 'Floods hit', tsunami: 'A tsunami heads for', haboob: 'A dust storm rolls into', coldwave: 'A cold wave freezes' };
const WIN_P = { aliens: 0.6, zombies: 0.64, worm: 0.55, kaiju: 0.5, riot: 0.66, quake: 0.6, tornado: 0.58, flood: 0.62, tsunami: 0.55, haboob: 0.6, coldwave: 0.6 }; // how often the heroes beat the villain in each, before the night's form
const LINE0 = { aliens: 40, zombies: 10, worm: 30, kaiju: 35, riot: 10, quake: 25, tornado: 40, flood: 10, tsunami: 30, haboob: 15, coldwave: 12 }; // buildings down, the bookmaker's first guess; then the median of what this device has seen
const FORM = ['are in form tonight', 'trained all week', 'are coming off a win', 'look rested']; // said of the heroes when the odds favour them
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
let FIRST = true; // the very first town of a broadcast gets the opening title
let CLOCK = 0.16; // the broadcast's time of day: one day and night every 12 minutes, carried on from town to town

// the viewer's coins and calls, kept on this device; lines: the buildings brought down in each kind's battle, the last nine (lines2: the town's battles; lines was the story levels')
function calls() { let c = null; try { c = JSON.parse(localStorage.getItem('zday_tvcalls')); } catch (e) { /* no storage */ } const o = { right: 0, total: 0, points: 0, coins: 1000, stake: 100, lines2: {}, ...(c || {}) }; for (const k of ['right', 'total', 'points', 'coins']) if (!Number.isFinite(o[k])) o[k] = k === 'coins' ? 1000 : 0; return o; }
function saveCalls(c) { try { localStorage.setItem('zday_tvcalls', JSON.stringify(c)); } catch (e) { /* no storage */ } }
function lineOf(kind) { const L = (calls().lines2 || {})[kind]; if (!L || L.length < 3) return LINE0[kind] + 0.5; const s = L.slice().sort((a, b) => a - b); return s[Math.floor(s.length / 2)] + 0.5; }
function noteLine(kind, n) { const c = calls(); c.lines2 = c.lines2 || {}; const L = c.lines2[kind] = (c.lines2[kind] || []).concat(n); if (L.length > 9) L.shift(); saveCalls(c); }

export class DisasterTV {
  constructor(g) {
    this.g = g; this.D = g.disasters; this.msgs = {}; this.kind = null; this.recent = []; this.bt = null;
    if (g.profile) g.profile.mode = null;
    if (!document.getElementById('zd-tv-css')) { const s = document.createElement('style'); s.id = 'zd-tv-css'; s.textContent = CSS; document.head.appendChild(s); }
    const live = this.live = document.createElement('div'); live.id = 'zd-live';
    live.innerHTML = '<span class="on"><i></i>LIVE</span><span class="ch"></span>';
    const tick = this.tick = document.createElement('div'); tick.id = 'zd-tick';
    tick.innerHTML = '<span class="k">NEWS</span><span class="w"><span class="m"></span></span>';
    const nx = this.nextEl = document.createElement('div'); nx.id = 'zd-next';
    const mk = this.mktEl = document.createElement('div'); mk.id = 'zd-mkt'; mk.hidden = true;
    mk.innerHTML = '<div class="t"><span class="hd"></span> <b></b><small></small></div><div class="row"></div><div class="row r2"></div><div class="stake"></div>';
    const sc = this.scoreEl = document.createElement('div'); sc.id = 'zd-score'; // the viewer's scoreboard: calls right out of calls made, coins
    const bt = this.betEl = document.createElement('div'); bt.id = 'zd-bet'; bt.hidden = true; // the bets riding on what is on now
    document.body.append(live, tick, nx, mk, sc, bt);
    this.chEl = live.querySelector('.ch'); this.mEl = tick.querySelector('.m');
    this.hdEl = mk.querySelector('.t .hd'); this.cdEl = mk.querySelector('.t b'); this.subEl = mk.querySelector('.t small'); this.rowEl = mk.querySelector('.row'); this.row2El = mk.querySelector('.r2'); this.stakeEl = mk.querySelector('.stake');
    for (const ev of ['pointerdown', 'click']) mk.addEventListener(ev, (e) => e.stopPropagation());
    this.stakeUi();
    this.hits = new Hits(g, null, { quiet: true }); // no points on TV: just the big moments
    this.chain = new Chain(this.D, (text, slow) => this.hits.moment(text, slow));
    this.cam = new TvCam(this); // the helicopters and viewers' videos from the rooftops
    this.auto = new Responders(g); this.auto.on = false; // the rescue services and the army roll in a battle; the crews rebuild between
    document.body.classList.add('zd-tv'); // the radio's words sit over the ticker
    g.addButton('zd-tvcam', 'Change camera', () => this.cam.change());
    g.addButton('zd-tvnext', 'Next disaster', () => this.skip());
    g.addButton('zd-tvtown', 'Next town', () => this.moveOn());
    g.addButton('zd-menu-btn', 'Menu', () => g.toMenu());
    this.showCalls();
    this.start();
  }

  start() {
    const g = this.g, D = this.D, city = g.city, people = g.people;
    g.resetWorld(); g.setSpeed && g.setSpeed(1); D.boats.auto = false;
    this.n = 0; this.t = 0; this.cur = null; this.curT = 0; this.leaving = -1; this.mkt = null; this.bt = null; this.pend = null; this.after = -1; this.helped = false; this.helpT = 0;
    this.news = []; this.mx = 0; this.statT = 20;
    this.hits.reset(); this.chain.reset(); this.auto.reset();
    this.town = PLACES[placeKey()] ? PLACES[placeKey()].name : 'the city';
    this.chEl.textContent = 'MLD NEWS · ' + this.town.toUpperCase();
    // what this town still shows from the last time the broadcast was here: the ruins, and crews at work on them
    const ruins = damageOf(placeKey()).filter(k => city.buildings[k] && !city.dead[k]);
    for (const k of ruins) { people.clearBuilding(k, 'spare'); city.hideBuilding(k); city.addRubble(k, 0.75); this.auto.fell.set(k, -999); }
    if (ruins.length) {
      const B = city.bounds, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2, mid = (k) => { const b = city.buildings[k]; return Math.hypot((b.x0 + b.x1) / 2 - cx, (b.z0 + b.z1) / 2 - cz); };
      for (const k of ruins.slice().sort((a, b) => mid(a) - mid(b)).slice(0, 4)) this.auto.works.push(new Site(D, k, {}));
      this.say('Back in ' + this.town + ': crews are still rebuilding after the last time, ' + ruins.length + ' buildings down');
      this.card('Back in', this.town); this.cardT = 5;
    } else {
      this.say('Live from ' + this.town + ': stay tuned');
      this.card(FIRST ? 'The end of the world' : 'Live from', FIRST ? 'Live from ' + this.town : this.town); this.cardT = 5;
    }
    FIRST = false;
    this.cam.setup();
    this.calm = PICK_T + 2; this.openMarket(); // what hits this town
  }

  // ---------- the slips: the bets on what is coming, each at its odds, with the stake below. A second row is a second bet
  slip(kind, head, sub, opts, x = {}, opts2 = null) {
    { const c = calls(); if (c.coins < 10) { c.coins += 200; saveCalls(c); this.showCalls(true); this.say('The station spots you 200 coins: back in the game'); } } // never out of the game
    this.mkt = { kind, opts: opts.map(o => o.key), pct: opts.map(o => o.pct), names: opts.map(o => o.name), pick: null, ...x };
    if (opts2) this.mkt.b = { opts: opts2.map(o => o.key), pct: opts2.map(o => o.pct), names: opts2.map(o => o.name), pick: null };
    this.hdEl.textContent = head; this.subEl.textContent = sub;
    const fill = (row, list, M) => { row.innerHTML = ''; row.hidden = !list; if (!list) return; list.forEach((o) => {
      const b = document.createElement('button'); b.type = 'button'; if (list.length === 2) b.className = 'two';
      b.innerHTML = '<span>' + o.name + '</span><span class="p">' + o.pct + '%</span><span class="x">pays ×' + (100 / o.pct).toFixed(1) + '</span><span class="bar" style="width:' + o.pct + '%"></span>';
      b.addEventListener('pointerdown', (e) => e.stopPropagation());
      b.onclick = (e) => { e.stopPropagation(); const m = M(); if (!m) return; m.pick = m.pick === o.key ? null : o.key; for (const q of row.children) q.classList.toggle('mine', q === b && m.pick === o.key); }; // tap again to take it back
      row.appendChild(b); }); };
    fill(this.rowEl, opts, () => this.mkt); fill(this.row2El, opts2, () => this.mkt && this.mkt.b);
    this.stakeShow(); this.mktEl.hidden = false; this.betEl.hidden = true;
  }
  stakeUi() {
    this.stakeEl.innerHTML = '<span>STAKE<small></small></span>' + STAKES.map(s => '<button type="button" data-s="' + s + '">' + (s === 'all' ? 'ALL IN' : s) + '</button>').join('');
    this.stakeEl.querySelectorAll('[data-s]').forEach(b => { b.addEventListener('pointerdown', (e) => e.stopPropagation()); b.onclick = (e) => { e.stopPropagation(); const c = calls(); c.stake = b.dataset.s === 'all' ? 'all' : +b.dataset.s; saveCalls(c); this.stakeShow(); }; });
  }
  stakeShow() { const c = calls(); this.stakeEl.querySelector('small').textContent = c.coins.toLocaleString() + ' coins'; this.stakeEl.querySelectorAll('[data-s]').forEach(b => b.classList.toggle('on', String(c.stake) === b.dataset.s)); }
  // the slip closes: each pick has the stake taken off the coins (ALL IN on two bets: half on each)
  closeMarket() {
    this.mktEl.hidden = true; const m = this.mkt; this.mkt = null; if (!m) return m; const c = calls(), both = m.pick && m.b && m.b.pick;
    for (const q of [m, m.b]) { if (!q || !q.pick) continue; const want = c.stake === 'all' ? (both ? Math.floor(c.coins / (q === m ? 2 : 1)) : c.coins) : c.stake, s = Math.min(want, c.coins); if (s <= 0) { q.pick = null; continue; } c.coins -= s; q.bet = s; }
    saveCalls(c); this.showCalls(); return m;
  }
  betLine(q) { const i = q.opts.indexOf(q.pick); return q.names[i] + ': ' + q.bet.toLocaleString(); }
  // what is riding on what is on now (and, in a battle, the buildings down so far against the line)
  showBet(m, extra) { const parts = []; for (const q of [m, m && m.b]) if (q && q.bet && q.pick && !q.done) parts.push(this.betLine(q)); if (!parts.length && !extra) { this.betEl.hidden = true; return; } this.betEl.innerHTML = (parts.length ? 'BETS · ' + parts.join(' · ') : '') + (extra ? (parts.length ? '<br>' : '') + extra : ''); this.betEl.hidden = false; }
  // the result: a right call pays the stake back x100/odds; returns what it paid. Settled once
  settle(m, key) {
    if (!m || !m.pick || !m.bet || m.done) return 0; m.done = true; const c = calls(); c.total++; let won = 0;
    if (m.pick === key) { won = Math.round(m.bet * 100 / Math.max(1, m.pct[m.opts.indexOf(key)])); c.right++; c.coins += won; c.points += won - m.bet; }
    saveCalls(c); this.showCalls(!!won); return won;
  }
  // no result (the broadcast moved on): the stakes not yet settled back
  refund(m, why) { this.betEl.hidden = true; let n = 0; for (const q of [m, m && m.b]) if (q && q.bet && !q.done) { n += q.bet; q.bet = 0; q.done = true; } if (!n) return; const c = calls(); c.coins += n; saveCalls(c); this.showCalls(); if (why) this.hits.say(why, 'small'); }
  showCalls(pop) {
    const c = calls(); this.scoreEl.innerHTML = '<div>CALLS<b>' + c.right + ' / ' + c.total + '</b></div><div class="pts">COINS<b>' + c.coins.toLocaleString() + '</b></div>';
    if (pop) { this.scoreEl.classList.remove('pop'); void this.scoreEl.offsetWidth; this.scoreEl.classList.add('pop'); }
  }
  // the slip's countdown has run out, or Next disaster
  go() { const m = this.mkt; if (m && m.kind === 'battle') this.battleGo(); else this.next(); }
  skip() { if (this.leaving >= 0 || this.bt) return; if (this.mkt) { this.calm = -1; this.go(); } } // a battle is seen through

  // ---------- what hits next: three disasters at their odds; the next one is drawn at those odds
  openMarket() {
    const opts = shuffle(POOL.filter(k => !this.recent.includes(k))).slice(0, 3), w = opts.map(() => 0.35 + Math.random()), s = w.reduce((a, b) => a + b, 0);
    const pct = w.map(v => Math.max(5, Math.round(v / s * 100))); pct[0] += 100 - pct.reduce((a, b) => a + b, 0);
    this.slip('market', 'WHAT HITS ' + this.town.toUpperCase() + '?', 'Then bet on the heroes and on the damage', opts.map((k, i) => ({ key: k, name: KIND[k], pct: pct[i] })));
  }
  draw(m) { let r = Math.random() * 100; for (let i = 0; i < m.opts.length; i++) { if ((r -= m.pct[i]) <= 0) return m.opts[i]; } return m.opts[m.opts.length - 1]; }
  // the market closes: the disaster drawn, and the slip on how the battle goes
  next() {
    if (this.leaving >= 0) return; const m = this.closeMarket(), type = m && m.kind === 'market' ? this.draw(m) : pick(POOL.filter(k => !this.recent.includes(k)));
    this.recent.push(type); if (this.recent.length > 3) this.recent.shift();
    if (m && m.pick) { const won = this.settle(m, type); if (won) this.hits.say('You called it! +' + won.toLocaleString() + ' coins', 'combo'); else if (m.bet) this.hits.say('Missed it: ' + KIND[type] + ', ' + m.bet.toLocaleString() + ' coins lost', 'small'); }
    this.openBattle(type);
  }

  // ---------- the battle for the town (Sean, 2026-11-05: the original look, filmed from the helicopters; big fights between the heroes, the
  // villains, the disaster and the rescue services and the army): the disaster, one of the villains with it, the heroes on the hero signal,
  // the rescue services and the army rolling. Bets: do the heroes beat the villain (drawn at the odds, set on the heroes' rolls, heroes.js
  // heroesWin), and the buildings down by the time it is over
  openBattle(kind) {
    const vs = HS.team('villain').map((id) => HS.name(id)).filter((n) => VILLAINS.includes(n)), vName = pick(vs.length ? vs : VILLAINS), v2 = pick(VILLAINS.filter((n) => n !== vName)), vNames = [vName, v2], vShow = HS.disp(vName) + ' and ' + HS.disp(v2), line = lineOf(kind); // two of them: two fights at once, three heroes
    const ph = Math.round(clamp(WIN_P[kind] + (Math.random() - 0.5) * 0.2, 0.25, 0.78) * 100);
    this.pend = { kind, vNames, vShow, line, ph };
    this.say('BREAKING: ' + NEWS[kind] + ' ' + this.town + '! ' + vShow + ' are behind it. The hero signal is lit');
    this.card('', '');
    this.slip('battle', THE[kind].toUpperCase() + ', ' + vShow.toUpperCase(), vShow + ' are behind it. The heroes ' + (ph >= 50 ? pick(FORM) : 'are up against it') + '; the rescue services and the army roll in. Who wins, and the damage?',
      [{ key: 'heroes', name: 'The heroes win', pct: ph }, { key: 'villain', name: 'The villains win', pct: 100 - ph }], {},
      [{ key: 'under', name: 'Under ' + line + ' down', pct: 50 }, { key: 'over', name: 'Over ' + line + ' down', pct: 50 }]);
    this.calm = PICK_T;
  }
  battleGo() {
    const P = this.pend, m = this.closeMarket(), g = this.g, D = this.D, B = g.city.bounds; if (!P) return; this.pend = null;
    const win = Math.random() * 100 < (m ? m.pct[0] : P.ph), type = START[P.kind] || P.kind, H = HAZARDS[type] || {};
    const x = B.x0 + (B.x1 - B.x0) * (0.3 + Math.random() * 0.4), z = B.z0 + (B.z1 - B.z0) * (0.3 + Math.random() * 0.4);
    const tap = H.tap || type === 'spill', ev = D.start(type, tap ? x : null, tap ? z : null, LIFE[P.kind] ? { life: LIFE[P.kind] } : {});
    const ves = P.vNames.map((n, i) => D.start('villains', x + (i ? -50 : 50), z + 50, { only: n.toLowerCase(), quiet: true, life: 999 })).filter((e) => e && e.who && e.who[0]), vs = ves.map((e) => e.who[0]), v = vs[0];
    if (!v) { this.refund(m, 'No show tonight: your bets are back'); this.after = 3; return; }
    const holds = win ? null : pick(vs); for (const q of vs) { q.hp = q.hpMax = 600; q.heroWin = q !== holds; } // the heroes' last blows land, or one of them shrugs it off (villains.js beat)
    if (ev && (ev.type === 'kaiju' || ev.type === 'worm')) ev.heroWin = win || Math.random() < 0.5; // the monster too: driven off, or the heroes swatted away
    this.bt = { P, m, ev, ve: ves[0], ves, vs, v, holds, win, t: 0, key: null, endT: -1, base0: D.stats.buildings, heroT: 6, camT: 14, onV: false };
    this.cur = ev || ves[0]; this.curT = 0; this.kind = P.kind; this.n++; this.helped = true; this.helpT = 0; D.boats.auto = true; // the rescue services and the army roll at once
    this.showBet(m, this.downLine());
  }
  downLine() { const b = this.bt; return b ? 'BUILDINGS DOWN <b>' + Math.max(0, this.D.stats.buildings - b.base0) + '</b> · LINE ' + b.P.line : ''; }
  battleStep(dt, sdt) {
    const b = this.bt, D = this.D, v = b.v; b.t += sdt;
    if (b.heroT > 0 && (b.heroT -= sdt) <= 0) { const H = D.start('heroes', v.x, v.z); if (H) { H.holds = () => { H.hold = 0; H.vHold = 0; }; H.holds(); for (const hr of H.who) hr.waitT = Math.min(hr.waitT, 1.5); } this.say('The heroes are here! They go for ' + b.P.vShow); }
    // the director: the disaster, then the fight with the villain, and back (the helicopters and viewers' phones film whichever)
    if ((b.camT -= sdt) <= 0) { const fights = b.ves.filter((e, i) => !b.vs[i].gone && !b.vs[i].beaten); b.onV = !b.onV || !(b.ev && b.ev.alive); b.camT = b.onV ? 16 : 12; this.cur = b.onV && fights.length ? pick(fights) : b.ev && b.ev.alive ? b.ev : fights[0] || this.cur; } // the helicopter pans across, no cut
    if (!b.key) {
      let k = b.vs.every((q) => q.beaten) ? 'heroes' : b.vs.some((q) => q.heroLost) || (b.ev && b.ev.heroLost) ? 'villain' : null;
      if (!k && b.t > SETTLE_T) { b.vs.forEach((q, i) => { if (q.beaten || q.gone) return; if (q === b.holds) { q.heroLost = true; D.emit({ type: 'herolost', x: q.x, z: q.z, text: HS.disp(q.name) + ' was too strong for the heroes! They are falling back' }); } else b.ves[i].beat(q, 'Nova'); }); k = b.win ? 'heroes' : 'villain'; } // the heroes never got to them all: the draw stands
      if (k) { b.key = k; b.endT = AFTER_T; const w = this.settle(b.m, k); this.cur = b.ve;
        const who = b.holds ? HS.disp(b.holds.name) : b.P.vShow; this.card(k === 'heroes' ? 'The heroes win' : who + ' wins', k === 'heroes' ? b.P.vShow + ' are beaten' : 'The heroes fall back'); this.cardT = 4;
        this.say(k === 'heroes' ? 'The heroes beat ' + b.P.vShow + ' in ' + this.town + '!' : who + ' was too much for the heroes in ' + this.town + '!');
        if (w) this.hits.say('You called it! +' + w.toLocaleString() + ' coins', 'combo'); else if (b.m && b.m.pick && b.m.bet) this.hits.say((k === 'heroes' ? 'The heroes' : 'The villains') + ' won: ' + b.m.bet.toLocaleString() + ' coins lost', 'small'); }
    } else if ((b.endT -= sdt) <= 0 || !D.list.some((e) => e.alive && e.type !== 'heroes' && e.type !== 'villains' && e.type !== 'player')) this.battleEnd(); // the damage counted a while longer, or till the disaster is over
    if (this.bt && (this.betT = (this.betT || 0) - dt) <= 0) { this.betT = 0.5; this.showBet(b.m, this.downLine()); }
  }
  battleEnd() {
    const b = this.bt; if (!b) return; this.bt = null; const n = Math.max(0, this.D.stats.buildings - b.base0), key2 = n > b.P.line ? 'over' : 'under', w = b.m && b.m.b ? this.settle(b.m.b, key2) : 0; noteLine(b.P.kind, n);
    this.betEl.hidden = true; this.helped = false; this.D.boats.auto = false;
    if (w) this.hits.say('You called it! +' + w.toLocaleString() + ' coins', 'combo'); else if (b.m && b.m.b && b.m.b.pick && b.m.b.bet) this.hits.say(key2.toUpperCase() + ': ' + b.m.b.bet.toLocaleString() + ' coins lost', 'small');
    { const top = b.key === 'heroes' ? 'Saved by the heroes' : 'The villains win', big = n + ' building' + (n === 1 ? '' : 's') + ' down: ' + key2.toUpperCase(); setTimeout(() => { if (this.leaving < 0) { this.card(top, big); this.cardT = 5; } }, 1800); } // after the YOU CALLED IT flash, not over it
    this.say(this.town + ' counts the cost: ' + n + ' buildings down'); this.after = 8;
  }
  battleAbort() { const b = this.bt; if (!b) return; this.bt = null; this.refund(b.m); this.helped = false; }

  // on to another town (up to the globe and down to it): half the time back to one the broadcast has hit before
  moveOn() {
    if (this.leaving >= 0) return;
    this.battleAbort();
    const here = placeKey(), all = Object.keys(PLACES).filter(k => k !== here), hit = all.filter(k => damageOf(k).length);
    const key = hit.length && Math.random() < 0.5 ? hit[Math.floor(Math.random() * hit.length)] : all[Math.floor(Math.random() * all.length)];
    this.leaving = 3; this.toKey = key; if (this.mkt) { this.mktEl.hidden = true; this.mkt = null; } this.betEl.hidden = true;
    const dead = []; for (let k = 0; k < this.g.city.buildings.length; k++) if (this.g.city.dead[k]) dead.push(k);
    rememberDamage(here, dead); // the ruins stay for next time
    this.card(damageOf(key).length ? 'Back to' : 'Next stop', PLACES[key].name);
    this.say('That’s all from ' + this.town + '. Next stop: ' + PLACES[key].name);
  }

  card(top, big) { this.nextEl.innerHTML = top ? top + '<b>' + big + '</b>' : ''; this.nextEl.style.opacity = top ? '1' : '0'; }

  // a headline onto the ticker (the newest goes on next)
  say(text) { this.news.push(text); if (this.news.length > 6) this.news.shift(); this.mEl.textContent = this.news.slice().reverse().join('   •   '); }

  busy() { return false; }
  tap() {}
  phase() { return CLOCK; }

  onEvent(e) {
    const c = this.g.city;
    this.auto.onEvent(e);
    if (e.type === 'collapse') { const b = c.buildings[e.k]; if (b) this.hits.hit('b', e.x, b.top, e.z, 1, { big: b.top - b.baseY >= 40 }); this.chain.collapse(e.k, e.fall); }
    else if (e.type === 'fire') { this.hits.hit('fire', 0, 0, 0, 1); this.chain.fire(e.k); }
    else if (e.type === 'carland' || e.type === 'carfire' || e.type === 'crash') { if (e.car) this.hits.hit('car', 0, 0, 0, 1); }
    if (e.text && (e.type === 'warn' || e.hazard || e.type === 'herolost' || e.type === 'villainbeaten')) { this.say(e.text); return true; } // warnings and the heroes' news go on the ticker, not over the picture
    return false;
  }

  update(sdt, dt) {
    const g = this.g, D = this.D;
    this.t += sdt; this.curT += sdt; CLOCK = (CLOCK + sdt / 720) % 1;
    this.hits.frame(dt, sdt); this.chain.step(sdt);
    // in a battle the rescue services and the army roll; between, the crews rebuild
    this.auto.update(sdt);
    if ((this.helpT -= sdt) <= 0) { this.helpT = 1; this.auto.rebuild(); if (this.helped) { this.auto.respond(); this.auto.sendHome(); } }
    // the ticker crawls right to left, round again once it has gone by
    const w = this.mEl.offsetWidth || 400, W = this.mEl.parentNode.offsetWidth || 300;
    this.mx -= dt * TICK_SPEED; if (this.mx < -w) this.mx = W; this.mEl.style.transform = 'translateX(' + this.mx.toFixed(1) + 'px)';
    this.cam.update(dt, sdt); // the helicopters and the viewers' videos, all the time (Sean: close shots are for playing, not for watching)
    if (this.cardT > 0 && (this.cardT -= dt) <= 0) this.card('', '');
    if (this.leaving >= 0) { if ((this.leaving -= dt) < 0) { this.leaving = 1e9; this.dead = true; g.journey(this.toKey); } return; }
    if (this.bt) this.battleStep(dt, sdt);
    if (this.mkt) this.cdEl.textContent = Math.max(0, Math.ceil(this.calm));
    if (this.calm >= 0 && (this.calm -= sdt) <= 0) { this.calm = -1; this.go(); }
    if (this.after >= 0 && !this.bt && !this.mkt && (this.after -= sdt) <= 0) { this.after = -1; this.moveOn(); } // the battle over: on to the next town
    if (this.t > TOWN_T * 3 && !this.bt && !this.mkt && this.after < 0) this.moveOn(); // never stuck in a town
    // now and then the tally
    if ((this.statT -= sdt) <= 0) {
      this.statT = 20;
      let fires = 0, cars = 0; for (let k = 0; k < g.fire.bFire.length; k++) if (g.fire.bFire[k] && !g.city.dead[k]) fires++;
      for (const c of g.traffic.cars) if (!c.mission && (c.gone || c.mode !== 0 || c.frozen)) cars++;
      for (const pc of g.traffic.parkedList) if (!pc.alive || pc.burnt) cars++;
      const crews = this.auto.works.length;
      this.say(this.town + ' so far: ' + D.stats.buildings + ' buildings down, ' + cars + ' cars wrecked, ' + fires + ' fires burning' + (crews ? ', ' + crews + ' crews rebuilding' : ''));
    }
  }

  dispose() { this.battleAbort(); this.live.remove(); this.tick.remove(); this.nextEl.remove(); this.mktEl.remove(); this.betEl.remove(); this.scoreEl.remove(); this.hits.dispose(); this.cam.dispose(); this.auto.reset(); document.body.classList.remove('zd-tv'); }
}
