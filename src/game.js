// Shared game layer: HUD scaffolding, toasts, tap input, time speed, fixed-step
// simulation, follow camera. Modes plug in: Sandbox (drop zombies) and Commander
// (send help to the city).
import * as THREE from 'three';
import { ST } from './people.js';
import { Commander } from './commander.js';

const CSS = `
#zd-top{position:fixed;left:0;right:0;top:0;display:flex;gap:6px;align-items:center;flex-wrap:wrap;
  padding:calc(8px + env(safe-area-inset-top)) max(10px, env(safe-area-inset-right)) 0 max(10px, env(safe-area-inset-left));pointer-events:none;
  font:600 12px/1 system-ui,-apple-system,"Segoe UI",sans-serif;color:#f6ead2;letter-spacing:.04em}
.zd-pill{display:flex;gap:6px;align-items:baseline;background:rgba(28,20,12,.62);border:1px solid rgba(255,236,200,.14);
  border-radius:8px;padding:6px 9px;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}
.zd-pill b{font-size:15px;font-variant-numeric:tabular-nums;letter-spacing:0}
.zd-pill i{font-style:normal;font-size:10px;opacity:.75;text-transform:uppercase}
.zd-h b{color:#fff4e0}.zd-i b{color:#ffc233}.zd-z b{color:#a6ff4d}.zd-d b{color:#e07a6a}.zd-rp b{color:#7be0ff}
.zd-al{border-color:rgba(255,120,60,.35)}.zd-al b{color:#ffb070;font-size:12px;letter-spacing:.03em}
.zd-al.a3 b{color:#ff8a4a}.zd-al.a4 b{color:#ff5a3a}
#zd-clock{margin-left:auto;opacity:.85;font-variant-numeric:tabular-nums}
#zd-bar{position:fixed;left:0;right:0;bottom:0;display:flex;gap:8px;justify-content:center;align-items:flex-end;flex-wrap:wrap;
  padding:0 max(10px, env(safe-area-inset-right)) calc(10px + env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-left))}
.zd-btn{appearance:none;border:1px solid rgba(255,236,200,.18);background:rgba(28,20,12,.72);color:#f6ead2;border-radius:10px;
  font:700 12px/1 system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.06em;text-transform:uppercase;padding:11px 12px;
  backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);touch-action:manipulation;cursor:pointer;min-width:52px;position:relative;overflow:hidden}
.zd-btn:active{transform:translateY(1px)}
.zd-btn:focus-visible{outline:2px solid #a6ff4d;outline-offset:2px}
#zd-drop{background:rgba(70,98,34,.85);border-color:rgba(166,255,77,.5);display:flex;gap:8px;align-items:center}
#zd-drop .n{background:#a6ff4d;color:#1d2a0e;border-radius:6px;padding:3px 6px;font-variant-numeric:tabular-nums}
#zd-drop.empty{background:rgba(28,20,12,.72);border-color:rgba(255,236,200,.18);opacity:.7}
#zd-find.on{border-color:#a6ff4d;color:#a6ff4d}
.zd-card{display:flex;flex-direction:column;gap:4px;align-items:center;min-width:62px;padding:8px 7px 7px;text-transform:none;letter-spacing:.02em}
.zd-card .nm{font-size:11px;white-space:nowrap}
.zd-card .cost{font-size:11px;color:#7be0ff;font-variant-numeric:tabular-nums}
.zd-card .cd{position:absolute;left:0;right:0;bottom:0;height:0;background:rgba(255,236,200,.18);pointer-events:none}
.zd-card.sel{border-color:#a6ff4d;box-shadow:0 0 0 2px rgba(166,255,77,.35) inset;background:rgba(60,88,30,.85)}
.zd-card.off{opacity:.45}
#zd-toast{position:fixed;left:50%;top:calc(150px + env(safe-area-inset-top));transform:translateX(-50%);max-width:min(88vw,420px);
  background:rgba(28,20,12,.8);color:#f6ead2;border:1px solid rgba(255,236,200,.16);border-radius:10px;padding:9px 12px;
  font:600 13px/1.35 system-ui,-apple-system,"Segoe UI",sans-serif;text-align:center;pointer-events:none;transition:opacity .4s;opacity:0}
#zd-call{position:fixed;left:50%;top:calc(96px + env(safe-area-inset-top));transform:translateX(-50%);display:flex;gap:8px;align-items:center;max-width:min(92vw,440px);
  background:rgba(60,22,14,.82);color:#ffd9cc;border:1px solid rgba(255,120,90,.35);border-radius:10px;padding:7px 8px 7px 12px;font:600 12px/1.3 system-ui,-apple-system,"Segoe UI",sans-serif;z-index:3}
#zd-call[hidden]{display:none}
#zd-call .t{flex:1;min-width:0}
#zd-call .zd-btn{padding:8px 12px;background:rgba(200,60,40,.9);border-color:rgba(255,160,130,.5);min-width:0}
#zd-fps{position:fixed;right:max(8px, env(safe-area-inset-right));bottom:calc(74px + env(safe-area-inset-bottom));font:10px system-ui,sans-serif;color:#f6ead2;opacity:.45;pointer-events:none}
#zd-end{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(14,10,6,.78);z-index:5;
  padding:max(16px, env(safe-area-inset-left));font:14px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;color:#f6ead2}
#zd-end[hidden]{display:none}
#zd-end .box{background:rgba(32,24,14,.95);border:1px solid rgba(255,236,200,.18);border-radius:14px;padding:22px 22px 18px;max-width:360px;width:100%;text-align:center}
#zd-end h2{margin:0 0 4px;font-size:24px;letter-spacing:.02em}
#zd-end .stars{font-size:30px;letter-spacing:6px;color:#ffc233;margin:4px 0 10px}
#zd-end .stars span{opacity:.25}
#zd-end .line{display:flex;justify-content:space-between;gap:12px;padding:5px 0;border-top:1px solid rgba(255,236,200,.1);font-variant-numeric:tabular-nums}
#zd-end .line b{color:#fff4e0}
#zd-end .score{font-size:20px;margin:12px 0 4px;color:#7be0ff}
#zd-end .zd-btn{margin-top:12px;background:rgba(70,98,34,.9);border-color:rgba(166,255,77,.5);padding:13px 22px;font-size:13px}
@media (prefers-reduced-motion: reduce){#zd-toast{transition:none}}
`;

export class Game {
  constructor({ people, traffic, fire, city, camera, controls, renderer, mode, daylight, helis }) {
    Object.assign(this, { people, traffic, fire, city, camera, controls, renderer, daylight, helis });
    this.pendingFires = []; this.simT = 0; this.realT = 0; this.acc = 0; this.speed = 1; this.follow = -1; this.seen = {};
    people.fire = fire; traffic.people = people; traffic.fire = fire;
    people.onOverrun = (k, why) => { if (Math.random() < (why === 'breach' ? 0.25 : 0.3)) this.pendingFires.push({ k, t: this.simT + 3 + Math.random() * 8 }); };
    this.buildUI();
    this.bindInput();
    this.mode = mode === 'sandbox' ? new Sandbox(this) : new Commander(this);
  }

  buildUI() {
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    this.top = document.createElement('div'); this.top.id = 'zd-top';
    this.bar = document.createElement('div'); this.bar.id = 'zd-bar';
    const toast = document.createElement('div'); toast.id = 'zd-toast';
    const fps = document.createElement('div'); fps.id = 'zd-fps';
    document.body.append(this.top, this.bar, toast, fps);
    const old = document.getElementById('hud'); if (old) old.remove();
    this.el = { toast, fps };
  }
  addPill(cls, label, id) {
    const d = document.createElement('div'); d.className = 'zd-pill ' + cls;
    d.innerHTML = '<b>0</b>' + (label ? '<i>' + label + '</i>' : '');
    if (id) d.id = id;
    this.top.appendChild(d);
    return d.querySelector('b');
  }
  addButton(id, html, onClick, cls = '') {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'zd-btn ' + cls; b.id = id; b.innerHTML = html;
    b.onclick = onClick; this.bar.appendChild(b);
    return b;
  }
  addSpeedButton() {
    this.speedBtn = this.addButton('zd-speed', '1x', () => { this.speed = this.speed >= 4 ? 1 : this.speed * 2; this.speedBtn.textContent = this.speed + 'x'; });
  }
  setSpeed(s) { this.speed = s; if (this.speedBtn) this.speedBtn.textContent = s + 'x'; }

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
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 10 && performance.now() - d.t < 400) {
        const hit = this.worldPoint(e.clientX, e.clientY);
        if (hit) this.mode.tap(hit.x, hit.z);
      }
    };
    dom.addEventListener('pointerup', up);
    dom.addEventListener('pointercancel', up);
    this.controls.addEventListener('start', () => { this.zoomTo = 0; if (this.follow >= 0) this.setFollow(-1); });
    this.ray = new THREE.Raycaster(); this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  }

  worldPoint(cx, cy) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    return this.ray.ray.intersectPlane(this.plane, hit) ? hit : null;
  }

  // pan (and optionally zoom) the camera to a point
  lookAt(x, z, dist = 0) {
    const tg = this.controls.target;
    this.camera.position.x += x - tg.x; this.camera.position.z += z - tg.z; tg.x = x; tg.z = z;
    if (dist) this.zoomTo = dist;
  }

  resetWorld() {
    this.fire.reset(); this.city.uncharAll(); this.traffic.reset(); this.pendingFires.length = 0; if (this.helis) this.helis.reset();
    this.people.reset();
    this.simT = 0; this.seen = {}; this.setFollow(-1);
  }

  setFollow(i) {
    this.follow = i;
    if (this.followBtn) { this.followBtn.classList.toggle('on', i >= 0); this.followBtn.textContent = i >= 0 ? 'Following' : 'Follow'; }
  }

  cycleFollow() {
    const p = this.people, tg = this.controls.target;
    let i = -1;
    if (this.follow >= 0) { i = p.nearestZombie(p.x[this.follow], p.z[this.follow], this.follow); if (i < 0) i = this.follow; }
    else i = p.nearestZombie(tg.x, tg.z);
    if (i < 0) { this.toast('No zombies yet. Tap a street to drop one'); return; }
    this.setFollow(i);
    if (this.camera.position.distanceTo(tg) > 260) this.zoomTo = 230;
  }

  update(dt, fps) {
    const p = this.people, h = 1 / 30;
    const sdt = dt * this.speed;
    this.acc = Math.min(this.acc + sdt, h * 12);
    while (this.acc >= h) {
      p.step(h); this.traffic.step(h); if (this.helis) this.helis.update(h); this.acc -= h; this.simT += h;
      for (const e of p.events) if (e.type === 'bite') this.traffic.panicNear(e.x, e.z, 20);
      this.mode.afterStep && this.mode.afterStep(h);
    }
    for (let k = this.pendingFires.length - 1; k >= 0; k--) {
      if (this.simT >= this.pendingFires[k].t) { this.fire.igniteBuilding(this.pendingFires[k].k); this.pendingFires.splice(k, 1); }
    }
    this.realT += dt;
    p.uTime.value = this.realT;
    this.traffic.sync(this.realT);
    if (this.helis) this.helis.sync(dt * this.speed);
    if (this.daylight) { this.daylight.set(this.mode.phase ? this.mode.phase() : 0); this.daylight.update(); }
    this.fire.update(sdt, this.realT, this.camera, this.renderer);
    p.sync();

    if (this.follow >= 0) {
      let f = this.follow;
      if (p.st[f] !== ST.ZOMBIE && p.st[f] !== ST.FALLING) { f = p.nearestZombie(p.x[f], p.z[f]); this.setFollow(f); }
      if (f >= 0) {
        const tg = this.controls.target, k = 1 - Math.exp(-dt * 3);
        const dx = (p.x[f] - tg.x) * k, dz = (p.z[f] - tg.z) * k;
        tg.x += dx; tg.z += dz; this.camera.position.x += dx; this.camera.position.z += dz;
      }
    }
    if (this.zoomTo) {
      const tg = this.controls.target, off = this.camera.position.clone().sub(tg), d = off.length();
      const nd = d + (this.zoomTo - d) * (1 - Math.exp(-dt * 3));
      this.camera.position.copy(tg).addScaledVector(off, nd / d);
      if (Math.abs(nd - this.zoomTo) < 1) this.zoomTo = 0;
    }

    const msgs = this.mode.msgs;
    for (const list of [p.events, this.traffic.events, this.fire.events, this.helis ? this.helis.events : []]) {
      for (const e of list) {
        if (this.mode.onEvent) this.mode.onEvent(e);
        if (msgs[e.type] && !this.seen[e.type]) { this.seen[e.type] = true; this.toast(msgs[e.type], 3200); }
      }
      list.length = 0;
    }
    this.mode.update(sdt, dt);
    if (fps) this.el.fps.textContent = fps + ' fps';
  }
}

const SANDBOX_MSGS = {
  bite: 'First bite! The victim is infected and will turn soon',
  turned: 'A victim has turned. The outbreak is spreading',
  runover: 'A panicked driver plowed through the street',
  crash: 'Panicked drivers are crashing',
  carfire: 'A wrecked car is burning',
  roof: 'Survivors are barricading themselves on the rooftops',
  breach: 'The horde piled up and reached a rooftop!',
  fire: 'An overrun building has caught fire',
  jump: 'Survivors are jumping from a burning roof',
};
const START_DROPS = 3;

class Sandbox {
  constructor(g) {
    this.g = g; this.msgs = SANDBOX_MSGS;
    this.el = {
      h: g.addPill('zd-h', 'Humans'), i: g.addPill('zd-i', 'Infected'), z: g.addPill('zd-z', 'Zombies'), d: g.addPill('zd-d', 'Dead'),
      clock: g.addPill('', '', 'zd-clock'),
    };
    this.el.drop = g.addButton('zd-drop', 'Shambler <span class="n" id="zd-n">3</span>', () => g.toast(this.dropsLeft > 0 ? 'Tap any street on the map to drop it' : 'No Shamblers left. Tap Reset to start over'));
    this.el.n = this.el.drop.querySelector('#zd-n');
    g.followBtn = g.addButton('zd-find', 'Follow', () => g.cycleFollow());
    g.addSpeedButton();
    g.addButton('zd-reset', 'Reset', () => this.reset());
    this.dropsLeft = START_DROPS; this.clock = -1; this.milestone = 0;
    g.toast('Tap a street to drop a Shambler zombie', 4500);
  }
  tap(x, z) {
    const g = this.g;
    if (this.dropsLeft <= 0) { g.toast('No Shamblers left. Tap Reset to start over'); return; }
    const i = g.people.drop(x, z);
    if (i < 0) { g.toast('Too far from a street. Tap closer to a road'); return; }
    this.dropsLeft--;
    this.el.n.textContent = this.dropsLeft;
    this.el.drop.classList.toggle('empty', this.dropsLeft <= 0);
    if (this.clock < 0) this.clock = 0;
  }
  reset() {
    this.g.resetWorld();
    this.dropsLeft = START_DROPS; this.el.n.textContent = START_DROPS; this.el.drop.classList.remove('empty');
    this.clock = -1; this.milestone = 0;
    this.g.toast('City reset. Tap a street to drop a Shambler');
  }
  phase() { return (Math.max(0, this.clock) / 600) % 1; }
  update(sdt) {
    const s = this.g.people.stats;
    if (this.clock >= 0) this.clock += sdt;
    for (const m of [10, 50, 100, 250, 500, 1000, 2000]) if (s.zombies >= m && this.milestone < m) { this.milestone = m; this.g.toast(m + ' zombies roam the city'); }
    this.el.h.textContent = s.humans; this.el.i.textContent = s.infected; this.el.z.textContent = s.zombies; this.el.d.textContent = s.dead;
    if (this.clock >= 0) { const t = Math.floor(this.clock); this.el.clock.textContent = 'T+' + String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); }
    else this.el.clock.textContent = 'Waiting';
  }
}
