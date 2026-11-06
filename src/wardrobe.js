// The wardrobe (Sean, 2026-11-04: the character is blocked by the options, so you cannot see what it looks like; his iPhone in Safari has about 636 px of height).
// Its own screen: the fighter on a clear stage in the top of the screen, always in full view, a compact sheet of choices below it (or beside it, held sideways).
// Each row of choices scrolls sideways, so the sheet never grows. The camera frames what the tab is about: the head for Head, Face and Hair, the whole figure otherwise, and turns the fighter round for Back. Drag to turn.
// The room is hidden while it is open (its lights stay, so the fighter is lit as in the room); a backdrop closes off everything else. The outfit is saved as before, in HS.
import * as THREE from 'three';
import { HS, levelOf } from './herogame.js';
import { unlockAt } from './unlocks.js';
import { HEADGEAR } from './headgear.js';
import { hdLook, WARD } from './hdbody.js';
import { relax, detail } from './villains.js';

const HAIRC = ['#0e0c0a', '#2a1a10', '#5a3418', '#8a5a26', '#c98a3a', '#e8c878', '#d8d4cc', '#a01c1c', '#2a58c8', '#7a3cff'], FACEC = ['#a8302c', '#3c7a4a', '#3c4450', '#9aa3ae', '#ece6d6', '#101014', '#d01d3a', '#d4a84b', '#2a58c8', '#29e3ff', '#7a3cff', '#ff3fcf'], EYES = ['#3a2a1c', '#6a4a2a', '#3a7ab8', '#3a8a4a', '#7a8a96', '#c0281c', '#ffc838', '#29e3ff', '#b040ff', '#ffffff'], SKINS = ['#fdf8f4', '#f8ece2', '#f5dfd0', '#f2d0b8', '#e8bd9f', '#e0b090', '#d6a47c', '#c8977a', '#b8855f', '#a8765a', '#8a6044', '#7a5238', '#5e3c28', '#4e3222', '#2e1c14'], SKINF = ['#ffffff', '#b8bcc4', '#6a6f78', '#141418', '#d01d3a', '#7a1228', '#e8761c', '#ffd24a', '#7fe04f', '#2f9a48', '#14684a', '#29c3e3', '#8fb4e8', '#2a58c8', '#16286e', '#7a3cff', '#b04ae0', '#ff5ac8'];
const TABS = [['head', 'Head'], ['face', 'Face'], ['hair', 'Hair'], ['body', 'Body'], ['armor', 'Armor'], ['back', 'Back'], ['col', 'Colours'], ['name', 'Name']], CLOSE_TABS = new Set(['head', 'face', 'hair']);
const CSS = `
body.zd-ward #zd-base{display:none}
#zd-ward{position:fixed;inset:0;z-index:40;touch-action:none;user-select:none;-webkit-user-select:none;font:700 13px/1.1 system-ui,-apple-system,sans-serif;color:#fff}
#zd-ward button{font:800 13px/1.1 system-ui,-apple-system,sans-serif;color:#fff;border:0;background:#3a2f55;border-radius:11px;padding:0 13px;min-height:40px;white-space:nowrap;touch-action:manipulation}
#zd-ward button.on{background:linear-gradient(180deg,#ff5ad5,#b23cff);box-shadow:0 0 0 2px #fff inset}
#zd-ward .top{position:absolute;left:0;right:0;top:0;padding:calc(6px + env(safe-area-inset-top)) 8px 6px;display:flex;gap:8px;align-items:center;background:linear-gradient(180deg,rgba(10,8,20,.72),rgba(10,8,20,0))}
#zd-ward .who{flex:1 1 auto;min-width:0;display:flex;gap:6px;overflow-x:auto;touch-action:pan-x;scrollbar-width:none}
#zd-ward .who::-webkit-scrollbar,#zd-ward .strip::-webkit-scrollbar,#zd-ward .tabs::-webkit-scrollbar{display:none}
#zd-ward .who button{flex:0 0 auto;min-height:34px;font-size:12px;padding:0 10px;background:rgba(40,32,62,.82)}
#zd-ward button.done{flex:0 0 auto;min-height:34px;padding:0 14px;background:linear-gradient(180deg,#3dd58a,#159a5e)}
#zd-ward .zoom{position:absolute;right:8px;min-height:34px;font-size:12px;padding:0 10px;background:rgba(40,32,62,.82)}
#zd-ward .drag{position:absolute;left:0;right:0;text-align:center;font-size:12px;opacity:.75;pointer-events:none;text-shadow:0 1px 3px #000;transition:opacity .4s}
#zd-ward .sheet{position:absolute;left:0;right:0;bottom:0;max-height:42%;display:flex;flex-direction:column;background:rgba(18,12,30,.97);border-radius:16px 16px 0 0;box-shadow:0 -6px 22px rgba(0,0,0,.5);padding-bottom:env(safe-area-inset-bottom);box-sizing:border-box}
#zd-ward .tabs{flex:0 0 auto;display:flex;gap:6px;overflow-x:auto;touch-action:pan-x;padding:8px 8px 6px;scrollbar-width:none}
#zd-ward .tabs button{flex:0 0 auto;min-height:36px}
#zd-ward .body{flex:1 1 auto;min-height:0;overflow-y:auto;touch-action:pan-y;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding:0 0 8px}
#zd-ward .wr{margin:2px 0 7px}
#zd-ward .h{padding:0 10px;margin:0 0 4px;font:700 11px/1.1 system-ui,sans-serif;letter-spacing:.04em;text-transform:uppercase;opacity:.72}
#zd-ward .pick{display:flex;gap:5px;align-items:center;padding:0 6px}
#zd-ward .pick .ar{flex:0 0 38px;padding:0;background:#4a3d6e}
#zd-ward .strip{display:flex;gap:6px;overflow-x:auto;touch-action:pan-x;overscroll-behavior:contain;scrollbar-width:none;-webkit-overflow-scrolling:touch;padding:1px 8px}
#zd-ward .pick .strip{flex:1 1 auto;min-width:0;padding:1px 2px}
#zd-ward .strip button{flex:0 0 auto}
#zd-ward button.lk{opacity:.5;background:#2a2340}
#zd-ward button small{display:block;font-size:10px;font-weight:700;opacity:.9;margin-top:2px}
#zd-ward .strip button.sw{flex:0 0 40px;width:40px;padding:0;border-radius:10px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.2)}
#zd-ward .strip button.sw.on{box-shadow:0 0 0 3px #fff inset,0 0 0 2px #000 inset}
#zd-ward .own{display:flex;align-items:center;gap:10px;padding:0 10px}
#zd-ward .own input{width:64px;height:38px;padding:0;border:0;background:none}
#zd-ward .nm{padding:0 10px;touch-action:auto;user-select:text;-webkit-user-select:text}
@media (orientation:landscape) and (max-height:520px){#zd-ward .sheet{left:auto;top:0;bottom:0;width:min(50vw,420px);max-height:none;border-radius:16px 0 0 16px}#zd-ward .top{right:min(50vw,420px)}#zd-ward .zoom,#zd-ward .drag{right:calc(min(50vw,420px) + 8px)}}
`;
// a lamp in the room, in the wardrobe: enough to shape, too little to colour
const i0 = (o) => Math.min(o.intensity, 26);
function canvasTex(w, h, paint) { const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
// the backdrop round the fighter
function stage(x, y, z, lair) { const g = new THREE.Group(); g.position.set(x, y, z); const R = 14, H = 16, cols = lair ? ['#1a0c12', '#6a2c38', '#34161e'] : ['#1a2036', '#6a769c', '#3a4264'], walls = canvasTex(8, 256, (q, w, h) => { const gr = q.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, cols[0]); gr.addColorStop(0.72, cols[1]); gr.addColorStop(1, cols[2]); q.fillStyle = gr; q.fillRect(0, 0, w, h); }), wm = new THREE.MeshBasicMaterial({ map: walls, side: THREE.BackSide, fog: false, depthWrite: false }), wall = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, 32, 1, false), wm); wall.position.y = H / 2 - 0.02; wall.renderOrder = -2; g.add(wall); const floorT = canvasTex(256, 256, (q, w, h) => { const gr = q.createRadialGradient(w / 2, h / 2, 6, w / 2, h / 2, w / 2); gr.addColorStop(0, lair ? '#7a3a44' : '#8a94b8'); gr.addColorStop(0.3, lair ? '#4a2029' : '#565f82'); gr.addColorStop(1, cols[2]); q.fillStyle = gr; q.fillRect(0, 0, w, h); }), floor = new THREE.Mesh(new THREE.CircleGeometry(R, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: floorT, fog: false })); floor.position.y = -0.012; g.add(floor); const blobT = canvasTex(64, 64, (q, w, h) => { const gr = q.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(0,0,0,.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); q.fillStyle = gr; q.fillRect(0, 0, w, h); }), blob = new THREE.Mesh(new THREE.CircleGeometry(0.8, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: blobT, transparent: true, depthWrite: false, fog: false })); blob.position.y = -0.006; g.add(blob); const ring = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.012, 6, 48).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: lair ? new THREE.Color(1.5, 0.4, 0.3) : new THREE.Color(0.9, 0.5, 1.5), fog: false })); ring.position.y = 0; g.add(ring); return g; }

export function openWardrobe(B, L) {
  const side = B.side, cam = B.ctx.camera, post = B.ctx.post, S = B.g.disasters.ctx.scene, AZ = L.AZ, FRONT = AZ + 0.28, h0 = B.h;
  if (!document.getElementById('zd-ward-css')) { const st = document.createElement('style'); st.id = 'zd-ward-css'; st.textContent = CSS; document.head.appendChild(st); }
  B.goal = null; B.stick = null; B.autoOpen = null; if (B.stickOff) B.stickOff(); document.body.classList.add('zd-panel', 'zd-ward'); { const te = B.g.el && B.g.el.toast; if (te) te.style.opacity = '0'; }
  const root = document.createElement('div'); root.id = 'zd-ward'; root.innerHTML = '<div class="top"><div class="who"></div><button type="button" class="done">Done</button></div><button type="button" class="zoom"></button><div class="drag">Drag to turn</div><div class="sheet"><div class="tabs">' + TABS.map(([k, n]) => '<button type="button" data-wt="' + k + '">' + n + '</button>').join('') + '</div><div class="body"></div></div>'; document.body.appendChild(root);
  const sheet = root.querySelector('.sheet'), bodyEl = root.querySelector('.body'), tabsEl = root.querySelector('.tabs'), whoEl = root.querySelector('.who'), zoomEl = root.querySelector('.zoom'), dragEl = root.querySelector('.drag'), topEl = root.querySelector('.top');
  // the stage: what was on show in the room goes, its lights stay
  const hidden = [], lights = [], hideRoom = () => { const c = B.cur; if (!c || !c.g) return; c.g.traverse((o) => { if ((o.isMesh || o.isSprite || o.isPoints || o.isLine) && o.visible) { o.visible = false; hidden.push(o); } }); }; hideRoom(); if (B.cur && B.cur.g) B.cur.g.traverse((o) => { if (!o.isLight) return; const q = { o, i: o.intensity, c: o.color.clone(), g: o.groundColor ? o.groundColor.clone() : null }; lights.push(q); if (o.isHemisphereLight) { o.color.set('#ffffff'); o.groundColor.set('#77706a'); o.intensity = 2; } else { o.color.set('#fff4e6'); o.intensity = i0(o); } });
  const set = stage(h0.x, B.floorY, h0.z, B.lair); S.add(set); const saved = { fov: cam.fov, near: cam.near, far: cam.far, dof: post.opts.dof }; post.opts.dof = false; cam.fov = 30; cam.near = 0.25; cam.far = 60; cam.updateProjectionMatrix();
  const W = { tab: B.wardTab || 'head', view: null, yaw: FRONT, D: null, y: null, ox: null, oy: null };
  if (!TABS.some((q) => q[0] === W.tab)) W.tab = 'head'; W.view = CLOSE_TABS.has(W.tab) ? 'head' : 'whole'; if (W.tab === 'back') W.yaw = FRONT + Math.PI; B.h.yaw = W.yaw; const scrolls = {}; let centre = true;
  const outfit = () => HS.outfit(HS.curName(side)) || {}, wearAll = (f) => { const who = HS.curName(side), D = HS.load(); D.outfits[who] = { ...(D.outfits[who] || {}) }; f(D.outfits[who]); HS.save(); B.redress(); B.h.yaw = W.yawNow ?? W.yaw; draw(); }, wear = (k, v) => wearAll((o) => { o[k] = v; });
  const row = (k, label, inner) => '<div class="wr" data-k="' + k + '">' + (label ? '<div class="h">' + label + '</div>' : '') + '<div class="strip">' + inner + '</div></div>';
  const sw = (key, list, cur, label) => row(key + (label || ''), label, list.map((c) => '<button type="button" class="sw' + (c === cur ? ' on' : '') + '" data-' + key + '="' + c + '" style="background:' + c + '" aria-label="' + c + '"></button>').join(''));
  function draw() {
    const who = HS.curName(side), O = outfit(), Lk = hdLook(who, O), tab = W.tab, lv = levelOf((HS.load().chars[HS.cur(side)] || {}).xp || 0); B.wardTab = tab;
    const lockB = (L, t) => '<button type="button" class="lk" data-lk="' + L + '" data-lkn="' + t + '">' + t + '<small>\u{1F512} Level ' + L + '</small></button>'; // not yet: the level it opens at (unlocks.js); what is worn stays on whatever its level
    for (const q of bodyEl.querySelectorAll('.wr')) { const st = q.querySelector('.strip'); if (st) scrolls[tab + q.dataset.k] = st.scrollLeft; } const top0 = bodyEl.dataset.tab === tab ? bodyEl.scrollTop : 0;
    whoEl.innerHTML = HS.team(side).map((i) => '<button type="button" data-dress="' + i + '"' + (i === HS.cur(side) ? ' class="on"' : '') + '>' + HS.shown(i) + '</button>').join('');
    tabsEl.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.wt === tab));
    const opt = (k, n) => row(k, n, WARD[k].map(([v, t]) => { const L = unlockAt(k, v); return L > lv && Lk[k] !== v ? lockB(L, t) : '<button type="button" data-opt="' + k + ':' + v + '"' + (Lk[k] === v ? ' class="on"' : '') + '>' + t + '</button>'; }).join('')); let html = '';
    if (tab === 'head') { const hg = O.hg || 'none', own = HEADGEAR.find((q) => q[0] === hg) || HEADGEAR[0], HGS = B.lair ? [HEADGEAR[0], ...HEADGEAR.filter((q) => q[4]), ...HEADGEAR.filter((q) => !q[4] && q[0] !== 'none')] : HEADGEAR.filter((q) => !q[4]); W.HGS = HGS.filter((q) => q[0] === hg || unlockAt('hg', q[0]) <= lv).map((q) => q[0]); /* the arrows go round what is open */ html = '<div class="wr" data-k="hg"><div class="h">On the head</div><div class="pick"><button type="button" class="ar" data-hgn="-1" aria-label="Previous">◀</button><div class="strip">' + HGS.map((q) => (unlockAt('hg', q[0]) > lv && q[0] !== hg ? lockB(unlockAt('hg', q[0]), q[1]) : '<button type="button" data-hg="' + q[0] + '"' + (q[0] === hg ? ' class="on"' : '') + '>' + q[1] + '</button>')).join('') + '</div><button type="button" class="ar" data-hgn="1" aria-label="Next">▶</button></div></div>' + (hg !== 'none' ? sw('hgc', L.HATS, O.hgc || own[2], own[1] + ' colour') : ''); }
    else if (tab === 'face') html = opt('face', 'Face') + (Lk.face !== 'natural' ? sw('facea', FACEC, Lk.facea, 'Face colour') + sw('faceb', FACEC, Lk.faceb, 'Second colour') : '') + sw('eyec', EYES, Lk.eyec, 'Eyes');
    else if (tab === 'hair') html = opt('hair', 'Hair') + sw('hairc', HAIRC, Lk.hairc, 'Hair colour') + (Lk.f ? '' : opt('beard', 'Beard'));
    else if (tab === 'body') html = opt('body', 'Body') + sw('skin', SKINS, Lk.skin, 'Skin: pale to dark') + sw('skin', SKINF, Lk.skin, 'Skin: any colour') + '<div class="wr own"><span>Choose your own skin</span><input type="color" data-skinp value="' + Lk.skin + '" aria-label="Choose your own skin colour"></div>';
    else if (tab === 'armor') html = opt('sh', 'Shoulders') + opt('chest', 'Chest') + opt('arm', 'Forearms') + opt('leg', 'Legs');
    else if (tab === 'back') html = opt('back', 'On the back') + sw('cape', B.lair ? L.VSUITS : L.SUITS, Lk.cape, 'Cape and wing colour');
    else if (tab === 'col') { const SU = B.lair ? L.VSUITS : L.SUITS; html = sw('suit', SU, Lk.suit, 'Suit') + sw('cape', SU, Lk.cape, 'Cape') + sw('belt', L.BELTS, Lk.trim, 'Belt and trim') + sw('dark', L.DARKS, Lk.dark, 'Boots and gloves'); }
    else html = '<div class="nm" data-nm></div>';
    bodyEl.innerHTML = html; bodyEl.dataset.tab = tab; bodyEl.scrollTop = top0; if (tab === 'name') HS.namer(bodyEl.querySelector('[data-nm]'), HS.cur(side));
    for (const q of bodyEl.querySelectorAll('.wr')) { const st = q.querySelector('.strip'); if (!st) continue; const k = tab + q.dataset.k, on = st.querySelector('.on'); if (centre || scrolls[k] == null) { if (on) st.scrollLeft = on.offsetLeft - st.offsetLeft - st.clientWidth / 2 + on.offsetWidth / 2; } else st.scrollLeft = scrolls[k]; } centre = false;
    bodyEl.querySelectorAll('[data-opt]').forEach((b) => { b.onclick = () => { const [k, v] = b.dataset.opt.split(':'); wear(k, v); }; });
    bodyEl.querySelectorAll('[data-lk]').forEach((b) => { b.onclick = () => { const g = B.g; if (g && g.toast) g.toast(b.dataset.lkn + ' opens at level ' + b.dataset.lk + '. Win levels to get there', 2200); }; });
    bodyEl.querySelectorAll('.sw').forEach((b) => { b.onclick = () => { const k = Object.keys(b.dataset)[0]; wear(k, b.dataset[k]); }; });
    bodyEl.querySelectorAll('[data-skinp]').forEach((b) => { b.onchange = () => wear('skin', b.value); });
    bodyEl.querySelectorAll('[data-hg]').forEach((b) => { b.onclick = () => wearAll((o) => { o.hg = b.dataset.hg; delete o.hgc; }); });
    bodyEl.querySelectorAll('[data-hgn]').forEach((b) => { b.onclick = () => { const Q = W.HGS, i = Math.max(0, Q.indexOf(outfit().hg || 'none')), n = Q[(i + +b.dataset.hgn + Q.length) % Q.length]; centre = true; wearAll((o) => { o.hg = n; delete o.hgc; }); }; });
    whoEl.querySelectorAll('[data-dress]').forEach((b) => { b.onclick = () => { B.setWho(b.dataset.dress); hideRoom(); B.h.yaw = W.yawNow ?? W.yaw; centre = true; draw(); }; });
    zoomEl.textContent = W.view === 'head' ? 'Whole figure' : 'Close up';
  }
  tabsEl.querySelectorAll('[data-wt]').forEach((b) => { b.onclick = () => { const was = W.tab, k = b.dataset.wt; W.tab = k; W.view = CLOSE_TABS.has(k) ? 'head' : 'whole'; if (k === 'back') W.yaw = FRONT + Math.PI; else if (was === 'back') W.yaw = FRONT; centre = true; bodyEl.scrollTop = 0; draw(); const r0 = b.offsetLeft - tabsEl.clientWidth / 2 + b.offsetWidth / 2; tabsEl.scrollLeft = r0; }; });
  zoomEl.onclick = () => { W.view = W.view === 'head' ? 'whole' : 'head'; zoomEl.textContent = W.view === 'head' ? 'Whole figure' : 'Close up'; };
  root.querySelector('.done').onclick = () => B.close();
  // drag on the stage: turn
  { let id = null, x0 = 0, y0 = 0; root.addEventListener('pointerdown', (e) => { if (e.target.closest('button,.sheet,input')) return; e.preventDefault(); id = e.pointerId; x0 = e.clientX; y0 = W.yaw; try { root.setPointerCapture(id); } catch (q) { /* fine */ } dragEl.style.opacity = '0'; }); root.addEventListener('pointermove', (e) => { if (e.pointerId !== id) return; W.yaw = y0 + (e.clientX - x0) * 0.014; }); for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) root.addEventListener(ev, (e) => { if (e.pointerId === id) id = null; }); }
  // standing to be looked at, not squared up to fight: feet apart, fists down, chest up, and just breathing
  const stand = (dt) => { const r = B.h.r; W.t = (W.t || 0) + dt; relax(r); const br = Math.sin(W.t * 1.5); r.hips.position.y = 0.935 + br * 0.003; r.legs[0].hip.rotation.set(0, 0, r.legs[0].hip.position.x < 0 ? -0.13 : 0.13); r.legs[1].hip.rotation.set(0, 0, r.legs[1].hip.position.x < 0 ? -0.13 : 0.13); for (const L of r.legs) if (L.ank) L.ank.rotation.set(0, 0, -L.hip.rotation.z); for (const a of r.arms) { a.sh.rotation.set(0.03 + br * 0.008, 0, a.sx * (0.2 + (a.row || 0) * 0.3)); a.el.rotation.set(-0.13, 0, 0); } r.chest.rotation.x = -0.03 - br * 0.008; r.head.rotation.set(0.015, 0, 0); r.root.updateMatrixWorld(true); detail(r, null, true); };
  // the camera: what the tab is about, in the middle of the screen that is left, with room round it
  W.cam = (dt) => { stand(dt);
    const sw0 = innerWidth, sh0 = innerHeight, r = sheet.getBoundingClientRect(), beside = r.top < 8 && r.left > 8, topB = topEl.getBoundingClientRect().bottom, freeH = (beside ? sh0 : r.top) - topB, freeW = beside ? r.left : sw0, cx = freeW / 2, cy = topB + freeH / 2, vis = 2 * Math.tan(cam.fov * Math.PI / 360), hg = !!outfit().hg && outfit().hg !== 'none', close = W.view === 'head', fH = close ? (hg ? 0.82 : 0.62) : hg ? 2.2 : 2, fW = close ? 0.6 : 1.8, yT = close ? (hg ? 1.66 : 1.6) : hg ? 1.02 : 0.94, h = B.h, Dh = fH / (vis * (freeH * 0.94 / sh0)), Dw = fW / (vis * cam.aspect * (freeW * 0.96 / sw0)), DT = Math.max(Dh, Dw), k = W.D == null ? 1 : Math.min(1, dt * 6);
    W.D = W.D == null ? DT : W.D + (DT - W.D) * k; W.y = W.y == null ? yT : W.y + (yT - W.y) * k; let da = W.yaw - h.yaw; da = Math.atan2(Math.sin(da), Math.cos(da)); h.yaw += da * Math.min(1, dt * 9); W.yawNow = h.yaw; const el = 0.05, ce = Math.cos(el) * W.D; B.look.set(h.x, h.y + W.y, h.z); cam.position.set(h.x + Math.sin(AZ) * ce, h.y + W.y + Math.sin(el) * W.D, h.z + Math.cos(AZ) * ce); cam.up.set(0, 1, 0); cam.lookAt(B.look);
    const ox = Math.round(sw0 / 2 - cx), oy = Math.round(sh0 / 2 - cy); if (ox !== W.ox || oy !== W.oy || sw0 !== W.sw || sh0 !== W.sh) { W.ox = ox; W.oy = oy; W.sw = sw0; W.sh = sh0; cam.setViewOffset(sw0, sh0, ox, oy, sw0, sh0); } zoomEl.style.top = (topB + 2) + 'px'; dragEl.style.top = ((beside ? sh0 : r.top) - 22) + 'px';
  };
  W.end = () => { for (const o of hidden) o.visible = true; hidden.length = 0; for (const q of lights) { q.o.intensity = q.i; q.o.color.copy(q.c); if (q.g) q.o.groundColor.copy(q.g); } S.remove(set); set.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } }); cam.clearViewOffset(); cam.fov = saved.fov; cam.near = saved.near; cam.far = saved.far; cam.updateProjectionMatrix(); post.opts.dof = saved.dof; document.body.classList.remove('zd-ward'); };
  B.ward = W; B.panel = root; draw(); { const on = tabsEl.querySelector('.on'); if (on) tabsEl.scrollLeft = on.offsetLeft - tabsEl.clientWidth / 2 + on.offsetWidth / 2; }
}
