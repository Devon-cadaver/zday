// Inflatable flood barriers: a long orange tube laid across the path of a
// tsunami and pumped up in a few seconds. The stretch of the wave that reaches
// it is held there while the rest of the wave goes on past either end, until
// the barrier gives way; what spills over it then has lost its force - it
// floods the streets behind but sweeps nobody off their feet and brings no
// buildings down.
import * as THREE from 'three';

const LEN = 64, R = 2.6, HOLD = 22, PUMP = 3;
let KIT = null;
function kit() {
  if (KIT) return KIT;
  KIT = {
    tube: new THREE.CylinderGeometry(R, R, LEN, 22, 1, true).rotateZ(Math.PI / 2), cap: new THREE.SphereGeometry(R, 22, 12), strap: new THREE.TorusGeometry(R * 1.015, 0.13, 6, 24).rotateY(Math.PI / 2),
    skin: new THREE.MeshStandardMaterial({ color: '#ff6a1a', roughness: 0.45 }), band: new THREE.MeshStandardMaterial({ color: '#2b2b30', roughness: 0.8 }),
  };
  return KIT;
}

export class Barriers {
  constructor(D) { this.D = D; this.list = []; }
  // across tsunami T's path, centred on (x, z) (moved onto the nearest street): null if the wave is already there
  place(x, z, T) {
    const D = this.D, { people, scene } = D.ctx, sw = T.sw, w = people.snapWalkable(x, z, 20) || [x, z];
    const dx = w[0] - sw.origin.x, dz = w[1] - sw.origin.y, s = dx * sw.dir.x + dz * sw.dir.y, t = dx * sw.tan.x + dz * sw.tan.y;
    if (T.phase !== 'warn' && sw.frontAt(t) > s - 15) return null;
    const K = kit(), g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    const tube = new THREE.Mesh(K.tube, K.skin); body.add(tube);
    for (const e of [-1, 1]) { const c = new THREE.Mesh(K.cap, K.skin); c.position.x = e * LEN / 2; body.add(c); }
    for (let k = 0; k < 7; k++) { const st = new THREE.Mesh(K.strap, K.band); st.position.x = -LEN / 2 + 4 + k * (LEN - 8) / 6; body.add(st); }
    body.traverse((m) => { m.castShadow = m.receiveShadow = true; });
    g.position.set(w[0], people.groundY(w[0], w[1]), w[1]); g.rotation.y = Math.atan2(-sw.tan.y, sw.tan.x);
    scene.add(g);
    const b = { T, sw, x: w[0], z: w[1], s, stop: s - R - 5, t0: t - LEN / 2 - R, t1: t + LEN / 2 + R, g, body, t: 0, load: 0, state: 'up', sprayT: 0 };
    this.list.push(b); this.inflate(b, 0.08);
    return b;
  }
  inflate(b, k) { b.body.scale.set(1, k, k); b.body.position.y = R * k; }
  // the standing barrier in the way of the section of front sw at tangent t (front f; it stops at b.stop), or null
  holdAt(sw, t, f) {
    for (const b of this.list) if (b.sw === sw && b.state === 'up' && t > b.t0 && t < b.t1 && f < b.s) return b;
    return null;
  }
  update(h) {
    const D = this.D, W = D.water;
    for (let n = this.list.length - 1; n >= 0; n--) {
      const b = this.list[n], sw = b.sw; b.t += h;
      if (b.state === 'up') {
        this.inflate(b, Math.min(1, 0.08 + b.t / PUMP));
        if (b.held) { // the wave piled against it: spray over the top, and it can only take so much
          b.load += h; b.held = false;
          if ((b.sprayT -= h) <= 0) { b.sprayT = 0.12; W.splash.emit(b.x - sw.dir.x * R, R * 2, b.z - sw.dir.y * R, 16, { up: [6, 13], dir: [sw.dir.x * 4, sw.dir.y * 4], spread: 4, life: 1.6, size: 2, along: [sw.tan.x, sw.tan.y, LEN / 2] }); }
          if (b.load > HOLD) { b.state = 'down'; b.dt = 0; sw.tameRange(b.t0, b.t1); D.emit({ type: 'barrierdown', text: 'The flood barrier has given way, but the wave spilling over it has lost its force' }); }
        }
      } else { // burst and flattened, then hauled away once the water is gone
        b.dt += h; const k = Math.max(0.3, 1 - b.dt * 2); b.body.scale.set(1, k * 0.7, k); b.body.position.y = R * k * 0.7; b.g.position.y = Math.max(0, Math.min(W.level, 0.4));
        if (!b.T.alive || b.dt > 90) { D.ctx.scene.remove(b.g); this.list.splice(n, 1); }
      }
      if (!b.T.alive && b.state === 'up') { D.ctx.scene.remove(b.g); this.list.splice(n, 1); }
    }
  }
  reset() { for (const b of this.list) this.D.ctx.scene.remove(b.g); this.list.length = 0; }
}
