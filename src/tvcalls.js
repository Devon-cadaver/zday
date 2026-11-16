// Disaster TV's live calls (Sean, 2026-11-15: betting that feels interactive but casual, the viewer doing something all through the show).
// One question at a time on a card over the ticker, two (or three) big buttons, a few seconds to tap one: WHAT HITS THE TOWN, WHO WINS,
// then quick calls all through the fight (who lands the next big hit, a building down in the next ten seconds, three of them in twenty, the
// hero rocked, the foe under half). The stake is the chip on the card (tap it for more), taken when you tap; right pays it back times the
// odds shown, with a streak bonus for three and five right in a row; wrong loses it; nothing decided gives it back. WHO WINS rides the whole
// show, pinned over the card. Coins and calls are kept on this device (zday_tvcalls), as before.
import { sfx } from './audio.js';

const CSS = `
#zd-ask{position:fixed;left:max(10px, env(safe-area-inset-left));right:max(10px, env(safe-area-inset-right));bottom:calc(var(--zd-bar-h, 64px) + 40px);z-index:8;display:flex;flex-direction:column;align-items:stretch;gap:5px;pointer-events:none;
  font:800 12px/1.15 system-ui,-apple-system,"Segoe UI",sans-serif;color:#f6ead2;max-width:460px;margin:0 auto}
#zd-ask .pin{align-self:center;background:rgba(20,14,8,.86);border:1px solid rgba(166,255,77,.5);border-radius:10px;padding:4px 10px;font-size:11px;letter-spacing:.04em;text-align:center}
#zd-ask .pin b{color:#a6ff4d}#zd-ask .pin i{font-style:normal;color:#ffd166}
#zd-ask .pin[hidden],#zd-ask .card[hidden]{display:none}
#zd-ask .card{position:relative;background:rgba(20,14,8,.92);border:2px solid rgba(255,236,200,.22);border-radius:14px;padding:8px 8px 9px;pointer-events:auto;overflow:hidden;transition:border-color .2s,background .2s}
#zd-ask .top{display:flex;align-items:center;gap:8px;margin:0 2px 7px}
#zd-ask .kick{flex:none;background:#d8321e;color:#fff;border-radius:5px;padding:3px 6px;font-size:10px;letter-spacing:.08em}
#zd-ask .q{flex:1;font-size:14.5px;line-height:1.2;letter-spacing:.01em}
#zd-ask .stk{flex:none;appearance:none;border:1px solid rgba(255,209,102,.6);background:rgba(255,209,102,.14);color:#ffd166;border-radius:9px;min-width:56px;height:30px;font:900 12px/1 system-ui,-apple-system,"Segoe UI",sans-serif;cursor:pointer;touch-action:manipulation}
#zd-ask .stk small{display:block;font-size:8px;letter-spacing:.08em;opacity:.8;margin-bottom:1px}
#zd-ask .opts{display:flex;gap:7px}
#zd-ask .opts button{flex:1 1 0;min-width:0;appearance:none;border:2px solid rgba(255,236,200,.28);background:rgba(44,32,18,.96);color:#f6ead2;border-radius:12px;min-height:54px;padding:6px 6px;
  font:900 14px/1.1 system-ui,-apple-system,"Segoe UI",sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;cursor:pointer;touch-action:manipulation;text-transform:uppercase;letter-spacing:.02em}
#zd-ask .opts button span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#zd-ask .opts button small{font-size:12px;color:#7be0ff;letter-spacing:0;font-variant-numeric:tabular-nums}
#zd-ask .opts.three button{font-size:12.5px}
#zd-ask .opts button:active{transform:scale(.96)}
#zd-ask .opts button.mine{border-color:#a6ff4d;background:rgba(90,140,30,.5)}#zd-ask .opts button.mine small{color:#a6ff4d}
#zd-ask .opts.locked button:not(.mine){opacity:.35}
#zd-ask .clk{position:absolute;left:0;bottom:0;height:4px;background:#ffd166;width:100%;transform-origin:left;}
#zd-ask .clk.ride{background:#a6ff4d}
#zd-ask .res{position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;gap:2px;font:900 26px/1 system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.03em;text-align:center}
#zd-ask .res small{font-size:12px;letter-spacing:.04em;opacity:.9}
#zd-ask .card.won{border-color:#a6ff4d;background:rgba(40,80,10,.95)}#zd-ask .card.won .res{display:flex;color:#c9ff8a}
#zd-ask .card.lost{border-color:#ff6a4d;background:rgba(90,20,10,.95)}#zd-ask .card.lost .res{display:flex;color:#ffb3a0}
#zd-ask .card.none{border-color:rgba(255,236,200,.35)}#zd-ask .card.none .res{display:flex;color:#f6ead2;font-size:18px}
#zd-ask .card.won .top,#zd-ask .card.won .opts,#zd-ask .card.lost .top,#zd-ask .card.lost .opts,#zd-ask .card.none .top,#zd-ask .card.none .opts{visibility:hidden}
#zd-ask .card.won{animation:zdask .5s ease-out}
@keyframes zdask{30%{transform:scale(1.05)}}
`;
const STAKES = [25, 50, 100, 250];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const odds = (p) => +clamp(0.9 / clamp(p, 0.05, 0.95), 1.1, 9).toFixed(1); // what a right call pays, times the stake

// the viewer's coins and calls, kept on this device
export function calls() { let c = null; try { c = JSON.parse(localStorage.getItem('zday_tvcalls')); } catch (e) { /* no storage */ } const o = { right: 0, total: 0, points: 0, coins: 1000, stake: 50, streak: 0, lines: {}, ...(c || {}) }; for (const k of ['right', 'total', 'points', 'coins', 'streak']) if (!Number.isFinite(o[k])) o[k] = k === 'coins' ? 1000 : 0; if (!STAKES.includes(o.stake)) o.stake = 50; return o; }
export function saveCalls(c) { try { localStorage.setItem('zday_tvcalls', JSON.stringify(c)); } catch (e) { /* no storage */ } }

export class LiveCalls {
  constructor(tv) {
    this.tv = tv; this.q = null; this.main = null; this.town = 0;
    if (!document.getElementById('zd-ask-css')) { const s = document.createElement('style'); s.id = 'zd-ask-css'; s.textContent = CSS; document.head.appendChild(s); }
    const el = this.el = document.createElement('div'); el.id = 'zd-ask';
    el.innerHTML = '<div class="pin" hidden></div><div class="card" hidden><div class="top"><span class="kick">CALL IT</span><span class="q"></span><button type="button" class="stk"><small>STAKE</small><b></b></button></div><div class="opts"></div><div class="clk"></div><div class="res"></div></div>';
    document.body.appendChild(el);
    this.pinEl = el.querySelector('.pin'); this.card = el.querySelector('.card'); this.qEl = el.querySelector('.q'); this.optEl = el.querySelector('.opts'); this.clk = el.querySelector('.clk'); this.resEl = el.querySelector('.res'); this.stkEl = el.querySelector('.stk');
    for (const ev of ['pointerdown', 'click', 'touchstart']) this.card.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
    this.stkEl.onclick = (e) => { e.stopPropagation(); const c = calls(); c.stake = STAKES[(STAKES.indexOf(c.stake) + 1) % STAKES.length]; saveCalls(c); this.stakeShow(); };
    this.stakeShow();
  }
  stakeShow() { this.stkEl.querySelector('b').textContent = calls().stake; }
  busy() { return !!this.q; }
  // a question: { head, opts: [{key, name, x}], askT, win, onClose(pick), check(dt) -> key | 'void' | null, timeout: key on the window running out, main: rides the show }
  ask(q) {
    if (this.q) this.close(true);
    const c = calls(); if (c.coins < c.stake) { c.coins += 300; saveCalls(c); this.tv.showCalls(true); this.tv.say('The station spots you 300 coins: back in the game'); }
    this.q = q; q.t = 0; q.state = 'ask'; q.pick = null; q.bet = 0; this.card.className = 'card'; this.card.hidden = false;
    this.qEl.textContent = q.head; this.optEl.className = 'opts' + (q.opts.length > 2 ? ' three' : ''); this.optEl.innerHTML = '';
    q.opts.forEach((o) => { const b = document.createElement('button'); b.type = 'button'; b.innerHTML = '<span>' + o.name + '</span><small>×' + o.x.toFixed(1) + '</small>'; b.onclick = (e) => { e.stopPropagation(); this.tap(o.key, b); }; this.optEl.appendChild(b); });
    this.clk.className = 'clk'; this.clk.style.transform = 'scaleX(1)'; this.tv.cam && this.tv.cam.dir && (this.tv.cam.dir.boxT = 0); // the clear part of the screen is measured again
  }
  // a tap: the stake on it (tap the other to change your mind while the clock runs)
  tap(key, b) {
    const q = this.q; if (!q || q.state !== 'ask') return; const c = calls();
    if (q.pick === key) return; if (!q.pick) { const s = Math.min(c.stake, c.coins); if (s <= 0) return; c.coins -= s; q.bet = s; saveCalls(c); this.tv.showCalls(); }
    q.pick = key; for (const x of this.optEl.children) x.classList.toggle('mine', x === b);
    sfx('chime', ...this.ear(), { gain: 0.35, rate: 1.6 });
    if (q.main) this.pin(q);
    if (q.lockOnTap) q.t = Math.max(q.t, q.askT - 0.6); // one tap and on to it
  }
  ear() { const p = this.tv.g.camera.position; return [p.x, p.y, p.z]; }
  pin(q) { const o = q.opts.find((x) => x.key === q.pick); this.pinEl.innerHTML = 'YOUR CALL · <b>' + o.name + '</b> · ' + q.bet + ' <i>→ ' + Math.round(q.bet * o.x) + '</i>'; this.pinEl.hidden = false; }
  bonus(s) { return s >= 5 ? 1.5 : s >= 3 ? 1.25 : 1; } // by the streak this win makes: the third right in a row pays x1.25, the fifth x1.5
  step(dt) {
    const q = this.q; if (!q) return; q.t += dt;
    if (q.state === 'ask') {
      this.clk.style.transform = 'scaleX(' + clamp(1 - q.t / q.askT, 0, 1).toFixed(3) + ')';
      if (q.t >= q.askT) { if (q.onClose) q.onClose(q.pick); if (!q.pick) { this.close(false); return; } if (q.main) { this.main = q; this.q = null; this.card.hidden = true; return; } q.state = 'ride'; q.t = 0; this.optEl.classList.add('locked'); this.clk.className = 'clk ride'; }
      else return;
    }
    if (q.state === 'ride') {
      this.clk.style.transform = 'scaleX(' + clamp(1 - q.t / q.win, 0, 1).toFixed(3) + ')';
      let k = q.check ? q.check(dt) : null; if (k == null && q.t >= q.win) k = q.timeout || 'void';
      if (k != null) this.result(q, k);
      return;
    }
    if (q.state === 'shown' && q.t > q.showT) this.close(false);
  }
  // the call decided: paid, lost or given back, said on the card a moment
  result(q, key, quiet) {
    const c = calls(); let won = 0;
    if (key === 'void') { c.coins += q.bet; this.say(q, 'none', 'NO RESULT', 'stake back'); }
    else { c.total++; if (key === q.pick) { const o = q.opts.find((x) => x.key === key); c.streak++; won = Math.round(q.bet * o.x * this.bonus(c.streak)); c.coins += won; c.right++; c.points += won - q.bet; this.townWon = (this.townWon || 0) + won - q.bet; this.say(q, 'won', 'RIGHT! +' + (won - q.bet), (c.streak >= 3 ? 'STREAK ' + c.streak + ' · ×' + this.bonus(c.streak) : o.name) + ' · paid ' + won); sfx('chime', ...this.ear(), { gain: 0.8 }); } // what it made over the stake, as a loss shows the stake
      else { c.streak = 0; this.townWon = (this.townWon || 0) - q.bet; const o = q.opts.find((x) => x.key === key); this.say(q, 'lost', 'WRONG −' + q.bet, o ? 'it was ' + o.name : ''); sfx('thud', ...this.ear(), { gain: 0.6, rate: 0.8 }); } }
    saveCalls(c); this.tv.showCalls(!!won); if (quiet) this.close(false); return won;
  }
  say(q, cls, big, small) { if (q.main) return; q.state = 'shown'; q.t = 0; q.showT = cls === 'none' ? 1.1 : 1.7; this.card.className = 'card ' + cls; this.resEl.innerHTML = big + (small ? '<small>' + small + '</small>' : ''); this.clk.style.transform = 'scaleX(0)'; }
  // the show's own call (WHO WINS) settled at the end; returns what it paid
  settleMain(key) {
    const q = this.main; this.main = null; this.pinEl.hidden = true; if (!q || !q.pick) return 0; const c = calls(); c.total++; let won = 0;
    if (key === 'void') c.coins += q.bet; else if (key === q.pick) { const o = q.opts.find((x) => x.key === key); c.streak++; won = Math.round(q.bet * o.x * this.bonus(c.streak)); c.coins += won; c.right++; c.points += won - q.bet; this.townWon = (this.townWon || 0) + won - q.bet; } else { c.streak = 0; this.townWon = (this.townWon || 0) - q.bet; }
    saveCalls(c); this.tv.showCalls(!!won); return key === 'void' ? 0 : won || -q.bet;
  }
  // the card away (a question with nothing on it, or the show moving on: a stake still riding comes back)
  close(refund) { const q = this.q; if (q && refund && q.bet && q.state !== 'shown') { const c = calls(); c.coins += q.bet; saveCalls(c); this.tv.showCalls(); } this.q = null; this.card.hidden = true; this.card.className = 'card'; }
  // off air (next town, the menu): everything riding comes back
  clear() { this.close(true); if (this.main && this.main.bet) { const c = calls(); c.coins += this.main.bet; saveCalls(c); this.tv.showCalls(); } this.main = null; this.pinEl.hidden = true; }
  dispose() { this.clear(); this.el.remove(); }
}
