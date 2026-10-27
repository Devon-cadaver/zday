// Day and night. phase 0..1 runs one cycle: late afternoon, sunset, night,
// dawn, morning. The sun crosses the sky from east to west and sinks below the
// horizon; the moon rises in the east after it and sets at dawn, so the light
// (one directional light, and its shadows) swings round and lengthens with
// them, handing over in the dark between. Also drives the sky, the post grade,
// lit windows, street lamp light pools and car headlights.
import * as THREE from 'three';

const C = (h) => new THREE.Color(h);
const DAY_SUN = C('#ffd6a0'), LOW_SUN = C('#ff8a4a'), MOON = C('#8aa0ff');
const SKY_DAY = C('#fff0d4'), SKY_NIGHT = C('#56689a'), GND_DAY = C('#7a5c3c'), GND_NIGHT = C('#2a2c3a');
const HAZE_DAY = C('#d9bf95'), HAZE_DUSK = C('#d9906a'), HAZE_NIGHT = C('#242c44');
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function poolTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Daylight {
  constructor({ scene, sun, hemi, post, city, traffic, people }) {
    Object.assign(this, { scene, sun, hemi, post, city, traffic, people });
    this.sunDir = new THREE.Vector3(-0.78, 0.72, -0.2).normalize();
    this.az0 = Math.atan2(this.sunDir.x, this.sunDir.z);
    this.azNoon = this.az0 - 0.49; // highest over here; rising 75 degrees one side of it, setting 75 degrees the other
    this.night = 0;
    const tex = poolTexture();
    const quad = new THREE.PlaneGeometry(1, 1); quad.rotateX(-Math.PI / 2);
    // street lamps: one warm pool each, static
    const lamps = city.lamps || [];
    this.lampMat = new THREE.MeshBasicMaterial({ map: tex, color: '#ffc87a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    this.lampPools = new THREE.InstancedMesh(quad, this.lampMat, Math.max(1, lamps.length));
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
    lamps.forEach((l, k) => { m.compose(p.set(l.x + l.arm[0] * 1.3, 0.06, l.z + l.arm[1] * 1.3), q, s.set(13, 1, 13)); this.lampPools.setMatrixAt(k, m); });
    this.lampPools.count = lamps.length; this.lampPools.renderOrder = 1; this.lampPools.visible = false;
    scene.add(this.lampPools);
    // car headlights: a pool in front of every moving car, updated each frame
    const nCars = traffic ? traffic.nCars : 0;
    this.headMat = new THREE.MeshBasicMaterial({ map: tex, color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    this.headPools = new THREE.InstancedMesh(quad, this.headMat, Math.max(1, nCars));
    this.headPools.count = 0; this.headPools.renderOrder = 1; this.headPools.visible = false; this.headPools.frustumCulled = false;
    scene.add(this.headPools);
    this._m = m; this._q = q; this._p = p; this._s = s; this._c = new THREE.Color();
  }

  // sun elevation in degrees for a phase 0..1
  elevation(d) {
    if (d < 0.4) return 45 - 45 * (d / 0.4);
    if (d < 0.5) return -18 * ((d - 0.4) / 0.1);
    if (d < 0.82) return -18;
    if (d < 0.9) return -18 + 18 * ((d - 0.82) / 0.08);
    return 40 * ((d - 0.9) / 0.1);
  }

  // the moon: up from just after sunset (0.42) until just before dawn (0.87), highest at midnight
  moonElevation(d) { return d > 0.42 && d < 0.87 ? 52 * Math.sin(Math.PI * (d - 0.42) / 0.45) : -10; }
  // how far along its arc a body is: -1 rising in the east, 0 at its highest, 1 setting in the west
  sunArc(d) { return d >= 0.9 ? -1 + (d - 0.9) / 0.1 : d <= 0.4 ? d / 0.4 : 1 + (d - 0.4) / 0.5 * 2; }
  moonArc(d) { return -1 + 2 * (d - 0.42) / 0.45; }
  aim(arc, elev) { const az = this.azNoon + arc * 1.3, e = THREE.MathUtils.degToRad(Math.max(elev, 3)); this.sunDir.set(Math.cos(e) * Math.sin(az), Math.sin(e), Math.cos(e) * Math.cos(az)).normalize(); }

  set(phase) {
    const d = ((phase % 1) + 1) % 1;
    const elev = this.elevation(d), mElev = this.moonElevation(d);
    const dayK = sstep(-6, 8, elev), sunK = sstep(-2, 12, elev);
    const night = this.night = 1 - dayK, moonK = sstep(-2, 14, mElev) * sstep(0.3, 0.9, night);
    if (sunK > 0.02 || (moonK <= 0.02 && elev > mElev)) { // the sun: long shadows and orange light as it sinks, gone below the horizon
      this.aim(this.sunArc(d), elev);
      this.sun.intensity = 5 * sunK;
      this.sun.color.copy(DAY_SUN).lerp(LOW_SUN, 1 - sstep(0, 18, elev));
    } else { // the moon: pale blue, its shadows swinging round as it crosses
      this.aim(this.moonArc(d), mElev);
      this.sun.intensity = 1.6 * moonK;
      this.sun.color.copy(MOON);
    }
    this.hemi.intensity = 0.55 + 0.7 * dayK;
    this.hemi.color.copy(SKY_DAY).lerp(SKY_NIGHT, night);
    this.hemi.groundColor.copy(GND_DAY).lerp(GND_NIGHT, night);
    const dusk = sstep(-10, 4, elev) * (1 - sstep(4, 22, elev));
    this._c.copy(HAZE_DAY).lerp(HAZE_DUSK, dusk).lerp(HAZE_NIGHT, night);
    this.scene.background.copy(this._c);
    if (this.scene.fog) this.scene.fog.color.copy(this._c);
    this.post.opts.night = night;
    // lit windows, lamps, glow
    const lit = sstep(0.15, 0.6, night);
    for (const m of this.city.mats.fac) m.emissiveIntensity = 0.45 * lit;
    this.city.mats.shop.emissiveIntensity = 0.6 * lit;
    this.lampMat.opacity = 0.4 * lit; this.lampPools.visible = lit > 0.01;
    this.headMat.opacity = 0.35 * lit; this.headPools.visible = lit > 0.01;
    if (this.people) this.people.uGlow.value = 0.3 + 0.7 * lit;
  }

  // call each frame after traffic.sync
  update() {
    if (!this.headPools.visible || !this.traffic) return;
    const { _m: m, _q: q, _p: p, _s: s } = this;
    let n = 0;
    for (const car of this.traffic.cars) {
      if (car.mission || car.mode !== 0 || car.v < 0.5) continue;
      m.compose(p.set(car.x + car.hx * 6.5, 0.05, car.z + car.hz * 6.5), q, s.set(11, 1, 9));
      this.headPools.setMatrixAt(n++, m);
    }
    this.headPools.count = n;
    this.headPools.instanceMatrix.needsUpdate = true;
  }
}
