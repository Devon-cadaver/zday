// Whirlpools: a sinkhole or a worm's hole under flood water becomes a drain. A
// vortex spins up on the surface over it, floating cars, wreckage and anyone
// swimming are drawn round and round and down it, and the flood pours away down
// the hole (the water level falls) until it is too shallow to spin.
import * as THREE from 'three';
import { ST } from './people.js';
import { sfx } from './audio.js';

const VS = /* glsl */`varying vec2 vP; void main() { vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FS = /* glsl */`
uniform float uTime, uK, uLight, uHole; varying vec2 vP;
void main() {
  float r = length(vP); if (r > 1.0) discard;
  float a = atan(vP.y, vP.x), sw = a * 3.0 + log(max(r, 0.02)) * 7.0 + uTime * 5.0; // spiral arms tightening toward the middle, turning
  float arm = 0.5 + 0.5 * sin(sw), foam = smoothstep(0.75, 0.97, arm) * smoothstep(0.12, 0.4, r);
  float hole = 1.0 - smoothstep(uHole * 0.6, uHole, r); // the throat: dark where it pours down
  vec3 col = mix(vec3(0.16, 0.18, 0.15), vec3(0.62, 0.64, 0.58), foam) * uLight;
  col = mix(col, vec3(0.03, 0.035, 0.03), hole);
  float alpha = (0.25 + 0.6 * foam + 0.8 * hole) * (1.0 - smoothstep(0.7, 1.0, r)) * uK;
  gl_FragColor = vec4(col, min(1.0, alpha));
}`;

export class Whirlpools {
  constructor(D) { this.D = D; this.pools = new Map(); this.said = false; this.geo = null; }
  reset() { for (const p of this.pools.values()) this.drop(p); this.pools.clear(); this.said = false; this.clear(); }
  clear() { const { traffic } = this.D.ctx; traffic.flowAt = null; this.D.debris.flowAt = null; }
  drop(p) { this.D.ctx.scene.remove(p.m); p.m.material.dispose(); }

  // the holes that can drain: sinkholes and worm holes (shafts), not the black hole's void
  holes() { return this.D.leftovers.filter(l => l.floorAt && l.shape === 'shaft' && !l.bottomless && l.R > 2.5); }

  update(h) {
    const D = this.D, W = D.water, { people, traffic } = D.ctx;
    if (!W.active) { if (this.pools.size) this.reset(); return; }
    const live = new Set();
    for (const hl of this.holes()) {
      const depth = W.levelAt(hl.x + hl.R * 1.3, hl.z) - people.groundY(hl.x + hl.R * 1.3, hl.z);
      let p = this.pools.get(hl);
      if (depth < 0.55) { if (p) { this.drop(p); this.pools.delete(hl); } continue; }
      live.add(hl);
      if (!p) {
        if (!this.geo) { this.geo = new THREE.PlaneGeometry(2, 2, 16, 16); this.geo.rotateX(-Math.PI / 2); } // enough vertices to bend with the world's curve
        const m = new THREE.Mesh(this.geo, new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, uniforms: { uTime: { value: 0 }, uK: { value: 0 }, uLight: { value: 1 }, uHole: { value: 0.3 } } }));
        m.renderOrder = 3; m.frustumCulled = false; D.ctx.scene.add(m);
        p = { hl, m, t: 0, k: 0 }; this.pools.set(hl, p);
        if (!this.said) { this.said = true; D.emit({ type: 'whirlpool', x: hl.x, z: hl.z, text: 'A whirlpool! The flood is pouring down the hole' }); }
        sfx('splashBig', hl.x, 0, hl.z);
      }
      p.t += h; p.k = Math.min(1, p.t / 3) * Math.min(1, (depth - 0.55) / 0.6); // spins up, dies away as the water gets shallow
      p.R = hl.R * 2.8; p.x = hl.x; p.z = hl.z;
      // the flood pours away down it
      this.drain(h * 0.0045 * hl.R * p.k);
      // spray thrown up round the throat
      if (Math.random() < h * 8 * p.k) { const a = Math.random() * 6.28, r = hl.R * (0.8 + Math.random() * 0.5); W.splash.emit(hl.x + Math.cos(a) * r, W.level, hl.z + Math.sin(a) * r, 4, { up: [1, 3], dir: [-Math.sin(a) * 5, Math.cos(a) * 5], spread: 1.5, life: 1, size: 1.2 }); }
      // anyone in the water: round and round and in, and down
      people.around(hl.x, hl.z, p.R, (j) => {
        const s = people.st[j]; if (people.lvl[j] !== -1 || s === ST.DEAD || s === ST.INSIDE || s === ST.EVAC || s === ST.EXT || s === ST.AIR) return;
        if (W.levelAt(people.x[j], people.z[j]) - people.groundY(people.x[j], people.z[j]) < 0.8) return; // wading in the shallows: they keep their feet
        const dx = hl.x - people.x[j], dz = hl.z - people.z[j], d = Math.hypot(dx, dz) || 1, kk = 1 - d / p.R;
        if (d < hl.R * 0.75) { people.kill(j, 0, 0, 'drown'); return; } // pulled under
        const ux = dx / d, uz = dz / d, v = (1 + 6 * kk) * p.k * h;
        people.move(j, ux * 0.4 - uz, uz * 0.4 + ux, v);
      });
    }
    for (const [hl, p] of this.pools) if (!live.has(hl)) { this.drop(p); this.pools.delete(hl); }
    if (!this.pools.size) { this.clear(); return; }
    // floating cars and wreckage feel the pull; within the throat they are gone
    traffic.flowAt = (x, z) => this.flow(x, z, (car) => this.under(car.x, car.z) && (traffic.remove(car), this.gulp(car.x, car.z), true));
    D.debris.flowAt = (x, z) => this.flow(x, z, null, (px, pz) => this.under(px, pz) && (this.gulp(px, pz), true));
  }
  // the pull at (x, z): [vx, vz, swallow a car, swallow wreckage], or null outside every whirlpool
  flow(x, z, car, deb) {
    let vx = 0, vz = 0, any = false, free = false;
    for (const p of this.pools.values()) {
      const dx = p.x - x, dz = p.z - z, d = Math.hypot(dx, dz); if (d > p.R || d < 0.01) continue;
      const kk = 1 - d / p.R, ux = dx / d, uz = dz / d, vt = (0.3 + 1.5 * kk) * p.k, vr = (0.4 + 1.4 * kk) * p.k; // drawn in as fast as it is turned round, so it spirals inward
      vx += -uz * vt + ux * vr; vz += ux * vt + uz * vr; any = true; if (d < p.hl.R * 1.8) free = true;
    }
    return any ? [vx, vz, car, deb, free] : null; // free: over the throat (nothing to bump into: the rim is not a wall here)
  }
  under(x, z) { for (const p of this.pools.values()) if (Math.hypot(p.x - x, p.z - z) < p.hl.R * 0.85 && p.k > 0.25) return true; return false; }
  gulp(x, z) { const W = this.D.water; W.splash.emit(x, W.level, z, 14, { up: [2, 6], spread: 2, life: 1.2, size: 1.6 }); }

  // the water goes down: the flood (or the wave's water, or the player's flood) is that much lower, never below a shallow film
  drain(amt) {
    if (amt <= 0) return;
    const D = this.D, W = D.water, m = D.ctx.game && D.ctx.game.mode;
    if (W.level < 0.5) return;
    for (const e of D.list) {
      if (!e.alive) continue;
      if (e.type === 'flood') e.drained = (e.drained || 0) + amt;
      if (e.type === 'tsunami') e.floodH = Math.max(0.35, e.floodH - amt);
    }
    if (m && m.kind === 'flood' && m.ctl && typeof m.ctl.level === 'number') m.ctl.level = Math.max(0.35, m.ctl.level - amt); // Be The Disaster's flood
    W.level = Math.max(0.35, W.level - amt);
  }

  sync(realT) {
    const W = this.D.water;
    for (const p of this.pools.values()) {
      p.m.position.set(p.x, W.level + 0.06, p.z); p.m.scale.set(p.R, 1, p.R);
      const u = p.m.material.uniforms; u.uTime.value = realT; u.uK.value = p.k; u.uLight.value = this.D.lightK; u.uHole.value = p.hl.R * 0.75 / p.R;
    }
  }
}
