// Mixed disasters (Be The Disaster): a third of the way into a run a second
// disaster joins in. Three to pick from, a few seconds to choose (or one is picked
// for you); it runs on its own near the action while you go on driving yours.
import { sfx } from './audio.js';

const CSS = `
#zd-mix{position:fixed;left:0;right:0;bottom:calc(var(--zd-bar-h, 64px) + 12px);z-index:8;display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:none;
  font:700 12px/1.1 system-ui,-apple-system,"Segoe UI",sans-serif;color:#f6ead2}
#zd-mix[hidden]{display:none}
#zd-mix .t{background:rgba(28,20,12,.82);padding:6px 11px;border-radius:12px;letter-spacing:.03em}
#zd-mix .t b{color:#ffb070;font-variant-numeric:tabular-nums}
#zd-mix .row{display:flex;gap:8px;pointer-events:auto}
#zd-mix button{appearance:none;border:1px solid rgba(255,236,200,.32);background:rgba(36,26,14,.93);color:#f6ead2;border-radius:12px;width:98px;padding:9px 4px 8px;
  font:700 11.5px/1.15 system-ui,-apple-system,"Segoe UI",sans-serif;display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;animation:zdmix .35s ease-out backwards}
#zd-mix button:nth-child(2){animation-delay:.07s}#zd-mix button:nth-child(3){animation-delay:.14s}
#zd-mix button .e{font-size:24px;line-height:1}
#zd-mix button:active{transform:scale(.95)}
@keyframes zdmix{from{opacity:0;transform:translateY(18px) scale(.9)}}
`;

export const EXTRA = {
  tornado: { name: 'Tornado', e: '\u{1F32A}️', say: 'Tornado incoming!' },
  quake: { name: 'Earthquake', e: '\u{1F3DA}️', say: 'Earthquake!' },
  meteor: { name: 'Meteor shower', e: '☄️', say: 'Meteor shower!' },
  sinkhole: { name: 'Sinkhole', e: '\u{1F573}️', say: 'Sinkhole!' },
  lightning: { name: 'Lightning storm', e: '⚡', say: 'Lightning storm!' },
};
const OFFER_AT = 30, CHOOSE = 7; // s into the run; s to choose

// lightning on the roofs round the action for a while: each strike may set a roof alight
class Lightning {
  constructor(D, at, life = 26) { this.type = 'lightning'; this.D = D; this.at = at; this.t = 0; this.life = life; this.alive = true; this.next = 0.6; D.weather.set('storm'); }
  update(h) {
    this.t += h; if (this.t > this.life) { this.alive = false; return; }
    if ((this.next -= h) > 0) return;
    this.next = 0.3 + Math.random() * 0.5;
    const D = this.D, city = D.ctx.city, p = this.at(), ks = [];
    city.buildingsNear(p.x, p.z, 130, (k) => { if (!city.dead[k]) ks.push(k); });
    if (!ks.length) return;
    const b = city.buildings[ks[Math.floor(Math.random() * ks.length)]];
    D.strike((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2); // on a roof, never the street
  }
  sync() {} dispose() {}
}

// start one of them near (x, z), the action: kind from EXTRA. at(): where the action is now (lightning follows it);
// extra: it joins a player's run
export function startExtra(D, kind, x, z, at, extra = false) {
  const B = D.ctx.city.bounds, M = 60, clamp = (v, a, b) => Math.max(a + M, Math.min(b - M, v));
  const near = (r0, r1) => { const a = Math.random() * 6.28, r = r0 + Math.random() * (r1 - r0); return [clamp(x + Math.cos(a) * r, B.x0, B.x1), clamp(z + Math.sin(a) * r, B.z0, B.z1)]; };
  const mark = (ev) => { if (ev && extra) ev.extra = true; return ev; }; // a player's run scores at a capped rate while it is loose (be.js)
  if (kind === 'tornado') { const [px, pz] = near(130, 180); return mark(D.start('tornado', px, pz, { size: 1.5, life: 45 })); }
  if (kind === 'quake') { const [px, pz] = near(40, 90); return mark(D.start('quake', px, pz, { mag: 6.9 })); }
  if (kind === 'sinkhole') { const [px, pz] = near(50, 100); return mark(D.start('sinkhole', px, pz, { size: 22 })); }
  if (kind === 'meteor') { for (let i = 0; i < 3; i++) D.later(i * 3, () => { const [px, pz] = near(20, 110); mark(D.start('meteor', px, pz, { size: 11 + Math.random() * 6, warn: 4, quiet: i > 0, mushroom: i === 0 })); }); return null; }
  if (kind === 'lightning') { const ev = mark(new Lightning(D, at || (() => ({ x, z })))); D.list.push(ev); return ev; }
  return null;
}

export class Mix {
  // be: the Be The Disaster mode (its kind, where its disaster is, its hits for the big words)
  constructor(be) {
    this.be = be;
    if (!document.getElementById('zd-mix-css')) { const s = document.createElement('style'); s.id = 'zd-mix-css'; s.textContent = CSS; document.head.appendChild(s); }
    const el = this.el = document.createElement('div'); el.id = 'zd-mix'; el.hidden = true;
    el.innerHTML = '<div class="t">Add a second disaster <b></b></div><div class="row"></div>';
    document.body.appendChild(el); this.cd = el.querySelector('.t b'); this.row = el.querySelector('.row');
    this.reset();
  }
  reset() { this.offered = false; this.open = false; this.chosen = null; this.el.hidden = true; }
  dispose() { this.el.remove(); }

  // each frame, with the run's clock
  step(t) {
    if (!this.offered && t >= OFFER_AT) this.offer(t);
    if (!this.open) return;
    const left = Math.max(0, this.deadline - t); this.cd.textContent = Math.ceil(left);
    if (left <= 0) this.choose(this.opts[Math.floor(Math.random() * this.opts.length)]); // too slow: one for you
  }

  offer(t) {
    this.offered = true; this.open = true; this.deadline = t + CHOOSE;
    const all = Object.keys(EXTRA).filter(k => k !== this.be.kind);
    for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
    this.opts = all.slice(0, 3);
    this.row.innerHTML = '';
    for (const k of this.opts) {
      const b = document.createElement('button'); b.type = 'button';
      b.innerHTML = '<span class="e">' + EXTRA[k].e + '</span><span>' + EXTRA[k].name + '</span>';
      b.addEventListener('pointerdown', (e) => e.stopPropagation());
      b.onclick = (e) => { e.stopPropagation(); this.choose(k); };
      this.row.appendChild(b);
    }
    this.el.hidden = false;
  }

  choose(kind) {
    if (!this.open) return;
    this.open = false; this.el.hidden = true; this.chosen = kind;
    const be = this.be, p = be.at();
    startExtra(be.D, kind, p.x, p.z, () => be.at(), true); be.mixT = 12; // the meteors are still on their way
    be.hits.say(EXTRA[kind].say);
    const tg = be.g.controls.target; sfx('stinger', tg.x, 0, tg.z);
  }
}
