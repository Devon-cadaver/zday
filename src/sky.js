// The trip between a place and orbit. Going up, the camera pulls straight up off
// the city (the world curving away under it) into a layer of clouds rushing past,
// and the globe opens above them; coming down, the globe dives on the town into the
// clouds and the camera drops out of them over the streets. When the town is a
// different one the page has to be built again, so the clouds cover that too: a
// note in sessionStorage says the next page starts inside them.
const SKY_KEY = 'zd_sky';

// soft cloud puffs that tile, white on clear
function cloudCanvas(n) {
  const c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d'), img = g.createImageData(n, n), d = img.data;
  const hash = (x, y) => { let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const noise = (x, y, p) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const h = (i, j) => hash((xi + i) % p, (yi + j) % p);
    return (h(0, 0) * (1 - u) + h(1, 0) * u) * (1 - v) + (h(0, 1) * (1 - u) + h(1, 1) * u) * v;
  };
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    let s = 0, a = 0.5, f = 4, t = 0;
    for (let o = 0; o < 5; o++) { s += a * noise(x / n * f, y / n * f, f); t += a; a *= 0.5; f *= 2; }
    s /= t; const k = Math.max(0, Math.min(1, (s - 0.4) / 0.32)), al = k * k * (3 - 2 * k), i = (y * n + x) * 4, sh = 226 + 29 * s;
    d[i] = sh; d[i + 1] = sh + 2; d[i + 2] = Math.min(255, sh + 6); d[i + 3] = al * 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

export class Sky {
  constructor(camera, controls) {
    this.camera = camera; this.controls = controls;
    this.cover = 0; this.want = 0; this.rate = 1; this.z = 0; this.moving = 0; this.anim = null; this.home = null;
    const el = this.el = document.createElement('div'); el.id = 'zd-sky';
    el.style.cssText = 'position:fixed;inset:0;z-index:40;pointer-events:none;overflow:hidden;display:none';
    this.fill = document.createElement('div'); this.fill.style.cssText = 'position:absolute;inset:0;background:#e9eef3';
    el.appendChild(this.fill);
    const url = cloudCanvas(192).toDataURL();
    this.layers = [0, 1, 2].map(i => {
      const d = document.createElement('div');
      d.style.cssText = 'position:absolute;left:-50%;top:-50%;width:200%;height:200%;background:url(' + url + ') repeat;background-size:' + (46 + i * 14) + 'vmax;will-change:transform,opacity';
      el.appendChild(d); return d;
    });
    document.body.appendChild(el);
  }
  // this page was reached through the clouds (the note is read once)
  static arriving() { try { const s = sessionStorage.getItem(SKY_KEY); sessionStorage.removeItem(SKY_KEY); return !!s; } catch (e) { return false; } }
  static leaving() { try { sessionStorage.setItem(SKY_KEY, '1'); } catch (e) { /* no storage */ } }
  // the clouds to k (0 clear, 1 solid) over secs, or at once
  to(k, secs) { this.want = k; this.rate = 1 / Math.max(0.05, secs); }
  set(k) { this.cover = this.want = k; this.draw(); }
  update(dt) {
    const d = this.want - this.cover; this.cover += Math.sign(d) * Math.min(Math.abs(d), this.rate * dt);
    this.z += dt * (0.12 + this.moving * 0.75); // the puffs come on and pass by, quicker while the camera is moving
    this.draw();
  }
  draw() {
    if (this.cover <= 0.002) { if (this.el.style.display !== 'none') this.el.style.display = 'none'; return; }
    this.el.style.display = '';
    this.fill.style.opacity = (this.cover * this.cover * 0.92).toFixed(3);
    this.layers.forEach((L, i) => {
      const ph = (this.z + i / 3) % 1, s = 0.45 + ph * 2.7;
      L.style.transform = 'scale(' + s.toFixed(3) + ') rotate(' + (i * 47 + this.z * 5).toFixed(1) + 'deg)';
      L.style.opacity = (Math.min(1, this.cover * 1.25) * Math.sin(ph * Math.PI)).toFixed(3);
    });
  }
  // the city camera straight up off the place into the clouds; then() once inside them
  up(then) {
    const c = this.controls, tg = c.target, off = this.camera.position.clone().sub(tg), r = off.length(), p = Math.acos(Math.min(1, off.y / r));
    this.home = { r, p }; this.loosen();
    this.anim = { t: 0, dur: 1.5, r0: r, r1: 2600, p0: p, p1: 0.22, az: Math.atan2(off.x, off.z), up: true, then };
    this.moving = 1;
  }
  // from above the clouds down to the place (to the view it was left at, or r1 / the usual height)
  down(r1) {
    const c = this.controls, tg = c.target, off = this.camera.position.clone().sub(tg), h = this.home || { r: off.length(), p: Math.acos(Math.min(1, off.y / off.length())) };
    this.loosen(); this.set(1); this.to(0, 1.1);
    this.anim = { t: 0, dur: 2.3, r0: 2600, r1: r1 || h.r, p0: 0.22, p1: Math.max(0.6, h.p), az: Math.atan2(off.x, off.z) };
    this.moving = 1; this.home = null;
    this.step(0);
  }
  // the camera's way up or down, after the controls have had their say this frame
  step(dt) {
    const A = this.anim; if (!A) return;
    A.t += dt; const k = Math.min(1, A.t / A.dur), e = A.up ? k * k * k : 1 - Math.pow(1 - k, 3);
    const r = A.r0 + (A.r1 - A.r0) * e, p = A.p0 + (A.p1 - A.p0) * e, tg = this.controls.target;
    this.camera.position.set(tg.x + r * Math.sin(p) * Math.sin(A.az), tg.y + r * Math.cos(p), tg.z + r * Math.sin(p) * Math.cos(A.az)); this.camera.lookAt(tg);
    if (A.up && k > 0.42 && this.want < 1) this.to(1, A.dur * 0.55);
    if (k >= 1) {
      this.anim = null; this.moving = 0;
      if (!A.up) this.tighten();
      if (A.then) A.then();
    }
  }
  busy() { return !!this.anim; }
  // the controls let the camera go higher and straight down while it travels, and stay out of the way
  loosen() { const c = this.controls; if (!this.limits) this.limits = { minPolar: c.minPolarAngle, maxDist: c.maxDistance }; c.minPolarAngle = 0; c.maxDistance = 3000; c.enabled = false; }
  tighten() { const c = this.controls; if (this.limits) { c.minPolarAngle = this.limits.minPolar; c.maxDistance = this.limits.maxDist; this.limits = null; } c.enabled = true; }
}
