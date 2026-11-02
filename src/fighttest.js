// The fight test (Sean: pick one fight and nail the combat, with no circles to tap). Nova against Tyrant on a bare plaza, a steady
// iso camera, a health bar each. Tap anywhere: the hero lunges and strikes, in rhythm a combo (jab, jab, cross). Tap, tap, hold: an
// uppercut that launches them, then tap to slam them down. Hold from rest: a charged heavy. Swipe: a dodge that way; dodged just
// as a blow comes, time slows and a tap counters. Tyrant walks round the hero and has three attacks you read on the body and on
// the ground (jab, charge, grab), each stopped by a hit while winding up. Blows land only if the bodies really meet. Sandbox card;
// main.js hands it the camera like the planes. Leaving reloads the town, so nothing here has to be put back.
import * as THREE from 'three';
import { heroRig } from './heroes.js';
import { villainRig, relax, detail } from './villains.js';
import { CLIPS, playClip } from './clips.js';
import { Streak } from './streak.js';
import { sfx } from './audio.js';
import { placeKey, travel } from './places.js';

const key = (t, p, ease) => ({ t, p, ease });
const still = (p) => ({ keys: [key(0, p)] });
const GUARD = CLIPS.guardL.keys[0].p;
const COILED = { bodyY: -0.1, torso: 0.45, chest: 0.2, head: -0.3, shL: { x: 0.5, z: -0.4 }, shR: { x: 0.5, z: 0.4 }, elL: -1.2, elR: -1.2, hipL: -0.6, hipR: -0.2, kneeL: 0.9, kneeR: 0.5 };
const KD = { body: -1.5, head: 0.3, shL: { x: -0.4, z: -1.1 }, shR: { x: -0.4, z: 1.1 }, elL: -0.4, elR: -0.3, hipL: -0.3, kneeL: 0.5, kneeR: 0.1 };
const C = {
  guard: still(GUARD),
  dodge: still({ body: 0.3, torso: 0.4, chest: 0.2, shL: { x: -0.3, z: -0.5 }, shR: { x: 0.5, z: 0.5 }, elL: -1.3, elR: -1.3, hipL: -0.8, kneeL: 1.2, hipR: 0.4, kneeR: 0.5 }),
  charge: { keys: [key(0, GUARD), key(0.3, CLIPS.hammerUp.keys[0].p, 'out')] },
  jabWind: { keys: [key(0, GUARD), key(0.45, { torso: { x: 0.05, y: 0.5 }, chest: { y: 0.4 }, shR: { x: 0.7, z: 0.5 }, elR: -2.0, shL: { x: -0.9, z: -0.2 }, elL: -1.8, kneeL: 0.3, kneeR: 0.5 }, 'in')] },
  chargeWind: { keys: [key(0, GUARD), key(0.6, COILED, 'in')] },
  rush: still({ body: 0.5, torso: 0.3, head: -0.5, shL: { x: 0.7, z: -0.5 }, shR: { x: -1.7, z: 0.2 }, elL: -1, elR: -0.3 }),
  grabWind: { keys: [key(0, GUARD), key(0.55, { torso: -0.15, chest: -0.15, shL: { x: -1.3, z: -0.6 }, shR: { x: -1.3, z: 0.6 }, elL: -0.5, elR: -0.5, kneeL: 0.4, kneeR: 0.4, bodyY: -0.06 }, 'in')] },
  grab: still({ torso: 0.2, shL: { x: -1.7, z: -0.2 }, shR: { x: -1.7, z: 0.2 }, elL: -0.2, elR: -0.2, kneeL: 0.3, kneeR: 0.3 }),
  hold: still({ torso: -0.2, chest: -0.1, shL: { x: -2.2, z: -0.25 }, shR: { x: -2.2, z: 0.25 }, elL: -0.3, elR: -0.3, kneeL: 0.4, kneeR: 0.3 }),
  held: still({ head: 0.4, shL: { x: -2.2, z: -0.3 }, shR: { x: -2.2, z: 0.3 }, elL: -1.4, elR: -1.4, hipL: 0.3, hipR: -0.3, kneeL: 0.6, kneeR: 0.4 }),
  block: { keys: [key(0, GUARD), key(0.1, { torso: 0.2, chest: 0.15, head: 0.25, shL: { x: -1.5, z: -0.1 }, shR: { x: -1.5, z: 0.1 }, elL: -2.2, elR: -2.2, hipL: -0.3, kneeL: 0.5, kneeR: 0.4, bodyY: -0.05 }, 'out')] },
  down: still(KD),
  getup: { keys: [key(0, KD), key(0.25, { body: -0.6, torso: 0.7, chest: 0.4, shL: { x: 0.4, z: -0.4 }, shR: { x: 0.4, z: 0.4 }, elL: -0.8, elR: -0.8, hipL: -1.2, hipR: -0.9, kneeL: 1.5, kneeR: 1.2 }, 'out'), key(0.55, GUARD, 'soft')] },
  stumble: still({ body: 0.25, torso: 0.5, head: 0.3, shL: { x: -0.2, z: -0.6 }, shR: { x: -0.2, z: 0.6 }, elL: -0.7, elR: -0.7, kneeL: 0.5, kneeR: 0.3 }),
};
// the hero's blows: the clip, when in it the blow lands, when it can be followed, what it does
const ATK = {
  jabL: { clip: CLIPS.jabL, at: 0.08, end: 0.24, dmg: 10, react: 'hitHeadR', kb: 4, stop: 0.05, shake: 0.12, reach: 3.3 },
  jabR: { clip: CLIPS.jabR, at: 0.08, end: 0.24, dmg: 10, react: 'hitHeadL', kb: 4, stop: 0.05, shake: 0.12, reach: 3.3 },
  cross: { clip: CLIPS.cross, at: 0.1, end: 0.42, dmg: 22, react: 'blownBack', knock: [17, 5], stop: 0.09, shake: 0.35, reach: 3.5 },
  upper: { clip: CLIPS.uppercut, at: 0.28, end: 0.56, dmg: 25, react: 'hitUp', launch: true, stop: 0.08, shake: 0.3, reach: 3.5 },
  heavy: { clip: CLIPS.hammerDown, at: 0.12, end: 0.45, dmg: 15, react: 'blownBack', knock: [14, 6], stop: 0.1, shake: 0.5, reach: 3.7 },
  counter: { clip: CLIPS.cross, at: 0.08, end: 0.4, dmg: 40, react: 'blownBack', knock: [22, 7], stop: 0.12, shake: 0.6, reach: 4 },
};
const COMBO = ['jabL', 'jabR', 'cross'];
const G = 24, ARENA = 40, TAP_MS = 220, SWIPE_PX = 26, COMBO_T = 0.6;
const CSS = `
#zd-fight{position:fixed;left:0;top:0;right:0;bottom:0;z-index:28;touch-action:none;user-select:none;-webkit-user-select:none;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#fff}
body.zd-flying #zd-bar,body.zd-flying #zd-dis,body.zd-flying #zd-followchip,body.zd-flying #zd-globe,body.zd-flying #zd-top{display:none!important}
#zd-fight .bars{position:absolute;left:12px;right:64px;top:calc(10px + env(safe-area-inset-top));display:flex;gap:10px;pointer-events:none;font:800 12px/1.2 system-ui,sans-serif;text-shadow:0 1px 3px #000}
#zd-fight .bars>div{flex:1 1 0;min-width:0}
#zd-fight .hp{height:12px;margin-top:3px;border-radius:6px;background:rgba(0,0,0,.55);overflow:hidden;border:1px solid rgba(255,255,255,.35)}
#zd-fight .hp i{display:block;height:100%;width:100%;transition:width .12s}
#zd-fight .say{position:absolute;left:0;right:0;top:calc(62px + env(safe-area-inset-top));text-align:center;font:900 24px/1.1 system-ui,sans-serif;text-shadow:0 2px 8px #000;pointer-events:none;opacity:0;transition:opacity .15s}
#zd-fight .hint{position:absolute;left:10px;right:10px;bottom:calc(58px + env(safe-area-inset-bottom));text-align:center;font:700 12px/1.45 system-ui,sans-serif;text-shadow:0 1px 3px #000;pointer-events:none;opacity:.9}
#zd-fight .acts{position:absolute;left:12px;bottom:calc(12px + env(safe-area-inset-bottom));display:flex;gap:8px}
#zd-fight button{appearance:none;border:2px solid rgba(255,255,255,.35);border-radius:12px;padding:9px 14px;font:800 12px system-ui,sans-serif;color:#fff;background:rgba(40,20,60,.85);cursor:pointer}
#zd-fight .end{position:absolute;left:50%;top:42%;transform:translate(-50%,-50%);padding:18px 26px;border-radius:16px;background:rgba(20,10,30,.9);border:1px solid rgba(255,255,255,.25);text-align:center;font:900 22px system-ui,sans-serif}
#zd-fight .end button{display:block;width:100%;margin-top:12px;background:linear-gradient(#ff5ad5,#a0168a)}
`;
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();

class Body {
  constructor(r, hpMax) {
    this.r = r; this.hp = this.hpMax = hpMax; this.x = 0; this.y = 0; this.z = 0; this.vx = 0; this.vz = 0; this.vy = 0; this.yaw = 0; this.state = 'idle'; this.t = 0; this.clip = C.guard; this.ct = 0; this.blend = 1; this.phase = 0; this.walkK = 0;
    this.joints = [r.body, r.torso, r.chest, r.head]; for (const a of r.arms) this.joints.push(a.sh, a.el, a.wr); for (const l of r.legs) this.joints.push(l.hip, l.knee, l.ank); this.snap = this.joints.map(() => new THREE.Euler());
  }
  play(clip) { this.clip = clip; this.ct = 0; this.blend = 0; this.joints.forEach((j, i) => this.snap[i].copy(j.rotation)); }
  go(state, clip) { this.state = state; this.t = 0; if (clip) this.play(clip); }
  // the pose: the clip, walking legs over it, eased from the last pose so nothing snaps
  pose(dt, top, grounded) {
    const r = this.r; this.ct += dt; relax(r); playClip(r, this.clip, this.ct);
    if (this.walkK > 0.02) { const s = Math.sin(this.phase) * this.walkK, c = Math.cos(this.phase); r.legs[0].hip.rotation.x += s * 0.7; r.legs[1].hip.rotation.x -= s * 0.7; r.legs[0].knee.rotation.x += Math.max(0, c) * 0.8 * this.walkK; r.legs[1].knee.rotation.x += Math.max(0, -c) * 0.8 * this.walkK; r.chest.rotation.y += s * 0.14; r.torso.rotation.x += 0.08 * this.walkK; }
    else if (this.clip === C.guard) { const b = Math.sin(this.ct * 3); r.chest.rotation.x += b * 0.03; r.arms[0].sh.rotation.x += b * 0.03; r.arms[1].sh.rotation.x -= b * 0.03; }
    if (this.blend < 1) { this.blend = Math.min(1, this.blend + dt / 0.08); const k = this.blend; this.joints.forEach((j, i) => { const s = this.snap[i]; j.rotation.x = s.x + (j.rotation.x - s.x) * k; j.rotation.y = s.y + (j.rotation.y - s.y) * k; j.rotation.z = s.z + (j.rotation.z - s.z) * k; }); }
    r.root.position.set(this.x, this.y, this.z); r.root.rotation.y = this.yaw;
    if (grounded) { r.root.updateMatrixWorld(true); const a = r.legs[0].ank.getWorldPosition(_a).y, b = r.legs[1].ank.getWorldPosition(_b).y; r.root.position.y += top + 0.09 - Math.min(a, b); } // the lower foot on the ground, however the pose bends
    else if (this.state === 'down' || this.state === 'getup') r.root.position.y += 0.3;
    r.cape.update(dt, Math.min(0.9, Math.hypot(this.vx, this.vz) / 18), 0.3 + Math.min(0.7, Math.hypot(this.vx, this.vz) / 20));
    detail(r, null, true);
  }
}

export class FightTest {
  constructor(g, ctx) { this.g = g; this.ctx = ctx; this.active = false; this.near = 1.5; this.focus = 60; this.lod = 0; }
  start() {
    const g = this.g, D = g.disasters; for (const p of [g.flight, g.drive, g.takeover, g.bandGame]) if (p && p.active) p.stop(true); if (g.takeover && g.takeover.picking) g.takeover.endPick();
    const B = g.city.bounds, cx = this.cx = (B.x0 + B.x1) / 2, cz = this.cz = (B.z0 + B.z1) / 2, { camera, controls, post } = this.ctx, S = D.ctx.scene;
    this.active = true; controls.enabled = false; g.setFollow(-1); document.body.classList.add('zd-flying'); post.opts.dof = true;
    // clear a district and raise a bare plaza over its streets, so the people and cars of the town are out of the fight
    g.city.buildings.forEach((b, k) => { if (!g.city.dead[k] && Math.hypot((b.x0 + b.x1) / 2 - cx, (b.z0 + b.z1) / 2 - cz) < 135) g.city.hideBuilding(k, true); }); g.city.takeStreetNear(cx, cz, 135);
    this.top = g.people.groundY(cx, cz) + 3; const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d'); x.fillStyle = '#b9b1a0'; x.fillRect(0, 0, 512, 512); x.strokeStyle = 'rgba(70,60,50,.35)'; x.lineWidth = 1.5; for (let i = 0; i <= 16; i++) { x.beginPath(); x.moveTo(i * 32, 0); x.lineTo(i * 32, 512); x.moveTo(0, i * 32); x.lineTo(512, i * 32); x.stroke(); } x.strokeStyle = 'rgba(160,60,110,.55)'; x.lineWidth = 5; x.beginPath(); x.arc(256, 256, 236, 0, 7); x.stroke(); x.beginPath(); x.arc(256, 256, 60, 0, 7); x.stroke();
    this.tex = new THREE.CanvasTexture(c); this.tex.colorSpace = THREE.SRGBColorSpace; this.plaza = new THREE.Mesh(new THREE.CylinderGeometry(ARENA + 14, ARENA + 16, 8, 48), [new THREE.MeshStandardMaterial({ color: '#7d7566', roughness: 1 }), new THREE.MeshStandardMaterial({ map: this.tex, roughness: 0.95 }), new THREE.MeshStandardMaterial({ color: '#7d7566' })]); this.plaza.position.set(cx, this.top - 4, cz); this.plaza.receiveShadow = true; S.add(this.plaza);
    // the bodies and the marks on the ground that warn of a blow
    this.h = new Body(heroRig('Nova'), 100); this.v = new Body(villainRig('Tyrant'), 300); S.add(this.h.r.root, this.v.r.root);
    this.tell = new THREE.Mesh(new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.15, 0.1), transparent: true, opacity: 0, depthWrite: false, fog: false })); this.tell.renderOrder = 3; S.add(this.tell);
    this.strip = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.25, 0.1), transparent: true, opacity: 0, depthWrite: false, fog: false })); this.strip.renderOrder = 3; S.add(this.strip);
    this.heroStreak = new Streak(S, [1.6, 0.5, 1.4]); this.vilStreak = new Streak(S, [1.3, 0.3, 1.6]);
    this.css(); this.ui(); this.restart();
    camera.fov = innerWidth < innerHeight ? 28 : 18; camera.up.set(0, 1, 0); camera.updateProjectionMatrix(); this.place(1); camera.position.copy(this.camTo);
  }
  css() { if (document.getElementById('zd-fight-css')) return; const s = document.createElement('style'); s.id = 'zd-fight-css'; s.textContent = CSS; document.head.appendChild(s); }
  ui() {
    const el = this.el = document.createElement('div'); el.id = 'zd-fight';
    el.innerHTML = '<div class="bars"><div>NOVA<div class="hp"><i class="hh" style="background:linear-gradient(90deg,#ff5ad5,#ffd27a)"></i></div></div><div style="text-align:right">TYRANT<div class="hp"><i class="vh" style="margin-left:auto;background:linear-gradient(90deg,#b23cff,#ff5a5a)"></i></div></div></div><div class="say"></div><div class="hint">TAP attack (tap, tap, tap: combo) &middot; SWIPE dodge &middot; HOLD heavy (breaks a block)<br>TAP, TAP, HOLD launch, then TAP slam &middot; dodge just in time, then TAP to counter</div><div class="acts"><button type="button" data-a="again">Restart</button><button type="button" data-a="exit">Leave</button></div>';
    document.body.appendChild(el); this.hh = el.querySelector('.hh'); this.vh = el.querySelector('.vh'); this.sayEl = el.querySelector('.say');
    el.querySelector('[data-a="again"]').onclick = (e) => { e.stopPropagation(); this.restart(); }; el.querySelector('[data-a="exit"]').onclick = (e) => { e.stopPropagation(); this.stop(); };
    this.ptrs = new Map();
    el.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; e.preventDefault(); this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now(), used: false }); });
    el.addEventListener('pointermove', (e) => { const p = this.ptrs.get(e.pointerId); if (!p || p.used) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; if (Math.hypot(dx, dy) > SWIPE_PX && performance.now() - p.t < 450) { p.used = true; this.swipe(dx, dy); } });
    const up = (e) => { const p = this.ptrs.get(e.pointerId); if (!p) return; this.ptrs.delete(e.pointerId); if (p.held) { this.release(); return; } if (!p.used && performance.now() - p.t < 450) this.tap(); };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', (e) => { const p = this.ptrs.get(e.pointerId); this.ptrs.delete(e.pointerId); if (p && p.held) this.release(); });
    this.onKey = (e) => { if (e.repeat) return; if (e.key === 'Escape') this.stop(); if (e.key === ' ') this.tap(); const d = { arrowleft: [-40, 0], arrowright: [40, 0], arrowup: [0, -40], arrowdown: [0, 40] }[e.key.toLowerCase()]; if (d) this.swipe(d[0], d[1]); }; addEventListener('keydown', this.onKey);
  }
  restart() {
    const h = this.h, v = this.v, cx = this.cx, cz = this.cz; if (this.endEl) { this.endEl.remove(); this.endEl = null; }
    Object.assign(h, { x: cx - 5, z: cz + 3.5, y: this.top, vx: 0, vz: 0, vy: 0, hp: h.hpMax, yaw: 0 }); Object.assign(v, { x: cx + 5, z: cz - 3.5, y: this.top, vx: 0, vz: 0, vy: 0, hp: v.hpMax, yaw: 0 }); h.go('idle', C.guard); v.go('idle', C.guard);
    this.over = false; this.combo = 0; this.comboT = 0; this.buffer = false; this.counterT = 0; this.slow = 0; this.cool = 1.4; this.dirC = 1; this.mash = 0; this.hits = 0; this.hitsT = 0; this.atk = null; this.tellOff(); this.say('', 0);
  }
  stop() { if (!this.active) return; this.active = false; removeEventListener('keydown', this.onKey); travel(placeKey(), 'sandbox'); }
  say(text, T = 0.7, col = '#fff') { this.sayEl.textContent = text; this.sayEl.style.color = col; this.sayEl.style.opacity = text ? '1' : '0'; this.sayT = T; }
  // ---------- input
  tap() {
    if (this.over) return; const h = this.h, v = this.v;
    if (h.state === 'grabbed') { this.mash++; sfx('thud', h.x, h.y + 2, h.z, { gain: 0.5, rate: 1.4 }); return; }
    if (this.counterT > 0 && ['idle', 'dodge', 'attack'].includes(h.state)) { this.counterT = 0; this.slow = 0; this.startAtk('counter'); return; }
    if (v.state === 'air' && this.launched && ['idle', 'attack'].includes(h.state)) { this.launched = false; h.go('slamUp', CLIPS.windup); h.y0 = h.y; this.say('', 0); sfx('whoosh', h.x, h.y, h.z, { gain: 1, rate: 0.8 }); return; }
    if (h.state === 'idle') this.nextAtk(); else if (h.state === 'attack' || h.state === 'lunge') this.buffer = true;
  }
  nextAtk() { if (this.comboT <= 0) this.combo = 0; this.startAtk(COMBO[this.combo % 3]); }
  startAtk(name) { const h = this.h, v = this.v; if (name !== 'heavy' && name !== 'counter' && ['idle', 'close'].includes(v.state) && !this.over && Math.random() < 0.45) { v.go('block', C.block); v.vx = 0; v.vz = 0; } this.atk = name; this.landed = false; this.buffer = false; this.comboT = 0; if (this.dist() > ATK[name].reach - 0.9) { h.go('lunge', ATK[name].clip === CLIPS.hammerDown ? C.charge : C.guard); sfx('whoosh', h.x, h.y, h.z, { gain: 0.5, rate: 1.5 }); } else { h.go('attack', ATK[name].clip); } }
  swipe(dx, dy) {
    if (this.over) return; const h = this.h, v = this.v; if (!['idle', 'attack', 'lunge', 'charge'].includes(h.state)) return;
    const cam = this.ctx.camera; _a.setFromMatrixColumn(cam.matrixWorld, 0); _a.y = 0; _a.normalize(); cam.getWorldDirection(_b); _b.y = 0; _b.normalize(); const l = Math.hypot(dx, dy) || 1, wx = _a.x * dx / l - _b.x * dy / l, wz = _a.z * dx / l - _b.z * dy / l, wl = Math.hypot(wx, wz) || 1;
    h.vx = wx / wl * 27; h.vz = wz / wl * 27; h.go('dodge', C.dodge); h.yaw = Math.atan2(h.vx, h.vz); this.combo = 0; this.comboT = 0; this.buffer = false; this.charging = false; sfx('whoosh', h.x, h.y, h.z, { gain: 0.8, rate: 1.1 });
    // just in time: the blow about to land or landing, and near enough to have mattered
    const late = (v.state === 'wind' && v.T - v.t < 0.28) || v.state === 'strike' || v.state === 'rush'; if (late && (this.dist() < 7 || v.state === 'rush' || v.kind === 'charge')) { this.counterT = 0.95; this.slow = 0.45; this.say('COUNTER! TAP!', 0.9, '#ffd27a'); }
  }
  hold() { const h = this.h; if (this.over || !['idle', 'attack'].includes(h.state) || (h.state === 'attack' && !this.landed)) return false; if (this.combo === 2 && this.comboT > 0) { this.startAtk('upper'); return false; } h.go('charge', C.charge); this.charging = true; this.k = 0; return true; }
  release() { const h = this.h; if (h.state !== 'charge') return; this.charging = false; this.heavyK = this.k; this.startAtk('heavy'); }
  // ---------- each frame
  dist() { return Math.hypot(this.v.x - this.h.x, this.v.z - this.h.z); }
  face(f, o, dt, k = 14) { let a = Math.atan2(o.x - f.x, o.z - f.z) - f.yaw; a = Math.atan2(Math.sin(a), Math.cos(a)); f.yaw += a * Math.min(1, dt * k); }
  frame(dt, tg) {
    const g = this.g, h = this.h, v = this.v; if (this.ptrs) for (const p of this.ptrs.values()) if (!p.used && !p.held && performance.now() - p.t > TAP_MS) { p.used = true; if (this.hold()) p.held = true; }
    if (!g.paused && dt > 0) {
      if (this.slow > 0) { this.slow -= dt; } const ft = dt * (this.slow > 0 ? 0.3 : 1);
      if (this.counterT > 0) this.counterT -= dt; if (this.sayT > 0) { this.sayT -= dt; if (this.sayT <= 0) this.say('', 0); } if (this.hitsT > 0) { this.hitsT -= dt; if (this.hitsT <= 0) this.hits = 0; } if (this.comboT > 0) this.comboT -= ft;
      this.heroStep(ft); this.vilStep(ft); this.separate(); this.clamp(h); this.clamp(v);
      h.pose(ft, this.top, this.grounded(h)); v.pose(ft, this.top, this.grounded(v));
      this.hh.style.width = Math.max(0, h.hp / h.hpMax * 100) + '%'; this.vh.style.width = Math.max(0, v.hp / v.hpMax * 100) + '%';
      this.heroStreak.update(_c.set(h.x, h.y + 2.2, h.z), h.state === 'lunge' || h.state === 'dodge' || h.state === 'slamDown', this.ctx.camera, ft); this.vilStreak.update(_c.set(v.x, v.y + 2.2, v.z), v.state === 'rush', this.ctx.camera, ft);
    }
    this.place(dt); g.focusAt = _a.copy(this.look); tg.set(g.focusAt.x, 0, g.focusAt.z); this.focus = this.ctx.camera.position.distanceTo(g.focusAt);
  }
  grounded(f) { return f.y <= this.top + 0.01 && !['down', 'getup', 'flung', 'air', 'slammed', 'grabbed', 'held'].includes(f.state); }
  clamp(f) { const dx = f.x - this.cx, dz = f.z - this.cz, d = Math.hypot(dx, dz); if (d > ARENA) { f.x = this.cx + dx / d * ARENA; f.z = this.cz + dz / d * ARENA; f.vx *= 0.3; f.vz *= 0.3; } }
  separate() { const h = this.h, v = this.v; if (Math.abs(h.y - v.y) > 3 || h.state === 'grabbed' || h.state === 'dodge' || v.state === 'rush') return; const dx = v.x - h.x, dz = v.z - h.z, d = Math.hypot(dx, dz) || 0.01; if (d < 1.9) { const p = (1.9 - d) / 2, nx = dx / d, nz = dz / d; h.x -= nx * p; h.z -= nz * p; v.x += nx * p; v.z += nz * p; } }
  walk(f, tx, tz, sp, dt) { const dx = tx - f.x, dz = tz - f.z, d = Math.hypot(dx, dz) || 1; f.x += dx / d * sp * dt; f.z += dz / d * sp * dt; f.phase += sp * dt * 1.1; f.walkK += (1 - f.walkK) * Math.min(1, dt * 10); }
  slide(f, dt, fr = 7) { f.x += f.vx * dt; f.z += f.vz * dt; const k = Math.exp(-fr * dt); f.vx *= k; f.vz *= k; }
  heroStep(dt) {
    const h = this.h, v = this.v; h.t += dt; h.walkK *= Math.exp(-dt * 10); const d = this.dist();
    switch (h.state) {
      case 'idle': this.slide(h, dt); this.face(h, v, dt); if (d > 9 && !this.over) this.walk(h, v.x, v.z, 5.5, dt); if (h.clip !== C.guard) h.play(C.guard); break;
      case 'lunge': { this.face(h, v, dt, 22); const A = ATK[this.atk], gap = A.reach - 1, sp = 30; if (v.state === 'air') { h.go('idle', C.guard); break; } if (d <= gap || h.t > 0.7) { h.go('attack', A.clip); break; } h.x += (v.x - h.x) / d * sp * dt; h.z += (v.z - h.z) / d * sp * dt; h.phase += dt * 30; h.walkK = 0.6; break; }
      case 'attack': { const A = ATK[this.atk]; this.face(h, v, dt, 18); this.slide(h, dt); if (!this.landed && h.t >= A.at) { this.landed = true; this.contact(A); if (h.state !== 'attack') break; } if (h.t >= A.end) this.afterAtk(); else if (this.buffer && this.landed && h.t >= A.at + 0.09 && COMBO.includes(this.atk)) this.afterAtk(); break; }
      case 'charge': this.face(h, v, dt); this.k = Math.min(1, this.k + dt / 0.9); h.r.root.position.y += 0; if (Math.random() < 0.3 * this.k) this.g.disasters.brawl.stunts.ring(h.x, this.top + 0.3, h.z, 1.6 + 2 * this.k, 0.25, new THREE.Color(1.6, 0.5, 1.4), 0.6); break;
      case 'dodge': this.slide(h, dt, 4); if (h.t > 0.26) { h.vx *= 0.15; h.vz *= 0.15; h.go('idle', C.guard); } break;
      case 'hurt': this.slide(h, dt); this.face(h, v, dt, 6); if (h.t > 0.4) h.go('idle', C.guard); break;
      case 'flung': case 'air': h.vy -= G * dt; h.y += h.vy * dt; this.slide(h, dt, 1); h.play === 0; if (h.y <= this.top) { h.y = this.top; h.vy = 0; h.vx *= 0.3; h.vz *= 0.3; this.puff(h, 0.5); h.go('down', C.down); } break;
      case 'down': this.slide(h, dt); if (h.t > 0.55 && !this.over) h.go('getup', C.getup); break;
      case 'getup': if (h.t > 0.55) h.go('idle', C.guard); break;
      case 'slamUp': { const k = Math.min(1, h.t / 0.3); h.x += (v.x - 1.2 - h.x) * Math.min(1, dt * 14); h.z += (v.z - h.z) * Math.min(1, dt * 14); h.y = h.y0 + (v.y + 2.2 - h.y0) * (1 - (1 - k) * (1 - k)); this.face(h, v, dt, 20); if (k >= 1) { h.go('slamHit', CLIPS.hammerDown); this.landed = false; } break; }
      case 'slamHit': if (!this.landed && h.t >= 0.1) { this.landed = true; v.go('slammed', CLIPS.crushed); v.vy = -46; this.hurtV(5); this.g.hitStop = 0.08; sfx('crash', v.x, v.y, v.z, { gain: 1, rate: 0.7 }); this.spark(v.x, v.y + 2, v.z, 3.5); h.vy = -8; } h.vy -= G * dt; h.y += h.vy * dt; if (h.y <= this.top) { h.y = this.top; h.vy = 0; h.go('land', CLIPS.land); this.puff(h, 0.4); } break;
      case 'land': if (h.t > 0.4) h.go('idle', C.guard); break;
      default: break;
    }
  }
  afterAtk() { const h = this.h; const was = this.atk; if (COMBO.includes(was)) { const i = COMBO.indexOf(was); this.combo = i === 2 ? 0 : i + 1; this.comboT = i === 2 ? 0 : COMBO_T; } this.atk = null; const b = this.buffer; this.buffer = false; h.go('idle', C.guard); if (b && this.combo > 0) this.nextAtk(); }
  // the blow, if the bodies really meet
  contact(A) {
    const h = this.h, v = this.v, d = this.dist(), hit = d <= A.reach && Math.abs(v.y - h.y) < 4 && !['down', 'getup', 'flung', 'air', 'slammed'].includes(v.state); if (!hit) { sfx('whoosh', h.x, h.y + 2, h.z, { gain: 0.4, rate: 1.7 }); return; }
    const breaks = A === ATK.heavy || A === ATK.counter;
    if (v.state === 'block' && !breaks) { this.hurtV(1); this.spark(v.x, v.y + 3, v.z, 1.4, [1.2, 1.4, 2.2]); sfx('thud', v.x, v.y + 2, v.z, { gain: 0.8, rate: 1.7 }); this.say('BLOCKED! HOLD TO BREAK IT', 0.9, '#9fd4ff'); this.combo = 0; this.comboT = 0; this.buffer = false; const b = Math.hypot(h.x - v.x, h.z - v.z) || 1; h.vx = (h.x - v.x) / b * 9; h.vz = (h.z - v.z) / b * 9; this.atk = null; h.go('hurt', CLIPS.hitBody); this.g.hitStop = Math.max(this.g.hitStop || 0, 0.05); v.go('idle', C.guard); this.vilAtk('jab'); v.T = 0.3; return; }
    if (v.state === 'wind' && v.armor && !breaks) { this.hurtV(A.dmg * 0.5); this.spark(v.x, v.y + 3, v.z, 1.6, [2.2, 0.8, 0.5]); sfx('thud', v.x, v.y + 2, v.z, { gain: 0.8, rate: 0.9 }); this.say('NOT STOPPING! DODGE!', 0.8, '#ff8a7a'); return; }
    v.armor = false;
    const nx = (v.x - h.x) / (d || 1), nz = (v.z - h.z) / (d || 1), dmg = A.dmg + (A === ATK.heavy ? 30 * (this.heavyK || 0) : 0); this.tellOff(); this.hurtV(dmg);
    this.hits++; this.hitsT = 1.2; if (this.hits >= 2) this.say(this.hits + ' HITS', 0.7, '#ffd27a'); this.g.hitStop = Math.max(this.g.hitStop || 0, A.stop); this.g.shake = Math.max(this.g.shake || 0, A.shake); this.spark(v.x - nx, v.y + 3, v.z - nz, A.knock || A.launch ? 3 : 1.8); sfx(A.knock || A.launch ? 'crash' : 'thud', v.x, v.y + 2, v.z, { gain: A.knock ? 1 : 0.8, rate: A.knock ? 0.8 : 1.2 });
    v.yaw = Math.atan2(-nx, -nz);
    if (A.launch) { v.go('air', CLIPS.hitUp); v.vy = 17; v.vx = nx; v.vz = nz; this.launched = true; this.say('TAP!', 1.3, '#ffd27a'); return; }
    if (A.knock || v.hp <= 0) { const K = A.knock || [14, 5]; v.go('flung', CLIPS[A.react]); v.vx = nx * K[0]; v.vz = nz * K[0]; v.vy = K[1]; return; }
    v.go('stun', CLIPS[A.react]); v.vx = nx * A.kb; v.vz = nz * A.kb;
  }
  hurtV(n) { this.v.hp -= n; }
  hurtH(n, why) { const h = this.h; h.hp -= n; this.combo = 0; this.comboT = 0; this.buffer = false; this.charging = false; this.hits = 0; this.counterT = 0; this.g.shake = Math.max(this.g.shake || 0, 0.4); this.g.hitStop = Math.max(this.g.hitStop || 0, 0.06); this.spark(h.x, h.y + 3, h.z, 2.2, [2.4, 0.4, 0.3]); sfx('thud', h.x, h.y + 2, h.z, { gain: 1.1, rate: 0.8 }); if (why) this.say(why, 0.7, '#ff8a7a'); }
  spark(x, y, z, R, c = [2.2, 1.9, 1.3]) { const D = this.g.disasters; D.brawl.stunts.ring(x, y, z, R, 0.16, new THREE.Color(c[0], c[1], c[2]), 0.9); for (let i = 0; i < 5; i++) { const s = 0.12 + Math.random() * 0.14; D.debris.add(x, y, z, s, s, s, 0xfff2c0, 'fly', { v: [(Math.random() - 0.5) * 12, 2 + Math.random() * 6, (Math.random() - 0.5) * 12], life: 0.8 }); } }
  puff(f, k) { const D = this.g.disasters; D.brawl.stunts.ring(f.x, this.top + 0.25, f.z, 3 + 8 * k, 0.3, new THREE.Color(1.2, 1.1, 0.9), 0.6); for (let i = 0; i < 8 * k + 3; i++) { const a = Math.random() * 6.28, s = 0.2 + Math.random() * 0.4; D.debris.add(f.x, this.top + 0.2, f.z, s, s * 0.6, s, 0x9a9184, 'fly', { v: [Math.cos(a) * 6, 2 + Math.random() * 4, Math.sin(a) * 6], life: 0.9 }); } sfx('thud', f.x, this.top, f.z, { gain: 0.6 + k, rate: 0.7 }); }
  tellOff() { this.tell.material.opacity = 0; this.strip.material.opacity = 0; }
  // ---------- Tyrant
  vilStep(dt) {
    const h = this.h, v = this.v; v.t += dt; v.walkK *= Math.exp(-dt * 10); const d = this.dist();
    switch (v.state) {
      case 'idle': {
        if (this.over) { this.face(v, h, dt, 4); break; } this.slide(v, dt); this.face(v, h, dt, 6); v.armor = false; if (v.clip !== C.guard) v.play(C.guard); if (!['idle', 'attack', 'lunge', 'dodge', 'charge', 'land'].includes(h.state)) { this.cool = Math.max(this.cool, 0.4); }
        // round the hero, or in closer
        const r = 5.5, a = Math.atan2(v.z - h.z, v.x - h.x) + this.dirC * 0.5, tx = d > r + 2 ? h.x : h.x + Math.cos(a) * r, tz = d > r + 2 ? h.z : h.z + Math.sin(a) * r; this.walk(v, tx, tz, d > r + 2 ? 6 : 3.2, dt);
        if ((this.cool -= dt) <= 0) { const q = Math.random(); this.dirC = Math.random() < 0.5 ? 1 : -1; if (d > 7.5) { if (q < 0.65) this.vilAtk('charge'); else this.cool = 0.3; } else if (d < 4.5) this.vilAtk(q < 0.65 || this.lastK === 'grab' ? 'jab' : 'grab'); else if (q < 0.3) this.vilAtk('charge'); else { v.go('close'); } }
        break;
      }
      case 'close': this.face(v, h, dt, 8); this.walk(v, h.x, h.z, 8, dt); if (d < 3.6) this.vilAtk(Math.random() < 0.7 || this.lastK === 'grab' ? 'jab' : 'grab'); else if (v.t > 1.2) { v.go('idle'); this.cool = 0.4; } break;
      case 'wind': {
        this.face(v, h, dt, v.kind === 'charge' && v.T - v.t < 0.3 ? 0 : 9); const u = Math.min(1, v.t / v.T);
        if (v.kind === 'charge') { const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw); this.strip.position.set(v.x, this.top + 0.06, v.z); this.strip.rotation.y = v.yaw; this.strip.scale.set(3.2, 1, 22); this.strip.material.opacity = 0.15 + 0.45 * u; } else { const R = v.kind === 'grab' ? 3.4 : 3.8; this.tell.position.set(v.x + Math.sin(v.yaw) * 1.7, this.top + 0.06, v.z + Math.cos(v.yaw) * 1.7); this.tell.scale.setScalar(R * u + 0.4); this.tell.material.opacity = 0.15 + 0.4 * u; }
        if (v.t >= v.T) { this.tellOff(); if (v.kind === 'charge') { v.go('rush', C.rush); v.fx = Math.sin(v.yaw); v.fz = Math.cos(v.yaw); v.ran = 0; sfx('whoosh', v.x, v.y, v.z, { gain: 1.2, rate: 0.7 }); } else if (v.kind === 'jab') { v.go('strike', CLIPS.jabR); this.vl = false; v.vx = Math.sin(v.yaw) * 7; v.vz = Math.cos(v.yaw) * 7; } else { v.go('strike', C.grab); this.vl = false; v.vx = Math.sin(v.yaw) * 13; v.vz = Math.cos(v.yaw) * 13; } }
        break;
      }
      case 'strike': this.slide(v, dt, 6); if (!this.vl && v.t >= (v.kind === 'grab' ? 0.2 : 0.09)) { this.vl = true; if (v.kind === 'jab') { if (d < 3.5 && this.canHit()) { this.hitHero(8, 7); } } else if (d < 3.1 && this.canHit()) { h.go('grabbed', C.held); h.yaw = Math.atan2(v.x - h.x, v.z - h.z); v.go('hold', C.hold); this.mash = 0; this.hurtH(4, 'TAP TAP TAP!'); this.say('TAP TAP TAP!', 1.2, '#ff8a7a'); return; } } if (v.t > (v.kind === 'grab' ? 0.7 : 0.42)) { v.go('idle', C.guard); this.cool = 0.5 + Math.random() * 0.9; } break;
      case 'rush': { const st = 27 * dt; v.x += v.fx * st; v.z += v.fz * st; v.ran += st; v.phase += st * 1.1; v.walkK = 1; if (d < 2.7 && this.canHit()) { this.fling(16, v.fx, v.fz, 'CHARGED!'); v.go('stumble', C.stumble); break; } if (v.ran > 22) v.go('stumble', C.stumble); break; }
      case 'block': this.face(v, h, dt, 12); this.slide(v, dt); if (v.t > 0.6) { v.go('idle', C.guard); this.cool = 0.2; } break;
      case 'stumble': v.walkK *= 0.8; if (v.t > 0.8) { v.go('idle', C.guard); this.cool = 0.5 + Math.random() * 0.6; } break;
      case 'hold': { const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw); h.x = v.x + fx * 1.4; h.z = v.z + fz * 1.4; h.y = this.top + 2.4; if (this.mash >= 5) { h.y = this.top; h.go('hurt', CLIPS.hitBody); h.vx = fx * 6; h.vz = fz * 6; v.go('stun', CLIPS.hitBody); v.vx = -fx * 5; v.vz = -fz * 5; this.say('BROKE FREE!', 0.7, '#8affb0'); break; } if (v.t >= 1.15) { v.go('stumble', CLIPS.throw); this.fling(16, fx, fz, 'THROWN!'); h.y = this.top + 2; } break; }
      case 'stun': this.slide(v, dt, 8); if (v.hp <= 0) { v.go('flung', CLIPS.blownBack); v.vy = 4; break; } if (v.t > 0.42) { v.go('idle', C.guard); this.cool = 0.35 + Math.random() * 0.5; } break;
      case 'air': case 'flung': case 'slammed': v.vy -= G * dt; v.y += v.vy * dt; this.slide(v, dt, 1); if (v.y <= this.top) { const hard = v.state === 'slammed', was = v.state; v.y = this.top; v.vy = 0; v.vx *= 0.2; v.vz *= 0.2; v.go('down', hard ? CLIPS.crushed : C.down); if (hard) { this.hurtV(40); this.puff(v, 1); this.g.shake = Math.max(this.g.shake || 0, 1); this.g.hitStop = 0.1; this.say('SLAMMED!', 0.9, '#ffd27a'); v.play(C.down); } else { if (was === 'air') this.hurtV(6); this.puff(v, 0.5); } this.launched = false; } break;
      case 'down': this.slide(v, dt); if (v.hp <= 0) { if (!this.over && v.t > 0.5) this.finish(true); break; } if (v.t > 1.0) v.go('getup', C.getup); break;
      case 'getup': if (v.t > 0.55) { v.go('idle', C.guard); if (d < 8) { this.vilAtk(d < 4.5 ? (Math.random() < 0.7 ? 'jab' : 'grab') : 'charge'); v.armor = true; } else this.cool = 0.25; } break; // up and straight at you: jabs won't stop this one
      default: break;
    }
  }
  vilAtk(kind) { const v = this.v; v.kind = kind; this.lastK = kind; v.T = kind === 'jab' ? 0.5 : kind === 'grab' ? 0.62 : 0.8; v.go('wind', kind === 'jab' ? C.jabWind : kind === 'grab' ? C.grabWind : C.chargeWind); sfx('whoosh', v.x, v.y + 2, v.z, { gain: 0.55, rate: kind === 'charge' ? 0.6 : 1 }); }
  canHit() { const s = this.h.state; return !['dodge', 'down', 'getup', 'flung', 'slamUp', 'slamHit', 'grabbed'].includes(s) && this.h.y < this.top + 2; }
  hitHero(n, kb) { const h = this.h, v = this.v, d = this.dist() || 1; this.hurtH(n); h.vx = (h.x - v.x) / d * kb; h.vz = (h.z - v.z) / d * kb; h.go('hurt', CLIPS.hitHeadL); if (h.hp <= 0) this.fling(0, h.vx / kb, h.vz / kb); }
  fling(n, fx, fz, why) { const h = this.h; this.hurtH(n, why); h.vx = fx * 18; h.vz = fz * 18; h.vy = 8; h.go('flung', CLIPS.blownBack); if (h.hp <= 0) this.finish(false); }
  finish(won) { if (this.over) return; this.over = true; this.tellOff(); const e = this.endEl = document.createElement('div'); e.className = 'end'; e.innerHTML = (won ? 'YOU WIN' : 'KNOCKED OUT') + '<button type="button">Fight again</button>'; e.querySelector('button').onclick = (ev) => { ev.stopPropagation(); this.restart(); }; this.el.appendChild(e); }
  // the camera: one steady angle, in and out only as far as keeps both in view
  place(dt) {
    const h = this.h, v = this.v, cam = this.ctx.camera, mx = (h.x + v.x) / 2, mz = (h.z + v.z) / 2, up = Math.max(0, Math.max(h.y, v.y) - this.top), sep = Math.hypot(h.x - v.x, h.z - v.z), hf = Math.tan(cam.fov * Math.PI / 360) * cam.aspect, want = Math.max(38, (sep + 7) / (2 * hf)) * (1 + up * 0.018), el = 0.58;
    this.dist0 = this.dist0 == null ? want : this.dist0 + (want - this.dist0) * Math.min(1, dt * 2.5); const my = this.top + 2.2 + up * 0.5, D = this.dist0, ce = Math.cos(el) * D; this.look = this.look || new THREE.Vector3(mx, my, mz); this.look.lerp(_c.set(mx, my, mz), Math.min(1, dt * 5));
    this.camTo = this.camTo || new THREE.Vector3(); this.camTo.set(this.look.x + 0.6 * ce, this.look.y + Math.sin(el) * D, this.look.z + 0.8 * ce); cam.position.copy(this.camTo); cam.lookAt(this.look);
  }
}
