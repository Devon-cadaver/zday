// The hero game (HERO-PLAN items 5 to 8), behind the menu's Defend and Destroy. A profile per side (HS, localStorage zday_hero, apart
// from zday_profile): XP and level, skills, the fear meter, towns, outfits, trophies. Between towns the home tower (the hub): team,
// wardrobe, skills, the next town. A town: its disasters and villains (WAVES) to stop, a hero flown with everything learned; then
// the tally: damage and fear against the XP. Defend: fear drags the meter from Hero through Vigilante and Menace to Villain, and at
// Villain the other heroes come for you (rivals, fought with the same mini games). Destroy: you start as a villain: bring down the
// town and beat the heroes who come.
import * as THREE from 'three';
import { LAB } from './lab.js';
import { PATH, PLACES, placeKey } from './places.js';
import { heroRig } from './heroes.js';
import { villainRig, detail } from './villains.js';
import { POWER, finish as endDisaster } from './heropower.js';


const KEY = 'zday_hero';
const fresh = (side) => ({ xp: 0, rep: side === 'hero' ? 70 : 0, skills: {}, idx: 0, towns: {}, flyer: side === 'hero' ? 'nova' : 'tyrant', trophies: [] });
export const HS = {
  d: null,
  load() { if (this.d) return this.d; let o = null; try { o = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { /* no storage */ } this.d = { hero: { ...fresh('hero'), ...(o && o.hero) }, villain: { ...fresh('villain'), ...(o && o.villain) }, outfits: (o && o.outfits) || {} }; return this.d; },
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.d)); } catch (e) { /* no storage */ } },
  outfit(name) { return this.load().outfits[name] || null; },
};
if (typeof window !== 'undefined') window.__hs = HS;
export const levelOf = (xp) => Math.min(20, 1 + Math.floor((Math.sqrt(1 + xp / 50) - 1) / 2)); // 1 at 0, then 400, 1200, 2400... XP
export const xpFor = (lv) => 50 * ((2 * (lv - 1) + 1) ** 2 - 1);
// the skill tree: four branches, each in order; a point a level. move: a move or power it opens; stat: what it raises
export const TREE = {
  Strength: [{ id: 'jab', name: 'Jab combo', move: 'jab' }, { id: 'upper', name: 'Uppercut', move: 'upper' }, { id: 'pound', name: 'Ground pound', move: 'pound' }, { id: 'fling', name: 'Throw into a building', move: 'fling' }, { id: 'hammer', name: 'Hammer throw', move: 'hammer' }, { id: 'elbow', name: 'Elbow drop', move: 'elbow' }, { id: 'slam', name: 'Sky slam', move: 'slam' }],
  Speed: [{ id: 'quick1', name: 'Quick hands 1', stat: 'spot' }, { id: 'fast1', name: 'Afterburn 1', stat: 'speed' }, { id: 'quick2', name: 'Quick hands 2', stat: 'spot' }, { id: 'fast2', name: 'Afterburn 2', stat: 'speed' }, { id: 'quick3', name: 'Quick hands 3', stat: 'spot' }, { id: 'tag', name: 'Tag team', move: 'tag' }],
  Energy: [{ id: 'freeze', name: 'Freeze', move: 'freeze' }, { id: 'lightning', name: 'Lightning', move: 'lightning' }, { id: 'sonic', name: 'Sonic clap', move: 'sonic' }],
  Control: [{ id: 'tough1', name: 'Tough 1', stat: 'tough' }, { id: 'shield', name: 'Shield', move: 'shield' }, { id: 'gravity', name: 'Gravity pulse', move: 'gravity' }, { id: 'tough2', name: 'Tough 2', stat: 'tough' }, { id: 'tk', name: 'Telekinesis', move: 'tk' }],
};
const START_MOVES = ['spin', 'kick', 'laser', 'drag', 'wind', 'fire']; // and two powers to start with
const TEAM = { hero: [['nova', 'Nova', 'Nova'], ['dragonfly', 'Dragonfly', 'Dragonfly'], ['tempo', 'Tempo', 'Tempo']], villain: [['tyrant', 'Tyrant', 'Tyrant'], ['blur', 'Blur', 'Blur'], ['weaver', 'Weaver', 'Weaver']] };
// a town's trouble, along the road: disasters by type, villains by name
const WAVES = [['zombies'], ['tornado'], ['riot'], ['flood', 'blur'], ['quake', 'tyrant'], ['aliens'], ['haboob', 'weaver'], ['kaiju'], ['worm', 'blur'], ['plant', 'tyrant'], ['volcano', 'weaver'], ['tsunami', 'blur'], ['rift', 'tyrant'], ['sinkhole', 'weaver', 'blur'], ['blackhole', 'tyrant'], ['spill', 'blur', 'weaver'], ['coldwave', 'tyrant', 'weaver'], ['kaiju', 'blur', 'tyrant', 'weaver']];
const REP = (r) => (r >= 60 ? 'Hero' : r >= 35 ? 'Vigilante' : r >= 15 ? 'Menace' : 'Villain');
const SW = ['#ff3fcf', '#3dff5c', '#29e3ff', '#ffd23d', '#ff5a2a', '#8f5bff', '#f4f1ea', '#20242e'];
const CSS = `
#zd-hub{position:fixed;inset:0;z-index:40;overflow-y:auto;background:linear-gradient(#120a26,#2a1038);color:#f4eee4;font:14px/1.35 system-ui,-apple-system,sans-serif;padding:calc(12px + env(safe-area-inset-top)) 14px 40px;box-sizing:border-box;touch-action:pan-y}
#zd-hub h2{font:900 15px system-ui,sans-serif;letter-spacing:.08em;color:#ff7ac8;margin:18px 0 8px;text-transform:uppercase}
#zd-hub .wrap{max-width:560px;margin:0 auto}
#zd-hub .ttl{font:900 22px Impact,'Arial Black',sans-serif;letter-spacing:.03em}
#zd-hub .go{width:100%;padding:15px;border:2px solid rgba(255,255,255,.4);border-radius:14px;background:linear-gradient(#ff5ad5,#a0168a);color:#fff;font:900 16px system-ui,sans-serif;letter-spacing:.06em;margin-top:10px;cursor:pointer}
#zd-hub .row{display:flex;gap:8px;flex-wrap:wrap}
#zd-hub button.b{flex:1 1 30%;min-width:90px;padding:10px 6px;border-radius:10px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.07);color:#fff;font:700 12px system-ui,sans-serif;cursor:pointer}
#zd-hub button.b.on{border-color:#a6ff4d;color:#a6ff4d}
#zd-hub button.b.off{opacity:.45}
#zd-hub .bar{height:10px;border-radius:5px;background:rgba(0,0,0,.4);overflow:hidden;margin:4px 0}
#zd-hub .bar i{display:block;height:100%}
#zd-hub .sw{width:34px;height:34px;border-radius:50%;border:2px solid rgba(255,255,255,.35);cursor:pointer;padding:0}
#zd-hub .sw.on{border:3px solid #fff;box-shadow:0 0 8px #fff}
#zd-hub .lab{font-size:11px;opacity:.75;margin:8px 0 4px;letter-spacing:.06em;text-transform:uppercase}
#zd-hub canvas{display:block;width:150px;height:210px;flex:0 0 150px}
#zd-hub .two{display:flex;gap:12px;align-items:flex-start}
#zd-hub .branch{font-weight:800;margin:10px 0 4px;color:#ffd27a}
#zd-rep{position:fixed;left:12px;top:calc(40px + env(safe-area-inset-top));z-index:29;width:120px;padding:5px 7px;border-radius:8px;background:rgba(20,12,30,.72);color:#fff;font:800 11px system-ui,sans-serif;pointer-events:none}
#zd-rep .bar{height:6px;border-radius:3px;background:rgba(255,255,255,.2);overflow:hidden;margin-top:3px}
#zd-rep .bar i{display:block;height:100%;background:linear-gradient(90deg,#ff4040,#ffd27a,#6cff8a)}
`;
const esc = (s) => String(s);
export class HeroGame {
  constructor(g, side) {
    this.g = g; this.side = side; this.kind = side; this.msgs = {}; const S = HS.load(); this.s = S[side]; this.round = null;
    if (!document.getElementById('zd-hub-css')) { const c = document.createElement('style'); c.id = 'zd-hub-css'; c.textContent = CSS; document.head.appendChild(c); }
    if (g.heroGo) { g.heroGo = false; this.start(); } else this.hub(); // arrived in the next town: straight in
  }
  // the mode's duties to game.js
  tap() {} phase() { return 0.3; } onEvent() {} threat() { return 0; } busy() { return false; } reset() {}
  get level() { return levelOf(this.s.xp); }
  get points() { return this.level - 1 - Object.keys(this.s.skills).length; }
  moves() { const on = {}; for (const k of Object.keys(LAB.moves)) on[k] = false; for (const k of START_MOVES) on[k] = true; for (const B of Object.values(TREE)) for (const q of B) if (q.move && this.s.skills[q.id]) on[q.move] = true; return on; }
  count(stat) { let n = 0; for (const B of Object.values(TREE)) for (const q of B) if (q.stat === stat && this.s.skills[q.id]) n++; return n; }
  // ---------- the home tower
  hub(msg) {
    this.closeHub(); const el = this.el = document.createElement('div'); el.id = 'zd-hub'; document.body.appendChild(el); this.msg = msg || ''; this.pick = this.s.flyer; this.draw();
  }
  closeHub() { if (this.prev) { cancelAnimationFrame(this.prev.raf); this.prev.ren.dispose(); if (this.prev.ren.forceContextLoss) this.prev.ren.forceContextLoss(); this.prev = null; } if (this.el) { this.el.remove(); this.el = null; } }
  draw() {
    const s = this.s, lv = this.level, hero = this.side === 'hero', key = PATH[s.idx % PATH.length], P = PLACES[key], rep = REP(s.rep), team = TEAM[this.side], cur = team.find(t => t[0] === s.flyer) || team[0], O = HS.outfit(cur[2]) || {}, nx = xpFor(lv + 1), lo = xpFor(lv);
    const floors = Array.from({ length: Math.min(lv, 12) }, (_, i) => i).reverse().map(i => '<rect x="20" y="' + (10 + (Math.min(lv, 12) - 1 - i) * 22) + '" width="' + (120 - i * 2) + '" height="20" rx="2" fill="#3a2a55" stroke="#ffd27a" stroke-width="1"/><text x="28" y="' + (24 + (Math.min(lv, 12) - 1 - i) * 22) + '" fill="#f4eee4" font-size="10">' + (['Team room', 'Wardrobe', 'Trophy wall', 'Map table', 'Gym', 'Lab', 'Hangar', 'Garden', 'Sick bay', 'Radio room', 'Vault', 'Roof deck'][i]) + '</text>').join('');
    const swatch = (part, val) => SW.map(c => '<button type="button" class="sw' + (val === c ? ' on' : '') + '" data-of="' + part + '" data-v="' + c + '" style="background:' + c + '"></button>').join('');
    const skills = Object.entries(TREE).map(([br, L]) => { let open = true; return '<div class="branch">' + br + '</div><div class="row">' + L.map(q => { const have = !!s.skills[q.id], can = open && !have && this.points > 0; if (!have) open = false; return '<button type="button" class="b' + (have ? ' on' : can ? '' : ' off') + '" data-skill="' + (can ? q.id : '') + '">' + (q.move && POWER[q.move] ? POWER[q.move].icon + ' ' : '') + esc(q.name) + '</button>'; }).join('') + '</div>'; }).join('');
    const hunted = hero && s.rep < 15;
    this.el.innerHTML = '<div class="wrap"><div class="ttl">' + (hero ? 'THE TOWER' : 'THE LAIR') + '</div>' + (this.msg ? '<div style="margin:8px 0;padding:8px 10px;border-radius:10px;background:rgba(255,255,255,.08)">' + this.msg + '</div>' : '') +
      '<div>Level <b>' + lv + '</b> · ' + s.xp + ' XP' + (lv < 20 ? ' / ' + nx : '') + '</div><div class="bar"><i style="width:' + (lv < 20 ? Math.round((s.xp - lo) / (nx - lo) * 100) : 100) + '%;background:linear-gradient(90deg,#ff4fa3,#ffd27a)"></i></div>' +
      (hero ? '<div>Reputation: <b>' + rep + '</b> (' + Math.round(s.rep) + ')</div><div class="bar"><i style="width:' + s.rep + '%;background:linear-gradient(90deg,#ff4040,#ffd27a,#6cff8a)"></i></div>' : '') +
      '<h2>Next town</h2><div><b>' + esc(P.name) + '</b> · ' + (s.idx + 1) + ' of ' + PATH.length + (hunted ? ' · <span style="color:#ff8a7a">the heroes are hunting you</span>' : '') + '</div><div style="opacity:.75;font-size:12px">' + esc(P.blurb || '') + '</div><button type="button" class="go" data-go2>' + (hero ? 'FLY TO DEFEND IT' : 'FLY IN AND WRECK IT') + '</button>' +
      '<h2>Team</h2><div class="row">' + team.map(t => '<button type="button" class="b' + (t[0] === s.flyer ? ' on' : '') + '" data-who="' + t[0] + '">' + t[1] + '</button>').join('') + '</div>' +
      '<h2>Wardrobe: ' + cur[1] + '</h2><div class="two"><canvas></canvas><div style="flex:1 1 auto;min-width:0"><div class="lab">Suit</div><div class="row">' + swatch('suit', O.suit) + '</div><div class="lab">Cape</div><div class="row">' + swatch('cape', O.cape) + '</div><div class="lab">Gloves and boots</div><div class="row">' + swatch('dark', O.dark) + '</div><div class="lab">Extras</div><div class="row">' + [['noCape', 'No cape'], ['hood', 'Hood'], ['plates', 'Armour'], ['coat', 'Long coat']].map(([k, n]) => '<button type="button" class="b' + (O[k] ? ' on' : '') + '" data-tog="' + k + '">' + n + '</button>').join('') + '</div></div></div>' +
      '<h2>Skills · ' + this.points + ' point' + (this.points === 1 ? '' : 's') + ' to spend</h2>' + skills +
      (s.trophies.length ? '<h2>Trophy wall</h2><div>' + s.trophies.map(esc).join(', ') + '</div>' : '') +
      '<h2>' + (hero ? 'The tower' : 'The lair') + ': ' + Math.min(lv, 12) + ' floor' + (lv > 1 ? 's' : '') + '</h2><svg width="160" height="' + (Math.min(lv, 12) * 22 + 20) + '">' + floors + '</svg>' +
      '<button type="button" class="b" data-out style="width:100%;margin-top:14px">Back to the menu</button></div>';
    const $ = (q) => this.el.querySelector(q);
    $('[data-go2]').onclick = () => this.start();
    $('[data-out]').onclick = () => { this.closeHub(); this.g.toMenu ? this.g.toMenu() : location.reload(); };
    this.el.querySelectorAll('[data-who]').forEach(b => { b.onclick = () => { s.flyer = b.dataset.who; HS.save(); this.draw(); }; });
    this.el.querySelectorAll('[data-skill]').forEach(b => { b.onclick = () => { const id = b.dataset.skill; if (!id) return; s.skills[id] = 1; HS.save(); this.draw(); }; });
    const dress = (f) => { const D = HS.load(); D.outfits[cur[2]] = { ...(D.outfits[cur[2]] || {}), ...f }; HS.save(); this.draw(); };
    this.el.querySelectorAll('[data-of]').forEach(b => { b.onclick = () => dress({ [b.dataset.of]: b.dataset.v }); });
    this.el.querySelectorAll('[data-tog]').forEach(b => { b.onclick = () => dress({ [b.dataset.tog]: !O[b.dataset.tog] }); });
    this.preview(cur[2]);
  }
  // the figure in its outfit, turning
  preview(name) {
    if (this.prev) { cancelAnimationFrame(this.prev.raf); this.prev.ren.dispose(); if (this.prev.ren.forceContextLoss) this.prev.ren.forceContextLoss(); this.prev = null; }
    const cv = this.el.querySelector('canvas'); let ren; try { ren = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true }); } catch (e) { return; } ren.setPixelRatio(Math.min(devicePixelRatio, 2)); ren.setSize(150, 210, false);
    const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(26, 150 / 210, 0.1, 50); cam.position.set(0, 2.4, 11); cam.lookAt(0, 2.1, 0); sc.add(new THREE.HemisphereLight('#ffffff', '#554466', 1.6)); const sun = new THREE.DirectionalLight('#fff4e0', 2.2); sun.position.set(3, 6, 5); sc.add(sun);
    const r = this.side === 'hero' ? heroRig(name, HS.outfit(name)) : villainRig(name, HS.outfit(name)); sc.add(r.root); let t = 0, last = performance.now(); const P = this.prev = { ren, raf: 0 };
    const tick = () => { const n = performance.now(), dt = Math.min(0.05, (n - last) / 1000); last = n; t += dt; r.root.rotation.y = t * 0.8; if (r.root.userData.tick) r.root.userData.tick(dt); else if (r.cape) r.cape.update(dt, 0.12, 0.35); detail(r, null, true); ren.render(sc, cam); P.raf = requestAnimationFrame(tick); }; tick();
  }
  // ---------- a town
  start() {
    const g = this.g, s = this.s, key = PATH[s.idx % PATH.length]; this.closeHub();
    if (g.moveWorld && key !== placeKey()) { g.heroGo = true; g.moveWorld(key, this.side); g.startMode(this.side); return; } // the world moved: a new mode starts it there
    this.labWas = { hero: LAB.hero, villain: LAB.villain, moves: LAB.moves, army: LAB.army }; // the Sandbox's own settings, put back after
    LAB.hero = this.level; LAB.villain = Math.max(1, s.idx + 1); LAB.moves = this.moves(); LAB.spotK = 1 + 0.15 * this.count('spot'); LAB.toughK = 1 + 0.2 * this.count('tough'); LAB.army = this.side === 'villain' ? s.idx >= 2 : s.idx >= 4 && s.idx % 3 === 1;
    const D = g.disasters, B = g.city.bounds, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2, F = g.flight, hero = this.side === 'hero', wave = WAVES[s.idx % WAVES.length], evs = [], vs = [];
    if (hero && wave[0] === 'zombies' && g.horde) { this.zombieLevel(key); return; }
    for (const e of D.list) if (e.type === 'villains' && e.alive) for (const w of e.who) if (!w.gone) w.state = 'gone';
    if (hero) { for (const w of wave) { if (['blur', 'tyrant', 'weaver'].includes(w)) vs.push(w); else { const e = D.start(w, cx + (Math.random() - 0.5) * 120, cz + (Math.random() - 0.5) * 120); if (e) evs.push(e); } } }
    const hunted = hero && s.rep < 15, rivals = hero ? (hunted ? TEAM.hero.filter(t => t[0] !== s.flyer).map(t => t[2]) : []) : TEAM.hero.slice(0, Math.min(3, 1 + Math.floor(s.idx / 3))).map(t => t[2]);
    for (const n of vs) { const e = D.start('villains', cx + (Math.random() - 0.5) * 160, cz + (Math.random() - 0.5) * 160, { only: n, quiet: true }); if (e) evs.push(e); }
    if (rivals.length) { const e = D.start('villains', cx, cz, { rivals, quiet: true }); if (e) { evs.push(e); this.rivalEv = e; } }
    F.heroGame = true; F.start(s.flyer); const k = 1 + 0.12 * this.count('speed'); if (k > 1) F.P = { ...F.P, max: F.P.max * k, start: F.P.start * k }; F.onStopped = () => {};
    const need = hero ? 0 : 8 + 4 * s.idx; this.round = { evs, need, t: 0, downs: 0, wasDown: false, hero, hunted, rivals, key, ended: false, nothing: !evs.length };
    this.rep = document.createElement('div'); this.rep.id = 'zd-rep'; document.body.appendChild(this.rep);
    const town = PLACES[key].name, seen = s.towns[key]; F.tip(hero ? (hunted ? 'You have gone too far. The other heroes are coming for you!' : seen && seen.fear > 200 ? 'The people of ' + town + ' remember you. They run' : s.rep >= 60 ? 'The people of ' + town + ' cheer as you fly in. Use your powers and Lock on' : 'Defend ' + town + '. Use your powers and Lock on') : 'Bring down ' + need + ' buildings in ' + town + ' and beat the heroes who come');
    if (hero && (s.rep < 35 || (seen && seen.fear > 200))) g.people.scare(cx, cz, 400, 0.5);
  }
  // the zombie level (Sean, 10b): the town down to about 20 people and a few cops, the rest of its people's slots dropped again as
  // zombies, hundreds; Nova on foot with the whole kit (horde.js). Cleared: the town is saved
  zombieLevel(key) {
    const g = this.g, s = this.s, P = g.people, B = g.city.bounds, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2, pool = []; let kept = 0;
    for (let j = 0; j < P.active; j++) { if (P.kind[j] !== 0) continue; if (kept < 20 && P.isCivilian(j) && P.lvl[j] === -1 && Math.hypot(P.x[j] - cx, P.z[j] - cz) < 60) { kept++; continue; } if (P.hide(j)) pool.push(j); }
    for (let i = pool.length - 1; i > 0; i--) { const k = Math.floor(Math.random() * (i + 1)); const t = pool[i]; pool[i] = pool[k]; pool[k] = t; }
    P.spawnOfficers(cx + 20, cz, 2); P.spawnOfficers(cx - 20, cz, 2);
    const n = Math.min(400 + 100 * Math.min(3, s.idx), pool.length); this.round = { evs: [], need: 0, t: 0, downs: 0, hero: true, key, ended: false, zombie: true, n };
    g.horde.start({ n, pool, level: true, onEnd: (won, H) => { this.round.horde = H; this.finish(won, won ? null : 'Overrun by the horde'); } });
    this.rep = document.createElement('div'); this.rep.id = 'zd-rep'; document.body.appendChild(this.rep);
    g.toast ? g.toast('Defend ' + PLACES[key].name + ': ' + n + ' zombies in the streets. Tap to punch, swipe to dash, hold to slam') : 0;
  }
  placeNow() { try { return new URLSearchParams(location.search).get('place') || null; } catch (e) { return null; } }
  update() {
    const R = this.round; if (!R || R.ended) return; const F = this.g.flight, S = LAB.stats; R.t += 1 / 60;
    if (R.zombie) { const H = this.g.horde; if (!H.active) return this.finish(false, 'You left the town'); this.rep.innerHTML = 'Hero · ' + H.left + ' zombies<div class="bar"><i style="width:' + Math.max(0, 100 - H.left / R.n * 100) + '%"></i></div>'; return; }
    const live = R.evs.filter(e => e.alive && (e.type !== 'villains' || e.who.some(w => !w.gone && !w.beaten))).length;
    const fear = LAB.fear(), rep = R.hero ? Math.max(0, Math.min(100, this.s.rep - fear / 30)) : 0;
    this.rep.innerHTML = R.hero ? REP(rep) + (live ? ' · ' + live + ' to stop' : '') + '<div class="bar"><i style="width:' + rep + '%"></i></div>' : S.buildings + '/' + R.need + ' buildings<div class="bar"><i style="width:' + Math.min(100, S.buildings / R.need * 100) + '%"></i></div>';
    const down = F.state === 'down' && !F.downAt; if (down && !R.wasDown) R.downs++; R.wasDown = down;
    if (!F.active) return this.finish(false, 'You left the town');
    if (R.downs >= 3) return this.finish(false, 'Knocked out of the sky three times');
    if (R.t > 1 && !F.duel && (R.hero ? live === 0 : S.buildings >= R.need && live === 0)) this.finish(true);
  }
  finish(won, why) {
    const R = this.round, s = this.s, S = LAB.stats, F = this.g.flight, g = this.g; R.ended = true; const fear = LAB.fear(); if (this.rep) { this.rep.remove(); this.rep = null; }
    if (R.zombie) { const H = R.horde || g.horde, xp = won ? 300 + H.kills + (H.bitten < 10 ? 100 : 0) : 20 + Math.round(H.kills / 4); if (H.active) H.stop(true); const lv0 = this.level; s.xp += xp; const up = this.level - lv0; if (won) s.idx = Math.min(PATH.length - 1, s.idx + 1); s.towns[R.key] = { won: (s.towns[R.key] && s.towns[R.key].won) || won, fear: 0 }; if (won) s.rep = Math.min(100, s.rep + 6); HS.save(); this.round = null; g.heroGo = false; this.hub('<b>' + (won ? 'TOWN SAVED' : (why || 'NOT THIS TIME')) + '</b> · +' + xp + ' XP' + (up ? ' · <b>LEVEL UP!</b> A skill point to spend' : '') + '<br>Zombies dusted ' + H.kills + ' · bitten ' + H.bitten + ' times · ' + Math.round(H.time) + ' s'); return; }
    F.onStopped = null; for (const e of R.evs) if (e.type === 'villains') for (const w of e.who) { if (w.beaten && !s.trophies.includes(w.name)) s.trophies.push(w.name); }
    let xp = 0, lines = [];
    if (R.hero) { const was = s.rep; xp = won ? Math.max(50, 200 + 100 * s.idx + (S.stopped || 0) * 60 + S.won * 80 + S.saved * 30 - Math.round(fear / 4)) : 25; const gain = won ? 6 : 0; s.rep = Math.max(0, Math.min(100, s.rep + gain - fear / 30)); if (R.hunted && !won) { s.rep = Math.min(100, s.rep + 15); xp = 0; lines.push('The heroes beat you. You wake in the tower, and it is a lesson'); } lines.push('Reputation ' + Math.round(was) + ' to ' + Math.round(s.rep) + ': ' + REP(s.rep)); s.towns[R.key] = { won: (s.towns[R.key] && s.towns[R.key].won) || won, fear: Math.round(fear) }; if (R.hunted && won) lines.push('You beat the heroes. This town now lives in fear of you'); }
    else { xp = won ? 200 + 100 * s.idx + S.buildings * 15 + S.won * 100 : 10 + S.buildings * 5; s.towns[R.key] = { won: (s.towns[R.key] && s.towns[R.key].won) || won, fear: Math.round(fear) }; }
    const lv0 = this.level; s.xp += xp; const up = this.level - lv0; if (won) s.idx = Math.min(PATH.length - 1, s.idx + 1); HS.save();
    if (F.active) F.stop(true);
    F.heroGame = false; Object.assign(LAB, this.labWas, { spotK: 1, toughK: 1 });
    for (const e of R.evs) { if (!e.alive) continue; if (e.type === 'villains') { for (const w of e.who) if (!w.gone) { w.state = 'gone'; w.rig.root.visible = false; } } else endDisaster(e); } // what is left of the trouble goes with you
    const head = won ? (R.hero ? 'TOWN SAVED' : 'TOWN WRECKED') : (why || 'NOT THIS TIME');
    this.hub('<b>' + head + '</b> · +' + xp + ' XP' + (up ? ' · <b>LEVEL UP!</b> A skill point to spend' : '') + '<br>Buildings down ' + S.buildings + ' · people scared ' + S.scared + ' · hurt ' + S.hurt + ' · saved ' + S.saved + ' · fear ' + Math.round(fear) + (lines.length ? '<br>' + lines.join('<br>') : ''));
    this.round = null;
  }
}
