// Disaster TV: the end of the world, live. Lean back and watch: disasters roll in
// on a town one after another, filmed from the news helicopter and cameras on the
// rooftops, which the disasters may take out (tvcam.js); the big moments get
// their name and a beat of slow motion, the town finishes what they start
// (chain.js), and a ticker runs the headlines. After a few minutes the broadcast
// moves on to another town - often back to one it has hit before, where the
// crews are still rebuilding, for it to be hit again. Before each disaster the
// viewers bet on what comes next (a little prediction market): call it right and
// help comes early - the heroes for the villains, the monsters and the meteors,
// the rescue services for the rest. Next disaster sends the next one in at once.
import { Hits } from './hits.js';
import { Chain } from './chain.js';
import { HAZARDS } from './disasters.js';
import { PLACES, placeKey } from './places.js';
import { startExtra } from './mix.js';
import { TvCam } from './tvcam.js';
import { Responders } from './response.js';
import { Site } from './rebuild.js';
import { damageOf, rememberDamage } from './world.js';

const CSS = `
#zd-live{position:fixed;left:max(10px, env(safe-area-inset-left));top:calc(8px + env(safe-area-inset-top));z-index:6;pointer-events:none;display:flex;gap:6px;align-items:center;
  font:800 11px/1 system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.06em;color:#fff}
#zd-live .on{background:#d8321e;padding:5px 7px;border-radius:5px;display:flex;align-items:center;gap:5px}
#zd-live .on i{width:7px;height:7px;border-radius:50%;background:#fff;animation:zdlive 1.2s infinite}
#zd-live .ch{background:rgba(20,14,8,.72);padding:5px 8px;border-radius:5px;color:#f6ead2}
#zd-score{position:fixed;right:max(10px, env(safe-area-inset-right));top:calc(8px + env(safe-area-inset-top));z-index:6;pointer-events:none;background:rgba(20,14,8,.78);border:1px solid rgba(255,236,200,.18);border-radius:8px;padding:5px 9px;
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
#zd-mkt .t{background:rgba(20,14,8,.86);padding:6px 11px;border-radius:12px;letter-spacing:.04em;text-align:center}
#zd-mkt .t b{color:#ffb070;font-variant-numeric:tabular-nums}
#zd-mkt .t small{display:block;font-size:10px;font-weight:600;opacity:.75;margin-top:2px;letter-spacing:.02em}
#zd-mkt .row{display:flex;gap:8px;pointer-events:auto}
#zd-mkt button{appearance:none;position:relative;overflow:hidden;border:1px solid rgba(255,236,200,.3);background:rgba(30,22,12,.94);color:#f6ead2;border-radius:12px;width:104px;padding:8px 5px 10px;
  font:700 11.5px/1.15 system-ui,-apple-system,"Segoe UI",sans-serif;display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer}
#zd-mkt button .p{font-size:19px;font-weight:900;color:#7be0ff;font-variant-numeric:tabular-nums}
#zd-mkt button .x{font-size:10px;opacity:.7}
#zd-mkt button .bar{position:absolute;left:0;bottom:0;height:3px;background:#7be0ff}
#zd-mkt button.mine{border-color:#a6ff4d;box-shadow:0 0 0 1px #a6ff4d inset}
#zd-mkt button.mine .p,#zd-mkt button.mine .x{color:#a6ff4d;opacity:1}
#zd-mkt button.mine .bar{background:#a6ff4d}
#zd-mkt button:active{transform:scale(.96)}
`;

const POOL = ['tornado', 'quake', 'flood', 'tsunami', 'riot', 'aliens', 'meteor', 'sinkhole', 'volcano', 'haboob', 'coldwave', 'solar', 'blackhole', 'villains', 'worm', 'kaiju', 'plant'];
const LIFE = { villains: 80, kaiju: 80, worm: 70, aliens: 80 }; // the ones that would stay for minutes
const TOWN_T = 170, PICK_T = 10, MAX = 60, TICK_SPEED = 60; // s in a town before moving on; s to make a call; s before the next comes anyway; ticker px a second
const HERO_KINDS = new Set(['villains', 'kaiju', 'worm', 'aliens', 'meteor']); // called right: the heroes come at once
const VERB = { tornado: 'touches down in', quake: 'shakes', flood: 'floods', tsunami: 'heads for', riot: 'breaks out in', aliens: 'land in', meteor: 'rains down on', sinkhole: 'opens up in',
  volcano: 'erupts in', haboob: 'rolls into', coldwave: 'freezes', solar: 'strikes', blackhole: 'opens in', villains: 'attack', worm: 'surfaces in', kaiju: 'stomps into', plant: 'takes root in' };
const NAME = { aliens: 'Aliens', meteor: 'Meteors', villains: 'Super villains', haboob: 'A dust storm', coldwave: 'A cold wave', solar: 'A solar flare', blackhole: 'A black hole', worm: 'A giant worm', kaiju: 'A kaiju', plant: 'A killer plant' };
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
let FIRST = true; // the very first town of a broadcast gets the opening title
let CLOCK = 0.16; // the broadcast's time of day: one day and night every 12 minutes, carried on from town to town

// the viewer's calls, kept on this device
function calls() { let c = null; try { c = JSON.parse(localStorage.getItem('zday_tvcalls')); } catch (e) { /* no storage */ } return { right: 0, total: 0, points: 0, ...(c || {}) }; }
function saveCalls(c) { try { localStorage.setItem('zday_tvcalls', JSON.stringify(c)); } catch (e) { /* no storage */ } }

export class DisasterTV {
  constructor(g) {
    this.g = g; this.D = g.disasters; this.msgs = {}; this.kind = null; this.recent = [];
    if (g.profile) g.profile.mode = null;
    if (!document.getElementById('zd-tv-css')) { const s = document.createElement('style'); s.id = 'zd-tv-css'; s.textContent = CSS; document.head.appendChild(s); }
    const live = this.live = document.createElement('div'); live.id = 'zd-live';
    live.innerHTML = '<span class="on"><i></i>LIVE</span><span class="ch"></span>';
    const tick = this.tick = document.createElement('div'); tick.id = 'zd-tick';
    tick.innerHTML = '<span class="k">NEWS</span><span class="w"><span class="m"></span></span>';
    const nx = this.nextEl = document.createElement('div'); nx.id = 'zd-next';
    const mk = this.mktEl = document.createElement('div'); mk.id = 'zd-mkt'; mk.hidden = true;
    mk.innerHTML = '<div class="t">What hits next? <b></b><small>Call it right and help comes early</small></div><div class="row"></div>';
    const sc = this.scoreEl = document.createElement('div'); sc.id = 'zd-score'; // the viewer's scoreboard: calls right out of calls made, points won
    document.body.append(live, tick, nx, mk, sc);
    this.chEl = live.querySelector('.ch'); this.mEl = tick.querySelector('.m');
    this.cdEl = mk.querySelector('.t b'); this.rowEl = mk.querySelector('.row');
    this.hits = new Hits(g, null, { quiet: true }); // no points on TV: just the big moments
    this.chain = new Chain(this.D, (text, slow) => this.hits.moment(text, slow));
    this.cam = new TvCam(this); // the helicopter and viewers' videos from the rooftops
    this.auto = new Responders(g); this.auto.on = false; // the crews rebuild between disasters; the rescue comes only when the viewers call it
    document.body.classList.add('zd-tv'); // the radio's words sit over the ticker
    g.addButton('zd-tvcam', 'Change camera', () => this.cam.change());
    g.addButton('zd-tvnext', 'Next disaster', () => this.next());
    g.addButton('zd-tvtown', 'Next town', () => this.moveOn());
    g.addButton('zd-menu-btn', 'Menu', () => g.toMenu());
    this.showCalls();
    this.start();
  }

  start() {
    const g = this.g, D = this.D, city = g.city, people = g.people;
    g.resetWorld(); g.setSpeed && g.setSpeed(1); D.boats.auto = false;
    this.n = 0; this.t = 0; this.cur = null; this.curT = 0; this.leaving = -1; this.helped = false; this.helpT = 0; this.mkt = null;
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
    this.calm = PICK_T + 2; this.openMarket(); // the first call before the first disaster
    this.cam.setup();
  }

  // ---------- the prediction market: three disasters at their odds; the next one is drawn at those odds
  openMarket() {
    const opts = shuffle(POOL.filter(k => !this.recent.includes(k))).slice(0, 3), w = opts.map(() => 0.35 + Math.random()), s = w.reduce((a, b) => a + b, 0);
    const pct = w.map(v => Math.max(5, Math.round(v / s * 100))); pct[0] += 100 - pct.reduce((a, b) => a + b, 0);
    this.mkt = { opts, pct, pick: null };
    this.rowEl.innerHTML = '';
    opts.forEach((k, i) => {
      const b = document.createElement('button'); b.type = 'button';
      b.innerHTML = '<span>' + HAZARDS[k].name + '</span><span class="p">' + pct[i] + '%</span><span class="x">pays ×' + (100 / pct[i]).toFixed(1) + '</span><span class="bar" style="width:' + pct[i] + '%"></span>';
      b.addEventListener('pointerdown', (e) => e.stopPropagation());
      b.onclick = (e) => { e.stopPropagation(); if (!this.mkt) return; this.mkt.pick = k; for (const o of this.rowEl.children) o.classList.toggle('mine', o === b); };
      this.rowEl.appendChild(b);
    });
    this.mktEl.hidden = false;
  }
  closeMarket() { this.mktEl.hidden = true; const m = this.mkt; this.mkt = null; return m; }
  draw(m) { let r = Math.random() * 100; for (let i = 0; i < m.opts.length; i++) { if ((r -= m.pct[i]) <= 0) return m.opts[i]; } return m.opts[m.opts.length - 1]; }
  showCalls(pop) {
    const c = calls(); this.scoreEl.innerHTML = '<div>CALLS<b>' + c.right + ' / ' + c.total + '</b></div><div class="pts">POINTS<b>' + c.points.toLocaleString() + '</b></div>';
    if (pop) { this.scoreEl.classList.remove('pop'); void this.scoreEl.offsetWidth; this.scoreEl.classList.add('pop'); }
  }

  // the next disaster now (the button, or the market closing)
  next() {
    if (this.leaving >= 0) return;
    const g = this.g, D = this.D, B = g.city.bounds, m = this.closeMarket();
    const type = m ? this.draw(m) : shuffle(POOL.filter(k => !this.recent.includes(k)))[0];
    this.recent.push(type); if (this.recent.length > 3) this.recent.shift();
    const x = B.x0 + (B.x1 - B.x0) * (0.3 + Math.random() * 0.4), z = B.z0 + (B.z1 - B.z0) * (0.3 + Math.random() * 0.4);
    let ev = null;
    if (type === 'meteor') startExtra(D, 'meteor', x, z); // a shower, not one rock with a long warning
    else ev = D.start(type, HAZARDS[type].tap ? x : null, HAZARDS[type].tap ? z : null, LIFE[type] ? { life: LIFE[type] } : {});
    this.cur = ev; this.curT = 0; this.kind = type; this.calm = -1; this.attacks = 0; this.n++;
    this.helped = false; D.boats.auto = false; this.heroT = HERO_KINDS.has(type) && type !== 'meteor' ? 30 : -1; // the heroes come anyway after a while (Sean: a villain hovered for a minute with nobody to fight)
    this.say('BREAKING: ' + (NAME[type] || 'A ' + HAZARDS[type].name.toLowerCase()) + ' ' + VERB[type] + ' ' + this.town + (HAZARDS[type].tap ? '’s ' + D.district(x, z) + ' district' : ''));
    this.card('', '');
    if (m && m.pick) { // the viewer's call
      const c = calls(); c.total++;
      const won = m.pick === type ? Math.round(10000 / m.pct[m.opts.indexOf(type)]) : 0; // a call pays 100 x its odds: the long shots pay most
      if (won) { c.right++; c.points += won; this.called(type, x, z, won); } else this.hits.say('Missed it: ' + HAZARDS[type].name, 'small');
      saveCalls(c); this.showCalls(!!won);
    }
  }
  // called right: help comes early
  called(type, x, z, won) {
    const D = this.D;
    this.hits.say('You called it! +' + won.toLocaleString(), 'combo');
    if (HERO_KINDS.has(type)) {
      const H = D.start('heroes', x, z, { brief: true });
      if (H) { H.holds = () => { H.hold = 0; H.vHold = 0; }; H.holds(); for (const hr of H.who) hr.waitT = Math.min(hr.waitT, 1.5); } // no waiting: on their way now
      this.say('Our viewers called it! The heroes are already on their way');
    } else {
      this.helped = true; this.helpT = 0; D.boats.auto = true; // the rescue services roll at once
      this.say('Our viewers called it! The rescue services are already rolling');
    }
  }

  // on to another town (up to the globe and down to it): half the time back to one the broadcast has hit before
  moveOn() {
    if (this.leaving >= 0) return;
    const here = placeKey(), all = Object.keys(PLACES).filter(k => k !== here), hit = all.filter(k => damageOf(k).length);
    const key = hit.length && Math.random() < 0.5 ? hit[Math.floor(Math.random() * hit.length)] : all[Math.floor(Math.random() * all.length)];
    this.leaving = 3; this.toKey = key; this.closeMarket();
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
    this.cam.update(dt, sdt);
    if (this.cardT > 0 && (this.cardT -= dt) <= 0) this.card('', '');
    if (this.heroT > 0 && (this.heroT -= sdt) <= 0 && !D.list.some(e => e.type === 'heroes' && e.alive && !e.leaving)) { // nobody called it: the heroes come all the same
      const c = this.cur, B = g.city.bounds, x = c && c.x != null ? c.x : (B.x0 + B.x1) / 2, z = c && c.z != null ? c.z : (B.z0 + B.z1) / 2;
      D.start('heroes', x, z, { brief: true }); this.say('The hero signal is lit over ' + this.town + '!');
    }
    if (this.leaving >= 0) { if ((this.leaving -= dt) < 0) { this.leaving = 1e9; this.dead = true; g.journey(this.toKey); } return; }
    // what is on: anything still going that is not a helper
    const on = D.list.some(e => e.alive && e.type !== 'heroes' && e.type !== 'player');
    if (this.calm < 0 && (!on || this.curT > MAX) && this.curT > 6) { // that one is over (or has gone on long enough)
      if (this.t > TOWN_T) { this.moveOn(); return; } // a few minutes here: on to the next town
      this.calm = PICK_T; this.openMarket();
    }
    if (this.mkt) this.cdEl.textContent = Math.max(0, Math.ceil(this.calm));
    if (this.calm >= 0 && (this.calm -= sdt) <= 0) { this.calm = -1; this.next(); }
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

  dispose() { this.live.remove(); this.tick.remove(); this.nextEl.remove(); this.mktEl.remove(); this.hits.dispose(); this.cam.dispose(); this.auto.reset(); document.body.classList.remove('zd-tv'); }
}
