// A speed streak behind a figure moving fast (HERO-PLAN 3e.3): a ribbon through its last positions, bright at the figure
// and fading along its length, drawn additively so it glows; let go, it fades out where it is. One per hero (flight.js).
import * as THREE from 'three';

const N = 14;
export class Streak {
  constructor(scene, col = [1.4, 0.7, 1.6]) {
    this.pts = []; this.on = false; this.fade = 0;
    const g = this.g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 2 * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 2 * 3), 3));
    const idx = []; for (let i = 0; i < N - 1; i++) { const o = i * 2; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); } g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    this.mesh.frustumCulled = false; this.mesh.visible = false; this.col = new THREE.Color(col[0], col[1], col[2]); scene.add(this.mesh);
    this._r = new THREE.Vector3(); this._d = new THREE.Vector3();
  }
  // each frame: the figure's place, whether the streak is on, the camera (the ribbon faces it)
  update(pos, on, cam, dt) {
    if (on) { this.on = true; this.fade = 1; const last = this.pts[0]; if (!last || last.distanceToSquared(pos) > 0.04) { this.pts.unshift(pos.clone()); if (this.pts.length > N) this.pts.length = N; } }
    else if (this.on) { this.fade -= dt * 3; if (this.fade <= 0) { this.on = false; this.pts.length = 0; this.mesh.visible = false; return; } }
    if (!this.on || this.pts.length < 2) { this.mesh.visible = false; return; }
    const P = this.g.attributes.position.array, C = this.g.attributes.color.array, n = this.pts.length;
    for (let i = 0; i < N; i++) {
      const p = this.pts[Math.min(i, n - 1)], q = this.pts[Math.min(i + 1, n - 1)], k = 1 - i / (N - 1);
      this._d.subVectors(p, q); if (this._d.lengthSq() < 1e-6) this._d.set(0, 1, 0); this._r.subVectors(cam.position, p).cross(this._d).normalize(); // across the ribbon, facing the camera
      const w = (0.12 + 0.55 * k) * this.fade, o = i * 6;
      P[o] = p.x + this._r.x * w; P[o + 1] = p.y + this._r.y * w; P[o + 2] = p.z + this._r.z * w; P[o + 3] = p.x - this._r.x * w; P[o + 4] = p.y - this._r.y * w; P[o + 5] = p.z - this._r.z * w;
      const b = k * k * this.fade; C[o] = C[o + 3] = this.col.r * b; C[o + 1] = C[o + 4] = this.col.g * b; C[o + 2] = C[o + 5] = this.col.b * b;
    }
    this.g.attributes.position.needsUpdate = true; this.g.attributes.color.needsUpdate = true; this.mesh.visible = true;
  }
  dispose(scene) { scene.remove(this.mesh); this.g.dispose(); this.mesh.material.dispose(); }
}
