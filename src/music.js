// Music: the two theme songs, My Little Disaster (the punk one and the Far Isles' one), on the menus - the one for the
// side of the world turned towards you, crossfading as it turns, each picking up where it left off (and played live by
// the band in the town, the second by the Far Isles' girl band: band.js, through
// a player of its own whose volume the band sets from where you are looking); Sean's three tracks (made with Suno) - Calm Before the Storm while the
// city is quiet, Desert Pursuit while disaster strikes, After the Storm for the
// clean-up afterwards - crossfaded as things change, each faded back into its
// own start a few seconds before its ending so it carries on, and dipped under
// the biggest explosions. Streamed from music/ through two players that take
// turns (a track is only fetched when it is wanted), into the sound engine's
// master volume. The note button steps loud, medium, quiet, off.
import { sideButton } from './ui.js';
const BASE = import.meta.env.BASE_URL || './';
const TRACKS = { calm: 'music/calm.mp3', storm: 'music/storm.mp3', rebuild: 'music/rebuild.mp3', theme: 'music/theme.mp3', theme2: 'music/theme2.mp3' };
const THEMES = ['theme', 'theme2'];
const LEVELS = [0, 0.2, 0.38, 0.62]; // off, quiet, medium, loud
const FADE = 4, TAIL = 6, AFTER = 150; // a mood change; the loop back to the start; how long the clean-up music plays after a disaster

// a long echo (a big space): noise dying away over secs, a little different in each ear, for a ConvolverNode
export function reverbIR(c, secs = 3.2, decay = 2.4) {
  const n = Math.floor(c.sampleRate * secs), b = c.createBuffer(2, n, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
  return b;
}

export class Music {
  constructor() {
    let lv = 2; try { const s = localStorage.getItem('zday_music2'); if (s != null) lv = +s; } catch (e) { /* no storage */ } // starts at medium (zday_music2: everyone back to it once)
    this.level = Number.isFinite(lv) ? Math.max(0, Math.min(3, lv)) : 2;
    this.menuSong = 'theme'; this.bandSong = 'theme'; this.pos = {}; // pos: where each theme song was left
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
    try { localStorage.setItem('zday_music2', String(lv)); } catch (e) { /* no storage */ }
    if (!this.ctx) return;
    if (lv && this.ctx.state !== 'running') this.ctx.resume();
    this.out.gain.setTargetAtTime(LEVELS[lv], this.ctx.currentTime, 0.15);
    const p = this.players[this.cur];
    if (!lv) { for (const q of this.players) q.el.pause(); } // off: nothing playing, nothing downloading
    else if (!p || p.el.paused) this.play(this.mood || 'calm');
  }
  attach(ctx, out) {
    this.ctx = ctx; this.out = ctx.createGain(); this.out.gain.value = LEVELS[this.level]; this.duckG = ctx.createGain();
    // the menus: everything far off, as if heard from up in space over the planet (Sean): the top taken off, a long echo, quieter
    this.lp = ctx.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 20000; this.dryG = ctx.createGain(); this.wetG = ctx.createGain(); this.wetG.gain.value = 0;
    this.verb = ctx.createConvolver(); this.verb.buffer = reverbIR(ctx); this.verb.connect(this.wetG);
    this.duckG.connect(this.lp); this.lp.connect(this.dryG); this.dryG.connect(this.out); this.wetG.connect(this.out); this.out.connect(out);
    this.space(this.menuOn);
    this.bgG = ctx.createGain(); this.bgG.connect(this.duckG); // the background tracks, dropped back while the band is heard
    { const el = this.bandEl = document.createElement('audio'); el.preload = 'none'; el.loop = true; el.setAttribute('playsinline', ''); this.bandG = ctx.createGain(); this.bandG.gain.value = 0; ctx.createMediaElementSource(el).connect(this.bandG); this.bandG.connect(this.out); }
    for (let k = 0; k < 2; k++) {
      const el = document.createElement('audio'); el.preload = 'auto'; el.setAttribute('playsinline', '');
      const g = ctx.createGain(); g.gain.value = 0; ctx.createMediaElementSource(el).connect(g); g.connect(this.bgG);
      const pl = { el, g, primed: false }; this.players.push(pl);
      el.addEventListener('timeupdate', () => { // on the menus (no game loop running there): near the end, round again
        if (this.menuOn && this.players[this.cur] === pl && THEMES.includes(this.mood) && el.duration && el.currentTime > el.duration - TAIL) this.play(this.mood, true);
      });
    }
  }
  // phones only let a player start on its own once it has been started from a tap: the first taps do that for both
  prime() {
    if (!this.ctx || !this.level) return;
    this.primeBand();
    this.players.forEach((p, k) => {
      if (p.primed) return; p.primed = true;
      if (this.cur < 0 && k === 0) { this.play(this.mood || (this.menuOn ? this.menuSong : 'calm')); return; }
      if (!p.el.src) p.el.src = BASE + TRACKS.calm;
      p.el.play().then(() => { if (this.players[this.cur] !== p) p.el.pause(); }).catch(() => { p.primed = false; });
    });
  }
  // the band's player too: started from a tap, then held until the band is heard
  primeBand() {
    const el = this.bandEl; if (!el || this.bandPrimed || !this.level) return; this.bandPrimed = true;
    el.src = BASE + TRACKS[this.bandSong]; el.play().then(() => { if (!(this.bandK > 0.02)) el.pause(); }).catch(() => { this.bandPrimed = false; });
  }
  // the band (band.js): k 0..1, how much of it is heard where you are looking; stop: cut it dead (the stage wrecked). The song runs on
  // its own clock, so coming back to the show you hear it further on, as if it never stopped
  setBand(k, stop = false) {
    if (!this.ctx || !this.bandEl) return;
    const el = this.bandEl, t = this.ctx.currentTime, now = performance.now(), on = k > 0.02 && this.level > 0 && !document.hidden;
    if (this.songAt == null) this.songAt = now;
    this.bandK = on ? k : 0;
    if (on) { this.bandLast = now; if (!el.src.endsWith(TRACKS[this.bandSong])) { el.pause(); el.src = BASE + TRACKS[this.bandSong]; } if (el.paused) { if (el.duration) { try { el.currentTime = ((now - this.songAt) / 1000) % el.duration; } catch (e) { /* not ready */ } } el.play().catch(() => {}); } }
    else if (!el.paused && now - (this.bandLast || 0) > 4000) el.pause(); // not heard for a while: stop streaming it
    const want = on ? k * 0.55 : 0; // not loud
    if (stop) { this.bandG.gain.cancelScheduledValues(t); this.bandG.gain.setValueAtTime(this.bandG.gain.value, t); this.bandG.gain.linearRampToValueAtTime(0, t + 0.08); this.bandW = 0; }
    else if (Math.abs(want - (this.bandW ?? -1)) > 0.01) { this.bandW = want; this.bandG.gain.setTargetAtTime(want, t, 0.3); }
    const bg = 1 - 0.8 * Math.min(1, (on ? k : 0) * 1.3);
    if (Math.abs(bg - (this.bgW ?? -1)) > 0.01) { this.bgW = bg; this.bgG.gain.setTargetAtTime(bg, t, 0.5); }
  }
  // far off on the menus, close in a town: the echo only joined in while it is wanted (it costs a little all the time)
  space(on) {
    if (!this.lp) return;
    const t = this.ctx.currentTime;
    if (on && !this.verbOn) { this.lp.connect(this.verb); this.verbOn = true; }
    this.spaceOn = on; this.applySpace(0.5);
    clearTimeout(this.verbT); if (!on && this.verbOn) this.verbT = setTimeout(() => { if (!this.menuOn && this.verbOn) { this.lp.disconnect(this.verb); this.verbOn = false; } }, 5000);
  }
  // how far off the songs sound: on the menus as far as the view is from the planet (zoomK 1: the menu's own view, from
  // space; 0: zoomed right in on it, Sean: the echo down, the songs up); in a town, close
  applySpace(tc = 0.4) {
    if (!this.lp) return;
    const t = this.ctx.currentTime, k = this.spaceOn ? (this.zoomK ?? 1) : 0;
    this.lp.frequency.setTargetAtTime(2600 * Math.pow(20000 / 2600, 1 - k), t, tc); this.dryG.gain.setTargetAtTime(1 - 0.7 * k, t, tc); this.wetG.gain.setTargetAtTime(0.5 * k, t, tc);
  }
  setZoom(k) { if (Math.abs(k - (this.zoomK ?? 1)) < 0.02) return; this.zoomK = k; if (this.spaceOn) this.applySpace(0.25); }
  // the menus: the theme song for the side of the world in view (setMenuSong)
  setMenu(on) {
    if (on !== this.menuOn) this.space(on);
    this.menuOn = on;
    if (on) { this.setBand(0, true); if (this.ctx && this.level && !THEMES.includes(this.mood) && this.players.some(p => p.primed)) this.play(this.menuSong); else if (!THEMES.includes(this.mood)) this.mood = this.menuSong; }
  }
  // the side of the world turned towards you on the menus (globe.js): its song, crossfaded in (Sean: the Far Isles the second;
  // not back and forth faster than every 3 s)
  setMenuSong(song) {
    if (song === this.menuSong) return;
    const now = performance.now(); if (now - (this.songAt2 || 0) < 3000) return; this.songAt2 = now;
    this.menuSong = song;
    if (this.menuOn && this.ctx && this.level && this.cur >= 0 && THEMES.includes(this.mood) && this.mood !== song) this.play(song);
  }
  // what the moment calls for: the storm while any other disaster is on; the clean-up through a zombie outbreak (Sean: the
  // action music did not suit it) and for a while after anything; calm otherwise
  update(dt, g) {
    if (!this.ctx || !this.players.length) return;
    this.t += dt;
    const D = g.disasters, storm = D && D.list.some(e => e.alive && e.type !== 'heroes' && e.type !== 'spill'), outbreak = g.people.stats.zombies > 0 || (D && D.list.some(e => e.alive && e.type === 'spill'));
    if (storm || outbreak) this.stormEnd = this.t;
    const mood = this.menuOn ? this.menuSong : storm ? 'storm' : outbreak || this.t - this.stormEnd < AFTER ? 'rebuild' : 'calm', p = this.players[this.cur];
    if (!this.level) { this.mood = mood; return; }
    if (mood !== this.mood && this.cur >= 0) this.play(mood); // out of the menus the theme gives way to the game's own
    else if (p && p.el.duration && !p.el.paused && p.el.currentTime > p.el.duration - TAIL) this.play(mood, true); // nearly at its ending: round again, crossfaded
  }
  play(mood, again = false) {
    const c = this.ctx, t = c.currentTime, f = again ? TAIL - 1 : FADE, old = this.players[this.cur], oldMood = this.mood, k = (this.cur + 1) % 2, p = this.players[k];
    this.mood = mood; this.cur = k;
    // a theme song picks up where it was left (Sean: paused, not started again, as the world turns); the rest from the top
    const same = p.el.src.endsWith(TRACKS[mood]), from = again ? 0 : !THEMES.includes(mood) ? 0 : same && !p.el.paused ? p.el.currentTime : this.pos[mood] || 0;
    if (!same) p.el.src = BASE + TRACKS[mood];
    p.el.loop = false; // round again from update, crossfaded
    const seek = () => { try { p.el.currentTime = from; } catch (e) { /* not loaded yet */ } };
    if (p.el.readyState >= 1) seek(); else p.el.addEventListener('loadedmetadata', seek, { once: true });
    p.el.play().catch(() => {});
    p.g.gain.cancelScheduledValues(t); p.g.gain.setValueAtTime(0, t); p.g.gain.linearRampToValueAtTime(1, t + f);
    if (old && old !== p) {
      old.g.gain.cancelScheduledValues(t); old.g.gain.setValueAtTime(old.g.gain.value, t); old.g.gain.linearRampToValueAtTime(0, t + f);
      setTimeout(() => { if (this.players[this.cur] !== old) { if (THEMES.includes(oldMood)) this.pos[oldMood] = old.el.currentTime; old.el.pause(); } }, (f + 0.5) * 1000);
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
