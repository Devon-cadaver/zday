// Music: Sean's three tracks (made with Suno) - Calm Before the Storm while the
// city is quiet, Desert Pursuit while disaster strikes, After the Storm for the
// clean-up afterwards - crossfaded as things change, each faded back into its
// own start a few seconds before its ending so it carries on, and dipped under
// the biggest explosions. Streamed from music/ through two players that take
// turns (a track is only fetched when it is wanted), into the sound engine's
// master volume. The note button steps loud, medium, quiet, off.
import { sideButton } from './ui.js';
const BASE = import.meta.env.BASE_URL || './';
const TRACKS = { calm: 'music/calm.mp3', storm: 'music/storm.mp3', rebuild: 'music/rebuild.mp3' };
const LEVELS = [0, 0.2, 0.38, 0.62]; // off, quiet, medium, loud
const FADE = 4, TAIL = 6, AFTER = 150; // a mood change; the loop back to the start; how long the clean-up music plays after a disaster

export class Music {
  constructor() {
    let lv = 3; try { const s = localStorage.getItem('zday_music'); if (s != null) lv = +s; } catch (e) { /* no storage */ }
    this.level = Number.isFinite(lv) ? Math.max(0, Math.min(3, lv)) : 3;
    this.ctx = null; this.players = []; this.cur = -1; this.mood = null; this.t = 0; this.stormEnd = -1e9;
    this.button();
    document.addEventListener('visibilitychange', () => { const p = this.players[this.cur]; if (!p || !this.level) return; if (document.hidden) p.el.pause(); else p.el.play().catch(() => {}); });
  }
  button() {
    const b = this.btn = sideButton('zd-music', 'Music');
    b.onclick = (e) => { e.stopPropagation(); this.setLevel((this.level + 3) % 4); }; // loud, medium, quiet, off, loud...
    this.show();
  }
  show() { this.btn.innerHTML = levelIcon('🎵', this.level); }
  setLevel(lv) {
    this.level = lv; this.show();
    try { localStorage.setItem('zday_music', String(lv)); } catch (e) { /* no storage */ }
    if (!this.ctx) return;
    if (lv && this.ctx.state !== 'running') this.ctx.resume();
    this.out.gain.setTargetAtTime(LEVELS[lv], this.ctx.currentTime, 0.15);
    const p = this.players[this.cur];
    if (!lv) { for (const q of this.players) q.el.pause(); } // off: nothing playing, nothing downloading
    else if (!p || p.el.paused) this.play(this.mood || 'calm');
  }
  attach(ctx, out) {
    this.ctx = ctx; this.out = ctx.createGain(); this.out.gain.value = LEVELS[this.level]; this.duckG = ctx.createGain();
    this.duckG.connect(this.out); this.out.connect(out);
    for (let k = 0; k < 2; k++) {
      const el = document.createElement('audio'); el.preload = 'auto'; el.setAttribute('playsinline', '');
      const g = ctx.createGain(); g.gain.value = 0; ctx.createMediaElementSource(el).connect(g); g.connect(this.duckG);
      this.players.push({ el, g, primed: false });
    }
  }
  // phones only let a player start on its own once it has been started from a tap: the first taps do that for both
  prime() {
    if (!this.ctx || !this.level) return;
    this.players.forEach((p, k) => {
      if (p.primed) return; p.primed = true;
      if (this.cur < 0 && k === 0) { this.play(this.mood || 'calm'); return; }
      if (!p.el.src) p.el.src = BASE + TRACKS.calm;
      p.el.play().then(() => { if (this.players[this.cur] !== p) p.el.pause(); }).catch(() => { p.primed = false; });
    });
  }
  // what the moment calls for: the storm while any disaster is on (or a real outbreak), the clean-up for a while after, calm otherwise
  update(dt, g) {
    if (!this.ctx || !this.players.length) return;
    this.t += dt;
    const D = g.disasters, storm = (D && D.list.some(e => e.alive && e.type !== 'heroes')) || g.people.stats.zombies > 12;
    if (storm) this.stormEnd = this.t;
    const mood = storm ? 'storm' : this.t - this.stormEnd < AFTER ? 'rebuild' : 'calm', p = this.players[this.cur];
    if (!this.level) { this.mood = mood; return; }
    if (mood !== this.mood && this.cur >= 0) this.play(mood);
    else if (p && p.el.duration && !p.el.paused && p.el.currentTime > p.el.duration - TAIL) this.play(mood, true); // nearly at its ending: round again, crossfaded
  }
  play(mood, again = false) {
    const c = this.ctx, t = c.currentTime, f = again ? TAIL - 1 : FADE, old = this.players[this.cur], k = (this.cur + 1) % 2, p = this.players[k];
    this.mood = mood; this.cur = k;
    if (!p.el.src.endsWith(TRACKS[mood])) p.el.src = BASE + TRACKS[mood];
    try { p.el.currentTime = 0; } catch (e) { /* not loaded yet */ }
    p.el.play().catch(() => {});
    p.g.gain.cancelScheduledValues(t); p.g.gain.setValueAtTime(0, t); p.g.gain.linearRampToValueAtTime(1, t + f);
    if (old && old !== p) {
      old.g.gain.cancelScheduledValues(t); old.g.gain.setValueAtTime(old.g.gain.value, t); old.g.gain.linearRampToValueAtTime(0, t + f);
      setTimeout(() => { if (this.players[this.cur] !== old) old.el.pause(); }, (f + 0.5) * 1000);
    }
  }
  // the announcer talking: the music held down for secs, then back up
  hold(k, secs) {
    if (!this.duckG) return;
    const t = this.ctx.currentTime, g = this.duckG.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(1 - k, t + 0.3); g.setValueAtTime(1 - k, t + secs); g.linearRampToValueAtTime(1, t + secs + 1.2);
  }
  // a big bang: the music ducks out of the way and comes back up
  duck(k) {
    if (!this.duckG) return;
    const t = this.ctx.currentTime, g = this.duckG.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(1 - k, t + 0.06); g.setTargetAtTime(1, t + 0.8, 0.9);
  }
}

// a button face: the icon (struck through when off) over three level bars
export function levelIcon(icon, lv) {
  const bars = [1, 2, 3].map(k => '<i style="display:inline-block;width:4px;height:' + (2 + k * 2) + 'px;margin:0 1px;border-radius:1px;vertical-align:bottom;background:' + (k <= lv ? '#f2ead8' : 'rgba(242,234,216,0.22)') + '"></i>').join('');
  return '<span style="display:block;' + (lv ? '' : 'opacity:0.4;text-decoration:line-through;') + 'margin-top:1px">' + icon + '</span><span style="display:block;height:9px;line-height:0;margin-top:1px">' + bars + '</span>';
}
