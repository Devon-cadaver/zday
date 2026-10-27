// The world's curve: everything drops away with distance from the point the
// camera looks at, more the further out the camera is - flat at street level,
// the horizon of a small planet zoomed right out. Only the drawing bends: each
// material's vertex shader gets a few lines added as it compiles (the ground
// drops by k times the distance squared, a sphere's fall-off near the top), and
// the shadow pass bends the same way so shadows stay put. The simulation, the
// roads, the physics all stay flat; a tap is traced onto the bent ground.
import * as THREE from 'three';

export const CURVE = { k: { value: 0 }, c: { value: new THREE.Vector2() }, on: true };
const K_MAX = 2.2e-4, R0 = 300, R1 = 2200; // zoomed right out: 1 km off, the ground has dropped 220 m (a planet of about 2.3 km radius)

// built-in materials: the vertex's own world position, so it works in any pass (the shadow map's included)
const CHEAP = `
  { vec4 cwp = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    cwp = instanceMatrix * cwp;
  #endif
    cwp = modelMatrix * cwp; vec2 cd = cwp.xz - uCurveC;
    gl_Position += projectionMatrix * (viewMatrix * vec4(0.0, -dot(cd, cd) * uCurveK, 0.0, 0.0)); }`;
// our own shaders (water, waves, dust, sprays...): back from where it was drawn to the world, then down
const AFTER = `
  { vec4 cw = inverse(projectionMatrix * viewMatrix) * gl_Position; vec2 cd = cw.xz / cw.w - uCurveC;
    gl_Position += projectionMatrix * (viewMatrix * vec4(0.0, -dot(cd, cd) * uCurveK, 0.0, 0.0)); }`;

function bend(sh) {
  let v = sh.vertexShader;
  if (v.includes('uCurveK')) return;
  if (v.includes('#include <project_vertex>')) v = v.replace('#include <project_vertex>', '#include <project_vertex>' + CHEAP);
  else if (v.includes('projectionMatrix') && v.includes('gl_Position')) { const e = v.lastIndexOf('}'); if (e < 0) return; v = v.slice(0, e) + AFTER + '\n' + v.slice(e); }
  else return; // a full-screen pass: nothing to bend
  sh.vertexShader = 'uniform float uCurveK;\nuniform vec2 uCurveC;\n' + v;
  sh.uniforms.uCurveK = CURVE.k; sh.uniforms.uCurveC = CURVE.c;
}

// the shadow map's own depth materials bend too (nothing else wraps these)
for (const M of [THREE.MeshDepthMaterial, THREE.MeshDistanceMaterial]) M.prototype.onBeforeCompile = function (sh) { bend(sh); };

const done = new WeakSet();
function wrap(m) {
  if (done.has(m)) return; done.add(m);
  if (m.userData && m.userData.flat) return;
  const prev = m.onBeforeCompile, base = THREE.Material.prototype.customProgramCacheKey;
  m.onBeforeCompile = function (sh, r) { prev.call(this, sh, r); bend(sh); };
  if (m.customProgramCacheKey === base) { const key = prev.toString(); m.customProgramCacheKey = () => key + '|curve'; } // programs for different hooks stay apart
  if (m.version > 0) m.needsUpdate = true; // already drawn flat: once more, bent
}
function wrapObject(o) { const m = o.material; if (!m) return; if (Array.isArray(m)) m.forEach(wrap); else wrap(m); }

// each frame before drawing: every material in the scene bent (new ones the first time they appear), and the curve set
// for the zoom: none closer than 300 m, growing to the full curve at the furthest zoom
export function curveFrame(scene, camera, target) {
  scene.traverse(wrapObject);
  const r = camera.position.distanceTo(target), t = Math.min(1, Math.max(0, (r - R0) / (R1 - R0)));
  CURVE.k.value = CURVE.on ? K_MAX * t * t * (3 - 2 * t) : 0;
  CURVE.c.value.set(target.x, target.z);
}

// a ray from the camera onto the bent ground: where it meets the flat ground, then over and over to where the curve has
// dropped that ground to
export function curvedHit(ray, out) {
  const k = CURVE.k.value, o = ray.origin, d = ray.direction, c = CURVE.c.value;
  if (Math.abs(d.y) < 1e-6) return null;
  let y = 0;
  for (let n = 0; n < 6; n++) {
    const t = (y - o.y) / d.y; if (t < 0) return null;
    out.set(o.x + d.x * t, y, o.z + d.z * t);
    if (!k) break;
    y = -k * ((out.x - c.x) ** 2 + (out.z - c.y) ** 2);
  }
  out.y = 0; // the simulation's ground
  return out;
}
