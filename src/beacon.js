// The hero's marker (Sean, 2026-11-15: "easy to identify what is going on"). With the camera pulled back for a giant, a storm or a crowd she is only a few dots
// high, so a small arrow floats over her head, the same size on the screen however far off she is, and drawn over whatever is in front of her. Up close it is
// not shown. flight.js (flying in a level) and horde.js (the crowd fights and the giants on foot) each keep one.
import * as THREE from 'three';

let TEX = null; const _p = new THREE.Vector3();
function tex() {
  if (TEX) return TEX; const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.lineJoin = 'round';
  x.beginPath(); x.moveTo(9, 10); x.lineTo(55, 10); x.lineTo(32, 56); x.closePath(); x.lineWidth = 10; x.strokeStyle = 'rgba(10,8,20,.9)'; x.stroke(); x.fillStyle = '#5ff2ff'; x.fill(); x.lineWidth = 3; x.strokeStyle = 'rgba(255,255,255,.95)'; x.stroke();
  TEX = new THREE.CanvasTexture(c); TEX.colorSpace = THREE.SRGBColorSpace; return TEX;
}
export class Beacon {
  constructor(scene) { this.scene = scene; const s = this.s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(), transparent: true, depthTest: false, depthWrite: false, fog: false, sizeAttenuation: false })); s.center.set(0.5, 0); s.renderOrder = 20; s.visible = false; scene.add(s); this.on = false; this.t = 0; }
  // each frame: (x, y, z) the top of her head. Shown with the camera more than 36 m off, hidden again nearer than 30
  step(dt, cam, x, y, z, show = true) {
    this.t += dt; const s = this.s, d = cam.position.distanceTo(_p.set(x, y, z)); this.on = show && (this.on ? d > 30 : d > 36); s.visible = this.on; if (!this.on) return;
    const k = 0.064 * Math.tan(cam.fov * Math.PI / 360) * (1 + 0.08 * Math.sin(this.t * 6)); // about 3% of the screen's height whatever the lens
    s.position.set(x, y + 0.4 + d * (0.01 + 0.006 * Math.abs(Math.sin(this.t * 3))), z); s.scale.set(k, k, 1);
  }
  dispose() { this.scene.remove(this.s); this.s.material.dispose(); }
}
