// The hero game (HERO-PLAN items 5 to 8), behind the menu's Defend and Destroy. A profile per side (HS, localStorage zday_hero, apart
// from zday_profile): XP and level, skills, the fear meter, towns, outfits, trophies. Between towns the home tower (the hub): team,
// wardrobe, skills, the next town. A town: its disasters and villains (WAVES) to stop, a hero flown with everything learned; then
// the tally: damage and fear against the XP. Defend: fear drags the meter from Hero through Vigilante and Menace to Villain, and at
// Villain the other heroes come for you (rivals, fought with the same mini games). Destroy: you start as a villain: bring down the
// town and beat the heroes who come.
import { openStation } from './radiobox.js';
import * as THREE from 'three';
import { LAB } from './lab.js';
import { PATH, PLACES, placeKey } from './places.js';
import { heroRig } from './heroes.js';
import { villainRig, detail } from './villains.js';
import { POWER, finish as endDisaster } from './heropower.js';
import { ALIEN_MIX } from './figures.js';
import { CreatureLayer } from './creaturekit.js';


const KEY = 'zday_hero';
// Six characters, each levelled apart (Sean): side is where they stand now, and it changes with what they do (a hero who falls goes to Destroy, a villain who does too well to Defend)
import { nameMaker, nameOf } from './names.js';
const ROSTER = { nova: ['Nova', 'hero'], dragonfly: ['Dragonfly', 'hero'], tempo: ['Tempo', 'hero'], tyrant: ['Tyrant', 'villain'], blur: ['Blur', 'villain'], weaver: ['Weaver', 'villain'] };
const fresh = (side, id) => ({ xp: 0, rep: side === 'hero' ? 70 : 0, skills: {}, idx: 0, towns: {}, flyer: id, side, trophies: [], threat: 0 }); // threat: the base's, filled by wins (base.js 11d)
export const HS = {
  d: null,
  load() {
    if (this.d) return this.d; let o = null; try { o = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { /* no storage */ } o = o || {}; const chars = {};
    for (const id of Object.keys(ROSTER)) { const side = ROSTER[id][1], old = !o.chars && o[side] && (o[side].flyer || (side === 'hero' ? 'nova' : 'tyrant')) === id ? o[side] : null; chars[id] = { ...fresh(side, id), ...(old || {}), ...((o.chars && o.chars[id]) || {}), flyer: id }; } // an old save's one profile goes to whoever was flying it
    const last = { hero: (o.last && o.last.hero) || (o.hero && o.hero.flyer) || 'nova', villain: (o.last && o.last.villain) || (o.villain && o.villain.flyer) || 'tyrant' }, H = this;
    this.d = { chars, last, outfits: o.outfits || {} }; for (const side of ['hero', 'villain']) Object.defineProperty(this.d, side, { get() { return chars[H.cur(side)]; } }); return this.d;
  },
  save() { try { const d = this.d; localStorage.setItem(KEY, JSON.stringify({ chars: d.chars, last: d.last, outfits: d.outfits })); } catch (e) { /* no storage */ } },
  outfit(name) { return this.load().outfits[name] || null; },
  team(side) { const c = this.load().chars; return Object.keys(ROSTER).filter(id => c[id].side === side); },
  cur(side) { const d = this.load(), T = this.team(side); return T.includes(d.last[side]) ? d.last[side] : T[0] || d.last[side]; }, // whoever was last picked, or the first still on this side
  name(id) { return ROSTER[id][0]; },
  // what is shown: the player's own name for them, if they made one (names.js). name() stays the character's own, for the rigs and outfits
  shown(id) { const c = this.load().chars[id]; return (c && nameOf(c.nick)) || ROSTER[id][0]; },
  disp(n) { return this.shown(String(n).toLowerCase()) || n; },
  // the wheels, for this character
  namer(host, id) { nameMaker(host, ROSTER[id][0], () => this.load().chars[id].nick || null, (n) => { const c = this.load().chars[id]; if (n) c.nick = n; else delete c.nick; this.save(); }); },
  curName(side) { return ROSTER[this.cur(side)][0]; },
};
// a character's body, whichever side they stand on now
export const rigFor = (name, of) => (['Nova', 'Dragonfly', 'Tempo'].includes(name) ? heroRig(name, of) : villainRig(name, of));
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
// a town's trouble, along the road: disasters by type, villains by name
const WAVES = [['aliens'], ['zombies'], ['worm'], ['kaiju'], ['tornado'], ['riot'], ['flood', 'blur'], ['quake', 'tyrant'], ['aliens'], ['haboob', 'weaver'], ['kaiju'], ['worm', 'blur'], ['plant', 'tyrant'], ['volcano', 'weaver'], ['tsunami', 'blur'], ['rift', 'tyrant'], ['sinkhole', 'weaver', 'blur'], ['blackhole', 'tyrant'], ['spill', 'blur', 'weaver'], ['coldwave', 'tyrant', 'weaver'], ['kaiju', 'blur', 'tyrant', 'weaver']];
const LEVEL = { aliens: 'The alien invasion', zombies: 'The zombie outbreak', worm: 'The giant worm', kaiju: 'The kaiju', tornado: 'The tornado', riot: 'The riot' }, VILLAINS = ['blur', 'tyrant', 'weaver']; // the names of the first levels (Sean: the main action fights; the weather levels come after)
const levelName = (s) => LEVEL[WAVES[s.idx % WAVES.length][0]] || 'Level ' + (s.idx + 1);
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
#zd-hub .sw{width:44px;height:44px;border-radius:50%;border:2px solid rgba(255,255,255,.35);cursor:pointer;padding:0}
#zd-hub .sw.on{border:3px solid #fff;box-shadow:0 0 8px #fff}
#zd-hub .lab{font-size:11px;opacity:.75;margin:8px 0 4px;letter-spacing:.06em;text-transform:uppercase}
#zd-hub canvas{display:block;width:150px;height:210px;flex:0 0 150px}
#zd-hub .two{display:flex;gap:12px;align-items:flex-start}
#zd-hub .cards{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:8px}
#zd-hub .card{display:block;width:100%;text-align:left;padding:8px 10px;border-radius:12px;border:2px solid rgba(255,255,255,.2);background:rgba(255,255,255,.07);color:#fff;font:600 11px/1.35 system-ui,sans-serif;cursor:pointer}
#zd-hub .card b{display:block;font:900 14px system-ui,sans-serif}
#zd-hub .card span{display:block;opacity:.8}
#zd-hub .card.on{border-color:#a6ff4d;box-shadow:0 0 10px rgba(166,255,77,.4)}
#zd-hub .branch{font-weight:800;margin:10px 0 4px;color:#ffd27a}
#zd-rep{position:fixed;left:12px;top:calc(206px + env(safe-area-inset-top));z-index:29;width:120px;padding:5px 7px;border-radius:8px;background:rgba(20,12,30,.72);color:#fff;font:800 11px system-ui,sans-serif;pointer-events:none}
#zd-rep .bar{height:6px;border-radius:3px;background:rgba(255,255,255,.2);overflow:hidden;margin-top:3px}
#zd-rep .bar i{display:block;height:100%;background:linear-gradient(90deg,#ff4040,#ffd27a,#6cff8a)}
`;
const esc = (s) => String(s);
// a figure turning on a canvas; returns what stops it
function turning(cv, name) {
  let ren; try { ren = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true }); } catch (e) { return null; } ren.setPixelRatio(Math.min(devicePixelRatio, 2)); ren.setSize(150, 210, false);
  const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(26, 150 / 210, 0.1, 50); cam.position.set(0, 1.5, 6.5); cam.lookAt(0, 0.95, 0); sc.add(new THREE.HemisphereLight('#ffffff', '#554466', 1.6)); const sun = new THREE.DirectionalLight('#fff4e0', 2.2); sun.position.set(3, 6, 5); sc.add(sun);
  const r = rigFor(name, HS.outfit(name)); sc.add(r.root); let t = 0, last = performance.now(); const P = { ren, raf: 0 };
  const tick = () => { const n = performance.now(), dt = Math.min(0.05, (n - last) / 1000); last = n; t += dt; r.root.rotation.y = t * 0.8; if (r.root.userData.tick) r.root.userData.tick(dt); else if (r.cape) r.cape.update(dt, 0.12, 0.35); detail(r, null, true); ren.render(sc, cam); P.raf = requestAnimationFrame(tick); }; tick();
  return () => { cancelAnimationFrame(P.raf); ren.dispose(); if (ren.forceContextLoss) ren.forceContextLoss(); };
}
const repBar = (s) => '<div class="bar" style="height:6px"><i style="width:' + s.rep + '%;background:linear-gradient(90deg,#ff4040,#ffd27a,#6cff8a)"></i></div>';
const cardsHtml = (side, on) => HS.team(side).map(id => { const c = HS.load().chars[id]; return '<button type="button" class="card' + (id === on ? ' on' : '') + '" data-who="' + id + '"><b>' + HS.shown(id) + '</b><span>Level ' + levelOf(c.xp) + ' &middot; ' + REP(c.rep) + '</span>' + repBar(c) + '<span>Next: ' + levelName(c) + '</span></button>'; }).join('');
const emptyHtml = (side) => '<div style="margin:14px 0;padding:12px;border-radius:12px;background:rgba(255,255,255,.08)">' + (side === 'hero' ? 'All three heroes have gone bad. Win one back under Destroy: a villain who does too well comes home.' : 'All three villains have turned good. Bring one down under Defend: a hero who falls comes here.') + '</div>';
// the first screen of Defend and Destroy (Sean): who you play, not what they wear. onGo(id), onBack()
export function pickScreen(side, onGo, onBack) {
  if (!document.getElementById('zd-hub-css')) { const c = document.createElement('style'); c.id = 'zd-hub-css'; c.textContent = CSS; document.head.appendChild(c); }
  const el = document.createElement('div'); el.id = 'zd-hub'; document.body.appendChild(el); let stop = null, on = HS.cur(side);
  const close = () => { if (stop) stop(); el.remove(); };
  const draw = () => { if (stop) { stop(); stop = null; } const T = HS.team(side); el.innerHTML = '<div class="wrap"><div class="ttl">' + (side === 'hero' ? 'DEFEND' : 'DESTROY') + '</div><div style="opacity:.8;margin:4px 0 12px">Who do you play? Each levels up on their own</div>' + (T.length ? '<div class="two"><canvas></canvas><div class="cards">' + cardsHtml(side, on) + '</div></div><button type="button" class="go" data-go2>PLAY ' + HS.shown(on).toUpperCase() + '</button><button type="button" class="b" data-namer style="width:100%;margin-top:8px;min-height:44px">\u270F Change the name</button>' : emptyHtml(side)) + '<button type="button" class="b" data-out style="width:100%;margin-top:14px">Back to the menu</button></div>';
    el.querySelectorAll('[data-who]').forEach(b => { b.onclick = () => { on = b.dataset.who; draw(); }; }); el.querySelector('[data-out]').onclick = () => { close(); onBack(); };
    if (T.length) el.querySelector('[data-namer]').onclick = () => { const m = document.createElement('div'); m.style.cssText = 'position:fixed;inset:0;z-index:66;display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box;background:rgba(8,5,16,.86)'; m.innerHTML = '<div style="width:min(420px,100%);padding:14px;border-radius:16px;background:#1b1230;box-sizing:border-box"><div data-nm></div><button type="button" class="go" data-done style="margin-top:10px">DONE</button></div>'; el.appendChild(m); HS.namer(m.querySelector('[data-nm]'), on); m.querySelector('[data-done]').onclick = () => { m.remove(); draw(); }; };
    if (T.length) { el.querySelector('[data-go2]').onclick = () => { HS.load().last[side] = on; HS.save(); close(); onGo(on); }; stop = turning(el.querySelector('canvas'), HS.name(on)); } };
  draw();
}
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
    this.closeHub(); const el = this.el = document.createElement('div'); el.id = 'zd-hub'; document.body.appendChild(el); this.msg = msg || ''; this.s = HS.load()[this.side]; this.draw();
  }
  closeHub() { if (this.prev) { this.prev(); this.prev = null; } if (this.el) { this.el.remove(); this.el = null; } }
  draw() {
    const s = this.s, lv = this.level, hero = this.side === 'hero', key = PATH[s.idx % PATH.length], P = PLACES[key], rep = REP(s.rep), T = HS.team(this.side), nx = xpFor(lv + 1), lo = xpFor(lv);
    if (!T.length) { this.el.innerHTML = '<div class="wrap"><div class="ttl">' + (hero ? 'THE TOWER' : 'THE LAIR') + '</div>' + (this.msg ? '<div style="margin:8px 0;padding:8px 10px;border-radius:10px;background:rgba(255,255,255,.08)">' + this.msg + '</div>' : '') + emptyHtml(this.side) + '<button type="button" class="b" data-out style="width:100%;margin-top:14px">Back to the menu</button></div>'; this.el.querySelector('[data-out]').onclick = () => { this.closeHub(); this.g.toMenu ? this.g.toMenu() : location.reload(); }; return; }
    const floors = Array.from({ length: Math.min(lv, 12) }, (_, i) => i).reverse().map(i => '<rect x="20" y="' + (10 + (Math.min(lv, 12) - 1 - i) * 22) + '" width="' + (120 - i * 2) + '" height="20" rx="2" fill="#3a2a55" stroke="#ffd27a" stroke-width="1"/><text x="28" y="' + (24 + (Math.min(lv, 12) - 1 - i) * 22) + '" fill="#f4eee4" font-size="10">' + (['Team room', 'Wardrobe', 'Trophy wall', 'Map table', 'Gym', 'Lab', 'Hangar', 'Garden', 'Sick bay', 'Radio room', 'Vault', 'Roof deck'][i]) + '</text>').join('');
    const skills = Object.entries(TREE).map(([br, L]) => { let open = true; return '<div class="branch">' + br + '</div><div class="row">' + L.map(q => { const have = !!s.skills[q.id], can = open && !have && this.points > 0; if (!have) open = false; return '<button type="button" class="b' + (have ? ' on' : can ? '' : ' off') + '" data-skill="' + (can ? q.id : '') + '">' + (q.move && POWER[q.move] ? POWER[q.move].icon + ' ' : '') + esc(q.name) + '</button>'; }).join('') + '</div>'; }).join('');
    const hunted = hero && s.rep < 15;
    this.el.innerHTML = '<div class="wrap"><div class="ttl">' + (hero ? 'THE TOWER' : 'THE LAIR') + '</div>' + (this.msg ? '<div style="margin:8px 0;padding:8px 10px;border-radius:10px;background:rgba(255,255,255,.08)">' + this.msg + '</div>' : '') +
      '<div>Level <b>' + lv + '</b> · ' + s.xp + ' XP' + (lv < 20 ? ' / ' + nx : '') + '</div><div class="bar"><i style="width:' + (lv < 20 ? Math.round((s.xp - lo) / (nx - lo) * 100) : 100) + '%;background:linear-gradient(90deg,#ff4fa3,#ffd27a)"></i></div>' +
      '<div>Reputation: <b>' + rep + '</b> (' + Math.round(s.rep) + ')</div>' + repBar(s) + '<div style="opacity:.7;font-size:11px">' + (hero ? 'Fall under 15 and you become a villain' : 'Climb to 60 and you become a hero') + '</div>' +
      '<h2>Who fights</h2><div class="two"><canvas></canvas><div class="cards">' + cardsHtml(this.side, s.flyer) + '</div></div>' +
      '<h2>Level ' + (s.idx + 1) + ': ' + levelName(s) + '</h2><div><b>' + esc(P.name) + '</b> · town ' + (s.idx + 1) + ' of ' + PATH.length + (hunted ? ' · <span style="color:#ff8a7a">the heroes are hunting you</span>' : '') + '</div><div style="opacity:.75;font-size:12px">' + esc(P.blurb || '') + '</div><button type="button" class="go" data-go2>' + (hero ? 'FLY TO DEFEND IT' : 'FLY IN AND WRECK IT') + '</button>' +
      '<button type="button" class="b" data-walkin style="width:100%;margin-top:12px">' + (hero ? '\u{1F3F0} Walk into the tower' : '\u{1F480} Walk into the lair') + '</button><button type="button" class="b" data-station style="width:100%;margin-top:8px">\u{1F3B6} Radio station</button><div class="lab" style="margin-top:12px">Testing: jump to a level</div><div class="row">' + WAVES.slice(0, 5).map((w, i) => '<button type="button" class="b' + (s.idx === i ? ' on' : '') + '" data-jump="' + i + '">' + (i + 1) + ' ' + w[0] + '</button>').join('') + '</div>' +
      '<h2>Skills · ' + this.points + ' point' + (this.points === 1 ? '' : 's') + ' to spend</h2>' + skills +
      (s.trophies.length ? '<h2>Trophy wall</h2><div>' + s.trophies.map(esc).join(', ') + '</div>' : '') +
      '<h2>' + (hero ? 'The tower' : 'The lair') + ': ' + Math.min(lv, 12) + ' floor' + (lv > 1 ? 's' : '') + '</h2><svg width="160" height="' + (Math.min(lv, 12) * 22 + 20) + '">' + floors + '</svg>' +
      '<button type="button" class="b" data-out style="width:100%;margin-top:14px">Back to the menu</button></div>';
    const $ = (q) => this.el.querySelector(q);
    $('[data-go2]').onclick = () => this.start();
    { const q = this.el.querySelector('[data-walkin]'); if (q) q.onclick = () => { this.closeHub(); this.g.base.start({ hub: this }); }; }
    { const q = this.el.querySelector('[data-station]'); if (q) q.onclick = () => { if (this.g.audio) openStation(this.g.audio.music); }; }
    this.el.querySelectorAll('[data-jump]').forEach(b => { b.onclick = () => { s.idx = +b.dataset.jump; HS.save(); this.msg = ''; this.draw(); }; }); // Sean, testing the fights: straight to any of the first four
    $('[data-out]').onclick = () => { this.closeHub(); this.g.toMenu ? this.g.toMenu() : location.reload(); };
    this.el.querySelectorAll('[data-who]').forEach(b => { b.onclick = () => { HS.load().last[this.side] = b.dataset.who; HS.save(); this.s = HS.load()[this.side]; this.msg = ''; this.draw(); }; });
    this.el.querySelectorAll('[data-skill]').forEach(b => { b.onclick = () => { const id = b.dataset.skill; if (!id) return; s.skills[id] = 1; HS.save(); this.draw(); }; });
    this.preview(HS.name(s.flyer));
  }
  // the figure in its outfit, turning
  preview(name) { if (this.prev) { this.prev(); this.prev = null; } this.prev = turning(this.el.querySelector('canvas'), name); }
  // ---------- a town
  start() {
    const g = this.g, s = this.s, key = PATH[s.idx % PATH.length]; this.closeHub();
    if (g.moveWorld && key !== placeKey()) { g.heroGo = true; g.moveWorld(key, this.side); g.startMode(this.side); return; } // the world moved: a new mode starts it there
    this.labWas = { hero: LAB.hero, villain: LAB.villain, moves: LAB.moves, army: LAB.army }; // the Sandbox's own settings, put back after
    LAB.hero = this.level; LAB.villain = Math.max(1, s.idx + 1); LAB.moves = this.moves(); LAB.spotK = 1 + 0.15 * this.count('spot'); LAB.toughK = 1 + 0.2 * this.count('tough'); LAB.army = this.side === 'villain' ? s.idx >= 2 : s.idx >= 4 && s.idx % 3 === 1;
    const D = g.disasters, B = g.city.bounds, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2, F = g.flight, hero = this.side === 'hero', wave = WAVES[s.idx % WAVES.length], evs = [], vs = [];
    if (hero && wave[0] === 'tornado') LAB.army = false; // no helicopters shooting at her while she dodges what it throws
    if (hero && wave[0] === 'aliens' && g.horde) { this.alienLevel(key); return; }
    if (hero && (wave[0] === 'worm' || wave[0] === 'kaiju') && wave.length === 1 && g.horde) { this.bossLevel(key, wave[0]); return; }
    if (hero && wave[0] === 'zombies' && g.horde) { this.zombieLevel(key); return; }
    if (hero && wave[0] === 'riot' && wave.length === 1 && g.horde) { this.riotLevel(key); return; }
    for (const e of D.list) if (e.type === 'villains' && e.alive) for (const w of e.who) if (!w.gone) w.state = 'gone';
    const allies = []; if (!hero) { const P = g.people; for (const w of wave) { if (VILLAINS.includes(w)) continue; if (w === 'zombies') { for (let i = 0; i < 120; i++) P.drop(B.x0 + Math.random() * (B.x1 - B.x0), B.z0 + Math.random() * (B.z1 - B.z0), -1); } else { const e = D.start(w, cx + (Math.random() - 0.5) * 120, cz + (Math.random() - 0.5) * 120, { life: 99999 }); if (e) allies.push(e); } } } // Destroy: the disaster is on your side, the heroes come for you both
    if (hero) { for (const w of wave) { if (VILLAINS.includes(w)) { if (HS.load().chars[w].side === 'villain') vs.push(w); } else { const a0 = Math.random() * 6.28, far = w === 'tornado' ? 170 : 0, e = D.start(w, far ? cx + Math.cos(a0) * far : cx + (Math.random() - 0.5) * 120, far ? cz + Math.sin(a0) * far : cz + (Math.random() - 0.5) * 120, w === 'tornado' ? { life: 99999, size: 2.2 } : undefined); if (e) evs.push(e); } } }
    const hunted = false, rivals = hero ? [] : ['nova', 'dragonfly', 'tempo'].filter(id => HS.load().chars[id].side === 'hero').slice(0, Math.min(3, 1 + Math.floor(s.idx / 3))).map(id => HS.name(id)); // only the heroes still heroes
    for (const n of vs) { const e = D.start('villains', cx + (Math.random() - 0.5) * 160, cz + (Math.random() - 0.5) * 160, { only: n, quiet: true }); if (e) evs.push(e); }
    if (rivals.length) { const e = D.start('villains', cx, cz, { rivals, quiet: true }); if (e) { evs.push(e); this.rivalEv = e; } }
    this.flyUp(cx, cz); // Sean: every level starts floating over the town
    const need = hero ? 0 : Math.min(25 + 15 * s.idx, Math.floor(g.city.buildings.length * 0.6)); this.round = { evs, allies, need, t: 0, downs: 0, wasDown: false, hero, hunted, rivals, key, ended: false, nothing: !evs.length };
    this.rep = document.createElement('div'); this.rep.id = 'zd-rep'; document.body.appendChild(this.rep);
    const town = PLACES[key].name, seen = s.towns[key]; F.tip(hero ? (hunted ? 'You have gone too far. The other heroes are coming for you!' : seen && seen.fear > 200 ? 'The people of ' + town + ' remember you. They run' : s.rep >= 60 ? 'The people of ' + town + ' cheer as you fly in. Use your powers and Lock on' : wave[0] === 'tornado' ? 'Defend ' + town + '. Lock on to go round the tornado against its spin' : 'Defend ' + town + '. Use your powers and Lock on') : 'Bring down ' + need + ' buildings in ' + town + ' and beat the heroes who come');
    if (hero && (s.rep < 35 || (seen && seen.fear > 200))) g.people.scare(cx, cz, 400, 0.5);
  }
  flyUp(x, z) { const F = this.g.flight, s = this.s; F.owner = this; F.heroGame = true; F.inLevel = true; F.start(s.flyer); const k = 1 + 0.12 * this.count('speed'); if (k > 1) F.P = { ...F.P, max: F.P.max * k, start: F.P.start * k }; F.onStopped = () => {}; F.hovering = true; F.speed = F.thr = 0; F.pos.set(x, 70, z); F.pitch = 0; }
  // Destroy: at the lair's door, in you go; the level goes on outside, as at the heroes' base (horde.js)
  baseArrive() { const g = this.g, F = g.flight, R = this.round; F.baseStop(); F.hovering = true; F.speed = F.thr = 0; const fd = document.createElement('div'); fd.style.cssText = 'position:fixed;inset:0;background:#000;opacity:0;transition:opacity .22s;z-index:65;pointer-events:none'; document.body.appendChild(fd); requestAnimationFrame(() => { fd.style.opacity = '1'; }); setTimeout(() => { if (R && R === this.round && !R.ended && F.active) { R.hull = F.hull; F.stop(true); g.base.start({ level: this }); } fd.style.transition = 'opacity .35s'; fd.style.opacity = '0'; setTimeout(() => fd.remove(), 400); }, 240); }
  // back out of the door: over it, rested a little
  back() { const g = this.g, F = g.flight, B = g.base, R = this.round; this.s = HS.load()[this.side]; this.flyUp(B.x, B.z + B.S.d / 2 + 8); if (R && R.hull != null) F.hull = Math.min(F.hullMax || 100, R.hull + 30); F.setView(F.view); F.tip('Back outside. Finish the job'); }
  // level 1 (Sean): the invasion: the fleet overhead, its soldiers rained into the streets and fought on foot like the horde; the fleet can be hit from the air
  alienLevel(key) {
    const g = this.g, s = this.s, P = g.people, D = g.disasters, B = g.city.bounds, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2, n = 150, pool = []; LAB.reset();
    for (let j = 0; j < P.active && pool.length < n; j++) { if (P.kind[j] === 0 && P.isCivilian(j) && P.lvl[j] === -1 && Math.hypot(P.x[j] - cx, P.z[j] - cz) > 60 && P.hide(j)) pool.push(j); }
    const e = D.start('aliens', cx, cz, { life: 99999, noSquads: true, tripods: 2, n: 6 }); if (e) { e.launchT = 0.5; e.dropT = 8; } this.round = { evs: e ? [e] : [], need: 0, t: 0, downs: 0, hero: true, key, ended: false, zombie: true, n, noun: ' aliens' };
    g.people.crLayer = new CreatureLayer(g.disasters.ctx.scene, g.people.active + 64); g.horde.start({ n, pool, level: true, generals: 'alien', fleet: e, types: ALIEN_MIX, label: 'ALIENS', verb: ' DOWN', onEnd: (won, H) => { this.round.horde = H; this.finish(won, won ? null : 'The invasion took you down'); } });
    this.rep = document.createElement('div'); this.rep.id = 'zd-rep'; document.body.appendChild(this.rep);
    g.toast ? g.toast('Defend ' + PLACES[key].name + ': ' + n + ' alien soldiers in the streets, the fleet overhead') : 0;
  }
  // levels 3 and 4 (Sean): the giant fights: on foot or in the air, the whole kit against its health; it comes for you
  bossLevel(key, type) {
    const g = this.g, D = g.disasters, B = g.city.bounds, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2, e = D.start(type, cx, cz, { life: 99999, quiet: true }); LAB.reset();
    if (!e) { this.round = { evs: [], need: 0, t: 0, downs: 0, hero: true, key, ended: false }; return this.finish(true); }
    if (type === 'kaiju') { e.x = cx + 80; e.z = cz; e.yaw = Math.PI; } // close by, not a minute's walk off
    e.heroHp = 100; this.round = { evs: [e], need: 0, t: 0, downs: 0, hero: true, key, ended: false, zombie: true, boss: e, n: 100, noun: '% ' + type };
    g.horde.start({ boss: e, n: 100, level: true, label: type.toUpperCase(), onEnd: (won, H) => { this.round.horde = H; this.finish(won, won ? null : 'The ' + (type === 'worm' ? 'worm' : 'kaiju') + ' was too much'); } });
    this.rep = document.createElement('div'); this.rep.id = 'zd-rep'; document.body.appendChild(this.rep);
    g.toast ? g.toast('Defend ' + PLACES[key].name + ': ' + (type === 'worm' ? 'hit the worm when it breaks out; move off the red marks' : 'hit it, throw cars at it, smash down on it; move off the red marks')) : 0;
  }
  // the zombie level (Sean, 10b): the town down to about 20 people and a few cops, the rest of its people's slots dropped again as
  // zombies, hundreds; Nova on foot with the whole kit (horde.js). Cleared: the town is saved
  zombieLevel(key) {
    const g = this.g, s = this.s, P = g.people, B = g.city.bounds, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2, pool = []; let kept = 0; LAB.reset();
    for (let j = 0; j < P.active; j++) { if (P.kind[j] !== 0) continue; if (kept < 20 && P.isCivilian(j) && P.lvl[j] === -1 && Math.hypot(P.x[j] - cx, P.z[j] - cz) < 60) { kept++; continue; } if (P.hide(j)) pool.push(j); }
    for (let i = pool.length - 1; i > 0; i--) { const k = Math.floor(Math.random() * (i + 1)); const t = pool[i]; pool[i] = pool[k]; pool[k] = t; }
    P.spawnOfficers(cx + 20, cz, 2); P.spawnOfficers(cx - 20, cz, 2);
    const n = Math.min(400 + 100 * Math.min(3, s.idx), pool.length); this.round = { evs: [], need: 0, t: 0, downs: 0, hero: true, key, ended: false, zombie: true, n, noun: ' zombies' };
    g.horde.start({ n, pool, level: true, generals: 'zombie', onEnd: (won, H) => { this.round.horde = H; this.finish(won, won ? null : 'Overrun by the horde'); } });
    this.rep = document.createElement('div'); this.rep.id = 'zd-rep'; document.body.appendChild(this.rep);
    g.toast ? g.toast('Defend ' + PLACES[key].name + ': ' + n + ' zombies in the streets. Tap to punch, swipe to dash, hold to slam') : 0;
  }
  // the riot fought on foot (10d): the mob goes for her and shoves; she knocks them flat and calms them, never dusts them
  riotLevel(key) {
    const g = this.g, s = this.s, B = g.city.bounds, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2, D = g.disasters, e = D.start('riot', cx + (Math.random() - 0.5) * 80, cz + (Math.random() - 0.5) * 80);
    if (!e) { this.round = { evs: [], need: 0, t: 0, downs: 0, hero: true, key, ended: false }; return this.finish(true); }
    this.round = { evs: [e], need: 0, t: 0, downs: 0, hero: true, key, ended: false, zombie: true, riot: true, n: e.members.length, noun: ' rioters' }; LAB.reset();
    g.horde.start({ mode: 'riot', riot: e, level: true, onEnd: (won, H) => { this.round.horde = H; if (won) e.end(true); this.finish(won, won ? null : 'The mob got the better of you'); } });
    this.rep = document.createElement('div'); this.rep.id = 'zd-rep'; document.body.appendChild(this.rep);
    g.toast ? g.toast('Defend ' + PLACES[key].name + ': a riot of ' + e.members.length + '. Knock them flat and they go home') : 0;
  }
  zombieNight() { return false; } // Sean's levels are played in the daylight: the zombies' night made everything too dark to see
  placeNow() { try { return new URLSearchParams(location.search).get('place') || null; } catch (e) { return null; } }
  update() {
    const R = this.round; if (!R || R.ended) return; const F = this.g.flight, S = LAB.stats; R.t += 1 / 60;
    if (this.g.base && this.g.base.level === this) { if (this.rep) this.rep.style.display = 'none'; return; } // in the lair: nothing ends till you come out
    if (R.zombie) { const H = this.g.horde; if (!H.active && !H.flying) return this.finish(false, 'You left the town'); if (R.riot && R.evs[0] && !R.evs[0].alive && !H.over) { H.finish(true); return; } if (R.boss && (R.boss.heroHp <= 0 || !R.boss.alive) && !H.over) { H.finish(true); return; } this.rep.style.display = 'none'; this.rep.innerHTML = 'Hero · ' + H.left + R.noun + '<div class="bar"><i style="width:' + Math.max(0, 100 - H.left / R.n * 100) + '%"></i></div>'; return; }
    const live = R.evs.filter(e => e.alive && (e.type !== 'villains' || e.who.some(w => !w.gone && !w.beaten))).length;
    const fear = LAB.fear(), rep = R.hero ? Math.max(0, Math.min(100, this.s.rep - fear / 30)) : 0;
    this.rep.innerHTML = R.hero ? REP(rep) + (live ? ' · ' + live + ' to stop' : '') + '<div class="bar"><i style="width:' + rep + '%"></i></div>' : S.buildings + '/' + R.need + ' buildings<div class="bar"><i style="width:' + Math.min(100, S.buildings / R.need * 100) + '%"></i></div>';
    const down = F.state === 'down' && !F.downAt; if (down && !R.wasDown) R.downs++; R.wasDown = down;
    this.rep.style.display = F.fighting ? 'none' : ''; if (F.fighting) return; // on foot, in the fight (flight.js fightFoe); the bars say it
    if (!F.active) return this.finish(false, 'You left the town');
    if (R.downs >= 3) return this.finish(false, 'Knocked out of the sky three times');
    if (R.t > 1 && (R.hero ? live === 0 : S.buildings >= R.need && live === 0)) this.finish(true);
  }
  // over the line: a hero under 15 becomes a villain (now picked under Destroy), a villain at 60 a hero (Defend). Returns the line for the tally
  cross(s) { const n = HS.shown(s.flyer); if (s.side === 'hero' && s.rep < 15) { s.side = 'villain'; s.rep = 14; return '<br><b style="color:#ff8a7a">' + n + ' has gone too far: now a villain. You will find them under Destroy</b>'; } if (s.side === 'villain' && s.rep >= 60) { s.side = 'hero'; s.rep = 60; return '<br><b style="color:#6cff8a">' + n + ' has done too much good: now a hero. You will find them under Defend</b>'; } return ''; }
  finish(won, why) {
    const R = this.round, s = this.s, S = LAB.stats, F = this.g.flight, g = this.g; R.ended = true; const fear = LAB.fear(); if (this.rep) { this.rep.remove(); this.rep = null; }
    if (R.zombie) {
      const H = R.horde || g.horde, xp = won ? 300 + (R.boss ? 300 : H.kills) + (H.bitten < 10 ? 100 : 0) : 20 + Math.round(H.kills / 4); if (g.base && g.base.active) { g.base.level = null; g.base.stop(true); } if (H.active) H.stop(true); if (H.flying) { H.flying = false; if (H.el) H.el.remove(); if (g.flight.active) g.flight.stop(true); }
      for (const e of R.evs) if (e.alive) endDisaster(e); g.flight.heroGame = false; if (this.labWas) Object.assign(LAB, this.labWas, { spotK: 1, toughK: 1 });
      const lv0 = this.level, was = s.rep, fear2 = LAB.fear(); s.xp += xp; if (won) s.threat = Math.min(100, (s.threat || 0) + 20); const up = this.level - lv0; if (won) s.idx = Math.min(PATH.length - 1, s.idx + 1); s.towns[R.key] = { won: (s.towns[R.key] && s.towns[R.key].won) || won, fear: Math.round(fear2) }; s.rep = Math.max(0, Math.min(100, s.rep + (won ? 6 : 0) - fear2 / 30)); const cross = this.cross(s); HS.save(); this.round = null; g.heroGo = false;
      this.hub('<b>' + (won ? 'TOWN SAVED' : (why || 'NOT THIS TIME')) + '</b> · +' + xp + ' XP' + (up ? ' · <b>LEVEL UP!</b> A skill point to spend' : '') + '<br>' + (R.boss ? 'Hit ' + H.bitten.toFixed(0) + ' times' : (R.noun.trim() + ' down ' + H.kills + ' · hit ') + H.bitten + ' times') + ' · ' + Math.round(H.time) + ' s · reputation ' + Math.round(was) + ' to ' + Math.round(s.rep) + cross); return;
    }
    F.onStopped = null; for (const e of R.evs) if (e.type === 'villains') for (const w of e.who) { if (w.beaten && !s.trophies.includes(w.name)) s.trophies.push(w.name); }
    let xp = 0, lines = [];
    if (R.hero) { const was = s.rep; xp = won ? Math.max(50, 200 + 100 * s.idx + (S.stopped || 0) * 60 + S.won * 80 + S.saved * 30 - Math.round(fear / 4)) : 25; const gain = won ? 6 : 0; s.rep = Math.max(0, Math.min(100, s.rep + gain - fear / 30)); if (R.hunted && !won) { s.rep = Math.min(100, s.rep + 15); xp = 0; lines.push('The heroes beat you. You wake in the tower, and it is a lesson'); } lines.push('Reputation ' + Math.round(was) + ' to ' + Math.round(s.rep) + ': ' + REP(s.rep)); s.towns[R.key] = { won: (s.towns[R.key] && s.towns[R.key].won) || won, fear: Math.round(fear) }; if (R.hunted && won) lines.push('You beat the heroes. This town now lives in fear of you'); }
    else { const was = s.rep, good = (S.stopped || 0) * 35 + S.saved * 2; s.rep = Math.max(0, Math.min(100, s.rep + good - (won ? 3 : 0))); lines.push('Reputation ' + Math.round(was) + ' to ' + Math.round(s.rep) + (good ? ': the town noticed the good you did' : '')); xp = won ? 200 + 100 * s.idx + S.buildings * 15 + S.won * 100 : 10 + S.buildings * 5; s.towns[R.key] = { won: (s.towns[R.key] && s.towns[R.key].won) || won, fear: Math.round(fear) }; }
    const lv0 = this.level; s.xp += xp; if (won) s.threat = Math.min(100, (s.threat || 0) + (R.zombie ? 20 : 25)); const up = this.level - lv0; if (won) s.idx = Math.min(PATH.length - 1, s.idx + 1); { const cross = this.cross(s); if (cross) lines.push(cross.replace('<br>', '')); } HS.save();
    if (F.active) F.stop(true);
    for (const e of R.allies || []) if (e.alive) endDisaster(e);
    F.heroGame = false; F.inLevel = false; Object.assign(LAB, this.labWas, { spotK: 1, toughK: 1 });
    for (const e of R.evs) { if (!e.alive) continue; if (e.type === 'villains') { for (const w of e.who) if (!w.gone) { w.state = 'gone'; w.rig.root.visible = false; } } else endDisaster(e); } // what is left of the trouble goes with you
    const head = won ? (R.hero ? 'TOWN SAVED' : 'TOWN WRECKED') : (why || 'NOT THIS TIME');
    this.hub('<b>' + head + '</b> · +' + xp + ' XP' + (up ? ' · <b>LEVEL UP!</b> A skill point to spend' : '') + '<br>Buildings down ' + S.buildings + ' · people scared ' + S.scared + ' · hurt ' + S.hurt + ' · saved ' + S.saved + ' · fear ' + Math.round(fear) + (lines.length ? '<br>' + lines.join('<br>') : ''));
    this.round = null;
  }
}
