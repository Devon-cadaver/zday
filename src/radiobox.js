// The radio station (Sean, as in Tornado Alley): every song with a play button and a tap to take it off the air, repeat,
// skip, and whether the cinematic music joins in: action music in the fights in place of the chosen songs. Opens over
// whatever called it (the main menu, the pause menu, the Tower or the Lair). The choices themselves are in music.js.
let box = null, music = null, tick = 0;
const CSS = `#zd-stationbox{position:fixed;inset:0;z-index:60;overflow-y:auto;background:rgba(18,12,30,.97);color:#f6ead2;font:14px/1.3 system-ui,-apple-system,sans-serif;padding:calc(14px + env(safe-area-inset-top)) 16px 24px;box-sizing:border-box;touch-action:pan-y}
#zd-stationbox[hidden]{display:none}
#zd-stationbox .in{max-width:420px;margin:0 auto;display:flex;flex-direction:column;gap:10px}
#zd-stationbox h2{margin:0;font:900 22px Impact,'Arial Black',sans-serif;letter-spacing:.03em;color:#ffc233;text-align:center}
#zd-stationbox .now{min-height:18px;text-align:center;color:#ffd27a;font-weight:700;font-size:13px}
#zd-stationbox button{border-radius:10px;border:1px solid rgba(255,255,255,.28);background:rgba(255,255,255,.08);color:#fff;font:700 14px system-ui,sans-serif;cursor:pointer;padding:12px 8px;touch-action:manipulation}
#zd-stationbox button.on{border-color:#ffc233;background:rgba(255,194,51,.2);color:#ffe2a0}
#zd-stationbox button small{display:block;font-weight:500;font-size:12px;opacity:.8;margin-top:2px}
#zd-stationbox .row{display:flex;gap:8px}
#zd-stationbox .row>button{flex:1;min-width:0}
#zd-stationbox .row>button.play{flex:0 0 52px}
#zd-stationbox .lab{font-weight:700;font-size:12px;letter-spacing:.06em;opacity:.75;margin-top:4px}
#zd-stationbox .done{background:linear-gradient(#ffc233,#d9860e);color:#2a1038;border:0;font-weight:900}`;
function build() {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  box = document.createElement('div'); box.id = 'zd-stationbox'; box.hidden = true;
  const stop = (e) => e.stopPropagation(); for (const ev of ['pointerdown', 'pointerup', 'click', 'touchstart']) box.addEventListener(ev, stop);
  document.body.appendChild(box);
}
function draw() {
  const m = music, tog = (on, a, b) => '<button type="button" class="' + (on ? 'on' : '') + '" ' + a + '>' + b + '</button>';
  box.innerHTML = '<div class="in"><h2>RADIO STATION</h2><div class="now"></div>' +
    '<div class="lab">VOLUME</div><div class="row">' + ['Off', 'Quiet', 'Medium', 'Loud'].map((n, i) => tog(m.level === i, 'data-lv="' + i + '"', n)).join('') + '</div>' +
    tog(m.cine, 'data-cine', '\u{1F3AC} CINEMATIC MUSIC: ' + (m.cine ? 'ON' : 'OFF') + '<small>' + (m.cine ? 'Action music in the fights, in place of your songs' : 'Only your songs, fights too') + '</small>') +
    tog(m.repeat, 'data-rep', '\u{1F501} REPEAT THE SONG: ' + (m.repeat ? 'ON' : 'OFF') + '<small>' + (m.repeat ? 'The same song, over and over' : 'Your songs in a shuffle') + '</small>') +
    '<div class="lab">YOUR SONGS: ▶ PLAYS ONE NOW, THE NAME TURNS IT ON OR OFF</div>' +
    m.songs.map(([id, name]) => '<div class="row"><button type="button" class="play" data-play="' + id + '">▶</button>' + tog(m.isOn(id), 'data-song="' + id + '"', (m.isOn(id) ? '\u{1F50A} ' : '\u{1F507} ') + name) + '</div>').join('') +
    '<div class="row" style="margin-top:4px"><button type="button" data-skip>⏭ SKIP</button><button type="button" class="done" data-done>DONE</button></div></div>';
  const act = (sel, fn) => box.querySelectorAll(sel).forEach(b => { b.onclick = () => { fn(b); draw(); }; });
  act('[data-lv]', (b) => m.setLevel(+b.dataset.lv));
  act('[data-cine]', () => m.setCine(!m.cine));
  act('[data-rep]', () => m.setRepeat(!m.repeat));
  act('[data-play]', (b) => m.playNow(b.dataset.play));
  act('[data-song]', (b) => m.toggleSong(b.dataset.song));
  act('[data-skip]', () => m.skip());
  box.querySelector('[data-done]').onclick = () => { box.hidden = true; clearInterval(tick); };
  now();
}
function now() { const el = box.querySelector('.now'), s = music.songs.find(q => q[0] === music.mood); if (el) el.textContent = music.level && s ? '\u{1F3B5} Now playing: ' + s[1] : ''; }
export function openStation(m) { music = m; if (!box) build(); draw(); box.hidden = false; clearInterval(tick); tick = setInterval(now, 1000); }
