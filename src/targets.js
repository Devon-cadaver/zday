// Three targets in each town for Be The Disaster: its landmarks first (not the
// glass skyscraper), then its tallest and its biggest buildings, well apart. A
// gold star marks each over the town; one out of view waits at the edge of the
// screen, pointing the way. Bringing one down scores a bonus and a star.
import * as THREE from 'three';
import { CURVE } from './curve.js';

const CSS = `
.zd-tg{position:fixed;left:0;top:0;z-index:5;pointer-events:none;display:flex;flex-direction:column;align-items:center;will-change:transform;
  font:800 10px/1.1 system-ui,-apple-system,"Segoe UI",sans-serif;color:#ffe08a;text-shadow:0 1px 2px rgba(0,0,0,.9),0 0 6px rgba(0,0,0,.5)}
.zd-tg .s{font-size:22px;line-height:1;color:#ffc233}
.zd-tg .n{white-space:nowrap;letter-spacing:.02em}
.zd-tg .a{display:none;font-size:13px;line-height:1;color:#ffc233}
.zd-tg.off .n{display:none}
.zd-tg.off .s{font-size:16px}
.zd-tg.off .a{display:block}
.zd-tg[hidden]{display:none}
.zd-stars b{color:#ffc233;letter-spacing:1px}
`;

export class Targets {
  constructor(g, pill) {
    this.g = g; this.pill = pill; this.list = []; this.v = new THREE.Vector3();
    if (!document.getElementById('zd-tg-css')) { const s = document.createElement('style'); s.id = 'zd-tg-css'; s.textContent = CSS; document.head.appendChild(s); }
  }

  // choose this town's three and mark them
  pick() {
    this.clear();
    const c = this.g.city, B = c.buildings, Bd = c.bounds, mid = (b) => [(b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2];
    const hgt = (k) => B[k].top - B[k].baseY, area = (k) => (B[k].x1 - B[k].x0) * (B[k].z1 - B[k].z0);
    const live = []; for (let k = 0; k < B.length; k++) if (!c.dead[k] && !B[k].landmark) live.push(k);
    const tall = live.slice().sort((a, b) => hgt(b) - hgt(a)).slice(0, 40), big = live.slice().sort((a, b) => area(b) - area(a)).slice(0, 40);
    const cand = [];
    for (let k = 0; k < B.length; k++) if (B[k].landmark && B[k].landmark !== 'Skyscraper' && !c.dead[k]) cand.push([k, B[k].landmark]);
    for (let i = 0; i < 40; i++) { if (tall[i] != null) cand.push([tall[i], 'tall']); if (big[i] != null) cand.push([big[i], 'big']); }
    const picks = [], span = Math.max(40, Math.min(Bd.x1 - Bd.x0, Bd.z1 - Bd.z0) * 0.22);
    for (const gap of [span, 20]) {
      for (const [k, kind] of cand) {
        if (picks.length >= 3) break;
        if (picks.some(p => p.k === k)) continue;
        const [x, z] = mid(B[k]); if (picks.some(p => Math.hypot(p.x - x, p.z - z) < gap)) continue;
        const name = kind === 'tall' ? (picks.some(p => p.name === 'Tallest building') ? 'High-rise' : 'Tallest building') : kind === 'big' ? (picks.some(p => p.name === 'Biggest building') ? 'Big block' : 'Biggest building') : kind;
        picks.push({ k, x, z, y: B[k].top + 6, name });
      }
      if (picks.length >= 3) break;
    }
    for (const p of picks) {
      const d = document.createElement('div'); d.className = 'zd-tg';
      d.innerHTML = '<span class="a">▲</span><span class="s">★</span><span class="n"></span>';
      d.querySelector('.n').textContent = p.name; document.body.appendChild(d);
      p.el = d; p.arrow = d.querySelector('.a'); p.done = false;
    }
    this.list = picks; this.show();
  }

  get got() { return this.list.filter(p => p.done).length; }
  show() { if (this.pill) this.pill.innerHTML = '★'.repeat(this.got) + '<span style="opacity:.3">' + '★'.repeat(Math.max(0, this.list.length - this.got)) + '</span>'; }

  // building k came down: the target it was, if it was one still standing
  hit(k) {
    const p = this.list.find(q => q.k === k && !q.done); if (!p) return null;
    p.done = true; p.el.hidden = true; this.show();
    return p;
  }

  clear() { for (const p of this.list) p.el.remove(); this.list = []; }
  dispose() { this.clear(); }

  // each frame: over the target, or at the edge of the screen pointing to it
  frame() {
    if (!this.list.length) return;
    const g = this.g, cam = g.camera, k = CURVE.k.value, c = CURVE.c.value, W = innerWidth, H = innerHeight, v = this.v;
    const top = 104, bot = H - 120, lo = 60, hi = W - 66, cx = W / 2, cy = (top + bot) / 2;
    for (const p of this.list) {
      if (p.done) continue;
      v.set(p.x, p.y - k * ((p.x - c.x) ** 2 + (p.z - c.y) ** 2), p.z).project(cam);
      let sx = (v.x + 1) / 2 * W, sy = (1 - v.y) / 2 * H;
      const behind = v.z > 1;
      if (behind) { sx = W - sx; sy = H - sy; } // behind the camera: the way to turn is the other way
      const off = behind || sx < lo || sx > hi || sy < top || sy > bot;
      if (off) { // along the line from the middle of the view to it, stopped at the edge
        const dx = sx - cx, dy = sy - cy, t = Math.min(dx ? (dx > 0 ? hi - cx : lo - cx) / dx : 1e9, dy ? (dy > 0 ? bot - cy : top - cy) / dy : 1e9);
        sx = cx + dx * t; sy = cy + dy * t;
        p.arrow.style.transform = 'rotate(' + (Math.atan2(dy, dx) * 180 / Math.PI + 90).toFixed(1) + 'deg)';
      }
      p.el.classList.toggle('off', off);
      p.el.style.transform = 'translate3d(' + sx.toFixed(1) + 'px,' + sy.toFixed(1) + 'px,0) translate(-50%,-50%)';
    }
  }
}
