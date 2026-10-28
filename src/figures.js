// Low-poly people built from one kit: head with hair, torso, arms, legs, plus
// props that each instance can switch on (hat of five shapes, vest, backpack,
// hand item) and a body scale. Everything is one merged geometry drawn as a
// single instanced mesh; limbs swing and props are shown or collapsed in the
// vertex shader from per-instance attributes.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export const HIP = 0.84, SHOULDER = 1.36, NECK = 1.42, KNEE = 0.41, ELBOW = 1.09;

// aTag.x part: 0 shirt, 1 pants, 2 skin, 3 hair, 4 hat colour, 5 gear colour
// aTag.y limb: 0 body, 1 left thigh, 2 right thigh, 3 left upper arm, 4 right upper arm, 5 head,
//            6 left shin, 7 right shin, 8 left forearm, 9 right forearm (knees and elbows bend)
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
    // arms: upper arm and forearm (sleeve), a bare hand
    tag(new THREE.BoxGeometry(0.1, 0.28, 0.1).translate(0, 1.225, -0.22), 0, 3),
    tag(new THREE.BoxGeometry(0.1, 0.28, 0.1).translate(0, 1.225, 0.22), 0, 4),
    tag(new THREE.BoxGeometry(0.09, 0.25, 0.09).translate(0, 0.965, -0.22), 0, 8),
    tag(new THREE.BoxGeometry(0.09, 0.25, 0.09).translate(0, 0.965, 0.22), 0, 9),
    tag(new THREE.BoxGeometry(0.08, 0.08, 0.08).translate(0, 0.8, -0.22), 2, 8),
    tag(new THREE.BoxGeometry(0.08, 0.08, 0.08).translate(0, 0.8, 0.22), 2, 9),
    // legs: thigh, shin, shoe
    tag(new THREE.BoxGeometry(0.15, 0.45, 0.15).translate(0, 0.62, -0.09), 1, 1),
    tag(new THREE.BoxGeometry(0.15, 0.45, 0.15).translate(0, 0.62, 0.09), 1, 2),
    tag(new THREE.BoxGeometry(0.13, 0.4, 0.13).translate(0, 0.24, -0.09), 1, 6),
    tag(new THREE.BoxGeometry(0.13, 0.4, 0.13).translate(0, 0.24, 0.09), 1, 7),
    tag(new THREE.BoxGeometry(0.21, 0.07, 0.12).translate(0.04, 0.035, -0.09), 3, 6),
    tag(new THREE.BoxGeometry(0.21, 0.07, 0.12).translate(0.04, 0.035, 0.09), 3, 7),
    // props
    tag(new THREE.BoxGeometry(0.26, 0.08, 0.28).translate(0.01, 1.61, 0), 4, 5, 1),
    tag(new THREE.BoxGeometry(0.25, 0.44, 0.39).translate(0, 1.1, 0), 5, 0, 2),
    tag(new THREE.BoxGeometry(0.16, 0.42, 0.3).translate(-0.19, 1.1, 0), 5, 0, 3),
    tag(new THREE.BoxGeometry(0.3, 0.26, 0.08).translate(0.04, 0.68, 0.3), 5, 9, 4),
  ];
  const g = mergeGeometries(parts);
  g.computeBoundingSphere();
  return g;
}

// Hat types (aKit.x): 0 none, 1 cap, 2 hard hat or helmet, 3 beanie, 4 hood, 5 brimmed hat
export const HAT = { NONE: 0, CAP: 1, HARD: 2, BEANIE: 3, HOOD: 4, BRIM: 5 };
// Flags (aKit.y): 1 vest, 2 backpack, 4 hand item, 8 no hair, 16 radioactive glow
export const FLAG = { VEST: 1, PACK: 2, ITEM: 4, BALD: 8, GLOW: 16 };
// Exposed bone (aZed.x bits): skull, half the face, left arm, right forearm, left shin, ribs, the whole
// skeleton, a missing nose, every bit of skin (a clothed skeleton). aZed.y blood, .z burned, .w 2 = on fire
export const BONE = { SKULL: 1, HALF: 2, ARM: 4, FORE: 8, SHIN: 16, RIBS: 32, SKEL: 64, NOSE: 128, SKIN: 512 };
// Animation ids (aAnim): 0 idle, 1 walk, 2 run, 3 shamble, 4 limp/none, 5 arms out standing,
// 6 aiming, 7 aiming while walking, 8 crawl, 9 sprint with arms out (runner zombie), 10 kneel and pray, 11 swing,
// 12 treading water with both arms up, waving for help, 13 curled up in a ball (bracing for a storm wall)

// fragment side of the figure kit: bone, ribs, skull sockets, blood, burns, the radioactive and fire glow
const ZED_COMMON = /* glsl */`
varying vec3 vTint; varying float vGlow; uniform float uGlow, uTime;
varying vec3 vObj; varying vec4 vZed; varying float vLimb, vPart, vBoneLimb, vSeed;
float zh(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float zn(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(zh(i), zh(i + vec3(1, 0, 0)), f.x), mix(zh(i + vec3(0, 1, 0)), zh(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(zh(i + vec3(0, 0, 1)), zh(i + vec3(1, 0, 1)), f.x), mix(zh(i + vec3(0, 1, 1)), zh(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}`;
const ZED_COLOR = /* glsl */`
vec3 tint = vTint; float burnGlow = 0.0;
{
  int bones = int(vZed.x + 0.5);
  bool skel = (bones & 64) != 0, isSkin = vPart > 1.5 && vPart < 2.5, head = vLimb == 5.0 && isSkin;
  vec3 BONEC = vec3(0.86, 0.82, 0.72) * (0.86 + 0.14 * zn(vObj * 40.0 + vSeed));
  bool bone = vBoneLimb > 0.5 || (skel && vPart < 3.5) || ((bones & 512) != 0 && isSkin) || ((bones & 1) != 0 && head) || ((bones & 2) != 0 && head && vObj.z > 0.0);
  if (bone) {
    tint = BONEC;
    if (head && vObj.x > 0.07) { // a skull: eye sockets and the nose hole
      if (length(vec2(vObj.y - 1.5, abs(vObj.z) - 0.055)) < 0.034 && ((bones & 2) == 0 || vObj.z > 0.0)) tint = vec3(0.04, 0.03, 0.03);
      if (vObj.y < 1.455 && vObj.y > 1.41 && abs(vObj.z) < 0.018) tint = vec3(0.07, 0.05, 0.04);
    }
  }
  if (((bones & 32) != 0 || skel) && vLimb == 0.0 && vPart < 0.5 && (skel || vObj.x > 0.06) && vObj.y > 0.9 && vObj.y < 1.32)
    tint = mix(vec3(0.16, 0.05, 0.04), BONEC, step(0.45, fract((vObj.y - 0.9) * 15.0))); // ribs through the torn shirt
  if ((bones & 128) != 0 && head && vObj.x > 0.08 && abs(vObj.z) < 0.035 && abs(vObj.y - 1.44) < 0.03) tint = vec3(0.12, 0.02, 0.02); // no nose
  if (vZed.y > 0.0 && !bone) tint = mix(tint, vec3(0.26, 0.03, 0.02), smoothstep(0.76 - vZed.y * 0.14, 0.8 - vZed.y * 0.14, zn(vObj * 11.0 + vSeed)) * 0.9); // blood stains
  if (vZed.z > 0.0) { tint = mix(tint, vec3(0.07, 0.05, 0.04), vZed.z * 0.85); burnGlow = smoothstep(0.7, 0.76, zn(vObj * 13.0 + vSeed)) * vZed.z; } // charred, cracks still glowing
}
diffuseColor.rgb *= tint;`;
const ZED_GLOW = /* glsl */`
if (vGlow > 0.5) totalEmissiveRadiance += vec3(0.32, 1.0, 0.22) * uGlow * (2.6 + 1.4 * sin(uTime * 3.0 + vSeed * 7.0)); // radioactive
totalEmissiveRadiance += vec3(2.2, 0.6, 0.1) * burnGlow * (0.7 + 0.3 * sin(uTime * 5.0 + vSeed * 3.0));
if (vZed.w > 1.5) totalEmissiveRadiance += vec3(2.4, 0.75, 0.12) * (0.35 + 0.65 * zn(vObj * 5.0 + vec3(0.0, -uTime * 4.0, 0.0) + vSeed)) * smoothstep(0.3, 1.6, vObj.y); // on fire
`;

export function figureMaterial() {
  const uTime = { value: 0 }, uGlow = { value: 0.3 };
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.9 });
  mat.customProgramCacheKey = () => 'zday-figure-kit-3';
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime; sh.uniforms.uGlow = uGlow;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', /* glsl */`#include <common>
uniform float uTime;
attribute vec3 aTag;
attribute vec3 aShirt; attribute vec3 aPants; attribute vec3 aSkin; attribute vec3 aAccent; attribute vec3 aAccent2;
attribute vec4 aKit;
attribute float aAnim;
attribute vec4 aZed;
varying vec3 vTint;
varying float vGlow;
varying vec3 vObj; varying vec4 vZed; varying float vLimb, vPart, vBoneLimb, vSeed;
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
    // bare bone is thinner than a sleeve or a trouser leg
    int bones = int(aZed.x + 0.5);
    bool skel = (bones & 64) != 0;
    bool boneLimb = prop == 0.0 && ((skel && limb > 0.5 && limb != 5.0) || ((bones & 4) != 0 && (limb == 3.0 || limb == 8.0))
      || ((bones & 8) != 0 && limb == 9.0) || ((bones & 16) != 0 && limb == 6.0));
    if (boneLimb) {
      float zc = (limb == 3.0 || limb == 8.0) ? -0.22 : (limb == 4.0 || limb == 9.0) ? 0.22 : (limb == 1.0 || limb == 6.0) ? -0.09 : 0.09;
      transformed.x *= 0.5; transformed.z = zc + (transformed.z - zc) * 0.5;
    }
    if (skel && limb == 0.0 && prop == 0.0) { transformed.x *= 0.8; transformed.z *= 0.76; }
    vObj = transformed; vZed = aZed; vLimb = limb; vPart = aTag.x; vBoneLimb = boneLimb ? 1.0 : 0.0; vSeed = float(gl_InstanceID) * 0.371;
    float ph = float(gl_InstanceID) * 1.618;
    bool crawl = (an == 8.0);
    bool armsOut = (an == 3.0 || an == 5.0 || an == 6.0 || an == 7.0 || an == 9.0);
    bool zombie = (an == 3.0 || an == 5.0 || an == 9.0);
    bool kneel = (an == 10.0), swing = (an == 11.0), swim = (an == 12.0), curl = (an == 13.0);
    float chop = swing ? max(0.0, sin(uTime * 7.0 + ph)) : 0.0; // the weapon comes down hard, then back up
    // gait: stride rate, hip swing, knee fold in the swing, arm swing, elbow bend, bounce, forward lean
    float freq = 0.0, hipA = 0.0, kneeA = 0.0, armA = 0.0, el0 = 0.12, elA = 0.0, bob = 0.0, lean = 0.0;
    if (an == 1.0 || an == 7.0) { freq = 6.0; hipA = 0.4; kneeA = 0.8; armA = 0.42; el0 = 0.22; elA = 0.35; bob = 0.035; lean = 0.04; }
    else if (an == 2.0) { freq = 10.5; hipA = 0.72; kneeA = 1.6; armA = 0.8; el0 = 1.35; elA = 0.3; bob = 0.075; lean = 0.22; }
    else if (an == 9.0) { freq = 11.0; hipA = 0.78; kneeA = 1.55; bob = 0.08; lean = 0.3; }
    else if (an == 3.0) { freq = 3.2; hipA = 0.26; kneeA = 0.45; bob = 0.025; }
    else if (swim) { freq = 2.6; hipA = 0.45; kneeA = 0.9; }
    bool sideA = (limb == 1.0 || limb == 3.0 || limb == 6.0 || limb == 8.0);
    float phs = uTime * freq + ph + (sideA ? 0.0 : 3.14159), sn = sin(phs);
    bool leg = (limb == 1.0 || limb == 2.0 || limb == 6.0 || limb == 7.0), arm = (limb == 3.0 || limb == 4.0 || limb == 8.0 || limb == 9.0);
    if (leg) {
      float hip, knee;
      if (crawl) { hip = sideA ? 0.9 : 0.7; knee = -0.35; }
      else if (kneel) { hip = 0.0; knee = -1.57; } // thighs straight down, shins flat on the ground behind
      else if (curl) { hip = 0.25; knee = -1.9; } // down on the heels, knees tucked
      else if (swing) { hip = sideA ? 0.28 : -0.22; knee = -0.25; } // feet planted wide
      else {
        hip = sn * hipA;
        // the knee folds just after toe-off and straightens for the heel strike
        knee = freq > 0.0 ? -(0.05 + kneeA * pow(max(0.0, cos(phs + 0.785)), 1.5)) : -0.04;
      }
      if (limb >= 6.0) transformed = rotZ(transformed, ${KNEE}, knee);
      transformed = rotZ(transformed, ${HIP}, hip);
    } else if (arm) {
      float sh, el;
      if (crawl) { float cz = sin(uTime * 4.0 + ph) * 0.5; sh = sideA ? 1.9 + cz : 1.9 - cz; el = 0.0; }
      else if (kneel) { sh = 0.45; el = 1.95; } // hands together in front of the face
      else if (curl) { sh = 2.7; el = 2.1; } // arms wrapped over the head
      else if (swing) { sh = 2.5 - 2.1 * chop; el = 0.25 + 0.3 * chop; }
      else if (swim) { sh = 2.75 + sin(uTime * 4.5 + ph + (sideA ? 0.0 : 1.9)) * 0.4; el = 0.35; } // both arms up, waving
      else if (armsOut) { sh = (sideA ? 1.35 : 1.2) + (zombie ? (sideA ? sin(uTime * 2.0 + ph) : cos(uTime * 2.3 + ph)) * 0.15 : 0.0); el = zombie ? 0.3 : 0.06; }
      else { sh = -sn * armA; el = el0 + elA * max(0.0, -sn); } // arms swing against the legs, elbows bend more on the forward swing
      if (limb >= 8.0) transformed = rotZ(transformed, ${ELBOW}, el);
      transformed = rotZ(transformed, ${SHOULDER}, sh);
    }
    else if (limb == 5.0 && zombie) transformed = rotZ(transformed, ${NECK}, 0.35);
    else if (limb == 5.0 && crawl) transformed = rotZ(transformed, ${NECK}, -0.9);
    else if (limb == 5.0 && kneel) transformed = rotZ(transformed, ${NECK}, 0.45); // head bowed
    else if (limb == 5.0 && curl) transformed = rotZ(transformed, ${NECK}, 0.7); // head tucked in
    if (curl && !leg) transformed = rotZ(transformed, ${HIP}, -1.25); // folded forward over the knees
    if (swing && !leg) transformed = rotZ(transformed, ${HIP}, -0.25 * chop); // putting their weight behind it
    if (kneel || curl) transformed.y -= ${KNEE} * (curl ? 1.15 : 1.0);
    if (lean > 0.0 && !leg) transformed = rotZ(transformed, ${HIP}, -lean); // lean into a run
    if (freq > 0.0) transformed.y += (abs(cos(phs)) - 0.5) * bob; // highest as each leg passes under the body
    transformed *= aKit.w;
  }
  vGlow = (flags & 16) != 0 ? 1.0 : 0.0;
  float part = aTag.x;
  vTint = part < 0.5 ? aShirt : part < 1.5 ? aPants : part < 2.5 ? aSkin : part < 3.5 ? mix(vec3(0.10, 0.08, 0.06), aPants, 0.35) : part < 4.5 ? aAccent : aAccent2;
}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + ZED_COMMON)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + ZED_COLOR)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + ZED_GLOW);
  };
  return { mat, uTime, uGlow };
}

// Instanced attribute set for N figures. write(i, look) fills one slot.
export function figureAttributes(geo, N) {
  const A = {
    shirt: new Float32Array(N * 3), pants: new Float32Array(N * 3), skin: new Float32Array(N * 3),
    accent: new Float32Array(N * 3), accent2: new Float32Array(N * 3), kit: new Float32Array(N * 4), anim: new Float32Array(N), zed: new Float32Array(N * 4),
  };
  const B = {};
  for (const k of ['shirt', 'pants', 'skin', 'accent', 'accent2']) { B[k] = new THREE.InstancedBufferAttribute(A[k], 3); geo.setAttribute('a' + k[0].toUpperCase() + k.slice(1), B[k]); }
  B.kit = new THREE.InstancedBufferAttribute(A.kit, 4); geo.setAttribute('aKit', B.kit);
  B.anim = new THREE.InstancedBufferAttribute(A.anim, 1); geo.setAttribute('aAnim', B.anim);
  B.zed = new THREE.InstancedBufferAttribute(A.zed, 4); geo.setAttribute('aZed', B.zed);
  for (let i = 0; i < N; i++) { A.kit[i * 4 + 2] = 1; A.kit[i * 4 + 3] = 1; }
  const put = (arr, i, c) => { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; };
  return {
    arrays: A, attrs: B,
    write(i, L) {
      put(A.shirt, i, L.shirt); put(A.pants, i, L.pants); put(A.skin, i, L.skin);
      put(A.accent, i, L.accent || L.shirt); put(A.accent2, i, L.accent2 || L.pants);
      A.kit[i * 4] = L.hat || 0; A.kit[i * 4 + 1] = L.flags || 0; A.kit[i * 4 + 2] = L.torso || 1; A.kit[i * 4 + 3] = L.scale || 1;
      A.zed[i * 4] = L.bones || 0; A.zed[i * 4 + 1] = L.blood || 0; A.zed[i * 4 + 2] = L.burn || 0; A.zed[i * 4 + 3] = L.fx || 0;
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
export const ALIEN_LOOK = () => ({ shirt: C('#b8c2cc'), pants: C('#8f9aa6'), skin: C('#9fb59a'), hat: 0, flags: FLAG.BALD, accent2: C('#5a6a7a'), scale: 0.88, torso: 0.85 });
export const SOLDIER_LOOK = (r) => ({ shirt: C('#4a5a3a'), pants: C('#3e4a30'), skin: pick(r, SKINS), hat: HAT.HARD, accent: C('#3a4a30'), flags: FLAG.VEST | FLAG.PACK, accent2: C('#2f3a26') });
export const FIREFIGHTER_LOOK = (r) => ({ shirt: C('#c9a24a'), pants: C('#b8903c'), skin: pick(r, SKINS), hat: HAT.HARD, accent: C('#f2c300'), flags: FLAG.VEST, accent2: C('#e8e23a') });
// the rebuilding crews: construction workers in hard hats and orange vests, hazmat in yellow suits with the hood up and an air tank, paramedics in green
export const CREW_LOOK = (r) => ({ shirt: pick(r, [C('#3b4a6b'), C('#6b6b70'), C('#9a6a3a')]), pants: pick(r, [C('#3b4a6b'), C('#3a3530')]), skin: pick(r, SKINS), hat: HAT.HARD, accent: C('#f2c300'), flags: FLAG.VEST, accent2: C('#ff7a1a') });
export const HAZMAT_LOOK = (r) => ({ shirt: C('#e8cf2a'), pants: C('#e8cf2a'), skin: pick(r, SKINS), hat: HAT.HOOD, accent: C('#e0c420'), flags: FLAG.PACK | FLAG.BALD, accent2: C('#3a3a3a') });
export const MEDIC_LOOK = (r) => ({ shirt: C('#2f7a64'), pants: C('#2f7a64'), skin: pick(r, SKINS), hat: 0, flags: FLAG.ITEM, accent2: C('#c0392b') });
export const OFFICER_LOOK = (r) => ({ shirt: C('#22305e'), pants: C('#1b2240'), skin: pick(r, SKINS), hat: HAT.CAP, accent: C('#1b2240'), flags: FLAG.VEST, accent2: C('#1b2240') });

// Zombie types, from Sean's sheet: the classic walkers, runners and crawlers, the specials, and the
// partly skeletal ones (bone shows through: see BONE). Stats are per type; look() turns a civilian look
// into the zombie's. Only radioactive zombies glow; they come out of nuclear blasts and the plant.
const ZSKIN = C('#9fae7c');
const dull = (c, k = 0.7) => c.clone().lerp(ZSKIN, 0.1).multiplyScalar(k);
const rot = (L, o = {}) => ({ ...L, shirt: dull(L.shirt), pants: dull(L.pants), skin: ZSKIN, flags: (L.flags || 0) & ~FLAG.ITEM, blood: 0.65, ...o });
const WALK = { wander: 0.55, chase: 1.3, lunge: 2.9, lungeR: 2.2, sight: 12, notice: 5.5, noticeP: 0.3, biteR: 0.75, biteT: 1.1, recover: 1.4, hp: 1, anim: 3, tilt: -0.32 };
export const ZTYPES = [
  { id: 'walker', name: 'Walker', w: 0.25, ...WALK, look: (L) => rot(L) },
  { id: 'runner', name: 'Runner', w: 0.1, wander: 1.1, chase: 3.2, lunge: 4.6, lungeR: 3, sight: 16, notice: 7, noticeP: 0.5, biteR: 0.8, biteT: 0.9, recover: 1.0, hp: 1, anim: 9, tilt: -0.5, scale: 0.95,
    look: (L) => rot(L, { skin: C('#b2b88a'), blood: 0.8 }) },
  { id: 'crawler', name: 'Crawler', w: 0.06, wander: 0.35, chase: 1.0, lunge: 2.0, lungeR: 1.6, sight: 9, notice: 4, noticeP: 0.2, biteR: 0.85, biteT: 1.3, recover: 1.6, hp: 1, anim: 8, tilt: -1.25, hitMod: -0.3,
    look: (L) => rot(L, { shirt: dull(L.shirt, 0.5), pants: dull(L.pants, 0.5), skin: C('#8e9c72'), hat: 0, flags: FLAG.BALD, blood: 0.9, bones: BONE.SHIN }) },
  { id: 'bloater', name: 'Bloater', w: 0.04, wander: 0.4, chase: 0.9, lunge: 1.4, lungeR: 1.6, sight: 11, notice: 5, noticeP: 0.3, biteR: 0.95, biteT: 1.4, recover: 2.0, hp: 3, anim: 3, tilt: -0.2, scale: 1.12, torso: 1.8, pop: true,
    look: (L) => rot(L, { shirt: C('#b9a28f').lerp(ZSKIN, 0.25), skin: C('#a8a882'), hat: 0, flags: FLAG.BALD, blood: 0.75 }) },
  { id: 'juggernaut', name: 'Juggernaut', w: 0.02, wander: 0.5, chase: 1.4, lunge: 2.6, lungeR: 2.4, sight: 13, notice: 6, noticeP: 0.35, biteR: 0.9, biteT: 1.2, recover: 1.2, hp: 6, anim: 3, tilt: -0.25, scale: 1.3, torso: 1.3, armored: true,
    look: (L) => rot(L, { shirt: C('#4a5a3a'), pants: C('#3a3f2e'), skin: C('#93a074'), hat: HAT.HARD, accent: C('#2d3134'), flags: FLAG.VEST | FLAG.BALD, accent2: C('#2d3134'), blood: 0.5 }) },
  { id: 'screamer', name: 'Screamer', w: 0.03, wander: 0.6, chase: 1.2, lunge: 2.4, lungeR: 2.0, sight: 14, notice: 7, noticeP: 0.4, biteR: 0.75, biteT: 1.1, recover: 1.4, hp: 1, anim: 3, tilt: -0.1, scream: true,
    look: (L) => rot(L, { shirt: dull(L.shirt, 0.45), pants: dull(L.pants, 0.45), skin: C('#c4c8ae'), hat: 0, flags: FLAG.BALD, blood: 0.6 }) },
  { id: 'skeleton', name: 'Skeleton', w: 0.03, ...WALK, wander: 0.7, chase: 1.5, lunge: 3.0, tilt: -0.3, scale: 0.98,
    look: (L) => ({ ...L, hat: 0, flags: FLAG.BALD, bones: BONE.SKEL, blood: 0 }) },
  { id: 'halfface', name: 'Half face', w: 0.06, ...WALK, look: (L) => rot(L, { bones: BONE.HALF, hat: 0, flags: FLAG.BALD }) },
  { id: 'arm', name: 'Arm exposed', w: 0.05, ...WALK, look: (L) => rot(L, { bones: BONE.ARM, blood: 0.75 }) },
  { id: 'boneleg', name: 'Bone leg', w: 0.05, ...WALK, wander: 0.45, chase: 1.1, look: (L) => rot(L, { bones: BONE.SHIN, blood: 0.7 }) },
  { id: 'noseless', name: 'Noseless', w: 0.04, ...WALK, look: (L) => rot(L, { bones: BONE.NOSE, hat: 0, flags: FLAG.BALD, blood: 0.55 }) },
  { id: 'ribs', name: 'Ribs exposed', w: 0.05, ...WALK, look: (L) => rot(L, { bones: BONE.RIBS, blood: 0.85, flags: (L.flags || 0) & ~(FLAG.ITEM | FLAG.VEST | FLAG.PACK) }) },
  { id: 'skullface', name: 'Skull face', w: 0.04, ...WALK, look: (L) => rot(L, { bones: BONE.SKULL, hat: 0, flags: FLAG.BALD, blood: 0.5 }) },
  { id: 'spitter', name: 'Spitter', w: 0.05, ...WALK, chase: 1.2, spit: true, look: (L) => rot(L, { shirt: C('#4e5a32'), skin: C('#8aa04e'), hat: 0, flags: FLAG.BALD, blood: 0.3 }) },
  { id: 'burned', name: 'Burned', w: 0.04, ...WALK, chase: 1.45, look: (L) => rot(L, { burn: 0.95, hat: 0, flags: FLAG.BALD, blood: 0 }) },
  { id: 'skelgear', name: 'Skeleton (geared)', w: 0.02, ...WALK, hp: 2, tilt: -0.28,
    look: (L) => ({ ...L, bones: BONE.SKEL, hat: HAT.HARD, accent: C('#2e3330'), flags: FLAG.VEST | FLAG.BALD, accent2: C('#2a2e2a'), blood: 0 }) },
  { id: 'skelcloth', name: 'Skeleton (clothed)', w: 0.02, ...WALK, tilt: -0.28,
    look: (L) => ({ ...L, shirt: C('#4a4844'), pants: C('#2e2c2a'), bones: BONE.SKIN, hat: HAT.HOOD, accent: C('#4a4844'), flags: FLAG.BALD, blood: 0.2 }) },
  { id: 'fire', name: 'Fire zombie', w: 0.015, ...WALK, chase: 1.7, lunge: 3.4, sight: 13,
    look: (L) => rot(L, { burn: 0.7, fx: 2, hat: 0, flags: FLAG.BALD, blood: 0 }) },
  // never rolled: irradiated people turn into these
  { id: 'radioactive', name: 'Radioactive', w: 0, ...WALK, chase: 1.6, lunge: 3.2, lungeR: 3.2, sight: 15, notice: 7, biteR: 1.2, hp: 2, rad: true,
    look: (L) => rot(L, { shirt: dull(L.shirt, 0.55), pants: dull(L.pants, 0.55), skin: C('#9cff52'), flags: ((L.flags || 0) & ~FLAG.ITEM) | FLAG.GLOW, blood: 0.25 }) },
];
export const RADIOACTIVE = ZTYPES.length - 1;
export function rollZombieType(r) {
  let t = r(); for (let k = 0; k < ZTYPES.length; k++) { if ((t -= ZTYPES[k].w) <= 0) return k; }
  return 0;
}
export { ZSKIN };
