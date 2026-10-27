// My Tiny Disaster: a miniature tilt-shift city with traffic and crowds, hit by disasters.
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

const P = new URLSearchParams(location.search);
const coarse = matchMedia('(pointer: coarse)').matches;
const low = P.get('q') === 'low' || (coarse && P.get('q') !== 'high');
const num = (k, d) => (P.has(k) ? parseFloat(P.get(k)) : d);
const mode = P.get('mode') || 'menu'; // menu | commander | be | sandbox

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

const camera = new THREE.PerspectiveCamera(num('fov', 18), innerWidth / innerHeight, 10, 3000);
const controls = new MapControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.screenSpacePanning = false;
controls.minDistance = 120; // close enough to watch a fight
controls.maxDistance = 1100;
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

// world
const t0 = performance.now();
const tex = makeTextures(renderer);
const city = buildCity(tex, { seed: num('seed', 20261025), blocks: low ? 10 : 12 });
scene.add(city.group);
const outskirts = buildOutskirts(scene, city, { low });
const traffic = new Traffic(city, scene, { cars: low ? 160 : 280 });
const people = new People(city, scene, { people: low ? 2600 : 5200 });
const fire = new Fire(scene, city, { low });
const helis = new Helicopters(scene, city, fire, people);
helis.traffic = traffic;
const buildMs = Math.round(performance.now() - t0);

const post = new Post(renderer, { samples: low ? 0 : 4 });
const daylight = new Daylight({ scene, sun, hemi, post, city, traffic, people });
daylight.set(0);
const disasters = new Disasters({ scene, city, people, traffic, fire, post, camera, controls, renderer, sun, hemi, low, outskirts });
outskirts.steam(fire);
if (P.has('blur')) post.opts.blurFrac = num('blur', 0.018);
if (P.get('dof') === '0') post.opts.dof = false;
if (P.get('grade') === '0') post.opts.grade = false;

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); post.setSize();
});

const clock = new THREE.Clock();
renderer.shadowMap.autoUpdate = false; let shadowAt = -1; const camAt = new THREE.Vector3();
let frames = 0, fpsT = 0, fps = 0, time = 0;
const B = city.bounds, M = 10;

function frame() {
  const dt = Math.min(0.05, clock.getDelta());
  time += dt;
  controls.update();
  // keep the view over the city
  const tg = controls.target;
  const cx = THREE.MathUtils.clamp(tg.x, B.x0 + M, B.x1 - M), cz = THREE.MathUtils.clamp(tg.z, B.z0 + M, B.z1 - M);
  if (cx !== tg.x || cz !== tg.z) { camera.position.x += cx - tg.x; camera.position.z += cz - tg.z; tg.x = cx; tg.z = cz; }
  tg.y = 0;

  game.update(dt, fps);
  outskirts.update(time, scene, sun, disasters.lightK, disasters.sunK);
  sun.position.copy(tg).addScaledVector(daylight.sunDir, 700); // the sun (or the moon) where the day and night cycle has it
  sun.target.position.copy(tg);
  // the shadow map only needs redrawing when the world has moved (a simulation step) or the view has
  if (game.simT !== shadowAt || !camAt.equals(camera.position)) { renderer.shadowMap.needsUpdate = true; shadowAt = game.simT; camAt.copy(camera.position); }
  const focus = camera.position.distanceTo(game.focusAt || tg); // whatever Follow is on stays in focus
  const nearZ = Math.max(10, focus * 0.2); // the near plane follows the zoom: far more depth precision, so flat rooftop details don't flicker on phones
  if (Math.abs(camera.near - nearZ) > 0.5) { camera.near = nearZ; camera.updateProjectionMatrix(); }
  // camera shake (quakes, blasts, the tsunami): a jolt for this frame only
  let jx = 0, jy = 0, jz = 0;
  if (game.shake > 0) {
    const k = Math.min(2.5, game.shake) * 2.2 * focus / 430;
    jx = (Math.random() - 0.5) * k; jy = (Math.random() - 0.5) * k * 0.5; jz = (Math.random() - 0.5) * k;
    camera.position.x += jx; camera.position.y += jy; camera.position.z += jz;
  }
  sirens.update(time);
  post.render(scene, camera, focus, time);
  camera.position.x -= jx; camera.position.y -= jy; camera.position.z -= jz;

  frames++; fpsT += dt;
  if (fpsT > 0.5) { fps = Math.round(frames / fpsT); frames = 0; fpsT = 0; }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

helis.mushroom = (x, z, R) => disasters.mushroom(x, z, R); // the commander's nuke gets the full mushroom cloud
helis.nukeBlast = (x, z, R) => disasters.nukeBlast(x, z, R, { byPlayer: true }); // the commander's own nuke
const sirens = new Sirens(scene, { traffic, helis, boats: disasters.boats, daylight, fire }); // flashing lights on every rescue unit
disasters.sirens = sirens;
const game = new Game({ people, traffic, fire, city, camera, controls, renderer, mode, daylight, helis, post, disasters });

window.__z = { THREE, scene, camera, controls, renderer, post, city, traffic, people, fire, game, daylight, helis, disasters, outskirts, sirens, sun, hemi, setView, buildMs, info: () => renderer.info.render };
