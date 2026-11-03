// Test levels (Sean): in the Sandbox, every Defend and Destroy level to pick from, each with its code, map and enemies, so he can say which work.
// A test run changes nothing in the story: the fighter is put back as they were when it ends (HeroGame.hub), or the next time a story mode starts
// if the page was closed halfway. Afterwards this list comes back, with how the run went.
import { PATH, PLACES, placeKey } from './places.js';
import { WAVES, VILLAINS, HS } from './herogame.js';

const NAME = { aliens: 'Alien invasion', zombies: 'Zombies', worm: 'Giant worm', kaiju: 'Kaiju', tornado: 'Tornado', riot: 'Riot', flood: 'Flood', quake: 'Earthquake', haboob: 'Dust storm', plant: 'Killer plant', volcano: 'Volcano', tsunami: 'Tsunami', rift: 'Dimensional rift', sinkhole: 'Sinkhole', blackhole: 'Black hole', spill: 'Toxic spill', coldwave: 'Cold wave' };
const WEATHER = { tornado: 1, flood: 1, haboob: 1, tsunami: 1, coldwave: 1 };
const CSS = '#zd-levels{position:fixed;inset:0;z-index:70;overflow-y:auto;background:rgba(14,10,28,.96);color:#f4eee4;font:13px/1.35 system-ui,sans-serif;padding:14px 12px calc(20px + env(safe-area-inset-bottom));box-sizing:border-box}#zd-levels .ttl{font:900 20px system-ui,sans-serif;letter-spacing:.04em}#zd-levels .msg{margin:8px 0;padding:8px 10px;border-radius:10px;background:rgba(255,255,255,.1)}#zd-levels .tabs{display:flex;gap:8px;margin:10px 0}#zd-levels button{font:inherit;color:#fff;border:0;cursor:pointer}#zd-levels .tabs button{flex:1;padding:12px 0;border-radius:12px;font-weight:900;background:#3a2f5a}#zd-levels .tabs button.on{background:linear-gradient(180deg,#ff5ad5,#a52a8a)}#zd-levels .tabs button.on.g{background:linear-gradient(180deg,#3ccf6a,#1f7a3e)}#zd-levels .tabs button.on.r{background:linear-gradient(180deg,#ff5a4a,#a5281e)}#zd-levels .lv{display:block;width:100%;text-align:left;margin:0 0 8px;padding:9px 11px;border-radius:12px;background:#2b2244}#zd-levels .lv.last{outline:2px solid #ffd27a}#zd-levels .lv b{font-size:14px}#zd-levels .lv i{float:right;font-style:normal;font-weight:900;color:#ffd27a}#zd-levels .lv span{display:block;opacity:.85;font-size:12px}#zd-levels .wx{color:#9fd4ff}#zd-levels .out{width:100%;padding:12px 0;margin:4px 0 10px;border-radius:12px;font-weight:800;background:#3a2f5a}';
const list = (a) => a.filter(Boolean).join(', ') || 'none';
const hasVillain = (id) => HS.load().chars[id] && HS.load().chars[id].side === 'villain';
// a level's numbers, the same rules as HeroGame.start
export function levelInfo(side, i) {
  const wave = WAVES[i % WAVES.length], key = PATH[i % PATH.length], map = PLACES[key].name, hero = side === 'hero', one = wave.length === 1, w0 = wave[0];
  const wx = wave.some(w => WEATHER[w]), code = (hero ? 'D' : 'X') + (i + 1), title = wave.map(w => NAME[w] || HS.name(w)).join(' + ');
  if (hero) {
    const foot = w0 === 'aliens' || w0 === 'zombies' || (one && (w0 === 'worm' || w0 === 'kaiju' || w0 === 'riot')), bad = wave.map(w => VILLAINS.includes(w) ? (hasVillain(w) ? HS.name(w) : null) : NAME[w] || w);
    if (w0 === 'aliens') bad.push('saucers, tripods, alien generals'); if (w0 === 'zombies') bad.push('zombie generals');
    if (!foot && w0 !== 'tornado' && i >= 4 && i % 3 === 1) bad.push('the army');
    return { code, title, map, wx, foes: 'Enemies: ' + list(bad), how: foot ? 'On foot and in the air: clear them out' : w0 === 'tornado' ? 'Flying: Lock on to unwind it' : WEATHER[w0] ? 'Flying: Lock on to each glowing spot, tap in the green' : 'Flying: stop what is hitting the town' };
  }
  const heroes = ['nova', 'dragonfly', 'tempo'].filter(id => HS.load().chars[id] && HS.load().chars[id].side === 'hero').slice(0, Math.min(3, 1 + Math.floor(i / 3))).map(id => HS.name(id));
  return { code, title: wave.filter(w => !VILLAINS.includes(w)).map(w => NAME[w] || w).join(' + '), map, wx, foes: 'Enemies: ' + list([...heroes, i >= 2 ? 'the army' : null]), how: 'On your side: ' + list(wave.filter(w => !VILLAINS.includes(w)).map(w => NAME[w] || w)) + '. Goal: bring down ' + (25 + 15 * i) + ' buildings (at most 60% of the town) and beat the heroes' };
}
export function restoreTests() { const D = HS.load(); for (const c of Object.values(D.chars)) if (c.testWas) { const was = JSON.parse(c.testWas); delete c.testWas; Object.assign(c, was); } HS.save(); }
function play(g, side, i) {
  document.getElementById('zd-levels').remove(); restoreTests();
  const s = HS.load()[side]; s.testWas = JSON.stringify(s); s.idx = i; HS.save(); g.testRun = { side, i };
  if (g.base && g.base.active) { g.base.level = null; g.base.hubBack = null; g.base.stop(true); } if (g.flight && g.flight.active) g.flight.stop(true);
  const key = PATH[i % PATH.length]; if (g.moveWorld && key !== placeKey()) g.moveWorld(key, side); g.heroGo = true; g.startMode(side); // the world first: a level that moved it from inside the new mode would leave game.js holding the wrong one
}
export function openLevels(g, o = {}) {
  if (!document.getElementById('zd-levels-css')) { const c = document.createElement('style'); c.id = 'zd-levels-css'; c.textContent = CSS; document.head.appendChild(c); }
  const old = document.getElementById('zd-levels'); if (old) old.remove();
  const el = document.createElement('div'); el.id = 'zd-levels'; document.body.appendChild(el); let side = o.side || 'hero';
  const draw = () => {
    const L = WAVES.map((w, i) => { const q = levelInfo(side, i); return '<button type="button" class="lv' + (o.last === i && o.side === side ? ' last' : '') + '" data-lv="' + i + '"><i>' + q.code + '</i><b>' + q.title + '</b>' + (q.wx ? ' <b class="wx">weather</b>' : '') + '<span>Map: ' + q.map + '</span><span>' + q.foes + '</span><span>' + q.how + '</span></button>'; }).join('');
    const who = HS.load()[side];
    el.innerHTML = '<div class="ttl">TEST LEVELS</div>' + (o.msg ? '<div class="msg"><b>' + o.code + '</b> ' + o.msg + '</div>' : '') + '<div style="opacity:.8;margin-top:4px">Pick any level. Nothing here changes your story. Tell Claude the code of any that do not work. Fighting as ' + HS.shown(who.flyer) + '.</div><div class="tabs"><button type="button" class="g' + (side === 'hero' ? ' on' : '') + '" data-side="hero">Defend</button><button type="button" class="r' + (side === 'villain' ? ' on' : '') + '" data-side="villain">Destroy</button></div><button type="button" class="out" data-close>' + (o.msg ? 'Back to the Sandbox' : 'Close') + '</button>' + L;
    el.querySelectorAll('[data-side]').forEach(b => { b.onclick = () => { side = b.dataset.side; o.msg = o.msg; draw(); el.scrollTop = 0; }; });
    el.querySelectorAll('[data-lv]').forEach(b => { b.onclick = () => play(g, side, +b.dataset.lv); });
    el.querySelector('[data-close]').onclick = () => { if (o.msg) location.href = location.pathname + '?mode=sandbox'; else el.remove(); };
  };
  draw();
}
