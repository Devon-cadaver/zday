// Guardian Shield (Sean, 2026-11-04): a bubble that soaks up the next blows for a few seconds, and a small heal when it goes up. Worn by a fighter, or brought by an alternate called in on TEAM. The same in a street fight, in a crowd and in the air: each just asks soak(n) how much of a blow gets through.
import * as THREE from 'three';
import { sfx } from './audio.js';

export const GUARD = { secs: 7, soak: 35, heal: 15 };
export class GuardFx {
  constructor(scene) { this.S = scene; this.left = 0; this.t = 0; this.hitT = 0; this.m = null; this.tt = 0; }
  get on() { return this.t > 0 && this.left > 0; }
  // up, round whoever is at x, y, z; k scales it to a bigger health bar
  start(x, y, z, k = 1) {
    this.left = GUARD.soak * k; this.t = GUARD.secs; this.hitT = 0.3;
    if (!this.m) { const m = this.m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 3), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0.62, 1.05), transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide })); m.renderOrder = 6; m.frustumCulled = false; const w = new THREE.Mesh(m.geometry, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 0.85, 1.25), wireframe: true, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); w.renderOrder = 6; m.add(w); this.S.add(m); }
    this.m.visible = true; this.m.position.set(x, y, z); sfx('chime', x, y, z, { gain: 1.1 });
  }
  step(dt, x, y, z) { if (!this.m || !this.m.visible) return; this.t -= dt; this.tt += dt; this.hitT = Math.max(0, this.hitT - dt); const fade = this.t < 1.2 ? 0.5 + 0.5 * Math.sin(this.tt * 18) : 1; this.m.position.set(x, y, z); this.m.scale.setScalar(1.45 + 0.04 * Math.sin(this.tt * 4) + this.hitT * 0.8); this.m.rotation.y += dt * 0.7; this.m.material.opacity = (0.13 + this.hitT * 0.9) * fade; this.m.children[0].material.opacity = (0.2 + this.hitT) * fade; if (this.t <= 0 || this.left <= 0) this.off(); }
  // a blow: what the shield takes off it, and what gets through
  soak(n) { if (!this.on || n <= 0) return n; const a = Math.min(n, this.left); this.left -= a; this.hitT = 0.25; if (this.left <= 0) { const p = this.m.position; sfx('glass', p.x, p.y, p.z, { gain: 1, rate: 1.2 }); this.off(); } return n - a; }
  off() { if (this.m) this.m.visible = false; this.t = 0; this.left = 0; }
  dispose() { if (!this.m) return; this.S.remove(this.m); this.m.geometry.dispose(); this.m.children[0].material.dispose(); this.m.material.dispose(); this.m = null; this.left = 0; this.t = 0; }
}
