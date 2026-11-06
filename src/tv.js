// Disaster TV: the end of the world, live. Lean back and watch, and bet. Each town the broadcast lands in gets one disaster, the way it is in
// Defend (watchlevel.js): one of the heroes answers it with nobody at the controls and can lose, and the villain behind it is fought in the
// street after. The viewers bet three ways, coins on the device and a stake on every slip: what hits the town (three kinds at their odds,
// drawn at them), then the heroes win or lose (odds by the kind, the hero's level and the night's form; drawn at them and played to), and
// the damage (over or under a line of buildings down, the median of what this device has seen of that kind). Every third town a Fight Night
// follows: one of the heroes against one of the villains, nobody at the controls (fightbot.js). Filmed from the news helicopters and
// viewers' phones between (tvcam.js), the level's own camera during it. Then on to the next town, often one it has hit before.
import { Hits } from './hits.js';
import { Chain } from './chain.js';
import { PLACES, placeKey } from './places.js';
import { TvCam } from './tvcam.js';
import { Responders } from './response.js';
import { Site } from './rebuild.js';
import { damageOf, rememberDamage } from './world.js';
import { HS, levelOf } from './herogame.js';
import { WatchLevel, AFTER } from './watchlevel.js';
import { sfx } from './audio.js';

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
body.zd-tvfight #zd-fight .bars{top:calc(56px + env(safe-area-inset-top));right:12px}
body.zd-tvfight #zd-fight .say{top:calc(100px + env(safe-area-inset-top))!important}
body.zd-tvfight #zd-fight .cmb{top:calc(134px + env(safe-area-inset-top))}
body.zd-tvfight #zd-mkt{bottom:calc(var(--zd-bar-h, 64px) + 40px)}
body.zd-tvfight #zd-frame,body.zd-tvfight #zd-score{display:none}
#zd-fight.watch{pointer-events:none}
body.zd-tvlevel #zd-fight{pointer-events:none}
html body.zd-tvlevel #zd-fight .stk.fix,body.zd-tvlevel #zd-fight .row4,body.zd-tvlevel #zd-fight .hint,body.zd-tvlevel #zd-fight .stk,body.zd-tvlevel #zd-fight .fin,body.zd-tvlevel #zd-fight .swbox,body.zd-tvlevel #zd-fight .swkey,body.zd-tvlevel #zd-fight .acts,body.zd-tvlevel #zd-fight [data-t],body.zd-tvlevel #zd-squad,body.zd-tvlevel #zd-rep,body.zd-tvlevel #zd-flybar{display:none!important}
body.zd-tvlevel #zd-fly{pointer-events:none}
html body #zd-fight.watch .stk.fix,#zd-fight.watch .row4,#zd-fight.watch .hint,#zd-fight.watch .stk,#zd-fight.watch .fin,#zd-fight.watch .swbox,#zd-fight.watch .swkey,#zd-fight.watch .acts{display:none!important}
`;

const FOOT_K = ['aliens', 'zombies', 'worm', 'kaiju', 'riot', 'quake'];
const POOL = FOOT_K.slice(); // what hits next: the disasters as they are in Defend (watchlevel.js)
const TOWN_T = 170, PICK_T = 12, TICK_SPEED = 60; // s in a town at most; s to make a call; ticker px a second
const STAKES = [50, 100, 250, 'all'];
const KIND = { aliens: 'Aliens', zombies: 'Zombies', worm: 'Giant worm', kaiju: 'Kaiju', riot: 'Riot', quake: 'Earthquake', tornado: 'Tornado', flood: 'Flood', tsunami: 'Tsunami', haboob: 'Dust storm', coldwave: 'Cold wave' };
const THE = { aliens: 'The invasion', zombies: 'The horde', worm: 'The worm', kaiju: 'The kaiju', riot: 'The mob', quake: 'The Faultline', tornado: 'The tornado', flood: 'The flood', tsunami: 'The wave', haboob: 'The dust storm', coldwave: 'The cold front' };
const NEWS = { aliens: 'An alien invasion lands in', zombies: 'A zombie outbreak tears through', worm: 'A giant worm surfaces in', kaiju: 'A kaiju stomps into', riot: 'A riot breaks out in', quake: 'The Faultline rises in', tornado: 'A tornado touches down in', flood: 'Floods hit', tsunami: 'A tsunami heads for', haboob: 'A dust storm rolls into', coldwave: 'A cold front freezes' };
const WIN_P = { aliens: 0.62, zombies: 0.66, worm: 0.56, kaiju: 0.5, riot: 0.7, quake: 0.52, tornado: 0.56, flood: 0.62, tsunami: 0.5, haboob: 0.56, coldwave: 0.56 }; // how often the heroes win each, before the night's form
const LINE0 = { aliens: 30, zombies: 8, worm: 40, kaiju: 35, riot: 10, quake: 18, tornado: 9, flood: 2, tsunami: 7, haboob: 4, coldwave: 3 }; // buildings down, the bookmaker's first guess; then the median of what this device has seen
const FORM = ['is in form tonight', 'trained all week', 'is coming off a win', 'looks rested']; // said of the one the odds favour
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
let FIRST = true; // the very first town of a broadcast gets the opening title
let CLOCK = 0.16; // the broadcast's time of day: one day and night every 12 minutes, carried on from town to town
let TOWNS = 0; // towns this broadcast: every third one has a Fight Night after its disaster

// the viewer's coins and calls, kept on this device; lines: the buildings brought down by each kind, the last nine
function calls() { let c = null; try { c = JSON.parse(localStorage.getItem('zday_tvcalls')); } catch (e) { /* no storage */ } return { right: 0, total: 0, points: 0, coins: 1000, stake: 100, lines: {}, ...(c || {}) }; }
function saveCalls(c) { try { localStorage.setItem('zday_tvcalls', JSON.stringify(c)); } catch (e) { /* no storage */ } }
function lineOf(kind) { const L = (calls().lines || {})[kind]; if (!L || L.length < 3) return LINE0[kind] + 0.5; const s = L.slice().sort((a, b) => a - b); return s[Math.floor(s.length / 2)] + 0.5; }
function noteLine(kind, n) { const c = calls(); c.lines = c.lines || {}; const L = c.lines[kind] = (c.lines[kind] || []).concat(n); if (L.length > 9) L.shift(); saveCalls(c); }

export class DisasterTV {
  constructor(g) {
    this.g = g; this.D = g.disasters; this.msgs = {}; this.kind = null; this.recent = []; this.fight = null; this.lv = null;
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
    this.cam = new TvCam(this); // the helicopter and viewers' videos from the rooftops
    this.auto = new Responders(g); this.auto.on = false; // the crews rebuild between disasters
    document.body.classList.add('zd-tv'); // the radio's words sit over the ticker
    g.addButton('zd-tvcam', 'Change camera', () => this.cam.change());
    g.addButton('zd-tvnext', 'Next disaster', () => this.skip());
    g.addButton('zd-tvtown', 'Next town', () => this.moveOn());
    g.addButton('zd-menu-btn', 'Menu', () => g.toMenu());
    this.showCalls();
    this.start();
  }
  // what the engines ask of the mode in a story level (squad.js, flight.js, heropower.js): the level running inside the TV
  get squad() { return this.lv && this.lv.squad; }
  get side() { return this.lv ? 'hero' : undefined; }
  get round() { return this.lv && this.lv.round; }
  placeStyle() { const p = PLACES[placeKey()]; return p && p.style; }

  start() {
    const g = this.g, D = this.D, city = g.city, people = g.people;
    g.resetWorld(); g.setSpeed && g.setSpeed(1); D.boats.auto = false;
    this.n = 0; this.t = 0; this.cur = null; this.curT = 0; this.leaving = -1; this.mkt = null; this.fight = null; this.lv = null; this.after = -1; this.stage = 'market'; TOWNS++;
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
  // what is riding on what is on now (and, in a level, the buildings down so far against the line)
  showBet(m, extra) { const parts = []; for (const q of [m, m && m.b]) if (q && q.bet) parts.push(this.betLine(q)); if (!parts.length && !extra) { this.betEl.hidden = true; return; } this.betEl.innerHTML = (parts.length ? 'BETS · ' + parts.join(' · ') : '') + (extra ? (parts.length ? '<br>' : '') + extra : ''); this.betEl.hidden = false; }
  // the result: a right call pays the stake back x100/odds; returns what it paid
  settle(m, key) {
    if (!m || !m.pick || !m.bet) return 0; const c = calls(); c.total++; let won = 0;
    if (m.pick === key) { won = Math.round(m.bet * 100 / m.pct[m.opts.indexOf(key)]); c.right++; c.coins += won; c.points += won - m.bet; }
    saveCalls(c); this.showCalls(!!won); return won;
  }
  // no result (the broadcast moved on, it never came to anything): the stakes back
  refund(m, why) { this.betEl.hidden = true; let n = 0; for (const q of [m, m && m.b]) if (q && q.bet) { n += q.bet; q.bet = 0; } if (!n) return; const c = calls(); c.coins += n; saveCalls(c); this.showCalls(); if (why) this.hits.say(why, 'small'); }
  // the bet's end, said: won, lost, or none placed
  told(m, key, winner, won) { if (won) this.hits.say('You called it! +' + won.toLocaleString() + ' coins', 'combo'); else if (m && m.pick && m.bet) this.hits.say(winner + ' won: ' + m.bet.toLocaleString() + ' coins lost', 'small'); else this.hits.say(winner + ' won', 'small'); }
  showCalls(pop) {
    const c = calls(); this.scoreEl.innerHTML = '<div>CALLS<b>' + c.right + ' / ' + c.total + '</b></div><div class="pts">COINS<b>' + c.coins.toLocaleString() + '</b></div>';
    if (pop) { this.scoreEl.classList.remove('pop'); void this.scoreEl.offsetWidth; this.scoreEl.classList.add('pop'); }
  }
  // the slip's countdown has run out, or Next disaster
  go() { const m = this.mkt; if (m && m.kind === 'fight') this.fightGo(); else if (m && m.kind === 'level') this.levelGo(); else this.next(); }
  skip() { if (this.leaving >= 0 || this.fight || this.lv) return; if (this.mkt) { this.calm = -1; this.go(); } } // a level or a fight is seen through

  // ---------- what hits next: three disasters at their odds; the next one is drawn at those odds
  openMarket() {
    const opts = shuffle(POOL.filter(k => !this.recent.includes(k))).slice(0, 3), w = opts.map(() => 0.35 + Math.random()), s = w.reduce((a, b) => a + b, 0);
    const pct = w.map(v => Math.max(5, Math.round(v / s * 100))); pct[0] += 100 - pct.reduce((a, b) => a + b, 0);
    this.slip('market', 'WHAT HITS ' + this.town.toUpperCase() + '?', 'Then bet on the heroes and on the damage', opts.map((k, i) => ({ key: k, name: KIND[k], pct: pct[i] })));
  }
  draw(m) { let r = Math.random() * 100; for (let i = 0; i < m.opts.length; i++) { if ((r -= m.pct[i]) <= 0) return m.opts[i]; } return m.opts[m.opts.length - 1]; }
  // the market closes: the disaster drawn, and the slip on how it goes
  next() {
    if (this.leaving >= 0) return; const m = this.closeMarket(), type = m && m.kind === 'market' ? this.draw(m) : pick(POOL.filter(k => !this.recent.includes(k)));
    this.recent.push(type); if (this.recent.length > 3) this.recent.shift();
    if (m && m.pick) { const won = this.settle(m, type); if (won) this.hits.say('You called it! +' + won.toLocaleString() + ' coins', 'combo'); else if (m.bet) this.hits.say('Missed it: ' + KIND[type] + ', ' + m.bet.toLocaleString() + ' coins lost', 'small'); }
    this.openLevel(type);
  }

  // ---------- the disaster, Defend's own version, played by one of the heroes (watchlevel.js): the heroes win or lose, and the damage
  openLevel(kind) {
    const D = HS.load(), hs = HS.team('hero'), who = hs.length ? pick(hs) : 'nova', L = levelOf(D.chars[who].xp), name = HS.shown(who), ix = Math.floor(Math.random() * 3);
    const ph = Math.round(clamp(WIN_P[kind] + 0.025 * (L - 2 - ix) + (Math.random() - 0.5) * 0.16, 0.22, 0.8) * 100), line = lineOf(kind), after = AFTER[kind];
    this.pend = { kind, who, name, ix, L, line, ph }; this.card('', '');
    this.say('BREAKING: ' + NEWS[kind] + ' ' + this.town + '! ' + name + ' answers the call' + (after ? '; behind it, ' + after : ''));
    this.slip('level', THE[kind].toUpperCase() + ' vs ' + name.toUpperCase(), name + ' (level ' + L + ')' + (after ? ', then ' + after : '') + '. ' + (ph >= 50 ? name + ' ' + pick(FORM) : THE[kind] + ' looks strong') + '. And the damage?',
      [{ key: 'heroes', name: name + ' wins', pct: ph }, { key: 'threat', name: THE[kind] + ' wins', pct: 100 - ph }], {},
      [{ key: 'under', name: 'Under ' + line + ' down', pct: 50 }, { key: 'over', name: 'Over ' + line + ' down', pct: 50 }]);
    this.calm = PICK_T; this.stage = 'level';
  }
  levelGo() {
    const P = this.pend, m = this.closeMarket(), g = this.g; if (!P) return; this.pend = null;
    const win = Math.random() * 100 < (m ? m.pct[0] : P.ph), lossAt = !win && AFTER[P.kind] && P.kind !== 'riot' && Math.random() < 0.45 ? 'villain' : 'disaster';
    this.card('', ''); this.dof = g.post.opts.dof; this.base0 = this.D.stats.buildings; this.lvM = m; this.lvP = P;
    const lv = this.lv = new WatchLevel(g, this); g.watchLevel = lv; document.body.classList.add('zd-tvfight', 'zd-tvlevel');
    if (!lv.go(P.kind, { who: P.who, ix: P.ix, win, lossAt })) { this.lv = null; g.watchLevel = null; document.body.classList.remove('zd-tvfight', 'zd-tvlevel'); this.refund(m, 'No show tonight: your bets are back'); this.after = 3; return; }
    this.cam.label.innerHTML = '<i></i>HERO CAM · ' + P.name.toUpperCase(); this.cur = null; this.curT = 0; this.kind = P.kind; this.n++;
  }
  // the level is over (watchlevel.js finish): the bets settled, back to the cameras
  levelEnd(won, why) {
    const g = this.g, P = this.lvP, m = this.lvM, cam = g.camera, n = Math.max(0, this.D.stats.buildings - this.base0); this.lv = null; CLOCK = 0.3; /* the day goes on from the level's daylight */ g.watchLevel = null; this.lvM = null;
    document.body.classList.remove('zd-tvfight', 'zd-tvlevel', 'zd-flying'); g.post.opts.dof = this.dof; cam.up.set(0, 1, 0); cam.fov = this.cam.fov0; cam.updateProjectionMatrix(); g.controls.enabled = false; this.cam.pick(true);
    if (!P) return; noteLine(P.kind, n);
    const key = won ? 'heroes' : 'threat', who = won ? P.name : THE[P.kind], w1 = this.settle(m, key), key2 = n > P.line ? 'over' : 'under', w2 = m && m.b ? this.settle(m.b, key2) : 0;
    this.card(won ? 'Saved by ' + P.name : THE[P.kind] + ' wins', n + ' building' + (n === 1 ? '' : 's') + ' down: ' + key2.toUpperCase()); this.cardT = 6;
    this.say(won ? P.name + ' saved ' + this.town + '! ' + n + ' buildings down' : (why || THE[P.kind] + ' was too much') + ': ' + P.name + ' is down. ' + n + ' buildings lost in ' + this.town);
    const w = w1 + w2, lost = [m, m && m.b].filter(q => q && q.bet && q.pick && q.pick !== (q === m ? key : key2)).reduce((a, q) => a + q.bet, 0);
    if (w) this.hits.say('You called it! +' + w.toLocaleString() + ' coins', 'combo'); else if (lost) this.hits.say(who + ' won: ' + lost.toLocaleString() + ' coins lost', 'small'); else this.hits.say(who + ' won', 'small');
    this.betEl.hidden = true; this.after = 7; this.stage = TOWNS % 3 === 0 ? 'fightnext' : 'leave';
  }
  levelAbort() { if (!this.lv) return; const lv = this.lv; this.refund(this.lvM); this.lvP = null; this.lvM = null; lv.abort(); this.lv = null; this.g.watchLevel = null; document.body.classList.remove('zd-tvfight', 'zd-tvlevel', 'zd-flying'); }

  openFight() {
    const g = this.g, T = g.fightTest, P = g.people, D = HS.load(); if (!T || T.active) return false;
    const hs = HS.team('hero'), vs = HS.team('villain'), hId = hs.length ? pick(hs) : 'nova', vId = pick(vs.filter(q => q !== hId).length ? vs.filter(q => q !== hId) : ['tyrant', 'blur', 'weaver'].filter(q => q !== hId));
    const Lh = levelOf(D.chars[hId].xp), Lv = levelOf(D.chars[vId].xp), hShow = HS.shown(hId), vShow = HS.shown(vId);
    const ph = Math.round(clamp(0.5 + 0.07 * (Lh - Lv) + (Math.random() - 0.5) * 0.26, 0.22, 0.78) * 100);
    const B = g.city.bounds; let at = null; for (let i = 0; i < 16 && !at; i++) at = P.snapWalkable(B.x0 + (B.x1 - B.x0) * (0.3 + Math.random() * 0.4), B.z0 + (B.z1 - B.z0) * (0.3 + Math.random() * 0.4), 40);
    if (!at) return false;
    const dist = this.D.district(at[0], at[1]), hp = 400 + 10 * Lv; // tougher than in story mode: the bot hits faster than a thumb
    this.dof = g.post.opts.dof; document.body.classList.add('zd-tvfight');
    T.start({ ring: { x: at[0], z: at[1], y: P.groundY(at[0], at[1]), r: 26 }, street: true, who: HS.name(hId), hp: 100, foe: { name: HS.name(vId), hpMax: hp, hp, dmgK: 0.8 + 0.04 * Lv, lv: 2 + 0.25 * Lv }, watch: { wait: true, win: null, skill: clamp(0.5 + 0.03 * Lh, 0.5, 0.9) }, onEnd: (won) => this.fightEnd(won) });
    for (const [f, s] of [[T.h, -1], [T.v, 1]]) { f.x = T.cx + s * 1.8; f.z = T.cz - s * 1.1; f.px = f.x; f.pz = f.z; } // close, face to face, both above the slip
    { const bars = T.el.querySelectorAll('.bars > div'); if (bars[0] && bars[0].firstChild) bars[0].firstChild.textContent = hShow.toUpperCase() + ' · LV ' + Lh; if (bars[1] && bars[1].firstChild) bars[1].firstChild.textContent = vShow.toUpperCase() + ' · LV ' + Lv; } // the names the viewer gave them
    this.cam.label.innerHTML = '<i></i>FIGHT CAM · ' + dist.toUpperCase();
    this.fight = { T, hShow, vShow, t: 0, end: -1, m: null };
    const fav = ph >= 50 ? hShow : vShow;
    this.slip('fight', 'FIGHT NIGHT', hShow + ' (level ' + Lh + ') vs ' + vShow + ' (level ' + Lv + '). ' + fav + ' ' + pick(FORM) + '. Who wins?', [{ key: 'h', name: hShow, pct: ph }, { key: 'v', name: vShow, pct: 100 - ph }]);
    this.say('FIGHT NIGHT in ' + this.town + ': ' + hShow + ' takes on ' + vShow + ' in the ' + dist + ' district. Place your bets');
    this.card('', ''); return true;
  }
  fightGo() {
    const F = this.fight, m = this.closeMarket(); if (!F) return;
    F.m = m; const W = F.T.o.watch; W.win = Math.random() * 100 < (m ? m.pct[0] : 50) ? 'h' : 'v'; W.wait = false; // drawn at the odds on the slip
    F.T.say('FIGHT!', 1.2, '#ffd27a'); sfx('chime', F.T.h.x, F.T.h.y, F.T.h.z, { gain: 0.8, rate: 0.8 });
    this.showBet(m); this.cur = null; this.curT = 0; this.kind = 'fight'; this.calm = -1; this.n++;
  }
  // the fight is over (fighttest.js finish): the bet settled; a few seconds on the winner, then back to the cameras
  fightEnd(won) {
    const F = this.fight; if (!F || F.end >= 0) return; F.end = 3.2;
    const name = won ? F.hShow : F.vShow, w = this.settle(F.m, won ? 'h' : 'v');
    F.T.say(name.toUpperCase() + ' WINS!', 3, won ? '#ffd27a' : '#ff8a7a'); this.told(F.m, won ? 'h' : 'v', name, w);
    this.say(name + ' wins Fight Night in ' + this.town + '!');
  }
  fightStep(dt, sdt) {
    const F = this.fight; F.t += sdt;
    if (F.end >= 0) { if ((F.end -= dt) <= 0) this.fightClose(); return; }
    if (!F.T.active) { this.fightClose(); return; } // ended some other way
    if (!F.T.over && !F.T.o.watch.wait && F.t > PICK_T + 150) { F.T.say('ON POINTS', 1.2, '#ffd27a'); F.T.finish(F.T.o.watch.win === 'h'); } // too long: the judges give it to the one it was going to
  }
  fightClose() {
    const F = this.fight; if (!F) return; this.fight = null; const g = this.g, cam = g.camera;
    if (F.T.active) F.T.stop(true);
    document.body.classList.remove('zd-tvfight'); g.post.opts.dof = this.dof; cam.up.set(0, 1, 0); cam.fov = this.cam.fov0; cam.updateProjectionMatrix(); g.controls.enabled = false;
    this.cam.pick(true); this.cur = null; this.curT = 0; this.after = 4; this.stage = 'leave';
  }
  fightAbort() { const F = this.fight; if (!F) return; if (F.m) this.refund(F.m); if (this.mkt && this.mkt.kind === 'fight') { this.mktEl.hidden = true; this.mkt = null; } F.end = 0; this.fightClose(); }

  // on to another town (up to the globe and down to it): half the time back to one the broadcast has hit before
  moveOn() {
    if (this.leaving >= 0) return;
    this.fightAbort(); this.levelAbort();
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
  phase() { return this.lv ? 0.3 : CLOCK; } // a level in the daylight, as in Defend
  zombieNight() { return !this.lv && !!this.g.people && this.g.people.stats.zombies >= 8; } // the zombie night (game.js), but not over a level: too dark to follow (Sean)

  onEvent(e) {
    const c = this.g.city;
    this.auto.onEvent(e);
    if (e.type === 'collapse') { const b = c.buildings[e.k]; if (b) this.hits.hit('b', e.x, b.top, e.z, 1, { big: b.top - b.baseY >= 40 }); this.chain.collapse(e.k, e.fall); }
    else if (e.type === 'fire') { this.hits.hit('fire', 0, 0, 0, 1); this.chain.fire(e.k); }
    else if (e.type === 'carland' || e.type === 'carfire' || e.type === 'crash') { if (e.car) this.hits.hit('car', 0, 0, 0, 1); }
    if (e.text && (e.type === 'warn' || e.hazard)) { this.say(e.text); return true; } // warnings go on the ticker, not over the picture
    return false;
  }

  update(sdt, dt) {
    const g = this.g, D = this.D;
    this.t += sdt; this.curT += sdt; CLOCK = (CLOCK + sdt / 720) % 1;
    this.hits.frame(dt, sdt); this.chain.step(sdt);
    this.auto.update(sdt); if ((this.helpT = (this.helpT || 0) - sdt) <= 0) { this.helpT = 1; if (!this.lv) this.auto.rebuild(); } // the crews rebuild between disasters
    // the ticker crawls right to left, round again once it has gone by
    const w = this.mEl.offsetWidth || 400, W = this.mEl.parentNode.offsetWidth || 300;
    this.mx -= dt * TICK_SPEED; if (this.mx < -w) this.mx = W; this.mEl.style.transform = 'translateX(' + this.mx.toFixed(1) + 'px)';
    if (!this.fight && !this.lv) this.cam.update(dt, sdt); // a fight and a level have their own cameras
    if (this.cardT > 0 && (this.cardT -= dt) <= 0) this.card('', '');
    if (this.leaving >= 0) { if ((this.leaving -= dt) < 0) { this.leaving = 1e9; this.dead = true; g.journey(this.toKey); } return; }
    if (this.lv) { this.lv.update(); if (this.lv && (this.betT = (this.betT || 0) - dt) <= 0) { this.betT = 0.5; const n = Math.max(0, D.stats.buildings - this.base0); this.showBet(this.lvM, 'BUILDINGS DOWN <b>' + n + '</b> · LINE ' + this.lvP.line); } }
    if (this.fight) this.fightStep(dt, sdt);
    if (this.mkt) this.cdEl.textContent = Math.max(0, Math.ceil(this.calm));
    if (this.calm >= 0 && (this.calm -= sdt) <= 0) { this.calm = -1; this.go(); }
    // after the disaster: a Fight Night now and then, else on to the next town
    if (this.after >= 0 && !this.lv && !this.fight && !this.mkt && (this.after -= sdt) <= 0) { this.after = -1; if (this.stage === 'fightnext' && this.openFight()) { this.calm = PICK_T; this.stage = 'fight'; } else this.moveOn(); }
    if (this.t > TOWN_T * 4 && !this.lv && !this.fight && !this.mkt && this.after < 0) this.moveOn(); // never stuck in a town
    // now and then the tally
    if ((this.statT -= sdt) <= 0) {
      this.statT = 20;
      let fires = 0, cars = 0; for (let k = 0; k < g.fire.bFire.length; k++) if (g.fire.bFire[k] && !g.city.dead[k]) fires++;
      for (const c of g.traffic.cars) if (!c.mission && (c.gone || c.mode !== 0 || c.frozen)) cars++;
      for (const pc of g.traffic.parkedList) if (!pc.alive || pc.burnt) cars++;
      this.say(this.town + ' so far: ' + D.stats.buildings + ' buildings down, ' + cars + ' cars wrecked, ' + fires + ' fires burning');
    }
  }

  dispose() { this.fightAbort(); this.levelAbort(); this.live.remove(); this.tick.remove(); this.nextEl.remove(); this.mktEl.remove(); this.betEl.remove(); this.scoreEl.remove(); this.hits.dispose(); this.cam.dispose(); this.auto.reset(); document.body.classList.remove('zd-tv', 'zd-tvfight', 'zd-tvlevel'); }
}
