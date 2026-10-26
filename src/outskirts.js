// The land around the city: desert dunes and mesas to the east, pine forest
// on rolling hills to the west, mountains with snowy peaks to the north and a
// beach with the ocean to the south. Highways run out of the city, and a
// nuclear power plant stands on the coast with its cooling towers steaming.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const hash2 = (i, j) => { let h = Math.imul(i, 374761393) + Math.imul(j, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
const vnoise = (x, z) => {
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash2(i, j), b = hash2(i + 1, j), c = hash2(i, j + 1), d = hash2(i + 1, j + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
const fbm = (x, z, o = 4) => { let s = 0, a = 0.5, f = 1; for (let k = 0; k < o; k++) { s += a * vnoise(x * f, z * f); f *= 2.03; a *= 0.5; } return s; };
const ridge = (x, z) => { let s = 0, a = 0.5, f = 1; for (let k = 0; k < 5; k++) { const n = 1 - Math.abs(vnoise(x * f + 7.3, z * f - 2.1) * 2 - 1); s += a * n * n; f *= 2.1; a *= 0.5; } return s; };
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

const SEA_VS = /* glsl */`
varying vec3 vW;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const SEA_FS = /* glsl */`
uniform float uTime, uShore, uLight, uSunI, uFogDensity; uniform vec3 uSunDir, uFogColor, uSky;
varying vec3 vW;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), u.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), u.x), u.y); }
float fb(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * n2(p); p = p * 2.03 + 17.1; a *= 0.5; } return v; }
void main() {
  vec2 p = vW.xz * 0.03;
  float a = fb(p + vec2(uTime * 0.04, uTime * 0.02)), b = fb(p * 2.6 - vec2(uTime * 0.07, -uTime * 0.05));
  vec3 N = normalize(vec3((a - 0.5) * 0.6, 1.0, (b - 0.5) * 0.6)), V = normalize(cameraPosition - vW);
  float fres = pow(1.0 - max(0.0, dot(N, V)), 3.0);
  float depth = clamp((vW.z - uShore) / 260.0, 0.0, 1.0);
  vec3 col = mix(vec3(0.12, 0.32, 0.32), vec3(0.03, 0.1, 0.14), depth) * uLight;
  col = mix(col, uSky * 0.8, 0.12 + fres * 0.5);
  col += pow(max(0.0, dot(N, normalize(uSunDir + V))), 80.0) * 0.7 * uSunI;
  // surf: lines of white water rolling in onto the beach
  float d = vW.z - uShore, surf = smoothstep(0.55, 0.85, sin(d * 0.25 + uTime * 1.6 + fb(vW.xz * 0.02) * 6.0)) * smoothstep(70.0, 4.0, d);
  col = mix(col, vec3(0.88, 0.9, 0.88) * uLight, clamp(surf * (0.5 + b) + smoothstep(6.0, 0.0, d) * 0.6, 0.0, 1.0));
  float dist = length(cameraPosition - vW);
  col = mix(col, uFogColor, (1.0 - exp(-pow(dist * uFogDensity, 2.0))) * 0.85);
  gl_FragColor = vec4(col, 1.0);
}`;

export function buildOutskirts(scene, city, opts = {}) {
  const B = city.bounds, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2, M = 30, low = !!opts.low;
  const group = new THREE.Group();
  // where things are: highways out of the middle of the west, north and east edges; the plant on the coast
  const roads = [{ axis: 'x', at: city.sz[Math.floor(city.NB / 2)], from: B.x0, dir: -1 }, { axis: 'x', at: city.sz[Math.floor(city.NB / 2)], from: B.x1, dir: 1 }, { axis: 'z', at: city.sx[Math.floor(city.NB / 2)], from: B.z0, dir: -1 }];
  const plant = { x: B.x0 + (B.x1 - B.x0) * 0.22, z: B.z1 + 165 };
  const weights = (x, z) => {
    const th = Math.atan2(z - cz, x - cx), w = [Math.cos(th), Math.cos(th - Math.PI / 2), Math.cos(th + Math.PI / 2), Math.cos(th - Math.PI)].map(c => Math.pow(Math.max(0, c), 3) + 1e-4);
    const s = w[0] + w[1] + w[2] + w[3]; return w.map(v => v / s); // east desert, south beach, north mountains, west forest
  };
  const outside = (x, z) => Math.hypot(Math.max(B.x0 - M - x, 0, x - B.x1 - M), Math.max(B.z0 - M - z, 0, z - B.z1 - M));
  const heightAt = (x, z) => {
    const d = outside(x, z);
    if (d <= 0) return -0.4;
    const [we, ws, wn, ww] = weights(x, z);
    const dune = Math.pow(0.5 + 0.5 * Math.sin(x * 0.035 + z * 0.012 + fbm(x * 0.004, z * 0.004) * 9), 2);
    const desert = 6 * dune * sm(0, 90, d) + 75 * sm(500, 1100, d) * Math.pow(fbm(x * 0.003, z * 0.003), 3) * 4;
    const forest = 20 * fbm(x * 0.005, z * 0.005) * sm(0, 220, d) + 150 * sm(650, 1300, d) * ridge(x * 0.002, z * 0.002);
    const mount = sm(40, 650, d) * (40 + 260 * ridge(x * 0.0026, z * 0.0026)) + 6 * fbm(x * 0.03, z * 0.03) * sm(0, 60, d);
    const beach = -d * 0.032 - 8 * sm(150, 700, d);
    let hgt = we * desert + ws * beach + wn * mount + ww * forest;
    for (const r of roads) { // highways cut a flat way through
      const off = r.axis === 'x' ? Math.abs(z - r.at) : Math.abs(x - r.at), along = r.axis === 'x' ? (x - r.from) * r.dir : (z - r.from) * r.dir;
      if (along > -10) hgt = hgt * (0.15 + 0.85 * sm(10, 40, off)) + 0.4 * (1 - sm(10, 40, off));
    }
    const dp = Math.hypot(x - plant.x, z - plant.z); hgt = hgt * sm(95, 150, dp) + 0.5 * (1 - sm(95, 150, dp)); // the plant's site
    return hgt * sm(0, 30, d) - 0.05 * (1 - sm(0, 30, d));
  };

  // ---- the ground
  const S = 3800, seg = low ? 150 : 210, geo = new THREE.PlaneGeometry(S, S, seg, seg); geo.rotateX(-Math.PI / 2); geo.translate(cx, 0, cz);
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color(), tmp = new THREE.Color();
  const SAND = new THREE.Color('#d8b882'), DUNE = new THREE.Color('#c79a62'), GRASS = new THREE.Color('#5d6a34'), FOREST = new THREE.Color('#3e4a26'), ROCK = new THREE.Color('#7d7064'), SNOW = new THREE.Color('#eef0f2'), BEACH = new THREE.Color('#e4d2a6'), WET = new THREE.Color('#a89470'), APRON = new THREE.Color('#bfae8e');
  for (let v = 0; v < pos.count; v++) {
    const x = pos.getX(v), z = pos.getZ(v), y = heightAt(x, z), d = outside(x, z), [we, ws, wn, ww] = weights(x, z), n = fbm(x * 0.02, z * 0.02);
    pos.setY(v, y);
    c.setRGB(0, 0, 0);
    const ripple = Math.pow(0.5 + 0.5 * Math.sin(x * 0.035 + z * 0.012 + fbm(x * 0.004, z * 0.004) * 9), 2);
    c.add(tmp.copy(SAND).lerp(DUNE, n * 0.5 + (1 - ripple) * 0.6).multiplyScalar(we));
    c.add(tmp.copy(y < 0.3 ? WET : BEACH).lerp(SAND, Math.min(1, Math.max(0, (y - 2) / 6))).multiplyScalar(ws));
    c.add(tmp.copy(GRASS).lerp(ROCK, sm(30, 110, y)).lerp(SNOW, sm(170, 215, y + n * 25)).multiplyScalar(wn));
    c.add(tmp.copy(FOREST).lerp(GRASS, n).lerp(ROCK, sm(90, 150, y)).multiplyScalar(ww));
    c.lerp(APRON, 1 - sm(4, 30, d)).multiplyScalar(0.85 + 0.3 * n);
    col[v * 3] = c.r; col[v * 3 + 1] = c.g; col[v * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
  const groundMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  const ground = new THREE.Mesh(geo, groundMat); ground.receiveShadow = true; group.add(ground);

  // ---- the ocean
  const shore = B.z1 + M + 38;
  const seaMat = new THREE.ShaderMaterial({ vertexShader: SEA_VS, fragmentShader: SEA_FS,
    uniforms: { uTime: { value: 0 }, uShore: { value: shore }, uLight: { value: 1 }, uSunI: { value: 1 }, uFogDensity: { value: 0.0006 }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uFogColor: { value: new THREE.Color() }, uSky: { value: new THREE.Color() } } });
  const seaGeo = new THREE.PlaneGeometry(S, S / 2, 1, 1); seaGeo.rotateX(-Math.PI / 2);
  const sea = new THREE.Mesh(seaGeo, seaMat); sea.position.set(cx, -1.2, shore + S / 4 - 30); group.add(sea);

  // ---- highways
  const roadMat = new THREE.MeshStandardMaterial({ color: '#8a8378', roughness: 0.95, side: THREE.DoubleSide });
  const roadGeos = [];
  for (const r of roads) {
    const L = 1500, n = 75, P = new Float32Array((n + 1) * 2 * 3), idx = [];
    for (let k = 0; k <= n; k++) {
      const a = r.from + r.dir * (k / n) * L;
      for (let sd = 0; sd < 2; sd++) {
        const o = (sd ? 1 : -1) * 6, x = r.axis === 'x' ? a : r.at + o, z = r.axis === 'x' ? r.at + o : a;
        P.set([x, Math.max(0.05, heightAt(x, z) + 0.12), z], (k * 2 + sd) * 3);
      }
      if (k < n) { const o = k * 2; idx.push(o, o + 2, o + 1, o + 1, o + 2, o + 3); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setIndex(idx); g.computeVertexNormals();
    roadGeos.push(g);
  }
  const roadsMesh = new THREE.Mesh(mergeGeometries(roadGeos), roadMat); roadsMesh.receiveShadow = true; group.add(roadsMesh);

  // ---- trees, cacti, rocks, palms
  const rand = (() => { let s = 1337; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; })();
  const near = (x, z) => roads.some(r => (r.axis === 'x' ? Math.abs(z - r.at) : Math.abs(x - r.at)) < 22 && (r.axis === 'x' ? (x - r.from) * r.dir : (z - r.from) * r.dir) > -10) || Math.hypot(x - plant.x, z - plant.z) < 140;
  const scatter = (count, test) => { const out = []; for (let n = 0; n < count * 12 && out.length < count; n++) { const x = cx + (rand() - 0.5) * S * 0.9, z = cz + (rand() - 0.5) * S * 0.9, d = outside(x, z); if (d < 25 || near(x, z)) continue; const y = heightAt(x, z), w = weights(x, z); if (test(d, y, w)) out.push([x, y, z]); } return out; };
  const pine = (() => {
    const t = new THREE.CylinderGeometry(0.25, 0.4, 2.4, 5).translate(0, 1.2, 0), a = new THREE.ConeGeometry(2.4, 4.2, 7).translate(0, 4.0, 0), b = new THREE.ConeGeometry(1.8, 3.4, 7).translate(0, 6.0, 0), cc = new THREE.ConeGeometry(1.1, 2.6, 7).translate(0, 7.8, 0);
    const paint = (g, hex) => { const k = new THREE.Color(hex), n = g.attributes.position.count, A = new Float32Array(n * 3); for (let i = 0; i < n; i++) A.set([k.r, k.g, k.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(A, 3)); return g; };
    return mergeGeometries([paint(t, '#5a4430'), paint(a, '#ffffff'), paint(b, '#ffffff'), paint(cc, '#ffffff')]);
  })();
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(), tc = new THREE.Color();
  const inst = (geo2, mat, list, scale, colorFn) => {
    const im = new THREE.InstancedMesh(geo2, mat, Math.max(1, list.length));
    list.forEach(([x, y, z], k) => { e.set(0, rand() * 6.28, 0); q.setFromEuler(e); const sc = scale(); m4.compose(p.set(x, y - 0.2, z), q, s.set(sc, sc * (0.85 + rand() * 0.3), sc)); im.setMatrixAt(k, m4); if (colorFn) im.setColorAt(k, colorFn(tc)); });
    im.castShadow = false; im.receiveShadow = false; im.computeBoundingSphere(); group.add(im); return im; // too many to draw again into the shadow map
  };
  const pines = scatter(low ? 2000 : 4200, (d, y, w) => ((w[3] > 0.4 && y < 130) || (w[2] > 0.35 && y > 8 && y < 120)) && rand() < 1.15 - d / 1000); // thicker close to town
  inst(pine, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), pines, () => 1.0 + rand() * 1.2, (k) => k.setHSL(0.25 + rand() * 0.06, 0.35, 0.18 + rand() * 0.08));
  const cactusG = mergeGeometries([new THREE.CylinderGeometry(0.35, 0.4, 4, 6).translate(0, 2, 0), new THREE.CylinderGeometry(0.22, 0.22, 1.6, 5).translate(0.8, 2.6, 0), new THREE.CylinderGeometry(0.22, 0.22, 0.7, 5).rotateZ(Math.PI / 2).translate(0.5, 1.9, 0), new THREE.CylinderGeometry(0.2, 0.2, 1.3, 5).translate(-0.7, 2.2, 0), new THREE.CylinderGeometry(0.2, 0.2, 0.55, 5).rotateZ(Math.PI / 2).translate(-0.42, 1.65, 0)]);
  inst(cactusG, new THREE.MeshStandardMaterial({ color: '#5e7a3a', roughness: 0.9 }), scatter(low ? 160 : 300, (d, y, w) => w[0] > 0.5 && d < 900), () => 0.8 + rand() * 0.8);
  inst(new THREE.DodecahedronGeometry(1.4, 0), new THREE.MeshStandardMaterial({ color: '#8a7a68', roughness: 1 }), scatter(low ? 200 : 380, (d, y, w) => (w[0] > 0.4 || w[2] > 0.4) && d < 1200), () => 0.6 + rand() * 2.4, (k) => k.setHSL(0.08, 0.15, 0.32 + rand() * 0.15));
  const palmG = (() => {
    const parts = [new THREE.CylinderGeometry(0.22, 0.32, 7, 6).translate(0, 3.5, 0)];
    for (let k = 0; k < 7; k++) { const leaf = new THREE.BoxGeometry(3.4, 0.08, 0.7).translate(1.7, 0, 0).rotateZ(-0.35).rotateY(k / 7 * Math.PI * 2).translate(0, 7, 0); parts.push(leaf); }
    return mergeGeometries(parts);
  })();
  inst(palmG, new THREE.MeshStandardMaterial({ color: '#6a7a3a', roughness: 0.9 }), scatter(60, (d, y, w) => w[1] > 0.6 && y > 0.6 && y < 2.5), () => 0.9 + rand() * 0.4);

  // ---- the nuclear power plant: two cooling towers, a reactor dome, a turbine hall and a stack
  const pg = new THREE.Group(); pg.position.set(plant.x, 0.5, plant.z);
  const concrete = new THREE.MeshStandardMaterial({ color: '#d4cdc0', roughness: 0.9 }), dark = new THREE.MeshStandardMaterial({ color: '#8a8478', roughness: 0.8 });
  const towerProfile = []; for (let k = 0; k <= 16; k++) { const t = k / 16, y = t * 72; towerProfile.push(new THREE.Vector2(15 - 7 * Math.sin(Math.min(1, t / 0.75) * Math.PI / 2) + (t > 0.75 ? (t - 0.75) * 10 : 0), y)); }
  const towerG = new THREE.LatheGeometry(towerProfile, 32);
  plant.towers = [[-42, -10], [-8, -32]].map(([ox, oz]) => { const m = new THREE.Mesh(towerG, new THREE.MeshStandardMaterial({ color: '#cfc8bb', roughness: 0.95, side: THREE.DoubleSide })); m.position.set(ox, 0, oz); m.castShadow = true; m.receiveShadow = true; pg.add(m); return { x: plant.x + ox, z: plant.z + oz, top: 72.5 }; });
  const dome = new THREE.Mesh(mergeGeometries([new THREE.CylinderGeometry(12, 12, 18, 28).translate(0, 9, 0), new THREE.SphereGeometry(12, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 18, 0)]), concrete);
  dome.position.set(28, 0, 6); dome.castShadow = true; pg.add(dome);
  const hall = new THREE.Mesh(new THREE.BoxGeometry(46, 16, 20).translate(0, 8, 0), dark); hall.position.set(30, 0, 34); hall.castShadow = true; pg.add(hall);
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.4, 70, 12).translate(0, 35, 0), new THREE.MeshStandardMaterial({ color: '#c8c0b4' })); stack.position.set(52, 0, 4); stack.castShadow = true; pg.add(stack);
  for (let k = 0; k < 3; k++) { const band = new THREE.Mesh(new THREE.CylinderGeometry(1.75 - k * 0.1, 1.85 - k * 0.1, 4, 12).translate(0, 50 + k * 8, 0), new THREE.MeshStandardMaterial({ color: '#b04030' })); band.position.copy(stack.position); pg.add(band); }
  const pad = new THREE.Mesh(new THREE.BoxGeometry(150, 0.6, 120).translate(10, -0.2, 0), new THREE.MeshStandardMaterial({ color: '#b8b0a2', roughness: 1 })); pad.receiveShadow = true; pg.add(pad);
  // warning lights (they flash in a meltdown)
  plant.lightMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 0.05, 0.03) });
  for (const [ox, oy, oz] of [[28, 31, 6], [52, 71, 4], [-42, 73, -10], [-8, 73, -32]]) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), plant.lightMat); l.position.set(ox, oy, oz); pg.add(l); }
  group.add(pg);
  plant.group = pg; plant.reactor = { x: plant.x + 28, z: plant.z + 6 };

  scene.add(group);
  return {
    group, heightAt, plant, roads, shore,
    update(t, scene2, sun, lightK, sunK) {
      const u = seaMat.uniforms; u.uTime.value = t; u.uLight.value = lightK; u.uSunI.value = sunK;
      u.uFogColor.value.copy(scene2.background); u.uSky.value.copy(scene2.background); u.uFogDensity.value = scene2.fog ? scene2.fog.density : 0.0006;
      u.uSunDir.value.copy(sun.position).sub(sun.target.position).normalize();
    },
    reset() { pg.visible = true; plant.lightMat.color.setRGB(0.3, 0.05, 0.03); },
    // steam rising from the cooling towers (fire.reset() clears it, so this runs after every reset)
    steam(fire) { if (!pg.visible) return; const t = fire.uniforms.uTime.value; plant.plumes = plant.towers.map(tw => fire.mist.alloc(26, tw.x, tw.top, tw.z, 7, 7, 3.4, t)); },
  };
}
