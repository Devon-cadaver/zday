// Disaster TV's cameras: the news helicopter (SKY 7, and SKY 4 to fall back on)
// circling the action with a little sway, and cameras on the roofs of the town's
// tallest buildings, panning after it. The director cuts between them now and
// then. A disaster can notice a camera and go for it - a beam from a kaiju, a
// villain or an alien machine; debris or a lava bomb hurled at it; a solar flare,
// dust or ice drowning the signal; the building brought down under it - and the
// picture tumbles, breaks up into static (SIGNAL LOST), and cuts to another one.
import * as THREE from 'three';
import { sfx } from './audio.js';

const CSS = `
#zd-cam{position:fixed;left:max(10px, env(safe-area-inset-left));top:calc(34px + env(safe-area-inset-top));z-index:6;pointer-events:none;
  font:800 10px/1 system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.08em;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.8)}
#zd-cam i{display:inline-block;width:7px;height:7px;border-radius:50%;background:#ff3a2a;margin-right:5px;animation:zdlive 1s infinite}
#zd-cam span{opacity:.75;margin-left:6px}
#zd-frame{position:fixed;inset:calc(64px + env(safe-area-inset-top)) 14px calc(var(--zd-bar-h, 64px) + 44px);z-index:5;pointer-events:none;opacity:.55}
#zd-frame b{position:absolute;width:22px;height:22px;border:2px solid #fff}
#zd-frame b:nth-child(1){left:0;top:0;border-right:0;border-bottom:0}#zd-frame b:nth-child(2){right:0;top:0;border-left:0;border-bottom:0}
#zd-frame b:nth-child(3){left:0;bottom:0;border-right:0;border-top:0}#zd-frame b:nth-child(4){right:0;bottom:0;border-left:0;border-top:0}
#zd-static{position:fixed;inset:0;z-index:7;pointer-events:none;opacity:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
  font:900 22px/1.3 system-ui,-apple-system,"Segoe UI",sans-serif;color:#fff;letter-spacing:.12em;text-shadow:0 2px 4px #000;background-size:160px 160px}
#zd-static small{font-size:11px;letter-spacing:.1em;opacity:.85}
`;

// how each disaster goes for a camera: beam, a thing hurled at it, the signal drowned, or the building brought down
const STYLE = { kaiju: 'beam', villains: 'beam', aliens: 'beam', worm: 'hurl', tornado: 'hurl', volcano: 'hurl', meteor: 'hurl', riot: 'hurl', blackhole: 'pull',
  solar: 'static', haboob: 'static', coldwave: 'static', quake: 'fell', sinkhole: 'fell', flood: 'fell', tsunami: 'fell' };
const WHO = { kaiju: 'The kaiju', villains: 'The villains', aliens: 'The aliens', worm: 'The worm', tornado: 'The tornado', volcano: 'The volcano', meteor: 'A meteor', riot: 'The rioters', blackhole: 'The black hole',
  solar: 'The solar flare', haboob: 'The dust storm', coldwave: 'The cold wave', quake: 'The quake', sinkhole: 'The sinkhole', flood: 'The flood', tsunami: 'The wave' };
const SKY_OK = new Set(['beam', 'hurl', 'pull', 'static']); // what can reach a helicopter

export class TvCam {
  constructor(tv) {
    this.tv = tv; this.g = tv.g;
    if (!document.getElementById('zd-tvcam-css')) { const s = document.createElement('style'); s.id = 'zd-tvcam-css'; s.textContent = CSS; document.head.appendChild(s); }
    this.label = document.createElement('div'); this.label.id = 'zd-cam';
    this.frameEl = document.createElement('div'); this.frameEl.id = 'zd-frame'; this.frameEl.innerHTML = '<b></b><b></b><b></b><b></b>';
    this.stat = document.createElement('div'); this.stat.id = 'zd-static';
    { const c = document.createElement('canvas'); c.width = c.height = 96; const x = c.getContext('2d'), im = x.createImageData(96, 96); for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; } x.putImageData(im, 0, 0); this.stat.style.backgroundImage = 'url(' + c.toDataURL() + ')'; }
    document.body.append(this.label, this.frameEl, this.stat);
    const c = this.g.controls; this.saved = { min: c.minDistance, max: c.maxDistance, p0: c.minPolarAngle, p1: c.maxPolarAngle, en: c.enabled };
    c.minDistance = 1; c.maxDistance = 6000; c.minPolarAngle = 0; c.maxPolarAngle = Math.PI; c.enabled = false; // the director holds the camera
    const o = this.g.post.opts; this.dof0 = { bandK: o.bandK, rangeK: o.rangeK, blurFrac: o.blurFrac }; // the tilt-shift look, put back after
    this.L = new THREE.Vector3(); this.P = new THREE.Vector3(); this.F = new THREE.Vector3(); this.fx = []; this.t = 0;
  }
  dispose() {
    Object.assign(this.g.post.opts, this.dof0);
    const c = this.g.controls, s = this.saved; c.minDistance = s.min; c.maxDistance = s.max; c.minPolarAngle = s.p0; c.maxPolarAngle = s.p1; c.enabled = s.en;
    this.label.remove(); this.frameEl.remove(); this.stat.remove(); this.clearFx(); this.g.focusAt = null;
  }
  clearFx() { for (const e of this.fx) { this.g.disasters.ctx.scene.remove(e.m); e.m.material.dispose(); } this.fx.length = 0; }

  // a new town: two helicopters, and cameras on the roofs of its tallest buildings, well apart
  setup() {
    const city = this.g.city, B = city.buildings, Bd = city.bounds, mid = [(Bd.x0 + Bd.x1) / 2, (Bd.z0 + Bd.z1) / 2];
    this.clearFx(); this.cams = [{ kind: 'heli', name: 'SKY 7', alive: true }, { kind: 'heli', name: 'SKY 4', alive: true }];
    const order = B.map((b, k) => k).filter(k => !city.dead[k] && B[k].landmark !== 'Stadium').sort((a, b) => (B[b].top - B[b].baseY) - (B[a].top - B[a].baseY));
    const span = Math.max(50, Math.min(Bd.x1 - Bd.x0, Bd.z1 - Bd.z0) * 0.2);
    for (const k of order) {
      if (this.cams.filter(c => c.kind === 'roof').length >= 5) break;
      const b = B[k], x = (b.x0 + b.x1) / 2, z = (b.z0 + b.z1) / 2;
      if (this.cams.some(c => c.kind === 'roof' && Math.hypot(c.x - x, c.z - z) < span)) continue;
      // at the corner of the roof nearest the middle of town, looking in
      const cx = mid[0] < x ? b.x0 + 1 : b.x1 - 1, cz = mid[1] < z ? b.z0 + 1 : b.z1 - 1;
      this.cams.push({ kind: 'roof', k, x: cx, z: cz, y: b.top + 2.5, alive: true, name: 'ROOF CAM ' + (this.cams.length - 1) + ' · ' + this.g.disasters.district(x, z).toUpperCase() });
    }
    this.cur = null; this.attack = null; this.lost = 0; this.cutT = 3; this.calmT = 0; this.heli = { ang: Math.random() * 6.28 }; this.L.set(mid[0], 0, mid[1]); this.have = false;
    this.pick(true);
  }

  // where to look: the newest disaster (or what is left of it), else the middle of town
  want() {
    const g = this.g, tv = this.tv, c = tv.cur, D = g.disasters;
    const parts = c ? [].concat(c.who || [], c.tripods || [], c.saucers || []) : [];
    const sub = g.subjects('bad').find(s => s.obj === c || parts.includes(s.obj));
    let p = sub ? sub.pos() : null, sh = p && g.shot ? g.shot(sub) : null;
    if (!p) for (const e of D.list) { if (!e.alive || e.type === 'heroes' || e.type === 'player') continue; p = g.disasterAt(e); if (p) { sh = g.disasterShot ? g.disasterShot(e) : null; break; } }
    if (sh && sh.dist) this.dist = sh.dist; // how far back the follow camera would stand for it: the helicopter keeps about that
    return p;
  }

  // the camera to cut to: SKY 7 or SKY 4 if one is still flying (alternating with the roofs), else the roof camera best placed
  pick(sky) {
    const a = this.L, live = this.cams.filter(c => c.alive && c !== this.cur && (c.kind === 'heli' || !this.g.city.dead[c.k]));
    const heli = live.find(c => c.kind === 'heli'), roofs = live.filter(c => c.kind === 'roof');
    roofs.sort((p, q) => Math.abs(Math.hypot(p.x - a.x, p.z - a.z) - 170) - Math.abs(Math.hypot(q.x - a.x, q.z - a.z) - 170)); // not too close, not too far
    let next = (sky && heli) || (!sky && roofs[0]) || heli || roofs[0] || (this.cur && this.cur.alive ? this.cur : null);
    if (!next) { next = { kind: 'heli', name: 'SKY ' + (5 + this.cams.length), alive: true }; this.cams.push(next); } // every camera lost: the station sends up another helicopter
    if (next && next !== this.cur) { this.cur = next; this.onAirT = 0; this.tries = 0; if (next.kind === 'heli') this.heli.ang = Math.atan2(this.g.camera.position.z - a.z, this.g.camera.position.x - a.x); }
    this.cutT = 13 + Math.random() * 9;
    this.show();
  }
  show() { const c = this.cur; this.label.innerHTML = '<i></i>' + (c ? c.name : 'NO SIGNAL') + (c && c.kind === 'heli' ? '<span>ALT ' + Math.round(this.P.y * 3.28) + ' FT</span>' : ''); }

  update(dt, sdt) {
    const g = this.g, cam = g.camera, tg = g.controls.target;
    this.t += dt;
    const p = this.want();
    if (p) { const k = 1 - Math.exp(-dt * 2); this.L.x += (p[0] - this.L.x) * k; this.L.y += ((p[1] || 0) * 0.6 - this.L.y) * k; this.L.z += (p[2] - this.L.z) * k; }
    const c = this.cur; if (!c) return;
    // an attack in progress, then static, then the cut
    if (this.attack) this.attackStep(dt, sdt);
    if (this.lost > 0) { this.lost -= dt; this.stat.style.opacity = '1'; this.stat.style.backgroundPosition = Math.floor(Math.random() * 160) + 'px ' + Math.floor(Math.random() * 160) + 'px'; if (this.lost <= 0) { this.stat.style.opacity = '0'; this.pick(true); } return; }
    if (!this.attack) {
      this.onAirT += sdt;
      if (c.kind === 'roof' && g.city.dead[c.k]) { this.signalLost(c, 'ROOF CAM DOWN'); return; } // the building went down by itself
      if ((this.cutT -= dt) <= 0) this.pick(c.kind !== 'heli');
      this.maybeAttack(sdt);
    }
    // where the camera is this frame
    const a = this.L;
    if (c.kind === 'heli') {
      const h = this.heli; h.ang += dt * 0.07;
      const dd = Math.max(220, Math.min(700, (this.dist || 260) * 1.2)), R = dd * 0.82, H = dd * 0.57 + a.y * 0.5, sx = Math.sin(this.t * 0.6) * 3, sy = Math.sin(this.t * 0.9) * 2; // further off for a kaiju than a villain
      this.P.set(a.x + Math.cos(h.ang) * R + sx, H + sy, a.z + Math.sin(h.ang) * R);
      this.F.set(a.x + Math.sin(this.t * 1.3) * 1.5, a.y + Math.sin(this.t * 1.7) * 1.2, a.z);
    } else {
      this.P.set(c.x, c.y, c.z); this.F.copy(a);
    }
    if (this.attack && this.attack.fall) { const f = this.attack.fall; this.P.y -= f.drop; this.F.x += f.tilt * 30; this.F.y += f.tilt * 60; this.P.x += Math.sin(this.t * 30) * f.shake; this.P.z += Math.cos(this.t * 27) * f.shake; }
    cam.position.copy(this.P); tg.copy(this.F); cam.lookAt(this.F); g.zoomTo = 0;
    { // a rooftop looks across the town: a much deeper sharp band and softer blur than the miniature look (Sean: too blurry); the helicopter a little deeper too
      const o = g.post.opts, d = this.dof0, roof = c.kind === 'roof', k = 1 - Math.exp(-dt * 4);
      o.bandK += ((roof ? 0.2 : d.bandK * 1.6) - o.bandK) * k; o.rangeK += ((roof ? 0.9 : d.rangeK * 1.4) - o.rangeK) * k; o.blurFrac += ((roof ? 0.011 : d.blurFrac) - o.blurFrac) * k;
    }
    g.focusAt = this.F; // the depth of field on the action
    if (c.kind === 'heli' && (this.labT = (this.labT || 0) - dt) <= 0) { this.labT = 0.5; this.show(); }
  }

  // now and then the disaster notices the camera: after a while on air, a chance every few seconds (twice a disaster at most)
  maybeAttack(sdt) {
    const c = this.cur, kind = this.tv.kind, style = STYLE[kind]; if (!style || this.tv.leaving >= 0) return;
    if (c.kind === 'heli' && !SKY_OK.has(style)) return;
    if (this.onAirT < (c.kind === 'heli' ? 12 : 8) || (this.tv.attacks || 0) >= 2) return;
    if ((this.tryT = (this.tryT || 0) - sdt) > 0) return;
    this.tryT = 5;
    if (Math.random() > (c.kind === 'heli' ? 0.3 : 0.35) || !this.want()) return;
    this.tv.attacks = (this.tv.attacks || 0) + 1;
    const what = c.kind === 'heli' ? c.name : 'the ' + c.name.split(' · ')[0].toLowerCase();
    this.tv.hits.say(WHO[kind] + ' spotted ' + what + '!', 'small');
    this.tv.say((WHO[kind] || 'The disaster') + ' has spotted our ' + (c.kind === 'heli' ? 'helicopter' : 'rooftop camera') + '!');
    this.attack = { style, t: 0, cam: c, hit: false };
  }

  attackStep(dt, sdt) {
    const A = this.attack, D = this.g.disasters, { scene, fire, city } = D.ctx, c = A.cam;
    A.t += dt;
    const from = this.want() || [this.L.x, this.L.y, this.L.z], to = [this.P.x, this.P.y - 2, this.P.z];
    if (A.style === 'beam' && A.t > 1.0 && !A.m) { // a beam straight at us, then the hit
      A.m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 8, 1, true).translate(0, 0.5, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 0.5, 0.3), transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      A.m.frustumCulled = false; A.m.renderOrder = 8; scene.add(A.m); this.fx.push({ m: A.m }); sfx('laser', from[0], from[1], from[2], { gain: 1.2 });
    }
    if (A.m) { const v = new THREE.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]), L = v.length(); A.m.position.set(from[0], from[1] + 4, from[2]); A.m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize()); A.m.scale.set(0.6, L * Math.min(1, (A.t - 1.0) / 0.25), 0.6); }
    if (A.style === 'hurl' && A.t > 0.8) { // a glowing lump hurled at us
      if (!A.ball) { A.ball = new THREE.Mesh(new THREE.SphereGeometry(2.2, 12, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.4, 0.4), fog: false })); scene.add(A.ball); this.fx.push({ m: A.ball }); A.p0 = from.slice(); }
      const u = Math.min(1, (A.t - 0.8) / 1.0); A.ball.position.set(A.p0[0] + (to[0] - A.p0[0]) * u, A.p0[1] + (to[1] - A.p0[1]) * u + Math.sin(u * Math.PI) * 40, A.p0[2] + (to[2] - A.p0[2]) * u); fire.burst(A.ball.position.x, A.ball.position.y, A.ball.position.z, 2, 1.6);
    }
    if (A.style === 'static' || A.style === 'pull') { const k = Math.min(1, A.t / 2.2); this.stat.style.opacity = String(k * 0.85); this.stat.style.backgroundPosition = Math.floor(Math.random() * 160) + 'px ' + Math.floor(Math.random() * 160) + 'px'; if (A.style === 'pull') { A.fall = A.fall || { drop: 0, tilt: 0, shake: 0 }; A.fall.tilt = k * 0.8; A.fall.shake = k * 3; } }
    if (A.style === 'fell' && A.t > 0.6 && !A.hit) { A.hit = true; if (c.kind === 'roof' && !city.dead[c.k]) D.destroyBuilding(c.k, 'collapse'); D.shake(1.2); A.fall = { drop: 0, tilt: 0, shake: 1 }; }
    const hitAt = A.style === 'beam' ? 1.3 : A.style === 'hurl' ? 1.8 : A.style === 'fell' ? 99 : 2.2;
    if (!A.hit && A.t >= hitAt) {
      A.hit = true;
      if (A.style === 'beam' || A.style === 'hurl') { fire.burst(this.P.x, this.P.y - 3, this.P.z, 30, 3); sfx('boomBig', this.P.x, this.P.y, this.P.z); D.flash(0.5); if (c.kind === 'roof' && !city.dead[c.k]) D.destroyBuilding(c.k, 'collapse'); }
      A.fall = A.fall || { drop: 0, tilt: 0, shake: 0 }; A.fall.shake = 2;
    }
    if (A.fall && A.hit) { A.fall.drop += dt * (c.kind === 'heli' ? 40 : 18); A.fall.tilt = Math.min(1, A.fall.tilt + dt * 1.4); }
    if (A.hit && (A.hitT = (A.hitT || 0) + dt) > (A.style === 'fell' ? 1.2 : 0.8)) { this.attack = null; for (const e of this.fx) { scene.remove(e.m); e.m.material.dispose(); } this.fx.length = 0; this.signalLost(c, c.kind === 'heli' ? c.name + ' IS DOWN' : 'ROOF CAM DOWN'); }
  }

  signalLost(c, why) {
    c.alive = false; this.lost = 1.2; this.stat.style.opacity = '1';
    const next = this.cams.filter(q => q.alive && (q.kind === 'heli' || !this.g.city.dead[q.k]));
    this.stat.innerHTML = 'SIGNAL LOST<small>' + why + (next.length ? ' · SWITCHING CAMERAS' : '') + '</small>';
    this.tv.say(why === 'ROOF CAM DOWN' ? 'We have lost a rooftop camera!' : 'We have lost ' + c.name + '! Our crew is safe');
  }
}
