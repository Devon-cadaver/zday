// The world from orbit: a small planet - oceans, coasts, deserts, forests,
// mountains, ice at the poles, clouds drifting over it - with the big city and
// the towns on it as little clusters of buildings. The globe button opens it
// (the camera pulls back from where you are); drag to spin it, pinch to zoom,
// tap a place to fly down to it, and the page is built again around that place.
// The game waits while you are up here. Everything is made in code: the map is
// painted from noise on a sphere, so it has no seams and no poles pinching.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PLACES, placeKey, travel } from './places.js';

const R = 10;
// the places' character on the map: what each one wants to be next to
const WANTS = { metro: 'city', harbor: 'coast', dust: 'desert', pines: 'forest' }; // city: deep in a big landmass that reaches the sea
const SIZE = { metro: [70, 0.55, 0.36], harbor: [26, 0.26, 0.1], dust: [18, 0.22, 0.06], pines: [14, 0.2, 0.08] }; // buildings, spread, tallest
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

// the map: colour, and what is where (for placing the towns)
function paint(W, H) {
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), img = g.createImageData(W, H), d = img.data, bio = new Uint8Array(W * H), hgt = new Float32Array(W * H);
  const col = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const DEEP = [26, 70, 104], SHALLOW = [58, 128, 150], SAND = [217, 199, 150], GRASS = [134, 160, 88], FOREST = [74, 104, 56], DESERT = [216, 180, 116], ROCK = [132, 118, 100], SNOW = [236, 240, 238];
  for (let y = 0; y < H; y++) {
    const lat = (0.5 - (y + 0.5) / H) * Math.PI, cl = Math.cos(lat), sl = Math.sin(lat), al = Math.abs(lat) * 180 / Math.PI;
    for (let x = 0; x < W; x++) {
      const lon = ((x + 0.5) / W) * Math.PI * 2 - Math.PI, px = cl * Math.cos(lon), py = sl, pz = cl * Math.sin(lon), i = y * W + x;
      const h = fbm(px * 1.7 + 11, py * 1.7, pz * 1.7, 5), m = fbm(px * 2.6 + 40, py * 2.6, pz * 2.6, 3), sea = 0.5;
      hgt[i] = h;
      let rgb, b;
      const ss = (a, c, v) => { const t = Math.max(0, Math.min(1, (v - a) / (c - a))); return t * t * (3 - 2 * t); };
      if (h < sea) { rgb = col(col(DEEP, SHALLOW, ss(sea - 0.08, sea, h)), SAND, ss(sea - 0.006, sea, h) * 0.6); b = BIOME.OCEAN; } // shallows paling into the beach
      else if (al > 68 + (m - 0.5) * 12) { rgb = SNOW; b = BIOME.ICE; }
      else if (h < sea + 0.012) { rgb = col(SAND, GRASS, ss(sea + 0.006, sea + 0.014, h) * 0.5); b = BIOME.COAST; }
      else if (h > 0.66) { rgb = col(ROCK, SNOW, Math.max(0, (h - 0.72) / 0.06)); b = BIOME.MOUNT; }
      else if (al < 34 && m < 0.5) { rgb = col(DESERT, SAND, Math.max(0, 0.42 - m) * 2); b = BIOME.DESERT; }
      else if (m > 0.53) { rgb = FOREST; b = BIOME.FOREST; }
      else { rgb = col(GRASS, FOREST, Math.max(0, m - 0.45) * 5); b = BIOME.GRASS; }
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
const toVec = (lat, lon, r = R) => new THREE.Vector3(Math.cos(lat) * Math.cos(lon) * r, Math.sin(lat) * r, -Math.cos(lat) * Math.sin(lon) * r); // as SphereGeometry wraps the map

export class Globe {
  constructor(renderer) {
    this.renderer = renderer; this.active = false; this.built = false; this.t = 0; this.fly = null;
    this.button();
  }
  button() {
    const b = document.createElement('button'); b.type = 'button'; b.id = 'zd-globe'; b.title = 'The world'; b.textContent = '🌍';
    b.style.cssText = 'position:fixed;right:10px;top:calc(42% + 92px);z-index:30;width:38px;height:38px;border-radius:19px;border:1px solid rgba(255,255,255,0.15);background:rgba(20,18,16,0.72);color:#f2ead8;font-size:18px;line-height:36px;padding:0;cursor:pointer';
    b.onclick = (e) => { e.stopPropagation(); this.open(); };
    document.body.appendChild(b); this.btn = b;
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
    this.labels();
    this.controls = new OrbitControls(cam, this.renderer.domElement); this.controls.enablePan = false; this.controls.enableDamping = true; this.controls.dampingFactor = 0.08;
    this.controls.minDistance = R * 1.25; this.controls.maxDistance = R * 5; this.controls.rotateSpeed = 0.5; this.controls.enabled = false;
    this.ui();
  }
  // where each place sits: the spot on the map that suits it best (a coast for the big city and the harbour, the desert,
  // the forest), all on one side of the world so you see them together. The same spots every time
  placeTowns() {
    const { bio, W, H } = this.map, keys = Object.keys(PLACES), taken = [];
    const at = (lat, lon) => { const x = Math.floor(((lon + Math.PI) / (Math.PI * 2)) * W) % W, y = Math.min(H - 1, Math.max(0, Math.floor((0.5 - lat / Math.PI) * H))); return bio[y * W + x]; };
    const near = (lat, lon, b, r) => { let n = 0; for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; if (at(lat + Math.cos(a) * r, lon + Math.sin(a) * r / Math.max(0.3, Math.cos(lat))) === b) n++; } return n; };
    let s = 12345; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    this.spots = {};
    for (const key of keys) {
      let best = null, bs = -1e9;
      for (let n = 0; n < 4000; n++) {
        const lat = (rnd() - 0.5) * 1.1, lon = (rnd() - 0.5) * 2.0, b = at(lat, lon); // the band facing you at first
        if (b === BIOME.OCEAN || b === BIOME.ICE) continue;
        const want = WANTS[key] || 'grass';
        const sea = (r) => near(lat, lon, BIOME.OCEAN, r);
        let sc = want === 'city' ? (sea(0.03) + sea(0.06) === 0 ? 10 : -20) + (sea(0.12) >= 2 && sea(0.12) <= 9 ? 8 : 0) + (b === BIOME.GRASS ? 3 : 0)
          : want === 'coast' ? (sea(0.022) === 0 ? 6 : -20) + Math.min(6, sea(0.05)) * 1.5 + (b === BIOME.GRASS || b === BIOME.COAST ? 2 : 0)
          : want === 'desert' ? (b === BIOME.DESERT ? 8 : 0) + near(lat, lon, BIOME.DESERT, 0.05) - sea(0.03) * 3
          : (b === BIOME.FOREST ? 8 : 0) + near(lat, lon, BIOME.FOREST, 0.05) - sea(0.03) * 3;
        for (const q of taken) { const dd = Math.acos(Math.min(1, Math.sin(lat) * Math.sin(q[0]) + Math.cos(lat) * Math.cos(q[0]) * Math.cos(lon - q[1]))); if (dd < 0.18) sc -= 100; else if (dd < 0.7) sc += 2; } // apart, but not too far
        if (sc > bs) { bs = sc; best = [lat, lon]; }
      }
      taken.push(best); this.spots[key] = best;
    }
    // each place: a little cluster of buildings standing on the surface, coloured like the place
    let total = 0; for (const k of keys) total += (SIZE[k] || SIZE.harbor)[0];
    const im = this.towns = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ roughness: 0.7 }), total);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), c = new THREE.Color(); let i = 0;
    const TINT = { metro: ['#c9b9a0', '#9d9a92', '#b3664a', '#ddd2bb'], harbor: ['#f0ebe1', '#9fb0b8', '#d9a28a', '#ece5d8'], dust: ['#f7ecd6', '#a8733f', '#f0dcb4', '#8a5a30'], pines: ['#a65a3e', '#8e4a34', '#c07a5c'] };
    for (const key of keys) {
      const [n, spread, tall] = SIZE[key] || SIZE.harbor, [lat, lon] = this.spots[key], cols = TINT[key] || TINT.metro;
      for (let k = 0; k < n; k++) {
        const r = Math.sqrt(rnd()) * spread, a = rnd() * Math.PI * 2, la = lat + Math.cos(a) * r / R, lo = lon + Math.sin(a) * r / (R * Math.cos(lat));
        const p = toVec(la, lo, R * 0.998), nrm = p.clone().normalize(), h = tall * (0.25 + Math.pow(rnd(), 3) * (1 - r / spread) * 1.6), w = 0.05 + rnd() * 0.05;
        q.setFromUnitVectors(up, nrm); m.compose(p, q, new THREE.Vector3(w, h, w)); im.setMatrixAt(i, m); im.setColorAt(i, c.set(cols[k % cols.length])); i++;
      }
    }
    this.scene.add(im);
    this.here = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.7, 48), new THREE.MeshBasicMaterial({ color: '#ffe08a', transparent: true, side: THREE.DoubleSide, depthWrite: false })); // a ring round where you are
    const hs = this.spots[placeKey()], hp = toVec(hs[0], hs[1], R * 1.003); this.here.position.copy(hp); this.here.lookAt(hp.clone().multiplyScalar(2)); this.scene.add(this.here);
  }
  labels() {
    this.tags = {};
    for (const key in PLACES) {
      const d = document.createElement('button'); d.type = 'button'; d.className = 'zd-place'; d.textContent = PLACES[key].name + (key === placeKey() ? ' · here' : '');
      d.style.cssText = 'position:fixed;left:0;top:0;z-index:41;transform:translate(-50%,-150%);padding:5px 10px;border-radius:12px;border:1px solid rgba(255,255,255,0.25);background:rgba(18,16,14,0.78);color:#f6eedc;font:600 12px system-ui,sans-serif;white-space:nowrap;cursor:pointer;display:none';
      d.onclick = (e) => { e.stopPropagation(); this.go(key); };
      document.body.appendChild(d); this.tags[key] = d;
    }
  }
  ui() {
    const u = this.uiEl = document.createElement('div');
    u.style.cssText = 'position:fixed;left:0;right:0;top:14px;z-index:41;text-align:center;color:#f6eedc;font:700 15px system-ui,sans-serif;letter-spacing:0.12em;pointer-events:none;display:none';
    u.innerHTML = 'THE WORLD<div style="font:500 12px system-ui,sans-serif;letter-spacing:0;opacity:0.75;margin-top:4px">Spin it, tap a town to go there</div>';
    const back = this.backBtn = document.createElement('button'); back.type = 'button'; back.className = 'zd-btn'; back.textContent = 'Back to ' + PLACES[placeKey()].name;
    back.style.cssText = 'position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:41;display:none';
    back.onclick = (e) => { e.stopPropagation(); this.go(placeKey()); };
    document.body.appendChild(u); document.body.appendChild(back);
  }
  // up from where you are: the game waits, the camera pulls back off the city out to the whole planet
  open() {
    if (this.active) return;
    if (!this.built) this.build();
    this.active = true; this.fly = null;
    const [lat, lon] = this.spots[placeKey()], p = toVec(lat, lon, 1).normalize();
    this.cam.position.copy(p).multiplyScalar(R * 1.15); this.cam.lookAt(0, 0, 0); this.controls.target.set(0, 0, 0); this.controls.update();
    this.rise = { t: 0, from: R * 1.15, to: R * 3.2, dir: p.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.25).add(new THREE.Vector3(0, 0.25, 0)).normalize() };
    this.controls.enabled = true;
    document.body.classList.add('zd-globe-on'); this.toggleHud(false);
    this.uiEl.style.display = ''; this.backBtn.style.display = '';
  }
  close() {
    this.active = false; this.controls.enabled = false; this.toggleHud(true);
    this.uiEl.style.display = 'none'; this.backBtn.style.display = 'none'; for (const k in this.tags) this.tags[k].style.display = 'none';
  }
  toggleHud(on) { for (const el of document.querySelectorAll('#zd-top, #zd-bar, .zd-top, .zd-bar, #zd-dis, #zd-call')) el.style.visibility = on ? '' : 'hidden'; }
  // down to a place: fly in over it; back where you were, the city is still there; anywhere else is built afresh
  go(key) {
    if (this.fly) return;
    const [lat, lon] = this.spots[key];
    this.fly = { t: 0, key, from: this.cam.position.clone(), to: toVec(lat, lon, R * 1.12) };
    this.controls.enabled = false;
  }
  frame(dt) {
    this.t += dt;
    this.clouds.rotation.y += dt * 0.012;
    this.here.material.opacity = 0.55 + 0.45 * Math.sin(this.t * 3);
    if (this.rise) { // pulling back off the city
      const R0 = this.rise; R0.t += dt; const k = Math.min(1, R0.t / 1.6), e = 1 - Math.pow(1 - k, 3), r = R0.from + (R0.to - R0.from) * e;
      const dir = this.cam.position.clone().normalize().lerp(R0.dir, Math.min(1, dt * 1.2)).normalize(); this.cam.position.copy(dir.multiplyScalar(r)); this.cam.lookAt(0, 0, 0);
      if (k >= 1) this.rise = null;
    } else if (this.fly) { // flying down to a place
      const F = this.fly; F.t += dt; const k = Math.min(1, F.t / 1.4), e = k * k * (3 - 2 * k);
      const a = F.from.clone().normalize(), b = F.to.clone().normalize(), dir = a.lerp(b, e).normalize(), r = F.from.length() + (F.to.length() - F.from.length()) * e;
      this.cam.position.copy(dir.multiplyScalar(r)); this.cam.lookAt(0, 0, 0);
      if (k >= 1) { const key = F.key; this.fly = null; if (key === placeKey()) this.close(); else { this.uiEl.innerHTML = 'TRAVELLING TO ' + PLACES[key].name.toUpperCase(); travel(key, new URLSearchParams(location.search).get('mode') || 'sandbox'); } }
    } else this.controls.update();
    // labels over the places on the side facing you
    const v = new THREE.Vector3(), camDir = this.cam.position.clone().normalize();
    for (const key in this.tags) {
      const [lat, lon] = this.spots[key], p = toVec(lat, lon, R * 1.01), el = this.tags[key];
      if (p.clone().normalize().dot(camDir) < 0.25 || this.fly || this.rise) { el.style.display = 'none'; continue; }
      v.copy(p).project(this.cam); el.style.display = ''; el.style.left = ((v.x + 1) / 2 * innerWidth) + 'px'; el.style.top = ((1 - v.y) / 2 * innerHeight) + 'px';
    }
    this.renderer.setRenderTarget(null); this.renderer.render(this.scene, this.cam);
  }
  resize() { if (this.cam) { this.cam.aspect = innerWidth / innerHeight; this.cam.updateProjectionMatrix(); } }
}
