// Shared game layer: HUD scaffolding, toasts, tap input, time speed, fixed-step
// simulation, follow camera. Modes plug in: Commander (send help to the city),
// Be The Disaster (drive one yourself) and Sandbox (drop zombies and disasters).
import * as THREE from 'three';
import { ST, KIND } from './people.js';
import { Commander } from './commander.js';
import { Profile, UNLOCK, UPGRADES, LEVELS, MAX_LEVEL, HAZARD_LEVEL, BE_LEVEL } from './profile.js';
import { HAZARDS, WEATHER, threatName } from './disasters.js';
import { BeTheDisaster, BE } from './be.js';
import { Gauge, SIZED } from './gauge.js';
import { Responders } from './response.js';
import { curvedHit } from './curve.js';
import { PLACES, PATH, placeKey, travel } from './places.js';
import { dragScroll } from './ui.js';

const CSS = `
#zd-top{position:fixed;left:0;right:0;top:0;display:flex;gap:6px;align-items:center;justify-content:center;flex-wrap:wrap;
  padding:calc(8px + env(safe-area-inset-top)) max(10px, env(safe-area-inset-right)) 0 max(10px, env(safe-area-inset-left));pointer-events:none;
  font:600 12px/1 system-ui,-apple-system,"Segoe UI",sans-serif;color:#f6ead2;letter-spacing:.04em}
.zd-pill{display:flex;gap:6px;align-items:baseline;background:rgba(28,20,12,.62);border:1px solid rgba(255,236,200,.14);
  border-radius:8px;padding:6px 9px;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}
.zd-pill b{font-size:15px;font-variant-numeric:tabular-nums;letter-spacing:0}
.zd-pill i{font-style:normal;font-size:10px;opacity:.75;text-transform:uppercase}
.zd-h b{color:#fff4e0}.zd-i b{color:#ffc233}.zd-z b{color:#a6ff4d}.zd-d b{color:#e07a6a}.zd-rp b{color:#7be0ff}
.zd-al{border-color:rgba(255,120,60,.35)}.zd-al b{color:#ffb070;font-size:12px;letter-spacing:.03em}
.zd-al.a3 b{color:#ff8a4a}.zd-al.a4 b{color:#ff5a3a}
#zd-clock{opacity:.85;font-variant-numeric:tabular-nums}
#zd-bar{position:fixed;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:none;
  padding:0 max(8px, env(safe-area-inset-right)) calc(8px + env(safe-area-inset-bottom)) max(8px, env(safe-area-inset-left))}
#zd-bar > *{pointer-events:auto}
#zd-bar [hidden]{display:none!important}
.zd-dock{order:3;display:flex;gap:6px;width:100%;max-width:520px;align-items:stretch}
.zd-dock .zd-btn{flex:1 1 0;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:8px 2px 7px;
  font-size:10.5px;line-height:1.15;letter-spacing:.02em;text-transform:none;text-align:center}
.zd-dock .zd-btn svg{width:20px;height:20px;flex:none;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.zd-dock .zd-btn .l{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;max-width:100%}
.zd-dock .zd-btn.on{border-color:#a6ff4d;color:#a6ff4d}
.zd-extra{order:1;display:flex;gap:8px;justify-content:center;align-items:center;flex-wrap:wrap;max-width:100%}
#zd-help{background:rgba(200,60,40,.9);border-color:rgba(255,160,130,.6);color:#fff0e8;padding:10px 16px}
#zd-help.on{background:rgba(230,80,50,.95)}
#zd-followchip{display:flex;align-items:center;gap:10px;background:rgba(28,20,12,.82);border:1px solid rgba(166,255,77,.4);border-radius:20px;padding:4px 4px 4px 14px;
  font:600 12px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;color:#f6ead2;max-width:100%;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}
#zd-followchip b{color:#a6ff4d}
#zd-followchip .zd-btn{padding:7px 11px;min-width:0;border-radius:15px;font-size:11px}
.zd-btn{appearance:none;border:1px solid rgba(255,236,200,.18);background:rgba(28,20,12,.72);color:#f6ead2;border-radius:10px;
  font:700 12px/1 system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.06em;text-transform:uppercase;padding:11px 12px;
  backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);touch-action:manipulation;cursor:pointer;min-width:52px;position:relative;overflow:hidden}
.zd-btn:active{transform:translateY(1px)}
.zd-btn:focus-visible{outline:2px solid #a6ff4d;outline-offset:2px}
#zd-drop{background:rgba(70,98,34,.85);border-color:rgba(166,255,77,.5);display:flex;gap:8px;align-items:center}
#zd-drop .n{background:#a6ff4d;color:#1d2a0e;border-radius:6px;padding:3px 6px;font-variant-numeric:tabular-nums}
#zd-drop.empty{background:rgba(28,20,12,.72);border-color:rgba(255,236,200,.18);opacity:.7}
#zd-find.on{border-color:#a6ff4d;color:#a6ff4d}
#zd-good.on{border-color:#8fd3ff;color:#8fd3ff}
.zd-cardwrap{order:2;position:relative;width:100%;max-width:640px}
.zd-cards{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding:2px 0}
.zd-cards::-webkit-scrollbar{display:none}
.zd-cardwrap.cl .zd-cards{-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 40px);mask-image:linear-gradient(90deg,transparent 0,#000 40px)}
.zd-cardwrap.cr .zd-cards{-webkit-mask-image:linear-gradient(90deg,#000 calc(100% - 40px),transparent);mask-image:linear-gradient(90deg,#000 calc(100% - 40px),transparent)}
.zd-cardwrap.cl.cr .zd-cards{-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 40px,#000 calc(100% - 40px),transparent);mask-image:linear-gradient(90deg,transparent 0,#000 40px,#000 calc(100% - 40px),transparent)}
.zd-arr{position:absolute;top:50%;transform:translateY(-50%);width:30px;height:30px;border-radius:15px;border:1px solid rgba(255,236,200,.3);background:rgba(28,20,12,.92);
  color:#f6ead2;font:700 18px/1 system-ui,sans-serif;padding:0 0 2px;display:none;z-index:1;cursor:pointer;touch-action:manipulation}
.zd-arr.l{left:0}.zd-arr.r{right:0}
.zd-cardwrap.cl .zd-arr.l,.zd-cardwrap.cr .zd-arr.r{display:block}
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
#zd-fps{position:fixed;right:max(8px, env(safe-area-inset-right));bottom:calc(var(--zd-bar-h, 64px) + 4px);font:10px system-ui,sans-serif;color:#f6ead2;opacity:.45;pointer-events:none}
#zd-end{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(14,10,6,.78);z-index:35;
  padding:max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left));box-sizing:border-box;font:14px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;color:#f6ead2}
#zd-end[hidden]{display:none}
#zd-end .box{background:rgba(32,24,14,.95);border:1px solid rgba(255,236,200,.18);border-radius:14px;padding:20px 18px 16px;max-width:360px;width:100%;text-align:center;
  max-height:100%;overflow-y:auto;box-sizing:border-box}
#zd-end .stats{margin-top:14px;font-size:13px}
#zd-end .stats .line{padding:4px 0}
#zd-end h2{margin:0 0 4px;font-size:24px;letter-spacing:.02em}
#zd-end .stars{font-size:30px;letter-spacing:6px;color:#ffc233;margin:4px 0 10px}
#zd-end .stars span{opacity:.25}
#zd-end .line{display:flex;justify-content:space-between;gap:12px;padding:5px 0;border-top:1px solid rgba(255,236,200,.1);font-variant-numeric:tabular-nums}
#zd-end .line b{color:#fff4e0}
#zd-end .score{font-size:20px;margin:12px 0 4px;color:#7be0ff}
#zd-end .zd-btn{margin-top:12px;background:rgba(28,20,12,.9);border-color:rgba(255,236,200,.25);padding:13px 22px;font-size:13px}
#zd-menu{position:fixed;inset:0;z-index:6;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;box-sizing:border-box;pointer-events:none;
  background:linear-gradient(180deg,rgba(5,7,13,.5) 0,rgba(5,7,13,0) 24%,rgba(5,7,13,0) 55%,rgba(5,7,13,.55) 100%);transition:opacity .35s;
  padding:max(14px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left));
  font:14px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;color:#f6ead2}
#zd-menu > *{pointer-events:auto}
#zd-menu[hidden]{display:none}
#zd-menu.gone{opacity:0}
#zd-menu.gone .box{transform:translateY(60px)}
#zd-menu .mtitle{position:absolute;left:0;right:0;top:max(18px, env(safe-area-inset-top));text-align:center;pointer-events:none}
#zd-menu .mtitle .tag{margin:6px 0 0;text-shadow:0 1px 8px rgba(0,0,0,.7)}
#zd-menu .box{width:100%;max-width:420px;background:rgba(24,18,12,.86);border:1px solid rgba(255,236,200,.16);border-radius:16px;text-align:center;max-height:calc(100% - 96px);
  display:flex;flex-direction:column;overflow:hidden;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);transition:transform .35s}
#zd-menu .mbody{overflow-y:auto;overscroll-behavior:contain;padding:14px 14px 12px;min-height:0;flex:1 1 auto}
#zd-menu .modes{display:flex;gap:8px;margin-top:12px}
#zd-menu .zd-btn.mode{flex:1 1 0;min-width:0;display:flex;flex-direction:column;align-items:center;gap:5px;padding:12px 4px 10px;text-transform:none;letter-spacing:.02em;font-size:13px}
#zd-menu .mode svg{width:26px;height:26px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
#zd-menu .mode b{font-size:13px;line-height:1.15}
#zd-menu .mode span{font-size:10.5px;line-height:1.2;font-weight:600;opacity:.75}
#zd-menu .mrow{display:flex;gap:8px;align-items:center;margin-top:10px}
#zd-menu .mrow .zd-btn{flex:1 1 0;min-width:0;padding:11px 6px;font-size:11px;text-decoration:none;display:block}
#zd-menu .mside{flex:none;display:flex}
#zd-menu .box.tall{height:calc(100% - 96px);backdrop-filter:none;-webkit-backdrop-filter:none;background:rgba(24,18,12,.93)}
#zd-menu .rgl{position:fixed;inset:0;width:100%;height:100%;z-index:2;pointer-events:none}
#zd-menu .rsec{text-align:left}
#zd-menu .rsec h2{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#d8c49e;margin:14px 0 8px;display:flex;align-items:center;gap:10px}
#zd-menu .rsec h2::after{content:"";flex:1;height:1px;background:rgba(255,236,200,.18)}
#zd-menu .rsec .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:7px}
#zd-menu .rsec .tile{aspect-ratio:1/1;position:relative;border-radius:9px;background:rgba(255,236,200,.04);border:1px solid rgba(255,236,200,.08)}
#zd-menu .rsec .lbl{position:absolute;z-index:3;left:50%;bottom:5px;transform:translateX(-50%);max-width:92%;box-sizing:border-box;text-align:center;background:rgba(28,20,12,.88);
  border:1px solid rgba(255,236,200,.2);color:#f6ead2;padding:3px 6px;border-radius:5px;font:700 8.5px/1.15 system-ui,sans-serif;letter-spacing:.05em;text-transform:uppercase}
#zd-menu .mhead{display:flex;align-items:center;gap:12px;padding:10px 12px;border-bottom:1px solid rgba(255,236,200,.14);flex:none;background:rgba(24,18,10,.6)}
#zd-menu .mhead .zd-btn{padding:9px 12px;font-size:12px;min-width:0;flex:none}
#zd-menu .mhead .mt{flex:1;text-align:left;font-weight:800;font-size:15px;letter-spacing:.14em;text-transform:uppercase;color:#fff4e0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#zd-menu h1{margin:0;font-size:27px;line-height:1.05;letter-spacing:.14em;color:#fff4e0;text-shadow:0 2px 14px rgba(0,0,0,.7)}
#zd-menu .tag{font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.7;margin:2px 0 14px}
#zd-menu .rank{display:flex;justify-content:space-between;align-items:baseline;font-size:13px;margin:0 0 6px}
#zd-menu .rank b{font-size:16px;color:#a6ff4d}
#zd-menu .bar{height:8px;border-radius:4px;background:rgba(255,236,200,.12);overflow:hidden;margin:0 0 4px}
#zd-menu .bar i{display:block;height:100%;background:linear-gradient(90deg,#7be0ff,#a6ff4d)}
#zd-menu .next{font-size:11px;opacity:.7;margin:0 0 16px}
#zd-menu .rank.sm{font-size:12px;margin:0 2px 6px}#zd-menu .rank.sm b{font-size:14px}
#zd-menu .bar.sm{height:6px;margin:0 2px}
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
#zd-end .row2{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
#zd-end .zd-btn.go{background:rgba(70,98,34,.95);border-color:#a6ff4d}
#zd-dis{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(var(--zd-bar-h, 64px) + 8px);width:min(calc(100vw - 16px),440px);box-sizing:border-box;
  display:flex;flex-direction:column;overflow:hidden;background:rgba(28,20,12,.93);border:1px solid rgba(255,236,200,.16);border-radius:14px;z-index:3;
  font:600 11px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;color:#f6ead2}
#zd-dis[hidden]{display:none}
#zd-dis .tabs{display:flex;gap:4px;padding:6px;border-bottom:1px solid rgba(255,236,200,.12);flex:none}
#zd-dis .tabs button{flex:1 1 0;appearance:none;border:0;background:none;color:#f6ead2;opacity:.6;font:700 11px/1 system-ui,-apple-system,"Segoe UI",sans-serif;
  letter-spacing:.08em;text-transform:uppercase;padding:10px 4px;border-radius:8px;cursor:pointer;touch-action:manipulation}
#zd-dis .tabs button.on{opacity:1;background:rgba(255,236,200,.1);color:#fff4e0}
#zd-dis .pbody{overflow-y:auto;padding:8px 8px 10px;min-height:0;flex:1 1 auto}
#zd-dis .h{font-size:10px;letter-spacing:.1em;text-transform:uppercase;opacity:.7;margin:12px 2px 6px;text-align:center}
#zd-dis .g{display:flex;flex-wrap:wrap;justify-content:center;gap:6px}
#zd-dis .g > .zd-btn{flex:0 0 calc((100% - 12px) / 3);box-sizing:border-box}
#zd-dis .g.two > .zd-btn{flex:0 0 calc((100% - 6px) / 2)}
#zd-dis .zd-btn{padding:11px 4px;min-width:0;font-size:11px;letter-spacing:.03em;text-transform:none}
#zd-dis .zd-btn.sel{border-color:#a6ff4d;color:#a6ff4d}
#zd-dis .zd-btn.zb{color:#a6ff4d;border-color:rgba(166,255,77,.35)}
#zd-dis .zd-btn.zb.empty{opacity:.5}
#zd-dis .zd-btn.hero{color:#ffe08a;border-color:rgba(255,224,138,.45)}
#zd-dis .zd-btn.auto{color:#7be0ff;border-color:rgba(123,224,255,.4)}
#zd-dis .zd-btn.auto.off{color:#f6ead2;opacity:.6;border-color:rgba(255,236,200,.18)}
#zd-compass{position:fixed;left:max(10px, env(safe-area-inset-left));top:50%;transform:translateY(-50%);z-index:30;width:46px;height:46px;border-radius:23px;padding:0;cursor:pointer;
  border:1px solid rgba(255,236,200,.18);background:rgba(28,20,12,.72);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);touch-action:manipulation}
#zd-compass svg{display:block;width:100%;height:100%}
#zd-compass text{font:700 7.5px system-ui,-apple-system,"Segoe UI",sans-serif;fill:#f6ead2;text-anchor:middle;dominant-baseline:central}
#zd-compass text.n{fill:#ff7a5a;font-size:9px}
body.zd-menu-on #zd-compass,body.zd-panel #zd-compass{display:none}
#zd-disb{border-color:rgba(255,154,90,.55);color:#ffc08a}
#zd-disb.on{background:rgba(120,58,24,.88);border-color:#ff9a5a;color:#ffd9b8}
@media (prefers-reduced-motion: reduce){#zd-toast{transition:none}}
`;

// what each unit does, for the unlocks page
const UNIT_DESC = { police: 'Officers who fight zombies and arrest rioters', bus: 'Takes people out of a dangerous street', build: 'Rebuilds a fallen building', camp: 'Shelters people nearby until the rebuilding is done',
  chaser: 'Spots tornadoes and aliens and calls in help', boat: 'Pulls people out of flood water', coast: 'Boats and helicopters at once to the worst spots in a flood', barrier: 'An inflatable barrier that holds back a stretch of a tsunami', fire: 'Puts out burning buildings', hazmat: 'Clears radiation so rebuilding can start', seeder: 'Weakens tornadoes and breaks up storms',
  water: 'Drops water on a fire (life rafts over a flood)', rescue: 'Lifts survivors off a rooftop or out of flood water on a rope', heroes: 'Dragonfly, Nova and Tempo: they beat super villains and throw meteors and missiles into space',
  apc: 'A squad of soldiers to hold a crossing', strike: 'Bombs one spot', nuke: 'Wipes out a whole district' };
const THREAT_HINT = { villains: 'Blur, Tyrant and Weaver. Only the super heroes can beat them' };
const UNIT_NAMES = { heroes: 'Super heroes (hero signal)', build: 'Construction crew', camp: 'Medical camp', hazmat: 'Hazmat team', police: 'Police cruiser', bus: 'Evacuation bus', chaser: 'Storm chaser', seeder: 'Cloud seeder', boat: 'Rescue boat', coast: 'Coast Guard', barrier: 'Flood barrier', fire: 'Fire truck', water: 'Water helicopter', rescue: 'Rescue helicopter', apc: 'Army APC', strike: 'Airstrike', nuke: 'Nuke' };

// the buttons along the bottom: a line drawing over a short name
const svg = (d) => '<svg viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>';
const ICON = {
  'zd-disb': svg('<path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12z"/>'),
  'zd-find': svg('<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'),
  'zd-good': svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M5.6 5.6l3.6 3.6M14.8 14.8l3.6 3.6M18.4 5.6l-3.6 3.6M9.2 14.8l-3.6 3.6"/>'),
  'zd-speed': svg('<path d="M3 6.5 11 12l-8 5.5zM12 6.5l8 5.5-8 5.5z"/>'),
  'zd-reset': svg('<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v5h5"/>'),
  'zd-menu-btn': svg('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  'zd-pick': svg('<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>'),
  'zd-swap': svg('<path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5"/>'),
};
ICON['zd-restart'] = ICON['zd-reset'];
// the three ways to play, on the menu
const MICON = {
  commander: svg('<path d="M7 18v-6a5 5 0 0 1 10 0v6"/><path d="M5 21h14M12 3v2M4.2 6.2l1.4 1.4M19.8 6.2l-1.4 1.4"/>'),
  be: svg('<path d="M3 5h18M5.5 9h13M8 13h9M10 17h5.5M11.5 21h2"/>'),
  sandbox: svg('<rect x="3" y="12" width="8" height="8" rx="1.2"/><rect x="13" y="12" width="8" height="8" rx="1.2"/><rect x="8" y="3" width="8" height="8" rx="1.2"/>'),
};
const EXTRA = new Set(['zd-help']); // shown above the bar only when they are wanted

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
    this.followSub = null; this.focusAt = null; this._off = new THREE.Vector3(); this._fp = new THREE.Vector3();
    this.pendingFires = []; this.simT = 0; this.realT = 0; this.acc = 0; this.speed = 1; this.follow = -1; this.seen = {};
    people.fire = fire; traffic.people = people; traffic.fire = fire; people.traffic = traffic;
    people.onOverrun = (k, why) => { if (Math.random() < (why === 'breach' ? 0.25 : 0.3)) this.pendingFires.push({ k, t: this.simT + 3 + Math.random() * 8 }); };
    this.profile = new Profile();
    this.buildUI();
    this.bindInput();
    this.menu = document.createElement('div'); this.menu.id = 'zd-menu'; this.menu.hidden = true;
    document.body.appendChild(this.menu);
    this.modeName = mode;
    if (mode === 'sandbox') this.mode = new Sandbox(this);
    else if (mode === 'commander') this.mode = new Commander(this);
    else if (mode === 'be' || mode === 'storm') { // ?mode=be&kind=lava starts that disaster, ?mode=be alone opens the picker
      const d = new URLSearchParams(location.search).get('kind') || (mode === 'storm' ? 'tornado' : '');
      if (BE[d] && this.profile.level >= BE_LEVEL[d]) this.mode = new BeTheDisaster(this, d);
      else { this.mode = new Idle(); this.showMenu('be'); }
    } else { this.mode = new Idle(); this.showMenu(); }
  }

  startMode(which, kind) {
    this.menu.hidden = true; this.menuOff(); this.modeName = which;
    this.top.innerHTML = ''; this.bar.innerHTML = ''; this.followChip = this.stopBtn = null;
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
    if (panel === 'travel') { // the places in the world: the big city and the towns
      const here = placeKey();
      body = top('Travel') + '<div class="btns">' + Object.keys(PLACES).map(k => '<button class="zd-btn' + (k === here ? ' main' : '') + '" type="button" data-place="' + k + '">' + PLACES[k].name + (k === here ? ' · you are here' : '') + '<div style="font-size:11px;opacity:0.7;margin-top:2px">' + PLACES[k].blurb + '</div></button>').join('') + '</div>';
    } else if (panel === 'main') { // over the globe: the three ways to play, each saying where it goes
      const town = (m) => { const k = pr.town(m); return 'Level ' + (PATH.indexOf(k) + 1) + ' · ' + PLACES[k].name; };
      body = '<div class="rank sm"><span>Commander level <b>' + lvl + '</b></span><span>' + pr.xp.toLocaleString() + (next ? ' / ' + next.toLocaleString() : '') + ' XP</span></div>' +
        '<div class="bar sm"><i style="width:' + Math.round(pr.progress * 100) + '%"></i></div>' +
        '<div class="modes"><button class="zd-btn mode main" type="button" data-play="commander">' + MICON.commander + '<b>Commander</b><span>' + town('commander') + '</span></button>' +
        '<button class="zd-btn mode" type="button" data-go="be">' + MICON.be + '<b>Be the Disaster</b><span>' + town('be') + '</span></button>' +
        '<button class="zd-btn mode" type="button" data-play="sandbox">' + MICON.sandbox + '<b>Sandbox</b><span>Pick any city</span></button></div>' +
        '<div class="mrow"><button class="zd-btn" type="button" data-go="unlocks">Units' + (pr.bank >= 3000 && UPGRADES.some(u => pr.canBuy(u.id)) ? ' \u2022' : '') + '</button><button class="zd-btn" type="button" data-go="roster">Roster</button><div class="mside"></div></div>' +
        '<div class="foot">' + pr.data.rounds + ' rounds played · best score ' + pr.data.best.toLocaleString() + ' · ' + pr.data.stars + ' stars' + (pr.ok ? '' : ' · progress is not being saved on this device') + '</div>';
    } else if (panel === 'roster') { // every model, turning on its plinth (roster.js, loaded only now)
      head = top('Roster');
      body = '<div class="rsec"><div class="tag">Bringing out the models...</div></div>';
    } else if (panel === 'be') {
      const bests = pr.data.beBest || {};
      head = top('Be The Disaster');
      body = '<div class="tag">' + Object.keys(BE).filter(k => lvl >= BE_LEVEL[k]).length + ' of ' + Object.keys(BE).length + ' open · one finger drives it, two move the camera</div>' + rank +
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
    this.stopRoster(); this.menuPanel = panel;
    this.menu.innerHTML = '<div class="mtitle"><h1>MY TINY<br>DISASTER</h1><div class="tag">Save the city, or be the disaster</div></div><div class="box' + (panel === 'roster' ? ' tall' : '') + '">' + head + '<div class="mbody">' + body + '</div></div>';
    if (panel === 'roster') {
      const cv = document.createElement('canvas'); cv.className = 'rgl'; this.menu.appendChild(cv);
      import('./roster.js').then(m => { if (!cv.isConnected) return; const sec = this.menu.querySelector('.rsec'); sec.innerHTML = ''; this.roster = m.startRoster({ canvas: cv, list: this.menu.querySelector('.mbody'), root: sec }); });
    }
    clearTimeout(this._gone); this.menu.classList.remove('gone'); this.menu.hidden = false; document.body.classList.add('zd-menu-on');
    this.dockSide();
    if (this.globe) this.globe.backdrop(panel === 'main'); // the town names only round the main menu
    dragScroll(this.menu.querySelector('.mbody'), 'y');
    this.menu.querySelectorAll('[data-go]').forEach(b => { b.onclick = () => this.showMenu(b.dataset.go); });
    this.menu.querySelectorAll('[data-play]').forEach(b => { b.onclick = () => this.playMode(b.dataset.play); });
    this.menu.querySelectorAll('[data-place]').forEach(b => { b.onclick = () => travel(b.dataset.place); });
    this.menu.querySelectorAll('[data-be]').forEach(b => { b.onclick = () => this.playMode('be', b.dataset.be); });
    this.menu.querySelectorAll('[data-buy]').forEach(b => { b.onclick = () => { if (pr.buy(b.dataset.buy)) { this.toast('Upgrade bought'); this.showMenu('unlocks'); } }; });
  }

  // the sound and music buttons sit in the menu card (made after the menu at the start: main.js calls this again)
  dockSide() { const side = document.getElementById('zd-side'), slot = this.menu.querySelector('.mside'); if (side) (slot || document.body).appendChild(side); }
  // the end of a round: the result and the buttons at the top, the figures under them (scrolling on a small screen)
  endScreen(el, head, lines, buttons) {
    el.innerHTML = '<div class="box">' + head + '<div class="row2">' + buttons + '</div><div class="stats">' + lines.map(l => '<div class="line"><span>' + l[0] + '</span><b>' + l[1] + '</b></div>').join('') + '</div></div>';
    dragScroll(el.querySelector('.box'), 'y');
  }
  stopRoster() { if (this.roster) { this.roster.stop(); this.roster = null; } }
  menuOff() { this.stopRoster(); document.body.classList.remove('zd-menu-on'); const side = document.getElementById('zd-side'); if (side && side.parentNode !== document.body) document.body.appendChild(side); }
  // from the menu: Commander and Be The Disaster head for the town where you left off (the first town the first time),
  // Sandbox lets you pick any place on the globe; the menu drops away first
  playMode(which, kind) {
    const G = this.globe;
    if (!G || !G.active) { this.startMode(which, kind); return; }
    this.menu.classList.add('gone'); clearTimeout(this._gone); this._gone = setTimeout(() => { this.menu.hidden = true; this.menu.classList.remove('gone'); }, 350);
    this.menuOff();
    const arrive = (key) => { if (key === placeKey()) { G.close(); this.startMode(which, kind); } else travel(key, which, kind ? { kind } : null); };
    if (which === 'sandbox') { G.choose({ title: 'SANDBOX', sub: 'Pick a city: tap it to play there', arrive, back: () => this.showMenu() }); return; }
    const key = this.profile.town(which);
    G.choose({ title: (which === 'be' ? 'BE THE DISASTER' : 'COMMANDER') + ' \u00B7 LEVEL ' + (PATH.indexOf(key) + 1), sub: PLACES[key].name, key, road: true, status: this.townStatus(which), arrive });
  }
  // how a place stands on the road for a mode (Commander, Be The Disaster): its number, won, open or locked
  townStatus(mode) {
    if (mode !== 'commander' && mode !== 'be') return null;
    const reach = this.profile.reach(mode), why = 'Win in ' + PLACES[PATH[reach]].name + ' to open the next town';
    return (key) => { const i = PATH.indexOf(key); return { text: (i + 1) + ' \u00B7 ' + PLACES[key].name + (i < reach ? ' \u2713' : i > reach ? ' \uD83D\uDD12' : ''), locked: i > reach || i < 0, why }; };
  }
  // on to another town: up from this one to the globe, then down to it (the page is built again there, same mode)
  journey(key) {
    const end = document.getElementById('zd-end'); if (end) end.hidden = true;
    if (!this.globe) { travel(key, this.modeName); return; }
    if (this.globe.up) this.globe.up(key); else { this.globe.open(); this.globe.after = key; }
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
    // the compass on the left (the districts are named by it): it turns with the view; a tap turns the view to face north
    const cp = this.compass = document.createElement('button'); cp.type = 'button'; cp.id = 'zd-compass'; cp.title = 'Compass: tap to face north'; cp.setAttribute('aria-label', 'Compass: tap to face north');
    cp.innerHTML = '<svg viewBox="0 0 48 48" aria-hidden="true"><g class="rose"><path d="M24 9 27.6 24 24 22 20.4 24z" fill="#ff5a3a"/><path d="M24 39 27.6 24 24 26 20.4 24z" fill="#f6ead2" opacity=".5"/>' +
      '<text class="n" x="24" y="6">N</text><text x="42" y="24.5">E</text><text x="24" y="42.5">S</text><text x="6" y="24.5">W</text></g></svg>';
    cp.onclick = () => { const off = this.camera.position.clone().sub(this.controls.target); this.faceNorth = { t: 0, from: Math.atan2(off.x, off.z) }; };
    document.body.appendChild(cp); this.rose = cp.querySelector('.rose'); this.roseA = 999;
    const barH = () => document.documentElement.style.setProperty('--zd-bar-h', this.bar.offsetHeight + 'px');
    if (window.ResizeObserver) new ResizeObserver(barH).observe(this.bar); else setInterval(barH, 500);
  }
  addPill(cls, label, id) {
    const d = document.createElement('div'); d.className = 'zd-pill ' + cls;
    d.innerHTML = '<b>0</b>' + (label ? '<i>' + label + '</i>' : '');
    if (id) d.id = id;
    this.top.appendChild(d);
    return d.querySelector('b');
  }
  // a button in the row along the bottom (an icon over its name), or above it for the ones that come and go; cards go
  // in their own row (the caller moves them there)
  addButton(id, html, onClick, cls = '') {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'zd-btn ' + cls; b.id = id; b.onclick = onClick;
    if (EXTRA.has(id) || cls.includes('zd-card')) { b.innerHTML = html; (cls.includes('zd-card') ? this.bar : this.extraRow()).appendChild(b); }
    else { b.innerHTML = (ICON[id] || '') + '<span class="l">' + html + '</span>'; this.row('dock', 'zd-dock').appendChild(b); }
    return b;
  }
  row(key, cls) { if (!this[key] || !this.bar.contains(this[key])) { this[key] = document.createElement('div'); this[key].className = cls; this.bar.appendChild(this[key]); } return this[key]; }
  extraRow() { return this.row('extra', 'zd-extra'); }
  setLabel(b, text) { if (b) (b.querySelector('.l') || b).textContent = text; }
  // a row of cards wider than the screen: drag it, or tap the arrows that show at either end while there are more
  addCardRow() {
    const w = document.createElement('div'); w.className = 'zd-cardwrap';
    w.innerHTML = '<div class="zd-cards"></div><button type="button" class="zd-arr l" aria-label="More on the left">\u2039</button><button type="button" class="zd-arr r" aria-label="More on the right">\u203A</button>';
    this.bar.appendChild(w);
    const row = w.firstChild, by = dragScroll(row, 'x');
    const ends = () => { const m = row.scrollWidth - row.clientWidth; w.classList.toggle('cl', row.scrollLeft > 2); w.classList.toggle('cr', row.scrollLeft < m - 2); };
    row.addEventListener('scroll', ends, { passive: true }); addEventListener('resize', ends); setTimeout(ends, 0);
    if (window.ResizeObserver) new ResizeObserver(ends).observe(row);
    w.querySelector('.l').onclick = () => by(-row.clientWidth * 0.7); w.querySelector('.r').onclick = () => by(row.clientWidth * 0.7);
    return row;
  }
  // above the bar while the camera follows something: what it is, and a button to stop
  addFollowChip() {
    const c = this.followChip = document.createElement('div'); c.id = 'zd-followchip'; c.hidden = true;
    c.innerHTML = '<span>Following <b></b></span><button type="button" class="zd-btn" id="zd-stop">\u2715 Stop</button>';
    this.extraRow().appendChild(c); this.stopBtn = c.querySelector('#zd-stop'); this.stopBtn.onclick = () => this.setFollow(-1);
  }
  addSpeedButton() {
    this.speedBtn = this.addButton('zd-speed', '1x', () => { this.speed = this.speed >= 4 ? 1 : this.speed * 2; this.setLabel(this.speedBtn, this.speed + 'x'); });
  }
  setSpeed(s) { this.speed = s; this.setLabel(this.speedBtn, s + 'x'); }

  // the compass card turned so N points to the north (-z) as the camera sees it; and the view turning to face north
  compassStep(dt) {
    const tg = this.controls.target, off = this.camera.position.clone().sub(tg);
    if (this.faceNorth) {
      const F = this.faceNorth; F.t += dt; const k = Math.min(1, F.t / 0.6), e = k * k * (3 - 2 * k), wrap = Math.atan2(Math.sin(-F.from), Math.cos(-F.from)), az = F.from + wrap * e, h = Math.hypot(off.x, off.z);
      this.camera.position.x = tg.x + Math.sin(az) * h; this.camera.position.z = tg.z + Math.cos(az) * h; this.camera.lookAt(tg); off.x = Math.sin(az) * h; off.z = Math.cos(az) * h;
      if (k >= 1) this.faceNorth = null;
    }
    const a = Math.round(Math.atan2(off.x, off.z) * 180 / Math.PI * 2) / 2; // north on screen, clockwise from up
    if (a !== this.roseA) { this.roseA = a; this.rose.setAttribute('transform', 'rotate(' + a + ' 24 24)'); }
  }

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
      if (e.type !== 'pointerup' || wasMulti || e.button > 0 || (this.globe && this.globe.active)) return; // up on the globe, taps are the globe's
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 10 && performance.now() - d.t < 400) {
        const hit = this.worldPoint(e.clientX, e.clientY);
        if (hit) this.mode.tap(hit.x, hit.z);
      }
    };
    dom.addEventListener('pointerup', up);
    dom.addEventListener('pointercancel', up);
    // touching the view while following does not let go: it turns and zooms round whoever is followed, and the camera keeps that angle
    this.controls.addEventListener('start', () => { this.zoomTo = 0; if (this.follow >= 0 || this.followSub) this.manualCam = true; });
    this.ray = new THREE.Raycaster(); this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  }

  worldPoint(cx, cy) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
    return curvedHit(this.ray.ray, new THREE.Vector3()); // onto the ground as drawn, bent by the world's curve
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

  // following: the view is locked on the subject, one finger (or the left mouse button) turns round it, two pinch to zoom; not following: drag pans
  lockControls(on) {
    const c = this.controls; c.enablePan = !on; c.mouseButtons.LEFT = on ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN; c.touches.ONE = on ? THREE.TOUCH.ROTATE : THREE.TOUCH.PAN;
    if (this.followChip) this.followChip.hidden = !on;
  }
  setFollow(i) {
    this.follow = i; this.followSub = null; this.followSide = i >= 0 ? 'bad' : null; this.manualCam = false; this.lockControls(i >= 0);
    if (this.followBtn) { this.followBtn.classList.toggle('on', i >= 0); this.setLabel(this.followBtn, i >= 0 ? 'Next disaster' : 'Follow disaster'); }
    if (this.goodBtn) { this.goodBtn.classList.remove('on'); this.setLabel(this.goodBtn, 'Follow rescue'); }
    if (this.followChip && i >= 0) this.followChip.querySelector('b').textContent = 'a zombie';
  }

  // what the two follow buttons step through. The bad guys: villains, the kaiju, the worm, riots, alien machines, every
  // other disaster (a tornado, a storm front, a falling meteor, a volcano...), then zombies. The good guys: the super heroes, helicopters, rescue vehicles on the move, then the responders on foot
  // nearest the view (police, firefighters, soldiers, the crews rebuilding)
  subjects(side = 'bad') {
    const out = [], D = this.disasters; if (!D) return out;
    if (side === 'good') {
      for (const e of D.list) if (e.alive && e.type === 'heroes') for (const h of e.who) out.push({ obj: h, name: h.name, pos: () => (h.state === 'fly' ? [h.x, h.y + 2.5, h.z] : null) });
      if (this.helis) for (const hl of this.helis.list) out.push({ obj: hl, name: 'Helicopter', kind: 'heli', pos: () => (this.helis.list.includes(hl) ? [hl.x, hl.y, hl.z] : null) });
      const VEH = { police: 'Police car', fire: 'Fire truck', apc: 'Army truck', bus: 'Evacuation bus', chaser: 'Storm chasers', tank: 'Tank', build: 'Construction truck', hazmat: 'Hazmat truck', medic: 'Ambulance', jail: 'Police bus' };
      for (const c of this.traffic.missions) out.push({ obj: c, name: VEH[c.kind] || 'Rescue truck', kind: 'car', pos: () => (!c.gone && c.mode === 0 ? [c.x, 1.5, c.z] : null) });
      const p = this.people, tg = this.controls.target, near = [];
      for (let i = 0; i < p.active; i++) {
        const k = p.kind[i], s = p.st[i];
        if (s === ST.DEAD || s === ST.EVAC || s === ST.EXT || s === ST.AIR) continue;
        const name = k === KIND.OFFICER ? 'Police officer' : k === KIND.SOLDIER ? 'Soldier' : k === KIND.FIREFIGHTER ? (s === ST.HELD ? 'Crew' : 'Firefighter') : null;
        if (name) near.push([Math.hypot(p.x[i] - tg.x, p.z[i] - tg.z), i, name]);
      }
      near.sort((a, b) => a[0] - b[0]);
      for (const [, i, name] of near.slice(0, 10)) { const k0 = p.kind[i]; out.push({ obj: 'p' + i, name, kind: 'foot', pos: () => (p.kind[i] === k0 && p.st[i] !== ST.DEAD && p.st[i] !== ST.EVAC && i < p.active ? [p.x[i], p.y[i] + 1, p.z[i]] : null) }); }
      return out.filter(s => s.pos());
    }
    for (const e of D.list) if (e.alive && e.type === 'villains') for (const v of e.who) out.push({ obj: v, name: v.name, pos: () => (v.gone ? null : [v.x, v.y + 2.5, v.z]) });
    for (const e of D.list) if (e.alive && e.type === 'kaiju') out.push({ obj: e, name: 'Kaiju', pos: () => (e.alive ? [e.x, 30, e.z] : null) });
    for (const e of D.list) if (e.alive && e.type === 'worm') out.push({ obj: e, name: 'Worm', pos: () => (!e.alive || e.phase === 'gone' ? null : e.phase === 'arc' ? [e.x - Math.cos(e.yaw) * 18, Math.max(8, e.y * 0.6), e.z - Math.sin(e.yaw) * 18] : [e.x, Math.max(0, e.y), e.z]) }); // in a leap: the middle of the arc
    for (const e of D.list) if (e.alive && e.type === 'riot' && e.mob) out.push({ obj: e, name: 'Riot', pos: () => (e.alive ? [e.mob.x, 1.5, e.mob.z] : null) });
    for (const e of D.list) if (e.alive && e.type === 'aliens') {
      e.tripods.forEach((t, k) => out.push({ obj: t, name: 'Tripod ' + (k + 1), pos: () => (t.state === 'walk' || t.state === 'drop' ? [t.x, t.y, t.z] : null) }));
      e.saucers.forEach((s, k) => out.push({ obj: s, name: 'Saucer ' + (k + 1), pos: () => (s.state === 'cruise' || s.state === 'act' ? [s.x, s.y, s.z] : null) }));
    }
    const own = new Set(['villains', 'kaiju', 'worm', 'riot', 'aliens', 'heroes']);
    for (const e of D.list) if (e.alive && !own.has(e.type)) { const name = HAZARDS[e.type] ? HAZARDS[e.type].name : e.type === 'nukeblast' ? 'Nuclear blast' : null; if (name) out.push({ obj: e, name, kind: 'disaster', pos: () => this.disasterAt(e) }); }
    return out.filter(s => s.pos());
  }
  // a storm front sweeping the city (tsunami, dust storm, cold wave, solar flare): the point of it level with the view,
  // its heading, and whether it has gone by. Null for anything else
  front(e) {
    const tg = this.controls.target;
    if (e.sw && (e.type === 'tsunami' || e.type === 'haboob' || e.type === 'coldwave')) {
      const sw = e.sw, t = (tg.x - sw.origin.x) * sw.tan.x + (tg.z - sw.origin.y) * sw.tan.y, s = sw.frontAt(t);
      return { x: sw.origin.x + sw.tan.x * t + sw.dir.x * s, z: sw.origin.y + sw.tan.y * t + sw.dir.y * s, dx: sw.dir.x, dz: sw.dir.y, gone: e.phase === 'recede' || e.phase === 'after' || e.phase === 'warn' && e.type === 'tsunami' };
    }
    if (e.type === 'solar' && e.dir) {
      const d = e.dir, o = e.origin, t = (tg.x - o[0]) * -d[1] + (tg.z - o[1]) * d[0];
      return { x: o[0] + d[0] * e.ws - d[1] * t, z: o[1] + d[1] * e.ws + d[0] * t, dx: d[0], dz: d[1], gone: e.ws > e.extent + 60 };
    }
    return null;
  }
  // where the follow camera looks for a disaster: a little ahead of a storm front (so the wall comes on towards the camera),
  // the middle of a tornado's funnel, a falling meteor or missile, where people are afloat in a flood, the spot itself
  disasterAt(e) {
    if (!e.alive) return null;
    const tg = this.controls.target, F = this.front(e);
    if (F) return F.gone ? null : [F.x + F.dx * 45, 12, F.z + F.dz * 45];
    if (e.type === 'tornado') { const tw = e.tw; return tw && tw.phase !== 'gone' ? [tw.x, Math.min(70, (tw.H || 120) * 0.35), tw.z] : null; }
    if (e.type === 'flood') { const s = this.people.swimSpots(1)[0]; return s ? [s[0], 2, s[1]] : [tg.x, 2, tg.z]; }
    const o = e.ball || e.missile; if (o && o.position && (e.phase === 'fall' || e.phase === 'held')) return [o.position.x, o.position.y, o.position.z]; // on its way down
    if (e.x == null) { const p = e.poi && e.poi(tg.x, tg.z); return p ? [p.x, 5, p.z] : null; }
    return [e.x, e.type === 'volcano' ? 40 : 5, e.z];
  }
  // the camera's shot for a disaster: ahead of a front looking back at it, chasing a tornado from behind, standing well
  // back from the rest
  disasterShot(e) {
    const F = this.front(e), P = Math.PI;
    if (F) return { key: 'lead-' + e.type, dist: e.type === 'haboob' ? 700 : 560, pol: 0.94, base: Math.atan2(F.dz, F.dx), off: 0.4, rate: 1.4 };
    if (e.type === 'tornado') return { key: 'tornado', dist: 480, pol: 1.0, base: (this.camDir ? this.camDir.heading : 0) + P, off: 0.55 }; // low enough to see how tall the funnel is
    if (e.type === 'meteor' || e.type === 'nuclear') return { key: 'sky-' + e.type, dist: 560, pol: 1.02 };
    if (e.type === 'sinkhole') return { key: 'sinkhole', dist: 320, pol: 0.62 }; // looking down into the pit
    if (e.type === 'quake') return { key: 'quake', dist: 600, pol: 0.78 };
    if (e.type === 'volcano') return { key: 'volcano', dist: 680, pol: 0.92 };
    if (e.type === 'flood') return { key: 'flood', dist: 380, pol: 0.72 };
    return { key: e.type, dist: 540, pol: 0.86 };
  }
  followSubject(s, side = this.followSide || 'bad') {
    this.follow = -1; this.followSub = s; this.followSide = side; this.dir = null; this.camDir = null; this.zoomTo = 0; this.manualCam = false; this.followIn = false; this.lockControls(true);
    const on = side === 'good' ? this.goodBtn : this.followBtn, off = side === 'good' ? this.followBtn : this.goodBtn;
    if (on) { on.classList.add('on'); this.setLabel(on, side === 'good' ? 'Next rescue' : 'Next disaster'); }
    if (off) { off.classList.remove('on'); this.setLabel(off, off === this.goodBtn ? 'Follow rescue' : 'Follow disaster'); }
    if (this.followChip) this.followChip.querySelector('b').textContent = s.name;
  }
  // the camera's shot for what it follows: how far back, how steeply it looks down (the angle from overhead), and the
  // side it looks from (base +/- off, whichever is nearer where the camera already is; no base: stay on this side)
  shot(s) {
    const o = s.obj, hd = this.camDir ? this.camDir.heading : 0, P = Math.PI;
    if (s.name === 'Kaiju') {
      if (o.state === 'leave') return { key: 'k-leave', dist: 380, pol: 0.82, base: o.yaw + P, off: 0.6 }; // watching it go
      if (o.act && o.act.kind === 'roar') return { key: 'k-roar', dist: 260, pol: 1.03, base: o.yaw, off: 0.3 }; // low, in front, looking up at it
      if (o.act || o.rig.tents.some(q => q.state === 'hold' || q.state === 'whip')) return { key: 'k-act', dist: 290, pol: 0.9, base: o.yaw, off: 0.9 };
      return { key: 'k-walk', dist: 330, pol: 0.93, base: o.yaw, off: 0.7 }; // low three-quarter view: how tall it is
    }
    if (s.name === 'Worm') {
      if (o.phase === 'arc') return { key: 'w-arc', dist: 300, pol: 1.0, base: o.yaw, off: P / 2, rate: 2.2 }; // side on, the whole leap in view (quick: the leap is short)
      return { key: 'w-dig', dist: 320, pol: 0.62, base: o.yaw + P, off: 0.5 }; // from behind and above: the ground caving in ahead of it
    }
    if (o.side === 'hero' && o.job && o.job.m) return { key: 'h-monster', dist: 320, pol: 0.97, base: hd, off: 0.8 }; // the hero and the monster both in view
    const foe = o.side === 'villain' ? o.foe && o.foe() : o.side === 'hero' && o.job ? o.job.v : null;
    if (foe && foe.x != null && !foe.gone) { // a fight up close: side on to the two of them
      const d = Math.hypot(foe.x - o.x, foe.z - o.z);
      if (d < 50 || o.gripped || o.tossed) return { key: 'fight', dist: Math.max(140, d * 2.6), pol: 0.95, base: Math.atan2(foe.z - o.z, foe.x - o.x), off: P / 2 };
    }
    if (o.name === 'Blur') return o.state === 'dash' ? { key: 'b-dash', dist: 270, pol: 0.75, base: hd + P, off: 0.6 } : { key: 'b-rest', dist: 170, pol: 0.92 }; // chasing him from behind
    if (o.name === 'Tyrant') return { key: o.held ? 't-hold' : 't-fly', dist: o.held ? 280 : 240, pol: 0.9, base: hd, off: 0.9 };
    if (o.name === 'Weaver') return { key: 'weaver', dist: 200, pol: 0.86, base: hd, off: 0.8 };
    if (o.side === 'hero') return { key: 'hero', dist: 200, pol: 0.84, base: hd, off: 0.8 };
    if (s.name === 'Riot') return { key: 'riot', dist: 240, pol: 0.72 };
    if (s.name.startsWith('Tripod')) return { key: 'tripod', dist: 280, pol: 0.98, base: hd, off: 0.7 };
    if (s.name.startsWith('Saucer')) return { key: 'saucer', dist: 300, pol: 0.86 };
    if (s.kind === 'car') return { key: 'car', dist: 220, pol: 0.62, base: hd + P, off: 0.4 }; // chasing it down the street, high enough to see over the buildings
    if (s.kind === 'heli') return { key: 'heli', dist: 280, pol: 0.86, base: hd, off: 0.9 };
    if (s.kind === 'foot') return { key: 'foot', dist: 150, pol: 0.62 }; // close enough to watch them work, looking down into the street
    if (s.kind === 'disaster') return this.disasterShot(o);
    return null;
  }
  // the Follow rescue button: each press the next of them
  cycleGood() {
    const subs = this.subjects('good');
    if (!subs.length) { this.toast('No rescuers out yet. Drop a disaster and they will come'); return; }
    let k = this.followSub && this.followSide === 'good' ? subs.findIndex(s => s.obj === this.followSub.obj) + 1 : 0;
    if (k >= subs.length) k = 0;
    this.followSubject(subs[k], 'good');
  }
  // the Follow disaster button
  cycleFollow() {
    const p = this.people, tg = this.controls.target, subs = this.subjects();
    if (subs.length) { // each press: the next of them, then the zombies (if any), then round again
      let k = this.followSub && this.followSide === 'bad' ? subs.findIndex(s => s.obj === this.followSub.obj) + 1 : 0;
      if (this.follow >= 0) k = 0;
      if (k >= subs.length && !(p.stats.zombies > 0)) k = 0;
      if (k < subs.length) { this.followSubject(subs[k], 'bad'); return; }
      this.followSub = null;
    }
    let i = -1;
    if (this.follow >= 0) { i = p.nearestZombie(p.x[this.follow], p.z[this.follow], this.follow); if (i < 0) i = this.follow; }
    else i = p.nearestZombie(tg.x, tg.z);
    if (i < 0) { this.toast('No zombies yet. Tap a street to drop one'); return; }
    this.setFollow(i);
    if (this.camera.position.distanceTo(tg) > 260) this.zoomTo = 230;
  }

  // the follow camera as a director: it works out which way the subject is heading, picks a shot for what it is doing
  // (re-aimed when that changes, or every 8 s) and glides round, up or down and in or out to it
  direct(q, dt) {
    const cd = this.camDir && this.camDir.obj === this.followSub.obj ? this.camDir : (this.camDir = { obj: this.followSub.obj, x: q[0], z: q[2], vx: 0, vz: 0, heading: 0 });
    if (dt > 0) {
      const f = Math.min(1, dt * 2); cd.vx += ((q[0] - cd.x) / dt - cd.vx) * f; cd.vz += ((q[2] - cd.z) / dt - cd.vz) * f; cd.x = q[0]; cd.z = q[2];
      if (Math.hypot(cd.vx, cd.vz) > 2) cd.heading = Math.atan2(cd.vz, cd.vx);
    }
    const sh = this.shot(this.followSub); if (!sh || this.manualCam) return; // turned or zoomed by hand: keep that angle
    const tg = this.controls.target, off = this._off.copy(this.camera.position).sub(tg), r = off.length() || 1;
    let pol = Math.acos(Math.min(1, Math.max(-1, off.y / r))), az = Math.atan2(off.z, off.x);
    const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    if (!this.dir || this.dir.key !== sh.key || this.realT > this.dir.until) {
      let want = null;
      if (sh.base != null) { const a1 = sh.base + sh.off, a2 = sh.base - sh.off; want = Math.abs(wrap(a1 - az)) < Math.abs(wrap(a2 - az)) ? a1 : a2; }
      this.dir = { key: sh.key, az: want, until: this.realT + 8 };
    }
    const k = 1 - Math.exp(-dt * (sh.rate || 0.8)), kd = 1 - Math.exp(-dt * 1.2);
    if (this.dir.az != null) az += wrap(this.dir.az - az) * k;
    pol += (Math.min(1.04, Math.max(0.4, sh.pol)) - pol) * k;
    const fit = Math.min(1.8, Math.max(1, 0.75 / this.camera.aspect)); // a phone held upright sees a narrow slice: stand further back
    const nr = r + (Math.min(1080, Math.max(125, sh.dist * fit)) - r) * kd;
    this.camera.position.set(tg.x + nr * Math.sin(pol) * Math.cos(az), tg.y + nr * Math.cos(pol), tg.z + nr * Math.sin(pol) * Math.sin(az));
  }

  update(dt, fps) {
    const p = this.people, h = 1 / 30;
    const sdt = dt * this.speed;
    this.acc = Math.min(this.acc + sdt, h * 12);
    let stepped = false;
    while (this.acc >= h) {
      stepped = true;
      p.step(h); this.traffic.step(h); if (this.helis) this.helis.update(h); if (this.disasters) this.disasters.update(h); this.acc -= h; this.simT += h;
      for (const e of p.events) if (e.type === 'bite') this.traffic.panicNear(e.x, e.z, 20);
      this.mode.afterStep && this.mode.afterStep(h);
    }
    for (let k = this.pendingFires.length - 1; k >= 0; k--) {
      if (this.simT >= this.pendingFires[k].t) { this.fire.igniteBuilding(this.pendingFires[k].k); this.pendingFires.splice(k, 1); }
    }
    this.realT += dt;
    p.uTime.value = this.realT;
    if (stepped) this.traffic.sync(this.realT); // cars and people only move on a step (30 a second): no need to rebuild their matrices on the frames between
    if (this.helis) this.helis.sync(dt * this.speed);
    if (this.daylight) { this.daylight.set(this.mode.phase ? this.mode.phase() : 0); if (this.disasters) { this.disasters.weather.apply(dt); this.disasters.afterLight(); } this.daylight.update(); }
    this.fire.update(sdt, this.realT, this.camera, this.renderer);
    if (stepped || p.lookDirty) p.sync();
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
    this.focusAt = null;
    if (this.followSub) {
      const q = this.followSub.pos();
      const B = this.city.bounds, inCity = (p) => p && p[0] > B.x0 + 12 && p[0] < B.x1 - 12 && p[2] > B.z0 + 12 && p[2] < B.z1 - 12;
      if (q && inCity(q)) this.followIn = true;
      if (!q || (this.followIn && !inCity(q))) { // gone, or on its way out of the city: on to another of the same side, or stop
        const side = this.followSide || 'bad', cur = this.followSub.obj, next = this.subjects(side).find(s => s.obj !== cur && inCity(s.pos()));
        if (next) this.followSubject(next, side); else this.setFollow(-1);
      } else {
        const tg = this.controls.target, off = this._off.copy(this.camera.position).sub(tg), u = off.y > 1 ? q[1] / off.y : 0;
        const gx = q[0] - off.x * u, gz = q[2] - off.z * u, k = 1 - Math.exp(-dt * 6); // the ground point that puts it in the middle of the view
        const dx = (gx - tg.x) * k, dz = (gz - tg.z) * k;
        tg.x += dx; tg.z += dz; this.camera.position.x += dx; this.camera.position.z += dz;
        this.focusAt = this._fp.set(q[0], q[1], q[2]); // the depth of field is focused on it, so it stays sharp and what is behind it blurs
        this.direct(q, dt);
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
        if (this.audio) this.audio.event(e);
        if (this.disasters) this.disasters.onEvent(e);
        const handled = this.mode.onEvent ? this.mode.onEvent(e) : false;
        if (list === dEv && e.text && handled !== true) this.toast(e.text, 4200);
        if (msgs[e.type] && !this.seen[e.type]) { this.seen[e.type] = true; this.toast(msgs[e.type], 3200); }
      }
      list.length = 0;
    }
    this.mode.update(sdt, dt);
    if (this.audio) this.audio.update(dt, this);
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
  pray: 'People are kneeling in the street to pray',
  fightback: 'Some people are fighting back with whatever they can find',
  stolen: 'Someone hotwired a parked car and sped off',
};
const START_DROPS = 3;

class Sandbox {
  constructor(g) {
    this.g = g; this.msgs = SANDBOX_MSGS; this.kind = 'sandbox';
    if (g.disasters) g.disasters.boats.auto = true; // rescue boats come by themselves here
    this.auto = new Responders(g); // and so does everyone else, unless you switch them off
    this.el = {
      h: g.addPill('zd-h', 'Humans'), i: g.addPill('zd-i', 'Infected'), z: g.addPill('zd-z', 'Zombies'), d: g.addPill('zd-d', 'Dead'),
      clock: g.addPill('', '', 'zd-clock'),
    };
    this.helpBtn = g.addButton('zd-help', 'Call the heroes', () => this.callHeroes()); this.helpBtn.hidden = true; // only while there is something they could stop
    g.addFollowChip();
    this.disBtn = g.addButton('zd-disb', 'Disasters', () => {
      if (this.pending) { const was = this.pending; this.pending = null; this.gauge.cancel(); this.close(); g.toast(was === 'zombies' ? 'Done dropping zombies' : 'Cancelled'); return; } // the button cancels a disaster waiting to be placed
      this.showPanel(this.panel.hidden); });
    g.followBtn = g.addButton('zd-find', 'Follow disaster', () => g.cycleFollow());
    g.goodBtn = g.addButton('zd-good', 'Follow rescue', () => g.cycleGood());
    g.addSpeedButton();
    g.addButton('zd-reset', 'Reset', () => this.reset());
    g.addButton('zd-menu-btn', 'Menu', () => { location.href = location.pathname; });
    this.buildPanel(); this.bindHold();
    this.dropsLeft = START_DROPS; this.clock = -1; this.milestone = 0;
    g.toast('Open Disasters to drop zombies or unleash a disaster', 4500);
  }
  buildPanel() {
    const g = this.g, d = document.createElement('div'); d.id = 'zd-dis'; d.hidden = true;
    d.innerHTML = '<div class="tabs"><button type="button" class="on" data-tab="dis">Disasters</button><button type="button" data-tab="wx">Weather</button><button type="button" data-tab="go">Travel</button></div><div class="pbody">' +
      '<div data-pane="dis"><div class="g"><button class="zd-btn zb" type="button" data-zb>Zombies · ' + START_DROPS + '</button>' + Object.keys(HAZARDS).map(h => '<button class="zd-btn" type="button" data-hz="' + h + '">' + HAZARDS[h].name + '</button>').join('') + '</div>' +
      '<div class="h">Help</div><div class="g two"><button class="zd-btn auto" type="button" data-auto>Auto responders: On</button><button class="zd-btn hero" type="button" data-hero>Hero signal \u262E</button></div></div>' +
      '<div data-pane="wx" hidden><div class="g">' + Object.keys(WEATHER).map(w => '<button class="zd-btn" type="button" data-wx="' + w + '">' + WEATHER[w].name.replace('Thunderstorm', 'Storm') + '</button>').join('') + '</div></div>' +
      '<div data-pane="go" hidden><div class="g">' + Object.keys(PLACES).map(k => '<button class="zd-btn' + (k === placeKey() ? ' sel' : '') + '" type="button" data-place="' + k + '">' + PLACES[k].name + '</button>').join('') + '</div></div></div>';
    document.body.appendChild(d); this.panel = d; this.zbBtn = d.querySelector('[data-zb]');
    const body = d.querySelector('.pbody'); dragScroll(body, 'y');
    d.querySelectorAll('[data-tab]').forEach(t => { t.onclick = () => {
      d.querySelectorAll('[data-tab]').forEach(o => o.classList.toggle('on', o === t));
      d.querySelectorAll('[data-pane]').forEach(p => { p.hidden = p.dataset.pane !== t.dataset.tab; }); body.scrollTop = 0;
    }; });
    addEventListener('resize', () => { if (!d.hidden) this.fitPanel(); });
    const autoBtn = d.querySelector('[data-auto]');
    autoBtn.onclick = () => { this.auto.setOn(!this.auto.on); autoBtn.textContent = 'Auto responders: ' + (this.auto.on ? 'On' : 'Off'); autoBtn.classList.toggle('off', !this.auto.on); g.toast(this.auto.on ? 'Responders will answer every disaster and rebuild afterwards' : 'Responders off: nobody comes to help', 3500); };
    d.querySelector('[data-hero]').onclick = () => { const tg = g.controls.target; g.disasters.start('heroes', tg.x, tg.z); this.pending = null; this.close(); if (this.clock < 0) this.clock = 0; }; // the peace sign goes up over the middle of the view
    this.zbBtn.onclick = () => { // armed until the Shamblers run out or you tap Done: every tap on a street drops one
      if (this.dropsLeft <= 0) { g.toast('No Shamblers left. Tap Reset to start over'); return; }
      this.pending = 'zombies'; d.querySelectorAll('[data-hz]').forEach(o => o.classList.remove('sel'));
      this.showPanel(false); this.zombieLabel();
      g.toast('Tap streets to drop Shambler zombies (' + this.dropsLeft + ' left)', 4000);
    };
    d.querySelectorAll('[data-hz]').forEach(b => { b.onclick = () => {
      const h = b.dataset.hz;
      if (HAZARDS[h].tap) { // out of the way so you can see where it goes
        this.pending = h; d.querySelectorAll('[data-hz]').forEach(o => o.classList.toggle('sel', o.dataset.hz === h));
        this.showPanel(false); g.setLabel(this.disBtn, 'Cancel');
        if (SIZED[h]) { g.controls.enabled = false; g.toast('Press and hold where it goes: the longer you hold, the bigger it gets. Let go to drop it', 4500); } // the finger sizes it instead of moving the camera
        else g.toast('Tap the map where the ' + HAZARDS[h].name.toLowerCase() + ' should strike', 4000);
        return;
      }
      g.disasters.start(h); this.close(); if (this.clock < 0) this.clock = 0;
    }; });
    d.querySelectorAll('[data-place]').forEach(b => { b.onclick = () => { this.close(); if (b.dataset.place !== placeKey()) g.journey(b.dataset.place); }; }); // up to the globe and down to it
    d.querySelectorAll('[data-wx]').forEach(b => { b.onclick = () => { g.disasters.weather.set(b.dataset.wx); g.toast('Weather: ' + WEATHER[b.dataset.wx].name); this.close(); }; });
  }
  zombieLabel() {
    if (this.zbBtn) { this.zbBtn.textContent = 'Zombies · ' + this.dropsLeft; this.zbBtn.classList.toggle('empty', this.dropsLeft <= 0); }
    if (this.pending === 'zombies') this.g.setLabel(this.disBtn, 'Done (' + this.dropsLeft + ' left)');
  }
  // the panel sits between the bar and the numbers at the top, and scrolls if the screen is too short for it
  showPanel(on) {
    this.panel.hidden = !on; document.body.classList.toggle('zd-panel', on); this.disBtn.classList.toggle('on', on);
    if (on) this.fitPanel();
  }
  fitPanel() { const top = this.g.top.getBoundingClientRect().bottom; this.panel.style.maxHeight = Math.max(170, innerHeight - this.g.bar.offsetHeight - top - 22) + 'px'; }
  close() { this.showPanel(false); this.g.setLabel(this.disBtn, 'Disasters'); if (!this.gauge.active) this.g.controls.enabled = true; }
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
  // something the heroes could stop (or help with): super villains, the kaiju or the worm, a meteor or a missile on its way, a tsunami
  threat() {
    const D = this.g.disasters; if (!D) return null;
    for (const e of D.list) {
      if (!e.alive) continue;
      if (e.type === 'villains') { const v = e.who.find(w => !w.gone && !w.beaten && !w.heroLost); if (v) return { x: v.x, z: v.z, name: 'the villains' }; }
      if (((e.type === 'kaiju' && e.state !== 'leave') || (e.type === 'worm' && e.phase !== 'leave' && e.phase !== 'gone')) && !e.heroLost) return { x: e.x, z: e.z, name: 'the ' + (e.type === 'kaiju' ? 'monster' : 'worm') };
      if ((e.type === 'meteor' || e.type === 'nuclear') && (e.phase === 'warn' || e.phase === 'fall') && !e.heroLost) return { x: e.x, z: e.z, name: 'the ' + (e.type === 'meteor' ? 'meteor' : 'missile') };
      if (e.type === 'tsunami' && e.phase !== 'recede') { const c = this.g.controls.target; return { x: c.x, z: c.z, name: 'the wave' }; }
    }
    return null;
  }
  // light the hero signal over the trouble. Not called in time, the disaster runs its course
  callHeroes() {
    const g = this.g, t = this.threat(), c = g.controls.target;
    g.disasters.start('heroes', t ? t.x : c.x, t ? t.z : c.z);
    if (this.clock < 0) this.clock = 0;
  }
  update(sdt, dt) {
    this.gauge.update(dt || 0);
    this.auto.update(sdt);
    { // the Call heroes button: there (and flashing) while there is something for them and they are not already here
      const D = this.g.disasters, here = D && D.list.some(e => e.type === 'heroes' && e.alive && !e.leaving), t = !here && this.threat();
      if (t && this.helpBtn.hidden) this.g.toast('Call the heroes to stop ' + t.name + ', or let it happen', 3500);
      this.helpBtn.hidden = !t; if (t) this.helpBtn.classList.toggle('on', Math.floor(this.g.realT * 2.5) % 2 === 0);
    }
    if (this.gauge.active) { const g = this.g, R = SIZED[this.gauge.kind].ring(this.gauge.v), d = g.camera.position.distanceTo(g.controls.target), want = Math.min(g.controls.maxDistance || 1200, R * 3); if (want > d + 5) g.zoomTo = want; } // pull back to keep the ring in view
    const s = this.g.people.stats;
    if (this.clock >= 0) this.clock += sdt;
    for (const m of [10, 50, 100, 250, 500, 1000, 2000]) if (s.zombies >= m && this.milestone < m) { this.milestone = m; this.g.toast(m + ' zombies roam the city'); }
    this.el.h.textContent = s.humans; this.el.i.textContent = s.infected; this.el.z.textContent = s.zombies; this.el.d.textContent = s.dead;
    if (this.clock >= 0) { const t = Math.floor(this.clock); this.el.clock.textContent = 'T+' + String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); }
    else this.el.clock.textContent = 'Waiting';
  }
}
