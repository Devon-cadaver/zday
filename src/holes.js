// Real holes in the ground. Every ground-level material (the city's, decals,
// blood, scorch marks) discards its fragments inside an open pit, so the pit's
// own walls and floor show through and anything that falls in is seen going
// down. A pit registers itself here: (x, z, radius, height below which the
// surface is cut away).
import * as THREE from 'three';

export const MAX_HOLES = 24; // the worm leaves two pits every time it surfaces
const holes = Array.from({ length: MAX_HOLES }, () => new THREE.Vector4(0, 0, -1, 0));
const uHoles = { value: holes };
const owners = new Array(MAX_HOLES).fill(null);

// claim a slot; returns its index (or -1 when every slot is taken: the pit is then drawn without cutting the ground)
export function addHole(owner) {
  const k = owners.indexOf(null); if (k < 0) return -1;
  owners[k] = owner; holes[k].set(owner.x, owner.z, 0, owner.cutY ?? 1);
  return k;
}
export function setHole(k, R) { if (k >= 0) holes[k].z = R; }
export function removeHole(k) { if (k >= 0) { owners[k] = null; holes[k].z = -1; } }

// patch a built-in material so it is cut away over open pits
export function cutGround(mat) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.uniforms.uHoles = uHoles;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vHoleW;').replace('#include <project_vertex>', `#include <project_vertex>
  { vec4 hw = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    hw = instanceMatrix * hw;
  #endif
    vHoleW = (modelMatrix * hw).xyz; }`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vHoleW; uniform vec4 uHoles[${MAX_HOLES}];`).replace('void main() {', `void main() {
  for (int i = 0; i < ${MAX_HOLES}; i++) { vec4 H = uHoles[i]; if (H.z > 0.0 && vHoleW.y < H.w && distance(vHoleW.xz, H.xy) < H.z) discard; }`);
  };
  return mat;
}
