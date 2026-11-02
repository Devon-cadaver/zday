// A beaten villain's getaway (HERO-PLAN 3f; from Sean's street-fight inspiration: the beaten one is carried off, not killed):
// a dark ship comes down over them, a beam draws them up inside, and it climbs away,
// and it is gone (state 'gone', as when a villain walks off the map). flight.js steps these while a hero is up.
import * as THREE from 'three';

const dark = () => new THREE.MeshStandardMaterial({ color: '#23262e', roughness: 0.55, metalness: 0.5 });
export class Getaway {
  constructor(scene, v) {
    this.scene = scene; this.v = v; this.t = 0; this.done = false; this.gy = v.y || 0;
    v.tossed = null; v.gripped = true; v.pinned = 'air'; v.react = null; // held by the beam, its own legs and plans off
    const g = this.g = new THREE.Group(), hull = dark(), lit = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.1, 0.4), fog: false }); this.mats = [hull, lit];
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10), hull); body.scale.set(7, 1.6, 7); body.castShadow = true; g.add(body);
    const top = new THREE.Mesh(new THREE.BoxGeometry(5, 1.4, 3), hull); top.position.y = 1.5; g.add(top);
    for (const a of [0.8, 2.4, 3.9, 5.5]) { const fin = new THREE.Mesh(new THREE.BoxGeometry(4, 0.4, 1), hull); fin.position.set(Math.cos(a) * 7, -0.2, Math.sin(a) * 7); fin.rotation.y = -a; g.add(fin); const l = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), lit); l.position.set(Math.cos(a) * 9, -0.2, Math.sin(a) * 9); g.add(l); }
    this.beamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 0.9, 0.5), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }); this.mats.push(this.beamMat);
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.4, 1, 16, 1, true).translate(0, -0.5, 0), this.beamMat); this.beam.frustumCulled = false; g.add(this.beam);
    this.topY = this.gy + 22; g.position.set(v.x, this.topY + 170, v.z); scene.add(g);
  }
  // the ship down (1.2 s), the beam and the villain drawn up (1.5 s), then it climbs and is gone (1.5 s)
  step(h) {
    const v = this.v, g = this.g, t = (this.t += h); if (this.done) return;
    if (t < 1.2) { const u = t / 1.2, e = 1 - (1 - u) * (1 - u); g.position.y = this.topY + 170 * (1 - e); v.pinned = 'air'; }
    else if (t < 2.7) { const u = (t - 1.2) / 1.5; g.position.y = this.topY; this.beamMat.opacity = 0.45 * Math.min(1, u * 4); this.beam.scale.y = this.topY - (v.y || 0) + 1; v.y = this.gy + (this.topY - this.gy - 1.5) * u * u; v.x += (g.position.x - v.x) * h * 2; v.z += (g.position.z - v.z) * h * 2; }
    else { this.beamMat.opacity = 0; v.rig.root.visible = false; const u = (t - 2.7) / 1.5; g.position.y = this.topY + 260 * u * u; g.position.x += h * 60 * u; g.rotation.y += h * u; if (u >= 1) this.finish(); }
  }
  finish() {
    if (this.done) return; this.done = true; const v = this.v;
    this.scene.remove(this.g); this.g.traverse((m) => { if (m.geometry) m.geometry.dispose(); }); for (const m of this.mats) m.dispose();
    v.gripped = false; v.pinned = null; v.state = 'gone'; v.rig.root.visible = false; // carried off: its leaving is over
  }
}
