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
import { openLevels, restoreTests, levelInfo } from './levelmenu.js';
import { Squad } from './squad.js';
import { ALIEN_MIX } from './figures.js';
import { CreatureLayer } from './creaturekit.js';
import { current, danger, resolve, waveOf, threatName, freshOnes } from './threats.js';
import { LiveFront, LiveFlood } from './livestorm.js';
import { finish as stormOver } from './heropower.js';
import { openMap, villainsLeft } from './storymap.js';


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
    { const ok = new Set(Object.values(TREE).flat().map((q) => q.id)); for (const c of Object.values(chars)) for (const k of Object.keys(c.skills)) if (!ok.has(k)) delete c.skills[k]; } this.d = { chars, last, outfits: o.outfits || {} }; for (const side of ['hero', 'villain']) Object.defineProperty(this.d, side, { get() { return chars[H.cur(side)]; } }); return this.d;
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
export const rigFor = (name, of, hd = true) => (['Nova', 'Dragonfly', 'Tempo'].includes(name) ? heroRig(name, of, hd) : villainRig(name, of, hd));
// the two a fighter can call on TEAM: whoever else stands on their side now, by the character's own name
export const matesOf = (who) => { const D = HS.load(), id = String(who).toLowerCase(), side = (D.chars[id] || {}).side || 'hero'; return HS.team(side).filter((q) => q !== id).slice(0, 2).map((q) => HS.name(q)); };
export const mateDown = (g, name) => { const Q = g.mode && g.mode.squad; return !!(Q && Q.downs && Q.downs[String(name).toLowerCase()]); };
// a teammate's body in flight, kept for the next call so a call never has to build one
const MATE_RIGS = new Map();
export const mateRig = (name) => { const of = HS.outfit(name), k = name + JSON.stringify(of || {}); let r = MATE_RIGS.get(k); if (!r) { r = rigFor(name, of); MATE_RIGS.set(k, r); } r.body.rotation.x = 1.35; for (const a of r.arms) a.sh.rotation.set(-3, 0, a.sx * 0.1); return r; };
if (typeof window !== 'undefined') window.__hs = HS;
export const levelOf = (xp) => Math.min(20, 1 + Math.floor((Math.sqrt(1 + xp / 50) - 1) / 2)); // 1 at 0, then 400, 1200, 2400... XP
export const xpFor = (lv) => 50 * ((2 * (lv - 1) + 1) ** 2 - 1);
// Legend, the menu's bar (Sean): all the heroes' XP pulls one way, all the villains' the other. A fighter counts for the side they stand on now, so one who crosses over swings it. The 2000 is the cushion: a first win does not throw it to one end. A Sandbox test still running counts as what it saved over (testWas)
export const legend = () => { const L = { hero: 0, villain: 0, heroWon: 0, villainWon: 0 }; for (const c of Object.values(HS.load().chars)) { const s = c.testWas ? JSON.parse(c.testWas) : c; L[s.side] += s.xp; L[s.side + 'Won'] += s.idx; } const lean = L.lean = (L.villain - L.hero) / (L.villain + L.hero + 2000); L.title = lean <= -0.6 ? 'Champion of the City' : lean <= -0.25 ? 'Trusted Hero' : lean < 0.25 ? 'Wild Card' : lean < 0.6 ? 'Troublemaker' : 'Public Enemy'; return L; };
// the skill tree: four branches, each in order; a point a level. stat: what it raises (Heavy hands: blows 6% harder; Afterburn: flying 12% faster; Deep well: power fills 10% faster; Tough: 20% more health; Team spirit: TEAM fills 15% faster). The powers are the kit's now (kit.js), so the old skills that opened moves are gone, and their points came back (HS.load)
export const TREE = {
  Strength: [1, 2, 3, 4, 5].map((n) => ({ id: 'str' + n, name: 'Heavy hands ' + n, stat: 'power' })),
  Speed: [1, 2, 3, 4, 5].map((n) => ({ id: 'fast' + n, name: 'Afterburn ' + n, stat: 'speed' })),
  Energy: [1, 2, 3, 4, 5].map((n) => ({ id: 'en' + n, name: 'Deep well ' + n, stat: 'energy' })),
  Control: [{ id: 'tough1', name: 'Tough 1', stat: 'tough' }, { id: 'team1', name: 'Team spirit 1', stat: 'team' }, { id: 'tough2', name: 'Tough 2', stat: 'tough' }, { id: 'team2', name: 'Team spirit 2', stat: 'team' }, { id: 'tough3', name: 'Tough 3', stat: 'tough' }],
};
const START_MOVES = ['spin', 'kick', 'laser', 'drag', 'wind', 'fire']; // and two powers to start with
// a town's trouble, along the road: disasters by type, villains by name
export const WAVES = [['aliens'], ['zombies'], ['worm'], ['kaiju'], ['tornado'], ['riot'], ['flood', 'blur'], ['quake', 'tyrant'], ['aliens'], ['haboob', 'weaver'], ['kaiju'], ['worm', 'blur'], ['plant', 'tyrant'], ['volcano', 'weaver'], ['tsunami', 'blur'], ['rift', 'tyrant'], ['sinkhole', 'weaver', 'blur'], ['blackhole', 'tyrant'], ['spill', 'blur', 'weaver'], ['coldwave', 'tyrant', 'weaver'], ['kaiju', 'blur', 'tyrant', 'weaver']];
const LEVEL = { aliens: 'The alien invasion', zombies: 'The zombie outbreak', worm: 'The giant worm', kaiju: 'The kaiju', tornado: 'The tornado', riot: 'The riot' }, VILLAINS = ['blur', 'tyrant', 'weaver'];
export { VILLAINS }; // the names of the first levels (Sean: the main action fights; the weather levels come after)
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
    this.g = g; this.side = side; this.kind = side; this.msgs = {}; if (!g.testRun) restoreTests(); const S = HS.load(); this.s = S[side]; this.round = null;
    if (!document.getElementById('zd-hub-css')) { const c = document.createElement('style'); c.id = 'zd-hub-css'; c.textContent = CSS; document.head.appendChild(c); }
    if (g.heroGo) { g.heroGo = false; this.start(); } else { const wake = () => { if (!g.base || !g.people) { setTimeout(wake, 100); return; } if (g.mode !== this) return; if (current(side)) this.start(); else this.hub(); }; setTimeout(wake, 0); } // arrived in the next town: straight in. A page just loaded (the base is made after the mode): the city picked if there is one, else home
  }
  // the mode's duties to game.js
  tap() {} phase() { return 0.3; } onEvent() {} threat() { return 0; } busy() { return false; } reset() {}
  get level() { return levelOf(this.s.xp); }
  get points() { return this.level - 1 - Object.keys(this.s.skills).length; }
  shareXp(xp) { if (this.g.testRun || xp <= 0) return; const D = HS.load(); for (const id of HS.team(this.side)) if (D.chars[id] !== this.s) D.chars[id].xp += Math.round(xp / 2); }
  moves() { const on = {}; for (const k of Object.keys(LAB.moves)) on[k] = false; for (const k of START_MOVES) on[k] = true; for (const B of Object.values(TREE)) for (const q of B) if (q.move && this.s.skills[q.id]) on[q.move] = true; return on; }
  count(stat) { let n = 0; for (const B of Object.values(TREE)) for (const q of B) if (q.stat === stat && this.s.skills[q.id]) n++; return n; }
  // ---------- home: the base (Sean: the tower's screen is gone; the skills are on its computer, the next city on its Map station)
  hub(msg, at) {
    if (this.g.testRun) { const T = this.g.testRun; this.g.testRun = null; restoreTests(); openLevels(this.g, { side: T.side, last: T.i, code: levelInfo(T.side, T.i).code, msg: msg || '' }); return; }
    this.s = HS.load()[this.side]; if (!HS.team(this.side).length) { pickScreen(this.side, () => this.hub(msg, at), () => { this.g.toMenu ? this.g.toMenu() : location.reload(); }); if (msg) this.card(msg, 'OK'); return; }
    const g = this.g; g.base.start({ hub: this, at: at || 'door' }); if (msg) this.card(msg, 'OK'); const N = freshOnes(this.side)[0]; if (N && g.toast) g.toast('The Map station is flashing: ' + threatName(N, this.side, (id) => HS.shown(id)) + ' in ' + PLACES[N.key].name, 3500);
  }
  // the map, from the base's station or its door
  map() { const g = this.g, G = g.globe, side = this.side; if (!G || document.getElementById('zd-map')) return; G.open(); openMap(g, { side, screen: true, arrive: () => { g.base.stop(true); G.close(); this.start(); }, back: () => { G.close(); g.base.drawRow(); }, whoFn: (redraw) => pickScreen(side, () => { g.base.redress(); redraw(); }, redraw) }); }
  // a result on a card; the button glows
  card(html, label, onDone, other) { const c = document.createElement('div'); c.id = 'zd-result'; c.style.cssText = 'position:fixed;left:0;right:0;top:0;bottom:0;z-index:66;display:flex;align-items:center;justify-content:center;background:rgba(6,4,16,.55);padding:16px;box-sizing:border-box'; c.innerHTML = '<style>@keyframes zdgo{from{box-shadow:0 0 6px 1px #ffe27a}to{box-shadow:0 0 22px 7px #ffe27a}}</style><div style="max-width:420px;width:100%;padding:16px;border-radius:16px;background:rgba(20,14,38,.97);border:1px solid rgba(255,255,255,.3);color:#f4eee4;font:14px/1.4 system-ui,sans-serif">' + html + '<button type="button" data-a style="display:block;width:100%;min-height:54px;margin-top:14px;border:2px solid #ffe27a;border-radius:14px;background:linear-gradient(#ffb02e,#d9570f);color:#fff;font:900 16px system-ui,sans-serif;letter-spacing:.05em;animation:zdgo .8s ease-in-out infinite alternate">' + label + '</button>' + (other ? '<button type="button" data-b style="display:block;width:100%;min-height:44px;margin-top:8px;border:1px solid rgba(255,255,255,.3);border-radius:12px;background:rgba(255,255,255,.08);color:#fff;font:700 13px system-ui,sans-serif">' + other[0] + '</button>' : '') + '</div>'; document.body.appendChild(c); c.querySelector('[data-a]').onclick = () => { c.remove(); if (onDone) onDone(); }; if (other) c.querySelector('[data-b]').onclick = () => { c.remove(); other[1](); }; }
  // a city over (Sean): won, the choice to go back to base is the one lit up; lost, you wake in the base beside the pod. The board moves on either way
  ended(won, msg, side0) { const g = this.g, T = this.threat; this.threat = null; if (g.testRun) { this.hub(msg); return; } if (T) resolve(side0 || this.side, T.id, won, villainsLeft()); if (!won) { this.hub(msg, 'pod'); return; } this.card(msg, 'BACK TO BASE', () => this.flyHome(), ['Back to the menu', () => { g.toMenu ? g.toMenu() : location.reload(); }]); }
  // home after a win (Sean): she flies herself back over the town to the base's door, the BASE button's flight (flight.baseRun), then in through a fade; a tap goes straight in
  flyHome() {
    const g = this.g, F = g.flight, B = g.base, at = this.homeAt; this.homeAt = null;
    if (!F || !B || !g.city || F.active || !HS.team(this.side).includes(HS.cur(this.side))) { this.hub(); return; }
    if (!B.placed) B.place(); else B.useSide();
    const cam = F.ctx.camera, blend = { pos: cam.position.clone(), quat: cam.quaternion.clone(), fov: cam.fov, t: 0, T: 1.2 }, C = g.city.bounds, x = at ? at[0] : (C.x0 + C.x1) / 2, z = at ? at[2] : (C.z0 + C.z1) / 2, y = Math.max(at ? at[1] : 60, g.people.groundY(x, z) + 3);
    let done = false, wd = 0; const sk = document.createElement('div');
    const inside = () => { if (done) return; done = true; clearTimeout(wd); sk.remove(); if (F.active) { F.baseStop(); F.hovering = true; F.speed = F.thr = 0; } const fd = document.createElement('div'); fd.style.cssText = 'position:fixed;inset:0;background:#000;opacity:0;transition:opacity .22s;z-index:65;pointer-events:none'; document.body.appendChild(fd); requestAnimationFrame(() => { fd.style.opacity = '1'; }); setTimeout(() => { if (F.active) F.stop(true); F.heroGame = false; F.inLevel = false; F.homing = false; F.owner = this; if (g.mode === this) this.hub(); fd.style.transition = 'opacity .35s'; fd.style.opacity = '0'; setTimeout(() => fd.remove(), 400); }, 240); };
    F.owner = { baseArrive: inside }; F.heroGame = true; F.inLevel = true; F.homing = true; F.start(HS.load()[this.side].flyer); if (F.army) { F.army.dispose(); F.army = null; } F.onStopped = () => {}; // no side on the owner: no storm game starts on the way; homing: no TEAM buttons (heropower teamUiStep)
    const door = F.baseDoor(); F.pos.set(x, y, z); F.pitch = 0; F.roll = 0; F.yaw = Math.atan2(-(door[1] - z), door[0] - x); F.hovering = false; F.speed = F.thr = F.P.start; F.snap = true; F.baseGo(); g.camBlend = blend;
    if (F.bar) F.bar.style.display = 'none'; if (F.hud) F.hud.style.display = 'none'; F.tip(B.lair ? 'Back to the lair' : 'Home to the base');
    sk.style.cssText = 'position:fixed;left:0;right:0;top:0;bottom:0;z-index:64;display:flex;align-items:flex-end;justify-content:center;padding-bottom:calc(84px + env(safe-area-inset-bottom));touch-action:none;font:800 13px system-ui,sans-serif;color:#fff;text-shadow:0 1px 3px #000'; sk.innerHTML = '<span style="padding:8px 14px;border-radius:12px;background:rgba(16,14,30,.6)">Tap to go straight in</span>'; sk.addEventListener('pointerdown', (e) => { e.preventDefault(); inside(); }); document.body.appendChild(sk);
    wd = setTimeout(inside, 20000); // whatever happens on the way, she gets home
  }
  // the skills, for the base's computer
  skillsHtml(id) { const s0 = this.s = HS.load()[this.side], s = id ? HS.load().chars[id] : s0, lv = levelOf(s.xp), pts = lv - 1 - Object.keys(s.skills).length; return '<div class="h">Level ' + lv + ' \u00B7 ' + s.xp + ' XP \u00B7 ' + REP(s.rep) + ' \u00B7 ' + pts + ' point' + (pts === 1 ? '' : 's') + ' to spend</div>' + Object.entries(TREE).map(([br, L]) => { let open = true; return '<div class="h">' + br + '</div><div class="row">' + L.map(q => { const have = !!s.skills[q.id], can = open && !have && pts > 0; if (!have) open = false; return '<button type="button"' + (have ? ' class="on"' : '') + (can ? ' data-skill="' + q.id + '"' : (have ? '' : ' style="opacity:.45"')) + '>' + esc(q.name) + '</button>'; }).join('') + '</div>'; }).join(''); }
  // ---------- a town
  start() {
    if (this.g.flight) this.g.flight.teamM = 0; const g = this.g, s = this.s = HS.load()[this.side], T = this.threat = g.testRun ? null : current(this.side), key = T ? T.key : PATH[s.idx % PATH.length], ix = this.ix = T ? danger(T, this.level) - 1 : s.idx; // the story's level comes from the board, its danger from your level; a test level from its number
    if (!T && !g.testRun) { this.hub(); return; }
    if (g.moveWorld && (key !== placeKey() || (T && g.usedTown))) { g.usedTown = false; g.heroGo = true; g.moveWorld(key, this.side); g.startMode(this.side); return; } // the world moved: a new mode starts it there. A town already fought in is built again: the last level took its people
    g.usedTown = !!T;
    this.labWas = { hero: LAB.hero, villain: LAB.villain, moves: LAB.moves, army: LAB.army }; // the Sandbox's own settings, put back after
    LAB.hero = this.level; LAB.villain = Math.max(1, ix + 1); LAB.moves = this.moves(); LAB.powerK = 1 + 0.06 * this.count('power'); LAB.energyK = 1 + 0.1 * this.count('energy'); LAB.teamK = 1 + 0.15 * this.count('team'); LAB.spotK = 1 + 0.15 * this.count('spot'); LAB.toughK = 1 + 0.2 * this.count('tough'); LAB.army = this.side === 'villain' ? ix >= 2 : ix >= 4 && ix % 3 === 1;
    const D = g.disasters, B = g.city.bounds, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2, F = g.flight, hero = this.side === 'hero', wave = T ? waveOf(T, this.side === 'hero' ? villainsLeft() : []) : WAVES[s.idx % WAVES.length], evs = [], vs = [];
    if (hero && wave[0] === 'tornado') LAB.army = false; // no helicopters shooting at her while she dodges what it throws
    if (hero && wave[0] === 'aliens' && g.horde) { this.alienLevel(key); return; }
    if (hero && (wave[0] === 'worm' || wave[0] === 'kaiju') && wave.length === 1 && g.horde) { this.bossLevel(key, wave[0]); return; }
    if (hero && wave[0] === 'zombies' && g.horde) { this.zombieLevel(key); return; }
    if (hero && wave[0] === 'riot' && wave.length === 1 && g.horde) { this.riotLevel(key); return; }
    if (hero && (wave[0] === 'tsunami' || wave[0] === 'haboob' || wave[0] === 'coldwave' || wave[0] === 'flood')) { this.wallLevel(key, wave[0], cx, cz); return; }
    for (const e of D.list) if (e.type === 'villains' && e.alive) for (const w of e.who) if (!w.gone) w.state = 'gone';
    const allies = []; if (!hero) { const P = g.people; for (const w of wave) { if (VILLAINS.includes(w)) continue; if (w === 'zombies') { for (let i = 0; i < 120; i++) P.drop(B.x0 + Math.random() * (B.x1 - B.x0), B.z0 + Math.random() * (B.z1 - B.z0), -1); } else { const e = D.start(w, cx + (Math.random() - 0.5) * 120, cz + (Math.random() - 0.5) * 120, { life: 99999 }); if (e) allies.push(e); } } } // Destroy: the disaster is on your side, the heroes come for you both
    if (hero) { for (const w of wave) { if (VILLAINS.includes(w)) { if (HS.load().chars[w].side === 'villain') vs.push(w); } else { const a0 = Math.random() * 6.28, far = w === 'tornado' ? 170 : 0, e = D.start(w, far ? cx + Math.cos(a0) * far : cx + (Math.random() - 0.5) * 120, far ? cz + Math.sin(a0) * far : cz + (Math.random() - 0.5) * 120, w === 'tornado' ? { life: 99999, size: 2.2 } : undefined); if (e) evs.push(e); } } }
    const hunted = false, rivals = hero ? [] : ['nova', 'dragonfly', 'tempo'].filter(id => HS.load().chars[id].side === 'hero').slice(0, Math.min(3, 1 + Math.floor(ix / 3))).map(id => HS.name(id)); // only the heroes still heroes
    for (const n of vs) { const e = D.start('villains', cx + (Math.random() - 0.5) * 160, cz + (Math.random() - 0.5) * 160, { only: n, quiet: true }); if (e) evs.push(e); }
    if (rivals.length) { const e = D.start('villains', cx, cz, { rivals, quiet: true }); if (e) { evs.push(e); this.rivalEv = e; } }
    this.flyUp(cx, cz); // Sean: every level starts floating over the town
    const need = hero ? 0 : Math.min(25 + 15 * ix, Math.floor(g.city.buildings.length * 0.6)); this.round = { evs, allies, need, t: 0, downs: 0, wasDown: false, hero, hunted, rivals, key, ended: false, nothing: !evs.length };
    this.rep = document.createElement('div'); this.rep.id = 'zd-rep'; document.body.appendChild(this.rep);
    const town = PLACES[key].name, seen = s.towns[key]; F.tip(hero ? (hunted ? 'You have gone too far. The other heroes are coming for you!' : seen && seen.fear > 200 ? 'The people of ' + town + ' remember you. They run' : s.rep >= 60 ? 'The people of ' + town + ' cheer as you fly in. Use your powers and Lock on' : wave[0] === 'tornado' ? 'Defend ' + town + '. Lock on to go round the tornado against its spin' : 'Defend ' + town + '. Use your powers and Lock on') : 'Bring down ' + need + ' buildings in ' + town + ' and beat the heroes who come');
    if (hero && (s.rep < 35 || (seen && seen.fear > 200))) g.people.scare(cx, cz, 400, 0.5);
  }
  flyUp(x, z) { const F = this.g.flight, s = this.s; F.owner = this; F.heroGame = true; F.inLevel = true; F.start(this.squad ? this.squad.cur : s.flyer); const k = 1 + 0.12 * this.count('speed'); if (k > 1) F.P = { ...F.P, max: F.P.max * k, start: F.P.start * k }; F.onStopped = () => {}; F.hovering = true; F.speed = F.thr = 0; F.pos.set(x, 70, z); F.pitch = 0; }
  // a flying level: at the door, in you go; the level goes on outside, as in the horde's levels (horde.js)
  baseArrive() { const g = this.g, F = g.flight, R = this.round; F.baseStop(); F.hovering = true; F.speed = F.thr = 0; const fd = document.createElement('div'); fd.style.cssText = 'position:fixed;inset:0;background:#000;opacity:0;transition:opacity .22s;z-index:65;pointer-events:none'; document.body.appendChild(fd); requestAnimationFrame(() => { fd.style.opacity = '1'; }); setTimeout(() => { if (R && R === this.round && !R.ended && F.active) { if (this.squad) this.squad.note(); F.stop(true); g.base.start({ level: this }); } fd.style.transition = 'opacity .35s'; fd.style.opacity = '0'; setTimeout(() => fd.remove(), 400); }, 240); }
  // back out of the door: over it, with what health the base's mini-game gave
  back() { const g = this.g, F = g.flight, B = g.base, Q = this.squad; if (Q) { const now = HS.cur(this.side); if (now !== Q.cur && !Q.downs[now]) { Q.cur = now; Q.draw(); } else HS.load().last[this.side] = Q.cur; } this.flyUp(B.x, B.z + B.S.d / 2 + 8); if (Q) F.hull = (F.hullMax || 100) * Q.hp[Q.cur]; F.setView(F.view); F.tip('Back outside. Finish the job'); }
  // the wave and the dust storm as villains (livestorm.js): an event of its own, out of the disasters' list, alive till what is left of it is beaten
  wallLevel(key, type, cx, cz) { const F = this.g.flight, e = { type, alive: true, own: true }; for (const q of this.g.disasters.list) if (q.type === 'villains' && q.alive) for (const w of q.who) if (!w.gone) w.state = 'gone'; this.flyUp(cx, cz); this.round = { evs: [e], allies: [], need: 0, t: 0, downs: 0, wasDown: false, hero: true, hunted: false, rivals: [], key, ended: false, nothing: false }; this.rep = document.createElement('div'); this.rep.id = 'zd-rep'; document.body.appendChild(this.rep); if (type !== 'flood') { const FR = { tsunami: { height: 66, warn: 0, quiet: true }, haboob: { light: true, quiet: true }, coldwave: {} }[type]; e.real = this.g.disasters.start(type, cx, cz, FR); if (!e.real) { this.finish(true); return; } e.cleanup = () => { if (e.real.alive) stormOver(e.real); }; } e.make = (F1) => (type === 'flood' ? new LiveFlood(F1, e) : new LiveFront(F1, e, type)); F.wallE = e; F.live = e.make(F); }
  // level 1 (Sean): the invasion: the fleet overhead, its soldiers rained into the streets and fought on foot like the horde; the fleet can be hit from the air
  alienLevel(key) {
    const g = this.g, s = this.s, P = g.people, D = g.disasters, B = g.city.bounds, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2, n = Math.min(250, 140 + 10 * this.ix), pool = []; LAB.reset();
    for (let j = 0; j < P.active && pool.length < n; j++) { if (P.kind[j] === 0 && P.isCivilian(j) && P.lvl[j] === -1 && Math.hypot(P.x[j] - cx, P.z[j] - cz) > 60 && P.hide(j)) pool.push(j); }
    const e = D.start('aliens', cx, cz, { life: 99999, noSquads: true, tripods: Math.min(4, 2 + Math.floor(this.ix / 6)), n: 6 }); if (e) { e.launchT = 0.5; e.dropT = 8; } this.round = { evs: e ? [e] : [], need: 0, t: 0, downs: 0, hero: true, key, ended: false, zombie: true, n, noun: ' aliens' };
    g.people.crLayer = new CreatureLayer(g.disasters.ctx.scene, g.people.active + 64); g.horde.start({ n, pool, level: true, generals: 'alien', hitK: 1 + 0.05 * this.ix, fleet: e, types: ALIEN_MIX, label: 'ALIENS', verb: ' DOWN', onEnd: (won, H) => { this.round.horde = H; this.finish(won, won ? null : 'The invasion took you down'); } });
    this.rep = document.createElement('div'); this.rep.id = 'zd-rep'; document.body.appendChild(this.rep);
    g.toast ? g.toast('Defend ' + PLACES[key].name + ': ' + n + ' alien soldiers in the streets, the fleet overhead') : 0;
  }
  // levels 3 and 4 (Sean): the giant fights: on foot or in the air, the whole kit against its health; it comes for you
  bossLevel(key, type) {
    const g = this.g, D = g.disasters, B = g.city.bounds, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2, e = D.start(type, cx, cz, { life: 99999, quiet: true }); LAB.reset();
    if (!e) { this.round = { evs: [], need: 0, t: 0, downs: 0, hero: true, key, ended: false }; return this.finish(true); }
    if (type === 'kaiju') { e.x = cx + 80; e.z = cz; e.yaw = Math.PI; } // close by, not a minute's walk off
    e.heroHp = 100; e.heroTough = 1 + 0.08 * this.ix; this.round = { evs: [e], need: 0, t: 0, downs: 0, hero: true, key, ended: false, zombie: true, boss: e, n: 100, noun: '% ' + type };
    g.horde.start({ boss: e, n: 100, level: true, hitK: 1 + 0.05 * this.ix, label: type.toUpperCase(), onEnd: (won, H) => { this.round.horde = H; this.finish(won, won ? null : 'The ' + (type === 'worm' ? 'worm' : 'kaiju') + ' was too much'); } });
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
    const n = Math.min(400 + 100 * Math.min(3, this.ix), pool.length); this.round = { evs: [], need: 0, t: 0, downs: 0, hero: true, key, ended: false, zombie: true, n, noun: ' zombies' };
    g.horde.start({ n, pool, level: true, hitK: 1 + 0.05 * this.ix, generals: 'zombie', onEnd: (won, H) => { this.round.horde = H; this.finish(won, won ? null : 'Overrun by the horde'); } });
    this.rep = document.createElement('div'); this.rep.id = 'zd-rep'; document.body.appendChild(this.rep);
    g.toast ? g.toast('Defend ' + PLACES[key].name + ': ' + n + ' zombies in the streets. Tap to punch, swipe to dash, hold to slam') : 0;
  }
  // the riot fought on foot (10d): the mob goes for her and shoves; she knocks them flat and calms them, never dusts them
  riotLevel(key) {
    const g = this.g, s = this.s, B = g.city.bounds, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2, D = g.disasters, e = D.start('riot', cx + (Math.random() - 0.5) * 80, cz + (Math.random() - 0.5) * 80);
    if (!e) { this.round = { evs: [], need: 0, t: 0, downs: 0, hero: true, key, ended: false }; return this.finish(true); }
    this.round = { evs: [e], need: 0, t: 0, downs: 0, hero: true, key, ended: false, zombie: true, riot: true, n: e.members.length, noun: ' rioters' }; LAB.reset();
    g.horde.start({ mode: 'riot', riot: e, level: true, hitK: 1 + 0.05 * this.ix, onEnd: (won, H) => { this.round.horde = H; if (won) e.end(true); this.finish(won, won ? null : 'The mob got the better of you'); } });
    this.rep = document.createElement('div'); this.rep.id = 'zd-rep'; document.body.appendChild(this.rep);
    g.toast ? g.toast('Defend ' + PLACES[key].name + ': a riot of ' + e.members.length + '. Knock them flat and they go home') : 0;
  }
  zombieNight() { return false; } // Sean's levels are played in the daylight: the zombies' night made everything too dark to see
  placeNow() { try { return new URLSearchParams(location.search).get('place') || null; } catch (e) { return null; } }
  update() {
    const R = this.round; if (!R || R.ended) return; const F = this.g.flight, S = LAB.stats; R.t += 1 / 60; if (!this.squad) this.squad = new Squad(this); this.squad.step(1 / 60); if (R.ended) return;
    if (this.g.base && this.g.base.level === this) { if (this.rep) this.rep.style.display = 'none'; return; } // in the lair: nothing ends till you come out
    if (R.zombie) { const H = this.g.horde; if (!H.active && !H.flying) return this.finish(false, 'You left the town'); if (R.riot && R.evs[0] && !R.evs[0].alive && !H.over) { H.finish(true); return; } if (R.boss && (R.boss.heroHp <= 0 || !R.boss.alive) && !H.over) { if (!R.ctrl) { R.ctrl = H.ctrlMake(R.boss); R.ctrlAt = performance.now() + 2000; if (R.boss.alive) endDisaster(R.boss); R.noun = ' to beat'; } if (R.ctrl.gone) { H.finish(true); return; } if (R.ctrlAt && performance.now() > R.ctrlAt) { R.ctrlAt = 0; if (H.genFree()) H.genFight(R.ctrl); } return; } this.rep.style.display = 'none'; this.rep.innerHTML = 'Hero · ' + H.left + R.noun + '<div class="bar"><i style="width:' + Math.max(0, 100 - H.left / R.n * 100) + '%"></i></div>'; return; }
    const live = R.evs.filter(e => e.alive && (e.type !== 'villains' || e.who.some(w => !w.gone && !w.beaten))).length;
    const fear = LAB.fear(), rep = R.hero ? Math.max(0, Math.min(100, this.s.rep - fear / 30)) : 0;
    this.rep.innerHTML = R.hero ? REP(rep) + (live ? ' · ' + live + ' to stop' : '') + '<div class="bar"><i style="width:' + rep + '%"></i></div>' : S.buildings + '/' + R.need + ' buildings<div class="bar"><i style="width:' + Math.min(100, S.buildings / R.need * 100) + '%"></i></div>'; if (F.storm && F.storm.ready && (F.storm.war || F.storm.e.alive)) this.rep.innerHTML = F.storm.label() + '<div class="bar"><i style="width:' + F.storm.pct() + '%"></i></div>';
    const down = F.state === 'down' && !F.downAt; if (down && !R.wasDown) R.downs++; R.wasDown = down;
    this.rep.style.display = F.fighting ? 'none' : ''; if (F.fighting) return; // on foot, in the fight (flight.js fightFoe); the bars say it
    if (!F.active) return this.finish(false, 'You left the town');

    if (R.t > 1 && (R.hero ? live === 0 : (F.storm && F.storm.war ? F.storm.score >= F.storm.goal : S.buildings >= R.need) && live === 0)) this.finish(true);
  }
  // over the line: a hero under 15 becomes a villain (now picked under Destroy), a villain at 60 a hero (Defend). Returns the line for the tally
  cross(s) { const n = HS.shown(s.flyer); if (s.side === 'hero' && s.rep < 15) { s.side = 'villain'; s.rep = 14; return '<br><b style="color:#ff8a7a">' + n + ' has gone too far: now a villain. You will find them under Destroy</b>'; } if (s.side === 'villain' && s.rep >= 60) { s.side = 'hero'; s.rep = 60; return '<br><b style="color:#6cff8a">' + n + ' has done too much good: now a hero. You will find them under Defend</b>'; } return ''; }
  finish(won, why) {
    { const F0 = this.g.flight, H0 = this.g.horde; this.homeAt = F0 && F0.active ? [F0.pos.x, F0.pos.y, F0.pos.z] : H0 && H0.active && H0.h ? [H0.h.x, H0.h.y, H0.h.z] : null; } // where the flight home starts (flyHome)
    const R = this.round, s = this.s, S = LAB.stats, F = this.g.flight, g = this.g; R.ended = true; if (this.squad) { this.squad.end(); this.squad = null; } if (F.storm) { if (F.storm.war) R.score = F.storm.score; F.storm.dispose(); F.storm = null; } const fear = LAB.fear(); if (this.rep) { this.rep.remove(); this.rep = null; }
    if (R.zombie) {
      const H = R.horde || g.horde, xp = won ? 300 + (R.boss ? 300 : H.kills) + (H.bitten < 10 ? 100 : 0) : 20 + Math.round(H.kills / 4); if (g.base && g.base.active) { g.base.level = null; g.base.stop(true); } if (H.active) H.stop(true); if (H.flying) { H.flying = false; if (H.el) H.el.remove(); if (g.flight.active) g.flight.stop(true); }
      for (const e of R.evs) if (e.alive) endDisaster(e); g.flight.heroGame = false; if (this.labWas) Object.assign(LAB, this.labWas, { spotK: 1, toughK: 1, powerK: 1, energyK: 1, teamK: 1 });
      const lv0 = this.level, was = s.rep, fear2 = LAB.fear(); s.xp += xp; this.shareXp(xp); if (won) s.threat = Math.min(100, (s.threat || 0) + 20); const up = this.level - lv0; if (won) s.idx = Math.min(WAVES.length - 1, s.idx + 1); s.towns[R.key] = { won: (s.towns[R.key] && s.towns[R.key].won) || won, fear: Math.round(fear2) }; s.rep = Math.max(0, Math.min(100, s.rep + (won ? 6 : 0) - fear2 / 30)); const cross = this.cross(s); HS.save(); this.round = null; g.heroGo = false;
      this.ended(won, '<b>' + (won ? 'TOWN SAVED' : (why || 'NOT THIS TIME')) + '</b> · +' + xp + ' XP' + (up ? ' · <b>LEVEL UP!</b> A skill point to spend' : '') + '<br>' + (R.boss ? 'Hit ' + H.bitten.toFixed(0) + ' times' : (R.noun.trim() + ' down ' + H.kills + ' · hit ') + H.bitten + ' times') + ' · ' + Math.round(H.time) + ' s · reputation ' + Math.round(was) + ' to ' + Math.round(s.rep) + cross); return;
    }
    F.onStopped = null; for (const e of R.evs) if (e.type === 'villains') for (const w of e.who) { if (w.beaten && !s.trophies.includes(w.name)) s.trophies.push(w.name); }
    if (won && R.hero && this.threat && !S.stopped && !S.won) { won = false; why = 'It passed without you'; } // it ended by itself: nobody stopped it, nothing is won, and the city is still yours to try
    let xp = 0, lines = [];
    if (R.hero) { const was = s.rep; xp = won ? Math.max(50, 200 + 100 * this.ix + (S.stopped || 0) * 60 + S.won * 80 + S.saved * 30 - Math.round(fear / 4)) : 25; const gain = won ? 6 : 0; s.rep = Math.max(0, Math.min(100, s.rep + gain - fear / 30)); if (R.hunted && !won) { s.rep = Math.min(100, s.rep + 15); xp = 0; lines.push('The heroes beat you. You wake in the tower, and it is a lesson'); } lines.push('Reputation ' + Math.round(was) + ' to ' + Math.round(s.rep) + ': ' + REP(s.rep)); s.towns[R.key] = { won: (s.towns[R.key] && s.towns[R.key].won) || won, fear: Math.round(fear) }; if (R.hunted && won) lines.push('You beat the heroes. This town now lives in fear of you'); }
    else { const was = s.rep, good = (S.stopped || 0) * 35 + S.saved * 2; s.rep = Math.max(0, Math.min(100, s.rep + good - (won ? 3 : 0))); lines.push('Reputation ' + Math.round(was) + ' to ' + Math.round(s.rep) + (good ? ': the town noticed the good you did' : '')); xp = won ? 200 + 100 * this.ix + S.buildings * 15 + S.won * 100 : 10 + S.buildings * 5; s.towns[R.key] = { won: (s.towns[R.key] && s.towns[R.key].won) || won, fear: Math.round(fear) }; }
    const lv0 = this.level; s.xp += xp; this.shareXp(xp); if (won) s.threat = Math.min(100, (s.threat || 0) + (R.zombie ? 20 : 25)); const up = this.level - lv0; if (won) s.idx = Math.min(WAVES.length - 1, s.idx + 1); { const cross = this.cross(s); if (cross) lines.push(cross.replace('<br>', '')); } HS.save();
    if (F.active) F.stop(true);
    for (const e of R.allies || []) if (e.alive) endDisaster(e);
    F.heroGame = false; F.inLevel = false; Object.assign(LAB, this.labWas, { spotK: 1, toughK: 1, powerK: 1, energyK: 1, teamK: 1 });
    for (const e of R.evs) { if (!e.alive) continue; if (e.own) { e.alive = false; if (e.cleanup) { e.cleanup(); e.cleanup = null; } continue; } if (e.type === 'villains') { for (const w of e.who) if (!w.gone) { w.state = 'gone'; w.rig.root.visible = false; } } else endDisaster(e); } // what is left of the trouble goes with you
    if (R.score != null) lines.unshift('Score ' + Math.round(R.score)); const head = won ? (R.hero ? 'TOWN SAVED' : 'TOWN WRECKED') : (why || 'NOT THIS TIME');
    this.round = null; this.ended(won, '<b>' + head + '</b> · +' + xp + ' XP' + (up ? ' · <b>LEVEL UP!</b> A skill point to spend' : '') + '<br>Buildings down ' + S.buildings + ' · people scared ' + S.scared + ' · hurt ' + S.hurt + ' · saved ' + S.saved + ' · fear ' + Math.round(fear) + (lines.length ? '<br>' + lines.join('<br>') : ''));
  }
}
