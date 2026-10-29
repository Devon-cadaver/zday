// A hero's fight with a villain (Sean; after the kaiju game's close combat in Tornado Alley): the hero has flown in and
// caught the villain, who hangs there, held. WEAK SPOTS: glowing circles pop up over the villain one after another and
// each is there only about a second - tap it and the hero lands a blow, miss it and the villain lands one. Then the
// villain is dazed: SPIN & TOSS - circle a finger round and round to whirl the villain about the hero, and with enough
// turns the villain is hurled away across the town; too slow and the villain breaks free. After a throw, FLY AT THEM
// sends the hero straight after the villain for the next round. flight.js runs it (a hero's Lock on); the villains'
// own hurt, toss and beat (brawl.js, villains.js) do the rest.
import * as THREE from 'three';
import { toss } from './brawl.js';
import { sfx } from './audio.js';

const CSS = `
#zd-duel{position:fixed;left:0;top:0;right:0;bottom:0;z-index:32;touch-action:none}
#zd-duel .pan{position:absolute;left:50%;top:calc(66px + env(safe-area-inset-top));transform:translateX(-50%);width:min(86vw,360px);text-align:center;color:#fff;font:800 13px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.04em;text-shadow:0 1px 3px #000;pointer-events:none}
#zd-duel .bar{height:8px;margin-top:6px;border-radius:4px;background:rgba(0,0,0,.45);overflow:hidden}
#zd-duel .bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#ff5ad5,#ffd27a)}
#zd-duel .vhp{margin-top:6px;font-size:11px;font-weight:700;opacity:.9}
#zd-duel .spot{position:absolute;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;border:3px solid #fff;background:radial-gradient(circle,rgba(255,240,140,.95),rgba(255,120,60,.55) 60%,rgba(255,80,40,0) 72%);box-shadow:0 0 16px 4px rgba(255,200,80,.85);animation:zdSpot 1.05s linear forwards}
#zd-duel .spot.pop{animation:zdPop .2s ease-out forwards}
#zd-duel .spot.miss{animation:zdMiss .25s ease-out forwards}
@keyframes zdSpot{from{transform:scale(1.25)}to{transform:scale(.55);opacity:.55}}
#zd-duel .spot.slow{animation-duration:1.52s}
@keyframes zdPop{to{transform:scale(1.7);opacity:0}}
@keyframes zdMiss{to{transform:scale(.3);opacity:0;filter:hue-rotate(-60deg)}}
#zd-duel .acts{position:absolute;left:50%;bottom:calc(130px + env(safe-area-inset-bottom));transform:translateX(-50%);display:flex;gap:8px}
#zd-duel .acts button{appearance:none;border:2px solid rgba(255,255,255,.4);border-radius:14px;padding:14px 18px;font:900 14px system-ui,-apple-system,sans-serif;letter-spacing:.06em;color:#fff;background:linear-gradient(#ff5ad5,#a0168a);box-shadow:0 0 16px rgba(255,90,213,.6);cursor:pointer}
#zd-duel .ring{position:absolute;left:50%;top:50%;width:200px;height:200px;margin:-100px 0 0 -100px;border-radius:50%;border:3px dashed rgba(255,255,255,.55);pointer-events:none;animation:zdTurn 1.2s linear infinite}
@keyframes zdTurn{to{transform:rotate(360deg)}}
`;

export class Duel {
  // F: the flight (the hero flying), v: the villain caught
  constructor(F, v) {
    this.F = F; this.v = v; this.g = F.g; this.phase = 'spots'; this.t = 0; this.live = []; this.spawned = 0; this.total = 6; this.next = 0.35;
    this.pow = F.P.punch || 1; this.life = 1.05 * (F.P.slow || 1); // how hard this hero hits; how long a spot lasts (Tempo slows time)
    v.heroWin = true; // the player's own fight: win it and they are beaten (not the odds the heroes get on their own)
    if (!document.getElementById('zd-duel-css')) { const s = document.createElement('style'); s.id = 'zd-duel-css'; s.textContent = CSS; document.head.appendChild(s); }
    const el = this.el = document.createElement('div'); el.id = 'zd-duel';
    el.innerHTML = '<div class="pan"><div class="ttl"></div><div class="bar"><i></i></div><div class="vhp"></div></div><div class="acts"></div>';
    document.body.appendChild(el);
    this.ttl = el.querySelector('.ttl'); this.barI = el.querySelector('.bar i'); this.vhp = el.querySelector('.vhp'); this.acts = el.querySelector('.acts');
    v.gripped = true; if (v.dropHeld) v.dropHeld(); // held where it is
    this.title('🎯 WEAK SPOTS! TAP THEM!'); sfx('thud', v.x, v.y + 2, v.z, { gain: 0.8 });
    // the spin: a finger going round the middle of the screen
    el.addEventListener('pointerdown', (e) => { if (this.phase === 'spin') { this.last = Math.atan2(e.clientY - innerHeight / 2, e.clientX - innerWidth / 2); e.preventDefault(); } });
    el.addEventListener('pointermove', (e) => { if (this.phase !== 'spin' || this.last == null) return; const a = Math.atan2(e.clientY - innerHeight / 2, e.clientX - innerWidth / 2); let d = a - this.last; d = Math.atan2(Math.sin(d), Math.cos(d)); this.ang += Math.abs(d); this.spinA += d; this.last = a; });
    el.addEventListener('pointerup', () => { this.last = null; });
  }
  title(s) { this.ttl.textContent = s; }
  // where the villain is on the screen
  screen() { const v = this.v, p = new THREE.Vector3(v.x, (v.y || 0) + 2.4, v.z).project(this.F.ctx.camera); return [(p.x + 1) / 2 * innerWidth, (1 - p.y) / 2 * innerHeight]; }
  hit(n) { const v = this.v; this.g.disasters.brawl.hurt(v, n * this.pow, { name: this.F.P.name }); this.g.fire.burst(v.x, (v.y || 0) + 2.4, v.z, 6, 0.8); this.F.punch = 0.25; }
  spot() {
    const [sx, sy] = this.screen(), x = Math.max(40, Math.min(innerWidth - 40, sx + (Math.random() - 0.5) * 150)), y = Math.max(140, Math.min(innerHeight - 230, sy + (Math.random() - 0.5) * 170));
    const b = document.createElement('div'); b.className = 'spot' + (this.life > 1.2 ? ' slow' : ''); b.style.left = x + 'px'; b.style.top = y + 'px'; this.el.appendChild(b);
    const s = { b, life: this.life, dead: false }; this.live.push(s);
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (s.dead) return; s.dead = true; b.classList.add('pop'); setTimeout(() => b.remove(), 200); this.hit(26); sfx('crash', this.v.x, 2, this.v.z, { gain: 0.5, rate: 1.4 }); });
  }
  button(label, fn) { this.acts.innerHTML = ''; if (!label) return; const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.onclick = (e) => { e.stopPropagation(); fn(); }; this.acts.appendChild(b); }
  // a step (game time); false when it is over
  step(h) {
    const v = this.v; this.t += h;
    if (this.F.state !== 'fly' || v.gone) return this.end('', false);
    this.vhp.textContent = v.name.toUpperCase() + ' ' + Math.max(0, Math.round(v.hp));
    if (v.beaten || v.hp <= 0) return this.end(v.name + ' is beaten!', true);
    if (this.phase === 'spots') {
      if ((this.next -= h) <= 0 && this.spawned < this.total) { this.next = 0.45; this.spawned++; this.spot(); }
      for (const s of this.live) { if (s.dead) continue; s.life -= h; if (s.life <= 0) { s.dead = true; s.b.classList.add('miss'); setTimeout(() => s.b.remove(), 250); this.F.damage(7, v.name + ' hit you!'); this.g.shake = Math.max(this.g.shake || 0, 0.25); } }
      this.barI.style.width = (this.spawned / this.total * 100) + '%';
      if (this.spawned >= this.total && this.live.every(s => s.dead)) { this.phase = 'dazed'; this.t = 0; this.title('💫 ' + v.name.toUpperCase() + ' IS DAZED!'); this.button('🌀 SPIN & TOSS', () => this.startSpin()); }
    } else if (this.phase === 'dazed') {
      this.barI.style.width = Math.max(0, 100 - this.t / 4 * 100) + '%';
      if (this.t > 4) return this.free('came round and broke free!');
    } else if (this.phase === 'spin') {
      // whirled round the hero, on its side, lifted as it goes
      const P = this.F.pos, R = 4.2, k = Math.min(1, this.t * 4);
      v.x += (P.x + Math.cos(this.spinA) * R - v.x) * k; v.z += (P.z - Math.sin(this.spinA) * R - v.z) * k; v.y += (P.y - 2.1 - v.y) * k; // feet below the hero's hips: the body level with the hero's arms
      const need = Math.PI * 2 * 2.5; this.barI.style.width = Math.min(100, this.ang / need * 100) + '%';
      if (this.ang >= need) return this.throwIt();
      if (this.t > 5) return this.free('slipped out of your grip!');
    } else if (this.phase === 'thrown') {
      this.barI.style.width = Math.max(0, 100 - this.t / 5 * 100) + '%';
      if (v.beaten) return this.end(v.name + ' is beaten!', true);
      if (this.t > 5) return this.end('', false);
    }
    return true;
  }
  startSpin() { this.phase = 'spin'; this.t = 0; this.ang = 0; this.spinA = Math.atan2(-(this.v.z - this.F.pos.z), this.v.x - this.F.pos.x); this.title('🌀 SPIN! CIRCLE YOUR FINGER ROUND AND ROUND'); this.button(''); const r = document.createElement('div'); r.className = 'ring'; this.el.appendChild(r); this.ring = r; }
  // hurled out, away from the camera so it is seen to go: it tumbles across the town and crashes down (toss), hurt
  throwIt() {
    const v = this.v, c = this.F.ctx.camera, dx = this.F.pos.x - c.position.x, dz = this.F.pos.z - c.position.z, l = Math.hypot(dx, dz) || 1;
    v.gripped = false; v.spinning = false; toss(v, dx / l * 34, 11, dz / l * 34); this.hit(80); sfx('whoosh', v.x, v.y, v.z, { gain: 1 });
    if (this.ring) this.ring.remove();
    this.phase = 'thrown'; this.t = 0; this.title('💥 THROWN! NOW GO AFTER ' + v.name.toUpperCase() + '!');
    this.button('🚀 FLY AT THEM!', () => { const F = this.F; this.end('', false); F.lockOn(v, true); });
  }
  free(why) { const v = this.v; v.gripped = false; toss(v, (Math.random() - 0.5) * 20, 6, (Math.random() - 0.5) * 20); this.F.damage(10, v.name + ' ' + why); return this.end('', false); }
  // over: the villain let go (if still held), the overlay gone, the hero flying again
  end(why, won) {
    if (this.over) return false; this.over = true;
    const v = this.v; if (v.gripped) { v.gripped = false; if (!v.tossed && !v.beaten && !v.gone) toss(v, 0, 2, 0); } // dropped, falls to the ground
    this.el.remove(); this.F.duelOver(won); if (why) this.F.tip(why);
    return false;
  }
}
