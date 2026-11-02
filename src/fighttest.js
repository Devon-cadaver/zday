// The fight test (Sean: pick one fight and nail the combat, with no circles to tap). Nova against Tyrant on a bare plaza, a steady
// iso camera, a health bar each. Tap anywhere: the hero lunges and strikes, in rhythm a combo (jab, jab, cross). Tap, tap, hold: an
// uppercut that launches them, then tap to slam them down. The kit (Sean), each slot to be chosen from many later: 2 powers (a stun, a knockback), 2 melee attacks (tap combo, hold heavy), a block, 2 grabs (spin and toss; the feet and smash), 2 finishers, which alone can end the fight: at zero health Tyrant stands dazed and wobbly and two gold buttons appear; the neck drag (hold and steer, let go to fling) or the sky (hold: the higher; tap: fly up past them; hold: the grab; hold: the shockwave, up to a mini nuke). Blocking and dashing cost power. When Nova drops to no health she stands dazed and Tyrant does a finisher on her: the neck drag or the sky (vfin). Tap, hold: grabbed and spun round, let go to toss. Hold from rest: a charged heavy. Swipe: a dodge that way; dodged just
// as a blow comes, time slows and a tap counters. Tyrant walks round the hero and has three attacks you read on the body and on
// the ground (jab, charge, grab), each stopped by a hit while winding up. Blows land only if the bodies really meet. Good fighting fills a meter that pays for two powers: a stun (ice, no damage, under 2 s) and a knockback (the laser, next to no damage, stops anything, frees you from a grab). Sandbox card;
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
export const C = {
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
  seize: { keys: [key(0, { torso: 0.5, chest: 0.2, shL: { x: -0.6, z: -0.2 }, shR: { x: -0.6, z: 0.2 }, elL: -1, elR: -1, kneeL: 0.7, kneeR: 0.5, bodyY: -0.1 }), key(0.12, { torso: 0.3, shL: { x: -1.2, z: -0.1 }, shR: { x: -1.2, z: 0.1 }, kneeL: 0.5, kneeR: 0.3 }, 'snap')] },
  spinH: still({ torso: -0.2, chest: -0.12, head: 0.1, shL: { x: -1.5, z: 0.24 }, shR: { x: -1.5, z: -0.24 }, hipL: -0.25, hipR: 0.15, kneeL: 0.5, kneeR: 0.3 }),
  swung: still({ body: 1.45, shL: { x: -2.9, z: -0.5 }, shR: { x: -2.9, z: 0.5 }, elL: -0.2, elR: -0.2, kneeL: 0.1, kneeR: 0.1 }),
  cast: { keys: [key(0, GUARD), key(0.08, { torso: { x: -0.1, y: -0.3 }, chest: { y: -0.3 }, shR: { x: -1.6, z: 0.05 }, elR: 0, shL: { x: 0.3, z: -0.4 }, elL: -1, hipL: -0.3, kneeL: 0.4, kneeR: 0.2 }, 'snap')] },
  drag: still({ body: 1.0, torso: 0.1, head: -0.7, shR: { x: 1.1, z: 0.2 }, elR: -0.1, shL: { x: -2.9, z: -0.1 }, elL: 0, hipL: -0.3, hipR: 0.3, kneeL: 0.5, kneeR: 0.2 }),
  dragged: still({ head: 0.5, shL: { x: -2.6, z: -0.3 }, shR: { x: -2.6, z: 0.3 }, elL: -1.1, elR: -1.1, hipL: 0.2, hipR: -0.2, kneeL: 0.2, kneeR: 0.4 }),
  guardUp: still({ torso: 0.15, chest: 0.1, head: 0.2, shL: { x: -1.5, z: -0.05 }, shR: { x: -1.5, z: 0.05 }, elL: -2.3, elR: -2.3, hipL: -0.35, kneeL: 0.55, kneeR: 0.35 }),
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
  seize: { clip: C.seize, at: 0.12, end: 0.3, dmg: 5, react: 'hitBody', seize: true, stop: 0.05, shake: 0.15, reach: 3.5 },
  ankle: { clip: C.seize, at: 0.1, end: 0.3, dmg: 0, react: 'hitBody', ankle: true, stop: 0.04, shake: 0.1, reach: 3.7 },
  neck: { clip: C.seize, at: 0.1, end: 0.3, dmg: 0, react: 'hitBody', neck: true, stop: 0.04, shake: 0.1, reach: 3.7 },
  heavy: { clip: CLIPS.hammerDown, at: 0.12, end: 0.45, dmg: 15, react: 'blownBack', knock: [14, 6], stop: 0.1, shake: 0.5, reach: 3.7 },
  counter: { clip: CLIPS.cross, at: 0.08, end: 0.4, dmg: 40, react: 'blownBack', knock: [22, 7], stop: 0.12, shake: 0.6, reach: 4 },
};
const COMBO = ['jabL', 'jabR', 'cross'];
const COST = { freeze: 50, laser: 35 }, CAN_TARGET = ['idle', 'close', 'wind', 'strike', 'rush', 'stumble', 'stun', 'block', 'frozen'];
const A0 = 0.95, A1 = Math.PI * 2 - 0.95, SMASH_DMG = [12, 14, 16]; // the swing's ends: their head on the ground in front, then behind
const AZ0 = Math.atan2(0.6, 0.8), G = 24, ARENA = 40, TAP_MS = 220, SWIPE_PX = 26, COMBO_T = 0.6, DASH_COST = 12;
export const CSS = `
#zd-fight{position:fixed;left:0;top:0;right:0;bottom:0;z-index:28;touch-action:none;user-select:none;-webkit-user-select:none;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#fff}
body.zd-flying #zd-bar,body.zd-flying #zd-dis,body.zd-flying #zd-followchip,body.zd-flying #zd-globe,body.zd-flying #zd-top{display:none!important}
#zd-fight .bars{position:absolute;left:12px;right:64px;top:calc(10px + env(safe-area-inset-top));display:flex;gap:10px;pointer-events:none;font:800 12px/1.2 system-ui,sans-serif;text-shadow:0 1px 3px #000}
#zd-fight .bars>div{flex:1 1 0;min-width:0}
#zd-fight .hp{height:12px;margin-top:3px;border-radius:6px;background:rgba(0,0,0,.55);overflow:hidden;border:1px solid rgba(255,255,255,.35)}
#zd-fight .hp i{display:block;height:100%;width:100%;transition:width .12s}
#zd-fight .say{position:absolute;left:0;right:0;top:calc(62px + env(safe-area-inset-top));text-align:center;font:900 24px/1.1 system-ui,sans-serif;text-shadow:0 2px 8px #000;pointer-events:none;opacity:0;transition:opacity .15s}
#zd-fight .hint{position:absolute;left:10px;right:10px;bottom:calc(136px + env(safe-area-inset-bottom));text-align:center;font:700 12px/1.45 system-ui,sans-serif;text-shadow:0 1px 3px #000;pointer-events:none;opacity:.9;transition:opacity .6s}
#zd-fight .acts{position:absolute;left:12px;bottom:calc(12px + env(safe-area-inset-bottom));display:flex;gap:8px}
#zd-fight button{appearance:none;border:2px solid rgba(255,255,255,.35);border-radius:12px;padding:9px 14px;font:800 12px system-ui,sans-serif;color:#fff;background:rgba(40,20,60,.85);cursor:pointer}
#zd-fight .en{height:6px;margin-top:3px;border-radius:3px;background:rgba(0,0,0,.55);overflow:hidden}
#zd-fight .en i{display:block;height:100%;width:30%;background:linear-gradient(90deg,#4fd8ff,#ffe27a)}
#zd-fight .pw{position:absolute;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));display:flex;gap:8px}
#zd-fight .pw button{width:64px;height:64px;padding:0;border-radius:50%;font-size:25px;line-height:1;opacity:.42;filter:grayscale(.8);touch-action:none}
#zd-fight .pw button small{display:block;font:800 9px system-ui,sans-serif;margin-top:1px}
#zd-fight .pw button.ok{opacity:1;filter:none;box-shadow:0 0 14px 3px rgba(255,226,122,.75);border-color:#ffe27a}
#zd-fight .blk{position:absolute;right:12px;bottom:calc(84px + env(safe-area-inset-bottom));width:136px;padding:12px 0;border-radius:14px;font:900 14px system-ui,sans-serif;letter-spacing:.06em;background:linear-gradient(#5f6f8c,#2c3650);touch-action:none}
#zd-fight .blk.on{background:linear-gradient(#9fd4ff,#3f7ec4);box-shadow:0 0 14px 3px rgba(150,210,255,.8)}
#zd-fight .pw .fr{background:radial-gradient(circle,#7fdcff,#1a5f9c)}
#zd-fight .pw .li{background:radial-gradient(circle,#ffe98a,#7a4cff)}
#zd-fight .fin{position:absolute;left:12px;right:12px;bottom:calc(164px + env(safe-area-inset-bottom));display:none;gap:10px;justify-content:center}
#zd-fight .fin.show{display:flex}
#zd-fight .fin button{flex:1 1 0;max-width:200px;padding:13px 8px;border-radius:16px;font:900 15px system-ui,sans-serif;background:linear-gradient(#ffd27a,#b86a12);color:#2a1600;border-color:#fff2a8;box-shadow:0 0 18px 4px rgba(255,210,122,.8);animation:zdfin .8s ease-in-out infinite alternate;touch-action:none}
#zd-fight .fin button small{display:block;font:700 10px system-ui,sans-serif;margin-top:3px;color:#4a2a00}
@keyframes zdfin{from{transform:scale(1)}to{transform:scale(1.06)}}
#zd-fight .end{position:absolute;left:50%;top:42%;transform:translate(-50%,-50%);padding:18px 26px;border-radius:16px;background:rgba(20,10,30,.9);border:1px solid rgba(255,255,255,.25);text-align:center;font:900 22px system-ui,sans-serif}
#zd-fight .end button{display:block;width:100%;margin-top:12px;background:linear-gradient(#ff5ad5,#a0168a)}
`;
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();

export class Body {
  constructor(r, hpMax) {
    this.r = r; this.hp = this.hpMax = hpMax; this.x = 0; this.y = 0; this.z = 0; this.vx = 0; this.vz = 0; this.vy = 0; this.yaw = 0; this.state = 'idle'; this.t = 0; this.clip = C.guard; this.ct = 0; this.blend = 1; this.phase = 0; this.walkK = 0;
    this.joints = [r.body, r.torso, r.chest, r.head]; for (const a of r.arms) this.joints.push(a.sh, a.el, a.wr); for (const l of r.legs) this.joints.push(l.hip, l.knee, l.ank); this.snap = this.joints.map(() => new THREE.Euler());
  }
  play(clip) { this.clip = clip; this.ct = 0; this.blend = 0; this.joints.forEach((j, i) => this.snap[i].copy(j.rotation)); }
  go(state, clip) { this.state = state; this.t = 0; this.armsA = null; this.bodyX = null; if (clip) this.play(clip); }
  // the pose: the clip, walking legs over it, eased from the last pose so nothing snaps
  pose(dt, top, grounded) {
    const r = this.r; this.ct += dt; relax(r); playClip(r, this.clip, this.ct);
    if (this.walkK > 0.02) { const s = Math.sin(this.phase) * this.walkK, c = Math.cos(this.phase); r.legs[0].hip.rotation.x += s * 0.7; r.legs[1].hip.rotation.x -= s * 0.7; r.legs[0].knee.rotation.x += Math.max(0, c) * 0.8 * this.walkK; r.legs[1].knee.rotation.x += Math.max(0, -c) * 0.8 * this.walkK; r.chest.rotation.y += s * 0.14; r.torso.rotation.x += 0.08 * this.walkK; }
    else if (this.clip === C.guard) { const b = Math.sin(this.ct * 3); r.chest.rotation.x += b * 0.03; r.arms[0].sh.rotation.x += b * 0.03; r.arms[1].sh.rotation.x -= b * 0.03; }
    if (this.blend < 1) { this.blend = Math.min(1, this.blend + dt / 0.08); const k = this.blend; this.joints.forEach((j, i) => { const s = this.snap[i]; j.rotation.x = s.x + (j.rotation.x - s.x) * k; j.rotation.y = s.y + (j.rotation.y - s.y) * k; j.rotation.z = s.z + (j.rotation.z - s.z) * k; }); }
    if (this.armsA != null) { const a = this.armsA; for (const q of r.arms) { q.sh.rotation.set(-a, 0, -q.sx * 0.15); q.el.rotation.set(0, 0, 0); } r.torso.rotation.x = Math.sin(a) * 0.4; r.head.rotation.x = -Math.sin(a) * 0.3; } // both arms driven by the swing
    if (this.bodyX != null) r.body.rotation.x = this.bodyX; // held by the feet: the whole body swung as one
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
    const g = this.g, D = g.disasters; for (const p of [g.flight, g.drive, g.takeover, g.bandGame, g.horde]) if (p && p.active) p.stop(true); if (g.takeover && g.takeover.picking) g.takeover.endPick();
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
    this.buildBoxes(); this.fx = []; this.ray = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true).translate(0, 0.5, 0);
    this.heroStreak = new Streak(S, [1.6, 0.5, 1.4]); this.vilStreak = new Streak(S, [1.3, 0.3, 1.6]);
    this.css(); this.ui(); this.restart();
    camera.fov = innerWidth < innerHeight ? 28 : 18; camera.up.set(0, 1, 0); camera.updateProjectionMatrix(); this.place(1); camera.position.copy(this.camTo);
  }
  css() { if (document.getElementById('zd-fight-css')) return; const s = document.createElement('style'); s.id = 'zd-fight-css'; s.textContent = CSS; document.head.appendChild(s); }
  ui() {
    const el = this.el = document.createElement('div'); el.id = 'zd-fight';
    el.innerHTML = '<div class="bars"><div>NOVA<div class="hp"><i class="hh" style="background:linear-gradient(90deg,#ff5ad5,#ffd27a)"></i></div><div class="en"><i class="ee"></i></div></div><div style="text-align:right">TYRANT<div class="hp"><i class="vh" style="margin-left:auto;background:linear-gradient(90deg,#b23cff,#ff5a5a)"></i></div></div></div><div class="say"></div><div class="hint">TAP combo &middot; HOLD heavy &middot; SWIPE dodge &middot; BLOCK button<br>TAP, HOLD spin and toss &middot; Knocked down: TAP feet, then TAP smash<br>Blue bar: \u2744 stun, \uD83D\uDD34 knock back; a dash costs 12, a block a third then 10 a second<br>Zero health: pick a finisher</div><div class="fin"><button type="button" data-f="neck">\uD83E\uDD1C NECK DRAG<small>HOLD and steer, let go to fling</small></button><button type="button" data-f="sky">\u2604 TO THE SKY<small>HOLD, TAP, HOLD, HOLD</small></button></div><div class="pw"><button type="button" class="fr" data-p="freeze">\u2744<small>50</small></button><button type="button" class="li" data-p="laser">\uD83D\uDD34<small>35</small></button></div><button type="button" class="blk" data-b>\uD83D\uDEE1 BLOCK</button><div class="acts"><button type="button" data-a="again">Restart</button><button type="button" data-a="exit">Leave</button></div>';
    document.body.appendChild(el); this.hh = el.querySelector('.hh'); this.vh = el.querySelector('.vh'); this.sayEl = el.querySelector('.say'); this.ee = el.querySelector('.ee'); this.pwBtn = {};
    const bb = this.blkEl = el.querySelector('[data-b]'); bb.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); try { bb.setPointerCapture(e.pointerId); } catch (x) { /* fine */ } this.blockOn(); }); for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) bb.addEventListener(ev, () => this.blockOff());
    this.finEl = el.querySelector('.fin'); el.querySelectorAll('[data-f]').forEach(b => { b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (this.over || this.finKind || this.v.state !== 'dazed') return; try { b.setPointerCapture(e.pointerId); } catch (x) { /* fine */ } this.finPick(b.dataset.f); this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now(), used: true, held: true }); }); });
    el.querySelectorAll('[data-p]').forEach(b => { this.pwBtn[b.dataset.p] = b; b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); this.cast(b.dataset.p); }); });
    el.querySelector('[data-a="again"]').onclick = (e) => { e.stopPropagation(); this.restart(); }; el.querySelector('[data-a="exit"]').onclick = (e) => { e.stopPropagation(); this.stop(); };
    this.ptrs = new Map();
    el.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; e.preventDefault(); this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now(), used: false }); });
    el.addEventListener('pointermove', (e) => { const p = this.ptrs.get(e.pointerId); if (p && p.held && this.h.state === 'drag') { const dx = e.clientX - p.x, dy = e.clientY - p.y; if (Math.hypot(dx, dy) > 18) this.steer = [dx, dy]; return; } if (p && p.held && this.h.state === 'spin') { const a = Math.atan2(e.clientY - innerHeight / 2, e.clientX - innerWidth / 2); if (p.la != null) { const d = a - p.la; this.spinAdd += Math.abs(Math.atan2(Math.sin(d), Math.cos(d))); } p.la = a; return; } if (!p || p.used) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; if (Math.hypot(dx, dy) > SWIPE_PX && performance.now() - p.t < 450) { p.used = true; this.swipe(dx, dy); } });
    const up = (e) => { const p = this.ptrs.get(e.pointerId); if (!p) return; this.ptrs.delete(e.pointerId); if (p.held) { this.release(); return; } if (!p.used && performance.now() - p.t < 450) this.tap(); };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', (e) => { const p = this.ptrs.get(e.pointerId); this.ptrs.delete(e.pointerId); if (p && p.held) this.release(); });
    this.onKey = (e) => { if (e.repeat) return; if (e.key === 'Escape') this.stop(); if (e.key === ' ') this.tap(); if (e.key === '1') this.cast('freeze'); if (e.key === '2') this.cast('laser'); const d = { arrowleft: [-40, 0], arrowright: [40, 0], arrowup: [0, -40], arrowdown: [0, 40] }[e.key.toLowerCase()]; if (d) this.swipe(d[0], d[1]); }; addEventListener('keydown', this.onKey);
  }
  restart() {
    const h = this.h, v = this.v, cx = this.cx, cz = this.cz; if (this.endEl) { this.endEl.remove(); this.endEl = null; }
    Object.assign(h, { x: cx - 5, z: cz + 3.5, y: this.top, vx: 0, vz: 0, vy: 0, hp: h.hpMax, yaw: 0 }); Object.assign(v, { x: cx + 5, z: cz - 3.5, y: this.top, vx: 0, vz: 0, vy: 0, hp: v.hpMax, yaw: 0 }); h.go('idle', C.guard); v.go('idle', C.guard);
    this.over = false; this.fin = false; this.finSaid = false; if (this.vh) this.vh.style.background = 'linear-gradient(90deg,#b23cff,#ff5a5a)'; if (this.boxes) { for (const b of this.boxes) { b.up = true; b.m.visible = true; } for (const m of this.scars) this.g.disasters.ctx.scene.remove(m); this.scars.length = 0; this.lastScar = null; } this.energy = 40; this.finKind = null; this.finStage = null; this.hDazed = false; this.vfKind = null; this.vfStage = null; this.finSlow = 1; this.waving = false; this.finLet = false; this.k1 = this.k2 = this.k3 = 0; if (this.finEl) this.finEl.classList.remove('show'); v.bodyX = null; if (this.ice) this.dropIce(); this.v.overT = 0; this.grabCd = 0; this.combo = 0; this.comboT = 0; this.buffer = false; this.counterT = 0; this.slow = 0; this.cool = 1.4; this.dirC = 1; this.mash = 0; this.hits = 0; this.hitsT = 0; this.atk = null; this.tellOff(); this.say('', 0); const hi = this.el.querySelector('.hint'); this.hint0 = this.hint0 || hi.innerHTML; hi.innerHTML = this.hint0; hi.style.opacity = '0.9'; clearTimeout(this.hintT); this.hintT = setTimeout(() => { hi.style.opacity = '0'; }, 12000);
  }
  stop() { if (!this.active) return; this.active = false; removeEventListener('keydown', this.onKey); travel(placeKey(), 'sandbox'); }
  say(text, T = 0.7, col = '#fff') { this.sayEl.textContent = text; this.sayEl.style.color = col; this.sayEl.style.opacity = text ? '1' : '0'; this.sayT = T; }
  // ---------- input
  blockOn() { const h = this.h; if (this.over || this.hDazed || !['idle', 'attack', 'lunge', 'charge', 'land', 'dodge', 'cast'].includes(h.state)) return; if (this.energy < 1) { this.say('NO POWER TO BLOCK', 0.6, '#9fd4ff'); return; } this.energy -= this.energy / 3; this.atk = null; this.buffer = false; this.charging = false; this.combo = 0; this.comboT = 0; h.vx *= 0.2; h.vz *= 0.2; h.go('block', C.guardUp); this.blkEl.classList.add('on'); }
  blockOff() { const h = this.h; this.blkEl.classList.remove('on'); if (h.state === 'block') h.go('idle', C.guard); }
  // a blow taken on the block: a fifth of it; just as it was raised, none, and they stagger. Grabs go straight through a block
  blocked(n, kb) { const h = this.h, v = this.v, d = this.dist() || 1, parry = h.t < 0.22; h.hp -= parry ? 0 : n * 0.2; h.vx = (h.x - v.x) / d * kb; h.vz = (h.z - v.z) / d * kb; this.gain(parry ? 18 : 5); this.spark(h.x, h.y + 3, h.z, parry ? 3 : 2, [1, 1.7, 2.6]); sfx('thud', h.x, h.y + 3, h.z, { gain: 0.9, rate: 1.5 }); this.g.hitStop = Math.max(this.g.hitStop || 0, parry ? 0.1 : 0.05); this.say(parry ? 'PARRY!' : 'BLOCKED', 0.6, '#9fd4ff'); if (parry) { v.vx = -h.vx * 0.7; v.vz = -h.vz * 0.7; v.go('stun', CLIPS.hitBody); v.t = -0.35; } }
  tap() {
    if (this.over || this.hDazed) return; const h = this.h, v = this.v; if (this.finKind) { this.finTap(); return; } if (v.state === 'dazed') { this.say('PICK A FINISHER', 0.6, '#ffd27a'); return; }
    if (h.state === 'ankles') { this.smash(); return; } if (h.state === 'smash') { this.buffer = true; return; }
    if (v.state === 'down' && v.hp > 0 && this.grabCd <= 0 && ['idle', 'attack', 'land'].includes(h.state)) { v.t = 0; this.startAtk('ankle'); return; }
    if (h.state === 'grabbed') { this.mash++; sfx('thud', h.x, h.y + 2, h.z, { gain: 0.5, rate: 1.4 }); return; }
    if (this.counterT > 0 && ['idle', 'dodge', 'attack'].includes(h.state)) { this.counterT = 0; this.slow = 0; this.startAtk('counter'); return; }
    if (h.state === 'idle') this.nextAtk(); else if (h.state === 'attack' || h.state === 'lunge') this.buffer = true;
  }
  nextAtk() { if (this.comboT <= 0) this.combo = 0; this.startAtk(COMBO[this.combo % 3]); }
  startAtk(name) { const h = this.h, v = this.v; this.spinLet = false; if (name !== 'heavy' && name !== 'counter' && name !== 'seize' && ['idle', 'close'].includes(v.state) && !this.over && Math.random() < 0.45) { v.go('block', C.block); v.vx = 0; v.vz = 0; } this.atk = name; this.landed = false; this.buffer = false; this.comboT = 0; if (this.dist() > ATK[name].reach - 0.9) { h.go('lunge', ATK[name].clip === CLIPS.hammerDown ? C.charge : C.guard); sfx('whoosh', h.x, h.y, h.z, { gain: 0.5, rate: 1.5 }); } else { h.go('attack', ATK[name].clip); } }
  swipe(dx, dy) {
    if (this.over || this.hDazed) return; const h = this.h, v = this.v; if (!['idle', 'attack', 'lunge', 'charge'].includes(h.state)) return; if (this.energy < DASH_COST) { this.say('NO POWER TO DASH', 0.6, '#9fd4ff'); return; } this.energy -= DASH_COST;
    const cam = this.ctx.camera; _a.setFromMatrixColumn(cam.matrixWorld, 0); _a.y = 0; _a.normalize(); cam.getWorldDirection(_b); _b.y = 0; _b.normalize(); const l = Math.hypot(dx, dy) || 1, wx = _a.x * dx / l - _b.x * dy / l, wz = _a.z * dx / l - _b.z * dy / l, wl = Math.hypot(wx, wz) || 1;
    h.vx = wx / wl * 27; h.vz = wz / wl * 27; h.go('dodge', C.dodge); h.yaw = Math.atan2(h.vx, h.vz); this.combo = 0; this.comboT = 0; this.buffer = false; this.charging = false; sfx('whoosh', h.x, h.y, h.z, { gain: 0.8, rate: 1.1 });
    // just in time: the blow about to land or landing, and near enough to have mattered
    const late = (v.state === 'wind' && v.T - v.t < 0.28) || v.state === 'strike' || v.state === 'rush'; if (late && (this.dist() < 7 || v.state === 'rush' || v.kind === 'charge')) { this.gain(25); this.counterT = 0.95; this.slow = 0.45; this.say('COUNTER! TAP!', 0.9, '#ffd27a'); }
  }
  hold() { const h = this.h, v = this.v; if (this.hDazed) return false; if (this.finKind) return this.finHold(); if (v.state === 'dazed') return false; if (h.state === 'ankles') { v.go('swung', C.swung); h.go('spin', C.spinH); this.spinA = h.yaw; this.turned = 0; this.spinAdd = 0; this.say('SPIN! LET GO TO TOSS', 0.8, '#ffd27a'); sfx('whoosh', h.x, h.y + 2, h.z, { gain: 0.9 }); return true; } if (this.over || !['idle', 'attack'].includes(h.state) || (h.state === 'attack' && !this.landed)) return false; if (this.combo === 1 && this.comboT > 0) { this.startAtk('seize'); return true; } h.go('charge', C.charge); this.charging = true; this.k = 0; return true; }
  release() { const h = this.h; if (this.hDazed) { if (h.state === 'charge') { this.charging = false; h.go('idle', C.guard); } return; } if (this.finKind) { this.finRelease(); return; } if (h.state === 'spin') { this.toss(); return; } if (this.atk === 'seize' || this.atk === 'neck') { this.spinLet = true; return; } if (h.state !== 'charge') return; this.charging = false; this.heavyK = this.k; this.startAtk('heavy'); }
  // ---------- each frame
  dist() { return Math.hypot(this.v.x - this.h.x, this.v.z - this.h.z); }
  face(f, o, dt, k = 14) { let a = Math.atan2(o.x - f.x, o.z - f.z) - f.yaw; a = Math.atan2(Math.sin(a), Math.cos(a)); f.yaw += a * Math.min(1, dt * k); }
  frame(dt, tg) {
    const g = this.g, h = this.h, v = this.v; if (this.ptrs) for (const p of this.ptrs.values()) if (!p.used && !p.held && performance.now() - p.t > TAP_MS) { p.used = true; if (this.hold()) p.held = true; }
    if (!g.paused && dt > 0) {
      if (this.slow > 0) { this.slow -= dt; } this.rdt = dt; const ft = dt * (this.slow > 0 ? 0.3 : 1) * (this.finSlow || 1);
      if (this.counterT > 0) this.counterT -= dt; if (this.sayT > 0) { this.sayT -= dt; if (this.sayT <= 0) this.say('', 0); } if (this.hitsT > 0) { this.hitsT -= dt; if (this.hitsT <= 0) this.hits = 0; } if (this.comboT > 0) this.comboT -= ft; if (this.grabCd > 0) this.grabCd -= ft;
      this.heroStep(ft); this.vilStep(ft); this.separate(); this.clamp(h); this.clamp(v);
      h.pose(ft, this.top, this.grounded(h)); v.pose(v.state === 'frozen' ? 0 : ft, this.top, this.grounded(v)); if (v.state === 'dazed') this.wobble(v); if (h.state === 'dazed') this.wobble(h); this.fxStep(dt);
      this.ee.style.width = this.energy + '%'; for (const k in this.pwBtn) this.pwBtn[k].classList.toggle('ok', this.energy >= COST[k]);
      this.hh.style.width = Math.max(0, h.hp / h.hpMax * 100) + '%'; this.vh.style.width = Math.max(0, v.hp / v.hpMax * 100) + '%';
      this.heroStreak.update(_c.set(h.x, h.y + 2.2, h.z), ['lunge', 'dodge', 'skyRise', 'skyDive', 'finRun'].includes(h.state), this.ctx.camera, ft); this.vilStreak.update(_c.set(v.x, v.y + 2.2, v.z), v.state === 'rush' || v.state === 'vrise' || v.state === 'vdive', this.ctx.camera, ft);
    }
    this.place(dt); g.focusAt = _a.copy(this.look); tg.set(g.focusAt.x, 0, g.focusAt.z); this.focus = this.ctx.camera.position.distanceTo(g.focusAt);
  }
  grounded(f) { return f.y <= this.top + 0.01 && !['down', 'getup', 'flung', 'air', 'slammed', 'grabbed', 'held', 'swung', 'pinned', 'dragged', 'drag', 'hang', 'dived', 'skyRise', 'skyTop', 'skyGrab', 'skyDive', 'vdragged', 'vdrag', 'vair', 'vhang', 'vdived', 'vrise', 'vgrab', 'vdive'].includes(f.state); }
  clamp(f) { for (const b of this.boxes) { if (!b.up) continue; const ox = f.x - b.x, oz = f.z - b.z, m = b.hw + 1.1; if (Math.abs(ox) < m && Math.abs(oz) < m) { if (Math.abs(ox) > Math.abs(oz)) f.x = b.x + Math.sign(ox) * m; else f.z = b.z + Math.sign(oz) * m; } } const dx = f.x - this.cx, dz = f.z - this.cz, d = Math.hypot(dx, dz); if (d > ARENA) { f.x = this.cx + dx / d * ARENA; f.z = this.cz + dz / d * ARENA; f.vx *= 0.3; f.vz *= 0.3; } }
  separate() { const h = this.h, v = this.v; if (this.hDazed || Math.abs(h.y - v.y) > 3 || v.state === 'swung' || v.state === 'pinned' || v.state === 'dragged' || h.state === 'grabbed' || h.state === 'dodge' || v.state === 'rush') return; const dx = v.x - h.x, dz = v.z - h.z, d = Math.hypot(dx, dz) || 0.01; if (d < 1.9) { const p = (1.9 - d) / 2, nx = dx / d, nz = dz / d; h.x -= nx * p; h.z -= nz * p; v.x += nx * p; v.z += nz * p; } }
  walk(f, tx, tz, sp, dt) { const dx = tx - f.x, dz = tz - f.z, d = Math.hypot(dx, dz) || 1; f.x += dx / d * sp * dt; f.z += dz / d * sp * dt; f.phase += sp * dt * 1.1; f.walkK += (1 - f.walkK) * Math.min(1, dt * 10); }
  slide(f, dt, fr = 7) { f.x += f.vx * dt; f.z += f.vz * dt; const k = Math.exp(-fr * dt); f.vx *= k; f.vz *= k; }
  heroStep(dt) {
    const h = this.h, v = this.v; h.t += dt; h.walkK *= Math.exp(-dt * 10); const d = this.dist();
    switch (h.state) {
      case 'idle': if (this.hDazed && !this.over) { this.dazeHero(); break; } if (this.finKind && !this.over && (this.finStage === 'run' || this.finStage === 'up')) { h.go('finRun', C.guard); break; } this.slide(h, dt); this.face(h, v, dt); if (d > 9 && !this.over) this.walk(h, v.x, v.z, 5.5, dt); if (h.clip !== C.guard) h.play(C.guard); break;
      case 'lunge': { this.face(h, v, dt, 22); const A = ATK[this.atk], gap = A.reach - 1, sp = 30; if (v.state === 'air') { h.go('idle', C.guard); break; } if (d <= gap || h.t > 0.7) { h.go('attack', A.clip); break; } h.x += (v.x - h.x) / d * sp * dt; h.z += (v.z - h.z) / d * sp * dt; h.phase += dt * 30; h.walkK = 0.6; break; }
      case 'attack': { const A = ATK[this.atk]; this.face(h, v, dt, 18); this.slide(h, dt); if (!this.landed && h.t >= A.at) { this.landed = true; this.contact(A); if (h.state !== 'attack') break; } if (h.t >= A.end) this.afterAtk(); else if (this.buffer && this.landed && h.t >= A.at + 0.09 && COMBO.includes(this.atk)) this.afterAtk(); break; }
      case 'charge': this.face(h, v, dt); this.k = Math.min(1, this.k + dt / 0.9); h.r.root.position.y += 0; if (Math.random() < 0.3 * this.k) this.g.disasters.brawl.stunts.ring(h.x, this.top + 0.3, h.z, 1.6 + 2 * this.k, 0.25, new THREE.Color(1.6, 0.5, 1.4), 0.6); break;
      case 'spin': { const w = Math.min(15, 5 + 8 * h.t), st = w * dt + this.spinAdd; this.spinAdd = 0; this.spinA += st; this.turned += st; const fx = Math.sin(this.spinA), fz = Math.cos(this.spinA); h.yaw = this.spinA; v.x = h.x + fx * 1.5; v.z = h.z + fz * 1.5; v.y = this.top + 3.1; v.yaw = this.spinA; if (Math.random() < 0.25) this.g.disasters.brawl.stunts.ring(h.x, this.top + 0.25, h.z, 3, 0.2, new THREE.Color(1.2, 1.1, 1), 0.35); if ((this.spinLet && h.t > 0.6) || h.t > 3.5) this.toss(); break; }
      case 'ankles': { h.armsA = this.swingA; this.swingPlace(); if (h.t > 1.7) this.kickFree(); break; }
      case 'smash': { const u = Math.min(1, h.t / 0.36), e = u * u, a = this.fromA + (this.toA - this.fromA) * e; this.swingA = a; h.armsA = a; this.swingPlace(); if (u >= 1) this.smashHit(); break; }
      case 'drag': { const cam = this.ctx.camera; if (this.steer) { _a.setFromMatrixColumn(cam.matrixWorld, 0); _a.y = 0; _a.normalize(); cam.getWorldDirection(_b); _b.y = 0; _b.normalize(); const l = Math.hypot(this.steer[0], this.steer[1]) || 1, wx = _a.x * this.steer[0] / l - _b.x * this.steer[1] / l, wz = _a.z * this.steer[0] / l - _b.z * this.steer[1] / l; let da = Math.atan2(wx, wz) - this.dragYaw; da = Math.atan2(Math.sin(da), Math.cos(da)); this.dragYaw += Math.sign(da) * Math.min(Math.abs(da), dt * 3.4); }
        const fx = Math.sin(this.dragYaw), fz = Math.cos(this.dragYaw), st = 21 * dt; h.x += fx * st; h.z += fz * st; h.y = this.top + 1; h.yaw = this.dragYaw; v.x = h.x - fx * 6; v.z = h.z - fz * 6; v.y = this.top + 0.35; v.yaw = this.dragYaw + Math.PI; v.bodyX = -1.5; this.dragDist += st; this.hurtV(dt * 16); this.dragDmg += dt; this.scar(v.x + fx * 4, v.z + fz * 4, this.dragYaw); if (Math.random() < 0.8) this.chips(v.x + fx * 4, v.z + fz * 4); this.g.shake = Math.max(this.g.shake || 0, 0.14); this.smashBoxes(v.x + fx * 3, v.z + fz * 3, 2.6, 16); this.smashBoxes(h.x, h.z, 2, 0); const ed = Math.hypot(h.x - this.cx, h.z - this.cz); if (ed > ARENA - 8) { let ca = Math.atan2(this.cx - h.x, this.cz - h.z) - this.dragYaw; ca = Math.atan2(Math.sin(ca), Math.cos(ca)); this.dragYaw += Math.sign(ca) * Math.min(Math.abs(ca), dt * 2.6); } if (h.t > 14 || (this.finLet && h.t > 0.9)) this.fling2(); break; }
      case 'block': this.slide(h, dt, 6); this.face(h, v, dt, 12); this.energy = Math.max(0, this.energy - this.rdt * 10); if (this.energy <= 0) { this.blockOff(); this.say('NO POWER', 0.5, '#9fd4ff'); } break;
      case 'cast': if (h.t > 0.32) h.go('idle', C.guard); break;
      case 'dodge': this.slide(h, dt, 4); if (h.t > 0.26) { h.vx *= 0.15; h.vz *= 0.15; h.go('idle', C.guard); } break;
      case 'hurt': this.slide(h, dt); this.face(h, v, dt, 6); if (h.t > 0.4) { if (this.hDazed) this.dazeHero(); else h.go('idle', C.guard); } break;
      case 'flung': case 'air': if (Math.hypot(h.vx, h.vz) > 8 && this.vfStage === 'done') this.smashBoxes(h.x, h.z, 1.2, 0); h.vy -= G * dt; h.y += h.vy * dt; this.slide(h, dt, 1); if (h.y <= this.top) { h.y = this.top; h.vy = 0; h.vx *= 0.3; h.vz *= 0.3; this.puff(h, 0.5); h.go('down', C.down); } break;
      case 'down': this.slide(h, dt); if (this.vfStage === 'done') { if (!this.over && h.t > (this.vfKind === 'sky' ? 1.6 : 0.5)) this.finish(false); break; } if (h.t > 0.55 && !this.over) h.go('getup', C.getup); break;
      case 'getup': if (h.t > 0.55) { if (this.hDazed) { this.dazeHero(); break; } h.go('idle', C.guard); } break;
      case 'dazed': this.face(h, v, dt, 2); h.walkK = 0; break;
      case 'vdragged': case 'vdived': break;
      case 'vair': h.vy -= G * dt; h.y += h.vy * dt; if (h.vy < 1) { h.vy = 0; h.go('vhang', CLIPS.hitUp); this.vfStage = 'rise'; v.y0 = v.y; v.go('vrise', CLIPS.dash); this.finSlow = 0.5; sfx('whoosh', v.x, v.y, v.z, { gain: 1.1, rate: 0.9 }); } break;
      case 'vhang': h.y += Math.sin(h.t * 3) * dt * 0.4; break;
      case 'finRun': { this.face(h, v, dt, 22); if (d <= 2.9 || h.t > 1.2) { if (this.finKind === 'neck') this.startAtk('neck'); else { h.go('skyCharge', C.chargeWind); this.k1 = 0; this.finStage = 'charge'; if (!this.finLet) this.say('HOLD: HIGHER!', 0.9, '#ffd27a'); } break; } h.x += (v.x - h.x) / d * 30 * dt; h.z += (v.z - h.z) / d * 30 * dt; h.phase += dt * 30; h.walkK = 0.6; break; }
      case 'skyCharge': this.face(h, v, dt, 20); this.k1 = Math.min(1, this.k1 + this.rdt / 1.6); if (Math.random() < 0.45) this.g.disasters.brawl.stunts.ring(h.x, this.top + 0.3, h.z, 1.4 + 3.5 * this.k1, 0.25, new THREE.Color(1.8, 1.4, 0.6), 0.7); if (this.finLet || this.k1 >= 1) this.skyPunch(); break;
      case 'skyRise': { const k = Math.min(1, h.t / 0.35); h.x += (v.x - h.x) * Math.min(1, dt * 14); h.z += (v.z - h.z) * Math.min(1, dt * 14); h.y = h.y0 + (v.y + 3.2 - h.y0) * (1 - (1 - k) * (1 - k)); if (k >= 1) { h.go('skyTop', CLIPS.liftOverhead); this.finSlow = 0.35; this.say('HOLD: GRAB THEM!', 1.4, '#ffd27a'); } break; }
      case 'skyTop': h.x = v.x; h.z = v.z; h.y = v.y + 3.2; h.yaw = v.yaw; if (h.t > 0.9) { h.go('skyGrab', CLIPS.hammerUp); this.k2 = 0; this.finLet = true; } break;
      case 'skyGrab': h.x = v.x; h.z = v.z; this.k2 = Math.min(1, this.k2 + this.rdt / 1.5); h.y = v.y + 3.2 - 0.7 * this.k2; if (Math.random() < 0.45) this.g.disasters.brawl.stunts.ring(h.x, h.y + 1.5, h.z, 1.2 + 3 * this.k2, 0.25, new THREE.Color(1.8, 1.3, 0.5), 0.7); if (this.finLet || this.k2 >= 1) this.skyDive(); break;
      case 'skyDive': if (this.waving) { this.k3 = Math.min(1, this.k3 + this.rdt / 1.8); h.y -= dt * 3; if (Math.random() < 0.6) this.g.disasters.brawl.stunts.ring(h.x, h.y - 1, h.z, 2 + 7 * this.k3, 0.3, new THREE.Color(1.8, 1.2 - 0.6 * this.k3, 0.4), 0.8); if (this.k3 >= 1) this.skyDrop(); } else h.y -= this.diveSp * dt; v.x = h.x; v.z = h.z; v.y = h.y - 2.8; v.yaw = h.yaw; if (v.y <= this.top) this.skyHit(); break;
      case 'land': if (h.t > 0.4) h.go('idle', C.guard); break;
      default: break;
    }
  }
  afterAtk() { const h = this.h; const was = this.atk; if (COMBO.includes(was)) { const i = COMBO.indexOf(was); this.combo = i === 2 ? 0 : i + 1; this.comboT = i === 2 ? 0 : COMBO_T; } this.atk = null; const b = this.buffer; this.buffer = false; h.go('idle', C.guard); if (b && this.combo > 0) this.nextAtk(); }
  // the blow, if the bodies really meet
  contact(A) {
    const h = this.h, v = this.v, d = this.dist(), hit = d <= A.reach && Math.abs(v.y - h.y) < 4 && (A.ankle ? v.state === 'down' : A.neck ? v.state === 'dazed' : !['down', 'getup', 'flung', 'air', 'slammed', 'swung', 'pinned', 'dragged'].includes(v.state)); if (!hit) { sfx('whoosh', h.x, h.y + 2, h.z, { gain: 0.4, rate: 1.7 }); return; }
    if (A.neck) { this.atk = null; this.steer = null; this.dragYaw = Math.atan2(h.x - v.x, h.z - v.z); this.dragDist = 0; this.dragDmg = 0; h.y = this.top + 1; v.go('dragged', C.dragged); h.go('drag', C.drag); this.g.hitStop = Math.max(this.g.hitStop || 0, 0.05); sfx('thud', v.x, v.y + 1, v.z, { gain: 1, rate: 0.8 }); sfx('crash', v.x, v.y, v.z, { gain: 0.5, rate: 1.4 }); this.say('BY THE NECK!', 0.9, '#ffd27a'); return; }
    if (A.ankle) { this.grabCd = 10; h.yaw = Math.atan2(v.x - h.x, v.z - h.z); this.smashes = 0; this.swingA = A0; this.atk = null; v.go('pinned', C.swung); h.go('ankles', C.spinH); h.armsA = A0; this.swingPlace(); this.g.hitStop = Math.max(this.g.hitStop || 0, 0.04); sfx('thud', v.x, v.y + 1, v.z, { gain: 0.9 }); this.say('TAP: SMASH \u00B7 HOLD: SPIN', 1.2, '#ffd27a'); return; }
    const breaks = A === ATK.heavy || A === ATK.counter;
    if (v.state === 'block' && !breaks && !A.seize) { this.hurtV(1); this.spark(v.x, v.y + 3, v.z, 1.4, [1.2, 1.4, 2.2]); sfx('thud', v.x, v.y + 2, v.z, { gain: 0.8, rate: 1.7 }); this.say('BLOCKED! HOLD TO BREAK IT', 0.9, '#9fd4ff'); this.combo = 0; this.comboT = 0; this.buffer = false; const b = Math.hypot(h.x - v.x, h.z - v.z) || 1; h.vx = (h.x - v.x) / b * 9; h.vz = (h.z - v.z) / b * 9; this.atk = null; h.go('hurt', CLIPS.hitBody); this.g.hitStop = Math.max(this.g.hitStop || 0, 0.05); v.go('idle', C.guard); this.vilAtk('jab'); v.T = 0.3; return; }
    if ((v.state === 'wind' || v.state === 'strike') && v.armor && !breaks) { this.hurtV(A.dmg * 0.5); this.gain(3); this.spark(v.x, v.y + 3, v.z, 1.6, [2.2, 0.8, 0.5]); sfx('thud', v.x, v.y + 2, v.z, { gain: 0.8, rate: 0.9 }); this.say('NOT STOPPING! DODGE!', 0.8, '#ff8a7a'); return; }
    v.armor = false;
    if (v.state === 'frozen') { if (A.knock || A.launch || A.seize) { this.shatter(); } else { this.hurtV(A.dmg); this.gain(8); this.hits++; this.hitsT = 1.2; if (this.hits >= 2) this.say(this.hits + ' HITS', 0.7, '#ffd27a'); this.g.hitStop = Math.max(this.g.hitStop || 0, A.stop); this.spark(v.x, v.y + 3, v.z, 1.8, [1.4, 2, 2.6]); sfx('thud', v.x, v.y + 2, v.z, { gain: 0.8, rate: 1.5 }); return; } }
    this.gain(A.knock ? 12 : 8);
    const nx = (v.x - h.x) / (d || 1), nz = (v.z - h.z) / (d || 1), dmg = A.dmg + (A === ATK.heavy ? 30 * (this.heavyK || 0) : 0); this.tellOff(); this.hurtV(dmg);
    this.hits++; this.hitsT = 1.2; if (this.hits >= 2) this.say(this.hits + ' HITS', 0.7, '#ffd27a'); this.g.hitStop = Math.max(this.g.hitStop || 0, A.stop); this.g.shake = Math.max(this.g.shake || 0, A.shake); this.spark(v.x - nx, v.y + 3, v.z - nz, A.knock || A.launch ? 3 : 1.8); sfx(A.knock || A.launch ? 'crash' : 'thud', v.x, v.y + 2, v.z, { gain: A.knock ? 1 : 0.8, rate: A.knock ? 0.8 : 1.2 });
    v.yaw = Math.atan2(-nx, -nz);
    if (A.seize) { v.go('swung', C.swung); h.go('spin', C.spinH); this.spinA = Math.atan2(nx, nz); this.turned = 0; this.spinAdd = 0; v.vx = v.vz = v.vy = 0; this.say('SPIN!', 0.7, '#ffd27a'); sfx('whoosh', h.x, h.y + 2, h.z, { gain: 0.9 }); return; }
    if (A.launch) { v.go('air', CLIPS.hitUp); v.vy = 18 + 22 * (this.k1 || 0); v.vx = 0; v.vz = 0; v.y = this.top + 0.5; this.finStage = 'rise'; this.say('TAP: FLY UP!', 1.5, '#ffd27a'); return; }
    if (A.knock || v.hp <= 0) { const K = A.knock || [14, 5]; v.go('flung', CLIPS[A.react]); v.vx = nx * K[0]; v.vz = nz * K[0]; v.vy = K[1]; return; }
    v.go('stun', CLIPS[A.react]); v.vx = nx * A.kb; v.vz = nz * A.kb;
  }
  // held by the feet, the body one line with the arms: the feet at the hands, the head out beyond them
  swingPlace() { const h = this.h, v = this.v, a = this.swingA, fx = Math.sin(h.yaw), fz = Math.cos(h.yaw), s = Math.sin(a), c = Math.cos(a); v.x = h.x + fx * 1.28 * s; v.z = h.z + fz * 1.28 * s; v.y = this.top + 3.25 - 1.28 * c; v.yaw = h.yaw; v.bodyX = Math.atan2(s, -c); }
  smash() { const h = this.h; this.fromA = this.swingA; this.toA = this.swingA < Math.PI ? A1 : A0; this.buffer = false; h.go('smash'); sfx('whoosh', h.x, h.y + 3, h.z, { gain: 1, rate: 0.7 }); }
  smashHit() {
    const h = this.h, v = this.v, n = this.smashes++, s = Math.sin(this.swingA), hx = h.x + Math.sin(h.yaw) * 5 * s, hz = h.z + Math.cos(h.yaw) * 5 * s; this.hurtV(SMASH_DMG[Math.min(n, 2)]); this.gain(6); this.puff({ x: hx, z: hz }, 0.5 + n * 0.15); this.g.hitStop = Math.max(this.g.hitStop || 0, 0.09); this.g.shake = Math.max(this.g.shake || 0, 0.6 + n * 0.15); sfx('crash', hx, this.top, hz, { gain: 1, rate: 0.75 }); this.hits++; this.hitsT = 1.2; this.say(this.smashes + ' SMASH' + (this.smashes > 1 ? 'ES' : '') + '!', 0.7, '#ffd27a');
    if (v.hp <= 0) { v.bodyX = null; v.y = this.top; v.go('down', C.down); h.go('idle', C.guard); return; }
    if (this.smashes >= 3) { this.kickFree(); return; }
    h.go('ankles'); h.armsA = this.swingA; v.bodyX = Math.atan2(s, -Math.cos(this.swingA)); if (this.buffer) this.smash();
  }
  kickFree() { const h = this.h, v = this.v, fx = Math.sin(h.yaw) * (this.swingA < Math.PI ? 1 : -1), fz = Math.cos(h.yaw) * (this.swingA < Math.PI ? 1 : -1); v.y = this.top; v.x = h.x + fx * 3; v.z = h.z + fz * 3; v.go('getup', C.getup); h.vx = -fx * 7; h.vz = -fz * 7; h.go('hurt', CLIPS.hitBody); sfx('thud', v.x, v.y + 1, v.z, { gain: 0.8 }); this.say('KICKED FREE!', 0.7, '#ff8a7a'); }
  // the drag over: flung on ahead
  fling2() { const h = this.h, v = this.v, fx = Math.sin(this.dragYaw), fz = Math.cos(this.dragYaw); v.bodyX = null; v.x = h.x; v.z = h.z; v.y = this.top + 1.5; v.yaw = this.dragYaw + Math.PI; v.go('flung', CLIPS.blownBack); v.vx = fx * 24; v.vz = fz * 24; v.vy = 6; h.y = this.top; h.vx = 0; h.vz = 0; h.go('land', CLIPS.throw); this.finStage = 'done'; this.killBlow(); sfx('whoosh', v.x, v.y, v.z, { gain: 1.1, rate: 0.8 }); }
  // ---------- the finishers: chosen at zero health, then carried through
  finPick(kind) { const h = this.h, v = this.v; if (this.over || this.finKind || v.state !== 'dazed') return; this.finKind = kind; this.finStage = 'run'; this.finLet = false; this.finEl.classList.remove('show'); this.atk = null; this.buffer = false; this.charging = false; this.counterT = 0; this.slow = 0; this.blockOff(); if (this.ice) this.dropIce(); h.y = this.top; h.vx = 0; h.vz = 0; h.go('finRun', C.guard); this.say(kind === 'neck' ? 'BY THE NECK!' : 'TO THE SKY!', 0.8, '#ffd27a'); sfx('whoosh', h.x, h.y, h.z, { gain: 0.7, rate: 1.4 }); }
  finTap() { if (this.finKind === 'sky' && this.finStage === 'rise' && this.v.state === 'air') this.skyRise(); }
  finHold() { const h = this.h; if (this.finKind !== 'sky') return false; if (this.finStage === 'top' && h.state === 'skyTop') { h.go('skyGrab', CLIPS.hammerUp); this.k2 = 0; this.finLet = false; this.say('', 0); return true; } if (this.finStage === 'dive' && h.state === 'skyDive' && !this.waving && !this.finLet) { this.waving = true; this.k3 = 0; this.say('', 0); return true; } return false; }
  finRelease() { const h = this.h; if (h.state === 'drag') { this.fling2(); return; } if (h.state === 'skyCharge') { this.skyPunch(); return; } if (h.state === 'skyGrab') { this.skyDive(); return; } if (h.state === 'skyDive' && this.waving) { this.skyDrop(); return; } this.finLet = true; }
  skyPunch() { const h = this.h; this.atk = 'upper'; this.landed = false; this.buffer = false; this.finStage = 'up'; h.go('attack', CLIPS.uppercut); sfx('whoosh', h.x, h.y + 2, h.z, { gain: 1, rate: 0.7 }); }
  // the tap: up past them; they hang at the top while time slows
  skyRise() { const h = this.h, v = this.v; this.finStage = 'top'; h.y0 = h.y; h.go('skyRise', CLIPS.dash); v.go('hang', CLIPS.hitUp); v.vy = 0; v.vx = 0; v.vz = 0; this.say('', 0); sfx('whoosh', h.x, h.y, h.z, { gain: 1.1, rate: 0.9 }); }
  skyDive() { const h = this.h, v = this.v; this.finStage = 'dive'; this.waving = false; this.finLet = false; this.k3 = 0; this.diveSp = 30 + 50 * (this.k2 || 0); this.finSlow = 0.3; h.go('skyDive', CLIPS.hammerDown); v.go('dived', CLIPS.crushed); this.spark(v.x, v.y + 2, v.z, 2.5, [2.2, 1.6, 0.6]); sfx('thud', v.x, v.y, v.z, { gain: 1, rate: 0.7 }); this.say('HOLD: SHOCKWAVE!', 1.4, '#ffd27a'); }
  skyDrop() { this.waving = false; this.finLet = true; this.finSlow = 1; this.diveSp = 70 + 40 * (this.k3 || 0); sfx('whoosh', this.h.x, this.h.y, this.h.z, { gain: 1.2, rate: 0.6 }); }
  // the ground: a wave as wide as the hold was long, a mini nuke at the top
  skyHit() {
    const h = this.h, v = this.v, D = this.g.disasters, S = D.ctx.scene, k2 = this.k2 || 0, k3 = this.k3 || 0, R = 5 + 5 * k2 + 28 * k3, x = h.x, z = h.z; this.finSlow = 1; this.finStage = 'done'; h.y = this.top; h.vy = 0; v.y = this.top; v.bodyX = null; v.go('down', C.down); h.go('land', CLIPS.land); this.killBlow();
    for (let i = 0; i < 3 + Math.round(4 * k3); i++) D.brawl.stunts.ring(x, this.top + 0.3 + i * 0.4, z, R * (1 - i * 0.07), 0.5 + 0.2 * i + 0.4 * k3, new THREE.Color(1.7, 1.3 - 0.12 * i, 0.6), 0.8);
    const n = 30 + Math.round(130 * k3); for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, r = Math.random() * R * 0.5, s = 0.3 + Math.random() * (0.6 + k3); D.debris.add(x + Math.cos(a) * r, this.top + 0.3, z + Math.sin(a) * r, s, s * 0.6, s, Math.random() < 0.6 ? 0xb9b1a0 : 0x7d7566, 'fly', { v: [Math.cos(a) * (8 + 22 * k3), 4 + Math.random() * (8 + 32 * k3), Math.sin(a) * (8 + 22 * k3)], life: 1.5 + k3 }); }
    if (k3 > 0.5) for (let i = 0; i < 10; i++) D.brawl.stunts.ring(x, this.top + 1 + i * (2 + 3 * k3), z, 3 + 3 * k3 + i * 0.6, 1.2 + i * 0.12, new THREE.Color(1.5, 1.1, 0.7), 0.6);
    for (const b of this.boxes) if (b.up && Math.hypot(b.x - x, b.z - z) < R + b.hw) this.smashBoxes(b.x, b.z, 0.1, 0);
    const m = new THREE.Mesh(new THREE.CircleGeometry(R * 0.35, 32).rotateX(-Math.PI / 2), this.scarMat); m.position.set(x, this.top + 0.04, z); S.add(m); this.scars.push(m);
    D.flash(0.25 + 0.6 * k3); this.g.shake = Math.max(this.g.shake || 0, 1 + 2.5 * k3); this.g.hitStop = Math.max(this.g.hitStop || 0, 0.18 + 0.1 * k3); sfx('collapse', x, this.top, z, { gain: 1 + k3, rate: 0.5 }); sfx('crash', x, this.top, z, { gain: 1, rate: 0.6 }); this.say(k3 > 0.85 ? 'MINI NUKE!' : k3 > 0.4 ? 'SHOCKWAVE!' : 'SLAMMED!', 1.6, '#ffd27a');
  }
  // zero health: dazed and wobbly, waiting for the choice
  daze() { const v = this.v, h = this.h; if (v.state === 'hold') { h.y = this.top; h.go('hurt', CLIPS.hitBody); } if (h.state === 'charge') { this.charging = false; h.go('idle', C.guard); } v.go('dazed', C.stumble); v.vx = 0; v.vz = 0; v.vy = 0; v.y = this.top; v.armor = false; v.bodyX = null; this.tellOff(); this.combo = 0; this.comboT = 0; this.buffer = false; this.launched = false; this.vh.style.background = 'linear-gradient(90deg,#ffd27a,#fff2a8)'; this.say('FINISH THEM!', 1.6, '#ffd27a'); this.finEl.classList.add('show'); this.el.querySelector('.hint').style.opacity = '0'; sfx('thud', v.x, v.y + 2, v.z, { gain: 0.7, rate: 0.5 }); }
  wobble(v) { const r = v.r, t = v.t; r.torso.rotation.z += Math.sin(t * 3.1) * 0.22; r.torso.rotation.x += 0.12 + Math.sin(t * 2.2) * 0.12; r.head.rotation.z += Math.sin(t * 4.3) * 0.25; r.head.rotation.y += Math.sin(t * 1.7) * 0.4; r.root.position.x += Math.sin(t * 1.9) * 0.3; r.root.position.z += Math.cos(t * 1.4) * 0.3; }
  // a trench behind them, in the cement
  scar(x, z, yaw) { if (this.lastScar && Math.hypot(x - this.lastScar[0], z - this.lastScar[1]) < 1.3) return; this.lastScar = [x, z]; const S = this.g.disasters.ctx.scene, m = new THREE.Mesh(this.scarGeo, this.scarMat); m.position.set(x, this.top + 0.05, z); m.rotation.y = yaw + (Math.random() - 0.5) * 0.3; m.scale.set(1.6 + Math.random() * 1, 1, 1.9); S.add(m); this.scars.push(m); if (this.scars.length > 70) S.remove(this.scars.shift()); }
  chips(x, z) { const D = this.g.disasters, s = 0.2 + Math.random() * 0.5, a = Math.random() * 6.28; D.debris.add(x, this.top + 0.3, z, s, s * 0.6, s, Math.random() < 0.5 ? 0xb9b1a0 : 0x7d7566, 'fly', { v: [Math.cos(a) * 6, 3 + Math.random() * 6, Math.sin(a) * 6], life: 0.9 }); }
  // the small buildings on the plaza: whoever is driven through one brings it down
  buildBoxes() { const S = this.g.disasters.ctx.scene, cx = this.cx, cz = this.cz, c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#a78a6c'; x.fillRect(0, 0, 128, 128); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 3 ? '#2b2c33' : '#5c6470'; x.fillRect(10 + i * 29, 10 + j * 29, 17, 19); } this.boxTex = new THREE.CanvasTexture(c); this.boxTex.colorSpace = THREE.SRGBColorSpace; const wall = new THREE.MeshStandardMaterial({ map: this.boxTex, roughness: 0.9 }), roof = new THREE.MeshStandardMaterial({ color: '#7d6b58', roughness: 1 }), geo = new THREE.BoxGeometry(1, 1, 1); this.boxes = [[-2.55, 25, 8, 7], [-1.85, 30, 7, 9], [-1.05, 31, 9, 6], [-0.3, 28, 7, 8], [-3.3, 30, 8, 6], [0.45, 30, 7, 7]].map(([a, r, w, hgt]) => { const m = new THREE.Mesh(geo, [wall, wall, roof, roof, wall, wall]), bx = cx + Math.cos(a) * r, bz = cz + Math.sin(a) * r; m.position.set(bx, this.top + hgt / 2, bz); m.scale.set(w, hgt, w); m.castShadow = true; m.receiveShadow = true; S.add(m); return { m, x: bx, z: bz, hw: w / 2, hgt, up: true }; }); this.scarGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2); this.scarMat = new THREE.MeshStandardMaterial({ color: '#6b6250', roughness: 1 }); this.scars = []; }
  smashBoxes(x, z, r, dmg) { const D = this.g.disasters; for (const b of this.boxes) { if (!b.up || Math.abs(x - b.x) > b.hw + r || Math.abs(z - b.z) > b.hw + r) continue; b.up = false; b.m.visible = false; if (dmg) this.hurtV(dmg); this.gain(6); for (let i = 0; i < 34; i++) { const s = 0.4 + Math.random() * 1.1; D.debris.add(b.x + (Math.random() - 0.5) * b.hw * 2, this.top + Math.random() * b.hgt, b.z + (Math.random() - 0.5) * b.hw * 2, s, s * 0.7, s, Math.random() < 0.65 ? 0xa78a6c : 0x5c6470, 'fly', { v: [(Math.random() - 0.5) * 18, 2 + Math.random() * 9, (Math.random() - 0.5) * 18], life: 1.4 }); } D.brawl.stunts.ring(b.x, this.top + 0.3, b.z, b.hw + 6, 0.35, new THREE.Color(1.2, 1.1, 0.9), 0.6); sfx('collapse', b.x, this.top + 2, b.z, { gain: 0.8 }); this.g.hitStop = Math.max(this.g.hitStop || 0, 0.1); this.g.shake = Math.max(this.g.shake || 0, 0.8); this.say('THROUGH THE BUILDING!', 0.8, '#ffd27a'); } }
  // let go: they fly straight out from where they are in the swing; the more turns, the harder
  toss() { const h = this.h, v = this.v, k = Math.min(1, this.turned / (Math.PI * 2 * 3)), fx = Math.sin(this.spinA), fz = Math.cos(this.spinA), sp = 14 + 22 * k; this.hurtV(15 + 40 * k); this.gain(8); v.go('flung', CLIPS.blownBack); v.vx = fx * sp; v.vz = fz * sp; v.vy = 5 + 6 * k; v.tossK = k; v.yaw = this.spinA + Math.PI; h.go('land', CLIPS.throw); this.atk = null; this.combo = 0; this.comboT = 0; this.g.hitStop = Math.max(this.g.hitStop || 0, 0.07); this.g.shake = Math.max(this.g.shake || 0, 0.3 + 0.4 * k); sfx('whoosh', v.x, v.y, v.z, { gain: 1.1, rate: 0.75 }); this.say(k > 0.8 ? 'HUGE TOSS!' : 'TOSSED!', 0.8, '#ffd27a'); }
  gain(n) { this.energy = Math.min(100, this.energy + n); }
  // a power: paid for only if it can work now
  cast(id) {
    if (this.over || this.hDazed) return; const h = this.h, v = this.v, free = id === 'laser' && v.state === 'hold', okH = ['idle', 'attack', 'lunge', 'dodge', 'charge', 'land', 'block'].includes(h.state) || (free && h.state === 'grabbed');
    if (this.energy < COST[id]) { this.say('NOT ENOUGH ENERGY', 0.6, '#9fd4ff'); return; } if (!okH || (!CAN_TARGET.includes(v.state) && !free) || (id === 'freeze' && v.state === 'frozen')) { this.say('NOT NOW', 0.5, '#9fd4ff'); return; }
    this.energy -= COST[id]; this.atk = null; this.buffer = false; this.charging = false; this.counterT = 0; this.tellOff(); v.armor = false;
    if (free) { h.y = this.top; }
    h.yaw = Math.atan2(v.x - h.x, v.z - h.z); h.vx = 0; h.vz = 0; h.go('cast', C.cast);
    if (id === 'freeze') { const fx = Math.sin(h.yaw), fz = Math.cos(h.yaw); this.beam(h.x + fx * 1.4, h.y + 3.2, h.z + fz * 1.4, v.x, v.y + 2.6, v.z, [0.5, 1.8, 3], 0.32, 0.3); this.beam(h.x + fx * 1.4, h.y + 3.2, h.z + fz * 1.4, v.x, v.y + 2.6, v.z, [3, 3.6, 4], 0.1, 0.3); this.freezeV(); }
    else this.laser();
  }
  freezeV() {
    const v = this.v, S = this.g.disasters.ctx.scene; v.vx = 0; v.vz = 0; v.walkK = 0; v.go('frozen'); v.vy = 0; sfx('glass', v.x, v.y + 2, v.z, { gain: 0.9, rate: 0.6 }); this.say('STUNNED! HIT THEM NOW', 1, '#9fe8ff');
    this.ice = new THREE.Mesh(new THREE.BoxGeometry(2.5, 5.4, 2.5), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.75, 1.15, 1.5), transparent: true, opacity: 0.42, depthWrite: false, fog: false })); this.ice.position.set(v.x, this.top + 2.8, v.z); this.ice.renderOrder = 4; S.add(this.ice);
  }
  dropIce() { if (!this.ice) return; const S = this.g.disasters.ctx.scene; S.remove(this.ice); this.ice.geometry.dispose(); this.ice.material.dispose(); this.ice = null; }
  shatter() { const v = this.v, D = this.g.disasters; this.dropIce(); for (let i = 0; i < 16; i++) { const s = 0.2 + Math.random() * 0.5; D.debris.add(v.x + (Math.random() - 0.5) * 2.5, this.top + Math.random() * 5, v.z + (Math.random() - 0.5) * 2.5, s, s * 0.6, s, 0xdff6ff, 'fly', { v: [(Math.random() - 0.5) * 16, 2 + Math.random() * 8, (Math.random() - 0.5) * 16], life: 1 }); } sfx('glassBig', v.x, v.y + 2, v.z, { gain: 1 }); this.g.shake = Math.max(this.g.shake || 0, 0.4); }
  // the laser: a beam, next to no damage, shoves them back on their feet; stops anything, frees you from a grab
  laser() {
    const h = this.h, v = this.v, wasHold = v.state === 'hold', d = Math.hypot(v.x - h.x, v.z - h.z) || 1, nx = (v.x - h.x) / d, nz = (v.z - h.z) / d, fx = Math.sin(h.yaw), fz = Math.cos(h.yaw);
    this.beam(h.x + fx * 1.4, h.y + 3.2, h.z + fz * 1.4, v.x, v.y + 2.8, v.z, [2.4, 0.3, 1.5], 0.34, 0.3); this.beam(h.x + fx * 1.4, h.y + 3.2, h.z + fz * 1.4, v.x, v.y + 2.8, v.z, [2.6, 1.6, 2.2], 0.1, 0.3);
    if (v.state === 'frozen') this.shatter(); this.hurtV(6); this.g.hitStop = Math.max(this.g.hitStop || 0, 0.06); this.g.shake = Math.max(this.g.shake || 0, 0.3); sfx('laser', h.x, h.y + 3, h.z, { gain: 0.9 }); this.spark(v.x, v.y + 3, v.z, 2.2, [2.4, 0.5, 1.5]);
    v.y = this.top; v.vx = nx * 27; v.vz = nz * 27; v.yaw = Math.atan2(-nx, -nz); v.go('pushed', CLIPS.blownBack); if (wasHold) { h.y = this.top; this.mash = 0; }
  }
  beam(ax, ay, az, bx, by, bz, c, r, T) { const D = this.g.disasters, m = new THREE.Mesh(this.ray, new THREE.MeshBasicMaterial({ color: new THREE.Color(c[0], c[1], c[2]), transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); _a.set(bx - ax, by - ay, bz - az); const l = _a.length() || 0.01; m.position.set(ax, ay, az); m.quaternion.setFromUnitVectors(_b.set(0, 1, 0), _a.normalize()); m.scale.set(r, l, r); m.frustumCulled = false; m.renderOrder = 7; D.ctx.scene.add(m); this.fx.push({ m, t: 0, T }); }
  fxStep(dt) { if (!this.fx.length) return; for (const q of this.fx) { q.t += dt; q.m.material.opacity = Math.max(0, 0.95 * (1 - q.t / q.T)); if (q.t >= q.T) { q.done = true; q.m.parent.remove(q.m); q.m.material.dispose(); } } this.fx = this.fx.filter(q => !q.done); }
  hurtV(n) { const v = this.v; v.hp -= n; if (v.hp < 0) v.hp = 0; }
  finishable() { return this.v.state === 'dazed' && !this.over; }
  killBlow() { this.fin = true; this.hurtV(9999); this.g.disasters.flash(0.2); this.g.hitStop = Math.max(this.g.hitStop || 0, 0.16); this.g.shake = Math.max(this.g.shake || 0, 1.2); this.say('FINISHED!', 1.4, '#ffd27a'); }
  hurtH(n, why) { const h = this.h; h.hp -= n; if (h.hp <= 0) { h.hp = 0; if (!this.hDazed) { this.hDazed = true; this.say('TYRANT FINISHES YOU', 1.6, '#ff8a7a'); this.hh.style.background = 'linear-gradient(90deg,#ff5a5a,#ffb0a0)'; } } this.gain(4); this.combo = 0; this.comboT = 0; this.buffer = false; this.charging = false; this.hits = 0; this.counterT = 0; this.g.shake = Math.max(this.g.shake || 0, 0.4); this.g.hitStop = Math.max(this.g.hitStop || 0, 0.06); this.spark(h.x, h.y + 3, h.z, 2.2, [2.4, 0.4, 0.3]); sfx('thud', h.x, h.y + 2, h.z, { gain: 1.1, rate: 0.8 }); if (why) this.say(why, 0.7, '#ff8a7a'); }
  spark(x, y, z, R, c = [2.2, 1.9, 1.3]) { const D = this.g.disasters; D.brawl.stunts.ring(x, y, z, R, 0.16, new THREE.Color(c[0], c[1], c[2]), 0.9); for (let i = 0; i < 5; i++) { const s = 0.12 + Math.random() * 0.14; D.debris.add(x, y, z, s, s, s, 0xfff2c0, 'fly', { v: [(Math.random() - 0.5) * 12, 2 + Math.random() * 6, (Math.random() - 0.5) * 12], life: 0.8 }); } }
  puff(f, k) { const D = this.g.disasters; D.brawl.stunts.ring(f.x, this.top + 0.25, f.z, 3 + 8 * k, 0.3, new THREE.Color(1.2, 1.1, 0.9), 0.6); for (let i = 0; i < 8 * k + 3; i++) { const a = Math.random() * 6.28, s = 0.2 + Math.random() * 0.4; D.debris.add(f.x, this.top + 0.2, f.z, s, s * 0.6, s, 0x9a9184, 'fly', { v: [Math.cos(a) * 6, 2 + Math.random() * 4, Math.sin(a) * 6], life: 0.9 }); } sfx('thud', f.x, this.top, f.z, { gain: 0.6 + k, rate: 0.7 }); }
  tellOff() { this.tell.material.opacity = 0; this.strip.material.opacity = 0; }
  // ---------- Tyrant
  vilStep(dt) {
    const h = this.h, v = this.v; v.t += dt; v.walkK *= Math.exp(-dt * 10); const d = this.dist();
    if (v.hp <= 0 && !this.fin && ['idle', 'close', 'wind', 'strike', 'rush', 'block', 'stumble', 'stun', 'pushed', 'hold'].includes(v.state)) { this.daze(); return; }
    if (this.hDazed && !this.vfKind && !this.over && ['idle', 'close', 'wind', 'strike', 'rush', 'block', 'stumble', 'stun', 'pushed', 'hold', 'frozen'].includes(v.state)) { if (v.state === 'frozen') this.shatter(); this.vfStart(); return; }
    switch (v.state) {
      case 'vfin': { this.face(v, h, dt, 12); if (h.state !== 'dazed') break; if (d > 2.6) { this.walk(v, h.x, h.z, 8, dt); break; } if (this.vfKind === 'neck') this.vfNeck(); else { this.vfStage = 'charge'; v.go('vcharge', C.chargeWind); } break; }
      case 'vdrag': { const ed = Math.hypot(v.x - this.cx, v.z - this.cz); if (ed > ARENA - 8) { let ca = Math.atan2(this.cx - v.x, this.cz - v.z) - this.dragYaw; ca = Math.atan2(Math.sin(ca), Math.cos(ca)); this.dragYaw += Math.sign(ca) * Math.min(Math.abs(ca), dt * 2.6); } const fx = Math.sin(this.dragYaw), fz = Math.cos(this.dragYaw), st = 21 * dt; v.x += fx * st; v.z += fz * st; v.y = this.top + 1; v.yaw = this.dragYaw; h.x = v.x - fx * 6; h.z = v.z - fz * 6; h.y = this.top + 0.35; h.yaw = this.dragYaw + Math.PI; h.bodyX = -1.5; this.scar(h.x + fx * 4, h.z + fz * 4, this.dragYaw); if (Math.random() < 0.8) this.chips(h.x + fx * 4, h.z + fz * 4); this.g.shake = Math.max(this.g.shake || 0, 0.14); this.smashBoxes(h.x + fx * 3, h.z + fz * 3, 2.6, 0); this.smashBoxes(v.x, v.z, 2, 0); if (v.t > 3) this.vfFling(); break; }
      case 'vcharge': this.face(v, h, dt, 20); if (Math.random() < 0.5) this.g.disasters.brawl.stunts.ring(v.x, this.top + 0.3, v.z, 1.4 + 3.5 * Math.min(1, v.t / 0.9), 0.25, new THREE.Color(1.8, 0.5, 0.5), 0.7); if (v.t > 0.9) { v.go('vpunch', CLIPS.uppercut); this.vl = false; sfx('whoosh', v.x, v.y + 2, v.z, { gain: 1, rate: 0.7 }); } break;
      case 'vpunch': if (!this.vl && v.t >= 0.28) { this.vl = true; this.spark(h.x, h.y + 3, h.z, 3); this.g.hitStop = Math.max(this.g.hitStop || 0, 0.08); this.g.shake = Math.max(this.g.shake || 0, 0.3); sfx('crash', h.x, h.y + 2, h.z, { gain: 1, rate: 0.8 }); h.go('vair', CLIPS.hitUp); h.vy = 34; h.y = this.top + 0.5; h.x = v.x; h.z = v.z; this.vfStage = 'up'; } break;
      case 'vrise': { const k = Math.min(1, v.t / 0.35); v.x = h.x; v.z = h.z; v.y = v.y0 + (h.y + 3.2 - v.y0) * (1 - (1 - k) * (1 - k)); if (k >= 1) { v.go('vgrab', CLIPS.hammerUp); } break; }
      case 'vgrab': v.x = h.x; v.z = h.z; v.y = h.y + 3.2 - 0.7 * Math.min(1, v.t / 0.6); if (v.t > 0.7) { this.vfStage = 'dive'; this.finSlow = 0.3; v.go('vdive', CLIPS.hammerDown); h.go('vdived', CLIPS.crushed); this.spark(h.x, h.y + 2, h.z, 2.5, [2.2, 0.6, 0.6]); } break;
      case 'vdive': v.y -= 60 * dt; h.x = v.x; h.z = v.z; h.y = v.y - 2.8; h.yaw = v.yaw; if (h.y <= this.top) this.vfHit(); break;
      case 'vdone': this.face(v, h, dt, 4); break;
      case 'dazed': this.face(v, h, dt, 2); v.walkK = 0; break;
      case 'hang': v.vy = 0; v.y += Math.sin(v.t * 3) * dt * 0.4; break;
      case 'dived': break;
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
      case 'rush': { const st = 27 * dt; v.x += v.fx * st; v.z += v.fz * st; v.ran += st; v.phase += st * 1.1; v.walkK = 1; if (d < 2.7 && this.canHit()) { if (h.state === 'block') { this.blocked(16, 13); if (v.state === 'rush') v.go('stumble', C.stumble); break; } this.fling(16, v.fx, v.fz, 'CHARGED!'); v.go('stumble', C.stumble); break; } if (v.ran > 22) v.go('stumble', C.stumble); break; }
      case 'frozen': if (this.ice) this.ice.position.set(v.x, this.top + 2.8, v.z); if (v.hp <= 0) { this.shatter(); v.go('flung', CLIPS.blownBack); v.vy = 4; break; } if (v.t > 1.8) { this.shatter(); v.go('idle', C.guard); this.cool = 0.4; this.say('THAWED', 0.5, '#9fe8ff'); } break;
      case 'block': this.face(v, h, dt, 12); this.slide(v, dt); if (v.t > 0.6) { v.go('idle', C.guard); this.cool = 0.2; } break;
      case 'stumble': v.armor = false; v.walkK *= 0.8; if (v.t > 0.8) { v.go('idle', C.guard); this.cool = 0.5 + Math.random() * 0.6; } break;
      case 'hold': { const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw); h.x = v.x + fx * 1.4; h.z = v.z + fz * 1.4; h.y = this.top + 2.4; if (this.mash >= 5) { h.y = this.top; h.go('hurt', CLIPS.hitBody); h.vx = fx * 6; h.vz = fz * 6; v.go('stun', CLIPS.hitBody); v.vx = -fx * 5; v.vz = -fz * 5; this.say('BROKE FREE!', 0.7, '#8affb0'); break; } if (v.t >= 1.15) { v.go('stumble', CLIPS.throw); this.fling(16, fx, fz, 'THROWN!'); h.y = this.top + 2; } break; }
      case 'stun': this.slide(v, dt, 8); if (v.hp <= 0) { v.go('flung', CLIPS.blownBack); v.vy = 4; break; } if (v.t > 0.42) { v.go('idle', C.guard); this.cool = 0.35 + Math.random() * 0.5; } break;
      case 'pushed': this.slide(v, dt, 3); if (Math.random() < 0.5) this.chips(v.x, v.z); this.smashBoxes(v.x, v.z, 1.2, 6); if (v.t > 0.7) { v.go('idle', C.guard); this.cool = 0.5; } break;
      case 'air': case 'flung': case 'slammed': if (this.finKind === 'sky' && this.finStage === 'rise' && v.vy < 1) { this.skyRise(); break; } if (Math.hypot(v.vx, v.vz) > 8) this.smashBoxes(v.x, v.z, 1.2, 10); v.vy -= G * dt; v.y += v.vy * dt; this.slide(v, dt, 1); if (v.y <= this.top) { const hard = v.state === 'slammed', was = v.state; v.y = this.top; v.vy = 0; v.vx *= 0.2; v.vz *= 0.2; v.go('down', hard ? CLIPS.crushed : C.down); if (hard) { this.killBlow(); this.puff(v, 1); this.g.shake = Math.max(this.g.shake || 0, 1); this.g.hitStop = 0.1; v.play(C.down); } else { if (was === 'air') this.hurtV(6); this.puff(v, 0.5 + 0.5 * (v.tossK || 0)); v.tossK = 0; } this.launched = false; } break;
      case 'down': this.slide(v, dt); if (this.fin) { if (!this.over && v.t > (this.finKind === 'sky' ? 1.6 : 0.5)) this.finish(true); break; } if (v.t > 1.3) v.go('getup', C.getup); break;
      case 'getup': if (v.t > 0.55) { if (v.hp <= 0) { this.daze(); break; } v.go('idle', C.guard); if (d < 8) { this.vilAtk(d < 4.5 ? (Math.random() < 0.7 ? 'jab' : 'grab') : 'charge'); v.armor = true; } else this.cool = 0.25; } break; // up and straight at you: jabs won't stop this one
      default: break;
    }
  }
  vilAtk(kind) { const v = this.v; v.kind = kind; this.lastK = kind; v.T = kind === 'jab' ? 0.5 : kind === 'grab' ? 0.62 : 0.8; v.go('wind', kind === 'jab' ? C.jabWind : kind === 'grab' ? C.grabWind : C.chargeWind); sfx('whoosh', v.x, v.y + 2, v.z, { gain: 0.55, rate: kind === 'charge' ? 0.6 : 1 }); }
  canHit() { const s = this.h.state; return !['dodge', 'down', 'getup', 'flung', 'slamUp', 'slamHit', 'grabbed'].includes(s) && this.h.y < this.top + 2; }
  hitHero(n, kb) { const h = this.h, v = this.v, d = this.dist() || 1; if (h.state === 'block') { this.blocked(n, kb); return; } this.hurtH(n); h.vx = (h.x - v.x) / d * kb; h.vz = (h.z - v.z) / d * kb; h.go('hurt', CLIPS.hitHeadL); if (h.hp <= 0) this.fling(0, h.vx / kb, h.vz / kb); }
  // ---------- Tyrant's finishers on her: she stands dazed, he comes for her
  dazeHero() { const h = this.h; h.go('dazed', C.stumble); h.vx = 0; h.vz = 0; h.vy = 0; h.y = this.top; this.atk = null; this.buffer = false; this.charging = false; this.counterT = 0; this.slow = 0; this.blockOff(); this.finEl.classList.remove('show'); }
  vfStart() { const v = this.v, h = this.h; if (['grabbed', 'block', 'charge', 'cast', 'dodge', 'lunge', 'attack'].includes(h.state)) { h.y = this.top; this.atk = null; h.go('hurt', CLIPS.hitBody); } this.tellOff(); v.armor = false; v.vx = 0; v.vz = 0; v.bodyX = null; this.vfKind = Math.random() < 0.5 ? 'neck' : 'sky'; this.vfStage = 'run'; v.go('vfin', C.guard); this.finSlow = 1; }
  vfNeck() { const v = this.v, h = this.h; this.dragYaw = Math.atan2(v.x - h.x, v.z - h.z); this.vfStage = 'drag'; this.dragDist = 0; v.y = this.top + 1; v.go('vdrag', C.drag); h.go('vdragged', C.dragged); this.g.hitStop = Math.max(this.g.hitStop || 0, 0.05); sfx('thud', h.x, h.y + 1, h.z, { gain: 1, rate: 0.8 }); this.say('BY THE NECK!', 0.9, '#ff8a7a'); }
  vfFling() { const v = this.v, h = this.h, fx = Math.sin(this.dragYaw), fz = Math.cos(this.dragYaw); h.bodyX = null; h.x = v.x; h.z = v.z; h.y = this.top + 1.5; h.yaw = this.dragYaw + Math.PI; h.go('flung', CLIPS.blownBack); h.vx = fx * 24; h.vz = fz * 24; h.vy = 6; v.y = this.top; v.go('vdone', CLIPS.throw); this.vfStage = 'done'; this.g.disasters.flash(0.2); this.g.hitStop = Math.max(this.g.hitStop || 0, 0.16); this.g.shake = Math.max(this.g.shake || 0, 1.2); sfx('whoosh', h.x, h.y, h.z, { gain: 1.1, rate: 0.8 }); this.say('FINISHED', 1.4, '#ff8a7a'); }
  vfHit() { const v = this.v, h = this.h, D = this.g.disasters, S = D.ctx.scene, R = 16, x = v.x, z = v.z; this.finSlow = 1; this.vfStage = 'done'; v.y = this.top; v.vy = 0; h.y = this.top; h.bodyX = null; h.go('down', C.down); v.go('vdone', CLIPS.land);
    for (let i = 0; i < 5; i++) D.brawl.stunts.ring(x, this.top + 0.3 + i * 0.4, z, R * (1 - i * 0.07), 0.5 + 0.2 * i, new THREE.Color(1.7, 0.6, 0.5), 0.8);
    for (let i = 0; i < 70; i++) { const a = Math.random() * 6.28, r = Math.random() * R * 0.5, sz = 0.3 + Math.random() * 0.8; D.debris.add(x + Math.cos(a) * r, this.top + 0.3, z + Math.sin(a) * r, sz, sz * 0.6, sz, Math.random() < 0.6 ? 0xb9b1a0 : 0x7d7566, 'fly', { v: [Math.cos(a) * 16, 4 + Math.random() * 16, Math.sin(a) * 16], life: 1.8 }); }
    for (const b of this.boxes) if (b.up && Math.hypot(b.x - x, b.z - z) < R + b.hw) this.smashBoxes(b.x, b.z, 0.1, 0);
    const m = new THREE.Mesh(new THREE.CircleGeometry(R * 0.35, 32).rotateX(-Math.PI / 2), this.scarMat); m.position.set(x, this.top + 0.04, z); S.add(m); this.scars.push(m);
    D.flash(0.5); this.g.shake = Math.max(this.g.shake || 0, 2); this.g.hitStop = Math.max(this.g.hitStop || 0, 0.22); sfx('collapse', x, this.top, z, { gain: 1.4, rate: 0.5 }); sfx('crash', x, this.top, z, { gain: 1, rate: 0.6 }); this.say('FINISHED', 1.6, '#ff8a7a'); }
  fling(n, fx, fz, why) { const h = this.h; this.hurtH(n, why); h.vx = fx * 18; h.vz = fz * 18; h.vy = 8; h.go('flung', CLIPS.blownBack); }
  finish(won) { if (this.over) return; this.over = true; this.tellOff(); const e = this.endEl = document.createElement('div'); e.className = 'end'; e.innerHTML = (won ? 'YOU WIN' : 'KNOCKED OUT') + '<button type="button">Fight again</button>'; e.querySelector('button').onclick = (ev) => { ev.stopPropagation(); this.restart(); }; this.el.appendChild(e); }
  // the camera: one steady angle, in and out only as far as keeps both in view
  place(dt) {
    const h = this.h, v = this.v, cam = this.ctx.camera, mx = (h.x + v.x) / 2, mz = (h.z + v.z) / 2, up = Math.max(0, Math.max(h.y, v.y) - this.top), sep = Math.hypot(h.x - v.x, h.z - v.z), hf = Math.tan(cam.fov * Math.PI / 360) * cam.aspect, dragging = h.state === 'drag' || v.state === 'vdrag', want = Math.max(38, (sep + (dragging ? 13 : 7)) / (2 * hf)) * (1 + up * 0.03), el = 0.58;
    this.dist0 = this.dist0 == null ? want : this.dist0 + (want - this.dist0) * Math.min(1, dt * (dragging ? 6 : 2.5)); const my = this.top + 2.2 + up * 0.8, D = this.dist0, ce = Math.cos(el) * D; this.look = this.look || new THREE.Vector3(mx, my, mz); this.look.lerp(_c.set(mx + (dragging ? Math.sin(this.dragYaw) * 3 : 0), my, mz + (dragging ? Math.cos(this.dragYaw) * 3 : 0)), Math.min(1, dt * (dragging ? 18 : 7)));
    if (this.az == null) { this.az = this.azTo = AZ0; } const cy = this.look.y + Math.sin(el) * D, at = (a) => _a.set(this.look.x + Math.sin(a) * ce, cy, this.look.z + Math.cos(a) * ce);
    // a small building between the camera and either fighter: swing round until both are in view, and home again when clear
    if (this.hidden(at(this.azTo))) { let best = null; for (let k = 1; k <= 8 && best == null; k++) for (const sg of [1, -1]) { const a = this.azTo + sg * k * 0.3; if (!this.hidden(at(a))) { best = a; break; } } if (best != null) this.azTo = best; } else if (Math.abs(this.azTo - AZ0) > 0.01 && !this.hidden(at(AZ0))) this.azTo = AZ0;
    this.az += (this.azTo - this.az) * Math.min(1, dt * 2.2); this.camTo = this.camTo || new THREE.Vector3(); this.camTo.copy(at(this.az)); cam.position.copy(this.camTo); cam.lookAt(this.look);
  }
  hidden(c) { for (const f of [this.h, this.v]) { const fy = f.y + 2; for (const b of this.boxes) { if (!b.up) continue; for (let i = 1; i < 14; i++) { const t = i / 14, x = c.x + (f.x - c.x) * t, z = c.z + (f.z - c.z) * t, y = c.y + (fy - c.y) * t; if (Math.abs(x - b.x) < b.hw + 0.6 && Math.abs(z - b.z) < b.hw + 0.6 && y < this.top + b.hgt) return true; } } } return false;
  }
}
