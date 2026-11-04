// The story's map (Sean): the globe turning slowly with the disasters on it, tap one to see it, Play to fly down. The same map behind Defend and Destroy on the menu
// and on the Map station in the base, where it sits in a screen's frame. globe.js draws the markers; this is the card, the fighter and the frame.
import { PLACES } from './places.js';
import { HS, levelOf } from './herogame.js';
import { board, clearFresh, danger, setCurrent, threatName, partnerOf, iconOf, colourOf, VILLAIN_IDS } from './threats.js';

const CSS = `
#zd-map{position:fixed;left:0;right:0;top:0;bottom:0;z-index:42;pointer-events:none;font-family:system-ui,-apple-system,sans-serif;color:#fff}
#zd-map>*{pointer-events:auto}
body.zd-map-on #zd-hub{z-index:70}
#zd-map .who{position:absolute;left:10px;top:calc(58px + env(safe-area-inset-top));min-height:44px;padding:4px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.3);background:rgba(16,14,30,.85);color:#fff;font:800 12px/1.2 system-ui,sans-serif;text-align:left}
#zd-map .who small{display:block;font-weight:600;opacity:.75}
#zd-map .card{position:absolute;left:12px;right:12px;bottom:calc(70px + env(safe-area-inset-bottom));max-width:440px;margin:0 auto;padding:12px;border-radius:16px;background:rgba(16,14,30,.94);border:2px solid var(--c);box-shadow:0 0 22px var(--c);display:none}
#zd-map .card.show{display:block}
#zd-map .card .x{position:absolute;right:6px;top:6px;width:44px;height:44px;border:0;background:none;color:#fff;font:900 18px system-ui}
#zd-map .card .top{display:flex;gap:10px;align-items:center;padding-right:36px}
#zd-map .card .ic{flex:none;width:52px;height:52px;border-radius:50%;background:var(--c);padding:6px;box-sizing:border-box}
#zd-map .card b{display:block;font:900 17px/1.15 system-ui,sans-serif}
#zd-map .card span{display:block;font:700 13px system-ui,sans-serif;color:#ffd27a}
#zd-map .card p{margin:8px 0;font:500 12px/1.35 system-ui,sans-serif;opacity:.8}
#zd-map .card .go{width:100%;min-height:50px;border:0;border-radius:12px;color:#fff;font:900 16px system-ui,sans-serif;letter-spacing:.05em;background:linear-gradient(#ff5ad5,#a0168a)}
#zd-map.screen::before{content:'';position:absolute;left:0;right:0;top:0;bottom:0;pointer-events:none;border:10px solid #23283a;box-shadow:inset 0 0 40px rgba(60,220,255,.35);background:repeating-linear-gradient(0deg,rgba(120,220,255,.05) 0 2px,transparent 2px 5px)}
.zd-threat{background:none!important;border:0!important;padding:0!important;display:flex;flex-direction:column;align-items:center;font:800 11px system-ui,sans-serif!important;color:#fff!important;text-shadow:0 1px 3px #000,0 0 2px #000;min-width:58px;min-height:58px}
.zd-threat .ic{position:relative;width:42px;height:42px;padding:4px;box-sizing:border-box;border-radius:50%;background:var(--c);border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.6)}
.zd-threat .ic::after{content:'';position:absolute;left:-5px;top:-5px;right:-5px;bottom:-5px;border-radius:50%;border:3px solid var(--c);animation:zdtr 1.5s ease-out infinite}
.zd-threat .new{position:absolute;right:-12px;top:-7px;padding:1px 4px;border-radius:6px;background:#ffd23d;color:#2a1c00;font:900 9px system-ui;text-shadow:none}
.zd-threat em{font-style:normal;margin-top:3px;white-space:nowrap}
@keyframes zdtr{from{transform:scale(.85);opacity:.9}to{transform:scale(1.35);opacity:0}}
.a-bob{animation:zdbob 1.1s ease-in-out infinite alternate}.a-sway{animation:zdsway .7s ease-in-out infinite alternate;transform-origin:20px 34px}.a-spin{animation:zdspin 2.4s linear infinite;transform-origin:20px 20px}.a-shake{animation:zdshake .25s linear infinite alternate}.a-beam{animation:zdbeam .8s ease-in-out infinite alternate}
@keyframes zdbob{from{transform:translateY(-2px)}to{transform:translateY(2px)}}@keyframes zdsway{from{transform:rotate(-9deg)}to{transform:rotate(9deg)}}@keyframes zdspin{to{transform:rotate(360deg)}}@keyframes zdshake{from{transform:translate(-1px,1px)}to{transform:translate(1px,-1px)}}@keyframes zdbeam{from{opacity:.25}to{opacity:.7}}
`;
export const villainsLeft = () => VILLAIN_IDS.filter((id) => HS.load().chars[id] && HS.load().chars[id].side === 'villain');
// the map up on the globe. o: side, arrive(key) when it has flown down, back() for its back button, screen: in the base, whoFn(): change the fighter
export function openMap(g, o) {
  if (!document.getElementById('zd-map-css')) { const c = document.createElement('style'); c.id = 'zd-map-css'; c.textContent = CSS; document.head.appendChild(c); }
  const G = g.globe, side = o.side, hero = side === 'hero', B = board(side, villainsLeft()), level = () => levelOf(HS.load()[side].xp), fresh = B.fresh.slice(), byKey = {};
  for (const t of B.list) byKey[t.key] = t;
  const el = document.createElement('div'); el.id = 'zd-map'; if (o.screen) el.className = 'screen'; document.body.appendChild(el);
  const stop = () => { el.remove(); document.body.classList.remove('zd-map-on'); }; document.body.classList.add('zd-map-on');
  const drawWho = () => { let w = el.querySelector('.who'); if (!w) { w = document.createElement('button'); w.type = 'button'; w.className = 'who'; el.appendChild(w); } w.innerHTML = HS.shown(HS.cur(side)) + '<small>Level ' + level() + ' · change</small>'; w.onclick = () => o.whoFn && o.whoFn(drawWho); }; drawWho();
  const card = document.createElement('div'); card.className = 'card'; el.appendChild(card);
  const hide = () => { card.classList.remove('show'); G.controls.autoRotate = true; };
  const show = (key) => {
    const t = byKey[key]; if (!t) return; G.controls.autoRotate = false; card.style.setProperty('--c', colourOf(t.kind));
    card.innerHTML = '<button type="button" class="x" aria-label="Close">✕</button><div class="top"><div class="ic">' + iconOf(t.kind) + '</div><div><b>' + PLACES[key].name + '</b><span>' + threatName(t, side, (id) => HS.shown(id)) + (hero && partnerOf(t, villainsLeft()) ? ' + ' + HS.shown(partnerOf(t, villainsLeft())) : '') + ' · danger ' + danger(t, level()) + '</span></div></div><p>' + (PLACES[key].blurb || '') + '</p><button type="button" class="go">' + (hero ? 'FLY IN AND DEFEND IT' : 'FLY IN AND WRECK IT') + '</button>';
    card.classList.add('show'); card.querySelector('.x').onclick = hide;
    card.querySelector('.go').onclick = () => { setCurrent(side, t.id); clearFresh(side); stop(); G.threats = null; G.go(key); };
  };
  G.threats = { get: (key) => { const t = byKey[key]; return t ? { name: PLACES[key].name, kind: t.kind, colour: colourOf(t.kind), icon: iconOf(t.kind), isNew: fresh.includes(t.id) } : null; }, tap: show };
  G.choose({ title: o.screen ? 'MAP STATION' : hero ? 'DEFEND' : 'DESTROY', sub: 'Spin the planet, tap a city under attack', arrive: o.arrive, back: () => { stop(); G.threats = null; o.back(); }, spin: true });
  return { stop };
}
