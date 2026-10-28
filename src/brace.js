// Seeing it coming and bracing for it (Sean). Anyone who can see a dust storm, a
// cold front, a tsunami or a tornado on its way - nothing tall between them and it,
// or up on a roof - runs for it, and drivers who see it turn round and drive away
// flat out. Those it is about to reach curl up in a ball where they are (in the
// street or on a roof), and when the wall hits, one in seven is picked up and
// tumbled along with it; the rest stay curled up while it passes.
import { ST } from './people.js';

const TALL = 4; // a building taller than this between them and it hides it

export class Brace {
  // near(x, z): [metres until it reaches (x, z), x, z of the nearest point of it], or null; o.range: how far off it is seen
  constructor(D, near, o = {}) {
    this.D = D; this.near = near; this.range = o.range ?? 240; this.curl = o.curl !== false;
    const N = D.ctx.people.x.length; this.seen = new Uint8Array(N); this.hit = new Uint8Array(N); this.cars = new Set();
    this.chunk = 0; this.tick = 0;
  }
  // nothing tall in the way from (x, z) to (fx, fz)
  clear(x, z, fx, fz) {
    const { city } = this.D.ctx, dx = fx - x, dz = fz - z, d = Math.hypot(dx, dz), n = Math.min(6, Math.max(2, Math.round(d / 35)));
    for (let k = 1; k <= n; k++) {
      const px = x + dx * k / (n + 1), pz = z + dz * k / (n + 1); let blocked = false;
      city.buildingsNear(px, pz, 0.1, (kb, dd, b) => { if (dd === 0 && !city.dead[kb] && b.top - b.baseY > TALL) blocked = true; });
      if (blocked) return false;
    }
    return true;
  }
  update(h) {
    if ((this.tick -= h) > 0) return;
    this.tick = 0.25;
    const { people: P, traffic: T } = this.D.ctx, N = P.active, q = this.chunk, n0 = Math.floor(N * q / 4), n1 = Math.floor(N * (q + 1) / 4);
    this.chunk = (q + 1) % 4;
    for (let i = n0; i < n1; i++) {
      const s = P.st[i], roof = s === ST.ROOF; if (!roof && !(P.lvl[i] === -1 && P.isCivilian(i))) continue;
      const a = this.near(P.x[i], P.z[i]); if (!a) continue;
      const d = a[0];
      if (this.curl && d > 0 && d < 12) { P.braceT[i] = Math.max(P.braceT[i], 3.5); continue; } // here it comes: down in a ball
      if (this.seen[i] || d < 12 || d > this.range || roof) continue; // on a roof there is nowhere to run
      if (!this.clear(P.x[i], P.z[i], a[1], a[2])) continue;
      this.seen[i] = 1; P.panic(i, a[1], a[2], -1);
    }
    if (q !== 0) return;
    for (const car of T.cars) { // drivers who see it: round and away as fast as they can
      if (car.mission || car.gone || car.mode !== 0 || this.cars.has(car)) continue;
      const a = this.near(car.x, car.z); if (!a || a[0] < 8 || a[0] > this.range * 1.3 || !this.clear(car.x, car.z, a[1], a[2])) continue;
      this.cars.add(car); car.panic = 30; car.zx = a[1]; car.zz = a[2];
      const tx = a[1] - car.x, tz = a[2] - car.z, tl = Math.hypot(tx, tz) || 1;
      if ((car.dx * tx + car.dz * tz) / tl > 0.3 && !car.turn && car.s > 8 && car.s < car.len - 9 && T.oppositeClear(car)) T.uturn(car); // heading straight for it: a U-turn
    }
  }
  // the wall reaches person i (once): one in seven goes up with it, tumbling (pushed along (dx, dz) at about sp m/s); the rest stay down
  wall(i, dx, dz, sp, gentle = null) {
    if (this.hit[i]) return false; this.hit[i] = 1;
    const P = this.D.ctx.people;
    if (Math.random() < 1 / 7) { const f = sp * (0.9 + Math.random() * 0.5); P.braceT[i] = 0; P.fling(i, dx * f, 8 + Math.random() * 7, dz * f); return true; }
    if (gentle) gentle(i); else if (this.curl) P.braceT[i] = Math.max(P.braceT[i], 3);
    return false;
  }
}
