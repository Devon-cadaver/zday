// What a hero or villain wears on their head (Sean: a lot of options, a skull, a hood, a cowl, a cowboy hat, a head band, an eye band). Each is built on the rig's head, which is about 0.11 wide, 0.13 tall and faces +z, in the outfit's colour (of.hgc) or its own. Works at any distance, on the plain and the smooth body.
import * as THREE from 'three';

const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...o }), lit = (c, k = 1.6) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k) });
const DARK = () => std('#0a0a0c'), GOLD = () => std('#d4a84b', { metalness: 0.7, roughness: 0.3 }), STEEL = () => std('#aeb6c0', { metalness: 0.8, roughness: 0.3 });
// a carved pumpkin: ribs round it, a sunk dark socket and a glow in each cut, a toothed grin, a stem of n bent pieces, a leaf and a curl of vine. The eyes' colour and the stem's length make the three
function pumpkin(P, m, eye, n) {
  const c0 = m.color.clone(), rib = std(c0.clone().lerp(new THREE.Color('#000000'), 0.28), { roughness: 0.75 }), hi = std(c0.clone().lerp(new THREE.Color('#ffd27a'), 0.18), { roughness: 0.55 }), R0 = 0.158, Y = 0.012; P.ball(0.148, 0.128, 0.148, 0, Y, 0, rib);
  for (let i = 0; i < 12; i++) { const a = i / 12 * 6.2832, q = P.ball(0.05, 0.132, 0.042, Math.sin(a) * 0.107, Y, Math.cos(a) * 0.107, i % 2 ? m : hi); q.rotation.y = a; }
  const flat = (pts, z, mat, tilt = 0) => { const sh = new THREE.Shape(); pts.forEach((v, i) => (i ? sh.lineTo(v[0], v[1]) : sh.moveTo(v[0], v[1]))); sh.closePath(); const q = P.add(new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: false }), mat)); q.position.z = z; q.rotation.y = tilt; return q; };
  const dark = new THREE.MeshBasicMaterial({ color: '#120600' }), glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(eye).multiplyScalar(1.7) }), core = new THREE.MeshBasicMaterial({ color: new THREE.Color(eye).lerp(new THREE.Color('#ffffff'), 0.55).multiplyScalar(1.5) }), z = R0 - 0.006;
  const tri = (cx, cy, r) => [[cx - r, cy - r * 0.8], [cx + r, cy - r * 0.8], [cx, cy + r]];
  for (const s of [-1, 1]) { const x = s * 0.056, t = s * 0.16, y = 0.03; flat(tri(x, y, 0.038), z - 0.008, dark, t); flat(tri(x, y - 0.002, 0.028), z - 0.004, glow, t); flat(tri(x, y - 0.006, 0.013), z - 0.001, core, t); }
  flat(tri(0, -0.012, 0.014), z, dark); flat(tri(0, -0.013, 0.008), z + 0.002, glow);
  const grin = (k) => { const W = 0.092 * k, B = -0.05 * k - 0.016, H = 0.024 * k, L = [[-W, B + H * 1.25]]; for (let i = 1; i <= 8; i++) { const x = -W + i * W / 4, tooth = i % 2 ? -0.013 * k : 0; L.push([x, B + H * 1.25 - Math.abs(x / W) * -H * 0.25 + tooth]); } L.push([W, B + H * 1.25]); for (let i = 8; i >= 0; i--) { const x = -W + i * W / 4 * 1, tooth = i % 2 ? 0.013 * k : 0; L.push([x * 0.9, B - H * (1 - x * x / (W * W)) + tooth]); } return L; };
  flat(grin(1), z - 0.012, dark); flat(grin(0.82), z - 0.006, glow);
  // the top, the stem, a leaf, a curl of vine
  const st = std('#4a6a2c', { roughness: 0.9 }), st2 = std('#33501f', { roughness: 0.95 }); P.ball(0.05, 0.016, 0.05, 0, 0.135, 0, st2); let x = 0, y = 0.137, z2 = 0, tiltX = 0, tiltZ = 0; for (let i = 0; i < n; i++) { const r = 0.024 - i * 0.0018, l = 0.03, q = P.cyl(r * 0.84, r, l, x, y + l / 2, z2, i % 2 ? st : st2, 7); q.rotation.set(tiltX, 0, tiltZ); x += Math.sin(-tiltZ) * l; z2 += Math.sin(tiltX) * l; y += Math.cos(tiltZ) * l; tiltZ -= 0.28; tiltX += 0.08; }
  const leaf = P.ball(0.05, 0.006, 0.03, 0.055, 0.138, -0.03, std('#3c6a2a', { flatShading: true, side: THREE.DoubleSide })); leaf.rotation.set(0.3, 0.5, 0.35);
  const vine = P.add(new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.004, 5, 14, 4.6), st2)); vine.position.set(-0.05, 0.142, 0.025); vine.rotation.set(1.2, 0.2, 0);
}
// [id, name, its own colour, build]
export const HEADGEAR = [
  ['none', 'None', '#ff3fcf', null],
  ['skull', 'Skull', '#e6dfc8', (P, m) => { P.ball(0.126, 0.14, 0.13, 0, 0.012, 0, m); const d = DARK(); for (const s of [-1, 1]) P.ball(0.036, 0.04, 0.02, s * 0.05, 0.02, 0.113, d); P.box(0.024, 0.036, 0.016, 0, -0.03, 0.124, d); P.box(0.11, 0.05, 0.1, 0, -0.098, 0.03, m); for (let i = -2; i <= 2; i++) P.box(0.008, 0.038, 0.01, i * 0.021, -0.098, 0.082, d); }],
  ['hood', 'Hood', '#3a3f4a', (P, m) => { P.shell(0.142, 0.158, 0.146, 0, 0.012, -0.012, m, { open: 1.15 }); P.cone(0.06, 0.11, 0, 0.06, -0.15, m, 1.9); P.box(0.2, 0.09, 0.13, 0, -0.14, -0.06, m); }],
  ['cowl', 'Cowl', '#22242c', (P, m) => { P.shell(0.126, 0.146, 0.13, 0, 0.012, 0, m, { thetaTo: 1.72 }); P.box(0.16, 0.05, 0.14, 0, -0.1, -0.03, m); const w = lit('#ffffff', 1.3); for (const s of [-1, 1]) { const e = P.box(0.036, 0.013, 0.008, s * 0.043, 0.024, 0.128, w); e.rotation.z = s * 0.28; P.cone(0.024, 0.09, s * 0.07, 0.17, 0, m); } }],
  ['cowboy', 'Cowboy hat', '#7a5a3a', (P, m) => { P.cyl(0.082, 0.1, 0.1, 0, 0.145, -0.005, m); P.ball(0.083, 0.02, 0.09, 0, 0.196, -0.005, m); const b = P.cyl(0.215, 0.205, 0.012, 0, 0.09, -0.005, m, 22); b.scale.z = 0.86; P.cyl(0.103, 0.103, 0.022, 0, 0.106, -0.005, DARK()); for (const s of [-1, 1]) { const q = P.box(0.1, 0.012, 0.3, s * 0.17, 0.106, -0.005, m); q.rotation.z = s * 0.45; } }],
  ['headband', 'Head band', '#d01d3a', (P, m) => { P.band(0.122, 0.03, 0.05, m); P.box(0.02, 0.1, 0.012, 0.03, 0, -0.128, m).rotation.z = 0.4; P.box(0.02, 0.1, 0.012, -0.03, 0, -0.128, m).rotation.z = -0.4; }],
  ['eyeband', 'Eye band', '#111116', (P, m) => { P.band(0.122, 0.052, 0.012, m); const w = lit('#ffffff', 1.3); for (const s of [-1, 1]) P.ball(0.024, 0.012, 0.006, s * 0.044, 0.014, 0.12, w); P.box(0.022, 0.09, 0.012, 0.02, -0.02, -0.128, m).rotation.z = 0.3; }],
  ['domino', 'Eye mask', '#1a4a8a', (P, m) => { const f = P.ball(0.094, 0.032, 0.03, 0, 0.018, 0.098, m); f.scale.z = 0.03; const w = lit('#ffffff', 1.2); for (const s of [-1, 1]) { P.ball(0.025, 0.015, 0.006, s * 0.043, 0.016, 0.116, w); const t = P.box(0.03, 0.03, 0.012, s * 0.09, 0.03, 0.08, m); t.rotation.z = s * 0.6; } }],
  ['visor', 'Visor', '#29e3ff', (P, m) => { P.band(0.122, 0.046, 0.014, DARK()); const g = new THREE.MeshBasicMaterial({ color: new THREE.Color(m.color).multiplyScalar(1.6) }); P.ball(0.088, 0.018, 0.012, 0, 0.014, 0.112, g); }],
  ['goggles', 'Goggles', '#7a5a3a', (P, m) => { P.band(0.122, 0.052, 0.024, m); const r = STEEL(), l = std('#29e3ff', { metalness: 0.5, roughness: 0.1 }); for (const s of [-1, 1]) { const a = P.cyl(0.03, 0.03, 0.03, s * 0.042, 0.052, 0.112, r, 12); a.rotation.x = Math.PI / 2; const b = P.cyl(0.023, 0.023, 0.034, s * 0.042, 0.052, 0.114, l, 12); b.rotation.x = Math.PI / 2; } }],
  ['ninja', 'Ninja mask', '#15151a', (P, m) => { P.shell(0.125, 0.145, 0.13, 0, 0.012, 0, m, { thetaTo: 1.38 }); P.shell(0.125, 0.145, 0.13, 0, 0.012, 0, m, { thetaFrom: 1.62 }); P.box(0.03, 0.14, 0.012, 0.02, -0.04, -0.136, m).rotation.z = 0.25; }],
  ['bandana', 'Mouth scarf', '#8a1c2a', (P, m) => { P.shell(0.122, 0.142, 0.126, 0, 0.012, 0, m, { thetaFrom: 1.68, thetaTo: 2.75 }); P.cone(0.06, 0.1, 0, -0.14, 0.09, m, Math.PI); }],
  ['helmet', 'Helmet', '#d01d3a', (P, m) => { P.shell(0.142, 0.158, 0.15, 0, 0.012, 0, m, { thetaTo: 2.2 }); const v = P.ball(0.108, 0.05, 0.03, 0, 0.012, 0.128, std('#0e1a24', { metalness: 0.6, roughness: 0.1 })); v.scale.z = 0.3; }],
  ['knight', 'Knight helm', '#aeb6c0', (P, m) => { const q = std(m.color, { metalness: 0.8, roughness: 0.3 }); P.cyl(0.135, 0.135, 0.25, 0, 0.012, 0, q, 16); P.ball(0.135, 0.06, 0.135, 0, 0.137, 0, q); const d = DARK(); P.box(0.17, 0.016, 0.012, 0, 0.022, 0.133, d); for (let i = -1; i <= 1; i++) P.box(0.008, 0.08, 0.012, i * 0.04, -0.05, 0.133, d); P.box(0.03, 0.14, 0.09, 0, 0.21, -0.03, lit('#d01d3a', 1)); }],
  ['viking', 'Viking horns', '#8a929c', (P, m) => { P.shell(0.13, 0.14, 0.132, 0, 0.022, 0, m, { thetaTo: 1.45 }); P.band(0.132, 0.024, 0.044, std('#d4a84b', { metalness: 0.7, roughness: 0.3 })); const h = std('#e8e2d6'); for (const s of [-1, 1]) { P.cone(0.03, 0.17, s * 0.15, 0.12, 0, h, 0, s * -0.75); } P.box(0.018, 0.1, 0.02, 0, 0.0, 0.134, m); }],
  ['horns', 'Devil horns', '#d01d3a', (P, m) => { for (const s of [-1, 1]) P.cone(0.026, 0.12, s * 0.07, 0.14, 0.02, m, 0, s * -0.4); }],
  ['spiked', 'Spiked helm', '#26262c', (P, m) => { P.shell(0.13, 0.15, 0.134, 0, 0.012, 0, m, { thetaTo: 1.5 }); const s = STEEL(); for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28; P.cone(0.017, 0.08, Math.sin(a) * 0.1, 0.13, Math.cos(a) * 0.1, s, Math.cos(a) * 0.55, -Math.sin(a) * 0.55); } P.cone(0.02, 0.11, 0, 0.19, 0, s); }],
  ['crown', 'Crown', '#d4a84b', (P, m) => { const q = std(m.color, { metalness: 0.7, roughness: 0.3 }); P.band(0.112, 0.045, 0.125, q); for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; P.cone(0.022, 0.06, Math.sin(a) * 0.105, 0.175, Math.cos(a) * 0.105, q); } P.ball(0.016, 0.016, 0.01, 0, 0.125, 0.115, lit('#d01d3a', 1.2)); }],
  ['tiara', 'Tiara', '#d4a84b', (P, m) => { const q = std(m.color, { metalness: 0.7, roughness: 0.3 }); P.cone(0.03, 0.075, 0, 0.13, 0.1, q); for (const s of [-1, 1]) P.cone(0.02, 0.05, s * 0.05, 0.12, 0.09, q); P.band(0.12, 0.012, 0.08, q); P.ball(0.013, 0.013, 0.008, 0, 0.115, 0.114, lit('#29e3ff', 1.3)); }],
  ['tophat', 'Top hat', '#15151a', (P, m) => { P.cyl(0.095, 0.09, 0.2, 0, 0.215, -0.005, m); P.cyl(0.165, 0.165, 0.012, 0, 0.115, -0.005, m, 20); P.cyl(0.098, 0.094, 0.03, 0, 0.135, -0.005, lit('#d01d3a', 0.9)); }],
  ['fedora', 'Fedora', '#4a3a2e', (P, m) => { P.cyl(0.085, 0.102, 0.09, 0, 0.145, -0.005, m); P.cyl(0.175, 0.17, 0.012, 0, 0.1, -0.005, m, 20); P.cyl(0.104, 0.104, 0.02, 0, 0.112, -0.005, DARK()); P.box(0.03, 0.02, 0.1, 0, 0.19, 0, m); }],
  ['wizard', 'Wizard hat', '#2a1f7a', (P, m) => { P.cone(0.115, 0.34, 0, 0.27, -0.01, m); P.cyl(0.19, 0.185, 0.012, 0, 0.1, -0.01, m, 22); P.cyl(0.117, 0.117, 0.018, 0, 0.113, -0.01, GOLD()); }],
  ['pirate', 'Pirate hat', '#15151a', (P, m) => { P.ball(0.21, 0.072, 0.11, 0, 0.145, 0, m); P.ball(0.1, 0.06, 0.1, 0, 0.11, 0, m); P.ball(0.027, 0.03, 0.01, 0, 0.16, 0.104, std('#e6dfc8')); }],
  ['cap', 'Ball cap', '#1a4a8a', (P, m) => { P.shell(0.122, 0.12, 0.126, 0, 0.042, 0, m, { thetaTo: 1.57 }); const v = P.box(0.12, 0.012, 0.11, 0, 0.056, 0.15, m); v.rotation.x = 0.12; }],
  ['beanie', 'Beanie', '#3c5a3f', (P, m) => { P.shell(0.126, 0.14, 0.13, 0, 0.022, 0, m, { thetaTo: 1.45 }); P.band(0.129, 0.046, 0.042, m); P.ball(0.028, 0.028, 0.028, 0, 0.17, 0, std('#e8e2d6')); }],
  ['mohawk', 'Mohawk', '#ff3fcf', (P, m) => { for (let i = 0; i < 7; i++) { const a = -0.5 + i * 0.42, q = P.cone(0.022, 0.1, 0, Math.cos(a) * 0.13 + 0.02, -Math.sin(a) * 0.12, m, Math.cos(a) > 0 ? -a : -a); q.rotation.x = -a; } }],
  ['antennae', 'Antennae', '#3dff5c', (P, m) => { for (const s of [-1, 1]) { const q = P.cyl(0.005, 0.005, 0.13, s * 0.05, 0.18, 0, std('#26262c'), 6); q.rotation.z = s * -0.3; P.ball(0.019, 0.019, 0.019, s * 0.072, 0.245, 0, m); } }],
  ['halo', 'Halo', '#ffd24a', (P, m) => { const g = new THREE.MeshBasicMaterial({ color: new THREE.Color(m.color).multiplyScalar(1.5) }); const t = P.add(new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.011, 8, 28).rotateX(Math.PI / 2), g)); t.position.y = 0.22; }],
  ['gasmask', 'Gas mask', '#3a3f3a', (P, m) => { P.shell(0.124, 0.142, 0.13, 0, 0.012, 0, m, { thetaFrom: 1.1, thetaTo: 2.7, open: 0 }); const l = std('#0e1a24', { metalness: 0.5, roughness: 0.1 }), r = STEEL(); for (const s of [-1, 1]) { const q = P.cyl(0.032, 0.032, 0.014, s * 0.046, 0.016, 0.116, l, 14); q.rotation.x = Math.PI / 2; } const c = P.cyl(0.036, 0.046, 0.07, 0, -0.058, 0.14, r, 12); c.rotation.x = Math.PI / 2; }],
  ['space', 'Space helmet', '#d6f0ff', (P, m) => { P.ball(0.18, 0.18, 0.18, 0, 0.01, 0, new THREE.MeshStandardMaterial({ color: m.color, transparent: true, opacity: 0.32, roughness: 0.04, metalness: 0.35, depthWrite: false })); const q = P.add(new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.024, 8, 24).rotateX(Math.PI / 2), STEEL())); q.position.y = -0.14; }],
  ['robot', 'Robot head', '#8a929c', (P, m) => { const q = std(m.color, { metalness: 0.7, roughness: 0.35 }); P.box(0.24, 0.26, 0.24, 0, 0.012, 0, q); const e = lit('#ff4a4a', 1.5); for (const s of [-1, 1]) P.box(0.05, 0.03, 0.01, s * 0.056, 0.035, 0.122, e); const d = DARK(); P.box(0.14, 0.016, 0.01, 0, -0.06, 0.122, d); P.cyl(0.006, 0.006, 0.08, 0, 0.18, 0, d, 6); P.ball(0.016, 0.016, 0.016, 0, 0.225, 0, e); }],
  ['pumpkin', 'Pumpkin: orange', '#e8761c', (P, m) => pumpkin(P, m, '#ffb020', 2)],
  ['pumpkin2', 'Pumpkin: purple', '#e8761c', (P, m) => pumpkin(P, m, '#b040ff', 4)],
  ['pumpkin3', 'Pumpkin: green', '#e8761c', (P, m) => pumpkin(P, m, '#3dff5c', 7)],
];
const BY = {}; for (const h of HEADGEAR) BY[h[0]] = h;
export function addHeadgear(r, of) {
  if (!of || !of.hg || of.hg === 'none' || !r.head || !BY[of.hg]) return; const [, , own, build] = BY[of.hg], g = new THREE.Group(), m = std(of.hgc || own, { side: THREE.DoubleSide }); g.name = 'headgear';
  const add = (q) => { q.castShadow = true; g.add(q); return q; }, at = (q, x, y, z) => { q.position.set(x, y, z); return add(q); };
  const P = {
    add,
    ball: (rx, ry, rz, x, y, z, mat) => { const q = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), mat); q.scale.set(rx, ry, rz); return at(q, x, y, z); },
    box: (w, h, d, x, y, z, mat) => at(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat), x, y, z),
    cyl: (r0, r1, h, x, y, z, mat, n = 16) => at(new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, n), mat), x, y, z),
    cone: (rd, h, x, y, z, mat, rx = 0, rz = 0) => { const q = at(new THREE.Mesh(new THREE.ConeGeometry(rd, h, 8), mat), x, y, z); q.rotation.set(rx, 0, rz); return q; },
    band: (rd, h, y, mat) => { const q = at(new THREE.Mesh(new THREE.CylinderGeometry(rd, rd, h, 22, 1, true), mat.side === THREE.DoubleSide ? mat : (mat.side = THREE.DoubleSide, mat)), 0, y, 0); q.scale.z = 1.06; return q; },
    // a part of a ball: from thetaFrom to thetaTo down from the top, with an opening of open radians in the front
    shell: (rx, ry, rz, x, y, z, mat, o = {}) => { const a = o.thetaFrom || 0, b = o.thetaTo || Math.PI, op = o.open || 0, q = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12, Math.PI / 2 + op, Math.PI * 2 - op * 2, a, b - a), mat); q.scale.set(rx, ry, rz); return at(q, x, y, z); },
  };
  build(P, m); r.head.add(g); r.headgear = g;
}
