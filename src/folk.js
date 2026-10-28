// Folk: who each person is, on a card. Tap someone in the street (with no unit
// or disaster picked) and a card comes up over the bar: their name and age, what
// they do and where, what they are doing right now and how they feel about it,
// what sort of person they are, who they live with, their friends, the one
// they cannot stand, and anyone they have lost today. The names on it are links:
// tap one and the view goes to that person. Follow keeps the camera on them.
// Everything is made up from the person's number and the town's seed, so the same
// person is the same person every visit; a household shares a surname.
import * as THREE from 'three';
import { ARCHETYPES } from './figures.js';
import { ST, KIND, TRAIT } from './people.js';
import { CURVE } from './curve.js';

const FIRST = ['Ana', 'Leo', 'Sam', 'Priya', 'Marcus', 'Elena', 'Kofi', 'Mei', 'Jonah', 'Rosa', 'Theo', 'Aisha', 'Hugo', 'Nina', 'Omar', 'Clara',
  'Ravi', 'June', 'Felix', 'Lena', 'Diego', 'Hana', 'Owen', 'Zara', 'Ivan', 'Maya', 'Tariq', 'Iris', 'Caleb', 'Yuki', 'Ezra', 'Lucia', 'Malik', 'Ada',
  'Gus', 'Noor', 'Simon', 'Fern', 'Andre', 'Bea', 'Kenji', 'Sofia', 'Abe', 'Leila', 'Rory', 'Mira', 'Tomas', 'Wren', 'Idris', 'Pearl', 'Victor', 'Esme',
  'Jamal', 'Tess', 'Arlo', 'Dina', 'Benny', 'Lola', 'Hector', 'Nell', 'Raj', 'Odette', 'Milo', 'Gwen', 'Dario', 'Suki', 'Frank', 'Amara', 'Luis', 'Kit',
  'Boris', 'Vera', 'Nate', 'Alma', 'Quinn', 'Ruth', 'Eli', 'Joy', 'Pablo', 'Edie', 'Yusuf', 'Greta', 'Cy', 'Lorna', 'Dev', 'Ines', 'Walt', 'Hope'];
const LAST = ['Ortiz', 'Lee', 'Shah', 'Novak', 'Mensah', 'Chen', 'Kowalski', 'Reyes', 'Brennan', 'Okafor', 'Silva', 'Haddad', 'Larsen', 'Tanaka',
  'Moreau', 'Patel', 'Duval', 'Kim', 'Byrne', 'Rossi', 'Nakamura', 'Fischer', 'Adeyemi', 'Costa', 'Price', 'Ivanova', 'Quinn', 'Mendez', 'Abbott',
  'Sato', 'Holm', 'Garcia', 'Wolfe', 'Nguyen', 'Petrov', 'Kaur', 'Doyle', 'Marsh', 'Bianchi', 'Yilmaz', 'Hale', 'Osei', 'Varga', 'Keane', 'Lindqvist',
  'Ferreira', 'Park', 'Dubois', 'Ward', 'Amin', 'Torres', 'Blackwood', 'Fontaine', 'Ng', 'Rahman', 'Castillo', 'Murphy', 'Weiss', 'Achebe', 'Sorensen',
  'Pike', 'Morales', 'Hughes', 'Khan', 'Calloway', 'Ruiz', 'Brandt', 'Ito', 'Mwangi', 'Cruz', 'Fenwick', 'Zhou', 'Gallo', 'Vance', 'Ozturk', 'Lowe'];
// what they do: the titles each kind of person has (a casual worker's says where they work)
const JOBS = {
  business: ['accountant', 'lawyer', 'banker', 'insurance clerk', 'architect', 'office manager', 'analyst', 'receptionist', 'stockbroker', 'software developer', 'journalist', 'estate agent'],
  construction: ['builder', 'electrician', 'crane operator', 'welder', 'plumber', 'roofer', 'bricklayer', 'site foreman'],
  nurse: ['nurse', 'doctor', 'paramedic', 'pharmacist', 'care worker', 'surgeon'],
  casual: [['barista', 'a café'], ['waiter', 'a restaurant'], ['cook', 'a restaurant'], ['shop assistant', 'a shop'], ['cashier', 'a supermarket'], ['mechanic', 'a garage'],
    ['hairdresser', 'a salon'], ['cleaner', 'an office block'], ['courier', 'a depot'], ['postal worker', 'the post office'], ['librarian', 'the library'], ['teacher', 'a school'],
    ['baker', 'a bakery'], ['florist', 'a flower shop'], ['bartender', 'a bar'], ['tailor', 'a tailor\'s'], ['bus driver', 'the bus depot'], ['security guard', 'an office block']],
  shopper: ['stay-at-home parent', 'works nights, off today', 'out of work', 'on holiday this week', 'freelance writer'],
};
const AGES = { business: [24, 64], construction: [19, 61], nurse: [23, 64], student: [15, 25], casual: [17, 72], shopper: [22, 84], traveler: [21, 70], offduty: [24, 56], homeless: [22, 70] };
// nature: the strongest leanings, high or low
const NATURE = { fear: ['nervous', 'fearless'], greed: ['greedy', 'generous'], loyal: ['loyal', 'fickle'], curious: ['curious', 'set in their ways'], brave: ['brave', 'timid'], social: ['chatty', 'a loner'] };
const HOW = { [TRAIT.FIGHTER]: 'a fighter', [TRAIT.DRIVER]: 'never far from a car', [TRAIT.FAITHFUL]: 'devout' };
const ACT = { 1: 'On the way to work', 2: 'Heading home', 3: 'Off to the shops', 4: 'Going to meet people in the park', 5: 'Running for shelter', 6: 'Off to loot a shop', 8: 'Sticking close to the police' };

const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const CSS = `
#zd-person{order:0;width:100%;max-width:400px;box-sizing:border-box;background:rgba(28,20,12,.9);border:1px solid rgba(255,236,200,.22);border-radius:14px;
  padding:10px 12px 10px;color:#f6ead2;font:500 12px/1.35 system-ui,-apple-system,"Segoe UI",sans-serif;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);
  max-height:46vh;overflow-y:auto;box-shadow:0 6px 24px rgba(0,0,0,.35)}
#zd-person .hd{display:flex;align-items:flex-start;gap:8px}
#zd-person .nm{flex:1;font:800 16px/1.15 system-ui,-apple-system,"Segoe UI",sans-serif;color:#fff4e0}
#zd-person .nm small{font-weight:600;font-size:12px;opacity:.7;margin-left:4px}
#zd-person .job{opacity:.85;margin:2px 0 7px}
#zd-person .x{appearance:none;border:0;background:rgba(255,236,200,.1);color:#f6ead2;width:28px;height:28px;border-radius:14px;font:700 14px/1 system-ui,sans-serif;cursor:pointer;flex:none}
#zd-person .r{display:flex;gap:8px;padding:3px 0;border-top:1px solid rgba(255,236,200,.08)}
#zd-person .r > i{flex:none;width:64px;font-style:normal;font-size:10px;text-transform:uppercase;letter-spacing:.05em;opacity:.6;padding-top:2px}
#zd-person .r > span{flex:1;min-width:0}
#zd-person .now > span{color:#ffd88a;font-weight:700}
#zd-person a{color:#8fd3ff;text-decoration:none;font-weight:700;cursor:pointer}
#zd-person a.gone{color:#e07a6a}
#zd-person .gz{color:#a6ff4d}
#zd-person .meter{display:inline-block;vertical-align:middle;width:70px;height:6px;border-radius:3px;background:rgba(255,236,200,.15);margin-left:6px;overflow:hidden}
#zd-person .meter u{display:block;height:100%;background:linear-gradient(90deg,#9be08a,#ffc233,#ff6a4a)}
#zd-person .bt{display:flex;gap:6px;margin-top:8px}
#zd-person .bt .zd-btn{flex:1;padding:9px 8px;font-size:11px}
#zd-person .bt .zd-btn.on{border-color:#a6ff4d;color:#a6ff4d}
body.zd-person-on #zd-side,body.zd-person-on #zd-compass{display:none}
`;

export class Folk {
  constructor(g) {
    this.g = g; this.i = -1; this.tick = 0; this.html = '';
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    this.el = document.createElement('div'); this.el.id = 'zd-person'; this.el.hidden = true;
    this.el.addEventListener('click', (e) => {
      const a = e.target.closest('[data-p]'); if (a) { e.preventDefault(); this.show(+a.dataset.p, true); return; }
      if (e.target.closest('.x')) { this.hide(); return; }
      if (e.target.closest('.fol')) { this.toggleFollow(); return; }
      if (e.target.closest('.go')) { const q = this.where(this.i); if (q) this.g.lookAt(q[0], q[2], 120); }
    });
  }

  // ---------- who they are
  get P() { return this.g.people; }
  seed() { return (this.P.opts && this.P.opts.seed) || 99; }
  arch(i) { const P = this.P; return i < P.nHuman && P.kind[i] === KIND.CIVILIAN ? (ARCHETYPES[P.lives.arch[i]] || ARCHETYPES[0]).id : null; }
  first(i) { return FIRST[Math.floor(hash(this.seed(), i * 3 + 1) * FIRST.length)]; }
  surname(i) { // the household's (four in five keep it; the rest kept their own)
    const L = this.P.lives, H = L.hh[i] >= 0 ? L.households[L.hh[i]] : null, own = !H || H[0] === i || hash(this.seed(), i * 3 + 2) < 0.2;
    return LAST[Math.floor(hash(this.seed(), (own ? i : H[0]) * 5 + 7) * LAST.length)];
  }
  name(i) {
    const P = this.P, k = P.kind[i];
    if (k === KIND.ALIEN) return 'Alien';
    const s = this.surname(i);
    if (k === KIND.OFFICER) return 'Officer ' + s; if (k === KIND.SOLDIER) return 'Private ' + s; if (k === KIND.FIREFIGHTER) return 'Firefighter ' + s;
    return this.first(i) + ' ' + s;
  }
  age(i) { const a = AGES[this.arch(i)] || [25, 55], r = hash(this.seed(), i * 7 + 3); return Math.round(a[0] + (a[1] - a[0]) * r * r * (3 - 2 * r)); }
  district(x, z) { const D = this.g.disasters; return D && D.district ? D.district(x, z) : 'central'; }
  // what they do and where
  job(i) {
    const P = this.P, L = P.lives, id = this.arch(i), r = hash(this.seed(), i * 11 + 5), age = this.age(i), w = L.work[i], wd = w >= 0 ? ' in the ' + this.district(P.bld[w].door[0], P.bld[w].door[1]) + ' district' : '';
    const k = P.kind[i];
    if (k === KIND.OFFICER) return 'Police officer, on duty'; if (k === KIND.SOLDIER) return 'Soldier, on duty'; if (k === KIND.FIREFIGHTER) return 'Firefighter, on duty'; if (k === KIND.ALIEN) return 'Not from round here';
    const pick = (L) => L[Math.floor(r * L.length)];
    if (id === 'business') return cap(pick(JOBS.business)) + (w >= 0 ? ' at an office' + wd : '');
    if (id === 'construction') return cap(pick(JOBS.construction)) + (w >= 0 ? ' on a building site' + wd : '');
    if (id === 'nurse') return cap(pick(JOBS.nurse)) + (w >= 0 ? ' at the hospital' + wd : '');
    if (id === 'student') return (age < 18 ? 'At school' : 'Student at the college') + wd;
    if (id === 'casual') { if (w < 0) return age > 64 ? 'Retired' : 'Between jobs'; const [t, at] = pick(JOBS.casual); return cap(t) + ' at ' + at + wd; }
    if (id === 'shopper') return age > 64 ? 'Retired' : cap(pick(JOBS.shopper));
    if (id === 'traveler') return 'Visiting from out of town';
    if (id === 'offduty') return 'Police officer, off duty';
    if (id === 'homeless') return 'Sleeps rough';
    return '';
  }
  nature(i) {
    const P = this.P, L = P.lives, out = [];
    if (P.kind[i] !== KIND.CIVILIAN || i >= P.nHuman) return '';
    const lean = Object.keys(NATURE).map(k => [k, L.t[k][i] / 255 - 0.5]).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    for (const [k, v] of lean.slice(0, 2)) if (Math.abs(v) > 0.08) out.push(NATURE[k][v > 0 ? 0 : 1]);
    if (HOW[P.trait[i]]) out.push(HOW[P.trait[i]]);
    return out.length ? cap(out.join(', ')) : 'Easy-going';
  }
  link(j, rel) {
    const P = this.P, s = P.st[j], tag = s === ST.DEAD ? ' (dead)' : s === ST.ZOMBIE || s === ST.TURNING || s === ST.PILE || s === ST.CLIMB ? ' (turned)' : P.inf[j] ? ' (bitten)' : s === ST.EVAC ? ' (got away)' : '';
    return '<a data-p="' + j + '"' + (tag && tag !== ' (got away)' ? ' class="gone"' : '') + '>' + esc(this.name(j)) + '</a>' + (rel ? ' <small>(' + rel + ')</small>' : '') + (tag ? '<small>' + tag + '</small>' : '');
  }
  // what they are up to right now, and how they feel
  now(i) {
    const P = this.P, L = P.lives, s = P.st[i], T = L.trips.get(i), nm = (j) => this.link(j);
    if (P.kind[i] === KIND.ALIEN) return 'Hunting';
    if (s === ST.DEAD) return 'Dead';
    if (s === ST.ZOMBIE || s === ST.PILE || s === ST.CLIMB || s === ST.FALLING && P.wz[i]) return '<b class="gz">A zombie now</b>';
    if (s === ST.TURNING) return 'Turning';
    if (P.inf[i]) return 'Bitten, and feverish';
    if (s === ST.EVAC) return 'Got out of the city';
    if (P.kind[i] === KIND.OFFICER || P.kind[i] === KIND.SOLDIER) return s === ST.HELD ? 'Holding a suspect' : 'Keeping the peace';
    if (P.kind[i] === KIND.FIREFIGHTER) return 'Fighting the fire';
    if (s === ST.GO && T) {
      if (T.at && T.talk === 'chat') return 'Chatting with ' + nm(T.with);
      if (T.at && T.talk === 'argue') return 'Arguing with ' + nm(T.with);
      if (T.at && T.talk === 'grieve') return 'Grieving for ' + nm(T.with);
      if (T.at && T.fromX != null) return 'Frozen with fear';
      if (T.at && T.near) return 'Sticking close to the police';
      if (T.at) return T.act === 4 ? 'Hanging out' : 'Standing about';
      if (T.act === 7 && T.who >= 0) return 'Going to get ' + nm(T.who);
      if (T.act === 5 && T.b === L.home[i]) return 'Running home';
      if (T.act === 1 && this.arch(i) === 'student') return this.age(i) < 18 ? 'On the way to school' : 'On the way to college';
      return ACT[T.act] || 'On the way somewhere';
    }
    if (s === ST.INSIDE) {
      const b = P.bt[i];
      if (P.fx[i] !== 9) return 'Sheltering indoors';
      return b === L.home[i] ? 'At home' : b === L.work[i] ? (this.arch(i) === 'student' ? 'In class' : 'At work') : 'Inside a shop';
    }
    const S = { [ST.WALK]: 'Strolling round the block', [ST.IDLE]: 'Hanging around', [ST.FLEE]: 'Running for their life', [ST.RETURN]: 'Heading back to their block', [ST.GRABBED]: 'Grabbed!',
      [ST.SEEK]: 'Making for a rooftop', [ST.ROOF]: 'Waiting on a rooftop', [ST.JUMP]: 'Jumping!', [ST.BOARD]: 'Running for the evacuation bus', [ST.RIOT]: 'Rioting',
      [ST.FROZEN]: 'Frozen solid', [ST.FILM]: 'Filming it on their phone', [ST.HELD]: 'Under arrest', [ST.PRAY]: 'Praying', [ST.FIGHT]: 'Fighting back', [ST.STEAL]: 'Breaking into a car',
      [ST.SWIM]: 'Swimming for it', [ST.FALLING]: 'Falling!', [ST.AIR]: 'Being lifted to safety', [ST.EXT]: 'Being lifted to safety' };
    return S[s] || 'Getting on with their day';
  }
  mood(i) {
    const P = this.P, L = P.lives, s = P.st[i], T = L.trips.get(i);
    if (P.kind[i] !== KIND.CIVILIAN || i >= P.nHuman) return null;
    if (s === ST.DEAD || s === ST.EVAC) return null;
    if (s === ST.ZOMBIE || s === ST.TURNING || s === ST.PILE || s === ST.CLIMB) return ['Hungry', 1];
    const f = L.t.fear[i] / 255;
    if (P.inf[i]) return ['Feverish', 0.8];
    if (s === ST.FLEE || s === ST.SEEK || s === ST.SWIM || s === ST.GRABBED || s === ST.JUMP || s === ST.FALLING) return ['Terrified', 0.95];
    if (s === ST.PRAY) return ['Afraid', 0.75];
    if (s === ST.FIGHT || s === ST.RIOT) return ['Angry', 0.6];
    if (T && T.talk === 'argue') return ['Furious', 0.55];
    if (T && T.talk === 'grieve') return ['Heartbroken', 0.7];
    if (T && T.plan) return ['Scared', 0.5 + f * 0.4];
    if (L.lost[i]) return ['Shaken', 0.35 + f * 0.3];
    if (T && T.talk === 'chat') return ['Cheerful', 0.05];
    if (this.g.people.danger) return ['Uneasy', 0.25 + f * 0.3];
    return [f > 0.65 ? 'A bit on edge' : 'Calm', f * 0.3];
  }
  body(i) {
    const P = this.P, L = P.lives, civ = P.kind[i] === KIND.CIVILIAN && i < P.nHuman, R = (k, v, cls = '') => '<div class="r ' + cls + '"><i>' + k + '</i><span>' + v + '</span></div>';
    let h = '<div class="hd"><div class="nm">' + esc(this.name(i)) + (civ ? '<small>' + this.age(i) + '</small>' : '') + '</div><button type="button" class="x" aria-label="Close">✕</button></div>';
    h += '<div class="job">' + esc(this.job(i)) + '</div>';
    h += R('Now', this.now(i), 'now');
    const m = this.mood(i); if (m) h += R('Mood', m[0] + '<em class="meter"><u style="width:' + Math.round(Math.min(1, m[1]) * 100) + '%"></u></em>');
    if (civ) {
      h += R('Nature', esc(this.nature(i)));
      const H = L.hh[i] >= 0 ? L.households[L.hh[i]].filter(j => j !== i) : [], hm = L.home[i];
      const where = hm >= 0 ? (this.arch(i) === 'traveler' ? 'Staying at a hotel' : 'Lives') + ' in the ' + this.district(P.bld[hm].door[0], P.bld[hm].door[1]) + ' district' : 'No fixed address';
      h += R('Home', where + (H.length ? ' with ' + H.map(j => this.link(j)).join(', ') : hm >= 0 ? ', alone' : ''));
      const rel = (j) => (L.work[i] >= 0 && L.work[j] === L.work[i] ? (this.arch(i) === 'student' && this.arch(j) === 'student' ? 'classmate' : 'workmate') : L.home[j] === hm || P.blk[j] === P.blk[i] ? 'neighbour' : 'friend');
      const fr = [L.f1[i], L.f2[i]].filter(j => j >= 0);
      if (fr.length) h += R('Friends', fr.map(j => this.link(j, rel(j))).join(', '));
      if (L.foe[i] >= 0) h += R('Can’t stand', this.link(L.foe[i]));
      const lost = L.people(i).filter((j, k) => k < 6 && (L.lost[i] & (1 << k)));
      if (lost.length) h += R('Lost', lost.map(j => this.link(j)).join(', '));
    }
    const fol = this.following();
    h += '<div class="bt"><button type="button" class="zd-btn go">Show</button><button type="button" class="zd-btn fol' + (fol ? ' on' : '') + '">' + (fol ? 'Stop following' : 'Follow') + '</button></div>';
    return h;
  }

  // ---------- on the screen
  show(i, fly) {
    const g = this.g; if (!g.people || i < 0) return;
    this.i = i; this.html = '';
    if (!g.bar.contains(this.el)) g.bar.appendChild(this.el);
    this.el.hidden = false; document.body.classList.add('zd-person-on'); this.render();
    this.marker();
    if (fly) { const q = this.where(i); if (q) g.lookAt(q[0], q[2], Math.min(g.camera.position.distanceTo(g.controls.target), 160)); if (g.followSub && g.followSide === 'person') this.follow(); }
  }
  hide() {
    this.i = -1; this.el.hidden = true; document.body.classList.remove('zd-person-on'); if (this.ring) this.ring.visible = false;
    const g = this.g; if (g.followSub && g.followSide === 'person') g.setFollow(-1);
  }
  render() { const h = this.body(this.i); if (h !== this.html) { this.html = h; this.el.innerHTML = h; } }
  following() { const g = this.g; return !!(g.followSub && g.followSide === 'person' && g.followSub.obj === 'c' + this.i); }
  toggleFollow() { if (this.following()) this.g.setFollow(-1); else this.follow(); this.html = ''; this.render(); }
  follow() { const i = this.i, g = this.g; g.followSubject({ obj: 'c' + i, name: this.name(i), kind: 'person', pos: () => this.where(i) }, 'person'); if (g.camera.position.distanceTo(g.controls.target) > 200) g.zoomTo = 140; }
  // where they are to look at: their spot, or the door of the building they are in; nowhere once gone from the city
  where(i) {
    const P = this.g.people; if (!P || i >= P.active) return null;
    const s = P.st[i];
    if (s === ST.EVAC || s === ST.EXT || s === ST.AIR) return null;
    if (s === ST.INSIDE) { const b = P.bld[P.bt[i]]; return b && b.door ? [b.door[0], 1, b.door[1]] : [P.x[i], 1, P.z[i]]; }
    return [P.x[i], P.y[i] + 1, P.z[i]];
  }
  // a ring on the ground round them
  marker() {
    const D = this.g.disasters, scene = D && D.ctx && D.ctx.scene; if (!scene) return;
    if (!this.ring || this.ring.parent !== scene) {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.75, 1.05, 28), new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
      m.rotation.x = -Math.PI / 2; m.renderOrder = 5; scene.add(m); this.ring = m;
    }
  }
  // a tap on the city: the person nearest the finger, if there is one close enough (people drawn where the curve puts them)
  pick(cx, cy) {
    const g = this.g, P = g.people; if (!P) return -1;
    const m = g.mode; if (m.busy && m.busy()) return -1;
    const cam = g.camera, dist = cam.position.distanceTo(g.controls.target); if (dist > 650) return -1;
    const r = g.renderer.domElement.getBoundingClientRect(), v = this._v || (this._v = new THREE.Vector3()), k = CURVE.k.value, c = CURVE.c.value;
    const lim = 26 * 26; let best = -1, bd = lim;
    for (let i = 0; i < P.active; i++) {
      const s = P.st[i]; if (s === ST.INSIDE || s === ST.EVAC || s === ST.EXT || s === ST.AIR || P.y[i] < -5) continue;
      const x = P.x[i], z = P.z[i]; v.set(x, P.y[i] + 0.9 - k * ((x - c.x) ** 2 + (z - c.y) ** 2), z).project(cam);
      if (v.z > 1 || v.z < -1) continue;
      const dx = (v.x + 1) / 2 * r.width + r.left - cx, dy = (1 - v.y) / 2 * r.height + r.top - cy, d2 = dx * dx + dy * dy;
      if (d2 < bd - (P.kind[i] === KIND.CIVILIAN ? 30 : 0)) { bd = d2; best = i; } // the living a touch ahead of a crowd of the rest
    }
    return best;
  }
  // a tap: someone there opens their card; nothing there closes an open one (true: the tap is used)
  tap(cx, cy) {
    const i = this.pick(cx, cy);
    if (i >= 0) { this.show(i); return true; }
    if (this.i >= 0) { this.hide(); return true; }
    return false;
  }
  step(dt) {
    if (this.i < 0) return;
    const P = this.g.people; if (!P) { this.hide(); return; }
    const q = this.where(this.i), R = this.ring;
    if (R) { const s = P.st[this.i]; R.visible = !!q && s !== ST.INSIDE; if (q) { R.position.set(q[0], P.y[this.i] + 0.06, q[2]); const pulse = 1 + Math.sin(performance.now() / 260) * 0.08; R.scale.set(pulse, pulse, pulse); } }
    if ((this.tick -= dt) <= 0) { this.tick = 0.4; this.render(); }
  }
}
function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }
