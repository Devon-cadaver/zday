// See-through: walls and roofs between the camera and the action fade to a fine
// stipple, so what is happening behind a building (a zombie in an alley, someone on
// their card, a fight round the corner) stays in sight. Only close in (from 430 m
// down), only in a tube round the line from the camera to the point it looks at
// (or to whatever Follow is on), and never what is behind that point. The tilt-
// shift blur softens the stipple into a ghost of the building; shadows stay as they
// are (the shadow pass has its own materials). Patches the city's own materials,
// which already carry their world position for the ground holes (holes.js).
import * as THREE from 'three';

export const SEE = { on: true }; // off for comparisons (window.__z.see)
const U = { uSeeA: { value: new THREE.Vector3() }, uSeeB: { value: new THREE.Vector3() }, uSee: { value: new THREE.Vector2(0, 0) } };

export function seeThrough(mat) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    Object.assign(sh.uniforms, U);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uSeeA; uniform vec3 uSeeB; uniform vec2 uSee;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
  if (uSee.y > 0.0) {
    vec3 ab = uSeeB - uSeeA; float t = clamp(dot(vHoleW - uSeeA, ab) / dot(ab, ab), 0.0, 1.0);
    float r = uSee.x * (0.6 + 0.4 * smoothstep(0.5, 0.95, t)); // a little wider down at the action
    float k = (1.0 - smoothstep(r * 0.5, r, distance(vHoleW, uSeeA + ab * t))) * step(t, 0.985) * uSee.y; // between the camera and the action only
    if (k * 0.86 > fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))))) discard; // a stipple: a ghost of the wall is left
  }`);
  };
  return mat;
}

// each frame: the tube from the camera to what it looks at, how wide, how strong (fading in from 430 m to 330 m)
export function seeFrame(camera, focus, dist) {
  const on = SEE.on ? Math.min(1, Math.max(0, (430 - dist) / 100)) : 0;
  U.uSeeA.value.copy(camera.position); U.uSeeB.value.set(focus.x, (focus.y || 0) + 1.5, focus.z);
  U.uSee.value.set(Math.min(24, Math.max(9, dist * 0.07)), on);
}
