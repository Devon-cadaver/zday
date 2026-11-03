// The base's rooms furnished (Sean: much smaller, and details: rugs, statues, a fireplace, a round table where the other heroes sit when not in battle, TV monitors, a super car and a super bike). Plain shapes in the room's own group, so they go when the room does.
// furnish() returns what she cannot walk through, as circles [x, z, r] in the room's coordinates, and a tick for what moves.
import * as THREE from 'three';
import { HS, rigFor } from './herogame.js';
import { detail } from './villains.js';

const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, ...o }), glow = (c, k = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k) });
function kit(room) {
  const add = (m, x, y, z, ry = 0, shadow = false) => { m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = shadow; m.receiveShadow = true; room.add(m); return m; };
  return { add, box: (w, h, d, x, y, z, m, ry, sh) => add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m), x, y, z, ry, sh), cyl: (r0, r1, h, x, y, z, m, n = 16, sh) => add(new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, n), m), x, y, z, 0, sh), disc: (r, x, z, m, y = 0.075) => add(new THREE.Mesh(new THREE.CircleGeometry(r, 36).rotateX(-Math.PI / 2), m), x, y, z), ring: (r0, r1, x, z, m, y = 0.08) => add(new THREE.Mesh(new THREE.RingGeometry(r0, r1, 40).rotateX(-Math.PI / 2), m), x, y, z) };
}
// a picture on a screen, drawn once
function screen(kind, seed) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 80; const g = c.getContext('2d'); let r = seed * 9301 + 49297; const rnd = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
  g.fillStyle = kind === 'news' ? '#1b2a4a' : kind === 'map' ? '#06221a' : '#17101f'; g.fillRect(0, 0, 128, 80);
  if (kind === 'news') { g.fillStyle = '#c9352a'; g.fillRect(0, 60, 128, 20); g.fillStyle = '#fff'; g.font = 'bold 13px sans-serif'; g.fillText('BREAKING', 6, 75); g.fillStyle = '#7fb0ff'; g.fillRect(10, 10, 46, 40); g.fillStyle = '#e8eef8'; g.fillRect(64, 14, 54, 6); g.fillRect(64, 26, 42, 6); g.fillRect(64, 38, 50, 6); }
  else if (kind === 'map') { g.strokeStyle = '#2ee58a'; g.lineWidth = 1; for (let i = 0; i < 128; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 80); g.stroke(); } for (let i = 0; i < 80; i += 16) { g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke(); } g.strokeStyle = '#8affc0'; g.beginPath(); g.arc(64, 40, 30, 0, 6.3); g.stroke(); g.fillStyle = '#ff5a5a'; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(20 + rnd() * 90, 10 + rnd() * 60, 3, 0, 6.3); g.fill(); } }
  else { g.strokeStyle = '#ffc233'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 50); for (let x = 8; x <= 128; x += 8) g.lineTo(x, 15 + rnd() * 50); g.stroke(); g.fillStyle = '#29e3ff'; for (let i = 0; i < 7; i++) g.fillRect(6 + i * 17, 74 - rnd() * 20, 10, 80); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return new THREE.MeshBasicMaterial({ map: t });
}
function monitors(K, x, y, z, cols, rows, sw, sh, ry = 0) {
  const kinds = ['news', 'map', 'graph', 'map', 'graph', 'news']; let n = 0; const q = Math.cos(ry), s = Math.sin(ry);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const u = (i - (cols - 1) / 2) * (sw + 0.12), v = y + (j - (rows - 1) / 2) * (sh + 0.12), bx = x + u * q, bz = z - u * s; K.box(sw + 0.1, sh + 0.1, 0.1, bx - s * 0.03, v, bz - q * 0.03, std('#16161c'), ry); K.box(sw, sh, 0.02, bx + s * 0.03, v, bz + q * 0.03, screen(kinds[n % kinds.length], n + 3 + x), ry); n++; }
}
// a figure of one of the team cut in stone, on a plinth
function statue(K, room, name, x, z, ry) {
  K.box(1.5, 0.9, 1.5, x, 0.45, z, std('#6f6a66'), 0, true); K.box(1.7, 0.14, 1.7, x, 0.97, z, std('#8a8580'));
  const r = rigFor(name, null), stone = std('#b5b0a8', { roughness: 0.95 }); r.root.traverse((m) => { if (m.isMesh) { m.material = stone; m.castShadow = true; } }); for (const a of r.arms) { a.sh.rotation.set(0.15, 0, a.sx * 0.75); a.el.rotation.set(-1.7, 0, 0); } r.root.position.set(x, 1.04, z); r.root.rotation.y = ry; r.root.scale.setScalar(1.15); detail(r, null, true); room.add(r.root);
}
function seated(room, name, x, z, ry, i) {
  const r = rigFor(name, HS.outfit(name)); r.root.position.set(x, -0.28, z); r.root.rotation.y = ry; for (const L of r.legs) { L.hip.rotation.x = -1.5; L.knee.rotation.x = 1.5; } r.arms.forEach((a, k) => { a.sh.rotation.set(-1.15 + (k + i) % 2 * 0.2, 0, a.sx * 0.12); a.el.rotation.set(-0.5, 0, 0); }); if (r.cape) r.cape.update(0.05, 0.05, 0.1); detail(r, null, true); room.add(r.root); return r;
}
function roundTable(K, room, x, z, tick) {
  K.disc(3.5, x, z, std('#6d1f2a', { roughness: 1 })); K.ring(3.1, 3.3, x, z, std('#d9b25a')); K.ring(1.9, 2.0, x, z, std('#d9b25a'));
  const wood = std('#5a3a22', { roughness: 0.6 }); K.cyl(1.7, 1.7, 0.12, x, 0.84, z, wood, 28, true); K.cyl(0.35, 0.55, 0.78, x, 0.4, z, wood, 12); K.cyl(0.55, 0.55, 0.01, x, 0.905, z, std('#d9b25a', { metalness: 0.6, roughness: 0.3 }), 24);
  const others = HS.team('hero').map(id => HS.name(id)).filter(n => n !== HS.curName('hero')).slice(0, 3), seats = 4, chair = std('#2f2238');
  for (let i = 0; i < seats; i++) { const a = Math.PI * 0.25 + i * Math.PI * 2 / seats, cx = x + Math.cos(a) * 2.25, cz = z + Math.sin(a) * 2.25, ry = Math.atan2(x - cx, z - cz); K.box(0.8, 0.1, 0.8, cx, 0.5, cz, chair, ry, true); K.box(0.8, 0.95, 0.1, cx + Math.cos(a) * 0.37, 0.98, cz + Math.sin(a) * 0.37, chair, ry); K.cyl(0.05, 0.05, 0.5, cx, 0.25, cz, std('#1a1420'), 6); const hx = x + Math.cos(a) * 1.95, hz = z + Math.sin(a) * 1.95; if (others[i]) seated(room, others[i], hx, hz, ry, i); K.cyl(0.08, 0.07, 0.14, x + Math.cos(a) * 1.15, 0.97, z + Math.sin(a) * 1.15, std('#e8e2d6'), 8); }
}
function fireplace(K, x, z, tick) {
  const stone = std('#6a5f58', { roughness: 1 }); K.box(3.8, 3.2, 0.9, x, 1.6, z, stone, 0, true); K.box(4.2, 0.22, 1.2, x, 2.0, z + 0.1, std('#4a3a2e')); K.box(2.2, 1.5, 0.3, x, 0.8, z + 0.36, std('#0c0806')); K.box(4.4, 0.16, 1.5, x, 0.14, z + 0.5, std('#4f4640'));
  for (const dx of [-0.5, 0.45]) K.box(0.9, 0.16, 0.2, x + dx, 0.2, z + 0.5, std('#3a2415'), dx);
  const flames = []; for (let i = 0; i < 5; i++) { const f = K.add(new THREE.Mesh(new THREE.ConeGeometry(0.2 + (i % 2) * 0.08, 0.8, 7), glow(i % 2 ? '#ffb030' : '#ff6a20', 1.5)), x - 0.6 + i * 0.3, 0.55, z + 0.5); f.phase = i * 1.7; flames.push(f); }
  tick.push((t) => { for (const f of flames) { const k = 0.8 + 0.3 * Math.sin(t * 9 + f.phase) + 0.15 * Math.sin(t * 17 + f.phase * 2); f.scale.set(1, k, 1); f.position.y = 0.25 + 0.4 * k; } });
  K.box(0.5, 0.6, 0.3, x - 1.2, 2.4, z + 0.1, std('#d9b25a', { metalness: 0.7, roughness: 0.3 })); K.cyl(0.14, 0.2, 0.5, x + 1.2, 2.36, z + 0.1, std('#d9b25a', { metalness: 0.7, roughness: 0.3 }), 10);
  K.box(1.6, 1.0, 0.06, x, 2.9, z + 0.47, std('#3a2415')); K.box(1.4, 0.8, 0.02, x, 2.9, z + 0.51, std('#7a4a6a'));
}
function superCar(room, x, z, ry) {
  const g = new THREE.Group(), s = new THREE.Shape(); s.moveTo(-2.5, 0.28); s.lineTo(2.55, 0.28); s.lineTo(2.6, 0.62); s.lineTo(0.95, 0.82); s.lineTo(0.1, 1.2); s.lineTo(-1.15, 1.2); s.lineTo(-2.2, 0.92); s.lineTo(-2.6, 0.95); s.closePath();
  const body = new THREE.ExtrudeGeometry(s, { depth: 1.86, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.05, bevelSegments: 1 }); body.translate(0, 0, -0.93); const paint = std('#d01d3a', { metalness: 0.7, roughness: 0.25, flatShading: true }), dark = std('#111116', { roughness: 0.5 }), glass = std('#0e1a24', { metalness: 0.5, roughness: 0.1 });
  const m = new THREE.Mesh(body, paint); m.castShadow = true; g.add(m); const part = (w, h, d, px, py, pz, mat, rz = 0) => { const q = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); q.position.set(px, py, pz); q.rotation.z = rz; g.add(q); return q; };
  part(1.15, 0.03, 1.72, 0.52, 1.03, 0, glass, -0.42); part(1.1, 0.03, 1.72, -0.55, 1.22, 0, glass); part(0.75, 0.32, 0.03, -0.45, 0.98, 0.99, glass); part(0.75, 0.32, 0.03, -0.45, 0.98, -0.99, glass);
  part(0.5, 0.05, 2, -2.45, 1.32, 0, dark); part(0.08, 0.34, 0.08, -2.4, 1.14, 0.7, dark); part(0.08, 0.34, 0.08, -2.4, 1.14, -0.7, dark); part(0.04, 0.1, 0.5, 2.62, 0.62, 0.62, glow('#fff2c0', 1.5)); part(0.04, 0.1, 0.5, 2.62, 0.62, -0.62, glow('#fff2c0', 1.5)); part(0.04, 0.09, 1.7, -2.66, 0.82, 0, glow('#ff2a2a', 1.3)); part(4.6, 0.04, 2.0, 0, 0.14, 0, glow('#38e8ff', 1.1));
  for (const [wx, wz] of [[1.55, 1], [1.55, -1], [-1.55, 1], [-1.55, -1]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 18).rotateX(Math.PI / 2), dark); w.position.set(wx, 0.4, wz); w.castShadow = true; g.add(w); const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.32, 10).rotateX(Math.PI / 2), std('#d9b25a', { metalness: 0.8, roughness: 0.25 })); hub.position.copy(w.position); g.add(hub); }
  g.position.set(x, 0.1, z); g.rotation.y = ry; room.add(g); return g;
}
function superBike(room, x, z, ry) {
  const g = new THREE.Group(), paint = std('#1a7fe0', { metalness: 0.7, roughness: 0.25, flatShading: true }), dark = std('#111116', { roughness: 0.5 }), part = (w, h, d, px, py, pz, mat, rz = 0) => { const q = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); q.position.set(px, py, pz); q.rotation.z = rz; q.castShadow = true; g.add(q); return q; };
  for (const wx of [0.82, -0.82]) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.1, 8, 20), dark); w.position.set(wx, 0.44, 0); g.add(w); const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.12, 10).rotateX(Math.PI / 2), std('#d9b25a', { metalness: 0.8, roughness: 0.25 })); hub.position.set(wx, 0.44, 0); g.add(hub); }
  part(0.95, 0.42, 0.34, 0.08, 0.72, 0, paint, -0.12); part(0.55, 0.3, 0.3, 0.62, 0.98, 0, paint, -0.7); part(0.7, 0.1, 0.28, -0.42, 1.0, 0, dark, 0.14); part(0.55, 0.14, 0.26, -0.72, 1.08, 0, paint, 0.32); part(0.5, 0.36, 0.3, 0.05, 0.42, 0, dark); part(0.06, 0.62, 0.06, 0.74, 0.72, 0.1, dark, -0.45); part(0.06, 0.62, 0.06, 0.74, 0.72, -0.1, dark, -0.45); part(0.05, 0.05, 0.62, 0.55, 1.18, 0, dark); part(0.02, 0.1, 0.16, 0.86, 0.98, 0, glow('#fff2c0', 1.5)); part(0.7, 0.05, 0.05, -0.5, 0.5, 0.2, std('#9aa4b0', { metalness: 0.9, roughness: 0.3 }), 0.12); part(0.02, 0.06, 0.14, -0.98, 1.12, 0, glow('#ff2a2a', 1.3)); part(1.7, 0.03, 0.5, 0, 0.1, 0, glow('#ff4ad8', 1));
  g.position.set(x, 0.1, z); g.rotation.y = ry; g.rotation.x = 0.1; g.scale.setScalar(1.25); room.add(g); return g;
}
export function furnish(key, room, w, d) {
  { const L = new THREE.HemisphereLight('#fff1dc', '#7a6a5c', 1.7); room.add(L); const P = new THREE.PointLight('#ffd9a8', 60, 26, 1.6); P.position.set(0, 4.2, key === 'office' ? 0 : -2); room.add(P); } // lit from inside
  const K = kit(room), solids = [], tick = [], lamp = (x, z) => { K.cyl(0.05, 0.08, 1.9, x, 0.95, z, std('#2a2a2e'), 8); K.cyl(0.2, 0.32, 0.36, x, 1.95, z, glow('#ffd9a0', 1.2), 12); solids.push([x, z, 0.35]); }, plant = (x, z, s = 1) => { K.cyl(0.32 * s, 0.24 * s, 0.5 * s, x, 0.25 * s, z, std('#7a4a30'), 10); K.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.62 * s, 0), std('#4a7a34', { flatShading: true })), x, 1 * s, z, 0, true); solids.push([x, z, 0.5]); };
  if (key === 'office') {
    // the door to the middle, in front of the fire
    K.box(2.0, 0.02, 5.2, 0, 0.075, 3.6, std('#3a4a7a', { roughness: 1 })); K.box(2.3, 0.015, 5.5, 0, 0.07, 3.6, std('#d9b25a'));
    K.box(4.6, 0.02, 2.2, -1.9, 0.075, -4.3, std('#6d4a22', { roughness: 1 }));
    roundTable(K, room, 3.9, 2.3, tick); solids.push([3.9, 2.3, 2.9]);
    fireplace(K, -1.9, -6.5, tick); solids.push([-1.9, -6.1, 1.9], [-3.3, -5.9, 0.6], [-0.5, -5.9, 0.6]);
    monitors(K, 6.3, 3.5, -6.72, 3, 2, 1.1, 0.68); monitors(K, -8.72, 2.9, 0.6, 2, 2, 1.3, 0.8, Math.PI / 2);
    const team = HS.team('hero').map(id => HS.name(id)); statue(K, room, team[0] || 'Nova', -7.7, -2.6, Math.PI / 2); solids.push([-7.7, -2.6, 1.1]); statue(K, room, team[1] || team[0] || 'Nova', 7.7, -2.4, -Math.PI / 2); solids.push([7.7, -2.4, 1.1]);
    plant(-7.9, 5.9); plant(7.9, 5.9); lamp(-8.1, -6.1); lamp(8.2, 1.2);
    for (const [bx, c] of [[-4.6, '#ff3fcf'], [0.9, '#29e3ff']]) { K.box(0.9, 2.1, 0.06, bx, 3.2, -6.77, std(c, { roughness: 1 })); K.box(1.0, 0.1, 0.1, bx, 4.3, -6.75, std('#d9b25a')); }
    K.box(0.5, 2.6, 2.4, -8.7, 1.3, 4.6, std('#4a3020')); for (let j = 0; j < 4; j++) { K.box(0.54, 0.05, 2.3, -8.68, 0.4 + j * 0.62, 4.6, std('#2c1c10')); for (let i = 0; i < 8; i++) K.box(0.22, 0.42, 0.2, -8.48, 0.64 + j * 0.62, 3.7 + i * 0.26, std(['#a33', '#37a', '#3a6', '#ca3', '#845'][(i + j * 3) % 5])); }
  } else {
    const lane = std('#d9b25a', { roughness: 1 }); for (const [px, pz, c, r0] of [[-15.4, -12.3, '#5a5a6a', 4], [14.4, -12.4, '#5a5a6a', 3.6]]) { K.cyl(r0, r0 + 0.1, 0.14, px, 0.07, pz, std(c, { metalness: 0.5, roughness: 0.4 }), 32, false); K.ring(r0 - 0.2, r0 - 0.05, px, pz, glow('#38e8ff', 1), 0.155); solids.push([px, pz, r0 - 0.3]); }
    const car = superCar(room, -15.4, -12.3, 0.7), bike = superBike(room, 14.4, -12.4, 2.5); car.position.y = 0.14; bike.position.y = 0.3; let t0 = 0; tick.push((t, dt) => { t0 += dt; car.rotation.y = 0.7 + Math.sin(t0 * 0.25) * 0.5; bike.rotation.y = 2.5 + Math.sin(t0 * 0.3 + 1) * 0.5; });
    monitors(K, 0, 3.4, -16.72, 4, 2, 1.5, 0.9); K.box(9, 0.9, 1, 0, 0.45, -16.2, std('#2b2b2e')); solids.push([-3, -16, 1.4], [0, -16, 1.4], [3, -16, 1.4]);
    K.box(0.9, 1, 7, -19.2, 0.5, 4, std('#4a4e56')); K.box(0.06, 2, 6.6, -19.6, 2.1, 4, std('#2f3238')); for (let i = 0; i < 7; i++) K.box(0.05, 0.5, 0.12, -19.55, 2.4, 1.2 + i * 0.9, std('#b8bec8', { metalness: 0.7, roughness: 0.3 })); for (const zz of [1.6, 4, 6.4]) solids.push([-19, zz, 1.2]);
    for (let i = 0; i < 4; i++) K.cyl(0.42, 0.42, 0.3, 18.6, 0.16 + i * 0.3, 11.4, std('#15151a'), 14, true); solids.push([18.6, 11.4, 0.7]);
    K.cyl(0.05, 0.05, 1, -17.4, 3.2, -1, std('#333'), 6); K.cyl(0.42, 0.42, 1.7, -17.4, 1.85, -1, std('#7a3a2a', { roughness: 1 }), 12, true); K.box(2.2, 0.1, 0.1, -17.4, 3.75, -1, std('#333')); solids.push([-17.4, -1, 0.7]);
    for (let i = 0; i < 2; i++) K.box(8, 0.02, 0.22, 0, 0.08, 15 + i * 0.5 - 0.6, lane);
  }
  return { solids, tick };
}
