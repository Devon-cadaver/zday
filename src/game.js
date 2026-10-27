// Shared game layer: HUD scaffolding, toasts, tap input, time speed, fixed-step
// simulation, follow camera. Modes plug in: Commander (send help to the city),
// Be The Disaster (drive one yourself) and Sandbox (drop zombies and disasters).
import * as THREE from 'three';
import { ST } from './people.js';
import { Commander } from './commander.js';
import { Profile, UNLOCK, UPGRADES, LEVELS, MAX_LEVEL, HAZARD_LEVEL, BE_LEVEL } from './profile.js';
import { HAZARDS, WEATHER, threatName } from './disasters.js';
import { BeTheDisaster, BE } from './be.js';
import { Gauge, SIZED } from './gauge.js';
import { Responders } from './response.js';

const CSS = `
#zd-top{position:fixed;left:0;right:0;top:0;display:flex;gap:6px;align-items:center;flex-wrap:wrap;
  padding:calc(8px + env(safe-area-inset-top)) max(10px, env(safe-area-inset-right)) 0 max(10px, env(safe-area-inset-left));pointer-events:none;
  font:600 12px/1 system-ui,-apple-system,"Segoe UI",sans-serif;color:#f6ead2;letter-spacing:.04em}
.zd-pill{display:flex;gap:6px;align-items:baseline;background:rgba(28,20,12,.62);border:1px solid rgba(255,236,200,.14);
  border-radius:8px;padding:6px 9px;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}
.zd-pill b{font-size:15px;font-variant-numeric:tabular-nums;letter-spacing:0}
.zd-pill i{font-style:normal;font-size:10px;opacity:.75;text-transform:uppercase}
.zd-h b{color:#fff4e0}.zd-i b{color:#ffc233}.zd-z b{color:#a6ff4d}.zd-d b{color:#e07a6a}.zd-rp b{color:#7be0ff}
.zd-al{border-color:rgba(255,120,60,.35)}.zd-al b{color:#ffb070;font-size:12px;letter-spacing:.03em}
.zd-al.a3 b{color:#ff8a4a}.zd-al.a4 b{color:#ff5a3a}
#zd-clock{margin-left:auto;opacity:.85;font-variant-numeric:tabular-nums}
#zd-bar{position:fixed;left:0;right:0;bottom:0;display:flex;gap:8px;justify-content:center;align-items:flex-end;flex-wrap:wrap;
  padding:0 max(10px, env(safe-area-inset-right)) calc(10px + env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-left))}
.zd-btn{appearance:none;border:1px solid rgba(255,236,200,.18);background:rgba(28,20,12,.72);color:#f6ead2;border-radius:10px;
  font:700 12px/1 system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.06em;text-transform:uppercase;padding:11px 12px;
  backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);touch-action:manipulation;cursor:pointer;min-width:52px;position:relative;overflow:hidden}
.zd-btn:active{transform:translateY(1px)}
.zd-btn:focus-visible{outline:2px solid #a6ff4d;outline-offset:2px}
#zd-drop{background:rgba(70,98,34,.85);border-color:rgba(166,255,77,.5);display:flex;gap:8px;align-items:center}
#zd-drop .n{background:#a6ff4d;color:#1d2a0e;border-radius:6px;padding:3px 6px;font-variant-numeric:tabular-nums}
#zd-drop.empty{background:rgba(28,20,12,.72);border-color:rgba(255,236,200,.18);opacity:.7}
#zd-find.on{border-color:#a6ff4d;color:#a6ff4d}
.zd-cards{display:flex;gap:6px;overflow-x:auto;flex:1 1 100%;max-width:100%;scrollbar-width:none;-webkit-overflow-scrolling:touch;padding:2px 0}
.zd-cards::-webkit-scrollbar{display:none}
.zd-cards > :first-child{margin-left:auto}.zd-cards > :last-child{margin-right:auto}
.zd-cards .zd-card{flex:none}
.zd-card{display:flex;flex-direction:column;gap:4px;align-items:center;min-width:62px;padding:8px 7px 7px;text-transform:none;letter-spacing:.02em}
.zd-card .nm{font-size:11px;white-space:nowrap}
.zd-card .cost{font-size:11px;color:#7be0ff;font-variant-numeric:tabular-nums}
.zd-card .cd{position:absolute;left:0;right:0;bottom:0;height:0;background:rgba(255,236,200,.18);pointer-events:none}
.zd-card.sel{border-color:#a6ff4d;box-shadow:0 0 0 2px rgba(166,255,77,.35) inset;background:rgba(60,88,30,.85)}
.zd-card.off{opacity:.45}
.zd-nuke{border-color:rgba(255,90,60,.5)}.zd-nuke .cost{color:#ff8a6a}
#zd-toast{position:fixed;left:50%;top:calc(150px + env(safe-area-inset-top));transform:translateX(-50%);max-width:min(88vw,420px);
  background:rgba(28,20,12,.8);color:#f6ead2;border:1px solid rgba(255,236,200,.16);border-radius:10px;padding:9px 12px;
  font:600 13px/1.35 system-ui,-apple-system,"Segoe UI",sans-serif;text-align:center;pointer-events:none;transition:opacity .4s;opacity:0}
#zd-call{position:fixed;left:50%;top:calc(96px + env(safe-area-inset-top));transform:translateX(-50%);display:flex;gap:8px;align-items:center;max-width:min(92vw,440px);
  background:rgba(60,22,14,.82);color:#ffd9cc;border:1px solid rgba(255,120,90,.35);border-radius:10px;padding:7px 8px 7px 12px;font:600 12px/1.3 system-ui,-apple-system,"Segoe UI",sans-serif;z-index:3}
#zd-call[hidden]{display:none}
#zd-call .t{flex:1;min-width:0}
#zd-call .zd-btn{padding:8px 12px;background:rgba(200,60,40,.9);border-color:rgba(255,160,130,.5);min-width:0}
#zd-fps{position:fixed;right:max(8px, env(safe-area-inset-right));bottom:calc(74px + env(safe-area-inset-bottom));font:10px system-ui,sans-serif;color:#f6ead2;opacity:.45;pointer-events:none}
#zd-end{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(14,10,6,.78);z-index:5;
  padding:max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left));box-sizing:border-box;font:14px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;color:#f6ead2}
#zd-end[hidden]{display:none}
#zd-end .box{background:rgba(32,24,14,.95);border:1px solid rgba(255,236,200,.18);border-radius:14px;padding:22px 22px 18px;max-width:360px;width:100%;text-align:center}
#zd-end h2{margin:0 0 4px;font-size:24px;letter-spacing:.02em}
#zd-end .stars{font-size:30px;letter-spacing:6px;color:#ffc233;margin:4px 0 10px}
#zd-end .stars span{opacity:.25}
#zd-end .line{display:flex;justify-content:space-between;gap:12px;padding:5px 0;border-top:1px solid rgba(255,236,200,.1);font-variant-numeric:tabular-nums}
#zd-end .line b{color:#fff4e0}
#zd-end .score{font-size:20px;margin:12px 0 4px;color:#7be0ff}
#zd-end .zd-btn{margin-top:12px;background:rgba(70,98,34,.9);border-color:rgba(166,255,77,.5);padding:13px 22px;font-size:13px}
#zd-menu{position:fixed;inset:0;z-index:6;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at 50% 40%,rgba(20,14,8,.55),rgba(14,10,6,.86));
  padding:max(16px, env(safe-area-inset-left));font:14px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;color:#f6ead2}
#zd-menu[hidden]{display:none}
#zd-menu .box{width:100%;max-width:380px;background:rgba(32,24,14,.92);border:1px solid rgba(255,236,200,.18);border-radius:16px;text-align:center;max-height:100%;display:flex;flex-direction:column;overflow:hidden}
#zd-menu .mbody{overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding:22px 20px 18px;min-height:0;flex:1 1 auto}
#zd-menu .mhead{display:flex;align-items:center;gap:12px;padding:10px 12px;border-bottom:1px solid rgba(255,236,200,.14);flex:none;background:rgba(24,18,10,.6)}
#zd-menu .mhead .zd-btn{padding:9px 12px;font-size:12px;min-width:0;flex:none}
#zd-menu .mhead .mt{flex:1;text-align:left;font-weight:800;font-size:15px;letter-spacing:.14em;text-transform:uppercase;color:#fff4e0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#zd-menu h1{margin:0;font-size:30px;line-height:1.05;letter-spacing:.12em;color:#fff4e0}
#zd-menu .tag{font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.7;margin:2px 0 14px}
#zd-menu .rank{display:flex;justify-content:space-between;align-items:baseline;font-size:13px;margin:0 0 6px}
#zd-menu .rank b{font-size:16px;color:#a6ff4d}
#zd-menu .bar{height:8px;border-radius:4px;background:rgba(255,236,200,.12);overflow:hidden;margin:0 0 4px}
#zd-menu .bar i{display:block;height:100%;background:linear-gradient(90deg,#7be0ff,#a6ff4d)}
#zd-menu .next{font-size:11px;opacity:.7;margin:0 0 16px}
#zd-menu .btns{display:flex;flex-direction:column;gap:9px}
#zd-menu .zd-btn{padding:14px 16px;font-size:14px}
#zd-menu .zd-btn.main{background:rgba(70,98,34,.9);border-color:rgba(166,255,77,.5)}
#zd-menu .zd-btn.dim{opacity:.8}
#zd-menu .list{text-align:left;margin:14px 0 0;display:flex;flex-direction:column;gap:6px}
#zd-menu .row{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:8px 10px;border-radius:9px;background:rgba(255,236,200,.05);border:1px solid rgba(255,236,200,.1)}
#zd-menu .row.locked{opacity:.5}
#zd-menu .row .n{font-weight:700;font-size:13px}
#zd-menu .row .d{font-size:11px;opacity:.75}
#zd-menu .row .s{font-size:11px;white-space:nowrap;color:#ffc233;font-variant-numeric:tabular-nums}
#zd-menu .row .zd-btn{padding:8px 10px;font-size:11px;min-width:0}
#zd-menu .row > div{min-width:0}
#zd-menu .row .zd-btn, #zd-menu .row .s{flex:none}
#zd-menu .row .zd-btn.own-go{background:rgba(70,98,34,.9);border-color:rgba(166,255,77,.5)}
#zd-menu .row .zd-btn.own{background:rgba(70,98,34,.9);border-color:rgba(166,255,77,.5);pointer-events:none}
#zd-menu .back{margin-top:12px}
#zd-menu .foot{font-size:11px;opacity:.55;margin:12px 0 0}
#zd-end .xp{font-size:13px;color:#7be0ff;margin:4px 0 0}
#zd-end .lvl{font-size:15px;color:#a6ff4d;font-weight:700;margin:6px 0 0}
#zd-end .row2{display:flex;gap:8px;justify-content:center}
#zd-dis{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(64px + env(safe-area-inset-bottom));width:min(94vw,440px);background:rgba(28,20,12,.9);
  border:1px solid rgba(255,236,200,.16);border-radius:12px;padding:10px;z-index:3;font:600 11px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;color:#f6ead2}
#zd-dis[hidden]{display:none}
#zd-dis .h{font-size:10px;letter-spacing:.1em;text-transform:uppercase;opacity:.7;margin:2px 2px 6px}
#zd-dis .g{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:8px}
#zd-dis .g.w{grid-template-columns:repeat(4,1fr);margin-bottom:0}
#zd-dis .zd-btn{padding:10px 4px;min-width:0;font-size:11px;letter-spacing:.03em;text-transform:none}
#zd-dis .zd-btn.sel{border-color:#a6ff4d;color:#a6ff4d}
#zd-dis .zd-btn.zb{color:#a6ff4d;border-color:rgba(166,255,77,.35)}
#zd-dis .zd-btn.zb.empty{opacity:.5}
#zd-dis .zd-btn.hero{color:#ffe08a;border-color:rgba(255,224,138,.45)}
#zd-dis .zd-btn.auto{color:#7be0ff;border-color:rgba(123,224,255,.4)}
#zd-dis .zd-btn.auto.off{color:#f6ead2;opacity:.6;border-color:rgba(255,236,200,.18)}
#zd-dis .g.one{grid-template-columns:1fr 1fr}
#zd-disb.on{border-color:#ff9a5a;color:#ffb070}
@media (prefers-reduced-motion: reduce){#zd-toast{transition:none}}
`;

// what each unit does, for the unlocks page
const UNIT_DESC = { police: 'Officers who fight zombies and arrest rioters', bus: 'Takes people out of a dangerous street', build: 'Rebuilds a fallen building', camp: 'Shelters people nearby until the rebuilding is done',
  chaser: 'Spots tornadoes and aliens and calls in help', boat: 'Pulls people out of flood water', fire: 'Puts out burning buildings', hazmat: 'Clears radiation so rebuilding can start', seeder: 'Weakens tornadoes and breaks up storms',
  water: 'Drops water on a fire', rescue: 'Lifts survivors off a rooftop', heroes: 'Dragonfly, Nova and Tempo: they beat super villains and throw meteors and missiles into space',
  apc: 'A squad of soldiers to hold a crossing', strike: 'Bombs one spot', nuke: 'Wipes out a whole district' };
const THREAT_HINT = { villains: 'Blur, Tyrant and Weaver. Only the super heroes can beat them' };
const UNIT_NAMES = { heroes: 'Super heroes (hero signal)', build: 'Construction crew', camp: 'Medical camp', hazmat: 'Hazmat team', police: 'Police cruiser', bus: 'Evacuation bus', chaser: 'Storm chaser', seeder: 'Cloud seeder', boat: 'Rescue boat', fire: 'Fire truck', water: 'Water helicopter', rescue: 'Rescue helicopter', apc: 'Army APC', strike: 'Airstrike', nuke: 'Nuke' };

// the city runs on its own behind the menu
class Idle {
  constructor() { this.msgs = {}; }
  update() {}
  tap() {}
  phase() { return 0.06; }
}

export class Game {
  constructor({ people, traffic, fire, city, camera, controls, renderer, mode, daylight, helis, post, disasters }) {
    Object.assign(this, { people, traffic, fire, city, camera, controls, renderer, daylight, helis, post, disasters });
    this.flash = 0; this.shake = 0;
    if (disasters) disasters.ctx.game = this;
    this.pendingFires = []; this.simT = 0; this.realT = 0; this.acc = 0; this.speed = 1; this.follow = -1; this.seen = {};
    people.fire = fire; traffic.people = people; traffic.fire = fire;
    people.onOverrun = (k, why) => { if (Math.random() < (why === 'breach' ? 0.25 : 0.3)) this.pendingFires.push({ k, t: this.simT + 3 + Math.random() * 8 }); };
    this.profile = new Profile();
    this.buildUI();
    this.bindInput();
    this.menu = document.createElement('div'); this.menu.id = 'zd-menu'; this.menu.hidden = true;
    document.body.appendChild(this.menu);
    if (mode === 'sandbox') this.mode = new Sandbox(this);
    else if (mode === 'commander') this.mode = new Commander(this);
    else if (mode === 'be' || mode === 'storm') { // ?mode=be&kind=lava starts that disaster, ?mode=be alone opens the picker
      const d = new URLSearchParams(location.search).get('kind') || (mode === 'storm' ? 'tornado' : '');
      if (BE[d] && this.profile.level >= BE_LEVEL[d]) this.mode = new BeTheDisaster(this, d);
      else { this.mode = new Idle(); this.showMenu('be'); }
    } else { this.mode = new Idle(); this.showMenu(); }
  }

  startMode(which, kind) {
    this.menu.hidden = true;
    this.top.innerHTML = ''; this.bar.innerHTML = '';
    this.mode = which === 'sandbox' ? new Sandbox(this) : which === 'be' ? new BeTheDisaster(this, kind) : new Commander(this);
  }

  // ---------- main menu and unlocks
  showMenu(panel = 'main') {
    const pr = this.profile, lvl = pr.level, next = pr.nextXp;
    const rank = '<div class="rank"><span>Commander level <b>' + lvl + '</b></span><span>' + pr.xp.toLocaleString() + ' XP' + (next ? ' / ' + next.toLocaleString() : '') + '</span></div>' +
      '<div class="bar"><i style="width:' + Math.round(pr.progress * 100) + '%"></i></div>' +
      '<div class="next">' + (next ? (next - pr.xp).toLocaleString() + ' XP to level ' + (lvl + 1) + this.nextUnlockText(lvl + 1) : 'Maximum level') + '</div>';
    let body, head = '';
    const top = (title) => '<div class="mhead"><button class="zd-btn" type="button" data-go="main">\u2039 Back</button><div class="mt">' + title + '</div></div>';
    if (panel === 'main') {
      const beOpen = Object.keys(BE).filter(k => lvl >= BE_LEVEL[k]).length;
      body = '<h1>MY TINY<br>DISASTER</h1><div class="tag">Save the city, or be the disaster</div>' + rank +
        '<div class="btns"><button class="zd-btn main" type="button" data-go="commander">Play · Commander</button>' +
        '<button class="zd-btn" type="button" data-go="unlocks">Units and upgrades' + (pr.bank >= 3000 && UPGRADES.some(u => pr.canBuy(u.id)) ? ' · upgrade available' : '') + '</button>' +
        '<button class="zd-btn" type="button" data-go="be">Be The Disaster · ' + beOpen + ' of ' + Object.keys(BE).length + ' unlocked</button>' +
        '<button class="zd-btn dim" type="button" data-go="sandbox">Sandbox · drop zombies and disasters</button>' +
        '<a class="zd-btn dim" href="showcase.html" style="text-decoration:none;display:block">Roster · every model</a></div>' +
        '<div class="foot">' + pr.data.rounds + ' rounds played · best score ' + pr.data.best.toLocaleString() + ' · ' + pr.data.stars + ' stars' + (pr.ok ? '' : ' · progress is not being saved on this device') + '</div>';
    } else if (panel === 'be') {
      const bests = pr.data.beBest || {};
      head = top('Be The Disaster');
      body = '<div class="tag">One finger drives it, two fingers move the camera</div>' + rank +
        '<div class="list">' + Object.keys(BE).sort((a, b) => BE_LEVEL[a] - BE_LEVEL[b]).map(k => {
          const ok = lvl >= BE_LEVEL[k];
          return '<div class="row' + (ok ? '' : ' locked') + '"><div><div class="n">' + BE[k].name + '</div><div class="d">' + (ok ? BE[k].hint + (bests[k] ? ' · best ' + bests[k].toLocaleString() : '') : 'Unlocks at commander level ' + BE_LEVEL[k]) + '</div></div>' +
            (ok ? '<button class="zd-btn own-go" type="button" data-be="' + k + '">Play</button>' : '<span class="s">L' + BE_LEVEL[k] + '</span>') + '</div>';
        }).join('') + '</div>' +
        '<div class="btns back"><button class="zd-btn" type="button" data-go="main">Back</button></div>';
    } else {
      const units = Object.keys(UNIT_NAMES).sort((a, b) => UNLOCK[a] - UNLOCK[b]).map(id => {
        const need = UNLOCK[id], ok = lvl >= need;
        return '<div class="row' + (ok ? '' : ' locked') + '"><div><div class="n">' + UNIT_NAMES[id] + '</div><div class="d">' + (UNIT_DESC[id] || '') + (ok ? '' : (UNIT_DESC[id] ? ' · ' : '') + 'unlocks at level ' + need) + '</div></div><span class="s">' + (ok ? '✓' : 'L' + need) + '</span></div>';
      }).join('');
      const ups = UPGRADES.map(u => {
        const own = pr.has(u.id), can = pr.canBuy(u.id), locked = lvl < u.level;
        return '<div class="row' + (locked ? ' locked' : '') + '"><div><div class="n">' + u.name + '</div><div class="d">' + u.desc + '</div></div>' +
          (own ? '<button class="zd-btn own" type="button">Owned</button>' : locked ? '<span class="s">L' + u.level + '</span>' : '<button class="zd-btn" type="button" data-buy="' + u.id + '"' + (can ? '' : ' disabled style="opacity:.5"') + '>' + u.cost.toLocaleString() + ' XP</button>') + '</div>';
      }).join('');
      head = top('Units and upgrades');
      body = '<div class="tag">' + pr.bank.toLocaleString() + ' XP to spend</div>' + rank + '<div class="tag" style="margin-top:14px">Units</div>' +
        '<div class="list">' + units + '</div><div class="tag" style="margin-top:16px">Upgrades</div><div class="list">' + ups + '</div>' +
        '<div class="tag" style="margin-top:16px">Threats</div><div class="list">' + Object.keys(HAZARD_LEVEL).map(h => '<div class="row' + (lvl >= HAZARD_LEVEL[h] ? '' : ' locked') + '"><div><div class="n">' + threatName(h) + '</div><div class="d">' + (THREAT_HINT[h] ? THREAT_HINT[h] + ' · ' : '') + (lvl >= HAZARD_LEVEL[h] ? 'Can strike during a round' : 'Starts at level ' + HAZARD_LEVEL[h]) + '</div></div><span class="s">L' + HAZARD_LEVEL[h] + '</span></div>').join('') + '</div>' +
        '<div class="btns back"><button class="zd-btn" type="button" data-go="main">Back</button></div>';
    }
    this.menu.innerHTML = '<div class="box">' + head + '<div class="mbody">' + body + '</div></div>';
    this.menu.hidden = false;
    this.menu.querySelectorAll('[data-go]').forEach(b => { b.onclick = () => { const go = b.dataset.go; if (go === 'commander' || go === 'sandbox') this.startMode(go); else this.showMenu(go); }; });
    this.menu.querySelectorAll('[data-be]').forEach(b => { b.onclick = () => this.startMode('be', b.dataset.be); });
    this.menu.querySelectorAll('[data-buy]').forEach(b => { b.onclick = () => { if (pr.buy(b.dataset.buy)) { this.toast('Upgrade bought'); this.showMenu('unlocks'); } }; });
  }

  nextUnlockText(level) {
    const units = Object.keys(UNLOCK).filter(id => UNLOCK[id] === level).map(id => UNIT_NAMES[id]);
    const ups = UPGRADES.filter(u => u.level === level).map(u => u.name);
    const all = units.concat(ups), hz = Object.keys(HAZARD_LEVEL).filter(h => HAZARD_LEVEL[h] === level).map(threatName);
    const be = Object.keys(BE_LEVEL).filter(k => BE_LEVEL[k] === level && level > 1).map(k => BE[k].name);
    return (all.length ? ' · unlocks ' + all.join(', ') : '') + (hz.length ? ' · new threat: ' + hz.join(', ') : '') + (be.length ? ' · be the ' + be.join(', ').toLowerCase() : '');
  }

  buildUI() {
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    this.top = document.createElement('div'); this.top.id = 'zd-top';
    this.bar = document.createElement('div'); this.bar.id = 'zd-bar';
    const toast = document.createElement('div'); toast.id = 'zd-toast';
    const fps = document.createElement('div'); fps.id = 'zd-fps';
    document.body.append(this.top, this.bar, toast, fps);
    const old = document.getElementById('hud'); if (old) old.remove();
    this.el = { toast, fps };
  }
  addPill(cls, label, id) {
    const d = document.createElement('div'); d.className = 'zd-pill ' + cls;
    d.innerHTML = '<b>0</b>' + (label ? '<i>' + label + '</i>' : '');
    if (id) d.id = id;
    this.top.appendChild(d);
    return d.querySelector('b');
  }
  addButton(id, html, onClick, cls = '') {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'zd-btn ' + cls; b.id = id; b.innerHTML = html;
    b.onclick = onClick; this.bar.appendChild(b);
    return b;
  }
  addSpeedButton() {
    this.speedBtn = this.addButton('zd-speed', '1x', () => { this.speed = this.speed >= 4 ? 1 : this.speed * 2; this.speedBtn.textContent = this.speed + 'x'; });
  }
  setSpeed(s) { this.speed = s; if (this.speedBtn) this.speedBtn.textContent = s + 'x'; }

  toast(msg, ms = 2600) {
    const t = this.el.toast; t.textContent = msg; t.style.opacity = '1';
    clearTimeout(this._tt); this._tt = setTimeout(() => { t.style.opacity = '0'; }, ms);
  }

  bindInput() {
    const dom = this.renderer.domElement;
    const downs = new Map();
    let multi = false;
    dom.addEventListener('pointerdown', (e) => {
      downs.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now() });
      if (downs.size > 1) multi = true;
    });
    const up = (e) => {
      const d = downs.get(e.pointerId); downs.delete(e.pointerId);
      if (!d) return;
      const wasMulti = multi; if (downs.size === 0) multi = false;
      if (e.type !== 'pointerup' || wasMulti || e.button > 0) return;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 10 && performance.now() - d.t < 400) {
        const hit = this.worldPoint(e.clientX, e.clientY);
        if (hit) this.mode.tap(hit.x, hit.z);
      }
    };
    dom.addEventListener('pointerup', up);
    dom.addEventListener('pointercancel', up);
    this.controls.addEventListener('start', () => { this.zoomTo = 0; if (this.follow >= 0) this.setFollow(-1); });
    this.ray = new THREE.Raycaster(); this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  }

  worldPoint(cx, cy) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    return this.ray.ray.intersectPlane(this.plane, hit) ? hit : null;
  }

  // pan (and optionally zoom) the camera to a point
  lookAt(x, z, dist = 0) {
    const tg = this.controls.target;
    this.camera.position.x += x - tg.x; this.camera.position.z += z - tg.z; tg.x = x; tg.z = z;
    if (dist) this.zoomTo = dist;
  }

  resetWorld() {
    if (this.disasters) this.disasters.reset();
    this.fire.reset(); this.city.uncharAll(); this.traffic.reset(); this.pendingFires.length = 0; if (this.helis) this.helis.reset();
    this.city.restoreAll();
    this.people.reset();
    this.simT = 0; this.shake = 0; this.seen = {}; this.setFollow(-1);
  }

  setFollow(i) {
    this.follow = i;
    if (this.followBtn) { this.followBtn.classList.toggle('on', i >= 0); this.followBtn.textContent = i >= 0 ? 'Following' : 'Follow'; }
  }

  cycleFollow() {
    const p = this.people, tg = this.controls.target;
    let i = -1;
    if (this.follow >= 0) { i = p.nearestZombie(p.x[this.follow], p.z[this.follow], this.follow); if (i < 0) i = this.follow; }
    else i = p.nearestZombie(tg.x, tg.z);
    if (i < 0) { this.toast('No zombies yet. Tap a street to drop one'); return; }
    this.setFollow(i);
    if (this.camera.position.distanceTo(tg) > 260) this.zoomTo = 230;
  }

  update(dt, fps) {
    const p = this.people, h = 1 / 30;
    const sdt = dt * this.speed;
    this.acc = Math.min(this.acc + sdt, h * 12);
    while (this.acc >= h) {
      p.step(h); this.traffic.step(h); if (this.helis) this.helis.update(h); if (this.disasters) this.disasters.update(h); this.acc -= h; this.simT += h;
      for (const e of p.events) if (e.type === 'bite') this.traffic.panicNear(e.x, e.z, 20);
      this.mode.afterStep && this.mode.afterStep(h);
    }
    for (let k = this.pendingFires.length - 1; k >= 0; k--) {
      if (this.simT >= this.pendingFires[k].t) { this.fire.igniteBuilding(this.pendingFires[k].k); this.pendingFires.splice(k, 1); }
    }
    this.realT += dt;
    p.uTime.value = this.realT;
    this.traffic.sync(this.realT);
    if (this.helis) this.helis.sync(dt * this.speed);
    if (this.daylight) { this.daylight.set(this.mode.phase ? this.mode.phase() : 0); if (this.disasters) { this.disasters.weather.apply(dt); this.disasters.afterLight(); } this.daylight.update(); }
    this.fire.update(sdt, this.realT, this.camera, this.renderer);
    p.sync();
    if (this.disasters) this.disasters.sync(dt * this.speed, this.realT);

    if (this.follow >= 0) {
      let f = this.follow;
      if (p.st[f] !== ST.ZOMBIE && p.st[f] !== ST.FALLING) { f = p.nearestZombie(p.x[f], p.z[f]); this.setFollow(f); }
      if (f >= 0) {
        const tg = this.controls.target, k = 1 - Math.exp(-dt * 3);
        const dx = (p.x[f] - tg.x) * k, dz = (p.z[f] - tg.z) * k;
        tg.x += dx; tg.z += dz; this.camera.position.x += dx; this.camera.position.z += dz;
      }
    }
    if (this.zoomTo) {
      const tg = this.controls.target, off = this.camera.position.clone().sub(tg), d = off.length();
      const nd = d + (this.zoomTo - d) * (1 - Math.exp(-dt * 3));
      this.camera.position.copy(tg).addScaledVector(off, nd / d);
      if (Math.abs(nd - this.zoomTo) < 1) this.zoomTo = 0;
    }

    const msgs = this.mode.msgs;
    const dEv = this.disasters ? this.disasters.events : [];
    for (const list of [p.events, this.traffic.events, this.fire.events, this.helis ? this.helis.events : [], dEv]) {
      for (const e of list) {
        if (this.disasters) this.disasters.onEvent(e);
        const handled = this.mode.onEvent ? this.mode.onEvent(e) : false;
        if (list === dEv && e.text && handled !== true) this.toast(e.text, 4200);
        if (msgs[e.type] && !this.seen[e.type]) { this.seen[e.type] = true; this.toast(msgs[e.type], 3200); }
      }
      list.length = 0;
    }
    this.mode.update(sdt, dt);
    if (this.flash > 0) { this.flash = Math.max(0, this.flash - dt * 0.6); this.post.opts.flash = Math.min(1, this.flash * this.flash); } else this.post.opts.flash = 0;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 1.2);
    if (fps) this.el.fps.textContent = fps + ' fps';
  }
}

const SANDBOX_MSGS = {
  bite: 'First bite! The victim is infected and will turn soon',
  turned: 'A victim has turned. The outbreak is spreading',
  runover: 'A panicked driver plowed through the street',
  crash: 'Panicked drivers are crashing',
  carfire: 'A wrecked car is burning',
  roof: 'Survivors are barricading themselves on the rooftops',
  breach: 'The horde piled up and reached a rooftop!',
  fire: 'A building has caught fire',
  jump: 'Survivors are jumping from a burning roof',
};
const START_DROPS = 3;

class Sandbox {
  constructor(g) {
    this.g = g; this.msgs = SANDBOX_MSGS;
    if (g.disasters) g.disasters.boats.auto = true; // rescue boats come by themselves here
    this.auto = new Responders(g); // and so does everyone else, unless you switch them off
    this.el = {
      h: g.addPill('zd-h', 'Humans'), i: g.addPill('zd-i', 'Infected'), z: g.addPill('zd-z', 'Zombies'), d: g.addPill('zd-d', 'Dead'),
      clock: g.addPill('', '', 'zd-clock'),
    };
    g.followBtn = g.addButton('zd-find', 'Follow', () => g.cycleFollow());
    g.addSpeedButton();
    this.disBtn = g.addButton('zd-disb', 'Disasters', () => {
      if (this.pending) { const was = this.pending; this.pending = null; this.gauge.cancel(); this.close(); g.toast(was === 'zombies' ? 'Done dropping zombies' : 'Cancelled'); return; } // the button cancels a disaster waiting to be placed
      this.panel.style.bottom = (g.bar.offsetHeight + 8) + 'px'; this.panel.hidden = !this.panel.hidden; this.disBtn.classList.toggle('on', !this.panel.hidden); });
    g.addButton('zd-reset', 'Reset', () => this.reset());
    g.addButton('zd-menu-btn', 'Menu', () => { location.href = location.pathname; });
    this.buildPanel(); this.bindHold();
    this.dropsLeft = START_DROPS; this.clock = -1; this.milestone = 0;
    g.toast('Open Disasters to drop zombies or unleash a disaster', 4500);
  }
  buildPanel() {
    const g = this.g, d = document.createElement('div'); d.id = 'zd-dis'; d.hidden = true;
    d.innerHTML = '<div class="h">Disasters</div><div class="g"><button class="zd-btn zb" type="button" data-zb>Zombies · ' + START_DROPS + '</button>' + Object.keys(HAZARDS).map(h => '<button class="zd-btn" type="button" data-hz="' + h + '">' + HAZARDS[h].name + '</button>').join('') + '</div>' +
      '<div class="h">Help</div><div class="g one"><button class="zd-btn auto" type="button" data-auto>Auto responders: On</button><button class="zd-btn hero" type="button" data-hero>Hero signal \u262E</button></div>' +
      '<div class="h">Weather</div><div class="g w">' + Object.keys(WEATHER).map(w => '<button class="zd-btn" type="button" data-wx="' + w + '">' + WEATHER[w].name.replace('Thunderstorm', 'Storm') + '</button>').join('') + '</div>';
    document.body.appendChild(d); this.panel = d; this.zbBtn = d.querySelector('[data-zb]');
    const autoBtn = d.querySelector('[data-auto]');
    autoBtn.onclick = () => { this.auto.setOn(!this.auto.on); autoBtn.textContent = 'Auto responders: ' + (this.auto.on ? 'On' : 'Off'); autoBtn.classList.toggle('off', !this.auto.on); g.toast(this.auto.on ? 'Responders will answer every disaster and rebuild afterwards' : 'Responders off: nobody comes to help', 3500); };
    d.querySelector('[data-hero]').onclick = () => { const tg = g.controls.target; g.disasters.start('heroes', tg.x, tg.z); this.pending = null; this.close(); if (this.clock < 0) this.clock = 0; }; // the peace sign goes up over the middle of the view
    this.zbBtn.onclick = () => { // armed until the Shamblers run out or you tap Done: every tap on a street drops one
      if (this.dropsLeft <= 0) { g.toast('No Shamblers left. Tap Reset to start over'); return; }
      this.pending = 'zombies'; d.querySelectorAll('[data-hz]').forEach(o => o.classList.remove('sel'));
      this.panel.hidden = true; this.zombieLabel();
      g.toast('Tap streets to drop Shambler zombies (' + this.dropsLeft + ' left)', 4000);
    };
    d.querySelectorAll('[data-hz]').forEach(b => { b.onclick = () => {
      const h = b.dataset.hz;
      if (HAZARDS[h].tap) { // out of the way so you can see where it goes
        this.pending = h; d.querySelectorAll('[data-hz]').forEach(o => o.classList.toggle('sel', o.dataset.hz === h));
        this.panel.hidden = true; this.disBtn.textContent = 'Cancel ' + HAZARDS[h].name.toLowerCase();
        if (SIZED[h]) { g.controls.enabled = false; g.toast('Press and hold where it goes: the longer you hold, the bigger it gets. Let go to drop it', 4500); } // the finger sizes it instead of moving the camera
        else g.toast('Tap the map where the ' + HAZARDS[h].name.toLowerCase() + ' should strike', 4000);
        return;
      }
      g.disasters.start(h); this.close(); if (this.clock < 0) this.clock = 0;
    }; });
    d.querySelectorAll('[data-wx]').forEach(b => { b.onclick = () => { g.disasters.weather.set(b.dataset.wx); g.toast('Weather: ' + WEATHER[b.dataset.wx].name); this.close(); }; });
  }
  zombieLabel() {
    if (this.zbBtn) { this.zbBtn.textContent = 'Zombies · ' + this.dropsLeft; this.zbBtn.classList.toggle('empty', this.dropsLeft <= 0); }
    if (this.pending === 'zombies') this.disBtn.textContent = 'Done · ' + this.dropsLeft + ' left';
  }
  close() { this.panel.hidden = true; this.disBtn.classList.remove('on'); this.disBtn.textContent = 'Disasters'; if (!this.gauge.active) this.g.controls.enabled = true; }
  // meteors, tornadoes, black holes, volcanoes, sinkholes and warheads: press, hold to size it (drag to aim), let go and it lands
  bindHold() {
    const g = this.g, dom = g.renderer.domElement;
    this.gauge = new Gauge(g.disasters.ctx.scene);
    dom.addEventListener('pointerdown', (e) => {
      if (!this.pending || !SIZED[this.pending] || e.button > 0 || this.gauge.active) return;
      const p = g.worldPoint(e.clientX, e.clientY); if (!p) return;
      this.gauge.start(this.pending, p.x, p.z); this.growId = e.pointerId; this.noTapUntil = Infinity;
    });
    dom.addEventListener('pointermove', (e) => { if (this.gauge.active && e.pointerId === this.growId) { const p = g.worldPoint(e.clientX, e.clientY); if (p) this.gauge.move(p.x, p.z); } });
    const up = (e) => {
      if (!this.gauge.active || e.pointerId !== this.growId) return;
      const r = this.gauge.release();
      this.pending = null; this.panel.querySelectorAll('[data-hz]').forEach(o => o.classList.remove('sel'));
      g.disasters.start(r.kind, r.x, r.z, r.opts);
      if (this.clock < 0) this.clock = 0;
      this.noTapUntil = performance.now() + 400; this.close();
    };
    dom.addEventListener('pointerup', up); dom.addEventListener('pointercancel', up);
  }
  tap(x, z) {
    const g = this.g;
    if (this.gauge.active || performance.now() < (this.noTapUntil || 0)) return; // that press was sizing a disaster
    if (this.pending === 'zombies') {
      const i = g.people.drop(x, z);
      if (i < 0) { g.toast('Too far from a street. Tap closer to a road'); return; }
      this.dropsLeft--; if (this.clock < 0) this.clock = 0;
      if (this.dropsLeft <= 0) { this.pending = null; this.close(); g.toast('That was the last Shambler'); }
      this.zombieLabel();
      return;
    }
    if (this.pending) {
      const h = this.pending; this.pending = null; this.panel.querySelectorAll('[data-hz]').forEach(o => o.classList.remove('sel'));
      g.disasters.start(h, x, z); this.close(); if (this.clock < 0) this.clock = 0;
      return;
    }
    if (performance.now() > (this.hintAt || 0)) { this.hintAt = performance.now() + 5000; g.toast('Open Disasters to drop zombies or unleash a disaster'); }
  }
  onEvent(e) { this.auto.onEvent(e); }
  reset() {
    this.auto.reset();
    this.g.resetWorld();
    this.dropsLeft = START_DROPS; if (this.pending === 'zombies') { this.pending = null; this.close(); } this.zombieLabel();
    this.clock = -1; this.milestone = 0;
    this.g.toast('City reset. Open Disasters to drop zombies or unleash a disaster');
  }
  phase() { return (Math.max(0, this.clock) / 600) % 1; }
  update(sdt, dt) {
    this.gauge.update(dt || 0);
    this.auto.update(sdt);
    if (this.gauge.active) { const g = this.g, R = SIZED[this.gauge.kind].ring(this.gauge.v), d = g.camera.position.distanceTo(g.controls.target), want = Math.min(g.controls.maxDistance || 1200, R * 3); if (want > d + 5) g.zoomTo = want; } // pull back to keep the ring in view
    const s = this.g.people.stats;
    if (this.clock >= 0) this.clock += sdt;
    for (const m of [10, 50, 100, 250, 500, 1000, 2000]) if (s.zombies >= m && this.milestone < m) { this.milestone = m; this.g.toast(m + ' zombies roam the city'); }
    this.el.h.textContent = s.humans; this.el.i.textContent = s.infected; this.el.z.textContent = s.zombies; this.el.d.textContent = s.dead;
    if (this.clock >= 0) { const t = Math.floor(this.clock); this.el.clock.textContent = 'T+' + String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); }
    else this.el.clock.textContent = 'Waiting';
  }
}
