// Earthquake: the ground shakes for several seconds, buildings near the
// epicentre come down in clouds of dust (tall ones more often), cracks run out
// across the streets, drivers crash, broken gas lines start fires, and an
// aftershock often follows.
export class Quake {
  constructor(D, x, z, mag = 7, opts = {}) {
    this.type = 'quake'; this.D = D; this.x = x; this.z = z; this.mag = mag;
    this.R = 70 + (mag - 6) * 95; this.dur = 8 + (mag - 6) * 3.5; this.t = 0; this.tick = 0; this.alive = true;
    const { city } = D.ctx;
    this.falls = [];
    city.buildingsNear(x, z, this.R, (k, d, b) => {
      const I = Math.pow(1 - d / this.R, 1.2), hgt = b.top - b.baseY;
      const p = I * (0.12 + hgt / 70) * Math.max(0.3, (mag - 5.6) / 1.6);
      if (Math.random() < p) this.falls.push({ k, t: 1.2 + Math.random() * (this.dur - 2), dir: Math.atan2(((b.z0 + b.z1) / 2) - z, ((b.x0 + b.x1) / 2) - x) + (Math.random() - 0.5) });
    });
    this.falls.sort((a, b) => a.t - b.t);
    // cracks: chains of jagged segments running out from the epicentre
    this.cracks = [];
    const n = 10 + Math.round((mag - 6) * 6);
    for (let i = 0; i < n; i++) {
      let a = Math.random() * 6.28, px = x + Math.cos(a) * 4, pz = z + Math.sin(a) * 4;
      const len = 4 + Math.floor(Math.random() * (3 + mag - 6) * 2.5);
      for (let s = 0; s < len; s++) {
        a += (Math.random() - 0.5) * 0.7; const L = 9 + Math.random() * 7;
        this.cracks.push({ x: px + Math.cos(a) * L / 2, z: pz + Math.sin(a) * L / 2, L, rot: -a, w: Math.max(0.8, 2.4 - s * 0.18), t: 0.3 + s * 0.22 + Math.random() * 0.4 });
        px += Math.cos(a) * L; pz += Math.sin(a) * L;
      }
    }
    this.gas = Math.round((mag - 5.8) * 2);
    this.aftershock = !opts.after && Math.random() < 0.6;
    D.emit({ type: 'warn', hazard: 'quake', x, z, r: this.R * 0.6, exact: true, text: (opts.after ? 'Aftershock! Magnitude ' : 'Earthquake! Magnitude ') + mag.toFixed(1) + ' under the ' + D.district(x, z) + ' district' });
  }

  update(h) {
    const D = this.D, { people, traffic, fire, city } = D.ctx;
    this.t += h;
    const env = this.t < 1 ? this.t : this.t > this.dur ? Math.max(0, 1 - (this.t - this.dur) / 2) : 1;
    D.shake((0.35 + (this.mag - 6) * 0.35) * env * (0.7 + Math.random() * 0.3));
    while (this.cracks.length && this.cracks[0].t <= this.t) { const c = this.cracks.shift(); D.decals.add('crack', c.x, c.z, c.L, c.w * 2.2, c.rot); }
    while (this.falls.length && this.falls[0].t <= this.t) {
      const f = this.falls.shift();
      if (D.destroyBuilding(f.k, 'collapse', { dir: f.dir })) {
        if (Math.random() < 0.18) city.buildingsNear((city.buildings[f.k].x0 + city.buildings[f.k].x1) / 2, (city.buildings[f.k].z0 + city.buildings[f.k].z1) / 2, 14, (k2) => { if (Math.random() < 0.3) fire.igniteBuilding(k2); });
      }
    }
    if (this.t < this.dur && (this.tick -= h) <= 0) {
      this.tick = 0.3;
      people.scare(this.x, this.z, this.R, 0.25);
      traffic.near(this.x, this.z, this.R, (car) => { if (car.mode === 0 && !car.mission && car.v > 4 && Math.random() < 0.05 * env) traffic.crash(car, null, 7); });
      if (this.gas > 0 && Math.random() < 0.08) { // a gas main goes up
        const k = Math.floor(Math.random() * city.buildings.length), b = city.buildings[k];
        if (Math.hypot((b.x0 + b.x1) / 2 - this.x, (b.z0 + b.z1) / 2 - this.z) < this.R * 0.7 && fire.igniteBuilding(k)) { this.gas--; D.emit({ type: 'gasfire', k, text: 'A gas line exploded' }); }
      }
    }
    if (this.t > this.dur + 2) {
      this.alive = false;
      if (this.aftershock) { const a = Math.random() * 6.28, d = 30 + Math.random() * 80; D.later(18 + Math.random() * 20, () => D.start('quake', this.x + Math.cos(a) * d, this.z + Math.sin(a) * d, { mag: this.mag - 1.1 - Math.random() * 0.5, after: true })); }
    }
  }
  sync() {}
  dispose() {}
}
