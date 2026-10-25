// Player layer: tap a street to drop a zombie, outbreak counters, time speed,
// follow camera, reset.
import * as THREE from 'three';
import { ST } from './people.js';

const CSS = `
#zd-top{position:fixed;left:0;right:0;top:0;display:flex;gap:6px;align-items:center;flex-wrap:wrap;
  padding:calc(8px + env(safe-area-inset-top)) max(10px, env(safe-area-inset-right)) 0 max(10px, env(safe-area-inset-left));pointer-events:none;
  font:600 12px/1 system-ui,-apple-system,"Segoe UI",sans-serif;color:#f6ead2;letter-spacing:.04em}
.zd-pill{display:flex;gap:6px;align-items:baseline;background:rgba(28,20,12,.62);border:1px solid rgba(255,236,200,.14);
  border-radius:8px;padding:6px 9px;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}
.zd-pill b{font-size:15px;font-variant-numeric:tabular-nums;letter-spacing:0}
.zd-pill i{font-style:normal;font-size:10px;opacity:.75;text-transform:uppercase}
.zd-h b{color:#fff4e0}.zd-i b{color:#ffc233}.zd-z b{color:#a6ff4d}
#zd-clock{margin-left:auto;opacity:.8;font-variant-numeric:tabular-nums}
#zd-bar{position:fixed;left:0;right:0;bottom:0;display:flex;gap:8px;justify-content:center;
  padding:0 max(10px, env(safe-area-inset-right)) calc(10px + env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-left))}
.zd-btn{appearance:none;border:1px solid rgba(255,236,200,.18);background:rgba(28,20,12,.72);color:#f6ead2;border-radius:10px;
  font:700 12px/1 system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.06em;text-transform:uppercase;padding:11px 12px;
  backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);touch-action:manipulation;cursor:pointer;min-width:52px}
.zd-btn:active{transform:translateY(1px)}
.zd-btn:focus-visible{outline:2px solid #a6ff4d;outline-offset:2px}
#zd-drop{background:rgba(70,98,34,.85);border-color:rgba(166,255,77,.5);display:flex;gap:8px;align-items:center}
#zd-drop .n{background:#a6ff4d;color:#1d2a0e;border-radius:6px;padding:3px 6px;font-variant-numeric:tabular-nums}
#zd-drop.empty{background:rgba(28,20,12,.72);border-color:rgba(255,236,200,.18);opacity:.7}
#zd-find.on{border-color:#a6ff4d;color:#a6ff4d}
#zd-toast{position:fixed;left:50%;top:calc(52px + env(safe-area-inset-top));transform:translateX(-50%);max-width:min(88vw,420px);
  background:rgba(28,20,12,.8);color:#f6ead2;border:1px solid rgba(255,236,200,.16);border-radius:10px;padding:9px 12px;
  font:600 13px/1.35 system-ui,-apple-system,"Segoe UI",sans-serif;text-align:center;pointer-events:none;transition:opacity .4s;opacity:0}
#zd-fps{position:fixed;right:max(8px, env(safe-area-inset-right));bottom:calc(58px + env(safe-area-inset-bottom));font:10px system-ui,sans-serif;color:#f6ead2;opacity:.45;pointer-events:none}
@media (prefers-reduced-motion: reduce){#zd-toast{transition:none}}
`;

const START_DROPS = 3;

export class Game {
  constructor({ people, traffic, camera, controls, renderer }) {
    Object.assign(this, { people, traffic, camera, controls, renderer });
    this.speed = 1; this.follow = -1; this.dropsLeft = START_DROPS;
    this.acc = 0; this.clock = -1; this.seen = { bite: false, turned: false, milestone: 0 };
    this.buildUI();
    this.bindInput();
    this.toast('Tap a street to drop a Shambler zombie', 4500);
  }

  buildUI() {
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const top = document.createElement('div'); top.id = 'zd-top';
    top.innerHTML = '<div class="zd-pill zd-h"><b id="zd-h">0</b><i>Humans</i></div>' +
      '<div class="zd-pill zd-i"><b id="zd-i">0</b><i>Infected</i></div>' +
      '<div class="zd-pill zd-z"><b id="zd-z">0</b><i>Zombies</i></div>' +
      '<div class="zd-pill" id="zd-clock">--:--</div>';
    const bar = document.createElement('div'); bar.id = 'zd-bar';
    bar.innerHTML = '<button class="zd-btn" id="zd-drop" type="button">Shambler <span class="n" id="zd-n">3</span></button>' +
      '<button class="zd-btn" id="zd-find" type="button">Follow</button>' +
      '<button class="zd-btn" id="zd-speed" type="button">1x</button>' +
      '<button class="zd-btn" id="zd-reset" type="button">Reset</button>';
    const toast = document.createElement('div'); toast.id = 'zd-toast';
    const fps = document.createElement('div'); fps.id = 'zd-fps';
    document.body.append(top, bar, toast, fps);
    const old = document.getElementById('hud'); if (old) old.remove();
    this.el = { h: top.querySelector('#zd-h'), i: top.querySelector('#zd-i'), z: top.querySelector('#zd-z'), clock: top.querySelector('#zd-clock'),
      drop: bar.querySelector('#zd-drop'), n: bar.querySelector('#zd-n'), find: bar.querySelector('#zd-find'), speed: bar.querySelector('#zd-speed'), toast, fps };
    this.el.drop.onclick = () => this.toast(this.dropsLeft > 0 ? 'Tap any street on the map to drop it' : 'No Shamblers left. Tap Reset to start over');
    this.el.find.onclick = () => this.cycleFollow();
    this.el.speed.onclick = () => { this.speed = this.speed >= 8 ? 1 : this.speed * 2; this.el.speed.textContent = this.speed + 'x'; };
    bar.querySelector('#zd-reset').onclick = () => this.reset();
  }

  toast(msg, ms = 2600) {
    const t = this.el.toast; t.textContent = msg; t.style.opacity = '1';
    clearTimeout(this._tt); this._tt = setTimeout(() => { t.style.opacity = '0'; }, ms);
  }

  bindInput() {
    const dom = this.renderer.domElement;
    const downs = new Map();
    let multi = false;
    dom.addEventListener('pointerdown', (e) => {
      downs.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now() });
      if (downs.size > 1) multi = true;
    });
    const up = (e) => {
      const d = downs.get(e.pointerId); downs.delete(e.pointerId);
      if (!d) return;
      const wasMulti = multi; if (downs.size === 0) multi = false;
      if (e.type !== 'pointerup' || wasMulti || e.button > 0) return;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 10 && performance.now() - d.t < 400) this.tap(e.clientX, e.clientY);
    };
    dom.addEventListener('pointerup', up);
    dom.addEventListener('pointercancel', up);
    this.controls.addEventListener('start', () => { this.zoomTo = 0; if (this.follow >= 0) this.setFollow(-1); });
    this.ray = new THREE.Raycaster(); this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  }

  tap(cx, cy) {
    if (this.dropsLeft <= 0) { this.toast('No Shamblers left. Tap Reset to start over'); return; }
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    if (!this.ray.ray.intersectPlane(this.plane, hit)) return;
    const i = this.people.drop(hit.x, hit.z);
    if (i < 0) { this.toast('Too far from a street. Tap closer to a road'); return; }
    this.dropsLeft--;
    this.el.n.textContent = this.dropsLeft;
    this.el.drop.classList.toggle('empty', this.dropsLeft <= 0);
    if (this.clock < 0) this.clock = 0;
  }

  setFollow(i) {
    this.follow = i;
    this.el.find.classList.toggle('on', i >= 0);
    this.el.find.textContent = i >= 0 ? 'Following' : 'Follow';
  }

  cycleFollow() {
    const p = this.people, tg = this.controls.target;
    let i = -1;
    if (this.follow >= 0) {
      // next zombie: the nearest one that isn't the current
      i = p.nearestZombie(p.x[this.follow], p.z[this.follow], this.follow);
      if (i < 0) i = this.follow;
    } else i = p.nearestZombie(tg.x, tg.z);
    if (i < 0) { this.toast('No zombies yet. Tap a street to drop one'); return; }
    this.setFollow(i);
    if (this.camera.position.distanceTo(tg) > 190) this.zoomTo = 170;
  }

  reset() {
    this.people.reset();
    this.dropsLeft = START_DROPS; this.el.n.textContent = START_DROPS; this.el.drop.classList.remove('empty');
    this.clock = -1; this.seen = { bite: false, turned: false, milestone: 0 };
    this.setFollow(-1);
    this.toast('City reset. Tap a street to drop a Shambler');
  }

  update(dt, fps) {
    const p = this.people, h = 1 / 30;
    const sdt = dt * this.speed;
    this.acc = Math.min(this.acc + sdt, h * 12);
    while (this.acc >= h) { p.step(h); this.acc -= h; }
    this.traffic.update(sdt);
    p.sync(this.camera.position.distanceTo(this.controls.target));
    if (this.clock >= 0) this.clock += sdt;

    // follow camera
    if (this.follow >= 0) {
      let f = this.follow;
      if (p.st[f] !== ST.ZOMBIE && p.st[f] !== ST.FALLING) { f = p.nearestZombie(p.x[f], p.z[f]); this.setFollow(f); }
      if (f >= 0) {
        const tg = this.controls.target, k = 1 - Math.exp(-dt * 3);
        const dx = (p.x[f] - tg.x) * k, dz = (p.z[f] - tg.z) * k;
        tg.x += dx; tg.z += dz; this.camera.position.x += dx; this.camera.position.z += dz;
      }
    }

    // smooth zoom-in when following starts
    if (this.zoomTo) {
      const tg = this.controls.target, off = this.camera.position.clone().sub(tg), d = off.length();
      const nd = d + (this.zoomTo - d) * (1 - Math.exp(-dt * 3));
      this.camera.position.copy(tg).addScaledVector(off, nd / d);
      if (Math.abs(nd - this.zoomTo) < 1) this.zoomTo = 0;
    }

    // events
    for (const e of p.events) {
      if (e.type === 'bite' && !this.seen.bite) { this.seen.bite = true; this.toast('First bite! The victim is infected and will turn soon'); }
      if (e.type === 'turned' && !this.seen.turned) { this.seen.turned = true; this.toast('A victim has turned. The outbreak is spreading'); }
    }
    p.events.length = 0;
    const z = p.stats.zombies;
    for (const m of [10, 50, 100, 250, 500, 1000, 2000]) {
      if (z >= m && this.seen.milestone < m) { this.seen.milestone = m; if (m >= 10) this.toast(m + ' zombies roam the city'); }
    }

    const s = p.stats;
    this.el.h.textContent = s.humans; this.el.i.textContent = s.infected; this.el.z.textContent = s.zombies;
    if (this.clock >= 0) { const t = Math.floor(this.clock); this.el.clock.textContent = 'T+' + String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); }
    else this.el.clock.textContent = 'Waiting';
    if (fps) this.el.fps.textContent = fps + ' fps';
  }
}
