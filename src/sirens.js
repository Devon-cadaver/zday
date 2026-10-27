// Flashing emergency lights on every rescue unit: the light bars on police
// cruisers, fire trucks, ambulances, buses, APCs, storm chasers, construction and
// hazmat trucks, the rescue boats and the helicopters' beacons, plus the beacons
// at work sites and camps. By day they are small bright flashes; at night they
// grow big glowing halos and wash the street around them in coloured light.
import * as THREE from 'three';

const RED = [3.4, 0.22, 0.12], BLUE = [0.25, 0.55, 3.8], AMBER = [3.2, 1.55, 0.15], WHITE = [2.8, 2.8, 2.6];
// each kind's light bar on its model: x forward, y up, z half the gap between the two lamps, and their colours
const BARS = {
  police: { x: 0.1, y: 1.74, z: 0.32, c: [RED, BLUE] },
  fire: { x: 3.0, y: 2.98, z: 0.32, c: [RED, WHITE] },
  medic: { x: -0.5, y: 2.76, z: 0.32, c: [RED, WHITE] },
  bus: { x: 4.6, y: 3.2, z: 0.9, c: [AMBER, AMBER] },
  jail: { x: 4.4, y: 3.2, z: 0.6, c: [RED, BLUE] },
  apc: { x: 1.0, y: 2.3, z: 0.7, c: [BLUE, RED] },
  chaser: { x: 0.9, y: 2.28, z: 0.32, c: [AMBER, WHITE] },
  build: { x: 1.4, y: 2.7, z: 0.5, c: [AMBER, AMBER] },
  hazmat: { x: 1.6, y: 3.0, z: 0.4, c: [AMBER, RED] },
};
const CAP = 400;

const VS = /* glsl */`
attribute vec3 color; uniform float uScale, uSize; varying vec3 vC;
void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vC = color; gl_PointSize = clamp(uSize * uScale / -mv.z, 3.5, 140.0); gl_Position = projectionMatrix * mv; }`;
const FS = /* glsl */`
uniform float uNight; varying vec3 vC;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0; if (d > 1.0) discard;
  float core = smoothstep(0.42, 0.0, d), halo = (1.0 - d) * (1.0 - d) * (0.3 + 0.7 * uNight);
  gl_FragColor = vec4(vC * (core * 1.5 + halo), 1.0);
}`;

function poolTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
}

// the double-flash pattern: lamp a on in two quick blinks, then lamp b
const blink = (t, rate, side) => { const f = (t * rate + side * 0.5) % 1; return (f < 0.15 || (f > 0.22 && f < 0.37)) ? 1 : 0; };

export class Sirens {
  constructor(scene, { traffic, helis, boats, daylight, fire }) {
    Object.assign(this, { traffic, helis, boats, daylight, fire });
    this.beacons = []; // work sites and camps add theirs: { x, y, z, c, rate, phase, kind: 'flash' | 'blink' | 'steady' }
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(CAP * 3); this.col = new Float32Array(CAP * 3);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: { uScale: { value: 500 }, uSize: { value: 2.5 }, uNight: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = 9; scene.add(this.points);
    // coloured light on the street round each flashing vehicle, at night
    this.poolMat = new THREE.MeshBasicMaterial({ map: poolTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0 });
    this.pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), this.poolMat, 120);
    this.pools.count = 0; this.pools.frustumCulled = false; this.pools.renderOrder = 2; this.pools.setColorAt(0, new THREE.Color()); scene.add(this.pools);
    this._m = new THREE.Matrix4(); this._c = new THREE.Color(); this._q = new THREE.Quaternion(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3();
  }
  update(t) {
    const night = this.daylight ? this.daylight.night : 0, P = this.pos, C = this.col;
    let n = 0, np = 0;
    const lamp = (x, y, z, c, k = 1) => { if (n >= CAP) return; P[n * 3] = x; P[n * 3 + 1] = y; P[n * 3 + 2] = z; C[n * 3] = c[0] * k; C[n * 3 + 1] = c[1] * k; C[n * 3 + 2] = c[2] * k; n++; };
    const pool = (x, y, z, c, R) => {
      if (np >= 120 || night < 0.05) return;
      this._m.compose(this._p.set(x, y, z), this._q, this._s.set(R, 1, R)); this.pools.setMatrixAt(np, this._m);
      this.pools.setColorAt(np, this._c.setRGB(c[0] / 3.4, c[1] / 3.4, c[2] / 3.4)); np++;
    };
    // a light bar: two lamps either side of (x, y, z) across a vehicle heading yaw
    const bar = (x, y, z, yaw, B, id, rate = 2.2) => {
      const cy = Math.cos(yaw), sy = Math.sin(yaw), px = x + cy * B.x, pz = z - sy * B.x, py = y + B.y;
      let lit = null;
      for (let s = 0; s < 2; s++) { // between flashes a lamp still glows faintly, so a unit always shows
        const on = blink(t + id * 0.37, rate, s), sd = s ? 1 : -1;
        lamp(px + sy * B.z * sd, py, pz + cy * B.z * sd, B.c[s], on ? 1 : 0.18); if (on) lit = B.c[s];
      }
      if (lit) pool(px, 0.26, pz, lit, 16);
    };
    for (const car of this.traffic.missions) {
      if (car.gone || (car.mode !== 0 && car.mode !== 3)) continue; // only while it is out working: driving or on scene
      const B = BARS[car.kind]; if (B) bar(car.x, car.y || 0, car.z, car.yaw, B, car.id);
    }
    if (this.boats) for (const b of this.boats.list) {
      if (b.state === 'sink') continue;
      const o = b.obj.position; bar(o.x, o.y, o.z, b.yaw, b.big ? { x: 0.6, y: 3.25, z: 0.32, c: [RED, BLUE] } : { x: -0.4, y: 2.82, z: 0.32, c: [RED, BLUE] }, Math.floor(o.x * 7));
    }
    if (this.helis) for (const hl of this.helis.list) { // a red beacon under the rotor and a white strobe on the tail
      const o = hl.obj, yaw = o.rotation.y, cy = Math.cos(yaw), sy = Math.sin(yaw), sc = o.scale.x;
      if ((t * 1.1 + hl.bob) % 1 < 0.45) lamp(o.position.x - cy * sc, o.position.y + 2.2 * sc, o.position.z + sy * sc, RED);
      if ((t * 0.8 + hl.bob * 0.3) % 1 < 0.08) lamp(o.position.x - cy * 5.2 * sc, o.position.y + 3.1 * sc, o.position.z + sy * 5.2 * sc, WHITE, 1.3);
    }
    for (const bc of this.beacons) {
      const on = bc.kind === 'steady' ? 1 : bc.kind === 'blink' ? ((t * (bc.rate || 1) + (bc.phase || 0)) % 1 < 0.5 ? 1 : 0) : blink(t + (bc.phase || 0), bc.rate || 1.6, 0);
      if (!on) continue;
      lamp(bc.x, bc.y, bc.z, bc.c);
      if (bc.pool) pool(bc.x, 0.26, bc.z, bc.c, bc.pool);
    }
    const g = this.points.geometry; g.setDrawRange(0, n); g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true;
    const u = this.mat.uniforms; u.uNight.value = night; u.uSize.value = 2.6 + 6.5 * night; if (this.fire) u.uScale.value = this.fire.uniforms.uScale.value;
    this.pools.count = np; this.pools.instanceMatrix.needsUpdate = true; if (this.pools.instanceColor) this.pools.instanceColor.needsUpdate = true;
    this.poolMat.opacity = Math.min(1, night * 1.2) * 0.85;
  }
}
export { RED, BLUE, AMBER, WHITE };
