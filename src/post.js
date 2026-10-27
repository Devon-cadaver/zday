// Post-processing for the miniature look:
// 1) scene -> HDR target with depth
// 2) half-res depth-of-field gather (golden-angle disc, depth-aware)
// 3) composite: sharp/blur mix, glow, ACES, warm sepia grade, vignette, grain
import * as THREE from 'three';

const VERT = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const COMMON = /* glsl */`
#include <packing>
// a broken pixel (not a number, or infinite) is dropped here: blurred into the glow's mip chain it would spread into a big black square
vec3 clean(vec3 c) { return min(max(c, vec3(0.0)), vec3(64000.0)); } // GPU min/max return the number when one side is not a number, and this survives compilers that drop isnan()
uniform sampler2D tDepth;
uniform float cameraNear, cameraFar, focus, band, range;
float viewZ(vec2 uv) {
  float d = texture2D(tDepth, uv).x;
  return -perspectiveDepthToViewZ(d, cameraNear, cameraFar);
}
float cocN(float z) {               // 0..1 circle of confusion
  float n = clamp((abs(z - focus) - band) / range, 0.0, 1.0);
  return n * n * (3.0 - 2.0 * n) * 0.35 + n * 0.65;
}
`;

const DOF_FRAG = /* glsl */`
uniform sampler2D tColor;
uniform vec2 texel;      // 1 / half-res size
uniform float maxBlur;   // in half-res pixels
varying vec2 vUv;
${COMMON}
const float GOLDEN = 2.39996323;
const float RAD_SCALE = 0.85;
void main() {
  float cz = viewZ(vUv);
  float cs = cocN(cz) * maxBlur;
  vec3 col = clean(texture2D(tColor, vUv).rgb);
  float tot = 1.0;
  float rad = RAD_SCALE;
  float ang = 0.0;
  for (int i = 0; i < 180; i++) {
    if (rad >= maxBlur) break;
    vec2 tc = vUv + vec2(cos(ang), sin(ang)) * texel * rad;
    vec3 sc = clean(texture2D(tColor, tc).rgb);
    float sz = viewZ(tc);
    float ss = cocN(sz) * maxBlur;
    if (sz > cz) ss = clamp(ss, 0.0, cs * 2.0);
    float m = smoothstep(rad - 0.5, rad + 0.5, ss);
    col += mix(col / tot, sc, m);
    tot += 1.0;
    rad += RAD_SCALE / rad;
    ang += GOLDEN;
  }
  gl_FragColor = vec4(col / tot, cs / maxBlur);
}
`;

const FINAL_FRAG = /* glsl */`
uniform sampler2D tColor, tBlur;
uniform vec2 res;
uniform float maxBlurFull, exposure, time, gradeOn, dofOn, glow, sepia, night, flash;
uniform float uBL, uBLFront, uBLWidth; uniform vec2 uBLOrigin, uBLDir; uniform mat4 uInvProj, uCamWorld;
uniform float uLens, uLensR; uniform vec2 uLensC; uniform float uHeat;
varying vec2 vUv;
${COMMON}
vec3 RRTAndODTFit(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}
vec3 aces(vec3 c) {
  const mat3 IM = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 OM = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  c = IM * c; c = RRTAndODTFit(c); c = OM * c;
  return clamp(c, 0.0, 1.0);
}
vec3 toSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
// world position of the surface seen at uv (from the depth buffer)
vec3 worldAt(vec2 uv) {
  vec4 p = uInvProj * vec4(uv * 2.0 - 1.0, texture2D(tDepth, uv).x * 2.0 - 1.0, 1.0); p /= p.w;
  return (uCamWorld * p).xyz;
}
// a black-light poster: deep violet darks, bands of fluorescent magenta, cyan and acid green, glowing edges
vec3 blackLight(vec3 c) {
  float l = dot(c, vec3(0.299, 0.587, 0.114)), t = l * 4.0;
  vec3 p0 = vec3(0.16, 0.0, 0.42), p1 = vec3(1.0, 0.08, 0.85), p2 = vec3(0.05, 1.0, 1.0), p3 = vec3(0.85, 1.0, 0.15);
  vec3 neon = l < 0.25 ? mix(vec3(0.02, 0.0, 0.07), p0, t) : l < 0.5 ? mix(p0, p1, t - 1.0) : l < 0.75 ? mix(p1, p2, t - 2.0) : mix(p2, p3, t - 3.0);
  float e = length(vec2(dFdx(l), dFdy(l))) * 7.0;
  return neon + vec3(0.7, 1.0, 0.95) * e;
}
// a black hole bends the light around it (point lens): an image at radius r shows what lies at r - Re^2 / r
vec2 lensUV(vec2 uv) {
  if (uLens <= 0.0) return uv;
  vec2 a = vec2(res.x / res.y, 1.0), d = (uv - uLensC) * a;
  float r = max(length(d), 1e-4), re = uLensR * uLens;
  float b = max(r - re * re / r, -2.5 * re), f = 1.0 - smoothstep(re * 2.0, re * 4.5, r);
  vec2 sp = uLensC + d / r * mix(r, b, f) / a;
  float e = min(min(sp.x, 1.0 - sp.x), min(sp.y, 1.0 - sp.y));
  return mix(uv, sp, smoothstep(-0.02, 0.04, e)); // nothing to bend in from off screen: fade the lens out there
}
void main() {
  vec2 uv = lensUV(vUv);
  vec3 sharp = clean(texture2D(tColor, uv).rgb);
  vec3 col = sharp;
  if (dofOn > 0.5) {
    vec4 bl = texture2D(tBlur, uv);
    float c = cocN(viewZ(uv)) * maxBlurFull;
    col = mix(sharp, bl.rgb, smoothstep(0.6, 2.5, c));
  }
  if (uLens > 0.0) { float r = length((vUv - uLensC) * vec2(res.x / res.y, 1.0)); col *= smoothstep(uLensR * uLens * 0.4, uLensR * uLens * 0.48, r); } // its shadow
  // soft glow from the blurred mip chain
  vec3 g = clean(textureLod(tBlur, uv, 4.0).rgb * 0.5 + textureLod(tBlur, uv, 6.0).rgb * 0.5);
  col += max(g - 0.55, 0.0) * glow + g * glow * 0.12;
  col = aces(col * exposure * (1.0 + 0.9 * night));
  col = toSRGB(col);
  if (gradeOn > 0.5) {
    float l = dot(col, vec3(0.299, 0.587, 0.114));
    vec3 sep = vec3(l) * vec3(1.13, 0.97, 0.74);
    col = mix(col, sep, sepia * (1.0 - night));
    col = mix(col, col * vec3(0.86, 0.9, 1.1), night);
    float l2 = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(l2), col, 1.18);
    // split tone: warm brown shadows, cream highlights
    col = mix(col, col * vec3(1.05, 0.96, 0.82), smoothstep(0.35, 1.0, l) * 0.5);
    col += vec3(0.07, 0.035, 0.0) * (1.0 - l) * (1.0 - night);
    // gentle S-curve
    col = mix(col, col * col * (3.0 - 2.0 * col), 0.35);
    // vignette, warm
    vec2 q = (vUv - 0.5) * vec2(1.0, 1.15);
    float v = smoothstep(0.95, 0.3, length(q));
    col *= mix(mix(vec3(0.55, 0.40, 0.26), vec3(0.42, 0.44, 0.56), night), vec3(1.0), v);
  }
  if (uHeat > 0.0) { // a nuclear flash: the whole city washed in hot orange light
    float l = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(col, vec3(1.0, 0.7, 0.34) * (0.42 + l * 1.05) + vec3(0.14, 0.05, 0.0), uHeat * 0.85);
  }
  if (uBL > 0.0) { // the solar wave passing: the strip just behind it glows like a black-light poster
    vec3 w = worldAt(vUv); float behind = uBLFront - dot(w.xz - uBLOrigin, uBLDir);
    float m = uBL * smoothstep(-6.0, 18.0, behind) * (1.0 - smoothstep(uBLWidth * 0.55, uBLWidth, behind));
    if (m > 0.001) col = mix(col, blackLight(col), m);
  }
  col += (hash(vUv * res + fract(time) * 100.0) - 0.5) * 0.03;
  col = mix(col, vec3(1.0, 0.98, 0.9), flash);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

export class Post {
  constructor(renderer, opts = {}) {
    this.renderer = renderer;
    this.opts = { blurFrac: 0.022, bandK: 0.042, rangeK: 0.26, exposure: 1.3, glow: 0.35, sepia: 0.22, dof: true, grade: true, ...opts };
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    this.sceneRT = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: opts.samples ?? 4 });
    this.sceneRT.depthTexture = new THREE.DepthTexture(size.x, size.y);
    this.sceneRT.depthTexture.type = THREE.UnsignedIntType;
    this.blurRT = new THREE.WebGLRenderTarget(Math.ceil(size.x / 2), Math.ceil(size.y / 2), {
      type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter,
    });
    const common = {
      tDepth: { value: this.sceneRT.depthTexture }, cameraNear: { value: 1 }, cameraFar: { value: 1000 },
      focus: { value: 400 }, band: { value: 10 }, range: { value: 100 },
    };
    this.dofMat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: DOF_FRAG, depthTest: false, depthWrite: false,
      uniforms: { ...common, tColor: { value: this.sceneRT.texture }, texel: { value: new THREE.Vector2() }, maxBlur: { value: 10 } },
    });
    this.finalMat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FINAL_FRAG, depthTest: false, depthWrite: false,
      uniforms: {
        ...common, tColor: { value: this.sceneRT.texture }, tBlur: { value: this.blurRT.texture },
        res: { value: new THREE.Vector2() }, maxBlurFull: { value: 20 }, exposure: { value: 1 }, time: { value: 0 },
        gradeOn: { value: 1 }, dofOn: { value: 1 }, glow: { value: 0.3 }, sepia: { value: 0.3 }, night: { value: 0 }, flash: { value: 0 },
        uBL: { value: 0 }, uBLFront: { value: 0 }, uBLWidth: { value: 120 }, uBLOrigin: { value: new THREE.Vector2() }, uBLDir: { value: new THREE.Vector2(1, 0) }, uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() },
        uLens: { value: 0 }, uLensR: { value: 0.05 }, uLensC: { value: new THREE.Vector2(0.5, 0.5) }, uHeat: { value: 0 },
      },
    });
    // share the common uniform objects so one write updates both passes
    for (const k of Object.keys(common)) this.finalMat.uniforms[k] = this.dofMat.uniforms[k];
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.dofMat);
    this.quad.frustumCulled = false;
    this.fsScene = new THREE.Scene(); this.fsScene.add(this.quad);
    this.setSize();
  }

  setSize() {
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.sceneRT.setSize(size.x, size.y);
    const hx = Math.ceil(size.x / 2), hy = Math.ceil(size.y / 2);
    this.blurRT.setSize(hx, hy);
    this.dofMat.uniforms.texel.value.set(1 / hx, 1 / hy);
    this.finalMat.uniforms.res.value.set(size.x, size.y);
    this.h = size.y;
  }

  render(scene, camera, focus, time) {
    const o = this.opts, u = this.dofMat.uniforms, f = this.finalMat.uniforms;
    u.cameraNear.value = camera.near; u.cameraFar.value = camera.far;
    u.focus.value = focus; u.band.value = focus * o.bandK; u.range.value = focus * o.rangeK;
    const maxFull = this.h * o.blurFrac;
    u.maxBlur.value = Math.max(1.5, maxFull / 2);
    f.maxBlurFull.value = maxFull;
    f.exposure.value = o.exposure; f.time.value = time; f.glow.value = o.glow; f.sepia.value = o.sepia; f.night.value = o.night || 0; f.flash.value = o.flash || 0;
    f.gradeOn.value = o.grade ? 1 : 0; f.dofOn.value = o.dof ? 1 : 0;
    const bl = o.blacklight; f.uBL.value = bl ? bl.amount : 0;
    if (bl && bl.amount > 0) { f.uBLFront.value = bl.front; f.uBLWidth.value = bl.width; f.uBLOrigin.value.set(bl.origin[0], bl.origin[1]); f.uBLDir.value.set(bl.dir[0], bl.dir[1]); f.uInvProj.value.copy(camera.projectionMatrixInverse); f.uCamWorld.value.copy(camera.matrixWorld); }

    f.uHeat.value = o.heat || 0;
    const ln = o.lens; f.uLens.value = ln ? ln.amount : 0; if (ln) { f.uLensC.value.set(ln.x, ln.y); f.uLensR.value = ln.r; }
    const r = this.renderer;
    r.setRenderTarget(this.sceneRT); r.render(scene, camera);
    this.quad.material = this.dofMat; r.setRenderTarget(this.blurRT); r.render(this.fsScene, this.cam);
    this.quad.material = this.finalMat; r.setRenderTarget(null); r.render(this.fsScene, this.cam);
  }
}
