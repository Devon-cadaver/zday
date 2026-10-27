// Little dioramas of each disaster for the roster page: a stand-in model of the
// thing itself (a funnel, a falling rock, a mushroom cloud, a wave...) on a
// patch of ground with a few blocks for scale. Some of them move a little.
import * as THREE from 'three';
import { saucerMesh, beamMesh } from './aliens.js';
import { tripodModel } from './tripod.js';
import { wormModel } from './worm.js';
import { kaijuModel } from './kaiju.js';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
const glow = (r, g, b, o = {}) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), ...o });
const add = (parent, geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
const BLOCK = ['#c8b99d', '#a39c8e', '#8c5a44', '#d3c7b0', '#77726a'];
// a few city blocks round the edge of the diorama, for scale
function blocks(g, R, n = 4, h = [4, 9]) {
  for (let i = 0; i < n; i++) {
    const a = i / n * 6.28 + 0.6, w = 2.4 + (i % 2), hh = h[0] + ((i * 37) % 10) / 10 * (h[1] - h[0]);
    add(g, new THREE.BoxGeometry(w, hh, w), std(BLOCK[i % BLOCK.length]), Math.cos(a) * R, hh / 2, Math.sin(a) * R);
  }
}
const ground = (g, R, color = '#b9ab8e') => add(g, new THREE.CylinderGeometry(R, R, 0.3, 32), std(color, { roughness: 1 }), 0, -0.1, 0); // its top a little above the plinth's, so the two never fight over the same pixels

const SWIRL_VS = /* glsl */`varying vec2 vUv; varying float vY; void main() { vUv = uv; vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SWIRL_FS = /* glsl */`
uniform float uTime; uniform vec3 uA, uB; varying vec2 vUv;
void main() {
  float s = sin(vUv.x * 6.2832 * 5.0 + vUv.y * 18.0 - uTime * 7.0) * 0.5 + 0.5;
  vec3 col = mix(uA, uB, s * 0.7 + vUv.y * 0.3);
  gl_FragColor = vec4(col, (0.55 + 0.35 * s) * smoothstep(0.0, 0.06, vUv.y));
}`;
function tornado() {
  const g = new THREE.Group(); ground(g, 9); blocks(g, 7, 4, [3, 6]);
  const prof = []; for (let i = 0; i <= 14; i++) { const t = i / 14; prof.push(new THREE.Vector2(0.8 + Math.pow(t, 1.8) * 7.5, t * 22)); }
  const mat = new THREE.ShaderMaterial({ vertexShader: SWIRL_VS, fragmentShader: SWIRL_FS, transparent: true, side: THREE.DoubleSide, depthWrite: false, uniforms: { uTime: { value: 0 }, uA: { value: new THREE.Color('#6a5a48') }, uB: { value: new THREE.Color('#b8a88e') } } });
  const funnel = add(g, new THREE.LatheGeometry(prof, 32), mat); funnel.castShadow = false;
  const dust = add(g, new THREE.SphereGeometry(3.4, 16, 8), std('#9a8668', { transparent: true, opacity: 0.6 }), 0, 0.8, 0); dust.scale.set(1, 0.45, 1);
  const junk = []; for (let i = 0; i < 6; i++) junk.push(add(g, new THREE.BoxGeometry(0.7, 0.4, 1.1), std(BLOCK[i % 5]), 0, 0, 0));
  let t = 0;
  g.userData.tick = (dt) => { t += dt; mat.uniforms.uTime.value = t; junk.forEach((j, i) => { const a = t * 2.4 + i * 1.05, r = 2.5 + i * 0.6, y = 2 + i * 2.4; j.position.set(Math.cos(a) * r, y, Math.sin(a) * r); j.rotation.set(t * 3 + i, t * 2, i); }); };
  return g;
}
function meteor() {
  const g = new THREE.Group(); ground(g, 9); blocks(g, 6.5, 5, [3, 7]);
  const rock = new THREE.Group(); rock.position.set(-1, 13, 1); rock.rotation.z = -0.6; g.add(rock);
  const rg = new THREE.IcosahedronGeometry(2.4, 1), pa = rg.attributes.position; for (let i = 0; i < pa.count; i++) { const k = 0.82 + 0.3 * Math.abs(Math.sin(pa.getX(i) * 2.1 + pa.getY(i) * 1.7)); pa.setXYZ(i, pa.getX(i) * k, pa.getY(i) * k, pa.getZ(i) * k); } rg.computeVertexNormals();
  add(rock, rg, std('#3a2a20'));
  const shell = add(rock, new THREE.SphereGeometry(3.3, 20, 12), glow(1.6, 0.65, 0.2, { transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
  add(rock, new THREE.ConeGeometry(3.2, 14, 16, 1, true).translate(0, 8, 0), glow(1.4, 0.55, 0.15, { transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); // the fire trailing behind it
  let t = 0; g.userData.tick = (dt) => { t += dt; shell.scale.setScalar(1 + Math.sin(t * 9) * 0.05); };
  return g;
}
function volcano() {
  const g = new THREE.Group(); ground(g, 10, '#8a7a62');
  add(g, new THREE.CylinderGeometry(2.6, 9, 8, 24, 1), std('#5a4a3c'), 0, 4, 0);
  const crater = add(g, new THREE.CircleGeometry(2.4, 20).rotateX(-Math.PI / 2), glow(2.6, 0.9, 0.2), 0, 8.02, 0);
  const lava = new THREE.CatmullRomCurve3([new THREE.Vector3(1.8, 7.9, 0.6), new THREE.Vector3(4, 5, 1.6), new THREE.Vector3(6.2, 2.2, 2.4), new THREE.Vector3(8.6, 0.2, 3.4)]);
  add(g, new THREE.TubeGeometry(lava, 24, 0.55, 6), glow(2.4, 0.75, 0.15));
  const smoke = []; for (let i = 0; i < 4; i++) smoke.push(add(g, new THREE.SphereGeometry(1.8 + i * 0.6, 12, 8), std('#6a6058', { transparent: true, opacity: 0.75 }), (i % 2) * 1.2 - 0.6, 10 + i * 2.4, 0));
  let t = 0; g.userData.tick = (dt) => { t += dt; crater.material.color.setRGB(2.2 + Math.sin(t * 4) * 0.5, 0.8, 0.2); smoke.forEach((s, i) => { s.position.y = 10 + ((t * 1.2 + i * 2.4) % 9.6); s.scale.setScalar(0.7 + ((t * 1.2 + i * 2.4) % 9.6) / 12); }); };
  return g;
}
const DISK_FS = /* glsl */`
uniform float uTime; varying vec2 vUv;
void main() { float r = vUv.x, a = vUv.y; float bands = 0.7 + 0.3 * sin(a * 40.0 + r * 30.0 - uTime * 4.0);
  vec3 col = mix(vec3(2.6, 2.2, 1.6), vec3(1.4, 0.45, 0.1), r) * bands; gl_FragColor = vec4(col, (1.0 - r) * 0.9); }`;
function blackhole() {
  const g = new THREE.Group(); ground(g, 9); blocks(g, 7, 4, [3, 6]);
  const core = new THREE.Group(); core.position.y = 7; core.rotation.x = 0.35; g.add(core);
  add(core, new THREE.SphereGeometry(2.4, 24, 16), new THREE.MeshBasicMaterial({ color: '#000000' }));
  const disk = new THREE.RingGeometry(3, 8, 48, 4), uv = disk.attributes.uv, pos = disk.attributes.position; // uv: x = how far out, y = angle round
  for (let i = 0; i < uv.count; i++) { const x = pos.getX(i), y = pos.getY(i); uv.setXY(i, (Math.hypot(x, y) - 3) / 5, Math.atan2(y, x)); }
  const dm = new THREE.ShaderMaterial({ vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: DISK_FS, transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: { value: 0 } } });
  const d = add(core, disk.rotateX(-Math.PI / 2), dm); d.castShadow = false;
  add(core, new THREE.TorusGeometry(2.7, 0.12, 6, 48), glow(2.6, 2.2, 1.4));
  let t = 0; g.userData.tick = (dt) => { t += dt; dm.uniforms.uTime.value = t; d.rotation.y = t * 0.6; };
  return g;
}
function saucer() {
  const g = new THREE.Group(); ground(g, 9); blocks(g, 6.5, 5, [3, 7]);
  const s = saucerMesh(); s.position.y = 11; g.add(s);
  const b = beamMesh(); b.visible = true; b.material.uniforms.uOn.value = 1; b.position.y = 10; b.scale.set(0.8, 10, 0.8); g.add(b);
  let t = 0; g.userData.tick = (dt) => { t += dt; s.userData.spin.rotation.y += dt * 2; s.position.y = 11 + Math.sin(t * 1.5) * 0.4; b.material.uniforms.uTime.value = t; };
  return g;
}
function worm() {
  const g = new THREE.Group(); ground(g, 34, '#b9a882'); blocks(g, 22, 5, [3, 8]);
  add(g, new THREE.CylinderGeometry(34, 34, 10, 40), std('#7a6a52', { roughness: 1 }), 0, -5.2, 0); // solid earth under it, so what is underground stays hidden
  for (const x of [-28]) add(g, new THREE.CircleGeometry(6, 24).rotateX(-Math.PI / 2), std('#22180f'), x, 0.02, 0); // the pits it came out of and went back into
  const w = wormModel(); w.position.x = -3; g.add(w); return g; // centred, so the head and the arc both sit inside the tile
}
function kaiju() { const g = new THREE.Group(), k = kaijuModel(); ground(g, 26); blocks(g, 19, 6, [6, 16]); g.add(k); g.userData.tick = k.userData.tick; return g; } // it breathes and writhes on its tile
function tripod() { const g = new THREE.Group(); ground(g, 18); blocks(g, 12, 6, [4, 10]); g.add(tripodModel()); return g; }
function nuke() {
  const g = new THREE.Group(); ground(g, 10, '#6a5e4c'); blocks(g, 8.5, 6, [2, 4]);
  const col = (geo, bottom, top, y0, y1) => { const p = geo.attributes.position, c = new Float32Array(p.count * 3), a = new THREE.Color(...bottom), b = new THREE.Color(...top), tmp = new THREE.Color(); for (let i = 0; i < p.count; i++) { tmp.copy(a).lerp(b, Math.min(1, Math.max(0, (p.getY(i) - y0) / (y1 - y0)))); c.set([tmp.r, tmp.g, tmp.b], i * 3); } geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); return geo; };
  const m = new THREE.MeshBasicMaterial({ vertexColors: true });
  add(g, col(new THREE.CylinderGeometry(1.6, 3, 14, 16).translate(0, 7, 0), [2.2, 0.9, 0.3], [0.7, 0.55, 0.45], 0, 14), m);
  const cap = add(g, col(new THREE.SphereGeometry(6, 24, 14).translate(0, 0, 0), [1.6, 0.6, 0.2], [0.55, 0.48, 0.42], -6, 6), m, 0, 16, 0); cap.scale.set(1, 0.55, 1);
  add(g, col(new THREE.TorusGeometry(4.6, 1.6, 10, 28).rotateX(Math.PI / 2), [0.8, 0.6, 0.45], [0.6, 0.52, 0.44], -1, 1), m, 0, 1.2, 0); // the dust ring rolling out at the base
  let t = 0; g.userData.tick = (dt) => { t += dt; cap.scale.set(1 + Math.sin(t) * 0.03, 0.55, 1 + Math.sin(t) * 0.03); };
  return g;
}
function tsunami() {
  const g = new THREE.Group(); ground(g, 10, '#c4b493'); blocks(g, 6, 3, [3, 6]);
  const sh = new THREE.Shape(); sh.moveTo(-6, 0); sh.lineTo(4, 0); sh.quadraticCurveTo(5, 4, 3.4, 8.5); sh.quadraticCurveTo(1.6, 10.6, -0.6, 9.4); sh.quadraticCurveTo(1.8, 9.2, 2.2, 7); sh.quadraticCurveTo(0, 3, -6, 2.4); sh.lineTo(-6, 0);
  const wave = add(g, new THREE.ExtrudeGeometry(sh, { depth: 16, bevelEnabled: false, curveSegments: 10 }).translate(0, 0, -8), std('#2c4a50', { roughness: 0.3, metalness: 0.1 }), -1, 0, 0);
  const foam = add(g, new THREE.BoxGeometry(2.2, 0.6, 16), std('#e8eeea', { roughness: 0.6 }), 0.6, 9.6, 0);
  let t = 0; g.userData.tick = (dt) => { t += dt; const x = Math.sin(t * 0.8) * 0.8; wave.position.x = -1 + x; foam.position.x = 0.6 + x; };
  return g;
}
function sinkhole() {
  const g = new THREE.Group(), top = new THREE.Group(); top.position.y = 6; g.add(top); // a block of ground with the pit cut into it
  add(top, new THREE.RingGeometry(3.6, 9, 32).rotateX(-Math.PI / 2), std('#b9ab8e', { side: THREE.DoubleSide }), 0, 0, 0);
  add(top, new THREE.CylinderGeometry(9, 9, 6, 32, 1, true), std('#8a7458'), 0, -3, 0);
  add(top, new THREE.CylinderGeometry(3.6, 3.2, 5.5, 24, 1, true), std('#6e5a46', { side: THREE.BackSide }), 0, -2.75, 0);
  add(top, new THREE.CircleGeometry(3.2, 24).rotateX(-Math.PI / 2), std('#3a2e22'), 0, -5.5, 0);
  const car = add(top, new THREE.BoxGeometry(1.9, 1.3, 4), std('#8c2a22'), 1, -1.8, 0); car.rotation.set(1.0, 0.4, 0.2); // nose first over the edge
  blocks(top, 7, 4, [3, 7]);
  return g;
}
function quake() {
  const g = new THREE.Group(); ground(g, 9);
  const crack = [[-8, -1], [-5, 0.6], [-2.5, -0.4], [0, 1], [2.6, -0.2], [5, 0.8], [8, 0]];
  for (let i = 0; i < crack.length - 1; i++) { const [x0, z0] = crack[i], [x1, z1] = crack[i + 1], L = Math.hypot(x1 - x0, z1 - z0), m = add(g, new THREE.BoxGeometry(L, 0.32, 0.7), std('#2a2018'), (x0 + x1) / 2, 0.02, (z0 + z1) / 2); m.rotation.y = -Math.atan2(z1 - z0, x1 - x0); }
  const a = add(g, new THREE.BoxGeometry(3, 7, 3), std(BLOCK[0]), -3, 3.3, 3.5); a.rotation.z = 0.18;
  const b = add(g, new THREE.BoxGeometry(2.6, 5, 2.6), std(BLOCK[2]), 3, 2.3, -3.4); b.rotation.x = -0.22;
  let t = 0; g.userData.tick = (dt) => { t += dt; g.position.x = Math.sin(t * 40) * 0.06 * (Math.sin(t * 1.3) > 0.4 ? 1 : 0); };
  return g;
}
function flood() {
  const g = new THREE.Group(); ground(g, 9); blocks(g, 4.5, 5, [4, 8]);
  const water = add(g, new THREE.CylinderGeometry(9, 9, 2.2, 32), std('#5c4a30', { transparent: true, opacity: 0.85, roughness: 0.2 }), 0, 1.1, 0); water.castShadow = false;
  const car = add(g, new THREE.BoxGeometry(1.9, 1.2, 4), std('#2f4566'), 1.5, 2.2, 2); car.rotation.set(0.15, 0.6, 0.1);
  let t = 0; g.userData.tick = (dt) => { t += dt; car.position.y = 2.2 + Math.sin(t * 1.6) * 0.15; car.rotation.z = Math.sin(t * 1.3) * 0.1; };
  return g;
}
function lava() {
  const g = new THREE.Group(); ground(g, 9, '#7a6a52'); blocks(g, 7, 4, [3, 6]);
  const blobs = []; for (let i = 0; i < 9; i++) { const a = i * 0.9, r = (i % 3) * 1.6; const m = add(g, new THREE.SphereGeometry(1.4 + (i % 3) * 0.4, 14, 8), glow(2.4, 0.7, 0.12), Math.cos(a) * r - 1, 0.2, Math.sin(a) * r); m.scale.y = 0.3; m.castShadow = false; blobs.push(m); }
  for (let i = 0; i < 6; i++) { const m = add(g, new THREE.BoxGeometry(0.9, 0.3, 0.7), std('#2a2420'), Math.cos(i) * 2, 0.45, Math.sin(i * 1.7) * 2); m.rotation.y = i; } // cooled crust floating on it
  let t = 0; g.userData.tick = (dt) => { t += dt; blobs.forEach((b, i) => b.material.color.setRGB(2.0 + Math.sin(t * 3 + i) * 0.5, 0.65, 0.12)); };
  return g;
}
function haboob() {
  const g = new THREE.Group(); ground(g, 10, '#c4a878'); blocks(g, 5, 4, [3, 6]);
  const wall = new THREE.Group(); wall.position.set(-4, 0, 0); g.add(wall);
  for (let i = 0; i < 9; i++) { const m = add(wall, new THREE.SphereGeometry(3.2 + (i % 3), 14, 10), std('#a8885a', { transparent: true, opacity: 0.9 }), -1 + (i % 2) * 1.5, 3 + (i % 3) * 3.2, -8 + i * 2); m.castShadow = false; }
  let t = 0; g.userData.tick = (dt) => { t += dt; wall.position.x = -4 + Math.sin(t * 0.7) * 1.5; wall.children.forEach((c, i) => c.scale.setScalar(1 + Math.sin(t * 1.5 + i) * 0.06)); };
  return g;
}
function blizzard() {
  const g = new THREE.Group(); ground(g, 9, '#e8eef2'); blocks(g, 5.5, 5, [3, 7]);
  g.children.forEach(c => { if (c.geometry && c.geometry.type === 'BoxGeometry') c.material.color.lerp(new THREE.Color('#eef4f9'), 0.6); }); // frosted over
  const n = 260, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) pos.set([(Math.random() - 0.5) * 16, Math.random() * 14, (Math.random() - 0.5) * 16], i * 3);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: '#ffffff', size: 0.14 })));
  g.userData.tick = (dt) => { for (let i = 0; i < n; i++) { pos[i * 3 + 1] -= dt * 3; pos[i * 3] += dt * 1.5; if (pos[i * 3 + 1] < 0) { pos[i * 3 + 1] = 14; pos[i * 3] = (Math.random() - 0.5) * 16; } } geo.attributes.position.needsUpdate = true; };
  return g;
}
function solar() {
  const g = new THREE.Group(); ground(g, 9, '#5a5248'); blocks(g, 6, 5, [3, 7]);
  const arc = new THREE.CatmullRomCurve3([new THREE.Vector3(-5, 0, -1), new THREE.Vector3(-2, 9, 1), new THREE.Vector3(2, 10, -1), new THREE.Vector3(5, 0, 1)]);
  const bolt = add(g, new THREE.TubeGeometry(arc, 40, 0.25, 5), glow(1.4, 2.6, 3.6)); bolt.castShadow = false;
  const halo = add(g, new THREE.TubeGeometry(arc, 40, 0.9, 6), glow(0.4, 0.9, 1.6, { transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })); halo.castShadow = false;
  let t = 0; g.userData.tick = (dt) => { t += dt; bolt.visible = halo.visible = Math.sin(t * 13) + Math.sin(t * 7.3) > -0.6; };
  return g;
}
function meltdown() {
  const g = new THREE.Group(); ground(g, 10, '#8a8270');
  const prof = []; for (let i = 0; i <= 10; i++) { const t = i / 10; prof.push(new THREE.Vector2(4.2 - Math.sin(t * Math.PI) * 1.6 - t * 0.8, t * 13)); }
  add(g, new THREE.LatheGeometry(prof, 28), std('#bdb6a8', { side: THREE.DoubleSide }), -2, 0, 0); // the cooling tower
  add(g, new THREE.SphereGeometry(2.4, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), std('#d8d2c4'), 4, 0, 2);
  const cloud = []; for (let i = 0; i < 5; i++) cloud.push(add(g, new THREE.SphereGeometry(2.2 + i * 0.4, 12, 8), glow(0.6, 1.6, 0.45, { transparent: true, opacity: 0.5, depthWrite: false }), -2 + (i % 2) * 1.4, 14 + i * 1.6, (i % 3) - 1));
  let t = 0; g.userData.tick = (dt) => { t += dt; cloud.forEach((c, i) => { c.position.y = 14 + ((t * 1.1 + i * 1.6) % 8); c.material.opacity = 0.55 - ((t * 1.1 + i * 1.6) % 8) / 18; }); };
  return g;
}

// name, model, how much of it the camera should frame
export function disasterExamples() {
  return [
    ['Tornado', tornado(), 17], ['Earthquake', quake(), 10], ['Flood', flood(), 10], ['Tsunami', tsunami(), 15], ['Sinkhole', sinkhole(), 12],
    ['Meteor', meteor(), 17], ['Volcano', volcano(), 16], ['Lava', lava(), 10], ['Dust storm', haboob(), 16], ['Cold wave', blizzard(), 10],
    ['Solar flare', solar(), 11], ['Alien saucer', saucer(), 13], ['Alien tripod', tripod(), 27], ['Black hole', blackhole(), 12],
    ['Nuclear attack', nuke(), 19], ['Plant meltdown', meltdown(), 20], ['Giant worm', worm(), 42], ['Kaiju', kaiju(), 62],
  ];
}
