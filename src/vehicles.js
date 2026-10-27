// Vehicle library: box-kit models with baked vertex colours, built from Sean's
// reference sheets. Forward is +x, up is +y, width along z. Traffic cars are
// plain geometries for instancing (body parts coloured white so an instance
// colour tints them); mission vehicles and showcase models come as groups.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function paint(g, hex) {
  const c = new THREE.Color(hex); const n = g.attributes.position.count; const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
const box = (w, h, d, x, y, z, hex, ry = 0, rz = 0) => { const g = new THREE.BoxGeometry(w, h, d); if (rz) g.rotateZ(rz); if (ry) g.rotateY(ry); g.translate(x, y, z); return paint(g, hex); };
const cyl = (r0, r1, h, x, y, z, hex, axis = 'y', seg = 8) => {
  const g = new THREE.CylinderGeometry(r0, r1, h, seg);
  if (axis === 'z') g.rotateX(Math.PI / 2); else if (axis === 'x') g.rotateZ(-Math.PI / 2);
  g.translate(x, y, z); return paint(g, hex);
};
const merge = (parts) => { const g = mergeGeometries(parts); g.computeBoundingSphere(); return g; };
const DARK = '#1c1c1c', GLASS = '#262b31', TYRE = '#161616', RIM = '#8a8a8a';

function wheels(parts, xs, zHalf, r, w = 0.3, y = null) {
  const yy = y ?? r;
  for (const x of xs) for (const z of [-zHalf, zHalf]) {
    parts.push(cyl(r, r, w, x, yy, z, TYRE, 'z', 10));
    parts.push(cyl(r * 0.55, r * 0.55, w + 0.02, x, yy, z, RIM, 'z', 8));
  }
}
function lights(parts, xFront, xBack, y, zHalf, w = 0.3) {
  for (const z of [-zHalf, zHalf]) {
    parts.push(box(0.1, 0.16, w, xFront, y, z, '#fff6d8'));
    parts.push(box(0.1, 0.14, w * 0.9, xBack, y, z, '#c0231a'));
  }
}

// ---------- civilian cars (body '#ffffff' so instance colour tints)
export const CAR_TYPES = {
  sedan: { w: 0.42, len: 4.4, build: () => {
    const p = [box(3.7, 0.4, 1.62, 0, 0.38, 0, DARK), box(4.4, 0.56, 1.8, 0, 0.78, 0, '#ffffff'), box(2.3, 0.5, 1.64, -0.25, 1.3, 0, GLASS), box(2.0, 0.08, 1.52, -0.3, 1.58, 0, '#ffffff')];
    wheels(p, [1.4, -1.4], 0.86, 0.32); lights(p, 2.2, -2.2, 0.82, 0.6); return merge(p); } },
  hatchback: { w: 0.15, len: 3.9, build: () => {
    const p = [box(3.3, 0.4, 1.6, 0, 0.38, 0, DARK), box(3.9, 0.56, 1.76, 0, 0.78, 0, '#ffffff'), box(2.2, 0.56, 1.6, -0.45, 1.32, 0, GLASS), box(2.0, 0.08, 1.5, -0.5, 1.63, 0, '#ffffff')];
    wheels(p, [1.25, -1.25], 0.84, 0.31); lights(p, 1.95, -1.95, 0.82, 0.58); return merge(p); } },
  suv: { w: 0.2, len: 4.8, build: () => {
    const p = [box(4.2, 0.5, 1.75, 0, 0.5, 0, DARK), box(4.8, 0.7, 1.92, 0, 0.98, 0, '#ffffff'), box(3.1, 0.68, 1.78, -0.45, 1.66, 0, GLASS), box(3.0, 0.08, 1.7, -0.45, 2.03, 0, '#ffffff'), box(2.2, 0.06, 1.0, -0.4, 2.1, 0, '#4a4a4a')];
    wheels(p, [1.55, -1.55], 0.9, 0.38); lights(p, 2.4, -2.4, 1.0, 0.62, 0.36); return merge(p); } },
  pickup: { w: 0.1, len: 5.2, build: () => {
    const p = [box(4.6, 0.5, 1.8, 0, 0.5, 0, DARK), box(5.2, 0.6, 1.95, 0, 0.98, 0, '#ffffff'), box(1.7, 0.7, 1.8, 0.6, 1.66, 0, GLASS), box(1.6, 0.08, 1.72, 0.6, 2.04, 0, '#ffffff'),
      box(2.3, 0.5, 0.1, -1.4, 1.5, -0.92, '#ffffff'), box(2.3, 0.5, 0.1, -1.4, 1.5, 0.92, '#ffffff'), box(0.1, 0.5, 1.95, -2.55, 1.5, 0, '#ffffff')];
    wheels(p, [1.75, -1.6], 0.92, 0.4); lights(p, 2.6, -2.6, 1.0, 0.65, 0.4); return merge(p); } },
  van: { w: 0.07, len: 5.0, build: () => {
    const p = [box(4.4, 0.4, 1.8, 0, 0.42, 0, DARK), box(5.0, 1.7, 1.95, 0, 1.45, 0, '#ffffff'), box(5.02, 0.45, 1.97, -0.3, 1.75, 0, GLASS), box(0.3, 0.6, 1.9, 2.3, 1.55, 0, GLASS)];
    wheels(p, [1.7, -1.5], 0.92, 0.36); lights(p, 2.5, -2.5, 0.9, 0.65, 0.4); return merge(p); } },
  taxi: { w: 0.04, len: 4.4, build: () => {
    const p = [box(3.7, 0.4, 1.62, 0, 0.38, 0, DARK), box(4.4, 0.56, 1.8, 0, 0.78, 0, '#ffffff'), box(2.3, 0.5, 1.64, -0.25, 1.3, 0, GLASS), box(2.0, 0.08, 1.52, -0.3, 1.58, 0, '#ffffff'),
      box(0.5, 0.22, 0.9, -0.3, 1.74, 0, '#ffffff'), box(4.4, 0.08, 1.82, 0, 0.6, 0, DARK)];
    wheels(p, [1.4, -1.4], 0.86, 0.32); lights(p, 2.2, -2.2, 0.82, 0.6); return merge(p); } },
  sports: { w: 0.02, len: 4.3, build: () => {
    const p = [box(3.8, 0.3, 1.8, 0, 0.3, 0, DARK), box(4.3, 0.42, 1.95, 0, 0.6, 0, '#ffffff'), box(1.7, 0.4, 1.6, -0.3, 1.0, 0, GLASS), box(1.4, 0.06, 1.5, -0.4, 1.23, 0, '#ffffff'), box(0.3, 0.25, 1.7, -2.0, 0.95, 0, '#ffffff')];
    wheels(p, [1.4, -1.35], 0.95, 0.33, 0.34); lights(p, 2.15, -2.15, 0.62, 0.65); return merge(p); } },
};
export const TRAFFIC_MIX = Object.entries(CAR_TYPES).map(([id, t]) => ({ id, w: t.w }));

// ---------- light bar for emergency vehicles
const lightbar = (x, y, z = 0) => [box(0.4, 0.16, 0.5, x, y, z - 0.32, '#ff2a1a'), box(0.4, 0.16, 0.5, x, y, z + 0.32, '#2a5cff'), box(0.3, 0.1, 1.3, x, y - 0.04, z, '#dcdcdc')];

// ---------- named vehicles (showcase and missions)
const V = {};
V.police_interceptor = { name: 'Ford Interceptor', section: 'Police', build: () => {
  const p = [box(3.7, 0.4, 1.62, 0, 0.38, 0, DARK), box(4.4, 0.56, 1.8, 0, 0.78, 0, '#f4f4f0'), box(1.3, 0.58, 1.82, 1.5, 0.78, 0, '#1d2440'), box(1.1, 0.58, 1.82, -1.6, 0.78, 0, '#1d2440'),
    box(2.3, 0.5, 1.64, -0.25, 1.3, 0, GLASS), box(2.0, 0.08, 1.52, -0.3, 1.58, 0, '#f4f4f0'), box(4.0, 0.12, 1.84, 0, 0.62, 0, '#1d2440'), ...lightbar(0.1, 1.68)];
  wheels(p, [1.4, -1.4], 0.86, 0.32); lights(p, 2.2, -2.2, 0.82, 0.6); return merge(p); } };
V.police_tahoe = { name: 'Chevrolet Tahoe', section: 'Police', build: () => {
  const p = [box(4.2, 0.5, 1.75, 0, 0.5, 0, DARK), box(4.8, 0.7, 1.92, 0, 0.98, 0, '#1d2440'), box(2.4, 0.72, 1.94, 0, 0.98, 0, '#f4f4f0'), box(3.1, 0.68, 1.78, -0.45, 1.66, 0, GLASS), box(3.0, 0.08, 1.7, -0.45, 2.03, 0, '#f4f4f0'), ...lightbar(-0.1, 2.14)];
  wheels(p, [1.55, -1.55], 0.9, 0.38); lights(p, 2.4, -2.4, 1.0, 0.62, 0.36); return merge(p); } };
V.swat_bearcat = { name: 'SWAT Bearcat', section: 'Police', build: () => {
  const p = [box(5.4, 1.5, 2.3, -0.2, 1.55, 0, '#15171a'), box(1.6, 1.0, 2.2, 2.3, 1.1, 0, '#15171a'), box(1.2, 0.5, 2.1, 1.6, 2.0, 0, '#15171a'), box(0.9, 0.4, 1.9, 2.1, 1.75, 0, GLASS),
    box(0.9, 0.35, 0.9, -0.6, 2.5, 0, '#15171a'), box(4.6, 0.25, 2.4, -0.3, 0.85, 0, '#202326'), box(0.6, 0.12, 1.4, -1.6, 2.36, 0, '#dcdcdc'), ...lightbar(-1.6, 2.42)];
  wheels(p, [1.7, -1.7], 1.1, 0.55, 0.42); lights(p, 3.1, -2.9, 1.2, 0.8); return merge(p); } };
V.fire_truck = { name: 'Fire truck', section: 'Fire and rescue', build: () => {
  const p = [box(8.6, 0.5, 2.3, 0, 0.75, 0, DARK), box(2.4, 2.1, 2.4, 3.0, 1.75, 0, '#c8201a'), box(1.4, 0.8, 2.3, 3.3, 2.1, 0, GLASS), box(6.0, 1.7, 2.4, -1.4, 1.6, 0, '#c8201a'),
    box(5.8, 1.0, 0.12, -1.4, 1.6, 1.2, '#cfcfcf'), box(5.8, 1.0, 0.12, -1.4, 1.6, -1.2, '#cfcfcf'), box(5.6, 0.2, 0.7, -1.6, 2.6, 0, '#cfcfcf'), box(5.6, 0.2, 0.7, -1.6, 3.1, 0, '#cfcfcf'),
    box(0.1, 0.5, 0.7, -3.8, 2.85, 0, '#cfcfcf'), box(0.1, 0.5, 0.7, -1.6, 2.85, 0, '#cfcfcf'), box(0.1, 0.5, 0.7, 0.6, 2.85, 0, '#cfcfcf'), box(8.6, 0.12, 2.42, 0, 1.1, 0, '#f2d33a'), ...lightbar(3.0, 2.9)];
  wheels(p, [2.9, -1.4, -2.9], 1.08, 0.52, 0.4); lights(p, 4.25, -4.4, 1.0, 0.8); return merge(p); } };
V.ambulance = { name: 'Ambulance', section: 'Fire and rescue', build: () => {
  const p = [box(4.6, 0.4, 1.9, 0, 0.45, 0, DARK), box(1.8, 1.3, 2.0, 1.8, 1.25, 0, '#f4f4f0'), box(0.5, 0.6, 1.9, 2.5, 1.6, 0, GLASS), box(3.6, 2.0, 2.2, -0.9, 1.6, 0, '#f4f4f0'),
    box(3.62, 0.3, 2.22, -0.9, 1.45, 0, '#c8201a'), box(1.82, 0.3, 2.02, 1.8, 1.0, 0, '#c8201a'), box(0.3, 0.9, 0.3, -0.9, 2.1, 1.12, '#c8201a'), box(0.9, 0.3, 0.3, -0.9, 2.1, 1.12, '#c8201a'), ...lightbar(-0.5, 2.68)];
  wheels(p, [1.6, -1.6], 0.98, 0.38); lights(p, 2.7, -2.7, 0.9, 0.7, 0.4); return merge(p); } };
V.humvee = { name: 'HMMWV', section: 'Military', build: () => {
  const p = [box(4.4, 0.5, 2.2, 0, 0.6, 0, '#2b3426'), box(4.9, 0.9, 2.3, 0, 1.25, 0, '#4a5a3a'), box(2.6, 0.7, 2.1, -0.6, 2.05, 0, '#4a5a3a'), box(0.3, 0.5, 2.0, 0.75, 2.0, 0, GLASS),
    box(0.5, 0.3, 0.5, -0.8, 2.55, 0, '#2b3426'), cyl(0.05, 0.05, 1.0, -0.4, 2.65, 0, '#1c1c1c', 'x', 6)];
  wheels(p, [1.55, -1.55], 1.05, 0.46, 0.4); lights(p, 2.45, -2.45, 1.3, 0.8); return merge(p); } };
V.mrap = { name: 'MRAP', section: 'Military', build: () => {
  const p = [box(5.0, 0.8, 1.8, -0.2, 1.0, 0, '#8a7a55'), box(5.8, 1.5, 2.4, -0.2, 2.0, 0, '#a8956a'), box(1.4, 1.1, 2.3, 2.3, 1.8, 0, '#a8956a'), box(0.9, 0.45, 2.1, 2.1, 2.45, 0, GLASS),
    box(0.7, 0.4, 0.7, -1.0, 2.95, 0, '#8a7a55'), box(5.8, 0.12, 2.42, -0.2, 2.78, 0, '#8a7a55')];
  wheels(p, [1.9, -0.3, -2.1], 1.15, 0.6, 0.45); lights(p, 3.0, -3.1, 1.6, 0.85); return merge(p); } };
V.stryker = { name: 'Stryker', section: 'Military', build: () => {
  const p = [box(7.0, 1.4, 2.7, 0, 1.4, 0, '#4a5a3a'), box(1.4, 0.8, 2.5, 3.9, 1.2, 0, '#4a5a3a', 0, 0.4), box(1.6, 0.5, 1.6, -1.0, 2.35, 0, '#3a4a30'), cyl(0.07, 0.07, 1.8, 0.1, 2.45, 0, '#1c1c1c', 'x', 6),
    box(0.5, 0.3, 0.5, 0.8, 2.25, 0.6, '#3a4a30')];
  wheels(p, [2.6, 1.0, -0.7, -2.4], 1.3, 0.5, 0.4, 0.55); return merge(p); } };
V.abrams = { name: 'M1 Abrams', section: 'Military', build: () => {
  const p = [box(7.6, 1.0, 2.6, 0, 1.3, 0, '#6b6b4a'), box(7.9, 0.9, 0.95, 0, 0.75, 1.55, '#2a2a26'), box(7.9, 0.9, 0.95, 0, 0.75, -1.55, '#2a2a26'), box(7.2, 0.2, 0.9, 0, 1.25, 1.55, '#6b6b4a'), box(7.2, 0.2, 0.9, 0, 1.25, -1.55, '#6b6b4a'),
    box(3.6, 0.85, 2.6, -0.5, 2.2, 0, '#6b6b4a'), box(2.0, 0.4, 1.6, -0.9, 2.8, 0, '#6b6b4a'), cyl(0.13, 0.13, 5.0, 2.8, 2.25, 0.2, '#3a3a30', 'x', 8), cyl(0.3, 0.3, 0.4, -0.6, 3.1, -0.5, '#3a3a30', 'y', 8)];
  for (let x = -3.0; x <= 3.0; x += 1.0) for (const z of [-1.55, 1.55]) p.push(cyl(0.4, 0.4, 0.8, x, 0.55, z, '#3a3a30', 'z', 8));
  return merge(p); } };

// boats: the waterline is y = 0.35 (they sit that deep in the flood); a diamond-turned box makes the bow
V.police_speedboat = { name: 'Police speedboat', section: 'Police', build: () => {
  const p = [box(5.2, 0.5, 2.2, -0.5, 0.25, 0, '#15171a'), box(1.5, 0.5, 1.5, 2.0, 0.28, 0, '#15171a', Math.PI / 4),
    box(5.2, 0.55, 2.4, -0.5, 0.75, 0, '#f4f4f0'), box(1.66, 0.55, 1.66, 2.0, 0.78, 0, '#f4f4f0', Math.PI / 4),
    box(5.22, 0.16, 2.42, -0.5, 0.9, 0, '#15171a'), box(5.22, 0.06, 2.42, -0.5, 0.74, 0, '#2a5cff'),
    box(4.8, 0.06, 2.1, -0.6, 1.04, 0, '#cfcac0'), box(0.95, 0.75, 0.95, -0.1, 1.45, 0, '#f4f4f0'), box(0.1, 0.45, 1.1, 0.42, 1.95, 0, GLASS, 0, -0.35),
    box(0.5, 0.45, 1.6, -1.4, 1.3, 0, '#e8e4dc'), cyl(0.04, 0.04, 1.3, 0.25, 2.0, -0.7, '#c8c8c8'), cyl(0.04, 0.04, 1.3, 0.25, 2.0, 0.7, '#c8c8c8'),
    cyl(0.04, 0.04, 1.3, -1.0, 2.0, -0.7, '#c8c8c8'), cyl(0.04, 0.04, 1.3, -1.0, 2.0, 0.7, '#c8c8c8'), box(1.5, 0.08, 1.6, -0.4, 2.66, 0, '#15171a'), ...lightbar(-0.4, 2.78),
    box(0.45, 1.0, 0.42, -3.25, 0.85, -0.45, '#1c1c1c'), box(0.45, 1.0, 0.42, -3.25, 0.85, 0.45, '#1c1c1c'), box(0.5, 0.3, 0.48, -3.25, 1.4, -0.45, '#2a2a2a'), box(0.5, 0.3, 0.48, -3.25, 1.4, 0.45, '#2a2a2a')];
  return merge(p); } };
V.patrol_boat = { name: 'Patrol boat', section: 'Police', build: () => {
  const p = [box(7.6, 0.75, 3.0, -0.6, 0.38, 0, '#1d2440'), box(2.0, 0.75, 2.0, 3.1, 0.4, 0, '#1d2440', Math.PI / 4),
    box(7.6, 0.75, 3.2, -0.6, 1.12, 0, '#f4f4f0'), box(2.2, 0.75, 2.2, 3.1, 1.14, 0, '#f4f4f0', Math.PI / 4),
    box(7.62, 0.2, 3.22, -0.6, 1.2, 0, '#1d2440'), box(7.62, 0.07, 3.22, -0.6, 1.36, 0, '#c8201a'), box(7.2, 0.07, 2.9, -0.7, 1.5, 0, '#cfcac0'),
    box(3.0, 1.5, 2.4, -0.2, 2.25, 0, '#f4f4f0'), box(3.02, 0.5, 2.42, -0.2, 2.55, 0, GLASS), box(0.2, 0.6, 2.2, 1.35, 2.45, 0, GLASS, 0, -0.4), box(3.3, 0.12, 2.6, -0.2, 3.06, 0, '#d8d4cc'),
    cyl(0.06, 0.06, 1.4, -0.9, 3.8, 0, '#2a2a2a'), box(1.1, 0.1, 0.22, -0.9, 4.5, 0, '#2a2a2a'), ...lightbar(0.6, 3.2),
    box(7.0, 0.05, 0.05, -0.7, 2.0, -1.55, '#c8c8c8'), box(7.0, 0.05, 0.05, -0.7, 2.0, 1.55, '#c8c8c8'), box(1.0, 0.5, 2.6, -4.0, 1.75, 0, '#e8e4dc')];
  for (const x of [-3.8, -2.2, 1.6, 2.6]) for (const z of [-1.55, 1.55]) p.push(cyl(0.03, 0.03, 0.5, x, 1.78, z, '#c8c8c8', 'y', 4));
  return merge(p); } };

// the storm chaser: a white pickup with an orange stripe, a weather mast and a radar dish on the bed
V.storm_chaser = { name: 'Storm chaser', section: 'Fire and rescue', build: () => {
  const p = [box(4.6, 0.45, 1.9, 0, 0.5, 0, DARK), box(2.2, 0.75, 2.0, 1.1, 1.05, 0, '#f4f4f0'), box(1.6, 0.6, 1.86, 0.9, 1.7, 0, GLASS), box(1.5, 0.08, 1.82, 0.85, 2.02, 0, '#f4f4f0'),
    box(2.2, 0.55, 2.0, -1.2, 0.95, 0, '#f4f4f0'), box(4.62, 0.16, 2.02, 0, 1.0, 0, '#e0571a'), box(1.4, 0.12, 1.2, 0.8, 2.12, 0, '#2a2a2a'),
    cyl(0.05, 0.05, 2.4, -1.6, 2.4, 0.6, '#c8c8c8'), box(0.6, 0.05, 0.05, -1.6, 3.5, 0.6, '#c8c8c8'), cyl(0.12, 0.12, 0.2, -1.3, 3.55, 0.6, '#e0571a', 'y', 6),
    cyl(0.08, 0.08, 0.7, -1.0, 1.55, -0.4, '#8a8a8a'), cyl(0.7, 0.4, 0.25, -1.0, 2.0, -0.4, '#e8e8e4', 'x', 12), ...lightbar(0.9, 2.2)];
  wheels(p, [1.5, -1.5], 0.98, 0.42, 0.36); lights(p, 2.3, -2.3, 0.75, 0.7); return merge(p); } };
// the cloud seeder: a small twin-prop plane with flare racks under the wings
V.seeder_plane = { name: 'Cloud seeder', section: 'Aircraft', build: () => jetGroup([
  box(5.4, 0.8, 0.8, 0, 1.3, 0, '#f4f4f0'), cyl(0.4, 0.1, 1.2, 3.2, 1.3, 0, '#f4f4f0', 'x', 8), box(1.2, 0.45, 0.66, 1.6, 1.75, 0, GLASS), box(5.5, 0.12, 0.84, 0, 1.0, 0, '#e0b030'),
  box(1.3, 0.1, 8.4, 0.4, 1.55, 0, '#f4f4f0'), cyl(0.3, 0.3, 1.3, 0.7, 1.35, -1.8, '#d8d8d4', 'x', 8), cyl(0.3, 0.3, 1.3, 0.7, 1.35, 1.8, '#d8d8d4', 'x', 8),
  box(0.08, 1.2, 0.12, 1.42, 1.35, -1.8, '#2a2a2a'), box(0.08, 1.2, 0.12, 1.42, 1.35, 1.8, '#2a2a2a'), box(0.7, 0.1, 2.4, -2.5, 1.45, 0, '#f4f4f0'), box(0.8, 1.0, 0.1, -2.6, 1.95, 0, '#e0b030'),
  box(0.6, 0.2, 0.3, 0.2, 1.38, -3.2, '#e0571a'), box(0.6, 0.2, 0.3, 0.2, 1.38, 3.2, '#e0571a')]) };

function heli(body, stripe, size = 1, blades = 2, bucket = false) {
  const g = new THREE.Group();
  const p = [cyl(0.7, 0.75, 1.2, 1.8, 1.6, 0, body, 'x', 10), cyl(0.75, 0.2, 1.1, 2.9, 1.6, 0, GLASS, 'x', 10), box(3.2, 1.45, 1.5, 0, 1.6, 0, body), box(3.3, 0.35, 1.52, 0.2, 1.25, 0, stripe),
    box(3.8, 0.35, 0.35, -3.3, 1.95, 0, body), box(0.3, 1.1, 0.2, -5.2, 2.55, 0, stripe), box(0.1, 0.9, 0.12, -5.25, 2.6, 0.2, '#2a2a2a'),
    box(2.8, 0.08, 0.14, 0.3, 0.42, -0.85, '#2a2a2a'), box(2.8, 0.08, 0.14, 0.3, 0.42, 0.85, '#2a2a2a'), box(0.08, 0.8, 0.08, 0.9, 0.8, -0.85, '#2a2a2a'), box(0.08, 0.8, 0.08, 0.9, 0.8, 0.85, '#2a2a2a'), box(0.08, 0.8, 0.08, -0.6, 0.8, -0.85, '#2a2a2a'), box(0.08, 0.8, 0.08, -0.6, 0.8, 0.85, '#2a2a2a'),
    box(0.5, 0.9, 0.9, 0.9, 1.6, 0.78, GLASS)];
  if (bucket) p.push(cyl(0.02, 0.02, 2.6, 0, -0.9, 0, '#333333', 'y', 4), cyl(0.5, 0.42, 0.8, 0, -2.4, 0, '#d8471f', 'y', 10));
  const bodyMesh = new THREE.Mesh(merge(p), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.15 }));
  bodyMesh.castShadow = true; g.add(bodyMesh);
  const rp = [cyl(0.25, 0.25, 0.3, 0, 2.5, 0, '#2a2a2a', 'y', 8)];
  for (let k = 0; k < blades; k++) rp.push(box(8.2, 0.05, 0.32, 0, 2.5, 0, '#1f1f1f', (Math.PI / blades) * k));
  const rotor = new THREE.Mesh(merge(rp), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }));
  g.add(rotor); g.userData.rotor = rotor;
  g.scale.setScalar(size);
  return g;
}
V.heli_police = { name: 'Police helicopter', section: 'Police', build: () => heli('#15171a', '#f4f4f0') };
V.heli_ambulance = { name: 'Air ambulance', section: 'Fire and rescue', build: () => heli('#c8201a', '#f4f4f0') };
V.heli_rescue = { name: 'Search and rescue', section: 'Fire and rescue', build: () => heli('#f4f4f0', '#e0471a') };
V.heli_wildfire = { name: 'Wildfire helicopter', section: 'Fire and rescue', build: () => heli('#f2c300', '#c8201a', 1, 2, true) };
V.blackhawk = { name: 'Black Hawk', section: 'Military', build: () => heli('#2f3a2a', '#232a20', 1.3, 4) };

function jetGroup(parts) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(merge(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.2 }));
  m.castShadow = true; g.add(m); return g;
}
V.a10 = { name: 'A-10 Warthog', section: 'Aircraft', build: () => jetGroup([
  box(6.4, 0.9, 0.95, 0, 1.3, 0, '#7a8468'), cyl(0.45, 0.2, 1.6, 3.9, 1.3, 0, '#7a8468', 'x', 8), box(1.0, 0.5, 0.8, 1.4, 1.85, 0, GLASS),
  box(1.3, 0.12, 11.5, 0.2, 1.1, 0, '#7a8468'), cyl(0.5, 0.5, 1.9, -2.0, 2.05, -1.0, '#5e665a', 'x', 10), cyl(0.5, 0.5, 1.9, -2.0, 2.05, 1.0, '#5e665a', 'x', 10),
  box(0.9, 0.1, 3.8, -3.1, 1.7, 0, '#7a8468'), box(0.8, 1.2, 0.14, -3.2, 2.3, -1.8, '#7a8468'), box(0.8, 1.2, 0.14, -3.2, 2.3, 1.8, '#7a8468'),
  box(0.4, 0.3, 0.5, 3.3, 1.0, 0, '#c8201a'), box(0.35, 0.12, 0.5, 3.3, 1.12, 0, '#f4f4f0'), cyl(0.07, 0.07, 1.3, 3.9, 0.95, 0, '#3a3a3a', 'x', 6)]) };
V.f16 = { name: 'F-16 Fighting Falcon', section: 'Aircraft', build: () => jetGroup([
  box(7.0, 0.85, 0.9, 0, 1.3, 0, '#8d939a'), cyl(0.42, 0.08, 1.8, 4.3, 1.3, 0, '#8d939a', 'x', 8), box(1.4, 0.5, 0.7, 1.6, 1.85, 0, GLASS), box(1.2, 0.5, 0.8, 0.6, 0.85, 0, '#6b7178'),
  box(2.6, 0.1, 5.0, -1.0, 1.25, 0, '#8d939a'), box(1.8, 0.1, 3.2, 0.6, 1.25, 0, '#8d939a'), box(1.1, 1.7, 0.12, -3.0, 2.25, 0, '#8d939a'), box(1.2, 0.08, 2.6, -3.1, 1.3, 0, '#8d939a'),
  cyl(0.42, 0.3, 0.8, -3.7, 1.3, 0, '#3a3a3a', 'x', 8)]) };
V.b2 = { name: 'B-2 Spirit', section: 'Aircraft', build: () => jetGroup([
  box(4.2, 0.7, 2.2, 0, 1.3, 0, '#3a3e44'), box(1.6, 0.22, 7.0, -1.5, 1.25, -3.6, '#3a3e44', 0.6), box(1.6, 0.22, 7.0, -1.5, 1.25, 3.6, '#3a3e44', -0.6),
  box(1.0, 0.3, 1.0, 1.2, 1.7, 0, GLASS), box(0.9, 0.3, 0.6, -0.8, 1.72, -0.9, '#2d3136'), box(0.9, 0.3, 0.6, -0.8, 1.72, 0.9, '#2d3136')]) };
V.b52 = { name: 'B-52 Stratofortress', section: 'Aircraft', build: () => jetGroup([
  box(10.0, 1.0, 1.0, 0, 1.6, 0, '#8d939a'), cyl(0.5, 0.15, 1.6, 5.7, 1.6, 0, '#8d939a', 'x', 8), box(1.2, 0.4, 0.9, 3.8, 2.1, 0, GLASS),
  box(1.6, 0.12, 8.5, 0.3, 1.55, -4.2, '#8d939a', 0.55), box(1.6, 0.12, 8.5, 0.3, 1.55, 4.2, '#8d939a', -0.55),
  cyl(0.3, 0.3, 1.4, 1.4, 1.25, -2.4, '#5e666c', 'x', 8), cyl(0.3, 0.3, 1.4, 0.6, 1.25, -3.6, '#5e666c', 'x', 8), cyl(0.3, 0.3, 1.4, 1.4, 1.25, 2.4, '#5e666c', 'x', 8), cyl(0.3, 0.3, 1.4, 0.6, 1.25, 3.6, '#5e666c', 'x', 8),
  cyl(0.3, 0.3, 1.4, -0.3, 1.25, -5.0, '#5e666c', 'x', 8), cyl(0.3, 0.3, 1.4, -1.0, 1.25, -6.2, '#5e666c', 'x', 8), cyl(0.3, 0.3, 1.4, -0.3, 1.25, 5.0, '#5e666c', 'x', 8), cyl(0.3, 0.3, 1.4, -1.0, 1.25, 6.2, '#5e666c', 'x', 8),
  box(1.0, 2.6, 0.14, -4.6, 2.9, 0, '#8d939a'), box(1.2, 0.1, 4.0, -4.6, 1.7, 0, '#8d939a')]) };
// the rebuilding crews: a construction truck with a loader crane and a load of timber, and the hazmat unit's box truck
V.crane_truck = { name: 'Construction truck', section: 'Fire and rescue', build: () => {
  const Y = '#e8b020', p = [box(7.0, 0.5, 2.3, 0, 0.75, 0, DARK), box(2.0, 1.7, 2.4, 2.4, 1.75, 0, Y), box(0.9, 0.7, 2.3, 3.0, 2.15, 0, GLASS), box(4.4, 0.35, 2.4, -1.1, 1.15, 0, '#6a6660'),
    box(3.4, 0.5, 1.9, -1.5, 1.58, 0, '#b07a40'), box(3.4, 0.08, 1.95, -1.5, 1.86, 0, '#8a5a2c'), cyl(0.3, 0.35, 0.8, 0.85, 1.7, 0, Y, 'y', 8), box(3.6, 0.3, 0.3, -0.7, 2.35, 0.55, Y, 0, -0.18),
    box(0.4, 0.16, 1.4, 2.4, 2.68, 0, '#ffb020'), box(7.02, 0.12, 2.42, 0, 1.0, 0, '#2a2a2a')];
  wheels(p, [2.4, -1.2, -2.5], 1.08, 0.5, 0.4); lights(p, 3.45, -3.5, 1.0, 0.8); return merge(p); } };
V.hazmat_truck = { name: 'Hazmat unit', section: 'Fire and rescue', build: () => {
  const p = [box(7.2, 0.5, 2.3, 0, 0.75, 0, DARK), box(2.0, 1.6, 2.4, 2.6, 1.6, 0, '#f4f4f0'), box(0.8, 0.6, 2.3, 3.2, 1.95, 0, GLASS), box(5.2, 2.5, 2.5, -1.15, 2.05, 0, '#f4f4f0'),
    box(5.22, 0.32, 2.52, -1.15, 1.55, 0, '#f2b000'), box(5.22, 0.1, 2.52, -1.15, 1.34, 0, '#1c1c1c'), box(2.02, 0.32, 2.42, 2.6, 1.2, 0, '#f2b000'), box(0.9, 0.9, 0.06, -1.2, 2.45, 1.26, '#f2b000', Math.PI / 4),
    box(0.4, 0.16, 0.5, 2.6, 2.48, -0.32, '#ffb020'), box(0.4, 0.16, 0.5, 2.6, 2.48, 0.32, '#ff2a1a'), box(0.3, 0.1, 1.3, 2.6, 2.44, 0, '#dcdcdc')];
  wheels(p, [2.6, -1.4, -2.6], 1.08, 0.5, 0.4); lights(p, 3.6, -3.75, 1.0, 0.8); return merge(p); } };
// police transport for the people arrested at a riot
V.police_bus = { name: 'Police bus', section: 'Police', build: () => { const p = [box(9.4, 0.5, 2.3, 0, 0.6, 0, DARK), box(10.0, 2.3, 2.5, 0, 1.95, 0, '#1d2440'), box(10.02, 0.6, 2.52, 0, 2.4, 0, GLASS), box(0.3, 1.4, 2.4, 4.9, 1.9, 0, GLASS), box(10.0, 0.3, 2.52, 0, 1.35, 0, '#f4f4f0'),
  ...lightbar(4.4, 3.16)]; for (let x = -4; x <= 3; x += 1.4) p.push(box(0.06, 0.6, 2.54, x, 2.4, 0, '#1d2440')); wheels(p, [3.2, -2.8], 1.15, 0.5, 0.4); lights(p, 5.0, -5.0, 0.9, 0.85, 0.4); return merge(p); } };
V.bus = { name: 'City bus', section: 'Civilian', build: () => { const p = [box(9.4, 0.5, 2.3, 0, 0.6, 0, DARK), box(10.0, 2.3, 2.5, 0, 1.95, 0, '#e8e2d6'), box(10.02, 0.8, 2.52, 0, 2.3, 0, GLASS), box(0.3, 1.4, 2.4, 4.9, 1.9, 0, GLASS), box(10.0, 0.25, 2.52, 0, 1.35, 0, '#2f6b4f')]; wheels(p, [3.2, -2.8], 1.15, 0.5, 0.4); lights(p, 5.0, -5.0, 0.9, 0.85, 0.4); return merge(p); } };
for (const [id, t] of Object.entries(CAR_TYPES)) V['car_' + id] = { name: id[0].toUpperCase() + id.slice(1), section: 'Civilian', build: t.build, tint: true };
export const VEHICLES = V;

// A displayable object for any vehicle id (groups for helis and jets, meshes for the rest).
export function buildVehicle(id, tint = null) {
  const def = V[id]; if (!def) return null;
  const out = def.build();
  if (out.isGroup) return out;
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.1 });
  if (tint) mat.color.set(tint);
  const m = new THREE.Mesh(out, mat); m.castShadow = true; m.receiveShadow = true;
  const g = new THREE.Group(); g.add(m); return g;
}
export const cruiserGeometry = () => V.police_interceptor.build();
