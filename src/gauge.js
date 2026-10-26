// Hold to size a disaster before it lands: while the finger is down a ring on
// the map shows how far it will reach and a bar names how big it is; it grows
// the longer you hold (slowly at first, then faster) and the disaster appears
// at that size when you let go. Used by the Sandbox and Be The Disaster.
import * as THREE from 'three';

const T_MAX = 5; // seconds of holding to reach the biggest
const ef = (s) => Math.max(0, Math.min(5, Math.floor(s * 2 - 0.999)));
const tier = (v, list) => { let n = list[0][1]; for (const [at, name] of list) if (v >= at) n = name; return n; };

// per disaster: the size range, the reach shown by the ring, the words on the bar and what to pass to D.start
export const SIZED = {
  meteor: { min: 6, max: 125, color: '#ff8a3a', ring: (v) => (v >= 40 ? v * 3.2 : v * 2.2),
    label: (v) => Math.round(v * 2) + ' m crater · ' + tier(v, [[6, 'Fireball'], [15, 'Building buster'], [28, 'Block buster'], [45, 'City killer'], [80, 'Extinction event'], [112, 'Planet killer']]),
    opts: (v) => ({ size: v }) },
  tornado: { min: 0.8, max: 4.5, color: '#c9c2b6', ring: (v) => (8 + 6 * v) * 1.6,
    label: (v) => (v > 3.05 ? 'EF5+ monster wedge' : 'EF' + ef(v)) + ' · ' + Math.round((8 + 6 * v) * 2) + ' m wide',
    opts: (v) => ({ size: v }) },
  blackhole: { min: 2, max: 23, color: '#b98cff', ring: (v) => Math.min(112, 3 + v * 4.6) + 20,
    label: (v) => Math.round(Math.min(112, 3 + v * 4.6) * 2) + ' m void · ' + tier(v, [[2, 'Pinhole'], [6, 'Hungry'], [12, 'Block eater'], [18, 'District eater']]),
    opts: (v) => ({ size: v }) },
  volcano: { min: 0.5, max: 3, color: '#ff5a2a', ring: (v) => 90 * v,
    label: (v) => tier(v, [[0.5, 'Vent'], [1, 'Volcano'], [1.8, 'Stratovolcano'], [2.5, 'Supervolcano']]) + ' · ' + Math.round(90 * v * 2) + ' m of lava',
    opts: (v) => ({ size: v }) },
  sinkhole: { min: 5, max: 112, color: '#c9a77a', ring: (v) => v,
    label: (v) => Math.round(v * 2) + ' m across · ' + tier(v, [[5, 'Pothole'], [15, 'Sinkhole'], [40, 'Crater'], [80, 'Abyss']]),
    opts: (v) => ({ size: v }) },
  nuclear: { min: 80, max: 420, color: '#ffd23a', ring: (v) => v,
    label: (v) => Math.round(v) + ' m blast · ' + tier(v, [[80, 'Tactical'], [180, 'Strategic'], [300, 'City buster'], [380, 'Tsar']]),
    opts: (v) => ({ size: v }) },
};

export class Gauge {
  constructor(scene) {
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.965, 1, 96).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.8, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, fog: false }));
    this.disc = new THREE.Mesh(new THREE.CircleGeometry(1, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.12, depthWrite: false, depthTest: false, fog: false }));
    this.ring.renderOrder = 10; this.disc.renderOrder = 10; this.ring.visible = this.disc.visible = false;
    scene.add(this.ring, this.disc);
    const el = this.el = document.createElement('div');
    el.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);top:calc(96px + env(safe-area-inset-top));width:min(86vw,360px);background:rgba(28,20,12,.82);border:1px solid rgba(255,236,200,.2);border-radius:10px;padding:8px 10px;z-index:4;font:700 12px/1.25 system-ui,-apple-system,"Segoe UI",sans-serif;color:#f6ead2;letter-spacing:.03em;pointer-events:none;display:none';
    el.innerHTML = '<div class="t"></div><div style="height:8px;border-radius:4px;background:rgba(255,236,200,.14);margin-top:6px;overflow:hidden"><i style="display:block;height:100%;width:0"></i></div>';
    document.body.appendChild(el);
    this.txt = el.querySelector('.t'); this.bar = el.querySelector('i');
    this.kind = null;
  }
  get active() { return !!this.kind; }
  start(kind, x, z) { this.kind = kind; this.t = 0; this.x = x; this.z = z; this.S = SIZED[kind]; this.v = this.S.min; this.show(true); this.draw(); }
  move(x, z) { if (this.kind) { this.x = x; this.z = z; } }
  update(dt) {
    if (!this.kind) return;
    this.t += dt;
    const f = Math.min(1, this.t / T_MAX); this.f = f;
    this.v = this.S.min + (this.S.max - this.S.min) * Math.pow(f, 1.7);
    this.draw();
  }
  draw() {
    const S = this.S, R = S.ring(this.v), c = new THREE.Color(S.color), pulse = 0.75 + 0.25 * Math.sin(performance.now() / 120);
    this.ring.position.set(this.x, 0.5, this.z); this.ring.scale.setScalar(R); this.ring.material.color.copy(c).multiplyScalar(1.6); this.ring.material.opacity = 0.85 * pulse;
    this.disc.position.set(this.x, 0.45, this.z); this.disc.scale.setScalar(R); this.disc.material.color.copy(c);
    this.txt.textContent = (this.kind === 'nuclear' ? 'Warhead' : this.kind[0].toUpperCase() + this.kind.slice(1).replace('hole', ' hole')) + ' · ' + S.label(this.v) + (this.f >= 1 ? ' · MAX' : '');
    this.bar.style.width = Math.round((this.f || 0) * 100) + '%'; this.bar.style.background = 'linear-gradient(90deg,#f6ead2,' + S.color + ')';
  }
  // let go: returns { kind, x, z, opts } for D.start
  release() {
    if (!this.kind) return null;
    const r = { kind: this.kind, x: this.x, z: this.z, v: this.v, opts: this.S.opts(this.v) };
    this.kind = null; this.show(false);
    return r;
  }
  cancel() { this.kind = null; this.show(false); }
  show(on) { this.ring.visible = this.disc.visible = on; this.el.style.display = on ? 'block' : 'none'; }
}
