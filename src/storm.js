// Storm mode: you are the tornado. Drag (or tap) to steer it through the
// city. Everything it swallows scores points and feeds it: it grows from a
// thin EF1 rope that can only lift sheds into an EF5 wedge that tears down
// towers. Zombies are worth more. Three minutes, then the storm blows out.
import { Twister } from './twister.js';

const RUN = 180;
const RANKS = [[0, 'F'], [30000, 'D'], [80000, 'C'], [150000, 'B'], [230000, 'A'], [320000, 'S']];

class PlayerStorm {
  constructor(tw) { this.type = 'player'; this.tw = tw; }
  get alive() { return this.tw.alive; }
  get x() { return this.tw.x; } get z() { return this.tw.z; }
  update(h) { this.tw.update(h); }
  sync(dt, t) { this.tw.sync(dt, t); }
  dispose() { this.tw.dispose(); }
}

export class Storm {
  constructor(g) {
    this.g = g; this.msgs = {};
    this.el = {
      score: g.addPill('zd-rp', 'Score'), ef: g.addPill('zd-al', '', 'zd-ef'),
      p: g.addPill('zd-h', 'People'), c: g.addPill('', 'Cars'), b: g.addPill('zd-d', 'Buildings'), clock: g.addPill('', '', 'zd-clock'),
    };
    g.addButton('zd-restart', 'Restart', () => this.start());
    g.addButton('zd-menu-btn', 'Menu', () => { location.href = location.pathname; });
    this.end = document.getElementById('zd-end') || document.createElement('div'); this.end.id = 'zd-end'; this.end.hidden = true;
    if (!this.end.parentNode) document.body.appendChild(this.end);
    g.controls.enablePan = false; // one finger steers the storm; two fingers still zoom
    this.bindSteer();
    this.start();
  }

  bindSteer() {
    const g = this.g, dom = g.renderer.domElement, held = new Set();
    let steering = false;
    const aim = (e) => { const p = g.worldPoint(e.clientX, e.clientY); if (p && this.tw && !this.ended) this.tw.steer(p.x, p.z); };
    dom.addEventListener('pointerdown', (e) => { held.add(e.pointerId); steering = held.size === 1 && e.button === 0; if (steering) aim(e); });
    dom.addEventListener('pointermove', (e) => { if (steering && held.size === 1) aim(e); });
    const up = (e) => { held.delete(e.pointerId); if (!held.size) steering = false; };
    dom.addEventListener('pointerup', up); dom.addEventListener('pointercancel', up);
    // arrow keys and WASD on a keyboard
    this.keys = {};
    addEventListener('keydown', (e) => { this.keys[e.key.toLowerCase()] = true; });
    addEventListener('keyup', (e) => { this.keys[e.key.toLowerCase()] = false; });
  }

  start() {
    const g = this.g, p = g.people, D = g.disasters, B = g.city.bounds;
    this.end.hidden = true; this.ended = false;
    g.resetWorld(); g.setSpeed(1);
    D.weather.set('storm', true);
    this.t = 0; this.score = 0; this.peak = 1;
    // a few outbreaks already under way: zombies are worth more
    for (let k = 0; k < 4; k++) { const w = p.snapWalkable(B.x0 + 80 + p.r() * (B.x1 - B.x0 - 160), B.z0 + 80 + p.r() * (B.z1 - B.z0 - 160), 20); if (w) p.infectAt(w[0], w[1], 6); }
    const x = B.x0 + 90, z = (B.z0 + B.z1) / 2;
    this.tw = new Twister(D, x, z, { player: true, size: 1, speed: 10, onEat: (kind, v) => { this.score += Math.round(v * this.ef()); } });
    D.list.push(new PlayerStorm(this.tw));
    g.lookAt(x + 60, z, 400);
    g.toast('You are the storm. Drag to steer, swallow everything. Zombies are worth more', 5000);
  }

  ef() { return Math.max(1, Math.min(5, Math.floor(this.tw.size * 2 - 0.999))); }
  tap(x, z) { if (!this.ended) this.tw.steer(x, z); }
  phase() { return 0.1 + (this.t / RUN) * 0.25; }

  update(sdt, dt) {
    if (this.ended) return;
    const g = this.g, tw = this.tw;
    this.t += sdt;
    // keyboard steering: aim a point ahead of the storm
    const k = this.keys, kx = (k.arrowright || k.d ? 1 : 0) - (k.arrowleft || k.a ? 1 : 0), kz = (k.arrowdown || k.s ? 1 : 0) - (k.arrowup || k.w ? 1 : 0);
    if (kx || kz) {
      // screen directions to world: the camera looks along its own heading
      const c = g.camera.position, tg = g.controls.target, fx = tg.x - c.x, fz = tg.z - c.z, fl = Math.hypot(fx, fz) || 1;
      const ux = fx / fl, uz = fz / fl; // screen up
      tw.steer(tw.x + (ux * -kz + -uz * kx) * 40, tw.z + (uz * -kz + ux * kx) * 40);
    }
    // the camera rides along
    const tg = g.controls.target, f = 1 - Math.exp(-dt * 2.2);
    const dx = (tw.x + tw.vx * 1.5 - tg.x) * f, dz = (tw.z + tw.vz * 1.5 - tg.z) * f;
    tg.x += dx; tg.z += dz; g.camera.position.x += dx; g.camera.position.z += dz;
    this.peak = Math.max(this.peak, this.ef());
    if (this.t >= RUN) this.finish();
    this.hud();
  }

  hud() {
    const e = this.el, en = this.tw.eaten, left = Math.max(0, RUN - this.t);
    e.score.textContent = this.score.toLocaleString();
    e.ef.textContent = 'EF' + this.ef() + ' · ' + Math.round((this.tw.size - 1) * 50) + '%';
    e.ef.parentElement.className = 'zd-pill zd-al a' + Math.min(4, this.ef() - 1);
    e.p.textContent = en.people + en.zombies; e.c.textContent = en.cars; e.b.textContent = en.buildings;
    e.clock.textContent = Math.floor(left / 60) + ':' + String(Math.floor(left % 60)).padStart(2, '0');
  }

  finish() {
    this.ended = true;
    const g = this.g, tw = this.tw, en = tw.eaten;
    tw.player = false; tw.life = 0; // ropes out and lifts back into the cloud
    let rank = 'F'; for (const [s, r] of RANKS) if (this.score >= s) rank = r;
    const r = g.profile.addStorm(this.score);
    const lines = [
      ['Peak rating', 'EF' + this.peak],
      ['Buildings flattened', en.buildings],
      ['People swept up', en.people.toLocaleString()],
      ['Zombies swept up', en.zombies.toLocaleString()],
      ['Cars thrown', en.cars],
      ['Trees and lamps ripped out', en.trees],
    ];
    this.end.innerHTML = '<div class="box"><h2>The storm has passed</h2><div>Rank ' + rank + (r.best ? ' · new best!' : ' · best ' + g.profile.data.stormBest.toLocaleString()) + '</div>' +
      '<div class="stars" style="letter-spacing:0">' + rank + '</div>' +
      lines.map(l => '<div class="line"><span>' + l[0] + '</span><b>' + l[1] + '</b></div>').join('') +
      '<div class="score">Score ' + this.score.toLocaleString() + '</div>' +
      '<div class="xp">+' + r.xp.toLocaleString() + ' XP' + (r.levelUp ? ' · level up! Commander level ' + r.level : '') + '</div>' +
      '<div class="row2"><button class="zd-btn" type="button" id="zd-again">Again</button><button class="zd-btn" type="button" id="zd-tomenu" style="background:rgba(28,20,12,.9);border-color:rgba(255,236,200,.25)">Menu</button></div></div>';
    this.end.querySelector('#zd-again').onclick = () => this.start();
    this.end.querySelector('#zd-tomenu').onclick = () => { location.href = location.pathname; };
    setTimeout(() => { if (this.ended) this.end.hidden = false; }, 2500);
  }
}
