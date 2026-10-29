// My Little Disaster: a miniature tilt-shift city with traffic and crowds, hit by disasters.
import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { makeTextures } from './textures.js';
import { buildCity } from './city.js';
import { Traffic } from './traffic.js';
import { Post } from './post.js';
import { People } from './people.js';
import { Game } from './game.js';
import { Fire } from './fire.js';
import { Daylight } from './daylight.js';
import { Helicopters } from './aircraft.js';
import { Disasters } from './disasters.js';
import { buildOutskirts } from './outskirts.js';
import { Sirens } from './sirens.js';
import { Searchlights } from './searchlights.js';
import { Audio } from './audio.js';
import { CURVE, curveFrame } from './curve.js';
import { seeFrame, SEE, seeButton } from './see.js';
import { Band } from './band.js';
import { BandGame } from './rhythm.js';
import { Rail } from './rail.js';
import { Flight } from './flight.js';
import { Drive } from './drive.js';
import { TakeOver } from './takeover.js';
import { PLACES, placeKey, settle } from './places.js';
import { Globe } from './globe.js';
import { Sky } from './sky.js';
import { Radio } from './radio.js';
import { damageOf, rememberDamage, takeMeteor } from './world.js';

const P = new URLSearchParams(location.search);
CURVE.on = P.get('curve') !== '0'; // ?curve=0: the flat world, to compare
const coarse = matchMedia('(pointer: coarse)').matches;
const low = P.get('q') === 'low' || (coarse && P.get('q') !== 'high');
const num = (k, d) => (P.has(k) ? parseFloat(P.get(k)) : d);
const mode = P.get('mode') || 'menu'; // menu | commander | be | sandbox | tv

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: P.has('shot') });
renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NoToneMapping;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const haze = new THREE.Color('#d9bf95');
scene.background = haze;
scene.fog = new THREE.FogExp2(haze, num('fog', 0.0006));

const camera = new THREE.PerspectiveCamera(num('fov', 18), innerWidth / innerHeight, 10, 7000); // far: zoomed right out, the horizon where the world curves away
const controls = new MapControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.screenSpacePanning = false;
controls.minDistance = 120; // close enough to watch a fight
controls.maxDistance = CURVE.on ? 2200 : 1100; // out far enough to see the whole city and the world curving away round it
controls.minPolarAngle = 0.35;
controls.maxPolarAngle = 1.05;
controls.zoomSpeed = 0.8;

function setView(x = 0, z = 0, dist = 420, pitchDeg = 46, yawDeg = 45) {
  const pol = (90 - pitchDeg) * Math.PI / 180, az = yawDeg * Math.PI / 180;
  controls.target.set(x, 0, z);
  camera.position.set(
    x + dist * Math.sin(pol) * Math.sin(az),
    dist * Math.cos(pol),
    z + dist * Math.sin(pol) * Math.cos(az));
  camera.lookAt(controls.target);
  controls.update();
}
setView(num('x', 0), num('z', 0), num('d', coarse ? 430 : 470), num('p', 48), num('a', 45));
const sky = new Sky(camera, controls), viaSky = Sky.arriving(); // the trip to and from orbit, through the clouds
if (viaSky) sky.set(1); // this page was reached through them: it starts inside

// lights
const hemi = new THREE.HemisphereLight('#fff0d4', '#7a5c3c', num('hemi', 1.25));
scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffd6a0', num('sun', 5.0));
sun.castShadow = true;
sun.shadow.mapSize.set(low ? 2048 : 4096, low ? 2048 : 4096);
const sc = sun.shadow.camera;
sc.left = -300; sc.right = 300; sc.top = 300; sc.bottom = -300; sc.near = 10; sc.far = 1600;
sc.layers.enable(1); // layer 1: low-detail stand-ins that only cast shadows (people, tree crowns)
sun.shadow.bias = -0.0003;
sun.shadow.normalBias = 0.35;
scene.add(sun, sun.target);

// world: the place's city and everything in it. Built straight away for a game; behind the menu only once a place is
// picked (under the clouds), so the first trip from the menu needs no page load and the sound the menu's taps turned on
// keeps playing
const post = new Post(renderer, { samples: low ? 0 : 4 });
if (P.has('blur')) post.opts.blurFrac = num('blur', 0.018);
if (P.get('dof') === '0') post.opts.dof = false;
if (P.get('grade') === '0') post.opts.grade = false;
let W = null, tex = null;
function buildWorld() {
  const t0 = performance.now();
  tex = tex || makeTextures(renderer);
  const place = PLACES[placeKey()]; // which place in the world this is (the big city unless ?place= says otherwise)
  const city = buildCity(tex, { ...place, seed: num('seed', place.seed ?? 20261025), blocks: Math.min(place.blocks ?? 12, low ? 10 : 12) });
  scene.add(city.group);
  const outskirts = buildOutskirts(scene, city, { low, land: place.land });
  const traffic = new Traffic(city, scene, { cars: Math.round((low ? 160 : 280) * (place.cars ?? 1)) });
  const people = new People(city, scene, { people: Math.round((low ? 2600 : 5200) * (place.people ?? 1)), crowd: (place.people ?? 1) * (low ? 0.6 : 1) });
  const fire = new Fire(scene, city, { low });
  const helis = new Helicopters(scene, city, fire, people);
  helis.traffic = traffic;
  const buildMs = Math.round(performance.now() - t0);
  const daylight = new Daylight({ scene, sun, hemi, post, city, traffic, people });
  daylight.set(0);
  const disasters = new Disasters({ scene, city, people, traffic, fire, post, camera, controls, renderer, sun, hemi, low, outskirts });
  outskirts.steam(fire);
  helis.mushroom = (x, z, R) => disasters.mushroom(x, z, R); // the commander's nuke gets the full mushroom cloud
  helis.nukeBlast = (x, z, R) => disasters.nukeBlast(x, z, R, { byPlayer: true }); // the commander's own nuke
  const sirens = new Sirens(scene, { traffic, helis, boats: disasters.boats, daylight, fire }); // flashing lights on every rescue unit
  disasters.sirens = sirens;
  W = { city, outskirts, traffic, people, fire, helis, daylight, disasters, sirens, buildMs };
  if (game) worldReady();
  return W;
}
// leave this place for another in this page: what it remembers kept, everything of it out of the scene and freed (the
// shared textures stay for the next), then the next one built and the view put back over its middle
function moveWorld(key, m, kind) {
  if (W) {
    if (W.band) W.band.dispose();
    if (W.rail) W.rail.dispose();
    keepDamage(); game.leaveWorld();
    const keep = new Set([sun, sun.target, hemi]);
    for (const o of [...scene.children]) {
      if (keep.has(o)) continue;
      scene.remove(o);
      o.traverse(n => { if (n.geometry) n.geometry.dispose(); for (const mt of Array.isArray(n.material) ? n.material : n.material ? [n.material] : []) mt.dispose(); });
    }
    W = null;
  }
  settle(key, m, kind ? { kind } : null);
  setView(0, 0, coarse ? 430 : 470, 48, 45);
  buildWorld();
  globe.setHere();
}
const needWorld = mode === 'commander' || mode === 'sandbox' || mode === 'tv' || ((mode === 'be' || mode === 'storm') && (P.has('kind') || mode === 'storm'));
let game = null;
if (needWorld) buildWorld();

addEventListener('resize', () => {
  globe.resize();
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); post.setSize();
});

const clock = new THREE.Clock();
renderer.shadowMap.autoUpdate = false; let shadowAt = -1; const camAt = new THREE.Vector3();
let frames = 0, fpsT = 0, fps = 0, time = 0;
const M = 10;

function frame() {
  const dt = Math.min(0.05, clock.getDelta());
  time += dt;
  sky.update(dt);
  if (globe.active || !W) { controls.enabled = false; if (globe.active) globe.frame(dt); frames++; fpsT += dt; requestAnimationFrame(frame); globeWas = true; return; } // up on the globe (or nothing built yet): the city waits
  if (globeWas) { globeWas = false; controls.enabled = !sky.busy(); }
  const { city, outskirts, daylight, disasters, sirens } = W, B = city.bounds, pilot = [game.flight, game.drive, game.takeover, game.bandGame].find(c => c && c.active) || null, fl = !!pilot; // flying a plane, on the ground (drive.js), driving a disaster (takeover.js) or playing the band (rhythm.js): it has the camera
  if (!fl) controls.update();
  // keep the view over the city
  const tg = controls.target;
  const cx = THREE.MathUtils.clamp(tg.x, B.x0 + M, B.x1 - M), cz = THREE.MathUtils.clamp(tg.z, B.z0 + M, B.z1 - M);
  if (!fl && (cx !== tg.x || cz !== tg.z)) { camera.position.x += cx - tg.x; camera.position.z += cz - tg.z; tg.x = cx; tg.z = cz; }
  tg.y = 0;

  game.update(dt, fps);
  sky.step(dt); // up off the city, or down to it
  game.compassStep(dt);
  if (fl) pilot.frame(dt, tg); // the plane or what is driven, and the camera behind it or in its seat
  outskirts.update(time, scene, sun, disasters.lightK, disasters.sunK);
  sun.position.copy(tg).addScaledVector(daylight.sunDir, 700); // the sun (or the moon) where the day and night cycle has it
  sun.target.position.copy(tg);
  { const e = Math.max(300, Math.min(950, camera.position.distanceTo(tg) * 0.45)); if (e !== sc.right) { sc.left = sc.bottom = -e; sc.right = sc.top = e; sc.far = 1600 + e; sc.updateProjectionMatrix(); } } // shadows cover what is in view
  // the shadow map only needs redrawing when the world has moved (a simulation step) or the view has
  if (game.simT !== shadowAt || !camAt.equals(camera.position)) { renderer.shadowMap.needsUpdate = true; shadowAt = game.simT; camAt.copy(camera.position); }
  const focus = fl ? pilot.focus : camera.position.distanceTo(game.focusAt || tg); // whatever Follow is on stays in focus
  const lv = fl ? pilot.lod : focus > 300 ? 3 : 0; if (city.far !== lv) { city.far = lv; city.lod(!!(lv & 1)); W.people.lod(!!(lv & 2)); W.traffic.lod(!!(lv & 2)); } // in fewer pieces: the tree crowns (1), the people and cars (2) - zoomed out or flying all of them, on the ground only the trees
  const nearZ = fl ? pilot.near : Math.max(10, focus * 0.2); // the near plane follows the zoom: far more depth precision, so flat rooftop details don't flicker on phones
  if (Math.abs(camera.near - nearZ) > 0.5) { camera.near = nearZ; camera.updateProjectionMatrix(); }
  // camera shake (quakes, blasts, the tsunami): a jolt for this frame only
  let jx = 0, jy = 0, jz = 0;
  if (game.shake > 0) {
    const k = Math.min(2.5, game.shake) * 2.2 * focus / 430;
    jx = (Math.random() - 0.5) * k; jy = (Math.random() - 0.5) * k * 0.5; jz = (Math.random() - 0.5) * k;
    camera.position.x += jx; camera.position.y += jy; camera.position.z += jz;
  }
  sirens.update(time); W.searchlights.update(dt); if (W.band) W.band.update(dt);
  curveFrame(scene, camera, tg); // the world curves away as you zoom out
  seeFrame(camera, game.focusAt || tg, focus); // walls between the camera and the action go see-through, close in
  post.render(scene, camera, focus, time);
  camera.position.x -= jx; camera.position.y -= jy; camera.position.z -= jz;

  frames++; fpsT += dt;
  if (fpsT > 0.5) { fps = Math.round(frames / fpsT); frames = 0; fpsT = 0; }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

game = new Game({ camera, controls, renderer, mode, post, world: W });
game.buildWorld = buildWorld; // the menu builds the place it picks, here
game.flight = new Flight(game, { camera, controls, post, renderer }); // the Sandbox's planes
game.drive = new Drive(game, { camera, controls, post, renderer }); // and on the ground: the tank, the police officer and their cars
game.takeover = new TakeOver(game, { camera, controls, post, renderer }); // and a disaster's own units, driven from behind
game.bandGame = new BandGame(game, { camera, controls, post, renderer }); // and the band, played to the beat
game.moveWorld = moveWorld;
game.audio = new Audio(camera, controls); // sound: switched on by the first tap
game.radio = new Radio(game.audio); // the announcer
if (!game.menu.hidden) { game.audio.music.setMenu(true); game.audio.ufo(game.menuPanel === 'main'); } // the theme on the menus; the saucer humming
seeButton((on) => game.toast('See through buildings: ' + (on ? 'on' : 'off'))); // the eye: walls between you and the action fade, or not
if (game.menu.hidden) game.radio.begin(game.modeName === 'be' && game.mode ? game.mode.kind : null);
const globe = game.globe = new Globe(renderer); let globeWas = false; // the world from orbit: the big city and the towns
globe.known = (key) => game.profile.beaten(key); // the towns won in show their names
globe.statusFor = () => game.townStatus(game.modeName); // Commander and Be The Disaster: towns further down the road are locked
globe.trail = (m) => game.profile.been(m === 'commander' || m === 'be' ? m : null); // the road only as far as the towns played (Sean: your trail, not where you are going)
globe.mode = () => game.modeName;
globe.sky = sky;
globe.onZoom = (k) => game.audio.music.setZoom(k); // zoomed in on the planet: its songs closer
globe.onFacing = (key) => game.audio.music.setMenuSong(PLACES[key].style ? 'theme2' : 'theme'); // on the menu: the Far East turned towards you, the second song
globe.moveTo = (key) => { const m = game.modeName, kind = m === 'be' && game.mode ? game.mode.kind : null; moveWorld(key, m, kind); globe.close(); game.startMode(m, kind); setTimeout(meteorIn, 800); }; // another town from the globe, built here
globe.up = (after) => { game.setFollow(-1); sky.up(() => { globe.open({ clouds: true }); globe.after = after || null; }); }; // up through the clouds (then on to another town)
if (viaSky) game.audio.askTap(); // the trip reloaded the page: sound needs a tap again
if (viaSky) setTimeout(() => { if (globe.active) { sky.to(0, 0.8); return; } const r1 = game.zoomTo || 0; game.zoomTo = 0; sky.down(r1); }, 300); // out of the clouds over the streets
if (!game.menu.hidden) { globe.backdrop(); game.dockSide(); if (viaSky) globe.pullBack(placeKey()); }
// a fresh start on the menu: the title and a PLAY button over the turning planet first (Sean); the tap starts the music and the menu pops up
if (!game.menu.hidden && !viaSky) {
  const st = document.createElement('style'); st.textContent = '#zd-play{position:fixed;inset:0;z-index:45;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding-bottom:max(48px,9vh);box-sizing:border-box;gap:30px;cursor:pointer;-webkit-tap-highlight-color:transparent}' +
    '#zd-play .t{font:900 46px/0.95 Impact,Futura-CondensedExtraBold,"Arial Black",sans-serif;letter-spacing:.04em;text-align:center;color:#f4eee4;text-shadow:3px 3px 0 #7a0d12,0 0 22px rgba(255,79,163,.55)}' +
    '#zd-play .s{margin-top:-18px;font:700 14px/1.3 system-ui,-apple-system,sans-serif;color:#ffd6ef;text-align:center;padding:0 24px;text-shadow:0 0 10px rgba(255,79,163,.7),0 1px 6px rgba(0,0,0,.8)}' +
    '#zd-play button{font:900 26px/1 Impact,Futura-CondensedExtraBold,"Arial Black",sans-serif;letter-spacing:.12em;color:#fff;padding:16px 58px;border-radius:32px;border:2px solid rgba(255,255,255,.35);background:linear-gradient(#ff4fa3,#b3123f);box-shadow:0 6px 24px rgba(0,0,0,.5),0 0 26px rgba(255,79,163,.45);animation:zdBeat 1.1s ease-in-out infinite}' +
    '@keyframes zdBeat{50%{transform:scale(1.06)}}body.zd-gate #zd-side{visibility:hidden}#zd-menu.pop .box{animation:zdPop .5s cubic-bezier(.2,1.4,.4,1)}@keyframes zdPop{from{transform:translateY(60px) scale(.9);opacity:0}}';
  document.head.appendChild(st);
  const gate = document.createElement('div'); gate.id = 'zd-play'; gate.innerHTML = '<div class="t">MY LITTLE<br>DISASTER</div><div class="s">Save it, wreck it, or sit back and bet on it!</div><button type="button">PLAY</button>';
  game.menu.style.visibility = 'hidden'; document.body.classList.add('zd-gate'); document.body.appendChild(gate);
  const go = (e) => { if (e) e.stopPropagation(); gate.remove(); removeEventListener('keydown', key); document.body.classList.remove('zd-gate'); game.menu.style.visibility = ''; game.menu.classList.add('pop'); setTimeout(() => game.menu.classList.remove('pop'), 600); setTimeout(() => game.radio.farIdent(), 2500); }; // the call sign, once, from far off
  const key = (e) => { if (e.key === 'Enter' || e.key === ' ') go(); };
  gate.onclick = go; addEventListener('keydown', key); // the tap itself has started the sound (audio.js: the first tap)
} // the menu sits over the planet (come up from a town: pulling back off it)
// what this place remembers: the buildings that came down here last time (Sandbox; Commander starts each round fresh)
const sandbox = () => game.mode && game.mode.kind === 'sandbox';
const keepDamage = () => { if (!W || !sandbox()) return; const { city } = W, dead = []; for (let k = 0; k < city.buildings.length; k++) if (city.dead[k]) dead.push(k); rememberDamage(placeKey(), dead); };
setInterval(keepDamage, 5000); addEventListener('pagehide', keepDamage); globe.onOpen = keepDamage;
// a meteor sent down from orbit on this place: it comes in now
const meteorIn = () => { if (!W) return; const m = takeMeteor(placeKey()); if (!m || !sandbox()) return; const B = W.city.bounds, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2, hx = (B.x1 - B.x0) * 0.4, hz = (B.z1 - B.z0) * 0.4; W.disasters.start('meteor', cx + Math.max(-hx, Math.min(hx, m.x)), cz + Math.max(-hz, Math.min(hz, m.z)), { warn: 7, size: m.size }); };
globe.onArrive = meteorIn; setTimeout(meteorIn, 1500);
// once there is a world: the game takes it, the searchlights, what the place remembers, the test handle
function worldReady() {
  const { city, people, traffic, fire, helis, daylight, disasters, outskirts, sirens, buildMs } = W;
  if (!game.people) game.attachWorld(W);
  W.searchlights = new Searchlights(scene, { game, traffic, helis, city, daylight }); // beams at night on the trouble
  window.__lights = W.searchlights;
  W.rail = game.rail = city.rail ? new Rail({ scene, city, disasters, post }) : null; // the neon city's trains overhead
  W.band = game.band = new Band({ scene, game, city, people, traffic, fire, disasters, camera, controls, get music() { return game.audio && game.audio.music; } }); // the house band, playing the theme
  for (const k of damageOf(placeKey())) if (city.buildings[k] && !city.dead[k]) { people.clearBuilding(k, 'spare'); city.hideBuilding(k); city.addRubble(k, 0.75); }
  window.__z = { see: SEE, THREE, scene, camera, controls, renderer, post, city, traffic, people, fire, game, daylight, helis, disasters, outskirts, sirens, sun, hemi, setView, buildMs, audio: game.audio, info: () => renderer.info.render };
}
if (W) worldReady();
else window.__z = { THREE, scene, camera, controls, renderer, post, game, sun, hemi, setView, audio: game.audio, buildWorld };
