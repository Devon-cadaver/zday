// Disaster Radio, K-D-I-S: Sean's announcer (one recording, cut into its 24 lines
// in public/radio) heard through a little radio set - the voice band-passed and
// pushed a touch into crunch, a hiss of static under it, the music held down while
// he talks - and what he says written small just above the bar. A line goes out
// when a disaster starts (each has its own), when the heroes arrive, and when it is
// all over; the station's call sign when a game begins. Each line is fetched the
// first time it is wanted. Through the sound button's volume; the words show even
// with the sound off.
const BASE = import.meta.env.BASE_URL || './'; // the line files carry ?v=2: a browser may still hold the silent first cut
import { sideButton } from './ui.js';
import { levelIcon } from './music.js';
const TEXT = [
  "You're listening to K-D-I-S, Disaster Radio. Stay tuned... and stay safe.",
  "We're getting reports of people... biting people. Lock your doors and stay off the streets!",
  "Tornado on the ground! I repeat, a tornado has touched down! Get to a basement... now!",
  "Earthquake! Drop, cover, and hold on! Stay away from windows!",
  "Flash flood warning! The water is rising fast. Get to higher ground!",
  "Tsunami warning! The sea is pulling back from the shore. Get to the top floor of a tall building, now!",
  "A riot has broken out downtown. Avoid the area. Police are moving in.",
  "Ladies and gentlemen, we interrupt this broadcast. Strange lights are falling over the city... something is landing. It's... it's not from this world!",
  "Look to the sky! A meteor is heading straight for the city. Take cover!",
  "The ground is giving way! A sinkhole is swallowing the street. Stay back!",
  "The mountain has erupted! Lava and ash are heading our way. Evacuate immediately!",
  "A wall of dust is rolling in from the desert. Get inside, shut your windows, and cover your face!",
  "An arctic blast is sweeping in. Temperatures are crashing. Stay indoors and keep warm!",
  "A massive solar flare is hitting us now... power is failing all over the city... if you can hear this... stay off the roads!",
  "This is not a drill. A missile is inbound. Take shelter immediately! This is not a drill!",
  "Alarms are sounding at the power plant. There's been a leak. Stay indoors and close all windows.",
  "Scientists are... baffled. Something is pulling the city apart from the inside. Hold on to something!",
  "Super villains spotted over the city! Stay inside and wait for the heroes!",
  "Something huge is moving under the streets... the ground is rippling! Get off the road!",
  "A giant monster has come ashore, and it's heading for downtown. Run!",
  "Wait... is that...? Yes! The heroes are here!",
  "The worst is over. Rescue teams are on the scene. If you need help, stay where you are. They're coming.",
  "All clear. Repeat, all clear. Crews are moving in to clear the streets and start rebuilding.",
  "It's over, folks. Take a breath. The rescue teams are on site, and help is on the way.",
];
// which line for which disaster (Be The Disaster's own kinds too)
const FOR = { zombies: 2, tornado: 3, quake: 4, flood: 5, tsunami: 6, riot: 7, aliens: 8, saucer: 8, tripod: 8, meteor: 9, sinkhole: 10, volcano: 11, lava: 11, haboob: 12, coldwave: 13, solar: 14, nuclear: 15, meltdown: 16, blackhole: 17, villains: 18, worm: 19, kaiju: 20, heroes: 21 };
const IDENT = 1, CLEAR = [22, 23, 24];
const LEVELS = [0, 0.55, 1, 1.6]; // off, quiet, medium, loud (its own button; starts at medium: about 5 dB under the old radio, loud just under it)

const CSS = `
#zd-radio{position:fixed;left:0;right:0;margin:0 auto;width:max-content;bottom:calc(var(--zd-bar-h, 64px) + 8px);z-index:4;max-width:min(calc(100vw - 24px),460px);box-sizing:border-box;
  display:flex;gap:8px;align-items:flex-start;padding:6px 11px;border-radius:10px;background:rgba(18,14,10,.74);border:1px solid rgba(255,236,200,.12);
  color:#efe3cb;font:italic 500 12px/1.35 system-ui,-apple-system,"Segoe UI",sans-serif;pointer-events:none;opacity:0;transition:opacity .4s}
#zd-radio.on{opacity:1}
#zd-radio b{flex:none;font:700 9px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.12em;color:#ffb070;font-style:normal;margin-top:1px}
body.zd-globe-on #zd-radio,body.zd-panel #zd-radio,body.zd-menu-on #zd-radio{display:none}
@media (prefers-reduced-motion: reduce){#zd-radio{transition:none}}
`;

export class Radio {
  constructor(audio) {
    this.audio = audio; this.bufs = {}; this.queue = []; this.said = {}; this.seen = new WeakSet();
    this.until = 0; this.t = 0; this.hot = false; this.calm = 0; this.zed = false; this.clearN = 0; this.started = -1;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const el = this.el = document.createElement('div'); el.id = 'zd-radio'; el.setAttribute('aria-live', 'polite');
    el.innerHTML = '<b>KDIS</b><span></span>'; document.body.appendChild(el); this.words = el.querySelector('span');
    let lv = 2; try { const s = localStorage.getItem('zday_radio'); if (s != null) lv = +s; } catch (e) { /* no storage */ }
    this.level = Number.isFinite(lv) ? Math.max(0, Math.min(3, lv)) : 2;
    const b = this.btn = sideButton('zd-radiob', 'Radio'), show = () => { b.innerHTML = levelIcon('\u{1F4FB}', this.level); };
    b.onclick = (e) => { // loud, medium, quiet, off, loud...
      e.stopPropagation(); this.level = (this.level + 3) % 4; show();
      try { localStorage.setItem('zday_radio', String(this.level)); } catch (er) { /* no storage */ }
      if (this.out) this.out.gain.setTargetAtTime(LEVELS[this.level], this.out.context.currentTime, 0.05);
      if (!this.level) { this.queue.length = 0; this.el.classList.remove('on'); }
    };
    show();
    if (audio) audio.radioOn = () => this.level > 0; // keeps the sound running with the effects off
  }
  // a game has begun: the call sign in a moment, unless something more urgent is said first (kind: Be The Disaster's
  // disaster, announced instead)
  begin(kind) { this.started = this.t; this.identDone = !!kind; if (kind) this.cue(kind); }
  // a line for a disaster by kind (Be The Disaster names its own)
  cue(kind) { if (FOR[kind]) this.say(FOR[kind]); }
  say(n) {
    if (!this.level) return; // the radio switched off: no voice, no words
    if (this.t - (this.said[n] ?? -1e9) < 45 || this.queue.includes(n)) return; // not the same line again so soon
    this.queue.push(n); if (this.queue.length > 2) this.queue.shift(); // only the latest news
    this.fetch(n);
  }
  fetch(n) {
    const c = this.audio && this.audio.ctx; if (!c || this.bufs[n]) return;
    this.bufs[n] = 'loading';
    fetch(BASE + 'radio/' + String(n).padStart(2, '0') + '.mp3?v=2').then(r => r.arrayBuffer())
      .then(ab => new Promise((ok, no) => c.decodeAudioData(ab, ok, no))).then(b => { this.bufs[n] = b; }).catch(() => { this.bufs[n] = null; });
  }
  update(dt, g) {
    this.t += dt;
    const D = g.disasters, p = g.people;
    if (D) for (const e of D.list) {
      if (!e.alive || this.seen.has(e)) continue;
      this.seen.add(e); this.cue(e.type);
    }
    const zom = p && p.stats ? p.stats.zombies : 0;
    if (zom > 0 && !this.zed) { this.zed = true; this.say(FOR.zombies); } else if (zom === 0) this.zed = false;
    // all over: nothing left alive for a while after something was
    const live = D && D.list.some(e => e.alive && e.type !== 'heroes' && FOR[e.type]);
    if (live || zom > 15) { this.hot = true; this.calm = 0; }
    else if (this.hot && (this.calm += dt) > 7) { this.hot = false; this.say(CLEAR[this.clearN++ % CLEAR.length]); }
    if (this.started >= 0 && !this.identDone && this.t - this.started > 3 && ((this.audio && this.audio.ctx) || this.t - this.started > 15)) { this.identDone = true; if (!this.queue.length && !this.speaking()) this.say(IDENT); }
    if (this.speaking() || !this.queue.length) { if (!this.speaking() && this.el.classList.contains('on') && this.t > this.until + 0.6) this.el.classList.remove('on'); return; }
    const n = this.queue[0], b = this.bufs[n];
    if (b === 'loading') return;
    this.queue.shift();
    if (b === undefined && this.audio && this.audio.ctx) { this.queue.unshift(n); this.fetch(n); return; }
    this.play(n, b || null);
  }
  speaking() { return this.t < this.until; }
  play(n, buf) {
    this.said[n] = this.t;
    const dur = buf ? buf.duration : 2.5 + TEXT[n - 1].length * 0.055; // without sound: about as long as it takes to read
    this.until = this.t + dur + 0.4;
    this.words.textContent = TEXT[n - 1]; this.el.classList.add('on');
    const A = this.audio, c = A && A.ctx;
    if (!buf || !c || !this.level || c.state !== 'running') return;
    if (!this.out) { // its own way out: a hard compressor (squashing the voice flat, like an AM set) into its own volume
      this.out = c.createGain(); this.out.gain.value = LEVELS[this.level]; this.out.connect(c.destination);
      this.comp = c.createDynamicsCompressor(); this.comp.threshold.value = -32; this.comp.knee.value = 4; this.comp.ratio.value = 14; this.comp.attack.value = 0.002; this.comp.release.value = 0.12;
      this.comp.connect(this.out);
    }
    const now = c.currentTime, src = c.createBufferSource(), hp = c.createBiquadFilter(), lp = c.createBiquadFilter(), mid = c.createBiquadFilter(), drive = c.createGain(), sh = c.createWaveShaper(), g = c.createGain();
    src.buffer = buf; hp.type = 'highpass'; hp.frequency.value = 420; lp.type = 'lowpass'; lp.frequency.value = 3200;
    mid.type = 'peaking'; mid.frequency.value = 1800; mid.Q.value = 1.1; mid.gain.value = 7; // the little speaker's honk
    if (!this.curve) { const k = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; k[i] = (Math.tanh(x * 4 + 0.18) - Math.tanh(0.18)) / Math.tanh(4.18); } this.curve = k; } // hard, a little lopsided: valve crunch
    sh.curve = this.curve; sh.oversample = '2x'; drive.gain.value = 2.6; g.gain.value = 0.9;
    src.connect(hp); hp.connect(mid); mid.connect(lp); lp.connect(drive); drive.connect(sh); sh.connect(g); g.connect(this.comp);
    // static under it: a hiss that comes up with the voice and a crackle at either end
    if (!this.hiss) { const L = c.sampleRate, h = c.createBuffer(1, L, L), d = h.getChannelData(0); for (let i = 0; i < L; i++) d[i] = (Math.random() * 2 - 1) * (Math.random() < 0.002 ? 3 : 1); this.hiss = h; }
    const ns = c.createBufferSource(), nf = c.createBiquadFilter(), ng = c.createGain();
    ns.buffer = this.hiss; ns.loop = true; nf.type = 'bandpass'; nf.frequency.value = 2600; nf.Q.value = 0.5;
    ng.gain.setValueAtTime(0, now); ng.gain.linearRampToValueAtTime(0.09, now + 0.05); ng.gain.linearRampToValueAtTime(0.025, now + 0.35);
    ng.gain.setValueAtTime(0.025, now + dur); ng.gain.linearRampToValueAtTime(0.08, now + dur + 0.08); ng.gain.linearRampToValueAtTime(0, now + dur + 0.3);
    ns.connect(nf); nf.connect(ng); ng.connect(this.comp);
    src.start(now + 0.12); ns.start(now); ns.stop(now + dur + 0.4);
    src.onended = () => { src.disconnect(); hp.disconnect(); mid.disconnect(); lp.disconnect(); drive.disconnect(); sh.disconnect(); g.disconnect(); };
    ns.onended = () => { ns.disconnect(); nf.disconnect(); ng.disconnect(); };
    if (A.music) A.music.hold(0.6, dur + 0.2); // the music steps back while he talks
  }
}
