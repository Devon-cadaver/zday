// The world from orbit: a small planet - oceans, coasts, deserts, forests,
// mountains, ice at the poles, clouds drifting over it - with the big city and
// the towns on it as little clusters of buildings. The globe button opens it
// (the camera pulls back from where you are); drag to spin it, pinch to zoom,
// tap a place to fly down to it, and the page is built again around that place.
// The game waits while you are up here. Everything is made in code: the map is
// painted from noise on a sphere, so it has no seams and no poles pinching.
// Places that have taken damage smoke; meteors leave craters; the meteor button
// sends one down wherever you tap, and a direct hit on a town flies you down to
// watch it land. It is also the main menu's backdrop (turning slowly, the road
// through the towns drawn on it), where Sandbox picks its place and Commander and
// Be The Disaster turn to their next town and fly down to it.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PLACES, PATH, placeKey, travel } from './places.js';
import { townMask } from './shapes.js';
import { MATERIALS } from './city.js';
import { damageOf, craters, addCrater, sendMeteor } from './world.js';
import { sideButton } from './ui.js';
import { Sky } from './sky.js';

const R = 10;
// the places' character on the map: what each one wants to be next to
const WANTS = { kiyomura: 'forest', hoshimachi: 'coast', sakurazaka: 'forest', umihama: 'coast', minato: 'coast', takamori: 'grass', metro: 'city', bayview: 'city', harbor: 'coast', dust: 'desert', mesa: 'desert', sunvale: 'desert', pines: 'forest', lakeside: 'forest', northgate: 'forest', crossing: 'grass', ironside: 'grass' }; // city: deep in a big landmass that reaches the sea
// a place's wall colours, as its city builder leans them (an even mix, plus the place's tint)
function palette(P) {
  const w = { stone: 3, concrete: 3, brick: 3, white: 2, glass: 1 }, out = [];
  if (P.tint) for (const k in P.tint) w[k] = (w[k] || 0) + P.tint[k];
  for (const k in w) if (MATERIALS[k]) for (let n = 0; n < Math.round(w[k]); n++) out.push(MATERIALS[k][n % MATERIALS[k].length]);
  return out;
}
const BIOME = { OCEAN: 0, COAST: 1, GRASS: 2, FOREST: 3, DESERT: 4, MOUNT: 5, ICE: 6 };

// ---------- noise on the sphere
const hash3 = (x, y, z) => { let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1440670441); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const l = (a, b, t) => a + (b - a) * t, c = (i, j, k) => hash3(xi + i, yi + j, zi + k);
  return l(l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v), l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v), w);
}
function fbm(x, y, z, oct) { let s = 0, a = 0.5, f = 1, n = 0; for (let o = 0; o < oct; o++) { s += a * vnoise(x * f, y * f, z * f); n += a; a *= 0.5; f *= 2.03; } return s / n; }

// the Far Isles: an arc of islands on the far side of the world (the eastern towns), drawn over whatever the noise
// made there with a strait all round them, a lone snowy peak on the biggest. [lat, lon] along the arc
const ISLES = [[0.86, -1.5], [0.7, -1.58], [0.55, -1.66], [0.42, -1.77], [0.31, -1.9], [0.22, -2.05]], PEAK = [0.47, -1.74];
// where each place goes: near its spot [lat, lon], on the land there that suits it best - one or two to each continent
// (Sean: cover more of the planet). The road (PATH) tours the west from the south-west continent, the north lands, the
// desert continents and the south, round to the capital's island, then over the ocean to the Far East: the Far Isles
// and the great continent beside them. A place with no spot: somewhere in the band that faces you at first
const SPOT = {
  mesa: [-0.02, -1.4], pines: [-0.55, -1.25], crossing: [0.85, -0.2], northgate: [0.9, 0.35], dust: [0.38, 0.66], lakeside: [0.62, 0.95],
  harbor: [0.3, 1.2], sunvale: [0.15, 1.65], ironside: [-0.72, 1.55], bayview: [-0.214, -0.029], metro: [0.099, 0.302],
  sakurazaka: [0.3, -2.65], kiyomura: [0.6, -1.6], umihama: [0.27, -1.98], minato: [0.08, -2.15], takamori: [0.35, 2.75], hoshimachi: [0.4, -1.8],
};
const unit = (lat, lon) => [Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)]; // as paint() reads the noise
const ISLE_P = ISLES.map(([a, b]) => unit(a, b)), PEAK_P = unit(...PEAK), ISLE_C = unit(0.54, -1.72);
// how far (in radians, near enough) a point is from the arc, and how far along it (0 to 1)
function isleAt(x, y, z) {
  let bd = 1e9, bt = 0; const n = ISLE_P.length - 1;
  for (let k = 0; k < n; k++) {
    const a = ISLE_P[k], b = ISLE_P[k + 1], ex = b[0] - a[0], ey = b[1] - a[1], ez = b[2] - a[2];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * ex + (y - a[1]) * ey + (z - a[2]) * ez) / (ex * ex + ey * ey + ez * ez)));
    const d = Math.hypot(x - a[0] - ex * t, y - a[1] - ey * t, z - a[2] - ez * t);
    if (d < bd) { bd = d; bt = (k + t) / n; }
  }
  return [bd, bt];
}

// the map: colour, and what is where (for placing the towns)
function paint(W, H) {
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), img = g.createImageData(W, H), d = img.data, bio = new Uint8Array(W * H), hgt = new Float32Array(W * H);
  const col = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const DEEP = [26, 70, 104], SHALLOW = [58, 128, 150], SAND = [217, 199, 150], GRASS = [134, 160, 88], FOREST = [74, 104, 56], DESERT = [216, 180, 116], ROCK = [132, 118, 100], SNOW = [236, 240, 238];
  for (let y = 0; y < H; y++) {
    const lat = (0.5 - (y + 0.5) / H) * Math.PI, cl = Math.cos(lat), sl = Math.sin(lat), al = Math.abs(lat) * 180 / Math.PI;
    for (let x = 0; x < W; x++) {
      const lon = ((x + 0.5) / W) * Math.PI * 2 - Math.PI, px = cl * Math.cos(lon), py = sl, pz = cl * Math.sin(lon), i = y * W + x;
      let h = fbm(px * 1.7 + 11, py * 1.7, pz * 1.7, 5), m = fbm(px * 2.6 + 40, py * 2.6, pz * 2.6, 3), isle = 0; const sea = 0.5;
      const ss = (a, c, v) => { const t = Math.max(0, Math.min(1, (v - a) / (c - a))); return t * t * (3 - 2 * t); };
      if (px * ISLE_C[0] + py * ISLE_C[1] + pz * ISLE_C[2] > 0.8) { // near the Far Isles: green islands, never desert
        const [d, t] = isleAt(px, py, pz), hw = 0.048 + 0.055 * Math.sin(Math.PI * t) - 0.1 * (Math.exp(-(((t - 0.14) / 0.03) ** 2)) + Math.exp(-(((t - 0.74) / 0.03) ** 2))) + (fbm(px * 9 + 3, py * 9, pz * 9, 3) - 0.5) * 0.06; // two straits: three islands
        const pk = Math.hypot(px - PEAK_P[0], py - PEAK_P[1], pz - PEAK_P[2]);
        const want = Math.max(d < hw ? 0.512 + Math.min(0.11, (hw - d) * 1.5) : 0.5 + (hw - d) * 0.8, 0.8 - pk * 3.2);
        isle = 1 - ss(hw + 0.06, hw + 0.12, d); h += (want - h) * isle; m += (Math.max(m, 0.52) - m) * isle;
      }
      hgt[i] = h;
      let rgb, b;
      if (h < sea) { rgb = col(col(DEEP, SHALLOW, ss(sea - 0.08, sea, h)), SAND, ss(sea - 0.006, sea, h) * 0.6); b = BIOME.OCEAN; } // shallows paling into the beach
      else if (al > 68 + (m - 0.5) * 12) { rgb = SNOW; b = BIOME.ICE; }
      else if (h < sea + 0.012) { rgb = col(SAND, GRASS, ss(sea + 0.006, sea + 0.014, h) * 0.5); b = BIOME.COAST; }
      else if (h > 0.66) { rgb = col(ROCK, SNOW, Math.max(0, (h - 0.72) / 0.06)); b = BIOME.MOUNT; }
      else if (al < 34 && m < 0.5) { rgb = col(DESERT, SAND, Math.max(0, 0.42 - m) * 2); b = BIOME.DESERT; }
      else if (m > 0.53) { rgb = FOREST; b = BIOME.FOREST; }
      else { rgb = col(GRASS, FOREST, Math.max(0, m - 0.45) * 5); b = BIOME.GRASS; }
      if (isle > 0.5 && (b === BIOME.GRASS || b === BIOME.FOREST)) { const s = fbm(px * 30, py * 30, pz * 30, 2); if (s > 0.56) rgb = col(rgb, [226, 168, 186], Math.min(0.5, (s - 0.56) * 6)); } // cherry blossom
      const k = h < sea ? 1 : 0.86 + (h - sea) * 0.9 + (fbm(px * 14, py * 14, pz * 14, 2) - 0.5) * 0.16; // a little relief and grain on the land
      d[i * 4] = rgb[0] * k; d[i * 4 + 1] = rgb[1] * k; d[i * 4 + 2] = rgb[2] * k; d[i * 4 + 3] = 255; bio[i] = b;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return { t, bio, hgt, W, H };
}
function cloudTexture(W, H) {
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), img = g.createImageData(W, H), d = img.data;
  for (let y = 0; y < H; y++) {
    const lat = (0.5 - (y + 0.5) / H) * Math.PI, cl = Math.cos(lat), sl = Math.sin(lat);
    for (let x = 0; x < W; x++) {
      const lon = ((x + 0.5) / W) * Math.PI * 2 - Math.PI, px = cl * Math.cos(lon), pz = cl * Math.sin(lon), i = (y * W + x) * 4;
      const n = fbm(px * 3 + 70, sl * 3, pz * 3, 4), a = Math.max(0, Math.min(1, (n - 0.52) * 5));
      d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = a * 200;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const toLatLon = (p) => { const n = p.clone().normalize(); return [Math.asin(n.y), Math.atan2(-n.z, n.x)]; };
const toVec = (lat, lon, r = R) => new THREE.Vector3(Math.cos(lat) * Math.cos(lon) * r, Math.sin(lat) * r, -Math.cos(lat) * Math.sin(lon) * r); // as SphereGeometry wraps the map

export class Globe {
  constructor(renderer) {
    this.renderer = renderer; this.active = false; this.built = false; this.t = 0; this.fly = null;
    this.state = 'game'; this.status = null; this.arrive = null; this.shift = 0; this.shiftTo = 0; // game: opened from a place; menu: behind the menu; pick: choose a place; path: on the way to one
    this.button();
  }
  button() {
    const b = sideButton('zd-globe', 'The world'); b.textContent = '🌍'; b.style.fontSize = '19px';
    b.onclick = (e) => { e.stopPropagation(); if (this.up) this.up(); else this.open(); }; // up through the clouds
    this.btn = b;
  }
  // the planet, built the first time it is opened
  build() {
    this.built = true;
    const scene = this.scene = new THREE.Scene(); scene.background = new THREE.Color('#05070d');
    const cam = this.cam = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.1, 400);
    const low = innerWidth * devicePixelRatio < 1400, map = this.map = paint(low ? 768 : 1024, low ? 384 : 512);
    const sun = new THREE.DirectionalLight('#fff4e0', 2.6); sun.position.set(30, 18, 24); scene.add(sun, new THREE.HemisphereLight('#c8dcff', '#2a2420', 0.55));
    this.planet = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), new THREE.MeshStandardMaterial({ map: map.t, roughness: 0.85, metalness: 0 })); scene.add(this.planet);
    this.clouds = new THREE.Mesh(new THREE.SphereGeometry(R * 1.012, 64, 48), new THREE.MeshStandardMaterial({ map: cloudTexture(512, 256), transparent: true, depthWrite: false, roughness: 1 })); scene.add(this.clouds);
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.06, 64, 48), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide,
      vertexShader: 'varying vec3 vN, vV; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: 'varying vec3 vN, vV; void main() { float f = pow(1.0 - abs(dot(vN, vV)), 2.2); gl_FragColor = vec4(vec3(0.45, 0.7, 1.0) * f * 1.3, f); }' }));
    atmo.userData.flat = true; scene.add(atmo);
    // stars
    const sp = new Float32Array(1500 * 3); for (let i = 0; i < 1500; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(150 + Math.random() * 80); sp.set([v.x, v.y, v.z], i * 3); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: '#cfd8ff', size: 0.6, sizeAttenuation: true })));
    this.placeTowns();
    this.buildRoad();
    this.decorate();
    this.labels();
    this.controls = new OrbitControls(cam, this.renderer.domElement); this.controls.enablePan = false; this.controls.enableDamping = true; this.controls.dampingFactor = 0.08;
    this.controls.minDistance = R * 1.25; this.controls.maxDistance = Math.max(R * 5, this.fit() * 1.15); this.controls.rotateSpeed = 0.5; this.controls.enabled = false;
    this.ui();
  }
  // where each place sits: near its SPOT, the land there that suits it best (a coast for the big city and the harbour, the
  // desert, the forest). The same spots every time
  placeTowns() {
    const { bio, W, H } = this.map, keys = Object.keys(PLACES), taken = [];
    const at = (lat, lon) => { const x = Math.floor(((lon + Math.PI) / (Math.PI * 2)) * W) % W, y = Math.min(H - 1, Math.max(0, Math.floor((0.5 - lat / Math.PI) * H))); return bio[y * W + x]; };
    const near = (lat, lon, b, r) => { let n = 0; for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; if (at(lat + Math.cos(a) * r, lon + Math.sin(a) * r / Math.max(0.3, Math.cos(lat))) === b) n++; } return n; };
    let s = 12345; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    this.spots = {};
    for (const key of keys) {
      let best = null, bs = -1e9;
      for (let n = 0; n < 4000; n++) {
        const E = SPOT[key], lat = E ? E[0] + (rnd() - 0.5) * 0.24 : (rnd() - 0.5) * 1.1, lon = E ? E[1] + (rnd() - 0.5) * 0.3 : (rnd() - 0.5) * 2.0, b = at(lat, lon); // near its spot
        if (b === BIOME.OCEAN || b === BIOME.ICE) continue;
        const want = WANTS[key] || 'grass';
        const sea = (r) => near(lat, lon, BIOME.OCEAN, r);
        let sc = want === 'city' ? (sea(0.03) + sea(0.06) === 0 ? 10 : -20) + (sea(0.12) >= 2 && sea(0.12) <= 9 ? 8 : 0) + (b === BIOME.GRASS ? 3 : 0)
          : want === 'coast' ? (sea(0.022) === 0 ? 6 : -20) + Math.min(6, sea(0.05)) * 1.5 + (b === BIOME.GRASS || b === BIOME.COAST ? 2 : 0)
          : want === 'desert' ? (b === BIOME.DESERT ? 8 : 0) + near(lat, lon, BIOME.DESERT, 0.05) - sea(0.03) * 3
          : want === 'grass' ? (b === BIOME.GRASS ? 8 : 0) + near(lat, lon, BIOME.GRASS, 0.05) - sea(0.03) * 3
          : (b === BIOME.FOREST ? 8 : 0) + near(lat, lon, BIOME.FOREST, 0.05) - sea(0.03) * 3;
        if (E) sc -= Math.hypot(lat - E[0], lon - E[1]) * 30;
        for (const q of taken) { const dd = Math.acos(Math.min(1, Math.sin(lat) * Math.sin(q[0]) + Math.cos(lat) * Math.cos(q[0]) * Math.cos(lon - q[1]))); if (dd < 0.18) sc -= 100; else if (dd < 0.7) sc += 2; } // apart, but not too far
        if (sc > bs) { bs = sc; best = [lat, lon]; }
      }
      taken.push(best); this.spots[key] = best;
    }
    // each place in little, from its own street grid and outline (shapes.js): asphalt under the blocks inside the
    // outline, a pale pavement on each, four buildings a block in the place's own wall colours (taller towards the
    // middle of a city's downtowns, low and even in a town), its dome, stadium or tower near the middle
    const lots = [], pads = [], domes = [], rings = [];
    this.extent = {};
    for (const key of keys) {
      const P = PLACES[key], NB = Math.min(P.blocks ?? 12, 12), seed = P.seed ?? 20261025, mask = townMask(P.shape, NB, seed), [lat, lon] = this.spots[key];
      const c = toVec(lat, lon, 1).normalize(), east = new THREE.Vector3(0, 1, 0).cross(c).normalize(), south = east.clone().cross(c);
      const half = 0.045 * NB, pitch = half * 2 / NB, floors = P.maxFloors ?? 16, hmax = 0.021 * floors, cols = palette(P), basis = [east, c, south];
      let s2 = seed % 2147483646 + 1; const rr = () => (s2 = (s2 * 16807) % 2147483647) / 2147483647;
      const cen = []; for (let k = 0; k < (P.centers ?? 3); k++) cen.push([(rr() - 0.5) * (P.shape === 'twin' ? 1.4 : 0.9), (rr() - 0.5) * 0.9]);
      const at = (u, v, r0) => c.clone().multiplyScalar(R).addScaledVector(east, u * half).addScaledVector(south, v * half).normalize().multiplyScalar(r0);
      this.extent[key] = half;
      for (let i = 0; i < NB; i++) for (let j = 0; j < NB; j++) {
        if (!mask(i, j)) continue;
        const u = ((i + 0.5) / NB) * 2 - 1, v = ((j + 0.5) / NB) * 2 - 1;
        pads.push({ p: at(u, v, R * 0.9995), basis, w: pitch * 1.02, h: 0.003, col: '#5f5b55' }, { p: at(u, v, R * 0.9995), basis, w: pitch * 0.8, h: 0.006, col: '#b9b0a0' });
        let core = 0; for (const [cu, cv] of cen) core = Math.max(core, Math.exp(-((u - cu) ** 2 + (v - cv) ** 2) / 0.2));
        for (let q = 0; q < 4; q++) {
          const du = (q % 2 ? 0.19 : -0.19) * 2 / NB, dv = (q < 2 ? -0.19 : 0.19) * 2 / NB;
          const h = hmax * (floors > 8 ? 0.12 + 0.88 * core * (0.4 + rr() * 0.8) : 0.45 + rr() * 0.55);
          lots.push({ p: at(u + du, v + dv, R * 0.9995), basis, w: pitch * 0.33, h: Math.max(0.014, h), col: cols[Math.floor(rr() * cols.length)] });
        }
      }
      for (const lm of P.landmarks ?? ['spire', 'deco', 'dome', 'stadium']) { // near the middle
        const u = (rr() - 0.5) * 0.5, v = (rr() - 0.5) * 0.5, p = at(u, v, R * 1.0003);
        if (lm === 'dome') domes.push({ p, basis, w: pitch * 0.34, h: pitch * 0.34, col: '#ece4d2' });
        else if (lm === 'stadium') rings.push({ p, basis, w: pitch * 0.5, h: pitch * 0.5, col: '#cfc7b8' });
        else lots.push({ p, basis, w: pitch * 0.28, h: hmax * 1.3, col: '#ddd2bb' });
      }
    }
    const inst = (geo, list, rough) => {
      const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: rough }), list.length), m = new THREE.Matrix4(), sc = new THREE.Vector3(), col = new THREE.Color();
      list.forEach((o, k) => { m.makeBasis(...o.basis); m.scale(sc.set(o.w, o.h, o.w)); m.setPosition(o.p); im.setMatrixAt(k, m); im.setColorAt(k, col.set(o.col)); });
      this.scene.add(im); return im;
    };
    const box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    inst(box, pads, 0.95); this.towns = inst(box, lots, 0.7);
    if (domes.length) inst(new THREE.SphereGeometry(0.5, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), domes, 0.6);
    if (rings.length) inst(new THREE.TorusGeometry(0.42, 0.14, 4, 20).rotateX(Math.PI / 2).translate(0, 0.07, 0), rings, 0.8);
    this.here = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.7, 48), new THREE.MeshBasicMaterial({ color: '#ffe08a', transparent: true, side: THREE.DoubleSide, depthWrite: false })); // a ring round where you are
    this.scene.add(this.here); this.setHere();
  }
  // the road through the towns (PATH), along the surface from each to the next
  // the road drawn only as far as town n (the trail of the towns played so far: never where you are going); n < 1: no road
  buildRoad(n = -1) {
    if (this.road && this.roadN === n) return;
    if (this.road) { this.scene.remove(this.road); this.road.geometry.dispose(); }
    this.roadN = n; const vis = this.road ? this.road.visible : false;
    if (n < 1) { this.road = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial()); this.road.visible = false; this.road.userData.empty = true; this.scene.add(this.road); return; }
    const pts = [];
    for (let i = 0; i + 1 <= n && i + 1 < PATH.length; i++) {
      const a = toVec(...this.spots[PATH[i]], 1).normalize(), b = toVec(...this.spots[PATH[i + 1]], 1).normalize(), ang = a.angleTo(b), n = Math.max(4, Math.ceil(ang * 40));
      for (let k = i ? 1 : 0; k <= n; k++) { const t = k / n, s = Math.sin(ang); pts.push(a.clone().multiplyScalar(Math.sin((1 - t) * ang) / s).addScaledVector(b, Math.sin(t * ang) / s).multiplyScalar(R * 1.004)); }
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    this.road = new THREE.Mesh(new THREE.TubeGeometry(curve, pts.length * 2, 0.017, 5, false), new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0.6, depthWrite: false }));
    this.road.visible = vis; this.scene.add(this.road);
  }
  // the trail for a mode (or for either, on the menu), shown or not
  showRoad(on, mode) { this.buildRoad(this.trail ? this.trail(mode) : -1); this.road.visible = !!on && !this.road.userData.empty; }
  // the ring round where you are (again after moving to another place in this page)
  setHere() {
    if (!this.here) return;
    const hs = this.spots[placeKey()], hp = toVec(hs[0], hs[1], R * 1.003); this.here.position.copy(hp); this.here.lookAt(hp.clone().multiplyScalar(2)); this.here.scale.setScalar(this.extent[placeKey()] * 1.6 / 0.66);
  }
  // the marks the world carries: craters (glowing a while when fresh), smoke over places that have taken damage
  decorate() {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    this.puff = new THREE.CanvasTexture(c);
    this.craterMat = new THREE.MeshBasicMaterial({ color: '#2a2018', transparent: true, opacity: 0.85, depthWrite: false });
    this.craterGeo = new THREE.CircleGeometry(1, 24);
    this.marks = [];
    for (const [lat, lon, size, when] of craters()) this.crater(lat, lon, size, when);
    this.smoke = [];
    for (const key in PLACES) {
      const n = damageOf(key).length; if (n < 3 || !this.spots[key]) continue;
      const [lat, lon] = this.spots[key], base = toVec(lat, lon, R), k = Math.min(1, n / 40);
      for (let i = 0; i < 5; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.puff, color: '#5a5550', transparent: true, depthWrite: false })); this.scene.add(s); this.smoke.push({ s, base, nrm: base.clone().normalize(), ph: i / 5, k }); }
    }
  }
  crater(lat, lon, size, when = Date.now()) {
    const p = toVec(lat, lon, R * 1.0015), m = new THREE.Mesh(this.craterGeo, this.craterMat); m.position.copy(p); m.lookAt(p.clone().multiplyScalar(2)); m.scale.setScalar(size);
    const glow = new THREE.Mesh(this.craterGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.2, 0.3), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); glow.position.copy(p.clone().multiplyScalar(1.0004)); glow.lookAt(p.clone().multiplyScalar(2)); glow.scale.setScalar(size * 0.6);
    this.scene.add(m, glow); this.marks.push({ glow, when });
  }
  // a meteor from deep space onto the point p on the planet
  strike(p) {
    const n = p.clone().normalize(), side = new THREE.Vector3(0, 1, 0).cross(n).normalize(), from = n.clone().multiplyScalar(R * 2.8).addScaledVector(side, R * 1.4);
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.5, 0.5) }));
    this.scene.add(rock); this.met = { rock, from, to: n.clone().multiplyScalar(R * 1.002), n, t: 0, trailT: 0, trail: [] };
    this.armed = false; this.metBtn.classList.remove('on');
  }
  impact(M) {
    const [lat, lon] = toLatLon(M.to); this.scene.remove(M.rock);
    this.flash = { s: new THREE.Sprite(new THREE.SpriteMaterial({ map: this.puff, color: new THREE.Color(4, 2.6, 1.2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })), t: 0 };
    this.flash.s.position.copy(M.to); this.scene.add(this.flash.s);
    this.ring = { m: new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), new THREE.MeshBasicMaterial({ color: '#ffe2b0', transparent: true, side: THREE.DoubleSide, depthWrite: false })), t: 0 };
    this.ring.m.position.copy(M.to.clone().multiplyScalar(1.001)); this.ring.m.lookAt(M.to.clone().multiplyScalar(2)); this.scene.add(this.ring.m);
    addCrater(lat, lon, 0.28); this.crater(lat, lon, 0.28);
    // a town under it: it is coming down on them; fly down to watch
    let hit = null, hd = 0.1;
    for (const key in this.spots) { const [la, lo] = this.spots[key], d = Math.acos(Math.min(1, Math.sin(lat) * Math.sin(la) + Math.cos(lat) * Math.cos(la) * Math.cos(lon - lo))); if (d < hd) { hd = d; hit = key; } }
    if (hit) {
      const [la, lo] = this.spots[hit], S = 4500; // radians on the globe to metres in the place
      sendMeteor(hit, { x: (lon - lo) * Math.cos(la) * S, z: -(lat - la) * S, size: 34 });
      this.say('Direct hit on ' + PLACES[hit].name + '! Flying down to watch it land');
      setTimeout(() => { if (this.active) this.go(hit); }, 2200);
    } else this.say('The meteor hit open ground. Tap the meteor button to send another');
  }
  say(text) { this.sub.textContent = text; }
  labels() {
    this.tags = {};
    for (const key in PLACES) {
      const d = document.createElement('button'); d.type = 'button'; d.className = 'zd-place'; d.textContent = PLACES[key].name + (key === placeKey() ? ' · here' : '');
      d.style.cssText = 'position:fixed;left:0;top:0;z-index:41;transform:translate(-50%,-150%);padding:5px 10px;border-radius:12px;border:1px solid rgba(255,255,255,0.25);background:rgba(18,16,14,0.78);color:#f6eedc;font:600 12px system-ui,sans-serif;white-space:nowrap;cursor:pointer;display:none';
      d.onclick = (e) => { e.stopPropagation(); if (this.state !== 'menu') this.go(key); };
      document.body.appendChild(d); this.tags[key] = d;
    }
  }
  // what each label says: the name (with the road's number, a tick for the towns won and a lock on those not open yet
  // in Commander and Be The Disaster), dimmed when locked; behind the menu they are only names
  relabel() {
    for (const key in this.tags) {
      const d = this.tags[key], s = this.status && this.state !== 'menu' ? this.status(key) : null;
      d.textContent = (s ? s.text : PLACES[key].name) + (this.state === 'game' && key === placeKey() ? ' · here' : ''); d._w = 0; // measured again
      d.style.opacity = s && s.locked ? '0.55' : this.state === 'menu' ? '0.85' : '1';
      d.style.pointerEvents = this.state === 'menu' ? 'none' : '';
      d.style.fontSize = this.state === 'menu' ? '11px' : '12px'; d.style.zIndex = this.state === 'menu' ? '5' : '41'; // under the menu card
    }
  }
  ui() {
    const u = this.uiEl = document.createElement('div');
    u.style.cssText = 'position:fixed;left:0;right:0;top:14px;z-index:41;text-align:center;color:#f6eedc;font:700 15px system-ui,sans-serif;letter-spacing:0.12em;pointer-events:none;display:none';
    u.innerHTML = 'THE WORLD<div style="font:500 12px system-ui,sans-serif;letter-spacing:0;opacity:0.75;margin-top:4px">Spin it, tap a town to go there</div>';
    this.sub = u.querySelector('div');
    const met = this.metBtn = document.createElement('button'); met.type = 'button'; met.className = 'zd-btn'; met.textContent = '☄ Send a meteor';
    met.style.cssText = 'position:fixed;left:50%;bottom:70px;transform:translateX(-50%);z-index:41;display:none';
    met.onclick = (e) => { e.stopPropagation(); this.armed = !this.armed; met.classList.toggle('on', this.armed); this.say(this.armed ? 'Tap the planet where it should hit' : 'Spin it, tap a town to go there'); };
    document.body.appendChild(met);
    // a tap on the planet while the meteor is armed: that is where it hits
    const dom = this.renderer.domElement, ray = new THREE.Raycaster(); let down = null;
    dom.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
    dom.addEventListener('pointerup', (e) => {
      if (!this.active || !this.armed || this.met || !down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 10) return;
      ray.setFromCamera(new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), this.cam);
      const h = ray.intersectObject(this.planet)[0]; if (h) this.strike(h.point);
    });
    const back = this.backBtn = document.createElement('button'); back.type = 'button'; back.className = 'zd-btn'; back.textContent = 'Back to ' + PLACES[placeKey()].name;
    back.style.cssText = 'position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:41;display:none';
    back.onclick = (e) => { e.stopPropagation(); if (this.state === 'pick' && this.onBack) this.onBack(); else this.go(placeKey()); };
    document.body.appendChild(u); document.body.appendChild(back);
  }
  // up from where you are: the game waits, the camera pulls back off the city out to the whole planet
  open(opts = {}) {
    if (this.active) return;
    if (!this.built) this.build();
    this.active = true; this.fly = null; this.state = 'game'; this.arrive = null; this.shiftTo = 0;
    this.status = this.statusFor ? this.statusFor() : null; this.showRoad(!!this.status, this.mode ? this.mode() : null); this.here.visible = true; this.relabel();
    this.uiEl.firstChild.textContent = 'THE WORLD'; this.say('Spin it, tap a town to go there'); this.backBtn.textContent = 'Back to ' + PLACES[placeKey()].name;
    const [lat, lon] = this.spots[placeKey()], p = toVec(lat, lon, 1).normalize();
    const r0 = opts.clouds ? R * 1.07 : R * 1.15; // out of the clouds: from just over the place
    this.cam.position.copy(p).multiplyScalar(r0); this.cam.lookAt(0, 0, 0); this.controls.target.set(0, 0, 0); this.controls.update();
    this.rise = { t: 0, dur: opts.clouds ? 2.1 : 1.6, from: r0, to: Math.max(R * 3.2, this.fit() * 0.8), dir: p.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.25).add(new THREE.Vector3(0, 0.25, 0)).normalize() };
    if (opts.clouds && this.sky) this.sky.to(0, 1.0);
    this.controls.enabled = true;
    document.body.classList.add('zd-globe-on'); this.toggleHud(false);
    this.uiEl.style.display = ''; this.backBtn.style.display = ''; this.metBtn.style.display = '';
    if (this.onOpen) this.onOpen();
  }
  close() {
    this.active = false; this.controls.enabled = false; this.controls.autoRotate = false; this.state = 'game'; this.arrive = null; this.turn = null; this.toggleHud(true);
    this.shift = this.shiftTo = 0; this.cam.clearViewOffset(); document.body.classList.remove('zd-globe-on');
    if (this.sky && this.sky.want >= 1) this.sky.down(); // back down to the streets out of the clouds
    this.uiEl.style.display = 'none'; this.backBtn.style.display = 'none'; this.metBtn.style.display = 'none'; this.armed = false; for (const k in this.tags) this.tags[k].style.display = 'none';
    if (this.onArrive) this.onArrive();
  }
  // behind the main menu: the planet turning slowly, the places on it and the road between them
  backdrop(names = true) {
    if (!this.built) this.build();
    this.quiet = !names;
    const was = this.active;
    this.active = true; this.state = 'menu'; this.status = null; this.arrive = null; this.fly = this.rise = this.turn = null; this.armed = false;
    this.uiEl.style.display = 'none'; this.backBtn.style.display = 'none'; this.metBtn.style.display = 'none';
    this.here.visible = false; this.showRoad(true, null); this.relabel(); // the menu: the trail of the towns played in either mode
    if (!was) { // looking at the middle of the road, from a little above
      const [lat, lon] = this.spots[placeKey()]; // over where you are (the rest comes round as it turns) this.cam.position.copy(toVec(Math.min(1.1, lat + 0.35), lon, this.fit())); this.cam.lookAt(0, 0, 0); this.controls.target.set(0, 0, 0);
    }
    this.controls.maxDistance = Math.max(R * 5, this.fit() * 1.15);
    this.controls.enabled = true; this.controls.autoRotate = true; this.controls.autoRotateSpeed = 0.45; this.controls.update();
    this.shiftTo = innerHeight > innerWidth ? 0.14 : 0.08; // the planet sits above the menu
    document.body.classList.add('zd-globe-on');
  }
  // the menu reached up through the clouds from a town: start just over that town and pull back to where the menu looks from
  pullBack(key) {
    const sp = this.spots && this.spots[key]; if (!sp) return;
    const to = this.cam.position.clone(), p = toVec(sp[0], sp[1], 1).normalize();
    this.cam.position.copy(p).multiplyScalar(R * 1.07); this.cam.lookAt(0, 0, 0);
    this.rise = { t: 0, dur: 2.4, from: R * 1.07, to: to.length(), dir: to.normalize() };
  }
  // far enough back that the whole planet fits across the screen (a phone held upright sees a narrow slice)
  fit() { const half = Math.min(16, Math.atan(Math.tan(16 * Math.PI / 180) * innerWidth / innerHeight) * 180 / Math.PI) * Math.PI / 180; return Math.max(R * 3.2, R / Math.sin(half * 0.97)); }
  // from the menu: pick a place (Sandbox: opts.arrive(key) once flown down; opts.back for the Back button), or head for
  // one (opts.key: turn to it, then fly down). opts.status labels the places (and locks some), opts.road shows the road
  choose(opts) {
    if (!this.built) this.build();
    this.active = true; this.state = opts.key ? 'path' : 'pick'; this.status = opts.status || null; this.arrive = opts.arrive; this.onBack = opts.back;
    this.controls.autoRotate = false; this.controls.enabled = !opts.key; this.shiftTo = 0; this.showRoad(!!opts.road, opts.mode || null); this.relabel();
    this.uiEl.firstChild.textContent = opts.title || ''; this.say(opts.sub || ''); this.uiEl.style.display = '';
    this.metBtn.style.display = 'none'; this.backBtn.textContent = 'Back'; this.backBtn.style.display = opts.back ? '' : 'none';
    if (opts.key) this.turn = { t: 0, key: opts.key, r: Math.min(this.cam.position.length(), R * 3), to: toVec(...this.spots[opts.key], 1).normalize() };
  }
  toggleHud(on) { for (const el of document.querySelectorAll('#zd-top, #zd-bar, #zd-dis, #zd-toast, #zd-end, #zd-menu, #zd-compass, #zd-pause, #zd-paused, #zd-flash')) el.style.visibility = on ? '' : 'hidden'; }
  // down to a place: fly in over it; back where you were, the city is still there; anywhere else is built afresh
  go(key) {
    if (this.fly) return;
    const s = this.status && this.status(key);
    if (s && s.locked) { this.say(s.why || 'That town is not open yet'); return; }
    this.turn = null; this.metBtn.style.display = this.backBtn.style.display = 'none'; this.armed = false;
    const [lat, lon] = this.spots[key];
    this.fly = { t: 0, key, from: this.cam.position.clone(), to: toVec(lat, lon, R * 1.05) }; // down into the clouds over it
    this.controls.enabled = false;
  }
  frame(dt) {
    this.t += dt;
    this.clouds.rotation.y += dt * 0.012;
    this.here.material.opacity = (0.55 + 0.45 * Math.sin(this.t * 3)) * (this.rise ? Math.max(0, Math.min(1, this.rise.t / this.rise.dur * 2 - 0.6)) : 1);
    for (const S of this.smoke) { const k = (this.t * 0.25 + S.ph) % 1; S.s.position.copy(S.base).addScaledVector(S.nrm, 0.1 + k * 1.4 * S.k); S.s.scale.setScalar((0.25 + k * 0.9) * (0.5 + S.k)); S.s.material.opacity = (1 - k) * 0.7; }
    for (const M of this.marks) M.glow.material.opacity = Math.max(0, 1 - (Date.now() - M.when) / 60000) * (0.7 + 0.3 * Math.sin(this.t * 7));
    if (this.met) { // on its way in, a burning trail behind it
      const M = this.met; M.t += dt; const k = Math.min(1, M.t / 1.7), e = k * k; M.rock.position.lerpVectors(M.from, M.to, e);
      if ((M.trailT -= dt) <= 0) { M.trailT = 0.025; const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.puff, color: new THREE.Color(2.4, 1.1, 0.4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.position.copy(M.rock.position); s.scale.setScalar(0.5); this.scene.add(s); M.trail.push({ s, t: 0 }); }
      if (k >= 1) { this.impact(M); this.fade = M.trail; this.met = null; }
    }
    if (this.fade) { for (const f of this.fade) { f.t += dt; f.s.material.opacity = Math.max(0, 1 - f.t / 0.8); f.s.scale.setScalar(0.5 + f.t * 0.6); } if (this.fade.every(f => f.t > 0.8)) { for (const f of this.fade) this.scene.remove(f.s); this.fade = null; } }
    else if (this.met) for (const f of this.met.trail) { f.t += dt; f.s.material.opacity = Math.max(0, 1 - f.t / 0.8); }
    if (this.flash) { const F = this.flash; F.t += dt; F.s.scale.setScalar(0.3 + F.t * 6); F.s.material.opacity = Math.max(0, 1 - F.t / 0.9); if (F.t > 0.9) { this.scene.remove(F.s); this.flash = null; } }
    if (this.ring) { const G = this.ring; G.t += dt; G.m.scale.setScalar(0.1 + G.t * 1.8); G.m.material.opacity = Math.max(0, 1 - G.t / 1.2); if (G.t > 1.2) { this.scene.remove(G.m); this.ring = null; } }
    if (this.rise) { // pulling back off the city
      const R0 = this.rise; R0.t += dt; const k = Math.min(1, R0.t / (R0.dur || 1.6)), e = 1 - Math.pow(1 - k, 3), r = R0.from + (R0.to - R0.from) * e;
      const dir = this.cam.position.clone().normalize().lerp(R0.dir, Math.min(1, dt * 1.2)).normalize(); this.cam.position.copy(dir.multiplyScalar(r)); this.cam.lookAt(0, 0, 0);
      if (k >= 1) { this.rise = null; if (this.after) { const a = this.after; this.after = null; this.go(a); } } // on to the next town
    } else if (this.fly) { // flying down to a place
      const F = this.fly; F.t += dt; const k = Math.min(1, F.t / 1.6), e = k * k * (3 - 2 * k);
      if (k > 0.58 && this.sky && this.sky.want < 1) { this.sky.to(1, 0.62); this.sky.moving = 1; }
      const a = F.from.clone().normalize(), b = F.to.clone().normalize(), dir = a.lerp(b, e).normalize(), r = F.from.length() + (F.to.length() - F.from.length()) * e;
      this.cam.position.copy(dir.multiplyScalar(r)); this.cam.lookAt(0, 0, 0);
      if (k >= 1) {
        const key = F.key; this.fly = null;
        if (this.arrive) this.arrive(key); // the menu's modes: built here, or travelling (they call travelling)
        else if (key === placeKey()) this.close();
        else if (this.moveTo) this.moveTo(key); // built here, in this page: the sound carries on
        else { this.travelling(key); travel(key, new URLSearchParams(location.search).get('mode') || 'sandbox'); }
      }
    } else if (this.turn) { // turning the planet to the next town, then down to it
      const T = this.turn; T.t += dt; const k = Math.min(1, T.t / 1.3), dir = this.cam.position.clone().normalize().lerp(T.to, Math.min(1, dt * 3.2)).normalize();
      this.cam.position.copy(dir.multiplyScalar(this.cam.position.length() + (T.r - this.cam.position.length()) * Math.min(1, dt * 3))); this.cam.lookAt(0, 0, 0);
      if (k >= 1) { this.turn = null; this.go(T.key); }
    } else this.controls.update();
    // labels over the places on the side facing you; where two would overlap, the one nearer the middle of the view
    // shows (your own place and the one you are heading for first)
    const v = new THREE.Vector3(), camDir = this.cam.position.clone().normalize(), cand = [], placed = [];
    for (const key in this.tags) {
      const [lat, lon] = this.spots[key], p = toVec(lat, lon, R * 1.01), el = this.tags[key], dot = p.clone().normalize().dot(camDir);
      if (!this.active || this.leaving || (this.quiet && this.state === 'menu') || dot < 0.25 || this.fly || this.rise) { el.style.display = 'none'; continue; }
      v.copy(p).project(this.cam);
      cand.push({ el, x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, pri: dot + (key === placeKey() && this.state === 'game' ? 2 : 0) + (this.turn && this.turn.key === key ? 3 : 0) });
    }
    cand.sort((a, b) => b.pri - a.pri);
    for (const c of cand) {
      if (!c.el._w) { c.el.style.display = ''; c.el._w = c.el.offsetWidth || 90; }
      const r = { x0: c.x - c.el._w / 2 - 3, x1: c.x + c.el._w / 2 + 3, y0: c.y - 42, y1: c.y - 12 };
      if (placed.some(q => r.x0 < q.x1 && r.x1 > q.x0 && r.y0 < q.y1 && r.y1 > q.y0)) { c.el.style.display = 'none'; continue; }
      placed.push(r); c.el.style.display = ''; c.el.style.left = c.x + 'px'; c.el.style.top = c.y + 'px';
    }
    if (this.state === 'menu' && this.onFacing && (this.faceT = (this.faceT || 0) - dt) <= 0) { // the town nearest the middle of the view (the menu's song follows its side of the world)
      this.faceT = 0.5; let best = null, bd = -2;
      for (const k in this.spots) { const d = toVec(...this.spots[k], 1).normalize().dot(camDir); if (d > bd) { bd = d; best = k; } }
      if (best) this.onFacing(best);
    }
    this.shift += (this.shiftTo - this.shift) * Math.min(1, dt * 3);
    if (this.shift > 0.002) this.cam.setViewOffset(innerWidth, innerHeight, 0, this.shift * innerHeight, innerWidth, innerHeight); else if (this.cam.view && this.cam.view.enabled) this.cam.clearViewOffset();
    this.renderer.setRenderTarget(null); this.renderer.render(this.scene, this.cam);
  }
  travelling(key) { this.leaving = true; Sky.leaving(); this.uiEl.firstChild.textContent = 'TRAVELLING TO ' + PLACES[key].name.toUpperCase(); this.say(''); this.uiEl.style.display = ''; this.backBtn.style.display = 'none'; }
  resize() { if (this.cam) { this.cam.aspect = innerWidth / innerHeight; this.cam.updateProjectionMatrix(); } }
}
