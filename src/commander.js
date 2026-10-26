// Commander mode: three hidden outbreaks, alert level, Response Points, a
// 10 minute round, and units the player dispatches by tapping the map.
// Phase 1: police cruisers only.
import { ST } from './people.js';

export const UNITS = [
  { id: 'police', name: 'Police', cost: 50, cd: 20, alert: 0 },
];
const ALERTS = ['Quiet', 'Outbreak', 'Spreading', 'Major incident', 'City emergency'];
const ROUND = 600;
const START_RP = 100;
const OUTBREAK_AT = [3, 14, 26];

const CALLS = ['there is a man eating someone on the sidewalk!', 'they are attacking people outside my window', 'something is wrong with the people on my street', 'send help, they are everywhere', 'my neighbour just bit the mailman'];

const MSGS = {
  runover: 'A panicked driver plowed through a street somewhere',
  crash: 'Drivers are panicking and crashing. Look for the smoke',
  carfire: 'A wrecked car is burning',
  roof: 'Survivors are barricading themselves on a rooftop',
  breach: 'The horde piled up and reached a rooftop!',
  fire: 'An overrun building has caught fire',
  jump: 'Survivors are jumping from a burning roof',
  fallback: 'Officers are falling back! Too many zombies',
  copbit: 'An officer has been bitten',
};

export class Commander {
  constructor(g) {
    this.g = g; this.msgs = MSGS;
    this.el = {
      h: g.addPill('zd-h', 'Humans'), z: g.addPill('zd-z', 'Zombies'), d: g.addPill('zd-d', 'Dead'),
      rp: g.addPill('zd-rp', 'Points'), alert: g.addPill('zd-al', '', 'zd-alert'), clock: g.addPill('', '', 'zd-clock'),
    };
    this.el.alertPill = this.el.alert.parentElement;
    this.cards = {};
    for (const u of UNITS) {
      const b = g.addButton('zd-card-' + u.id, '<span class="nm">' + u.name + '</span><span class="cost">' + u.cost + ' pts</span><span class="cd"></span>', () => this.select(u.id), 'zd-card');
      this.cards[u.id] = { btn: b, cd: b.querySelector('.cd'), u };
    }
    g.addSpeedButton();
    g.addButton('zd-restart', 'Restart', () => this.start());
    this.end = document.createElement('div'); this.end.id = 'zd-end'; this.end.hidden = true;
    document.body.appendChild(this.end);
    this.start();
  }

  // ---------- round
  start() {
    const g = this.g, p = g.people;
    this.end.hidden = true;
    g.resetWorld(); g.setSpeed(1);
    this.t = 0; this.rp = START_RP; this.earned = 0; this.alert = 0; this.blocksInf = 0; this.fires = 0; this.ended = false;
    this.sel = null; this.cool = {}; for (const u of UNITS) this.cool[u.id] = 0;
    this.kills0 = 0; this.sent = 0; this.lost = 0; this.heatT = 0; this.spawned = 0; this.callT = 40;
    for (const c of Object.values(this.cards)) c.btn.classList.remove('sel');
    // three outbreak sites, well apart, away from the edge
    const B = g.city.bounds, pts = [];
    for (let tries = 0; tries < 200 && pts.length < 3; tries++) {
      const x = B.x0 + 50 + p.r() * (B.x1 - B.x0 - 100), z = B.z0 + 50 + p.r() * (B.z1 - B.z0 - 100);
      const w = p.snapWalkable(x, z, 20);
      if (!w || pts.some(q => Math.hypot(q[0] - w[0], q[1] - w[1]) < 140)) continue;
      pts.push(w);
    }
    this.outbreaks = pts.map((w, k) => ({ x: w[0], z: w[1], at: OUTBREAK_AT[k] ?? 30 + k * 10, fired: false }));
    g.lookAt(0, 0);
    this.hud();
    g.toast('Three 911 calls are coming in. Watch for panic, crashes and smoke, then send help', 5000);
  }

  district(x, z) {
    const B = this.g.city.bounds;
    const fx = (x - B.x0) / (B.x1 - B.x0), fz = (z - B.z0) / (B.z1 - B.z0);
    const ns = fz < 0.34 ? 'North' : fz > 0.66 ? 'South' : '', ew = fx < 0.34 ? 'West' : fx > 0.66 ? 'East' : '';
    return ns && ew ? ns + '-' + ew : ns || ew || 'Central';
  }

  select(id) {
    const c = this.cards[id];
    if (this.ended) return;
    if (this.sel === id) { this.sel = null; c.btn.classList.remove('sel'); return; }
    if (this.cool[id] > 0) { this.g.toast(c.u.name + ' is busy for ' + Math.ceil(this.cool[id]) + ' s'); return; }
    if (this.rp < c.u.cost) { this.g.toast('Not enough points. ' + c.u.name + ' costs ' + c.u.cost); return; }
    if (this.alert < c.u.alert) { this.g.toast(c.u.name + ' needs alert level ' + c.u.alert); return; }
    for (const o of Object.values(this.cards)) o.btn.classList.remove('sel');
    this.sel = id; c.btn.classList.add('sel');
    this.g.toast('Tap the map where the ' + c.u.name.toLowerCase() + ' should go');
  }

  tap(x, z) {
    if (this.ended) return;
    if (!this.sel) { this.g.toast('Pick a unit below, then tap the map'); return; }
    const id = this.sel;
    if (id === 'police') this.sendPolice(x, z);
  }

  sendPolice(x, z) {
    const g = this.g, c = this.cards.police;
    const car = g.traffic.dispatchTo(x, z, {
      onArrive: (ax, az) => { g.people.spawnOfficers(ax, az, 2); g.toast('Officers on scene in the ' + this.district(ax, az)); },
      onLost: () => { this.lost++; g.toast('A cruiser was wrecked on the way'); },
    });
    if (!car) { g.toast(g.traffic.missions.length >= 24 ? 'All cruisers are out' : 'No road to that spot'); return; }
    this.rp -= c.u.cost; this.cool.police = c.u.cd; this.sent++;
    this.sel = null; c.btn.classList.remove('sel');
    g.toast('Cruiser dispatched, about ' + Math.ceil(car.eta) + ' s out');
  }

  onEvent(e) {
    if (e.type === 'bite' && e.officer && !this.g.seen.copbit) { this.g.seen.copbit = true; this.g.toast(MSGS.copbit, 3200); }
  }

  // zombies per street block; a block with 3+ is infected
  heat() {
    const p = this.g.people, { sx, sz, NB } = this.g.city;
    const cnt = new Int16Array(NB * NB);
    for (let i = 0; i < p.active; i++) {
      const s = p.st[i];
      if (s !== ST.ZOMBIE && s !== ST.TURNING && s !== ST.PILE && s !== ST.CLIMB) continue;
      let bx = -1, bz = -1;
      for (let k = 0; k < NB; k++) { if (p.x[i] >= sx[k] && p.x[i] < sx[k + 1]) bx = k; if (p.z[i] >= sz[k] && p.z[i] < sz[k + 1]) bz = k; }
      if (bx >= 0 && bz >= 0) cnt[bz * NB + bx]++;
    }
    let n = 0; for (let k = 0; k < cnt.length; k++) if (cnt[k] >= 5) n++;
    this.blocksInf = n;
    let f = 0; for (const v of this.g.fire.bFire) if (v === 1) f++;
    this.fires = f;
    let a = 0;
    if (p.stats.zombies > 0 || n > 0) a = 1;
    if (n >= 2 || f > 0) a = 2;
    if (n >= 5) a = 3;
    if (n >= 10) a = 4;
    if (a > this.alert) {
      this.alert = a;
      if (a >= 2) this.g.toast('Alert raised: ' + ALERTS[a] + (n ? ' · ' + n + ' blocks overrun' : ''), 3500);
    }
  }

  update(sdt) {
    if (this.ended) return;
    const g = this.g, p = g.people;
    this.t += sdt;
    for (const o of this.outbreaks) {
      if (o.fired || this.t < o.at) continue;
      o.fired = true; this.spawned++;
      p.infectAt(o.x, o.z, 3);
      g.toast('911 from the ' + this.district(o.x, o.z) + ' district: "someone is biting people!"', 4200);
    }
    const income = (1 + p.stats.humans / 2000) * sdt;
    this.rp += income; this.earned += income;
    const k = p.stats.shot; if (k > this.kills0) { this.rp += k - this.kills0; this.earned += k - this.kills0; this.kills0 = k; }
    for (const id in this.cool) if (this.cool[id] > 0) this.cool[id] = Math.max(0, this.cool[id] - sdt);
    this.heatT += sdt;
    if (this.heatT >= 1) { this.heatT = 0; this.heat(); }
    // the switchboard: every so often a caller reports where they saw one
    this.callT -= sdt;
    if (this.callT <= 0 && p.stats.zombies > 0 && this.spawned === 3) {
      this.callT = 25 + p.r() * 15;
      const zs = []; for (let i = 0; i < p.active; i++) if (p.st[i] === ST.ZOMBIE && p.lvl[i] === -1) zs.push(i);
      if (zs.length) { const i = zs[Math.floor(p.r() * zs.length)]; g.toast('911 from the ' + this.district(p.x[i], p.z[i]) + ' district: "' + CALLS[Math.floor(p.r() * CALLS.length)] + '"', 4200); }
    }
    // end of round
    const hum = p.stats.humans, tot = p.nHuman;
    if (this.spawned === 3 && this.t > 40 && p.stats.zombies === 0 && p.stats.infected === 0) this.finish('contained');
    else if (hum < tot * 0.2) this.finish('lost');
    else if (this.t >= ROUND) this.finish('holdout');
    this.hud();
  }

  hud() {
    const p = this.g.people, s = p.stats, e = this.el;
    e.h.textContent = s.humans; e.z.textContent = s.zombies; e.d.textContent = s.dead;
    e.rp.textContent = Math.floor(this.rp);
    e.alert.textContent = this.alert ? 'Alert ' + this.alert + ' · ' + ALERTS[this.alert] : ALERTS[0];
    e.alertPill.className = 'zd-pill zd-al a' + this.alert;
    const left = Math.max(0, ROUND - this.t), m = Math.floor(left / 60), sec = Math.floor(left % 60);
    e.clock.textContent = m + ':' + String(sec).padStart(2, '0');
    for (const c of Object.values(this.cards)) {
      const cd = this.cool[c.u.id];
      c.cd.style.height = cd > 0 ? (100 * cd / c.u.cd) + '%' : '0';
      c.btn.classList.toggle('off', cd > 0 || this.rp < c.u.cost || this.alert < c.u.alert);
    }
  }

  finish(reason) {
    this.ended = true;
    const g = this.g, p = g.people, s = p.stats, tot = p.nHuman;
    let intact = 0; for (const v of g.fire.bFire) if (!v) intact++;
    const score = Math.round(this.earned + 10 * s.humans + 20 * intact);
    const frac = s.humans / tot;
    let stars = 0;
    if (reason === 'contained') stars = frac >= 0.9 ? 3 : 2;
    else if (reason === 'holdout') stars = frac >= 0.7 ? 2 : 1;
    const title = reason === 'contained' ? 'Outbreak contained' : reason === 'holdout' ? 'The city held out' : 'The city is lost';
    const sub = reason === 'contained' ? 'Every zombie is down. The city owes you a drink.' : reason === 'holdout' ? 'Ten minutes survived. The army arrives at dawn.' : 'The infection took the streets.';
    const t = Math.floor(this.t);
    const lines = [
      ['Survivors', s.humans.toLocaleString() + ' of ' + tot.toLocaleString()],
      ['Dead', s.dead.toLocaleString()],
      ['Zombies shot by police', s.shot.toLocaleString()],
      ['Cruisers sent / wrecked', this.sent + ' / ' + this.lost],
      ['Buildings burned', (g.fire.bFire.length - intact).toLocaleString()],
      ['Time', Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0')],
    ];
    this.end.innerHTML = '<div class="box"><h2>' + title + '</h2><div>' + sub + '</div>' +
      '<div class="stars">' + '★'.repeat(stars) + '<span>' + '★'.repeat(3 - stars) + '</span></div>' +
      lines.map(l => '<div class="line"><span>' + l[0] + '</span><b>' + l[1] + '</b></div>').join('') +
      '<div class="score">Score ' + score.toLocaleString() + '</div><button class="zd-btn" type="button" id="zd-again">Play again</button></div>';
    this.end.querySelector('#zd-again').onclick = () => this.start();
    this.end.hidden = false;
    g.setSpeed(1);
  }
}
