// On the ground in the Sandbox (Sean): drive a tank and shoot at things, or be a police officer on foot who can get into
// a police car, a fire truck or an ambulance (three wait nearby, and any police car or fire truck out on a call can be
// taken) and get out again, and shoot zombies. Seen from behind (third person) or through their eyes (first). A phone's
// controls: a stick under the left thumb (wherever it comes down: up to go, down to back up, the sides to turn - on foot
// it walks that way across the screen), a drag on the right half aims (the tank's turret, the officer's view), and the
// buttons. Keys: WASD or arrows, J and L to aim, Space to fire, F to get in or out, V the view, Esc to stop. The tank's
// shells burst like an airstrike (buildings burn, small ones come down; the kaiju and the tripods feel them); the
// officer's pistol only ever hits zombies. main.js hands it the camera like the planes (flight.js).
import * as THREE from 'three';
import { buildVehicle } from './vehicles.js';
import { sfx } from './audio.js';
import { SEE } from './see.js';
import { ST } from './people.js';

// what can be driven: top speed (m/s), how hard it turns, its size for walls, the camera behind (distance, height) and the seat (forward, up)
const RIDES = {
  tank: { name: 'Tank', model: () => tankModel(), max: 12, back: 6, acc: 5, turn: 0.9, pivot: true, r: 2.6, chase: [14, 6], seat: [-0.4, 3.0] },
  police: { name: 'Police car', model: () => buildVehicle('police_interceptor'), max: 30, back: 9, acc: 9, turn: 1.6, r: 1.6, chase: [9, 3.4], seat: [0.1, 1.3] },
  fire: { name: 'Fire truck', model: () => buildVehicle('fire_truck'), max: 21, back: 6, acc: 5.5, turn: 1.1, r: 2.2, chase: [14, 5], seat: [2.5, 2.4] },
  ambulance: { name: 'Ambulance', model: () => buildVehicle('ambulance'), max: 25, back: 7, acc: 7, turn: 1.3, r: 1.9, chase: [11, 4.4], seat: [1.8, 2.0] },
};
const WALK = 5, KMH = 3.6;
const _v = new THREE.Vector3(), _u = new THREE.Vector3();
const mat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 });
const fwd = (yaw) => [Math.cos(yaw), -Math.sin(yaw)]; // the models point along +x; a yaw turns them like rotation.y

// a tank, nose along +x, its turret and gun turning on their own (userData.turret; the muzzle at userData.muzzle in it)
function tankModel() {
  const g = new THREE.Group(), olive = mat('#5f6b45'), dark = mat('#3f4630'), track = mat('#1d1f1a');
  const add = (p, geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; p.add(o); return o; };
  add(g, new THREE.BoxGeometry(7.2, 1.3, 3.2), olive, 0, 1.25, 0);
  add(g, new THREE.BoxGeometry(1.4, 0.9, 3.2).rotateZ(0.6), olive, 3.5, 1.35, 0); // the sloped glacis
  for (const s of [-1, 1]) { add(g, new THREE.BoxGeometry(7.8, 1.0, 0.9), track, 0, 0.55, s * 1.6); add(g, new THREE.BoxGeometry(7.4, 0.35, 0.96), dark, 0, 1.2, s * 1.6); }
  const turret = new THREE.Group(); turret.position.set(-0.6, 1.9, 0); g.add(turret);
  add(turret, new THREE.BoxGeometry(3.8, 0.95, 2.7), olive, 0, 0.47, 0);
  add(turret, new THREE.CylinderGeometry(0.4, 0.4, 0.3, 10), dark, -0.6, 1.05, 0.6);
  add(turret, new THREE.CylinderGeometry(0.13, 0.16, 5.2, 8).rotateZ(-Math.PI / 2), dark, 4.4, 0.5, 0);
  g.userData.turret = turret; g.userData.muzzle = new THREE.Vector3(7.0, 0.5, 0);
  return g;
}
// a police officer in navy with a cap, facing +x; legs and arms swing (userData), a pistol in the right hand
function copModel() {
  const g = new THREE.Group(), navy = mat('#1d2a4a'), skin = mat('#d8a77f'), black = mat('#141414'), gold = mat('#e8c24a');
  const add = (p, geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; p.add(o); return o; };
  const limb = (y, z, w, h, m) => { const pv = new THREE.Group(); pv.position.set(0, y, z); g.add(pv); add(pv, new THREE.BoxGeometry(w, h, w), m, 0, -h / 2, 0); return pv; };
  const legL = limb(0.86, -0.1, 0.17, 0.86, navy), legR = limb(0.86, 0.1, 0.17, 0.86, navy);
  add(g, new THREE.BoxGeometry(0.26, 0.6, 0.44), navy, 0, 1.15, 0); add(g, new THREE.BoxGeometry(0.02, 0.07, 0.07), gold, 0.14, 1.3, -0.1);
  add(g, new THREE.BoxGeometry(0.22, 0.24, 0.22), skin, 0, 1.6, 0); add(g, new THREE.BoxGeometry(0.3, 0.08, 0.26), black, 0.03, 1.75, 0);
  const armL = limb(1.42, -0.29, 0.1, 0.56, navy), armR = limb(1.42, 0.29, 0.1, 0.56, navy);
  add(armR, new THREE.BoxGeometry(0.22, 0.09, 0.05), black, 0.08, -0.58, 0); // the pistol
  g.userData = { legL, legR, armL, armR };
  return g;
}

const CSS = `
#zd-drive{position:fixed;left:0;top:0;right:0;bottom:0;touch-action:none}
#zd-drive .stick{position:absolute;width:90px;height:90px;margin:-45px 0 0 -45px;border-radius:50%;border:2px solid rgba(255,255,255,.35);display:none;pointer-events:none}
#zd-drive .knob{position:absolute;left:50%;top:50%;width:36px;height:36px;margin:-18px 0 0 -18px;border-radius:50%;background:rgba(255,255,255,.45)}
#zd-drive .hud{position:absolute;left:50%;top:calc(10px + env(safe-area-inset-top));transform:translateX(-50%);background:rgba(20,14,30,.6);color:#fff;border:1px solid rgba(255,255,255,.2);border-radius:9px;padding:6px 11px;font:700 12px/1 system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.04em;white-space:pre;text-align:center;line-height:1.35;pointer-events:none;font-variant-numeric:tabular-nums}
#zd-drive .ret{position:absolute;left:50%;top:46%;width:24px;height:24px;margin:-12px 0 0 -12px;border:2px solid rgba(255,255,255,.75);border-radius:50%;pointer-events:none;display:none}
#zd-drive.first .ret{display:block}
#zd-drive .tip{position:absolute;left:50%;bottom:calc(84px + env(safe-area-inset-bottom));transform:translateX(-50%);color:#fff;font:600 12px/1.3 system-ui,-apple-system,"Segoe UI",sans-serif;text-align:center;text-shadow:0 1px 3px #000;pointer-events:none;transition:opacity .6s;width:80vw}
#zd-drive .half{position:absolute;top:50%;color:rgba(255,255,255,.35);font:700 10px system-ui,sans-serif;letter-spacing:.1em;pointer-events:none;transition:opacity 1s}
#zd-drivebar{position:fixed;left:50%;bottom:calc(8px + env(safe-area-inset-bottom));transform:translateX(-50%);display:flex;gap:6px;width:min(calc(100vw - 16px),460px);z-index:31}
#zd-drivebar .zd-btn{flex:1 1 0;min-width:0;padding:12px 4px;font-size:11px;color:#fff;background:linear-gradient(#8a3bff,#5216c2);border-color:rgba(255,255,255,.3)}
#zd-drivebar .zd-btn.fire{flex:1.4 1 0;background:linear-gradient(#ffb02e,#e05a10);font-size:13px;letter-spacing:.1em}
#zd-drivebar .zd-btn.fire.wait{opacity:.5}
#zd-drivebar .zd-btn.exit{background:linear-gradient(#ff5a8a,#c2165a)}
#zd-drivebar .zd-btn.off{opacity:.4}
body.zd-flying #zd-bar,body.zd-flying #zd-dis,body.zd-flying #zd-followchip,body.zd-flying #zd-globe,body.zd-flying #zd-top{display:none!important} /* the numbers at the top too: the readout sits there */
`;

export class Drive {
  constructor(game, ctx) { // ctx: { camera, controls, post, renderer }
    this.g = game; this.ctx = ctx; this.active = false; this.view = 'third'; this.pos = new THREE.Vector3();
    this.near = 0.5; this.focus = 10;
  }
  // main.js: the trees, people and cars in fewer pieces (a wide view along the street takes in much of the town: on foot with
  // the people whole it drew 3.1 million triangles a frame in the big city, 1.8 million like this; an older phone first)
  get lod() { return 3; }
  // out on the ground: 'tank' in a tank, 'cop' on foot with a police car, a fire truck and an ambulance parked nearby
  start(kind = 'cop') {
    if (this.active) this.stop(true);
    const g = this.g, { camera, controls, post } = this.ctx, scene = g.disasters.ctx.scene, city = g.city;
    this.kind = kind === 'tank' ? 'tank' : 'cop';
    this.saved = { far: camera.far, fov: camera.fov, dof: post.opts.dof, see: SEE.on };
    camera.far = 3000; post.opts.dof = false; controls.enabled = false; g.setFollow(-1);
    this.cop = copModel(); scene.add(this.cop); this.parked = []; this.shells = []; this.tracers = []; this.coolT = 0; this.spillT = 0;
    // a crossing near the middle of town
    const mx = city.sx[Math.floor(city.sx.length / 2)], mz = city.sz[Math.floor(city.sz.length / 2)];
    this.yaw = 0; this.camYaw = 0; this.aim = 0; this.v = 0; this.ix = this.iy = 0; this.walkT = 0;
    if (this.kind === 'tank') { this.ride = this.makeRide('tank', mx, mz, 0); this.mode = 'ride'; this.cop.visible = false; }
    else {
      this.mode = 'foot'; this.pos.set(mx + 3, 0, mz + 3);
      [['police', 3, 12], ['fire', 3, 24], ['ambulance', -3, 36]].forEach(([t, ox, oz]) => this.parked.push(this.makeRide(t, mx + ox, mz + oz, -Math.PI / 2)));
    }
    if (this.ride) this.pos.set(this.ride.x, 0, this.ride.z);
    this.ui(); this.active = true; document.body.classList.add('zd-flying'); this.setView(this.view); this.snap = true;
    this.tip(this.kind === 'tank' ? 'Left thumb drives, a drag on the right turns the gun. Fire!' : 'Left thumb walks, a drag on the right looks round. Get in a car nearby, or shoot zombies');
  }
  makeRide(type, x, z, yaw) { const R = RIDES[type], obj = R.model(); obj.traverse(o => { if (o.isMesh) o.castShadow = true; }); this.g.disasters.ctx.scene.add(obj); const r = { type, R, obj, x, z, yaw }; obj.position.set(x, this.groundY(x, z), z); obj.rotation.y = yaw; return r; }
  groundY(x, z) { return this.g.people ? this.g.people.groundY(x, z) : 0; }
  ui() {
    if (!document.getElementById('zd-drive-css')) { const s = document.createElement('style'); s.id = 'zd-drive-css'; s.textContent = CSS; document.head.appendChild(s); }
    const R = this.ctx.renderer.domElement, ov = this.ov = document.createElement('div'); ov.id = 'zd-drive';
    ov.innerHTML = '<div class="ret"></div><div class="stick"><div class="knob"></div></div><div class="hud"></div><div class="tip"></div><div class="half" style="left:18%">MOVE</div><div class="half" style="right:18%">' + (this.kind === 'tank' ? 'AIM' : 'LOOK') + '</div>';
    R.parentNode.insertBefore(ov, R.nextSibling);
    this.hud = ov.querySelector('.hud'); this.stickEl = ov.querySelector('.stick'); this.knob = ov.querySelector('.knob'); this.tipEl = ov.querySelector('.tip');
    setTimeout(() => ov.querySelectorAll('.half').forEach(h => { h.style.opacity = '0'; }), 4000);
    const bar = this.bar = document.createElement('div'); bar.id = 'zd-drivebar';
    bar.innerHTML = '<button type="button" class="zd-btn fire" data-d="fire">Fire</button>' + (this.kind === 'cop' ? '<button type="button" class="zd-btn" data-d="door">Get in</button><button type="button" class="zd-btn" data-d="spill">Zombies</button>' : '') +
      '<button type="button" class="zd-btn" data-d="view"></button><button type="button" class="zd-btn exit" data-d="exit">Stop</button>';
    document.body.appendChild(bar);
    this.fireBtn = bar.querySelector('[data-d="fire"]'); this.doorBtn = bar.querySelector('[data-d="door"]'); this.viewBtn = bar.querySelector('[data-d="view"]');
    this.fireBtn.onclick = () => this.fire(); if (this.doorBtn) this.doorBtn.onclick = () => this.door();
    const sp = bar.querySelector('[data-d="spill"]'); if (sp) sp.onclick = () => this.spill();
    this.viewBtn.onclick = () => this.setView(this.view === 'third' ? 'first' : 'third'); bar.querySelector('[data-d="exit"]').onclick = () => this.stop();
    // two thumbs: the left half a stick from where it lands, the right half drags the aim
    const touches = new Map();
    ov.addEventListener('pointerdown', (e) => {
      const left = e.clientX < innerWidth / 2;
      if (left && [...touches.values()].some(t => t.left)) return;
      touches.set(e.pointerId, { left, x: e.clientX, y: e.clientY, lx: e.clientX });
      if (left) { this.stickEl.style.display = 'block'; this.stickEl.style.left = e.clientX + 'px'; this.stickEl.style.top = e.clientY + 'px'; this.knob.style.transform = ''; }
      try { ov.setPointerCapture(e.pointerId); } catch (er) { /* fine */ } e.preventDefault();
    });
    ov.addEventListener('pointermove', (e) => {
      const t = touches.get(e.pointerId); if (!t) return;
      if (t.left) { const dx = Math.max(-1, Math.min(1, (e.clientX - t.x) / 60)), dy = Math.max(-1, Math.min(1, (e.clientY - t.y) / 60)); this.ix = dx; this.iy = -dy; this.knob.style.transform = 'translate(' + dx * 27 + 'px,' + dy * 27 + 'px)'; }
      else { const d = (e.clientX - t.lx) * 0.006; t.lx = e.clientX; this.turnAim(-d); }
    });
    const up = (e) => { const t = touches.get(e.pointerId); if (!t) return; touches.delete(e.pointerId); if (t.left) { this.ix = this.iy = 0; this.stickEl.style.display = 'none'; } };
    ov.addEventListener('pointerup', up); ov.addEventListener('pointercancel', up);
    this.keys = new Set();
    this.onKey = (e) => {
      const down = e.type === 'keydown', k = e.key.toLowerCase();
      if (down && !e.repeat) { if (k === ' ') this.fire(); if (k === 'f') this.door(); if (k === 'v') this.setView(this.view === 'third' ? 'first' : 'third'); if (k === 'escape') { this.stop(); return; } }
      if (down) this.keys.add(k); else this.keys.delete(k);
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    };
    addEventListener('keydown', this.onKey); addEventListener('keyup', this.onKey);
  }
  turnAim(d) { if (this.mode === 'ride' && this.ride.type === 'tank') this.aim += d; else this.camYaw += d; }
  tip(text) { if (!this.tipEl) return; this.tipEl.textContent = text; this.tipEl.style.opacity = '1'; clearTimeout(this.tipT); this.tipT = setTimeout(() => { if (this.tipEl) this.tipEl.style.opacity = '0'; }, 4500); }
  setView(v) {
    this.view = v; const cam = this.ctx.camera;
    cam.fov = v === 'first' ? 72 : 60; cam.updateProjectionMatrix(); this.near = v === 'first' ? 0.15 : 0.5; this.snap = true;
    SEE.on = v === 'first' ? false : this.saved.see;
    this.ov.classList.toggle('first', v === 'first'); this.viewBtn.textContent = v === 'first' ? '3rd person' : '1st person';
  }
  stop(quiet = false) {
    if (!this.active) return;
    const g = this.g, { camera, controls, post } = this.ctx, scene = g.disasters.ctx.scene;
    this.active = false; document.body.classList.remove('zd-flying');
    const free = (o) => { scene.remove(o); o.traverse(m => { if (m.geometry) m.geometry.dispose(); if (m.material) m.material.dispose(); }); };
    free(this.cop); for (const r of this.parked) free(r.obj); if (this.ride) free(this.ride.obj); for (const s of this.shells) free(s.m); for (const t of this.tracers) free(t.m);
    this.parked = []; this.ride = null; this.shells = []; this.tracers = [];
    this.ov.remove(); this.bar.remove(); removeEventListener('keydown', this.onKey); removeEventListener('keyup', this.onKey); clearTimeout(this.tipT); this.tipEl = null;
    if (g.audio) g.audio.engine(null);
    camera.fov = this.saved.fov; camera.far = this.saved.far; camera.up.set(0, 1, 0); camera.updateProjectionMatrix(); post.opts.dof = this.saved.dof; SEE.on = this.saved.see;
    const B = g.city.bounds, x = Math.max(B.x0, Math.min(B.x1, this.pos.x)), z = Math.max(B.z0, Math.min(B.z1, this.pos.z));
    controls.target.set(x, 0, z); camera.position.set(x + 50, 200, z + 150); camera.lookAt(controls.target); controls.enabled = true; controls.update();
    g.focusAt = null;
    if (!quiet) g.toast('Back to the view from above', 2500);
  }

  // into the nearest car close by (one of ours, or a police car or fire truck out on a call), or out of the one we are in
  door() {
    if (this.kind !== 'cop') return;
    const g = this.g;
    if (this.mode === 'ride') { // out on the driver's side, the car left where it stands
      const r = this.ride, [fx, fz] = fwd(r.yaw), sx = fz, sz = -fx; // its left
      this.parked.push(r); this.ride = null; this.mode = 'foot'; this.v = 0;
      let ox = r.x + sx * (r.R.r + 1), oz = r.z + sz * (r.R.r + 1); if (this.blocked(ox, oz, 0.4)) { ox = r.x - sx * (r.R.r + 1); oz = r.z - sz * (r.R.r + 1); }
      this.pos.set(ox, 0, oz); this.yaw = this.camYaw = r.yaw; this.cop.visible = true; this.snap = true;
      if (g.audio) g.audio.engine(null);
      return;
    }
    const near = this.nearRide(); if (!near) { this.tip('Walk up to a police car, a fire truck or an ambulance to get in'); return; }
    if (near.car) { // one out on a call: it leaves the traffic and is ours
      const c = near.car, type = c.kind === 'fire' ? 'fire' : 'police', yaw = Math.atan2(-c.hz, c.hx);
      g.traffic.remove(c); near.ride = this.makeRide(type, c.x, c.z, yaw);
    } else this.parked.splice(this.parked.indexOf(near.ride), 1);
    this.ride = near.ride; this.mode = 'ride'; this.yaw = this.ride.yaw; this.camYaw = this.yaw; this.v = 0; this.cop.visible = false; this.snap = true;
    this.tip('Driving the ' + this.ride.R.name.toLowerCase() + '. Get out when you want to walk');
  }
  nearRide() {
    let best = null, bd = 5.5;
    for (const r of this.parked) { const d = Math.hypot(r.x - this.pos.x, r.z - this.pos.z) - r.R.r; if (d < bd) { bd = d; best = { ride: r }; } }
    const T = this.g.traffic;
    if (T) for (const c of T.missions) { if (c.gone || (c.kind !== 'police' && c.kind !== 'fire') || c.mode > 1) continue; const d = Math.hypot(c.x - this.pos.x, c.z - this.pos.z) - 2; if (d < bd) { bd = d; best = { car: c }; } }
    return best;
  }
  blocked(x, z, r) { let hit = false; this.g.city.buildingsNear(x, z, r, () => { hit = true; }); const B = this.g.city.bounds; return hit || x < B.x0 - 40 || x > B.x1 + 40 || z < B.z0 - 40 || z > B.z1 + 40; }
  // a step to (nx, nz), sliding along a wall it meets; false if it could not move at all
  step(nx, nz, r) {
    const p = this.pos;
    if (!this.blocked(nx, nz, r)) { p.x = nx; p.z = nz; return true; }
    if (!this.blocked(nx, p.z, r)) { p.x = nx; return true; }
    if (!this.blocked(p.x, nz, r)) { p.z = nz; return true; }
    return false;
  }
  // a zombie outbreak somewhere ahead (a chemical tanker crash, as the Sandbox's toxic spill), for the officer to stop
  spill() {
    if (this.spillT > 0) { this.tip('Give it a moment'); return; }
    const [fx, fz] = fwd(this.camYaw), D = this.g.disasters; this.spillT = 15;
    D.start('spill', this.pos.x + fx * 60, this.pos.z + fz * 60, { max: 18 }); this.tip('A tanker has crashed up ahead. Zombies are coming!');
  }

  fire() {
    if (this.coolT > 0) return;
    const g = this.g, scene = g.disasters.ctx.scene;
    if (this.mode === 'ride' && this.ride.type === 'tank') { // a shell from the muzzle, along the gun
      const r = this.ride, t = r.obj.userData.turret; this.coolT = 1.6;
      r.obj.updateMatrixWorld(true); const mz = r.obj.userData.muzzle.clone(); t.localToWorld(mz);
      const a = r.yaw + this.aim, [fx, fz] = fwd(a);
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.25, 6, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.2, 0.8) })); m.position.copy(mz); scene.add(m);
      this.shells.push({ m, x: mz.x, y: mz.y, z: mz.z, vx: fx * 150, vy: 1.5, vz: fz * 150, t: 0 });
      g.fire.burst(mz.x, mz.y, mz.z, 6, 1.2); sfx('boom', mz.x, mz.y, mz.z, { gain: 0.7 }); g.shake = Math.max(g.shake || 0, 0.25); this.kick = 1;
      return;
    }
    if (this.mode !== 'foot') { this.tip('Get out of the car to shoot'); return; }
    // the pistol: the nearest zombie within reach in front of the officer; nobody else is ever hit
    this.coolT = 0.35; this.yaw = this.camYaw; this.aimT = 0.6;
    const P = g.people, [fx, fz] = fwd(this.camYaw), x = this.pos.x, z = this.pos.z; let best = -1, bd = 45;
    P.around(x, z, 45, (j) => {
      if (P.st[j] !== ST.ZOMBIE) return;
      const dx = P.x[j] - x, dz = P.z[j] - z, d = Math.hypot(dx, dz) || 1; if ((dx * fx + dz * fz) / d < 0.95 || d >= bd) return; // within about 18 degrees
      bd = d; best = j;
    });
    const tx = best >= 0 ? P.x[best] : x + fx * 30, tz = best >= 0 ? P.z[best] : z + fz * 30, ty = best >= 0 ? P.y[best] + 1.2 : 1.3;
    P.events.push({ type: 'shot', x, z, tx, tz }); // the bang, and the zombies near hear it
    if (best >= 0 && P.r() < 0.9) P.kill(best, (tx - x) * 0.5, (tz - z) * 0.5, 'shot');
    const gy = this.groundY(x, z) + 1.3, geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x + fx * 0.5, gy, z + fz * 0.5), new THREE.Vector3(tx, ty, tz)]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#fff3a0', transparent: true, opacity: 0.9 })); scene.add(line); this.tracers.push({ m: line, t: 0.08 });
  }
  shellStep(h) {
    const g = this.g, city = g.city, D = g.disasters;
    for (const s of this.shells) {
      s.t += h; s.vy -= 9.8 * 0.3 * h; s.x += s.vx * h; s.y += s.vy * h; s.z += s.vz * h; s.m.position.set(s.x, s.y, s.z);
      let hit = -1, top = this.groundY(s.x, s.z) + 0.2; city.buildingsNear(s.x, s.z, 0.6, (k, d, b) => { if (s.y < b.roofY && hit < 0) hit = k; });
      if (hit < 0 && s.y > top && s.t < 3.5) continue;
      s.done = true;
      g.fire.blast(s.x, s.z, 9); g.people.blast(s.x, s.z, 6); // the airstrike's burst, smaller (the kaiju and the tripods feel it)
      for (const e of D.list) if (e.alive && e.type === 'kaiju' && e.state !== 'leave' && Math.hypot(e.x - s.x, e.z - s.z) < 40) { e.damage(30); this.tip('Hit! The kaiju is down to ' + Math.max(0, Math.round(e.hp)) + ' of 1200'); }
      if (hit >= 0) { const b = city.buildings[hit]; if (!b.landmark && b.roofY < 22 && Math.random() < 0.4) D.destroyBuilding(hit, 'collapse'); else D.blowWindows(hit, s.vx / 150, s.vz / 150, 0.8); }
      for (const c of g.traffic.parkedNear(s.x, s.z, 4)) { g.traffic.takeParked(c); g.fire.burst(c.x, 1, c.z, 8, 2); }
      g.traffic.near(s.x, s.z, 6, (c) => { if (!c.gone && !c.mission) g.traffic.fling(c, (c.x - s.x) * 2, 6, (c.z - s.z) * 2); });
    }
    if (this.shells.some(s => s.done)) this.shells = this.shells.filter(s => { if (s.done) { g.disasters.ctx.scene.remove(s.m); s.m.geometry.dispose(); s.m.material.dispose(); } return !s.done; });
  }

  // a frame (real time; held while paused): move, the camera, what the HUD says
  frame(dt, tg) {
    const g = this.g, cam = this.ctx.camera, K = this.keys, run = !g.paused && dt > 0;
    let ix = this.ix, iy = this.iy;
    if (K.has('arrowleft') || K.has('a')) ix = -1; if (K.has('arrowright') || K.has('d')) ix = 1;
    if (K.has('arrowup') || K.has('w')) iy = 1; if (K.has('arrowdown') || K.has('s')) iy = -1;
    if (K.has('j')) this.turnAim(dt * 1.8); if (K.has('l')) this.turnAim(-dt * 1.8);
    if (run) {
      this.coolT = Math.max(0, this.coolT - dt); this.spillT = Math.max(0, this.spillT - dt);
      if (this.shells.length) this.shellStep(dt);
      for (const t of this.tracers) t.t -= dt;
      if (this.tracers.some(t => t.t <= 0)) this.tracers = this.tracers.filter(t => { if (t.t <= 0) { g.disasters.ctx.scene.remove(t.m); t.m.geometry.dispose(); t.m.material.dispose(); } return t.t > 0; });
      if (this.mode === 'foot') this.walk(dt, ix, iy); else this.drive(dt, ix, iy);
    }
    // where things are drawn
    const y = this.groundY(this.pos.x, this.pos.z);
    if (this.mode === 'foot') {
      const c = this.cop, u = c.userData, sw = Math.sin(this.walkT * 9) * Math.min(1, this.spd || 0) * 0.6;
      c.position.set(this.pos.x, y, this.pos.z); c.rotation.y = this.yaw;
      u.legL.rotation.z = sw; u.legR.rotation.z = -sw; u.armL.rotation.z = -sw * 0.8;
      u.armR.rotation.z = (this.aimT || 0) > 0 ? Math.PI / 2 : sw * 0.8; this.aimT = Math.max(0, (this.aimT || 0) - dt); // the gun arm up while shooting
    } else {
      const r = this.ride; r.obj.position.set(r.x, this.groundY(r.x, r.z), r.z); r.obj.rotation.y = r.yaw;
      if (r.type === 'tank') { const t = r.obj.userData.turret; t.rotation.y = this.aim; this.kick = Math.max(0, (this.kick || 0) - dt * 4); t.position.x = -0.6 - this.kick * 0.3; }
    }
    // the camera: behind (easing after it) or in the seat / at eye height (the officer, the car or the tank then not drawn: it filled the view)
    const first = this.view === 'first'; this.cop.visible = this.mode === 'foot' && !first; if (this.ride) this.ride.obj.visible = !first;
    const ride = this.mode === 'ride' ? this.ride : null, tank = ride && ride.type === 'tank';
    if (ride && !tank) { let d = ride.yaw - this.camYaw; d = Math.atan2(Math.sin(d), Math.cos(d)); this.camYaw += d * Math.min(1, dt * 3); } // the car's camera swings round behind it
    const look = tank ? ride.yaw + this.aim : this.camYaw, [fx, fz] = fwd(look), px = ride ? ride.x : this.pos.x, pz = ride ? ride.z : this.pos.z;
    if (this.view === 'first') {
      if (ride) { const S = ride.R.seat, [hx, hz] = fwd(ride.yaw); cam.position.set(px + hx * S[0], y + S[1], pz + hz * S[0]); }
      else cam.position.set(px + fx * 0.15, y + 1.62, pz + fz * 0.15);
      cam.up.set(0, 1, 0); cam.lookAt(cam.position.x + fx * 10, cam.position.y - (ride ? 0.4 : 0.6), cam.position.z + fz * 10);
    } else {
      const [back, hi] = ride ? ride.R.chase : [5.2, 2.3];
      _v.set(px - fx * back, y + hi, pz - fz * back);
      if (this.snap) cam.position.copy(_v); else cam.position.lerp(_v, 1 - Math.exp(-dt * 7));
      cam.up.set(0, 1, 0); cam.lookAt(px + fx * (ride ? 6 : 3), y + (ride ? 1.6 : 1.4), pz + fz * (ride ? 6 : 3));
    }
    this.snap = false;
    this.focus = Math.max(5, cam.position.distanceTo(_u.set(px, y + 1, pz)));
    tg.set(px, 0, pz); g.focusAt = _u.set(px, y + 1, pz).clone();
    if ((this.hudT = (this.hudT || 0) - dt) <= 0) {
      this.hudT = 0.2;
      const near = this.mode === 'foot' && this.kind === 'cop' ? this.nearRide() : null;
      this.hud.textContent = this.mode === 'foot' ? 'POLICE OFFICER · ON FOOT · ' + g.people.stats.zombies + ' zombies' : ride.R.name.toUpperCase() + ' · ' + Math.round(Math.abs(this.v) * KMH) + ' km/h';
      if (this.doorBtn) { this.doorBtn.textContent = this.mode === 'ride' ? 'Get out' : near ? 'Get in' : 'Get in'; this.doorBtn.classList.toggle('off', this.mode === 'foot' && !near); }
      this.fireBtn.classList.toggle('wait', this.coolT > 0 || (this.mode === 'ride' && !tank)); this.fireBtn.classList.toggle('off', this.mode === 'ride' && !tank);
      if (g.audio) g.audio.engine(ride ? (tank ? 'tank' : 'car') : null, Math.min(1, Math.abs(this.v) / (ride ? ride.R.max : 1)));
    }
  }
  // on foot: the stick walks across the screen (up away from the camera), the officer turning the way they go
  walk(h, ix, iy) {
    const m = Math.min(1, Math.hypot(ix, iy)); this.spd = m;
    if (m < 0.1) return;
    const [fx, fz] = fwd(this.camYaw), sx = -fz, sz = fx; // the camera's forward and its right
    const wx = fx * iy + sx * ix, wz = fz * iy + sz * ix, wl = Math.hypot(wx, wz) || 1;
    if (this.view === 'first') this.yaw = this.camYaw; else if ((this.aimT || 0) <= 0) { const want = Math.atan2(-wz, wx); let d = want - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); this.yaw += d * Math.min(1, h * 10); }
    this.walkT += h; this.step(this.pos.x + wx / wl * WALK * m * h, this.pos.z + wz / wl * WALK * m * h, 0.35);
  }
  // in a car or the tank: the stick's up and down the throttle (and reverse), its sides the steering (the tank turns on the spot)
  drive(h, ix, iy) {
    const r = this.ride, R = r.R;
    if (Math.abs(iy) > 0.08) { const to = iy > 0 ? R.max * iy : R.back * iy; this.v += Math.sign(to - this.v) * Math.min(Math.abs(to - this.v), R.acc * h * (Math.sign(to) !== Math.sign(this.v) && Math.abs(this.v) > 1 ? 2 : 1)); }
    else this.v *= Math.exp(-h * 0.8);
    const turnK = R.pivot ? 1 : Math.max(-1, Math.min(1, this.v / 6));
    r.yaw -= ix * R.turn * turnK * h;
    const [fx, fz] = fwd(r.yaw);
    this.pos.set(r.x, 0, r.z);
    if (!this.step(r.x + fx * this.v * h, r.z + fz * this.v * h, R.r)) { if (Math.abs(this.v) > 6) { sfx('crash', r.x, 1, r.z, { gain: 0.5 }); this.g.shake = Math.max(this.g.shake || 0, 0.2); } this.v = 0; }
    r.x = this.pos.x; r.z = this.pos.z;
    // what it drives into: the tank flattens parked cars and shoves the traffic aside; people get out of the way
    if (Math.abs(this.v) > 2 && (this.bumpT = (this.bumpT || 0) - h) <= 0) {
      this.bumpT = 0.25; const T = this.g.traffic;
      this.g.people.scare(r.x + fx * 8, r.z + fz * 8, 12, 0.6);
      if (r.type === 'tank') { for (const c of T.parkedNear(r.x, r.z, 3)) { T.takeParked(c); sfx('crash', c.x, 1, c.z, { gain: 0.6 }); } T.near(r.x, r.z, 4, (c) => { if (!c.gone && !c.mission && c.mode !== 3) T.crash(c, null, 6); }); }
    }
  }
}
