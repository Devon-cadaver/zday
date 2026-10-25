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
  vec3 col = texture2D(tColor, vUv).rgb;
  float tot = 1.0;
  float rad = RAD_SCALE;
  float ang = 0.0;
  for (int i = 0; i < 180; i++) {
    if (rad >= maxBlur) break;
    vec2 tc = vUv + vec2(cos(ang), sin(ang)) * texel * rad;
    vec3 sc = texture2D(tColor, tc).rgb;
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
uniform float maxBlurFull, exposure, time, gradeOn, dofOn, glow, sepia;
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
void main() {
  vec3 sharp = texture2D(tColor, vUv).rgb;
  vec3 col = sharp;
  if (dofOn > 0.5) {
    vec4 bl = texture2D(tBlur, vUv);
    float c = cocN(viewZ(vUv)) * maxBlurFull;
    col = mix(sharp, bl.rgb, smoothstep(0.6, 2.5, c));
  }
  // soft glow from the blurred mip chain
  vec3 g = textureLod(tBlur, vUv, 4.0).rgb * 0.5 + textureLod(tBlur, vUv, 6.0).rgb * 0.5;
  col += max(g - 0.55, 0.0) * glow + g * glow * 0.12;
  col = aces(col * exposure);
  col = toSRGB(col);
  if (gradeOn > 0.5) {
    float l = dot(col, vec3(0.299, 0.587, 0.114));
    vec3 sep = vec3(l) * vec3(1.13, 0.97, 0.74);
    col = mix(col, sep, sepia);
    float l2 = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(l2), col, 1.18);
    // split tone: warm brown shadows, cream highlights
    col = mix(col, col * vec3(1.05, 0.96, 0.82), smoothstep(0.35, 1.0, l) * 0.5);
    col += vec3(0.07, 0.035, 0.0) * (1.0 - l);
    // gentle S-curve
    col = mix(col, col * col * (3.0 - 2.0 * col), 0.35);
    // vignette, warm
    vec2 q = (vUv - 0.5) * vec2(1.0, 1.15);
    float v = smoothstep(0.95, 0.3, length(q));
    col *= mix(vec3(0.55, 0.40, 0.26), vec3(1.0), v);
  }
  col += (hash(vUv * res + fract(time) * 100.0) - 0.5) * 0.03;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

export class Post {
  constructor(renderer, opts = {}) {
    this.renderer = renderer;
    this.opts = { blurFrac: 0.022, bandK: 0.028, rangeK: 0.17, exposure: 1.3, glow: 0.35, sepia: 0.22, dof: true, grade: true, ...opts };
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
        gradeOn: { value: 1 }, dofOn: { value: 1 }, glow: { value: 0.3 }, sepia: { value: 0.3 },
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
    f.exposure.value = o.exposure; f.time.value = time; f.glow.value = o.glow; f.sepia.value = o.sepia;
    f.gradeOn.value = o.grade ? 1 : 0; f.dofOn.value = o.dof ? 1 : 0;

    const r = this.renderer;
    r.setRenderTarget(this.sceneRT); r.render(scene, camera);
    this.quad.material = this.dofMat; r.setRenderTarget(this.blurRT); r.render(this.fsScene, this.cam);
    this.quad.material = this.finalMat; r.setRenderTarget(null); r.render(this.fsScene, this.cam);
  }
}
