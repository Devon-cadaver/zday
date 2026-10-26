// Low-poly people built from one kit: head with hair, torso, arms, legs, plus
// props that each instance can switch on (hat of five shapes, vest, backpack,
// hand item) and a body scale. Everything is one merged geometry drawn as a
// single instanced mesh; limbs swing and props are shown or collapsed in the
// vertex shader from per-instance attributes.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export const HIP = 0.84, SHOULDER = 1.36, NECK = 1.42;

// aTag.x part: 0 shirt, 1 pants, 2 skin, 3 hair, 4 hat colour, 5 gear colour
// aTag.y limb: 0 body, 1 left leg, 2 right leg, 3 left arm, 4 right arm, 5 head
// aTag.z prop: 0 base, 1 hat, 2 vest, 3 backpack, 4 hand item, 5 hair
function tag(g, part, limb, prop = 0) {
  const n = g.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = part; a[i * 3 + 1] = limb; a[i * 3 + 2] = prop; }
  g.setAttribute('aTag', new THREE.BufferAttribute(a, 3));
  return g;
}

export function figureGeometry() {
  const head = mergeVertices(new THREE.IcosahedronGeometry(0.15, 0));
  head.translate(0, 1.47, 0);
  const parts = [
    tag(head, 2, 5),
    tag(new THREE.BoxGeometry(0.22, 0.09, 0.26).translate(0.01, 1.58, 0), 3, 5, 5),
    tag(new THREE.BoxGeometry(0.2, 0.52, 0.34).translate(0, 1.1, 0), 0, 0),
    tag(new THREE.BoxGeometry(0.1, 0.5, 0.1).translate(0, 1.11, -0.22), 0, 3),
    tag(new THREE.BoxGeometry(0.1, 0.5, 0.1).translate(0, 1.11, 0.22), 0, 4),
    tag(new THREE.BoxGeometry(0.14, 0.84, 0.14).translate(0, 0.42, -0.09), 1, 1),
    tag(new THREE.BoxGeometry(0.14, 0.84, 0.14).translate(0, 0.42, 0.09), 1, 2),
    // props
    tag(new THREE.BoxGeometry(0.26, 0.08, 0.28).translate(0.01, 1.61, 0), 4, 5, 1),
    tag(new THREE.BoxGeometry(0.25, 0.44, 0.39).translate(0, 1.1, 0), 5, 0, 2),
    tag(new THREE.BoxGeometry(0.16, 0.42, 0.3).translate(-0.19, 1.1, 0), 5, 0, 3),
    tag(new THREE.BoxGeometry(0.3, 0.26, 0.08).translate(0.04, 0.74, 0.3), 5, 4, 4),
  ];
  const g = mergeGeometries(parts);
  g.computeBoundingSphere();
  return g;
}

// Hat types (aKit.x): 0 none, 1 cap, 2 hard hat or helmet, 3 beanie, 4 hood, 5 brimmed hat
export const HAT = { NONE: 0, CAP: 1, HARD: 2, BEANIE: 3, HOOD: 4, BRIM: 5 };
// Flags (aKit.y): 1 vest, 2 backpack, 4 hand item, 8 no hair
export const FLAG = { VEST: 1, PACK: 2, ITEM: 4, BALD: 8, GLOW: 16 };
// Animation ids (aAnim): 0 idle, 1 walk, 2 run, 3 shamble, 4 limp/none, 5 arms out standing,
// 6 aiming, 7 aiming while walking, 8 crawl, 9 sprint with arms out (runner zombie)

export function figureMaterial() {
  const uTime = { value: 0 }, uGlow = { value: 0.3 };
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.9 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime; sh.uniforms.uGlow = uGlow;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', /* glsl */`#include <common>
uniform float uTime;
attribute vec3 aTag;
attribute vec3 aShirt; attribute vec3 aPants; attribute vec3 aSkin; attribute vec3 aAccent; attribute vec3 aAccent2;
attribute vec4 aKit;
attribute float aAnim;
varying vec3 vTint;
varying float vGlow;
vec3 rotZ(vec3 p, float py, float a) {
  p.y -= py; float c = cos(a), s = sin(a);
  p.xy = vec2(p.x * c - p.y * s, p.x * s + p.y * c);
  p.y += py; return p;
}`)
      .replace('#include <begin_vertex>', /* glsl */`#include <begin_vertex>
{
  float limb = aTag.y, prop = aTag.z, an = aAnim, ht = aKit.x;
  int flags = int(aKit.y + 0.5);
  bool hide = (prop == 1.0 && ht < 0.5) || (prop == 2.0 && (flags & 1) == 0) || (prop == 3.0 && (flags & 2) == 0)
    || (prop == 4.0 && (flags & 4) == 0) || (prop == 5.0 && ((flags & 8) != 0 || ht > 0.5));
  if (hide) transformed = vec3(0.0, 1.0, 0.0);
  else {
    if (prop == 1.0) {
      vec3 c = vec3(0.0, 1.61, 0.0); vec3 d = transformed - c;
      if (ht == 1.0) { d.x = d.x > 0.0 ? d.x + 0.07 : d.x; }
      else if (ht == 2.0) { d.y = d.y * 2.6 + 0.07; d.xz *= 1.12; }
      else if (ht == 3.0) { d.y = d.y * 1.8 + 0.04; }
      else if (ht == 4.0) { d.xz *= 1.5; d.y = d.y * 3.4 - 0.1; }
      else { d.xz *= 1.7; d.y *= 1.3; }
      transformed = c + d;
    }
    if (limb == 0.0 && prop != 3.0) transformed.xz *= aKit.z;
    float ph = float(gl_InstanceID) * 1.618;
    float freq = 0.0, amp = 0.0;
    if (an == 1.0 || an == 7.0) { freq = 6.0; amp = 0.5; }
    else if (an == 2.0 || an == 9.0) { freq = 10.0; amp = 0.9; }
    else if (an == 3.0) { freq = 3.2; amp = 0.3; }
    float sw = sin(uTime * freq + ph) * amp;
    bool crawl = (an == 8.0);
    bool armsOut = (an == 3.0 || an == 5.0 || an == 6.0 || an == 7.0 || an == 9.0);
    bool zombie = (an == 3.0 || an == 5.0 || an == 9.0);
    float cs = sin(uTime * 4.0 + ph) * 0.5;
    if (limb == 1.0) transformed = rotZ(transformed, ${HIP}, crawl ? 0.9 : sw);
    else if (limb == 2.0) transformed = rotZ(transformed, ${HIP}, crawl ? 0.7 : -sw);
    else if (limb == 3.0) transformed = rotZ(transformed, ${SHOULDER}, crawl ? 1.9 + cs : (armsOut ? 1.35 + (zombie ? sin(uTime * 2.0 + ph) * 0.15 : 0.0) : -sw * 0.7));
    else if (limb == 4.0) transformed = rotZ(transformed, ${SHOULDER}, crawl ? 1.9 - cs : (armsOut ? 1.2 + (zombie ? cos(uTime * 2.3 + ph) * 0.15 : 0.0) : sw * 0.7));
    else if (limb == 5.0 && zombie) transformed = rotZ(transformed, ${NECK}, 0.35);
    else if (limb == 5.0 && crawl) transformed = rotZ(transformed, ${NECK}, -0.9);
    if (amp > 0.0) transformed.y += abs(sin(uTime * freq + ph)) * 0.03;
    transformed *= aKit.w;
  }
  vGlow = (flags & 16) != 0 ? 1.0 : 0.0;
  float part = aTag.x;
  vTint = part < 0.5 ? aShirt : part < 1.5 ? aPants : part < 2.5 ? aSkin : part < 3.5 ? mix(vec3(0.10, 0.08, 0.06), aPants, 0.35) : part < 4.5 ? aAccent : aAccent2;
}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTint; varying float vGlow; uniform float uGlow;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= vTint;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(0.35, 0.95, 0.25) * vGlow * uGlow;');
  };
  mat.customProgramCacheKey = () => 'zday-figure-kit';
  return { mat, uTime, uGlow };
}

// Instanced attribute set for N figures. write(i, look) fills one slot.
export function figureAttributes(geo, N) {
  const A = {
    shirt: new Float32Array(N * 3), pants: new Float32Array(N * 3), skin: new Float32Array(N * 3),
    accent: new Float32Array(N * 3), accent2: new Float32Array(N * 3), kit: new Float32Array(N * 4), anim: new Float32Array(N),
  };
  const B = {};
  for (const k of ['shirt', 'pants', 'skin', 'accent', 'accent2']) { B[k] = new THREE.InstancedBufferAttribute(A[k], 3); geo.setAttribute('a' + k[0].toUpperCase() + k.slice(1), B[k]); }
  B.kit = new THREE.InstancedBufferAttribute(A.kit, 4); geo.setAttribute('aKit', B.kit);
  B.anim = new THREE.InstancedBufferAttribute(A.anim, 1); geo.setAttribute('aAnim', B.anim);
  for (let i = 0; i < N; i++) { A.kit[i * 4 + 2] = 1; A.kit[i * 4 + 3] = 1; }
  const put = (arr, i, c) => { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; };
  return {
    arrays: A, attrs: B,
    write(i, L) {
      put(A.shirt, i, L.shirt); put(A.pants, i, L.pants); put(A.skin, i, L.skin);
      put(A.accent, i, L.accent || L.shirt); put(A.accent2, i, L.accent2 || L.pants);
      A.kit[i * 4] = L.hat || 0; A.kit[i * 4 + 1] = L.flags || 0; A.kit[i * 4 + 2] = L.torso || 1; A.kit[i * 4 + 3] = L.scale || 1;
    },
    dirty() { for (const k in B) B[k].needsUpdate = true; },
  };
}

// ---------- looks
const C = (h) => new THREE.Color(h);
const pick = (r, a) => a[Math.floor(r() * a.length)];
export const SHIRTS = ['#2b2522', '#3a3530', '#1f2630', '#e8e2d6', '#d9d0bf', '#8c2f25', '#33476b', '#b59a73', '#6e2a3c', '#3d5a45', '#c9c2b6', '#7a6a55', '#a8332c', '#2f6b4f', '#e0b030', '#d87a3a', '#6b7fa3', '#8a8f3a'].map(C);
export const PANTS = ['#2e3a55', '#1f1f24', '#4a4a50', '#6b5a44', '#3b4a6b', '#8a7f6a', '#262626', '#5a4a3a'].map(C);
export const SKINS = ['#f1c9a5', '#e0b08a', '#c68e63', '#9c6b47', '#6b4a32', '#f5d6b8'].map(C);
const SUITS = ['#1f1f24', '#2b2b33', '#3a3540', '#26303a'].map(C);
const BRIGHT = ['#c0392b', '#e0b030', '#2f6b4f', '#6b7fa3', '#d87a3a', '#e8e2d6'].map(C);
const CAPS = ['#1d2440', '#8c2f25', '#2b2b2b', '#3d5a45', '#7a6a55'].map(C);

// Civilian archetypes, from Sean's sheet. Each roll returns a look.
export const ARCHETYPES = [
  { id: 'casual', name: 'Casual', w: 0.45, roll: (r) => ({ shirt: pick(r, SHIRTS), pants: pick(r, PANTS), skin: pick(r, SKINS), hat: r() < 0.25 ? HAT.CAP : 0, accent: pick(r, CAPS) }) },
  { id: 'business', name: 'Businessman', w: 0.12, roll: (r) => { const s = pick(r, SUITS); return { shirt: s, pants: s, skin: pick(r, SKINS), flags: FLAG.ITEM, accent2: C('#1a1512') }; } },
  { id: 'construction', name: 'Construction worker', w: 0.06, roll: (r) => ({ shirt: pick(r, [C('#6b6b70'), C('#3a3a40'), C('#9a6a3a')]), pants: pick(r, [C('#3b4a6b'), C('#6b5a44')]), skin: pick(r, SKINS), hat: HAT.HARD, accent: C('#f2c300'), flags: FLAG.VEST, accent2: C('#ff7a1a') }) },
  { id: 'nurse', name: 'Nurse', w: 0.04, roll: (r) => { const s = pick(r, [C('#3f8fd6'), C('#2f7a6a'), C('#7a5fa8')]); return { shirt: s, pants: s, skin: pick(r, SKINS), flags: FLAG.ITEM, accent2: C('#c0392b') }; } },
  { id: 'student', name: 'Student', w: 0.12, roll: (r) => { const h = pick(r, [C('#6b7fa3'), C('#8a8f8a'), C('#2b2f3a'), C('#8c2f25')]); return { shirt: h, pants: pick(r, PANTS), skin: pick(r, SKINS), hat: HAT.HOOD, accent: h, flags: FLAG.PACK, accent2: pick(r, [C('#2e3a55'), C('#8c2f25'), C('#3d5a45')]) }; } },
  { id: 'homeless', name: 'Homeless', w: 0.03, roll: (r) => ({ shirt: pick(r, [C('#5a4a3a'), C('#6b6b55'), C('#4a4a40')]), pants: C('#3a3530'), skin: pick(r, SKINS), hat: HAT.BEANIE, accent: C('#5a4a3a'), flags: FLAG.ITEM, accent2: C('#6b6b55') }) },
  { id: 'shopper', name: 'Shopper', w: 0.10, roll: (r) => ({ shirt: pick(r, BRIGHT), pants: pick(r, PANTS), skin: pick(r, SKINS), flags: FLAG.ITEM, accent2: pick(r, [C('#c0392b'), C('#e8e2d6'), C('#e0b030')]) }) },
  { id: 'traveler', name: 'Traveler', w: 0.04, roll: (r) => ({ shirt: pick(r, [C('#33476b'), C('#3d5a45')]), pants: C('#8a7f6a'), skin: pick(r, SKINS), hat: HAT.BRIM, accent: C('#7a6a4a'), flags: FLAG.PACK, accent2: C('#3e6b3e') }) },
  { id: 'offduty', name: 'Off-duty officer', w: 0.04, roll: (r) => ({ shirt: C('#2b2f3a'), pants: pick(r, PANTS), skin: pick(r, SKINS), hat: HAT.CAP, accent: C('#1d2440') }) },
];
export function rollArchetype(r) {
  let t = r(); for (const a of ARCHETYPES) { if ((t -= a.w) <= 0) return a; }
  return ARCHETYPES[0];
}
export const SOLDIER_LOOK = (r) => ({ shirt: C('#4a5a3a'), pants: C('#3e4a30'), skin: pick(r, SKINS), hat: HAT.HARD, accent: C('#3a4a30'), flags: FLAG.VEST | FLAG.PACK, accent2: C('#2f3a26') });
export const FIREFIGHTER_LOOK = (r) => ({ shirt: C('#c9a24a'), pants: C('#b8903c'), skin: pick(r, SKINS), hat: HAT.HARD, accent: C('#f2c300'), flags: FLAG.VEST, accent2: C('#e8e23a') });
export const OFFICER_LOOK = (r) => ({ shirt: C('#22305e'), pants: C('#1b2240'), skin: pick(r, SKINS), hat: HAT.CAP, accent: C('#1b2240'), flags: FLAG.VEST, accent2: C('#1b2240') });

// Zombie types, from the sheet. Stats are per type; look() turns a civilian look into the zombie's.
const ZSKIN = C('#8fae5a');
const dull = (c, k = 0.7) => c.clone().lerp(ZSKIN, 0.1).multiplyScalar(k);
export const ZTYPES = [
  { id: 'walker', name: 'Walker', w: 0.62, wander: 0.55, chase: 1.3, lunge: 2.9, lungeR: 2.2, sight: 12, notice: 5.5, noticeP: 0.3, biteR: 0.75, biteT: 1.1, recover: 1.4, hp: 1, anim: 3, tilt: -0.32,
    look: (L) => ({ ...L, shirt: dull(L.shirt), pants: dull(L.pants), skin: ZSKIN, flags: (L.flags || 0) & ~FLAG.ITEM }) },
  { id: 'runner', name: 'Runner', w: 0.12, wander: 1.1, chase: 3.2, lunge: 4.6, lungeR: 3, sight: 16, notice: 7, noticeP: 0.5, biteR: 0.8, biteT: 0.9, recover: 1.0, hp: 1, anim: 9, tilt: -0.5, scale: 0.95,
    look: (L) => ({ ...L, shirt: dull(L.shirt), pants: dull(L.pants), skin: C('#a8b860'), flags: (L.flags || 0) & ~FLAG.ITEM }) },
  { id: 'crawler', name: 'Crawler', w: 0.08, wander: 0.35, chase: 1.0, lunge: 2.0, lungeR: 1.6, sight: 9, notice: 4, noticeP: 0.2, biteR: 0.85, biteT: 1.3, recover: 1.6, hp: 1, anim: 8, tilt: -1.25, hitMod: -0.3,
    look: (L) => ({ ...L, shirt: dull(L.shirt, 0.5), pants: dull(L.pants, 0.5), skin: C('#7f9a62'), hat: 0, flags: FLAG.BALD }) },
  { id: 'bloater', name: 'Bloater', w: 0.06, wander: 0.4, chase: 0.9, lunge: 1.4, lungeR: 1.6, sight: 11, notice: 5, noticeP: 0.3, biteR: 0.95, biteT: 1.4, recover: 2.0, hp: 3, anim: 3, tilt: -0.2, scale: 1.12, torso: 1.8, pop: true,
    look: (L) => ({ ...L, shirt: C('#b9a28f').lerp(ZSKIN, 0.25), pants: dull(L.pants), skin: C('#9aa07a'), hat: 0, flags: FLAG.BALD }) },
  { id: 'juggernaut', name: 'Juggernaut', w: 0.03, wander: 0.5, chase: 1.4, lunge: 2.6, lungeR: 2.4, sight: 13, notice: 6, noticeP: 0.35, biteR: 0.9, biteT: 1.2, recover: 1.2, hp: 6, anim: 3, tilt: -0.25, scale: 1.3, torso: 1.3, armored: true,
    look: (L) => ({ ...L, shirt: C('#4a5a3a'), pants: C('#3a3f2e'), skin: C('#86956a'), hat: HAT.HARD, accent: C('#2d3134'), flags: FLAG.VEST | FLAG.BALD, accent2: C('#2d3134') }) },
  { id: 'screamer', name: 'Screamer', w: 0.03, wander: 0.6, chase: 1.2, lunge: 2.4, lungeR: 2.0, sight: 14, notice: 7, noticeP: 0.4, biteR: 0.75, biteT: 1.1, recover: 1.4, hp: 1, anim: 3, tilt: -0.1, scream: true,
    look: (L) => ({ ...L, shirt: dull(L.shirt, 0.45), pants: dull(L.pants, 0.45), skin: C('#b8c0a0'), hat: 0, flags: FLAG.BALD }) },
  { id: 'skeleton', name: 'Skeleton', w: 0.06, wander: 0.7, chase: 1.5, lunge: 3.0, lungeR: 2.2, sight: 12, notice: 5.5, noticeP: 0.3, biteR: 0.75, biteT: 1.1, recover: 1.4, hp: 1, anim: 3, tilt: -0.3, scale: 0.98,
    look: (L) => ({ ...L, shirt: C('#2a2622'), pants: C('#2a2622'), skin: C('#e3dccb'), hat: 0, flags: FLAG.BALD }) },
];
export function rollZombieType(r) {
  let t = r(); for (let k = 0; k < ZTYPES.length; k++) { if ((t -= ZTYPES[k].w) <= 0) return k; }
  return 0;
}
export { ZSKIN };
