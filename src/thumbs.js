// Stylised pictures for the Sandbox's list of disasters (Sean: so you can see what you are picking): little flat scenes,
// 96 x 54, each its own sky over a bit of town with the disaster in it. Plain SVG, so they are sharp and cost nothing.
const G = 46; // the ground line
const BLD = [[3, 9, 16], [13, 8, 24], [22, 11, 12], [34, 8, 28], [43, 10, 18], [55, 8, 22], [64, 11, 13], [77, 9, 20], [87, 8, 15]]; // x, width, height: no two tall ones alike side by side
// the town along the bottom (skip: the buildings left out for the disaster; k: their height)
const town = (c, lit = '#ffd77a', skip = [], k = 1) => BLD.map(([x, w, h], i) => {
  if (skip.includes(i)) return '';
  h = Math.round(h * k);
  return '<rect x="' + x + '" y="' + (G - h) + '" width="' + w + '" height="' + h + '" fill="' + c + '"/>' + (h > 14 ? '<rect x="' + (x + 2) + '" y="' + (G - h + 4) + '" width="2" height="2" fill="' + lit + '"/><rect x="' + (x + w - 4) + '" y="' + (G - h + 9) + '" width="2" height="2" fill="' + lit + '"/>' : '');
}).join('');
const ground = (c = '#231d2e') => '<rect y="' + G + '" width="96" height="8" fill="' + c + '"/>';
const sky = (id, a, b) => '<defs><linearGradient id="zt-' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + a + '"/><stop offset="1" stop-color="' + b + '"/></linearGradient></defs><rect width="96" height="54" fill="url(#zt-' + id + ')"/>';
const STARS = '<g fill="#fff" opacity=".7"><circle cx="8" cy="6" r=".6"/><circle cx="21" cy="12" r=".5"/><circle cx="70" cy="5" r=".6"/><circle cx="86" cy="13" r=".5"/><circle cx="58" cy="9" r=".4"/><circle cx="33" cy="4" r=".4"/></g>';
const svg = (s) => '<svg viewBox="0 0 96 54" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' + s + '</svg>';

export const THUMB = {
  aliens: svg(sky('aliens', '#1a0b3d', '#4a1f6e') + STARS + town('#1a1430') + ground('#1c1530') +
    '<path d="M39 22 L57 22 L72 46 L24 46 Z" fill="#7dff9a" opacity=".3"/><circle cx="48" cy="33" r="1.3" fill="#fff"/><rect x="47.2" y="34.2" width="1.6" height="3" fill="#fff"/>' +
    '<ellipse cx="48" cy="19" rx="20" ry="5" fill="#b9c3d6"/><ellipse cx="48" cy="20.5" rx="20" ry="3" fill="#6b7590"/><path d="M38 17 Q48 5 58 17 Z" fill="#8ff0ff"/>' +
    '<g fill="#ffe66b"><circle cx="33" cy="20.5" r="1"/><circle cx="40.5" cy="21.5" r="1"/><circle cx="48" cy="22" r="1"/><circle cx="55.5" cy="21.5" r="1"/><circle cx="63" cy="20.5" r="1"/></g>'),
  blackhole: svg(sky('blackhole', '#05030f', '#1c0f36') + STARS + town('#15102a', '#ffd77a', [3, 4]) + ground('#1a1526') +
    '<g transform="rotate(-12 48 20)" fill="none"><ellipse cx="48" cy="20" rx="34" ry="9" stroke="#b44dff" stroke-width="1.2" opacity=".6"/><ellipse cx="48" cy="20" rx="26" ry="7" stroke="#ff9a3c" stroke-width="2.5" opacity=".85"/><ellipse cx="48" cy="20" rx="18" ry="4.5" stroke="#ffd36b" stroke-width="2"/></g>' +
    '<circle cx="48" cy="20" r="8" fill="#000"/><circle cx="48" cy="20" r="8.8" fill="none" stroke="#ffe7b0" stroke-width=".8"/>' +
    '<g fill="#15102a"><rect x="36" y="29" width="5" height="7" transform="rotate(25 38 32)"/><rect x="55" y="27" width="4" height="6" transform="rotate(-30 57 30)"/><rect x="45" y="33" width="3" height="4" transform="rotate(15 46 35)"/></g>'),
  coldwave: svg(sky('coldwave', '#7fc4ff', '#dff3ff') + town('#4a6a8c', '#eaf6ff') + BLD.map(([x, w, h]) => '<rect x="' + (x - 0.5) + '" y="' + (G - h - 1.5) + '" width="' + (w + 1) + '" height="2.5" rx="1" fill="#fff"/>').join('') + ground('#f2faff') +
    '<g stroke="#fff" stroke-width="1.4" stroke-linecap="round"><path d="M78 4v14M71.9 7.5l12.2 7M71.9 14.5l12.2-7"/></g>' +
    '<g fill="#fff"><circle cx="12" cy="8" r="1"/><circle cx="26" cy="15" r=".8"/><circle cx="40" cy="6" r="1.1"/><circle cx="55" cy="13" r=".8"/><circle cx="62" cy="4" r=".9"/><circle cx="90" cy="22" r=".8"/><circle cx="18" cy="22" r=".7"/></g>'),
  rift: svg(sky('rift', '#0b0620', '#2a0f45') + STARS + town('#170f2c', '#c77dff') + ground('#1b1330') +
    '<path d="M50 4 L45 14 L52 18 L43 30 L50 33 L46 44 L55 31 L49 28 L57 16 L51 13 Z" fill="#ff9cff" opacity=".35" stroke="#ff9cff" stroke-width="4" stroke-linejoin="round"/>' +
    '<path d="M50 4 L45 14 L52 18 L43 30 L50 33 L46 44 L55 31 L49 28 L57 16 L51 13 Z" fill="#ff5cf0" stroke="#fff" stroke-width=".8" stroke-linejoin="round"/>' +
    '<path d="M54 24 Q66 30 64 40 Q63 44 68 45" fill="none" stroke="#6a2c8f" stroke-width="2.4" stroke-linecap="round"/>' +
    '<circle cx="30" cy="16" r="4.5" fill="#9ff6ff" opacity=".25"/><circle cx="30" cy="16" r="2.6" fill="#9ff6ff"/><circle cx="70" cy="20" r="3.8" fill="#fff4a8" opacity=".25"/><circle cx="70" cy="20" r="2" fill="#fff4a8"/>'),
  haboob: svg(sky('haboob', '#e8a35a', '#f6d39a') + '<circle cx="80" cy="12" r="6" fill="#fff2cf" opacity=".8"/>' + town('#8a5a32', '#ffe2a8') + ground('#c9935a') +
    '<g fill="#b8743e"><circle cx="6" cy="30" r="16"/><circle cx="22" cy="22" r="14"/><circle cx="38" cy="30" r="13"/><circle cx="50" cy="40" r="10"/><circle cx="14" cy="44" r="12"/><circle cx="34" cy="46" r="10"/></g>' +
    '<g fill="#cf8a4c"><circle cx="18" cy="30" r="10"/><circle cx="32" cy="36" r="8"/><circle cx="8" cy="18" r="8"/></g>' +
    '<path d="M58 30h12M62 36h10M56 24h8" stroke="#cf8a4c" stroke-width="1.5" stroke-linecap="round"/>'),
  quake: svg(sky('quake', '#ffb36b', '#ffe0b0') + town('#4a3326', '#ffd77a', [3, 4, 5]) +
    '<g fill="#4a3326"><rect x="33" y="20" width="8" height="26" transform="rotate(-9 37 46)"/><rect x="45" y="29" width="10" height="17" transform="rotate(7 50 46)"/><rect x="57" y="25" width="8" height="21" transform="rotate(-5 61 46)"/></g>' + ground('#5a3d2a') +
    '<path d="M6 50 L22 48 L36 51 L46 47 L58 52 L74 49 L92 51" stroke="#1a0f08" stroke-width="1.4" fill="none"/><path d="M42 46 L46 49 L43 51 L48 54 L53 54 L49 51 L52 49 L48 46 Z" fill="#1a0f08"/>' +
    '<path d="M8 20 l3 -2 M10 26 l3 -2 M84 18 l3 -2 M86 24 l3 -2" stroke="#7a4a2a" stroke-width="1.2" stroke-linecap="round"/>'),
  flood: svg(sky('flood', '#5d6f86', '#9fb2c6') +
    '<g stroke="#d7e6f5" stroke-width=".8" opacity=".7"><path d="M10 2l-3 8M24 6l-3 8M40 1l-3 8M56 5l-3 8M72 2l-3 8M88 6l-3 8M18 14l-2 6M64 12l-2 6M80 15l-2 6"/></g>' + town('#2c3a4c', '#ffe9a0') + ground() +
    '<path d="M0 34 Q8 32 16 34 T32 34 T48 34 T64 34 T80 34 T96 34 V54 H0 Z" fill="#2f8fd8" opacity=".85"/><path d="M0 34 Q8 32 16 34 T32 34 T48 34 T64 34 T80 34 T96 34" fill="none" stroke="#bfe6ff" stroke-width="1"/>' +
    '<rect x="60" y="35" width="9" height="3" rx="1" fill="#e25b4a"/>'),
  worm: svg(sky('worm', '#d9a066', '#f3d2a2') + town('#6b4a33', '#ffe2a8', [4, 5]) + ground('#9a6a40') + '<ellipse cx="30" cy="47" rx="9" ry="2.4" fill="#3a2414"/>' +
    '<path d="M30 54 C30 20 66 14 70 34" fill="none" stroke="#c45a7a" stroke-width="11" stroke-linecap="round"/><path d="M30 54 C30 20 66 14 70 34" fill="none" stroke="#8e3552" stroke-width="11" stroke-dasharray="1.2 5"/>' +
    '<circle cx="70" cy="36" r="6.5" fill="#8e3552"/><circle cx="70" cy="37" r="4.2" fill="#2a0a14"/><g fill="#fff"><path d="M66.5 35l1 2 1-2.4zM69 34l1 2.2 1-2.2zM71.6 34.6l1 2 .9-2.3z"/></g>' +
    '<g fill="#7a4f2c"><circle cx="22" cy="42" r="2"/><circle cx="38" cy="41" r="1.6"/><circle cx="26" cy="37" r="1.2"/></g>'),
  kaiju: svg(sky('kaiju', '#ff7a45', '#ffc48a') + '<circle cx="14" cy="12" r="7" fill="#ffe2a0" opacity=".9"/>' +
    '<defs><linearGradient id="zt-kaiju-f" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#fff6b0"/><stop offset=".4" stop-color="#ffb02e"/><stop offset="1" stop-color="#ff4a1c" stop-opacity="0"/></linearGradient></defs>' +
    '<path d="M66 12 L28 3 Q24 12 30 21 Z" fill="url(#zt-kaiju-f)"/>' +
    '<g transform="translate(150 0) scale(-1 1)" fill="#2c3b2a"><path d="M62 46 L64 30 Q63 20 70 17 L72 10 Q74 6 79 7 Q84 8 84 12 L80 14 L81 16 L76 18 Q78 24 80 28 L86 32 L84 34 L80 32 Q82 40 88 46 Z"/><path d="M66 22 l-4 -1 3 4zM65 28 l-4 0 3 4zM64 34 l-4 1 3 3z"/><path d="M64 42 Q52 44 46 40" stroke="#2c3b2a" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="79" cy="10" r=".9" fill="#ffd23a"/></g>' +
    town('#3a2420', '#ffd77a') + ground('#4a2a20')),
  plant: svg(sky('plant', '#3c6e4a', '#a6d39a') + town('#24402c', '#e8ffb0') + ground('#2f4a2a') +
    '<g fill="none" stroke="#3d8a2f" stroke-linecap="round"><path d="M48 46 Q30 44 18 50 Q10 52 4 50" stroke-width="2.4"/><path d="M48 46 Q66 42 80 48 Q88 50 94 46" stroke-width="2.4"/><path d="M30 46 Q26 38 27 30" stroke-width="1.4"/><path d="M70 45 Q74 36 72 26" stroke-width="1.4"/><path d="M14 50 Q12 46 8 45" stroke-width="1"/><path d="M84 48 Q86 44 90 43" stroke-width="1"/><path d="M40 45 Q38 49 34 52" stroke-width="1"/><path d="M58 44 Q62 48 64 52" stroke-width="1"/></g>' +
    '<path d="M48 46 Q45 36 43 27" stroke="#2f6e25" stroke-width="3" fill="none"/>' +
    '<path d="M41 25 Q52 15 62 18 Q56 25 62 31 Q52 34 41 25 Z" fill="#c8325a"/><path d="M40 25 Q50 10 63 17 L61 19 Q51 15 42 25 Z" fill="#6fb53c"/><path d="M40 25 Q50 37 63 32 L61 30 Q51 33 42 25 Z" fill="#6fb53c"/><ellipse cx="41" cy="25" rx="3" ry="4" fill="#5a9a30"/>' +
    '<g fill="#fff"><path d="M50 15.6l1.2 3 1-3.4zM55 15.4l1 3 1.2-3.1zM59 16.3l.8 2.8 1.2-2.4zM50 33.4l1.2-3 1 3.3zM55 33.3l1-3 1.2 3zM59 32.2l.8-2.7 1.1 2.3z"/></g>' +
    '<circle cx="22" cy="48" r="2.2" fill="#ff4fa3"/><circle cx="78" cy="47" r="2.2" fill="#b14dff"/><circle cx="27" cy="31" r="1.8" fill="#ff6f6f"/><circle cx="72" cy="27" r="1.8" fill="#ff9ad5"/><g fill="#ffe23a"><circle cx="22" cy="48" r=".8"/><circle cx="78" cy="47" r=".8"/><circle cx="27" cy="31" r=".6"/><circle cx="72" cy="27" r=".6"/></g>'),
  meteor: svg(sky('meteor', '#0d1440', '#3a2a6e') + STARS +
    '<defs><linearGradient id="zt-meteor-t" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff7a2e" stop-opacity="0"/><stop offset="1" stop-color="#ffd36b"/></linearGradient></defs>' +
    '<path d="M98 -4 L59 29 L49 19 Z" fill="url(#zt-meteor-t)"/><circle cx="54" cy="24" r="10" fill="#ff8a3d" opacity=".25"/><circle cx="54" cy="24" r="6" fill="#ffb347"/><circle cx="54" cy="24" r="3.6" fill="#fff3c4"/>' +
    town('#161a3a', '#ffd77a') + ground('#1c1838')),
  nuclear: svg(sky('nuclear', '#ffcf6b', '#ff6b3d') + town('#3a1c14', '#ffe9a0', [4]) + ground('#4a2418') +
    '<path d="M44 46 Q46 34 45 26 L51 26 Q50 34 52 46 Z" fill="#e0a070"/><ellipse cx="48" cy="34" rx="9" ry="2.5" fill="#f0c090"/>' +
    '<g fill="#f3c38a"><circle cx="40" cy="20" r="8"/><circle cx="56" cy="20" r="8"/><circle cx="48" cy="15" r="9"/><circle cx="48" cy="23" r="7"/></g><g fill="#fff0c8" opacity=".9"><circle cx="45" cy="14" r="4"/><circle cx="54" cy="17" r="3"/></g>' +
    '<g fill="#d89060"><circle cx="38" cy="46" r="5"/><circle cx="58" cy="46" r="5"/><circle cx="48" cy="47" r="6"/></g>'),
  meltdown: svg(sky('meltdown', '#1f3a2a', '#6a8f5a') + town('#1f2a22', '#d8ffb0', [3, 4, 5, 6]) + ground('#2a3a22') +
    '<path d="M32 46 Q36 32 33 18 L49 18 Q46 32 50 46 Z" fill="#a9b3ad"/><path d="M33 18 L49 18" stroke="#8a948e" stroke-width="1.5"/>' +
    '<g fill="#9dff6a" opacity=".55"><circle cx="38" cy="12" r="5"/><circle cx="45" cy="9" r="6"/><circle cx="52" cy="6" r="4.5"/></g>' +
    '<path d="M54 46 V36 Q62 26 70 36 V46 Z" fill="#c7cfca"/><circle cx="62" cy="38" r="3.6" fill="#ffe23a"/>' +
    '<g fill="#1a1a1a"><path d="M62 38 L60.2 34.9 A3.6 3.6 0 0 1 63.8 34.9 Z"/><path d="M62 38 L65.6 38 A3.6 3.6 0 0 1 63.8 41.1 Z"/><path d="M62 38 L60.2 41.1 A3.6 3.6 0 0 1 58.4 38 Z"/></g><circle cx="62" cy="38" r=".8" fill="#ffe23a"/>' +
    '<ellipse cx="48" cy="47" rx="26" ry="3" fill="#9dff6a" opacity=".35"/>'),
  riot: svg(sky('riot', '#4a2a5a', '#ff8a4a') + town('#2a1a2a', '#ffd77a') + ground('#2a1f2a') +
    '<g fill="#120a14">' + [12, 19, 26, 33, 40, 47, 54, 61, 68].map((x, i) => '<circle cx="' + x + '" cy="' + (37 + (i % 2)) + '" r="2"/><rect x="' + (x - 2) + '" y="' + (39 + (i % 2)) + '" width="4" height="7"/>').join('') + '</g>' +
    '<g stroke="#fff" stroke-width=".9"><path d="M24 32v6M58 30v7"/></g><rect x="19" y="26" width="10" height="6" fill="#fff"/><rect x="53" y="24" width="10" height="6" fill="#ffe08a"/>' +
    '<rect x="78" y="41" width="13" height="5" rx="1.5" fill="#556"/><path d="M82 41 Q85 32 88 41 Z" fill="#ffb02e"/><path d="M84 41 Q85.5 36 87 41 Z" fill="#fff2a0"/>'),
  sinkhole: svg(sky('sinkhole', '#9fc7e8', '#e6f1f8') + town('#5a4f62', '#ffe9a0', [3, 4, 5]) + ground('#7a6a58') +
    '<ellipse cx="48" cy="48" rx="20" ry="5" fill="#140c08"/>' +
    '<g fill="#5a4f62"><rect x="36" y="30" width="8" height="18" transform="rotate(-22 40 48)"/><rect x="52" y="32" width="9" height="16" transform="rotate(25 56 48)"/></g>' +
    '<path d="M28 48 A20 5 0 0 0 68 48 L68 54 L28 54 Z" fill="#7a6a58"/><path d="M22 47 L16 50 M74 47 L82 50 M30 46 L25 43 M68 46 L73 43" stroke="#3a2a1a" stroke-width="1"/>'),
  solar: svg(sky('solar', '#120a2a', '#3a1f5a') + STARS + '<path d="M0 24 Q20 16 40 24 T80 26 T110 22" fill="none" stroke="#5dffb0" stroke-width="3" opacity=".45"/>' +
    '<circle cx="70" cy="14" r="16" fill="#ff9a3c" opacity=".18"/><circle cx="70" cy="14" r="13" fill="#ffb02e" opacity=".3"/>' + // the corona
    '<g fill="#ff7a2e" stroke="#ff5a1e" stroke-width=".6"><path d="M59.7 10.2 C49 6 57 -7 66.2 3.7 C60 -1 55 5 59.7 10.2 Z"/><path d="M61.6 21.1 C54 28 47 18 59.2 15.9 C53 19 56 25 61.6 21.1 Z"/></g>' + // flares looping off it
    '<circle cx="70" cy="14" r="11" fill="#ffb02e"/><circle cx="70" cy="14" r="8" fill="#ffe27a"/><path d="M60 20 L38 32" stroke="#ffe27a" stroke-width="1.4" stroke-dasharray="3 2" opacity=".8"/>' +
    town('#120e24', '#2a2440') + ground('#14102a') +
    '<path d="M12 46 V30 M8 32 H16" stroke="#3a3350" stroke-width="1.2"/><path d="M16 31 l3 -2 -1 3 3 -1" stroke="#9ff6ff" stroke-width="1" fill="none"/>'),
  villains: svg(sky('villains', '#1a1030', '#50205a') + '<path d="M8 54 L30 0 L42 0 Z" fill="#fff" opacity=".08"/>' + town('#160e22', '#ffd77a') + ground() +
    '<path d="M56 16 L64 16 L72 36 Q60 32 48 36 Z" fill="#d2283c"/>' + // the cape
    '<g stroke="#2a2238" stroke-linecap="round" fill="none"><path d="M57 17 L50 22M63 17 L70 11" stroke-width="2"/><path d="M59 27 L57.5 34M61 27 L62.5 34" stroke-width="2.2"/></g>' +
    '<path d="M56 16 L64 16 L62 27 L58 27 Z" fill="#2a2238"/><circle cx="60" cy="12.5" r="3" fill="#2a2238"/><path d="M58.4 12.2h1.2M60.4 12.2h1.2" stroke="#ff4a4a" stroke-width=".9"/><path d="M58 20 L60 23 L62 20 Z" fill="#ffd23a"/>' +
    '<circle cx="71" cy="10.5" r="2.6" fill="#b2ff4a" opacity=".35"/><path d="M71 10 L77 16 L74 17 L80 25" fill="none" stroke="#b2ff4a" stroke-width="1.6" stroke-linejoin="round"/><circle cx="49.5" cy="22.5" r="2" fill="#b2ff4a" opacity=".35"/>'),
  zombies: svg(sky('zombies', '#1a2a1a', '#4a6a2a') + town('#15201a', '#c8ff7a') + ground('#1e2a1a') +
    '<g fill="#9dff3a" opacity=".35"><circle cx="52" cy="36" r="8"/><circle cx="44" cy="29" r="7"/><circle cx="60" cy="27" r="6"/><circle cx="36" cy="38" r="5"/></g>' +
    '<g transform="rotate(-8 65 42)"><rect x="54" y="38" width="22" height="8" rx="4" fill="#d8d8c8"/><rect x="62" y="38.5" width="3" height="7" fill="#ffd23a"/></g><rect x="76" y="37" width="8" height="9" rx="1" fill="#e2b13a"/>' +
    '<g fill="#b6e07a" stroke="#b6e07a" stroke-linecap="round"><circle cx="12" cy="34" r="2.2"/><rect x="10.4" y="36.2" width="3.2" height="6.4"/><path d="M11 42.5 L10 46M13 42.5 L14.5 46" stroke-width="1.4"/><path d="M13 37.8 h6" stroke-width="1.5"/>' +
    '<circle cx="24" cy="35.5" r="2" transform="rotate(10 24 40)"/><rect x="22.5" y="37.5" width="3" height="6"/><path d="M23 43.4 L22.4 46M25 43.4 L26.4 46" stroke-width="1.3"/><path d="M25 39 h5.5" stroke-width="1.4"/></g>' +
    '<g fill="#2a1a1a"><circle cx="11.6" cy="33.6" r=".45"/><circle cx="13" cy="33.6" r=".45"/><circle cx="23.8" cy="35" r=".4"/><circle cx="25.1" cy="35" r=".4"/></g>'),
  tornado: svg(sky('tornado', '#3a4250', '#8a96a6') + '<g fill="#2a303a"><ellipse cx="30" cy="4" rx="30" ry="8"/><ellipse cx="70" cy="5" rx="34" ry="9"/></g>' + town('#2a2f3a', '#ffe9a0') + ground('#3a3a3a') +
    '<path d="M30 8 L66 8 Q58 18 54 26 Q50 36 52 46 L48 46 Q46 34 44 26 Q38 16 30 8 Z" fill="#a8b0bc" opacity=".92"/>' +
    '<g stroke="#7a8494" stroke-width="1.2" fill="none"><path d="M34 12 Q48 15 62 12"/><path d="M40 19 Q49 21 58 19"/><path d="M44 27 Q50 28 54 27"/><path d="M47 36 Q50 37 52 36"/></g>' +
    '<g fill="#2a2f3a"><rect x="36" y="30" width="2.5" height="1.5" transform="rotate(30 37 31)"/><rect x="60" y="24" width="2" height="2" transform="rotate(-20 61 25)"/><rect x="40" y="40" width="2" height="1.4"/></g>' +
    '<path d="M80 6 L76 14 L79 14 L74 23" stroke="#fff6a8" stroke-width="1.2" fill="none"/>'),
  tsunami: svg(sky('tsunami', '#6fb7e8', '#cfe9f8') + town('#4a5a6a', '#fff2b0', [0, 1, 2]) + ground('#c8b48a') +
    '<path d="M0 54 L0 10 Q14 0 30 6 Q42 11 44 22 Q38 16 32 18 Q26 20 30 28 Q36 38 52 46 L52 54 Z" fill="#1f6fb8"/><path d="M0 30 Q12 26 22 34 Q30 42 46 48 L46 54 L0 54 Z" fill="#2f8fd8" opacity=".6"/>' +
    '<path d="M0 10 Q14 0 30 6 Q42 11 44 22 Q38 16 32 18" fill="none" stroke="#e6f6ff" stroke-width="2.4" stroke-linecap="round"/><g fill="#e6f6ff"><circle cx="47" cy="20" r="1"/><circle cx="49" cy="25" r=".8"/><circle cx="41" cy="12" r=".9"/></g>'),
  volcano: svg(sky('volcano', '#3a1a2a', '#c4583a') + '<g fill="#5a4a50"><circle cx="48" cy="10" r="8"/><circle cx="38" cy="6" r="6"/><circle cx="58" cy="5" r="6"/></g>' +
    '<path d="M12 46 L40 16 L56 16 L86 46 Z" fill="#4a2a24"/><path d="M40 16 L56 16 L53 19 L43 19 Z" fill="#ff7a2e"/>' +
    '<g fill="none" stroke-linecap="round"><path d="M46 18 Q44 28 38 34 Q34 40 30 46" stroke="#ff8a2e" stroke-width="2.2"/><path d="M51 18 Q54 26 58 32 Q62 38 66 46" stroke="#ffb02e" stroke-width="1.8"/></g>' +
    '<g fill="#ffb02e"><circle cx="30" cy="14" r="1.5"/><circle cx="66" cy="10" r="1.3"/><circle cx="62" cy="19" r="1"/></g>' + town('#2a1418', '#ffd77a', [], 0.45) + ground('#2a1a1a')),
};
