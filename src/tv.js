// Disaster TV: lean back and watch. Disasters roll in on a town one after
// another, the camera follows each like a news crew (the follow director in
// game.js), the big moments get their name and a beat of slow motion, the town
// finishes what they start (chain.js), a ticker runs the headlines, and after a
// few the broadcast moves on to another town. Next disaster sends the next one in
// at once; one finger turns the view, two zoom.
import { Hits } from './hits.js';
import { Chain } from './chain.js';
import { HAZARDS } from './disasters.js';
import { PLACES, placeKey } from './places.js';
import { startExtra } from './mix.js';

const CSS = `
#zd-live{position:fixed;left:max(10px, env(safe-area-inset-left));top:calc(8px + env(safe-area-inset-top));z-index:6;pointer-events:none;display:flex;gap:6px;align-items:center;
  font:800 11px/1 system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.06em;color:#fff}
#zd-live .on{background:#d8321e;padding:5px 7px;border-radius:5px;display:flex;align-items:center;gap:5px}
#zd-live .on i{width:7px;height:7px;border-radius:50%;background:#fff;animation:zdlive 1.2s infinite}
#zd-live .ch{background:rgba(20,14,8,.72);padding:5px 8px;border-radius:5px;color:#f6ead2}
@keyframes zdlive{50%{opacity:.25}}
#zd-tick{position:fixed;left:0;right:0;bottom:calc(var(--zd-bar-h, 64px) + 8px);z-index:6;pointer-events:none;display:flex;align-items:stretch;height:26px;
  font:700 12.5px/26px system-ui,-apple-system,"Segoe UI",sans-serif;color:#f6ead2;background:rgba(20,14,8,.78);border-top:2px solid #d8321e}
#zd-tick .k{flex:none;background:#d8321e;color:#fff;padding:0 9px;font-weight:900;letter-spacing:.05em}
#zd-tick .w{flex:1;overflow:hidden;position:relative}
#zd-tick .m{position:absolute;left:0;top:0;white-space:nowrap;will-change:transform}
#zd-next{position:fixed;left:0;right:0;top:38%;text-align:center;z-index:6;pointer-events:none;font:900 15px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;
  color:#f6ead2;text-shadow:0 1px 3px rgba(0,0,0,.9);letter-spacing:.06em;text-transform:uppercase;transition:opacity .4s;opacity:0}
#zd-next b{display:block;font-size:30px;color:#ffe08a;letter-spacing:.02em;margin-top:4px}
`;

const POOL = ['tornado', 'quake', 'flood', 'tsunami', 'riot', 'aliens', 'meteor', 'sinkhole', 'volcano', 'haboob', 'coldwave', 'solar', 'blackhole', 'villains', 'worm', 'kaiju'];
const LIFE = { villains: 80, kaiju: 80, worm: 70, aliens: 80 }; // the ones that would stay for minutes
const PER_TOWN = 4, GAP = 5, MAX = 60, TICK_SPEED = 60; // disasters a town; s of calm between; s before the next comes anyway; ticker px a second
const VERB = { tornado: 'touches down in', quake: 'shakes', flood: 'floods', tsunami: 'heads for', riot: 'breaks out in', aliens: 'land in', meteor: 'rains down on', sinkhole: 'opens up in',
  volcano: 'erupts in', haboob: 'rolls into', coldwave: 'freezes', solar: 'strikes', blackhole: 'opens in', villains: 'attack', worm: 'surfaces in', kaiju: 'stomps into' };
const NAME = { aliens: 'Aliens', meteor: 'Meteors', villains: 'Super villains', haboob: 'A dust storm', coldwave: 'A cold wave', solar: 'A solar flare', blackhole: 'A black hole', worm: 'A giant worm', kaiju: 'A kaiju' };

export class DisasterTV {
  constructor(g) {
    this.g = g; this.D = g.disasters; this.msgs = {}; this.kind = null;
    if (g.profile) g.profile.mode = null;
    if (!document.getElementById('zd-tv-css')) { const s = document.createElement('style'); s.id = 'zd-tv-css'; s.textContent = CSS; document.head.appendChild(s); }
    const live = this.live = document.createElement('div'); live.id = 'zd-live';
    live.innerHTML = '<span class="on"><i></i>LIVE</span><span class="ch"></span>';
    const tick = this.tick = document.createElement('div'); tick.id = 'zd-tick';
    tick.innerHTML = '<span class="k">NEWS</span><span class="w"><span class="m"></span></span>';
    const nx = this.nextEl = document.createElement('div'); nx.id = 'zd-next';
    document.body.append(live, tick, nx);
    this.chEl = live.querySelector('.ch'); this.mEl = tick.querySelector('.m');
    this.hits = new Hits(g, null, { quiet: true }); // no points on TV: just the big moments
    this.chain = new Chain(this.D, (text, slow) => this.hits.moment(text, slow));
    g.addButton('zd-tvnext', 'Next disaster', () => this.next());
    g.addButton('zd-tvtown', 'Next town', () => this.moveOn());
    g.addButton('zd-menu-btn', 'Menu', () => { location.href = location.pathname; });
    this.start();
  }

  start() {
    const g = this.g;
    g.resetWorld(); g.setSpeed && g.setSpeed(1);
    const all = POOL.slice(); for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
    this.queue = all.slice(0, PER_TOWN); this.n = 0; this.t = 0; this.cur = null; this.curT = 0; this.calm = 2.5; this.leaving = -1;
    this.news = []; this.mx = 0; this.statT = 20;
    this.hits.reset(); this.chain.reset();
    this.town = PLACES[placeKey()] ? PLACES[placeKey()].name : 'the city';
    this.chEl.textContent = 'MLD NEWS · ' + this.town.toUpperCase();
    this.say('Live from ' + this.town + ': stay tuned');
    const B = g.city.bounds; g.lookAt((B.x0 + B.x1) / 2, (B.z0 + B.z1) / 2, 520);
  }

  // the next disaster now (the button), or the next town when this one has had its share
  next() {
    if (this.n >= this.queue.length) { this.moveOn(); return; }
    const g = this.g, D = this.D, type = this.queue[this.n++], B = g.city.bounds;
    const x = B.x0 + (B.x1 - B.x0) * (0.3 + Math.random() * 0.4), z = B.z0 + (B.z1 - B.z0) * (0.3 + Math.random() * 0.4);
    let ev = null;
    if (type === 'meteor') startExtra(D, 'meteor', x, z); // a shower, not one rock with a long warning
    else ev = D.start(type, HAZARDS[type].tap ? x : null, HAZARDS[type].tap ? z : null, LIFE[type] ? { life: LIFE[type] } : {});
    this.cur = ev; this.curT = 0; this.kind = type; this.calm = -1;
    this.say('BREAKING: ' + (NAME[type] || 'A ' + HAZARDS[type].name.toLowerCase()) + ' ' + VERB[type] + ' ' + this.town + (HAZARDS[type].tap ? '’s ' + D.district(x, z) + ' district' : ''));
    this.card('', '');
    this.followT = 0.5;
  }

  // on to another town (up to the globe and down to it: the page builds it, same mode)
  moveOn() {
    if (this.leaving >= 0) return;
    const keys = Object.keys(PLACES).filter(k => k !== placeKey()), key = keys[Math.floor(Math.random() * keys.length)];
    this.leaving = 3; this.toKey = key;
    this.card('Next stop', PLACES[key].name);
    this.say('That’s all from ' + this.town + '. Next stop: ' + PLACES[key].name);
  }

  card(top, big) { this.nextEl.innerHTML = top ? top + '<b>' + big + '</b>' : ''; this.nextEl.style.opacity = top ? '1' : '0'; }

  // a headline onto the ticker (the newest goes on next)
  say(text) { this.news.push(text); if (this.news.length > 6) this.news.shift(); this.mEl.textContent = this.news.slice().reverse().join('   •   '); }

  busy() { return false; }
  tap() {}
  phase() { return 0.1 + (this.t / 400) % 0.5; } // the day goes by slowly

  onEvent(e) {
    const c = this.g.city;
    if (e.type === 'collapse') { const b = c.buildings[e.k]; if (b) this.hits.hit('b', e.x, b.top, e.z, 1, { big: b.top - b.baseY >= 40 }); this.chain.collapse(e.k, e.fall); }
    else if (e.type === 'fire') { this.hits.hit('fire', 0, 0, 0, 1); this.chain.fire(e.k); }
    else if (e.type === 'carland' || e.type === 'carfire' || e.type === 'crash') { if (e.car) this.hits.hit('car', 0, 0, 0, 1); }
    if (e.text && (e.type === 'warn' || e.hazard)) { this.say(e.text); return true; } // warnings go on the ticker, not over the picture
    return false;
  }

  update(sdt, dt) {
    const g = this.g, D = this.D;
    this.t += sdt; this.curT += sdt;
    this.hits.frame(dt, sdt); this.chain.step(sdt);
    // the ticker crawls right to left, round again once it has gone by
    const w = this.mEl.offsetWidth || 400, W = this.mEl.parentNode.offsetWidth || 300;
    this.mx -= dt * TICK_SPEED; if (this.mx < -w) this.mx = W; this.mEl.style.transform = 'translateX(' + this.mx.toFixed(1) + 'px)';
    if (this.leaving >= 0) { if ((this.leaving -= dt) < 0) { this.leaving = 1e9; this.dead = true; g.journey(this.toKey); } return; }
    // what is on: anything still going that is not a helper
    const on = D.list.some(e => e.alive && e.type !== 'heroes' && e.type !== 'player');
    if (this.calm < 0 && (!on || this.curT > MAX) && this.curT > 6) { // that one is over (or has gone on long enough)
      this.calm = this.n >= this.queue.length ? GAP + 3 : GAP;
      if (this.n < this.queue.length) this.card('Next up', HAZARDS[this.queue[this.n]].name);
    }
    if (this.calm >= 0 && (this.calm -= sdt) <= 0) { this.calm = -1; this.next(); }
    // keep the camera on the action: the newest disaster, once it is somewhere to look at
    if (this.followT != null && (this.followT -= dt) <= 0) {
      this.followT = 1;
      const c = this.cur, parts = c ? [].concat(c.who || [], c.tripods || [], c.saucers || []) : []; // villains, alien machines: each its own subject
      const subs = g.subjects('bad'), mine = subs.find(s => s.obj === c || parts.includes(s.obj));
      const want = mine || (g.followSub ? null : subs[0]);
      if (want && (!g.followSub || g.followSub.obj !== want.obj) && !g.manualCam) { g.followSubject(want, 'bad'); if (mine) this.followT = null; }
    }
    // now and then the tally
    if ((this.statT -= sdt) <= 0) {
      this.statT = 20;
      let fires = 0, cars = 0; for (let k = 0; k < g.fire.bFire.length; k++) if (g.fire.bFire[k] && !g.city.dead[k]) fires++;
      for (const c of g.traffic.cars) if (!c.mission && (c.gone || c.mode !== 0 || c.frozen)) cars++;
      for (const pc of g.traffic.parkedList) if (!pc.alive || pc.burnt) cars++;
      this.say(this.town + ' so far: ' + D.stats.buildings + ' buildings down, ' + cars + ' cars wrecked, ' + fires + ' fires burning');
    }
  }

  dispose() { this.live.remove(); this.tick.remove(); this.nextEl.remove(); this.hits.dispose(); }
}
