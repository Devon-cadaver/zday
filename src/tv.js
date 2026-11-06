// Disaster TV: the end of the world, live. Lean back and watch: disasters roll in
// on a town one after another, filmed from the news helicopter and cameras on the
// rooftops, which the disasters may take out (tvcam.js); the big moments get
// their name and a beat of slow motion, the town finishes what they start
// (chain.js), and a ticker runs the headlines. After a few minutes the broadcast
// moves on to another town - often back to one it has hit before, where the
// crews are still rebuilding, for it to be hit again.
// The viewers bet (Sean's plan item 9: scenarios to sit back and bet on, from the heroes and disasters involved). Coins on the device, a stake
// on every slip, and the programme goes round three kinds of bet:
// - What hits next? Three disasters at their odds; the next one really is drawn at those odds. Called right, help comes early.
// - Fight Night: one of the hero side against one of the villain side, in the street fight with nobody at the controls (fightbot.js).
//   The odds from their levels and their form; the winner drawn at those odds and the fight played out to it.
// - Showdown: the villains, the kaiju or the worm against the heroes. The odds by the threat; the result drawn at them (heroWin, heroes.js).
// Next disaster sends the next one in at once.
import { Hits } from './hits.js';
import { Chain } from './chain.js';
import { HAZARDS } from './disasters.js';
import { PLACES, placeKey } from './places.js';
import { startExtra } from './mix.js';
import { TvCam } from './tvcam.js';
import { Responders } from './response.js';
import { Site } from './rebuild.js';
import { damageOf, rememberDamage } from './world.js';
import { HS, levelOf } from './herogame.js';
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
  font:800 11px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.04em;color:#f6ead2;white-space:nowrap;max-width:calc(100vw - 32px);overflow:hidden;text-overflow:ellipsis}
#zd-bet[hidden]{display:none}
#zd-bet b{color:#a6ff4d}
body.zd-tvfight #zd-fight .bars{top:calc(56px + env(safe-area-inset-top));right:12px}
body.zd-tvfight #zd-fight .say{top:calc(100px + env(safe-area-inset-top))!important}
body.zd-tvfight #zd-fight .cmb{top:calc(134px + env(safe-area-inset-top))}
body.zd-tvfight #zd-mkt{bottom:calc(var(--zd-bar-h, 64px) + 40px)}
body.zd-tvfight #zd-frame,body.zd-tvfight #zd-score{display:none}
#zd-fight.watch{pointer-events:none}
html body #zd-fight.watch .stk.fix,#zd-fight.watch .row4,#zd-fight.watch .hint,#zd-fight.watch .stk,#zd-fight.watch .fin,#zd-fight.watch .swbox,#zd-fight.watch .swkey,#zd-fight.watch .acts{display:none!important}
`;

const POOL = ['tornado', 'quake', 'flood', 'tsunami', 'riot', 'aliens', 'meteor', 'sinkhole', 'volcano', 'haboob', 'coldwave', 'solar', 'blackhole', 'plant', 'rift']; // what hits next; the villains, the kaiju and the worm have their Showdown
const SHOWS = ['villains', 'kaiju', 'worm'];
const LIFE = { villains: 80, kaiju: 80, worm: 70, aliens: 80 }; // the ones that would stay for minutes
const TOWN_T = 170, PICK_T = 12, MAX = 60, TICK_SPEED = 60; // s in a town before moving on; s to make a call; s before the next comes anyway; ticker px a second
const SEQ = ['market', 'fight', 'market', 'show']; // the programme, round and round, carried from town to town
const STAKES = [50, 100, 250, 'all'];
const HERO_KINDS = new Set(['villains', 'kaiju', 'worm', 'aliens', 'meteor', 'rift']); // called right: the heroes come at once
const VERB = { tornado: 'touches down in', quake: 'shakes', flood: 'floods', tsunami: 'heads for', riot: 'breaks out in', aliens: 'land in', meteor: 'rains down on', sinkhole: 'opens up in',
  volcano: 'erupts in', haboob: 'rolls into', coldwave: 'freezes', solar: 'strikes', blackhole: 'opens in', villains: 'attack', worm: 'surfaces in', kaiju: 'stomps into', plant: 'takes root in', rift: 'tears open over' };
const NAME = { aliens: 'Aliens', meteor: 'Meteors', villains: 'Super villains', haboob: 'A dust storm', coldwave: 'A cold wave', solar: 'A solar flare', blackhole: 'A black hole', worm: 'A giant worm', kaiju: 'A kaiju', plant: 'A killer plant', rift: 'A dimensional rift' };
const SHOW = { villains: ['The villains', 'Blur, Tyrant and Weaver attack'], kaiju: ['The kaiju', 'A kaiju stomps in'], worm: ['The worm', 'A giant worm surfaces'] };
const SHOW_P = { villains: 0.42, kaiju: 0.55, worm: 0.6 }; // how often the heroes win each, before the night's form
const FORM = ['is in form tonight', 'trained all week', 'is coming off a win', 'looks rested']; // said of the one the odds favour
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
let FIRST = true; // the very first town of a broadcast gets the opening title
let CLOCK = 0.16; // the broadcast's time of day: one day and night every 12 minutes, carried on from town to town
let SLOT = 0;

// the viewer's coins and calls, kept on this device
function calls() { let c = null; try { c = JSON.parse(localStorage.getItem('zday_tvcalls')); } catch (e) { /* no storage */ } return { right: 0, total: 0, points: 0, coins: 1000, stake: 100, ...(c || {}) }; }
function saveCalls(c) { try { localStorage.setItem('zday_tvcalls', JSON.stringify(c)); } catch (e) { /* no storage */ } }

export class DisasterTV {
  constructor(g) {
    this.g = g; this.D = g.disasters; this.msgs = {}; this.kind = null; this.recent = []; this.fight = null; this.show = null;
    if (g.profile) g.profile.mode = null;
    if (!document.getElementById('zd-tv-css')) { const s = document.createElement('style'); s.id = 'zd-tv-css'; s.textContent = CSS; document.head.appendChild(s); }
    const live = this.live = document.createElement('div'); live.id = 'zd-live';
    live.innerHTML = '<span class="on"><i></i>LIVE</span><span class="ch"></span>';
    const tick = this.tick = document.createElement('div'); tick.id = 'zd-tick';
    tick.innerHTML = '<span class="k">NEWS</span><span class="w"><span class="m"></span></span>';
    const nx = this.nextEl = document.createElement('div'); nx.id = 'zd-next';
    const mk = this.mktEl = document.createElement('div'); mk.id = 'zd-mkt'; mk.hidden = true;
    mk.innerHTML = '<div class="t"><span class="hd"></span> <b></b><small></small></div><div class="row"></div><div class="stake"></div>';
    const sc = this.scoreEl = document.createElement('div'); sc.id = 'zd-score'; // the viewer's scoreboard: calls right out of calls made, coins
    const bt = this.betEl = document.createElement('div'); bt.id = 'zd-bet'; bt.hidden = true; // the bet riding on what is on now
    document.body.append(live, tick, nx, mk, sc, bt);
    this.chEl = live.querySelector('.ch'); this.mEl = tick.querySelector('.m');
    this.hdEl = mk.querySelector('.t .hd'); this.cdEl = mk.querySelector('.t b'); this.subEl = mk.querySelector('.t small'); this.rowEl = mk.querySelector('.row'); this.stakeEl = mk.querySelector('.stake');
    for (const ev of ['pointerdown', 'click']) mk.addEventListener(ev, (e) => e.stopPropagation());
    this.stakeUi();
    this.hits = new Hits(g, null, { quiet: true }); // no points on TV: just the big moments
    this.chain = new Chain(this.D, (text, slow) => this.hits.moment(text, slow));
    this.cam = new TvCam(this); // the helicopter and viewers' videos from the rooftops
    this.auto = new Responders(g); this.auto.on = false; // the crews rebuild between disasters; the rescue comes only when the viewers call it
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
    this.n = 0; this.t = 0; this.cur = null; this.curT = 0; this.leaving = -1; this.helped = false; this.helpT = 0; this.mkt = null; this.fight = null; this.show = null;
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
    this.calm = PICK_T + 2; this.openSlot(); // the first bet before the first disaster
  }

  // ---------- the slips: the bets on what is coming, each at its odds, with the stake below
  openSlot() { const k = SEQ[SLOT++ % SEQ.length]; if (k === 'fight' && this.openFight()) return; if (k === 'show' && this.openShow()) return; this.openMarket(); }
  slip(kind, head, sub, opts, x = {}) {
    { const c = calls(); if (c.coins < 10) { c.coins += 200; saveCalls(c); this.showCalls(true); this.say('The station spots you 200 coins: back in the game'); } } // never out of the game
    this.mkt = { kind, opts: opts.map(o => o.key), pct: opts.map(o => o.pct), names: opts.map(o => o.name), pick: null, ...x };
    this.hdEl.textContent = head; this.subEl.textContent = sub; this.rowEl.innerHTML = '';
    opts.forEach((o) => {
      const b = document.createElement('button'); b.type = 'button'; if (opts.length === 2) b.className = 'two';
      b.innerHTML = '<span>' + o.name + '</span><span class="p">' + o.pct + '%</span><span class="x">pays ×' + (100 / o.pct).toFixed(1) + '</span><span class="bar" style="width:' + o.pct + '%"></span>';
      b.addEventListener('pointerdown', (e) => e.stopPropagation());
      b.onclick = (e) => { e.stopPropagation(); if (!this.mkt) return; this.mkt.pick = o.key; for (const q of this.rowEl.children) q.classList.toggle('mine', q === b); };
      this.rowEl.appendChild(b);
    });
    this.stakeShow(); this.mktEl.hidden = false; this.betEl.hidden = true;
  }
  stakeUi() {
    this.stakeEl.innerHTML = '<span>STAKE<small></small></span>' + STAKES.map(s => '<button type="button" data-s="' + s + '">' + (s === 'all' ? 'ALL IN' : s) + '</button>').join('');
    this.stakeEl.querySelectorAll('[data-s]').forEach(b => { b.addEventListener('pointerdown', (e) => e.stopPropagation()); b.onclick = (e) => { e.stopPropagation(); const c = calls(); c.stake = b.dataset.s === 'all' ? 'all' : +b.dataset.s; saveCalls(c); this.stakeShow(); }; });
  }
  stakeShow() { const c = calls(); this.stakeEl.querySelector('small').textContent = c.coins.toLocaleString() + ' coins'; this.stakeEl.querySelectorAll('[data-s]').forEach(b => b.classList.toggle('on', String(c.stake) === b.dataset.s)); }
  // the slip closes: a pick has the stake taken off the coins
  closeMarket() {
    this.mktEl.hidden = true; const m = this.mkt; this.mkt = null; if (!m || !m.pick) return m;
    const c = calls(), s = Math.min(c.stake === 'all' ? c.coins : c.stake, c.coins); if (s <= 0) { m.pick = null; return m; }
    c.coins -= s; saveCalls(c); m.bet = s; this.showCalls(); return m;
  }
  // what is riding on what is on now
  showBet(m) { if (!m || !m.bet) { this.betEl.hidden = true; return; } const i = m.opts.indexOf(m.pick); this.betEl.innerHTML = 'YOUR BET: ' + m.bet.toLocaleString() + ' on ' + m.names[i] + ' · pays <b>' + Math.round(m.bet * 100 / m.pct[i]).toLocaleString() + '</b>'; this.betEl.hidden = false; }
  // the result: a right call pays the stake back x100/odds; returns what it paid
  settle(m, key) {
    this.betEl.hidden = true; if (!m || !m.pick || !m.bet) return 0; const c = calls(); c.total++; let won = 0;
    if (m.pick === key) { won = Math.round(m.bet * 100 / m.pct[m.opts.indexOf(key)]); c.right++; c.coins += won; c.points += won - m.bet; }
    saveCalls(c); this.showCalls(!!won); return won;
  }
  // no result (the broadcast moved on, it never came to anything): the stake back
  refund(m, why) { this.betEl.hidden = true; if (!m || !m.bet) return; const c = calls(); c.coins += m.bet; saveCalls(c); this.showCalls(); m.bet = 0; if (why) this.hits.say(why, 'small'); }
  // the bet's end, said: won, lost, or none placed
  told(m, key, winner, won) { if (won) this.hits.say('You called it! +' + won.toLocaleString() + ' coins', 'combo'); else if (m && m.pick && m.bet) this.hits.say(winner + ' won: ' + m.bet.toLocaleString() + ' coins lost', 'small'); else this.hits.say(winner + ' won', 'small'); }
  showCalls(pop) {
    const c = calls(); this.scoreEl.innerHTML = '<div>CALLS<b>' + c.right + ' / ' + c.total + '</b></div><div class="pts">COINS<b>' + c.coins.toLocaleString() + '</b></div>';
    if (pop) { this.scoreEl.classList.remove('pop'); void this.scoreEl.offsetWidth; this.scoreEl.classList.add('pop'); }
  }
  // the slip's countdown has run out, or Next disaster
  go() { const m = this.mkt; if (m && m.kind === 'fight') this.fightGo(); else if (m && m.kind === 'show') this.showGo(); else this.next(); }
  skip() {
    if (this.leaving >= 0 || this.fight) return; // a fight is seen through
    if (this.mkt) { this.calm = -1; this.go(); return; }
    if (this.show && !this.show.done) { this.show.done = true; this.refund(this.show.m, 'On to the next: your bet is back'); }
    this.next();
  }

  // ---------- what hits next: three disasters at their odds; the next one is drawn at those odds
  openMarket() {
    const opts = shuffle(POOL.filter(k => !this.recent.includes(k))).slice(0, 3), w = opts.map(() => 0.35 + Math.random()), s = w.reduce((a, b) => a + b, 0);
    const pct = w.map(v => Math.max(5, Math.round(v / s * 100))); pct[0] += 100 - pct.reduce((a, b) => a + b, 0);
    this.slip('market', 'WHAT HITS NEXT?', 'Call it right and help comes early', opts.map((k, i) => ({ key: k, name: HAZARDS[k].name, pct: pct[i] })));
  }
  draw(m) { let r = Math.random() * 100; for (let i = 0; i < m.opts.length; i++) { if ((r -= m.pct[i]) <= 0) return m.opts[i]; } return m.opts[m.opts.length - 1]; }

  // the next disaster now (the button, or the market closing)
  next() {
    if (this.leaving >= 0) return;
    const g = this.g, D = this.D, B = g.city.bounds, m = this.closeMarket();
    const type = m && m.kind === 'market' ? this.draw(m) : shuffle(POOL.filter(k => !this.recent.includes(k)))[0];
    this.recent.push(type); if (this.recent.length > 3) this.recent.shift();
    const x = B.x0 + (B.x1 - B.x0) * (0.3 + Math.random() * 0.4), z = B.z0 + (B.z1 - B.z0) * (0.3 + Math.random() * 0.4);
    let ev = null;
    if (type === 'meteor') startExtra(D, 'meteor', x, z); // a shower, not one rock with a long warning
    else ev = D.start(type, HAZARDS[type].tap ? x : null, HAZARDS[type].tap ? z : null, LIFE[type] ? { life: LIFE[type] } : {});
    this.cur = ev; this.curT = 0; this.kind = type; this.calm = -1; this.attacks = 0; this.n++;
    this.helped = false; D.boats.auto = false; this.heroT = HERO_KINDS.has(type) && type !== 'meteor' ? 30 : -1; // the heroes come anyway after a while (Sean: a villain hovered for a minute with nobody to fight)
    this.say('BREAKING: ' + (NAME[type] || 'A ' + HAZARDS[type].name.toLowerCase()) + ' ' + VERB[type] + ' ' + this.town + (HAZARDS[type].tap ? '’s ' + D.district(x, z) + ' district' : ''));
    this.card('', '');
    if (m && m.pick && m.kind === 'market') { // the viewer's call
      const won = this.settle(m, type);
      if (won) this.called(type, x, z, won); else if (m.bet) this.hits.say('Missed it: ' + HAZARDS[type].name + ', ' + m.bet.toLocaleString() + ' coins lost', 'small');
    }
  }
  // called right: help comes early
  called(type, x, z, won) {
    const D = this.D;
    this.hits.say('You called it! +' + won.toLocaleString() + ' coins', 'combo');
    if (HERO_KINDS.has(type)) {
      this.heroesNow(x, z);
      this.say('Our viewers called it! The heroes are already on their way');
    } else {
      this.helped = true; this.helpT = 0; D.boats.auto = true; // the rescue services roll at once
      this.say('Our viewers called it! The rescue services are already rolling');
    }
  }
  heroesNow(x, z) { const H = this.D.start('heroes', x, z, { brief: true }); if (H) { H.holds = () => { H.hold = 0; H.vHold = 0; }; H.holds(); for (const hr of H.who) hr.waitT = Math.min(hr.waitT, 1.5); } return H; } // no waiting: on their way now

  // ---------- Fight Night: one of each side in the street, nobody at the controls; the winner drawn at the odds on the slip
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
    this.cam.pick(true); this.cur = null; this.curT = 0;
  }
  fightAbort() { const F = this.fight; if (!F) return; if (F.m) this.refund(F.m); if (this.mkt && this.mkt.kind === 'fight') { this.mktEl.hidden = true; this.mkt = null; } F.end = 0; this.fightClose(); }

  // ---------- Showdown: a threat the heroes come for; their win or loss drawn at the odds on the slip
  openShow() {
    const left = SHOWS.filter(k => !this.recent.includes(k)), type = pick(left.length ? left : SHOWS), [who, sub] = SHOW[type];
    const ph = Math.round(clamp(SHOW_P[type] + (Math.random() - 0.5) * 0.2, 0.25, 0.75) * 100);
    this.show = { type, done: false, t: 0, m: null };
    this.slip('show', 'SHOWDOWN', sub + ' and the heroes are on their way. Do they stop it?', [{ key: 'heroes', name: 'The heroes', pct: ph }, { key: 'threat', name: who, pct: 100 - ph }]);
    return true;
  }
  showGo() {
    const S = this.show, m = this.closeMarket(), D = this.D, B = this.g.city.bounds; if (!S) return;
    S.m = m; const res = Math.random() * 100 < (m ? m.pct[0] : 50) ? 'heroes' : 'threat';
    const x = B.x0 + (B.x1 - B.x0) * (0.3 + Math.random() * 0.4), z = B.z0 + (B.z1 - B.z0) * (0.3 + Math.random() * 0.4), type = S.type;
    const ev = D.start(type, HAZARDS[type].tap ? x : null, HAZARDS[type].tap ? z : null, { life: 230, hp: type === 'kaiju' ? 560 : type === 'worm' ? 480 : undefined }); // less to wear down than usual: about a minute and a half with the three of them on it
    if (!ev) { S.done = true; this.refund(m); this.next(); return; }
    if (type === 'villains') { for (const v of ev.who) { v.hp = v.hpMax = 420; v.heroWin = true; } if (res === 'threat' && ev.who.length) pick(ev.who).heroWin = false; } else ev.heroWin = res === 'heroes'; // what the heroes' blows come to (heroes.js heroesWin)
    S.ev = ev; this.recent.push(type); if (this.recent.length > 3) this.recent.shift();
    this.cur = ev; this.curT = 0; this.kind = type; this.calm = -1; this.attacks = 0; this.n++; this.helped = false; D.boats.auto = false; this.heroT = -1;
    this.heroesNow(ev.x != null ? ev.x : x, ev.z != null ? ev.z : z);
    this.say('BREAKING: ' + NAME[type] + ' ' + VERB[type] + ' ' + this.town + '. The hero signal is lit!'); this.card('', ''); this.showBet(m);
  }
  showStep(sdt) {
    const S = this.show; if (!S || S.done || !S.ev) return; S.t += sdt; const e = S.ev; let r = null;
    if (S.type === 'villains') { const vs = e.who || []; if (vs.some(v => v.heroLost)) r = 'threat'; else if (vs.length && vs.every(v => v.beaten)) r = 'heroes'; }
    else if (e.heroLost) r = 'threat'; else if (e.hp <= 0) r = 'heroes';
    if (!r) { if (S.t > 200 || !e.alive) { S.done = true; this.refund(S.m, 'No result: your bet is back'); this.curT = Math.max(this.curT, MAX - 8); } return; }
    S.done = true; const name = r === 'heroes' ? 'The heroes' : SHOW[S.type][0], w = this.settle(S.m, r); this.told(S.m, r, name, w);
    this.say(r === 'heroes' ? 'The heroes saved ' + this.town + '!' : SHOW[S.type][0] + ' beat the heroes in ' + this.town + '!');
    this.curT = Math.max(this.curT, MAX - 10); // on to the next soon, whatever is still going
  }

  // on to another town (up to the globe and down to it): half the time back to one the broadcast has hit before
  moveOn() {
    if (this.leaving >= 0) return;
    this.fightAbort(); if (this.show && !this.show.done) { this.show.done = true; this.refund(this.show.m); }
    const here = placeKey(), all = Object.keys(PLACES).filter(k => k !== here), hit = all.filter(k => damageOf(k).length);
    const key = hit.length && Math.random() < 0.5 ? hit[Math.floor(Math.random() * hit.length)] : all[Math.floor(Math.random() * all.length)];
    this.leaving = 3; this.toKey = key; if (this.mkt) { this.mktEl.hidden = true; this.mkt = null; }
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
    if (e.text && (e.type === 'warn' || e.hazard)) { this.say(e.text); return true; } // warnings go on the ticker, not over the picture
    return false;
  }

  update(sdt, dt) {
    const g = this.g, D = this.D;
    this.t += sdt; this.curT += sdt; CLOCK = (CLOCK + sdt / 720) % 1;
    this.hits.frame(dt, sdt); this.chain.step(sdt);
    // the crews rebuild in the lulls; the rescue services work only when the viewers called it
    this.auto.update(sdt);
    if ((this.helpT -= sdt) <= 0) { this.helpT = 1; this.auto.rebuild(); if (this.helped) { this.auto.respond(); this.auto.sendHome(); } }
    // the ticker crawls right to left, round again once it has gone by
    const w = this.mEl.offsetWidth || 400, W = this.mEl.parentNode.offsetWidth || 300;
    this.mx -= dt * TICK_SPEED; if (this.mx < -w) this.mx = W; this.mEl.style.transform = 'translateX(' + this.mx.toFixed(1) + 'px)';
    if (!this.fight) this.cam.update(dt, sdt); // a fight has its own camera (fighttest.js)
    if (this.cardT > 0 && (this.cardT -= dt) <= 0) this.card('', '');
    if (this.heroT > 0 && (this.heroT -= sdt) <= 0 && !D.list.some(e => e.type === 'heroes' && e.alive && !e.leaving)) { // nobody called it: the heroes come all the same
      const c = this.cur, B = g.city.bounds, x = c && c.x != null ? c.x : (B.x0 + B.x1) / 2, z = c && c.z != null ? c.z : (B.z0 + B.z1) / 2;
      D.start('heroes', x, z, { brief: true }); this.say('The hero signal is lit over ' + this.town + '!');
    }
    if (this.leaving >= 0) { if ((this.leaving -= dt) < 0) { this.leaving = 1e9; this.dead = true; g.journey(this.toKey); } return; }
    if (this.fight) this.fightStep(dt, sdt);
    this.showStep(sdt);
    // what is on: anything still going that is not a helper
    const on = D.list.some(e => e.alive && e.type !== 'heroes' && e.type !== 'player'), busy = this.fight || (this.show && !this.show.done && this.show.ev);
    if (this.calm < 0 && !busy && (!on || this.curT > MAX) && this.curT > 6) { // that one is over (or has gone on long enough)
      if (this.t > TOWN_T) { this.moveOn(); return; } // a few minutes here: on to the next town
      this.calm = PICK_T; this.openSlot();
    }
    if (this.mkt) this.cdEl.textContent = Math.max(0, Math.ceil(this.calm));
    if (this.calm >= 0 && (this.calm -= sdt) <= 0) { this.calm = -1; this.go(); }
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

  dispose() { this.fightAbort(); if (this.show && !this.show.done) this.refund(this.show.m); this.live.remove(); this.tick.remove(); this.nextEl.remove(); this.mktEl.remove(); this.betEl.remove(); this.scoreEl.remove(); this.hits.dispose(); this.cam.dispose(); this.auto.reset(); document.body.classList.remove('zd-tv', 'zd-tvfight'); }
}
