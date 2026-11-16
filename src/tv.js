// Disaster TV: the end of the world, live. Lean back, watch, and call it. Each town the broadcast lands in gets one disaster, the way it is in
// Defend (watchlevel.js): one of the heroes answers it with nobody at the controls and can lose, and the villain behind it is fought in the
// street after. Filmed from the helicopters, always up in the air (tvdirector.js keeps both fighters on screen, the hero in plain view, and
// the lens over the roofs), with the broadcast's own name tags over the hero and what she fights, never the game's close cameras or its own screen.
// Sean (2026-11-15): betting that is interactive but casual, the fights always visible, more action, more of the town wrecked. So the
// viewer calls it all through the show (tvcalls.js): what hits the town, who wins (riding the whole show), and quick calls every few seconds
// in the fight (the next big hit, a building down in ten seconds...), each a tap, a stake and a result there and then; and the fights bring
// more of the town down (tvwreck.js). Then on to the next town, often one it has hit before.
import * as THREE from 'three';
import { Hits } from './hits.js';
import { Chain } from './chain.js';
import { PLACES, placeKey } from './places.js';
import { TvCam } from './tvcam.js';
import { Responders } from './response.js';
import { Site } from './rebuild.js';
import { damageOf, rememberDamage } from './world.js';
import { HS, levelOf } from './herogame.js';
import { WatchLevel, AFTER, FOOT, AIR } from './watchlevel.js';
import { ARMIES, ARMY_KINDS } from './armies.js';
import { LiveCalls, calls, odds } from './tvcalls.js';
import { Wreck } from './tvwreck.js';

const CSS = `
#zd-live{position:fixed;left:max(10px, env(safe-area-inset-left));top:calc(8px + env(safe-area-inset-top));z-index:6;pointer-events:none;display:flex;gap:6px;align-items:center;
  font:800 11px/1 system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.06em;color:#fff}
#zd-live .on{background:#d8321e;padding:5px 7px;border-radius:5px;display:flex;align-items:center;gap:5px}
#zd-live .on i{width:7px;height:7px;border-radius:50%;background:#fff;animation:zdlive 1.2s infinite}
#zd-live .ch{background:rgba(20,14,8,.72);padding:5px 8px;border-radius:5px;color:#f6ead2}
#zd-score{position:fixed;right:max(10px, env(safe-area-inset-right));top:calc(56px + env(safe-area-inset-top));z-index:6;pointer-events:none;background:rgba(20,14,8,.78);border:1px solid rgba(255,236,200,.18);border-radius:8px;padding:5px 9px;
  font:800 10px/1.35 system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.06em;color:#f6ead2;text-align:right}
#zd-score b{font-size:13px;letter-spacing:0;font-variant-numeric:tabular-nums;color:#a6ff4d;margin-left:6px}
#zd-score .pts b{color:#ffd166}
#zd-score .stk b{color:#ff9f4d}
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
#zd-next b{display:block;font-size:30px;color:#ffe08a;letter-spacing:.02em;margin-top:4px}
#zd-next small{display:block;font-size:14px;color:#a6ff4d;margin-top:8px;letter-spacing:.04em}
html body.zd-tv #zd-radio{top:calc(50px + env(safe-area-inset-top));bottom:auto;left:max(10px, env(safe-area-inset-left));right:118px;margin:0;width:auto;max-width:none;font-size:11px;line-height:1.2;padding:3px 8px} /* the announcer up top under LIVE, out of the calls' way (top:auto once stretched it down the screen on Sean's iPhone: a top and a bottom of its own now) */
body.zd-tv #zd-minimap,body.zd-tv #zd-compass,body.zd-tvlevel #zd-radio{display:none!important} /* a broadcast, not a game: no map, no compass; in a level no announcer's strip either (the test pass: zombie lines in a riot; the ticker carries the news) */
.zd-tag{position:fixed;left:0;top:0;z-index:5;pointer-events:none;display:flex;flex-direction:column;align-items:center;gap:2px;font:900 10px/1 system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.06em;color:#fff;white-space:nowrap;will-change:transform}
.zd-tag[hidden]{display:none}
.zd-tag .nm{background:rgba(8,34,46,.88);border:1.5px solid #7be0ff;border-radius:5px;padding:3px 6px;text-transform:uppercase}
.zd-tag .hp{width:58px;height:4px;background:rgba(0,0,0,.65);border-radius:2px;overflow:hidden}
.zd-tag .hp i{display:block;height:100%;width:100%;background:#7be0ff;transition:width .25s}
.zd-tag .ar{width:0;height:0;border:5px solid transparent;border-top:6px solid #7be0ff;border-bottom:0}
.zd-tag.foe .nm{border-color:#ff6a4d;background:rgba(48,12,6,.88)}.zd-tag.foe .hp i{background:#ff6a4d}.zd-tag.foe .ar{border-top-color:#ff6a4d}
body.zd-tvlevel #zd-fight,body.zd-tvlevel #zd-fly,body.zd-tvlevel #zd-flybar,body.zd-tvlevel #zd-flyteam,body.zd-tvlevel #zd-boss,body.zd-tvlevel #zd-squad,body.zd-tvlevel #zd-rep,body.zd-tvlevel #zd-rev,body.zd-tvlevel #zd-heal,body.zd-tvlevel #zd-parry,body.zd-tvlevel #zd-catch,body.zd-tvlevel #zd-laser,body.zd-tvlevel #zd-mash,body.zd-tvlevel #zd-drain,body.zd-tvlevel #zd-lanes,body.zd-tvlevel #zd-army{display:none!important} /* in a level, none of the game's own screen: a broadcast */
html body.zd-tv.zd-flying #zd-bar{display:flex!important} /* and the TV's own buttons stay */
`;

const POOL = FOOT.concat(AIR); // what hits next: the disasters as they are in Defend (watchlevel.js), on foot and in the air
const TOWN_T = 170, TICK_SPEED = 60, WHAT_T = 8, WHO_T = 9; // s in a town at most; ticker px a second; s to call what hits, and who wins
const KIND = { aliens: 'Aliens', zombies: 'Zombies', worm: 'Giant worm', kaiju: 'Kaiju', riot: 'Riot', quake: 'Earthquake', tornado: 'Tornado', flood: 'Flood', tsunami: 'Tsunami', haboob: 'Dust storm', coldwave: 'Cold wave', ...Object.fromEntries(ARMY_KINDS.map((k) => [k, ARMIES[k].name])) };
const THE = { aliens: 'The invasion', zombies: 'The horde', worm: 'The worm', kaiju: 'The kaiju', riot: 'The mob', quake: 'The Faultline', tornado: 'The tornado', flood: 'The flood', tsunami: 'The wave', haboob: 'The dust storm', coldwave: 'The cold front', ...Object.fromEntries(ARMY_KINDS.map((k) => [k, ARMIES[k].the])) };
const NEWS = { aliens: 'An alien invasion lands in', zombies: 'A zombie outbreak tears through', worm: 'A giant worm surfaces in', kaiju: 'A kaiju stomps into', riot: 'A riot breaks out in', quake: 'The Faultline rises in', tornado: 'A tornado touches down in', flood: 'Floods hit', tsunami: 'A tsunami heads for', haboob: 'A dust storm rolls into', coldwave: 'A cold front freezes', ...Object.fromEntries(ARMY_KINDS.map((k) => [k, ARMIES[k].news])) };
const WIN_P = { aliens: 0.62, zombies: 0.66, worm: 0.56, kaiju: 0.5, riot: 0.7, quake: 0.52, tornado: 0.56, flood: 0.62, tsunami: 0.5, haboob: 0.56, coldwave: 0.56, ...Object.fromEntries(ARMY_KINDS.map((k) => [k, ARMIES[k].winP])) }; // how often the heroes win each, before the night's form
const CROWD = new Set(['zombies', 'aliens', 'riot', ...ARMY_KINDS]); // a crowd, not one foe: no "next big hit", how many she clears instead
const FORM = ['is in form tonight', 'trained all week', 'is coming off a win', 'looks rested']; // said of the one the odds favour
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const _v = new THREE.Vector3();
let FIRST = true; // the very first town of a broadcast gets the opening title
let CLOCK = 0.16; // the broadcast's time of day: one day and night every 12 minutes, carried on from town to town
let TOWNS = 0; // towns this broadcast

export class DisasterTV {
  constructor(g) {
    this.g = g; this.D = g.disasters; this.msgs = {}; this.kind = null; this.recent = []; this.lv = null;
    if (g.profile) g.profile.mode = null;
    if (!document.getElementById('zd-tv-css')) { const s = document.createElement('style'); s.id = 'zd-tv-css'; s.textContent = CSS; document.head.appendChild(s); }
    const live = this.live = document.createElement('div'); live.id = 'zd-live';
    live.innerHTML = '<span class="on"><i></i>LIVE</span><span class="ch"></span>';
    const tick = this.tick = document.createElement('div'); tick.id = 'zd-tick';
    tick.innerHTML = '<span class="k">NEWS</span><span class="w"><span class="m"></span></span>';
    const nx = this.nextEl = document.createElement('div'); nx.id = 'zd-next';
    const sc = this.scoreEl = document.createElement('div'); sc.id = 'zd-score'; // the viewer's scoreboard: calls right out of calls made, coins, the streak
    const tag = (cls) => { const e = document.createElement('div'); e.className = 'zd-tag ' + cls; e.hidden = true; e.innerHTML = '<span class="nm"></span><span class="hp"><i></i></span><span class="ar"></span>'; return e; };
    this.tagA = tag('hero'); this.tagB = tag('foe'); // the broadcast's name tags over the hero and what she fights
    document.body.append(live, tick, nx, sc, this.tagA, this.tagB);
    this.chEl = live.querySelector('.ch'); this.mEl = tick.querySelector('.m');
    this.hits = new Hits(g, null, { quiet: true }); // no points on TV: just the big moments
    this.chain = new Chain(this.D, (text, slow) => this.hits.moment(text, slow));
    this.cam = new TvCam(this); // the helicopters
    this.calls = new LiveCalls(this); // the viewer's calls (tvcalls.js)
    this.wreck = new Wreck(this); // more of the town down in a fight (tvwreck.js)
    this.auto = new Responders(g); this.auto.on = false; // the crews rebuild between disasters
    document.body.classList.add('zd-tv'); // the radio's words sit up top
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
    this.n = 0; this.t = 0; this.cur = null; this.curT = 0; this.leaving = -1; this.lv = null; this.after = -1; this.stage = 'open'; TOWNS++;
    this.news = []; this.mx = 0; this.statT = 20; this.drawn = null; this.queued = null; this.gapT = 0; this.forceWin = null; this.calls.townWon = 0;
    this.hits.reset(); this.chain.reset(); this.auto.reset(); this.wreck.reset();
    this.town = PLACES[placeKey()] ? PLACES[placeKey()].name : 'the city';
    this.chEl.textContent = 'MLD NEWS · ' + this.town.toUpperCase();
    // what this town still shows from the last time the broadcast was here: the ruins, and crews at work on them
    const ruins = damageOf(placeKey()).filter(k => city.buildings[k] && !city.dead[k]);
    for (const k of ruins) { people.clearBuilding(k, 'spare'); city.hideBuilding(k); city.addRubble(k, 0.75); this.auto.fell.set(k, -999); }
    if (ruins.length) {
      const B = city.bounds, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2, mid = (k) => { const b = city.buildings[k]; return Math.hypot((b.x0 + b.x1) / 2 - cx, (b.z0 + b.z1) / 2 - cz); };
      for (const k of ruins.slice().sort((a, b) => mid(a) - mid(b)).slice(0, 4)) this.auto.works.push(new Site(D, k, {}));
      this.say('Back in ' + this.town + ': crews are still rebuilding after the last time, ' + ruins.length + ' buildings down');
      this.card('Back in', this.town); this.cardT = 3;
    } else {
      this.say('Live from ' + this.town + ': stay tuned');
      this.card(FIRST ? 'The end of the world' : 'Live from', FIRST ? 'Live from ' + this.town : this.town); this.cardT = 3;
    }
    FIRST = false;
    this.cam.setup();
    this.pre = 2.4; // the town's card, then: what hits it
  }

  // ---------- the scoreboard: calls right out of calls made, the coins, the streak
  showCalls(pop) {
    const c = calls(); this.scoreEl.innerHTML = '<div>CALLS<b>' + c.right + ' / ' + c.total + '</b></div><div class="pts">COINS<b>' + c.coins.toLocaleString() + '</b></div>' + (c.streak >= 2 ? '<div class="stk">STREAK<b>' + c.streak + '</b></div>' : '');
    if (pop) { this.scoreEl.classList.remove('pop'); void this.scoreEl.offsetWidth; this.scoreEl.classList.add('pop'); }
  }
  // the next call once the card is free (a call that has to come next: WHO WINS after WHAT HITS)
  queue(fn) { this.queued = fn; }
  // Next disaster: the call on what hits closes now
  skip() { if (this.leaving >= 0 || this.lv) return; const q = this.calls.q; if (q && q.what && q.state === 'ask') q.t = q.askT; }

  // ---------- what hits the town: three disasters at their odds; the one that comes is drawn at those odds
  askWhat() {
    const opts = shuffle(POOL.filter(k => !this.recent.includes(k))).slice(0, 3), w = opts.map(() => 0.35 + Math.random()), s = w.reduce((a, b) => a + b, 0);
    const pct = w.map(v => Math.max(8, Math.round(v / s * 100))); pct[0] += 100 - pct.reduce((a, b) => a + b, 0);
    this.stage = 'what'; this.drawn = null;
    this.calls.ask({ what: true, head: 'What hits ' + this.town + '?', opts: opts.map((k, i) => ({ key: k, name: KIND[k], x: odds(pct[i] / 100) })), askT: WHAT_T, win: 1,
      onClose: () => { let r = Math.random() * 100, k = opts[opts.length - 1]; for (let i = 0; i < opts.length; i++) { if ((r -= pct[i]) <= 0) { k = opts[i]; break; } } this.drawn = k; this.openLevel(k); },
      check: () => this.drawn });
  }

  // ---------- the disaster, Defend's own version, played by one of the heroes (watchlevel.js), on at once; WHO WINS asked as it starts
  openLevel(kind) {
    if (this.leaving >= 0 || this.lv) return; this.recent.push(kind); if (this.recent.length > 3) this.recent.shift();
    const D = HS.load(), hs = HS.team('hero'), who = hs.length ? pick(hs) : 'nova', L = levelOf(D.chars[who].xp), name = HS.shown(who), ix = Math.floor(Math.random() * 3);
    const ph = Math.round(clamp(WIN_P[kind] + 0.025 * (L - 2 - ix) + (Math.random() - 0.5) * 0.16, 0.22, 0.8) * 100), after = AFTER[kind];
    const P = this.lvP = { kind, who, name, ix, L, ph }; this.card('', '');
    this.say('BREAKING: ' + NEWS[kind] + ' ' + this.town + '! ' + name + ' answers the call' + (after ? '; behind it, ' + after : ''));
    const win = this.forceWin != null ? this.forceWin : Math.random() * 100 < ph, lossAt = !win && AFTER[kind] && kind !== 'riot' && Math.random() < 0.45 ? 'villain' : 'disaster';
    this.dof = this.g.post.opts.dof; this.base0 = this.D.stats.buildings; this.stage = 'level';
    const lv = this.lv = new WatchLevel(this.g, this); this.g.watchLevel = lv; document.body.classList.add('zd-tvlevel'); this.wrapPilots(true); this.cam.dir.reset(); this.wreck.reset();
    if (!lv.go(kind, { who, ix, win, lossAt })) { this.lv = null; this.g.watchLevel = null; this.wrapPilots(false); document.body.classList.remove('zd-tvlevel'); this.say('No show tonight in ' + this.town); this.after = 3; this.stage = 'leave'; return; }
    this.cur = null; this.curT = 0; this.kind = kind; this.n++;
    this.ev = { hhit: 0, fhit: 0, bld: 0, phase: 0, kills: 0 }; this.lastHp = null; this.acc = [0, 0, 0]; this.bTimes = []; this.lastCall = null; this.gapT = 12; // the first quick call once she is there
    this.queue(() => this.calls.ask({ main: true, head: 'Who wins? ' + name + ' (level ' + L + ') ' + (ph >= 50 ? pick(FORM) : 'is up against it'), opts: [{ key: 'heroes', name, x: odds(ph / 100) }, { key: 'threat', name: THE[kind], x: odds(1 - ph / 100) }], askT: WHO_T, win: 999 }));
  }
  // the level is over (watchlevel.js finish): WHO WINS settled, back to the cameras, on to the next town
  levelEnd(won, why) {
    const g = this.g, P = this.lvP, cam = g.camera, n = Math.max(0, this.D.stats.buildings - this.base0); this.lv = null; CLOCK = 0.3; /* the day goes on from the level's daylight */ g.watchLevel = null;
    this.wrapPilots(false); document.body.classList.remove('zd-tvlevel', 'zd-flying'); g.post.opts.dof = this.dof; cam.up.set(0, 1, 0); cam.fov = this.cam.fov0; cam.updateProjectionMatrix(); g.controls.enabled = false; this.cam.dir.reset(); this.cam.pick(true);
    this.tagA.hidden = this.tagB.hidden = true; this.queued = null; { const C = this.calls, q = C.q; if (q && q.main && q.pick) { C.main = q; C.q = null; C.card.hidden = true; } else if (q) C.close(true); } // a quick call still riding: its stake back; WHO WINS settled below, even if it was still being asked
    if (!P) return;
    const key = won ? 'heroes' : 'threat', who = won ? P.name : THE[P.kind], w = this.calls.settleMain(key), tot = this.calls.townWon || 0;
    { const top = won ? 'Saved by ' + P.name : THE[P.kind] + ' wins', big = n + ' building' + (n === 1 ? '' : 's') + ' down', sm = tot ? 'Your calls here: ' + (tot > 0 ? '+' : '−') + Math.abs(tot).toLocaleString() + ' coins' : ''; setTimeout(() => { if (this.leaving < 0) { this.card(top, big, sm); this.cardT = 5; } }, 1600); }
    this.say(won ? P.name + ' saved ' + this.town + '! ' + n + ' buildings down' : (why || THE[P.kind] + ' was too much') + ': ' + P.name + ' is down. ' + n + ' buildings lost in ' + this.town);
    if (w > 0) this.hits.say('You called it! +' + w.toLocaleString() + ' coins', 'combo'); else if (w < 0) this.hits.say(who + ' won: ' + (-w).toLocaleString() + ' coins lost', 'small'); else this.hits.say(who + ' won', 'small');
    this.after = 6.5; this.stage = 'leave';
  }
  // the level filmed from the helicopters: each engine (on foot, in the air, the street fight) places its own camera in its frame;
  // after it, the TV's view goes back (and the near plane, focus and detail for a view from far off, the depth of field over both fighters)
  wrapPilots(on) { const g = this.g; for (const p of [g.horde, g.flight, g.fightTest]) { if (!p) continue; if (on && !Object.prototype.hasOwnProperty.call(p, 'frame')) { const f0 = p.frame; p.frame = (dt, tg) => { f0.call(p, dt, tg); this.afterPilot(p); }; } else if (!on && Object.prototype.hasOwnProperty.call(p, 'frame')) delete p.frame; } }
  afterPilot(p) {
    const g = this.g, cam = g.camera, C = this.cam; if (!this.lv || !C.cur) return;
    cam.position.copy(C.P); cam.up.set(0, 1, 0); cam.lookAt(C.F); if (C.cur.kind === 'roof') cam.rotateZ(0.03 * Math.sin(C.t * 0.7) + 0.012 * Math.sin(C.t * 2.3));
    if (this.camFov && Math.abs(cam.fov - this.camFov) > 0.01) { cam.fov = this.camFov; cam.updateProjectionMatrix(); }
    g.post.opts.dof = this.dof; g.focusAt = C.focusPt || C.F; g.controls.target.copy(C.F); g.camBlend = null;
    const d = cam.position.distanceTo(C.F); p.near = Math.max(1.5, Math.min(10, d * 0.05)); p.focus = C.focusD || d; p.lod = d > 300 ? 3 : 0;
    const T = g.fightTest; if (T.active && T.airRing) T.airRing.visible = false; // the fight's ring is not for television (Sean)
    const L = g.flight.live; if (L && L.fog) L.fog.style.display = 'none'; // the dust storm's half-blind haze is for playing; the cameras see the storm
    for (const q of [g.horde && g.horde.beacon, g.flight && g.flight.beacon]) if (q && q.s) q.s.visible = false; // the game's arrow over her (beacon.js): the broadcast's name tag marks her instead
    this.tagStep();
  }
  // the health of each side, 0 to 1, and what she is fighting: [hers, its, name, a crowd]
  hpPair() {
    const g = this.g, H = g.horde, F = g.flight, T = g.fightTest, P = this.lvP; if (!P || !this.lv) return null;
    if (T.active) return [T.h.hp / (T.h.hpMax || 100), T.v.hp / (T.v.hpMax || 1), (T.foeName || 'The villain'), false];
    if (H.active && H.h) { const hp = H.h.hp / (H.h.hpMax || 100); if (H.o.boss) return [hp, Math.max(0, H.o.boss.heroHp ?? 100) / 100, THE[P.kind], false]; if (H.fl) return [hp, null, THE[P.kind], false]; const n = Math.max(1, (this.lv.round && this.lv.round.n) || 100); return [hp, clamp((H.left || 0) / n, 0, 1), (H.left || 0) + ' left', true]; }
    if (F.active) { const sh = this.lv.stormHp ? this.lv.stormHp() : null, L = F.live; return [F.hull / (F.hullMax || 100), sh != null ? Math.max(0, sh) / 100 : null, L && L.drain ? 'Captain Deluge' : THE[P.kind], false]; }
    return null;
  }
  // the name tags, over the hero and what she fights, where the camera sees them (kept apart when they are close on screen)
  tagStep() {
    const S = this.cam.dir && this.cam.dir.S, hp = this.hpPair(), cam = this.g.camera, W = innerWidth, H = innerHeight; if (!S || !hp) { this.tagA.hidden = this.tagB.hidden = true; return; }
    cam.updateMatrixWorld(); const at = (s, el, name, f) => {
      if (!s) { el.hidden = true; return null; } _v.set(s.x, s.y + (s.big ? s.h * 0.8 : s.h + 0.35), s.z).project(cam); if (_v.z > 1) { el.hidden = true; return null; }
      if (el.nm !== name) { el.nm = name; el.querySelector('.nm').textContent = name; el.hw = 0; } const hw = el.hw || (el.hw = Math.max(30, (el.offsetWidth || 70) / 2 + 6)), x = clamp((_v.x + 1) / 2 * W, hw, W - hw), y = clamp((1 - _v.y) / 2 * H, x > W - 130 ? 150 : 126, H - 160); // clear of the scoreboard top right, whole on the screen
      const bar = el.querySelector('.hp'); bar.style.display = f == null ? 'none' : ''; if (f != null) bar.firstChild.style.width = Math.round(clamp(f, 0, 1) * 100) + '%'; el.hidden = false; return [x, y, el];
    };
    const a = at(S.a, this.tagA, this.lvP.name, hp[0]), b = hp[3] ? at(S.b, this.tagB, hp[2], null) : at(S.b, this.tagB, hp[2], hp[1]);
    if (a && b && Math.abs(a[0] - b[0]) < 76 && Math.abs(a[1] - b[1]) < 34) { const s = a[0] <= b[0] ? -1 : 1, m = (a[0] + b[0]) / 2; a[0] = clamp(m + s * 40, 44, W - 44); b[0] = clamp(m - s * 40, 44, W - 44); }
    for (const q of [a, b]) if (q) q[2].style.transform = 'translate(' + q[0].toFixed(0) + 'px,' + q[1].toFixed(0) + 'px) translate(-50%,-100%)';
  }
  // what the calls go on: the big hits each way, buildings down, a new foe (the villain after the disaster), the crowd cleared
  track(dt) {
    const hp = this.hpPair(), E = this.ev; if (!hp) return;
    if (this.lastHp && this.lastHp[2] !== hp[2] && !hp[3]) { E.phase++; this.acc = [0, 0, 0]; }
    else if (this.lastHp && !hp[3]) { this.acc[0] += Math.max(0, this.lastHp[0] - hp[0]); if (hp[1] != null && this.lastHp[1] != null) this.acc[1] += Math.max(0, this.lastHp[1] - hp[1]); }
    this.lastHp = hp; E.kills = this.g.horde.kills || 0;
    if ((this.acc[2] += dt) > 0.6) { if (this.acc[1] >= 0.04) E.hhit++; if (this.acc[0] >= 0.04) E.fhit++; this.acc = [0, 0, 0]; }
  }
  // a quick call: one of these, each with its odds from how the show has gone so far
  nextCall() {
    const hp = this.hpPair(), E = this.ev, P = this.lvP; if (!hp) return; const name = P.name, foe = hp[3] ? THE[P.kind] : hp[2], crowd = hp[3] || CROWD.has(P.kind) && !this.g.fightTest.active;
    const recent = this.bTimes.filter((x) => x > this.t - 45).length, rateB = (recent + 0.6) / 45, show = Math.max(10, this.lv.t), s = { ...E }, YN = (p) => [{ key: 'yes', name: 'Yes', x: odds(p) }, { key: 'no', name: 'No', x: odds(1 - p) }];
    const fair = (p) => p >= 0.25 && p <= 0.75; // a sure thing either way is no call (the test pass: "a building down?" out of town, Yes at x5)
    // each with its window or its count set from how fast things have been going in this show, so it is close to a coin toss
    const make = {
      hit: () => { if (crowd || hp[1] == null) return null; const p = clamp((E.hhit + 2) / (E.hhit + E.fhit + 4), 0.25, 0.75); return { head: 'Who lands the next big hit?', opts: [{ key: 'h', name, x: odds(p) }, { key: 'f', name: foe, x: odds(1 - p) }], win: 14, timeout: 'void', check: () => (E.hhit > s.hhit ? 'h' : E.fhit > s.fhit ? 'f' : null) }; },
      rock: () => { if (crowd || hp[1] == null) return null; const r = (E.fhit + 1) / (show + 20), W = Math.round(clamp(0.7 / r, 6, 20)), p = 1 - Math.exp(-W * r); return fair(p) ? { head: name + ' takes a big hit in the next ' + W + ' s?', opts: YN(p), win: W, timeout: 'no', check: () => (E.fhit > s.fhit ? 'yes' : null) } : null; },
      bld: () => { if (recent < 2) return null; const W = Math.round(clamp(0.7 / rateB, 4, 15)), p = 1 - Math.exp(-W * rateB); return fair(p) ? { head: 'A building down in the next ' + W + ' s?', opts: YN(p), win: W, timeout: 'no', check: () => (E.bld > s.bld ? 'yes' : null) } : null; },
      bld3: () => { if (recent < 2) return null; const l = 20 * rateB, N = Math.max(2, Math.round(l + 0.3)); let c = 0, t = Math.exp(-l); for (let i = 0; i < N; i++) { c += t; t *= l / (i + 1); } const p = 1 - c; return fair(p) ? { head: N + ' buildings down in the next 20 s?', opts: YN(p), win: 20, timeout: 'no', check: () => (E.bld - s.bld >= N ? 'yes' : null) } : null; },
      half: () => (!crowd && hp[1] != null && hp[1] > 0.56 && hp[1] < 0.92 ? { head: foe + ' under half in the next 20 s?', opts: YN(0.45), win: 20, timeout: 'no', check: () => { if (E.phase > s.phase) return 'void'; const h = this.hpPair(); return h && h[1] != null && h[1] < 0.5 ? 'yes' : null; } } : null),
      clear: () => { if (!crowd) return null; const r = (E.kills + 3) / (show + 6), N = Math.max(3, Math.round(10 * r)), left = this.g.horde.left || 0; if (left < N + 2) return null; return { head: name + ' clears ' + N + ' more in the next 10 s?', opts: YN(0.48), win: 10, timeout: 'no', check: () => (E.kills - s.kills >= N ? 'yes' : null) }; },
    };
    const W = { hit: 2, rock: 1, bld: 1, bld3: 1, half: 1, clear: 2 }, L = []; for (const k of Object.keys(make)) { if (k === this.lastCall) continue; const q = make[k](); if (q) for (let i = 0; i < W[k]; i++) L.push([k, q]); }
    if (!L.length) { this.gapT = 2; return; } // nothing worth asking just now
    const [k, q] = pick(L); this.lastCall = k;
    q.askT = 6; q.lockOnTap = true; q.onClose = () => Object.assign(s, this.ev); // what is counted from: the moment the call is locked
    this.calls.ask(q);
  }
  levelAbort() { if (!this.lv) return; const lv = this.lv; this.calls.clear(); this.lvP = null; lv.abort(); this.lv = null; this.g.watchLevel = null; this.wrapPilots(false); this.tagA.hidden = this.tagB.hidden = true; document.body.classList.remove('zd-tvlevel', 'zd-flying'); }
  // tests: a show of this kind straight away, won or lost as asked
  probeStart(kind, win) { this.pre = -1; this.calls.close(true); this.forceWin = win; this.openLevel(kind); }

  // on to another town (up to the globe and down to it): half the time back to one the broadcast has hit before
  moveOn() {
    if (this.leaving >= 0) return;
    this.levelAbort(); this.calls.clear(); this.queued = null;
    const here = placeKey(), all = Object.keys(PLACES).filter(k => k !== here), hit = all.filter(k => damageOf(k).length);
    const key = hit.length && Math.random() < 0.5 ? hit[Math.floor(Math.random() * hit.length)] : all[Math.floor(Math.random() * all.length)];
    this.leaving = 3; this.toKey = key;
    const dead = []; for (let k = 0; k < this.g.city.buildings.length; k++) if (this.g.city.dead[k]) dead.push(k);
    rememberDamage(here, dead); // the ruins stay for next time
    this.card(damageOf(key).length ? 'Back to' : 'Next stop', PLACES[key].name);
    this.say('That’s all from ' + this.town + '. Next stop: ' + PLACES[key].name);
  }

  card(top, big, small) { this.nextEl.innerHTML = top ? top + '<b>' + big + '</b>' + (small ? '<small>' + small + '</small>' : '') : ''; this.nextEl.style.opacity = top ? '1' : '0'; }

  // a headline onto the ticker (the newest goes on next)
  say(text) { this.news.push(text); if (this.news.length > 6) this.news.shift(); this.mEl.textContent = this.news.slice().reverse().join('   •   '); }

  busy() { return false; }
  tap() {}
  phase() { return this.lv ? 0.3 : CLOCK; } // a level in the daylight, as in Defend
  zombieNight() { return !this.lv && !!this.g.people && this.g.people.stats.zombies >= 8; } // the zombie night (game.js), but not over a level: too dark to follow (Sean)

  onEvent(e) {
    const c = this.g.city;
    this.auto.onEvent(e);
    if (e.type === 'collapse') { const b = c.buildings[e.k]; if (b) this.hits.hit('b', e.x, b.top, e.z, 1, { big: b.top - b.baseY >= 40 }); this.chain.collapse(e.k, e.fall); if (this.lv && this.ev) { this.ev.bld++; this.bTimes.push(this.t); } }
    else if (e.type === 'fire') { this.hits.hit('fire', 0, 0, 0, 1); this.chain.fire(e.k); }
    else if (e.type === 'carland' || e.type === 'carfire' || e.type === 'crash') { if (e.car) this.hits.hit('car', 0, 0, 0, 1); }
    if (e.text && (e.type === 'warn' || e.hazard)) { this.say(e.text); return true; } // warnings go on the ticker, not over the picture
    return false;
  }

  update(sdt, dt) {
    const g = this.g, D = this.D;
    this.t += sdt; this.curT += sdt; CLOCK = (CLOCK + sdt / 720) % 1;
    this.hits.frame(dt, sdt); this.chain.step(sdt); this.calls.step(dt); this.wreck.step(sdt > 0 ? dt : 0);
    this.auto.update(sdt); if ((this.helpT = (this.helpT || 0) - sdt) <= 0) { this.helpT = 1; if (!this.lv) this.auto.rebuild(); } // the crews rebuild between disasters
    // the ticker crawls right to left, round again once it has gone by
    const w = this.mEl.offsetWidth || 400, W = this.mEl.parentNode.offsetWidth || 300;
    this.mx -= dt * TICK_SPEED; if (this.mx < -w) this.mx = W; this.mEl.style.transform = 'translateX(' + this.mx.toFixed(1) + 'px)';
    this.cam.update(dt, sdt); this.camFov = g.camera.fov; // the helicopters and the viewers' phones film the level too; afterPilot puts this view back over the level's own
    if (this.cardT > 0 && (this.cardT -= dt) <= 0) this.card('', '');
    if (this.leaving >= 0) { if ((this.leaving -= dt) < 0) { this.leaving = 1e9; this.dead = true; g.journey(this.toKey); } return; }
    if (this.pre > 0 && (this.pre -= dt) <= 0) this.askWhat(); // the town's card has been up: what hits it
    if (this.lv && this.lvP && this.lvP.kind === 'haboob' && g.fightTest.active && D.weather.type === 'dust') D.weather.set('sand'); // the dust storm beaten: thin enough to see the fight with its villain
    if (this.lv) { this.lv.update(); if (this.lv) { this.track(sdt); if (!this.calls.busy() && !this.queued && (this.gapT -= dt) <= 0) { this.gapT = rnd(2.5, 4.5); this.nextCall(); } } }
    if (this.queued && !this.calls.busy()) { const f = this.queued; this.queued = null; f(); }
    // after the disaster: on to the next town
    if (this.after >= 0 && !this.lv && (this.after -= sdt) <= 0) { this.after = -1; this.moveOn(); }
    if (this.t > TOWN_T * 4 && !this.lv && this.after < 0 && !this.calls.busy()) this.moveOn(); // never stuck in a town
    // now and then the tally
    if ((this.statT -= sdt) <= 0) {
      this.statT = 20;
      let fires = 0, cars = 0; for (let k = 0; k < g.fire.bFire.length; k++) if (g.fire.bFire[k] && !g.city.dead[k]) fires++;
      for (const c of g.traffic.cars) if (!c.mission && (c.gone || c.mode !== 0 || c.frozen)) cars++;
      for (const pc of g.traffic.parkedList) if (!pc.alive || pc.burnt) cars++;
      this.say(this.town + ' so far: ' + D.stats.buildings + ' buildings down, ' + cars + ' cars wrecked, ' + fires + ' fires burning');
    }
  }

  dispose() { this.levelAbort(); this.calls.dispose(); this.wreck.dispose(); this.live.remove(); this.tick.remove(); this.nextEl.remove(); this.scoreEl.remove(); this.tagA.remove(); this.tagB.remove(); this.hits.dispose(); this.cam.dispose(); this.auto.reset(); document.body.classList.remove('zd-tv', 'zd-tvfight', 'zd-tvlevel'); }
}
