// Low-poly people: head with hair cap, torso, two arms, two legs. One merged
// geometry (92 triangles) drawn as a single instanced mesh. Limbs swing in the
// vertex shader driven by a per-instance animation id, so 10,000 walking
// people cost the same as 10,000 static ones.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// aTag.x part: 0 shirt, 1 pants, 2 skin, 3 hair/cap
// aTag.y limb: 0 body, 1 left leg, 2 right leg, 3 left arm, 4 right arm, 5 head
function tag(g, part, limb) {
  const n = g.attributes.position.count;
  const a = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) { a[i * 2] = part; a[i * 2 + 1] = limb; }
  g.setAttribute('aTag', new THREE.BufferAttribute(a, 2));
  return g;
}

export const HIP = 0.84, SHOULDER = 1.36, NECK = 1.42;

export function figureGeometry() {
  const head = mergeVertices(new THREE.IcosahedronGeometry(0.15, 0));
  head.translate(0, 1.47, 0);
  const parts = [
    tag(head, 2, 5),
    tag(new THREE.BoxGeometry(0.22, 0.09, 0.26).translate(0.01, 1.58, 0), 3, 5),
    tag(new THREE.BoxGeometry(0.2, 0.52, 0.34).translate(0, 1.1, 0), 0, 0),
    tag(new THREE.BoxGeometry(0.1, 0.5, 0.1).translate(0, 1.11, -0.22), 0, 3),
    tag(new THREE.BoxGeometry(0.1, 0.5, 0.1).translate(0, 1.11, 0.22), 0, 4),
    tag(new THREE.BoxGeometry(0.14, 0.84, 0.14).translate(0, 0.42, -0.09), 1, 1),
    tag(new THREE.BoxGeometry(0.14, 0.84, 0.14).translate(0, 0.42, 0.09), 1, 2),
  ];
  const g = mergeGeometries(parts);
  g.computeBoundingSphere();
  return g;
}

// Animation ids (per instance, attribute aAnim):
// 0 idle, 1 walk, 2 run, 3 shamble (zombie), 4 limp/none, 5 arms out (zombie, no legs),
// 6 aiming (arms forward, standing), 7 aiming while walking
export function figureMaterial() {
  const uTime = { value: 0 };
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.9 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', /* glsl */`#include <common>
uniform float uTime;
attribute vec2 aTag;
attribute vec3 aShirt; attribute vec3 aPants; attribute vec3 aSkin; attribute float aAnim;
varying vec3 vTint;
vec3 rotZ(vec3 p, float py, float a) {
  p.y -= py; float c = cos(a), s = sin(a);
  p.xy = vec2(p.x * c - p.y * s, p.x * s + p.y * c);
  p.y += py; return p;
}`)
      .replace('#include <begin_vertex>', /* glsl */`#include <begin_vertex>
{
  float limb = aTag.y, an = aAnim;
  float ph = float(gl_InstanceID) * 1.618;
  float freq = 0.0, amp = 0.0;
  if (an == 1.0 || an == 7.0) { freq = 6.0; amp = 0.5; }
  else if (an == 2.0) { freq = 10.0; amp = 0.9; }
  else if (an == 3.0) { freq = 3.2; amp = 0.3; }
  float sw = sin(uTime * freq + ph) * amp;
  bool armsOut = (an == 3.0 || an == 5.0 || an == 6.0 || an == 7.0);
  bool zombie = (an == 3.0 || an == 5.0);
  if (limb == 1.0) transformed = rotZ(transformed, ${HIP}, sw);
  else if (limb == 2.0) transformed = rotZ(transformed, ${HIP}, -sw);
  else if (limb == 3.0) transformed = rotZ(transformed, ${SHOULDER}, armsOut ? 1.35 + (zombie ? sin(uTime * 2.0 + ph) * 0.15 : 0.0) : -sw * 0.7);
  else if (limb == 4.0) transformed = rotZ(transformed, ${SHOULDER}, armsOut ? 1.2 + (zombie ? cos(uTime * 2.3 + ph) * 0.15 : 0.0) : sw * 0.7);
  else if (limb == 5.0 && zombie) transformed = rotZ(transformed, ${NECK}, 0.35);
  if (freq > 0.0) transformed.y += abs(sin(uTime * freq + ph)) * 0.03;
  float part = aTag.x;
  vTint = part < 0.5 ? aShirt : part < 1.5 ? aPants : part < 2.5 ? aSkin : mix(vec3(0.10, 0.08, 0.06), aPants, 0.35);
}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTint;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= vTint;');
  };
  mat.customProgramCacheKey = () => 'zday-figure';
  return { mat, uTime };
}
