// The powers menu (Sean, 2026-11-04): a scroll wheel like the name's under each fighting type, one set for each fighter. Locked picks show the level they open at; a wheel left on one keeps what was picked before. In the Sandbox everything is open.
import { SLOTS, SLOT_NAME, loadKit, saveKit, opensAt, isOpen } from './kit.js';
import { HS, levelOf } from './herogame.js';

const CSS = `.zd-kp{font:600 12px/1.35 system-ui,sans-serif;color:#fff}
.zd-kp .who{display:flex;gap:6px;margin:0 0 8px}#zd-base .panel .zd-kp .who button,.zd-kp .who button{flex:1 1 0;min-width:0;min-height:44px;padding:6px 3px;border:2px solid rgba(255,255,255,.25);border-radius:12px;background:#2c2342;color:#fff;font:800 12px/1.15 system-ui,sans-serif;box-shadow:none;overflow:hidden;text-overflow:ellipsis}#zd-base .panel .zd-kp .who button.on,.zd-kp .who button.on{border-color:#ffe27a;background:#4a2f7a}.zd-kp .who small{display:block;font:700 10px/1.1 system-ui,sans-serif;opacity:.8;margin-top:2px}
.zd-kp .role{margin:0 0 8px;font-size:12px;opacity:.9}#zd-base .panel .zd-kp .role button,.zd-kp .role button{display:block;width:100%;min-height:44px;margin-top:6px;padding:8px;font:800 13px system-ui,sans-serif;border:0;border-radius:12px;background:linear-gradient(#ffc233,#d9860e);color:#2a1038;box-shadow:none}
.zd-kp .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 8px}.zd-kp .cell.wide{grid-column:1 / 3}.zd-kp .lb{font:800 11px/1.2 system-ui,sans-serif;letter-spacing:.04em;text-transform:uppercase;color:#ffe27a;margin-bottom:4px}
.zd-kp .wheel{height:114px;overflow-y:scroll;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;scroll-snap-type:y mandatory;touch-action:pan-y;border-radius:10px;background:linear-gradient(rgba(0,0,0,.65),rgba(255,255,255,.08) 42%,rgba(255,255,255,.08) 58%,rgba(0,0,0,.65));box-shadow:inset 0 0 0 1px rgba(255,255,255,.18);scrollbar-width:none}.zd-kp .wheel::-webkit-scrollbar{display:none}
.zd-kp .wheel i{display:block;height:38px;font:700 12px/38px system-ui,sans-serif;font-style:normal;color:#fff;opacity:.45;scroll-snap-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 6px;cursor:pointer;text-align:center}.zd-kp .wheel i.on{opacity:1;color:#ffe27a;font-size:13px}.zd-kp .wheel i.lock{color:#b7aec8}.zd-kp .wheel i.lock.on{color:#ff9a7a}.zd-kp .wheel b{display:block;height:38px}
.zd-kp .bl{min-height:44px;margin-top:4px;font:500 11px/1.3 system-ui,sans-serif;opacity:.85}.zd-kp .bl.no{color:#ff9a7a;opacity:1}`;
let styled = false;
const H = 38;
// one fighter's wheels, into host
export function kitWheels(host, who, level) {
  if (!styled) { styled = true; const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); }
  const K = loadKit(who), list = (slot) => Object.keys(SLOTS[slot]), open = (slot, id) => isOpen(who, slot, id, level);
  host.innerHTML = '<div class="grid">' + Object.keys(SLOT_NAME).map((slot) => '<div class="cell' + (slot === 'melee' ? ' wide' : '') + '"><div class="lb">' + SLOT_NAME[slot] + '</div><div class="wheel" data-s="' + slot + '"><b></b>' + list(slot).map((id) => { const o = SLOTS[slot][id], ok = open(slot, id); return '<i data-id="' + id + '"' + (ok ? '' : ' class="lock"') + '>' + (ok ? o.icon + ' ' + o.name : '🔒 Lv ' + opensAt(slot, id) + ' ' + o.name) + '</i>'; }).join('') + '<b></b></div><div class="bl"></div></div>').join('') + '</div>';
  const W = {}, say = (slot, id) => { const o = SLOTS[slot][id], e = W[slot].bl, ok = open(slot, id); e.classList.toggle('no', !ok); e.textContent = ok ? o.blurb + (o.cost ? ' (' + o.cost + ' power)' : '') : 'Opens at level ' + opensAt(slot, id) + '. ' + o.blurb + ' Still using ' + SLOTS[slot][K[slot]].name + '.'; };
  const mark = (slot, i) => { const q = W[slot]; if (q.i === i) return; if (q.on) q.on.classList.remove('on'); q.i = i; q.on = q.items[i]; if (q.on) q.on.classList.add('on'); say(slot, list(slot)[i]); };
  const to = (slot, id, smooth) => { const q = W[slot], i = Math.max(0, list(slot).indexOf(id)); mark(slot, i); if (smooth && q.el.scrollTo) q.el.scrollTo({ top: i * H, behavior: 'smooth' }); else q.el.scrollTop = i * H; };
  const pick = (slot, id) => { if (!open(slot, id) || K[slot] === id) return; const other = slot === 'fin1' ? 'fin2' : slot === 'fin2' ? 'fin1' : null, was = K[slot]; if (other && K[other] === id) { K[other] = was; quiet = performance.now() + 500; to(other, was, true); } K[slot] = id; saveKit(who, { [slot]: K[slot], ...(other ? { [other]: K[other] } : {}) }); };
  let quiet = 0;
  for (const slot of Object.keys(SLOT_NAME)) { const el = host.querySelector('[data-s="' + slot + '"]'), q = W[slot] = { el, items: Array.from(el.querySelectorAll('i')), i: -1, on: null, bl: el.parentElement.querySelector('.bl') }; let T = 0; el.addEventListener('scroll', () => { if (performance.now() < quiet) return; const i = Math.max(0, Math.min(q.items.length - 1, Math.round(el.scrollTop / H))); mark(slot, i); clearTimeout(T); T = setTimeout(() => pick(slot, list(slot)[q.i]), 120); }, { passive: true }); el.addEventListener('click', (e) => { const it = e.target.closest('i'); if (!it) return; to(slot, it.dataset.id, true); pick(slot, it.dataset.id); }); for (const ev of ['pointerdown', 'pointermove', 'pointerup']) el.addEventListener(ev, (e) => e.stopPropagation()); }
  quiet = performance.now() + 80; for (const slot of Object.keys(SLOT_NAME)) to(slot, K[slot], false);
}
// the whole panel: who, their part in the team, their wheels, and whatever else the caller adds for them. o: side, sandbox, sel, onSel(id), onMain(), extra(host, id)
export function kitPanel(host, o) {
  if (!styled) { styled = true; const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); }
  host.classList.add('zd-kp');
  const draw = () => { const D = HS.load(), team = HS.team(o.side), main = HS.cur(o.side), sel = o.sel = team.includes(o.sel) ? o.sel : main, lv = levelOf(D.chars[sel].xp), name = HS.shown(sel), K = loadKit(HS.name(sel));
    host.innerHTML = '<div class="who">' + team.map((id) => '<button type="button" data-who="' + id + '"' + (id === sel ? ' class="on"' : '') + '>' + (id === main ? '★ ' : '') + HS.shown(id) + '<small>' + (id === main ? 'Main' : 'Alternate') + ' · Lv ' + levelOf(D.chars[id].xp) + '</small></button>').join('') + '</div><div class="role">' + (o.sandbox ? 'Everything is open in the Sandbox. ' : '') + (sel === main ? name + ' is your main.' : name + ' is an alternate: TEAM calls them in, and they use their stun' + (SLOTS.stun[K.stun].self ? ', putting ' + SLOTS.stun[K.stun].name + ' on your main instead of attacking.' : ' on your enemy.') + '<button type="button" data-main>Make ' + name + ' your main</button>') + '</div><div class="wh"></div><div class="xt"></div>';
    kitWheels(host.querySelector('.wh'), HS.name(sel), o.sandbox ? 99 : lv);
    host.querySelectorAll('[data-who]').forEach((b) => { b.onclick = () => { o.sel = b.dataset.who; if (o.onSel) o.onSel(o.sel); draw(); }; });
    const m = host.querySelector('[data-main]'); if (m) m.onclick = () => { D.last[o.side] = sel; HS.save(); if (o.onMain) o.onMain(sel); draw(); };
    if (o.extra) o.extra(host.querySelector('.xt'), sel, draw); };
  draw();
}
