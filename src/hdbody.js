// The detailed body (Sean, 2026-11-04: can the heroes and villains look closer to a painted picture of a muscled caped hero). A test on Tyrant, see fighter.html.
// The joints are rig()'s (villains.js), so every move and every Pose Lab edit plays on it as it is. What changes is what is on them:
// a body swept through the joints with muscle in its shape, a painted atlas (colour and normal) for the muscle lines, seams and the grain of the suit,
// a sculpted head, fists, armour plates and a belt that ride the joints as solid pieces, and a heavy torn cape. Everything is made in the browser, nothing is downloaded.
// Tubes all use "back" as their up: c = 1 is the back of a limb, so the seam of the paint is at the back and the front is the middle of the painting.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Body, vnoise } from './flesh.js';

const g = (x, w) => Math.exp(-(x * x) / (w * w)), sst = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------- the painting: one atlas, four regions. U round the limb (0.5 the front), V along it from the first joint
const W = 1024, PAD = 4, REG = { torso: [0, 0, 614, 614], leg: [614, 0, 410, 720], arm: [0, 614, 360, 410] };
const SUIT = [50, 46, 56], BOOT = [34, 31, 36], BRONZE = [150, 112, 58];
let ATLAS = null;
function hash(i, j) { let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function atlas() {
  if (ATLAS) return ATLAS; const t00 = performance.now();
  const H = new Float32Array(W * W), G = new Float32Array(W * W), K = new Uint8Array(W * W);
  // a soft lump in a region, round the limb's seam too
  const blob = (R, u, v, ru, rv, amp, rot = 0) => { const [x0, y0, w, h] = R, iw = w - PAD * 2, ih = h - PAD * 2, cs = Math.cos(rot), sn = Math.sin(rot), big = Math.max(ru, rv) * 1.7, jy0 = Math.max(0, Math.floor((v - big) * ih)), jy1 = Math.min(ih - 1, Math.ceil((v + big) * ih)); for (const uo of [u - 1, u, u + 1]) { const ix0 = Math.max(0, Math.floor((uo - big) * iw)), ix1 = Math.min(iw - 1, Math.ceil((uo + big) * iw)); for (let j = jy0; j <= jy1; j++) for (let i = ix0; i <= ix1; i++) { const du = i / iw - uo, dv = j / ih - v, a = (du * cs + dv * sn) / ru, b = (-du * sn + dv * cs) / rv, d = a * a + b * b; if (d < 1) { const f = 1 - d; H[(y0 + PAD + j) * W + x0 + PAD + i] += amp * f * f * (3 - 2 * f); } } } };
  // a groove or a raised line: it also darkens (G) when dark is set
  const line = (R, u0, v0, u1, v1, wd, amp, dark = 1, kind = 0) => { const [x0, y0, w, h] = R, iw = w - PAD * 2, ih = h - PAD * 2, n = Math.max(2, Math.ceil(Math.hypot((u1 - u0) * iw, (v1 - v0) * ih) / 2)), rp = Math.max(1, wd * iw); for (let q = 0; q <= n; q++) { const t = q / n, cu = (u0 + (u1 - u0) * t) * iw, cv = (v0 + (v1 - v0) * t) * ih, rr = Math.ceil(rp); for (let j = -rr; j <= rr; j++) for (let i = -rr; i <= rr; i++) { const yy = Math.round(cv) + j, xx = ((Math.round(cu) + i) % iw + iw) % iw; if (yy < 0 || yy >= ih) continue; const d = Math.hypot(i, j) / rp; if (d >= 1) continue; const f = (1 - d) * (1 - d), o = (y0 + PAD + yy) * W + x0 + PAD + xx; if (amp < 0) { H[o] = Math.min(H[o], H[o] * (1 - f) + (H[o] + amp) * f); G[o] = Math.max(G[o], dark * f); } else H[o] = Math.max(H[o], amp * f); if (kind && f > 0.25) K[o] = kind; } } };
  const fillK = (R, v0, v1, kind) => { const [x0, y0, w, h] = R; for (let y = Math.floor(v0 * h); y < Math.ceil(v1 * h) && y < h; y++) for (let x = 0; x < w; x++) K[(y0 + y) * W + x0 + x] = kind; };
  const T = REG.torso, L = REG.leg, A = REG.arm;
  // the chest and the belly (0.5 the middle of the front)
  for (const s of [-1, 1]) {
    blob(T, 0.5 + s * 0.082, 0.765, 0.078, 0.085, 1.0, s * 0.18); // pec
    line(T, 0.5 + s * 0.012, 0.69, 0.5 + s * 0.15, 0.72, 0.006, -0.32, 0.65); // under the pec
    blob(T, 0.5 + s * 0.17, 0.84, 0.06, 0.06, 0.45); // towards the shoulder
    for (const [v, a] of [[0.615, 0.62], [0.545, 0.7], [0.475, 0.7], [0.4, 0.62]]) blob(T, 0.5 + s * 0.037, v, 0.033, 0.036, a); // abs
    blob(T, 0.5 + s * 0.112, 0.48, 0.034, 0.15, 0.5); // the side of the belly
    for (let i = 0; i < 4; i++) blob(T, 0.5 + s * (0.165 + i * 0.006), 0.66 - i * 0.037, 0.026, 0.014, 0.34, s * -0.5); // the ribs' muscle
    line(T, 0.5 + s * 0.082, 0.66, 0.5 + s * 0.082, 0.33, 0.005, -0.34, 0.7); // beside the abs
    line(T, 0.5 + s * 0.14, 0.62, 0.5 + s * 0.1, 0.32, 0.005, -0.3, 0.6);
    // the back, mostly under the cape
    blob(T, 0.0 + s * 0.11, 0.66, 0.07, 0.15, 0.7, s * 0.2); blob(T, 0.0 + s * 0.055, 0.84, 0.07, 0.06, 0.65); blob(T, 0.0 + s * 0.11, 0.13, 0.11, 0.1, 0.8);
    // the panel seam from the collar to the waist
    line(T, 0.5 + s * 0.2, 0.88, 0.5 + s * 0.195, 0.33, 0.004, -0.34, 0.75);
    // the emblem: a chevron of bronze on the chest, Tyrant's own
    line(T, 0.5, 0.715, 0.5 + s * 0.135, 0.84, 0.014, 0.42, 0, 1); line(T, 0.5 + s * 0.135, 0.84, 0.5 + s * 0.18, 0.835, 0.012, 0.42, 0, 1);
  }
  line(T, 0.5, 0.86, 0.5, 0.33, 0.006, -0.45, 0.8); for (const v of [0.58, 0.51, 0.44]) line(T, 0.5 - 0.074, v, 0.5 + 0.074, v, 0.0045, -0.3, 0.7); line(T, 0, 0.9, 0, 0.3, 0.006, -0.4, 0.7);
  // the leg (0.25 the outside, 0.5 the front, 0.75 the inside, 0 the back; V down it, the knee near 0.5, the ankle near 0.9)
  blob(L, 0.5, 0.24, 0.13, 0.16, 0.95); blob(L, 0.335, 0.31, 0.1, 0.17, 0.85); blob(L, 0.66, 0.37, 0.095, 0.1, 0.9); blob(L, 0.5, 0.49, 0.075, 0.035, 0.55); blob(L, 0.0, 0.3, 0.14, 0.17, 0.7); blob(L, 0.11, 0.62, 0.1, 0.095, 0.95); blob(L, 0.89, 0.62, 0.1, 0.095, 0.95);
  line(L, 0.42, 0.1, 0.46, 0.44, 0.007, -0.34, 0.7); line(L, 0.6, 0.12, 0.57, 0.42, 0.007, -0.34, 0.7); line(L, 0.25, 0.04, 0.25, 0.7, 0.006, -0.36, 0.75); line(L, 0.0, 0.5, 0.0, 0.72, 0.006, -0.3, 0.7);
  // the arm (0.5 the front, the bicep; 0 the back, the tricep; the shoulder near 0.18, the elbow near 0.55)
  for (const u of [0.25, 0.5, 0.75]) blob(A, u, 0.21, 0.13, 0.085, 0.72); blob(A, 0.5, 0.39, 0.11, 0.11, 1); blob(A, 0.0, 0.39, 0.13, 0.12, 0.85); blob(A, 0.4, 0.66, 0.1, 0.1, 0.6); blob(A, 0.65, 0.64, 0.09, 0.09, 0.5);
  line(A, 0.34, 0.32, 0.34, 0.5, 0.008, -0.32, 0.7); line(A, 0.68, 0.32, 0.68, 0.5, 0.008, -0.32, 0.7); line(A, 0.32, 0.27, 0.68, 0.27, 0.006, -0.25, 0.55);
  // long cracks and veins in the hide, as it wears
  for (let i = 0; i < 90; i++) { const R = i % 3 === 0 ? T : i % 3 === 1 ? L : A; let u = hash(i, 1), v = hash(i, 2) * 0.82 + 0.06, a = hash(i, 3) * 6.28; const n = 3 + Math.floor(hash(i, 4) * 5); for (let k = 0; k < n; k++) { const u1 = u + Math.cos(a) * 0.035, v1 = v + Math.sin(a) * 0.035; line(R, u, v, u1, v1, 0.0022, -0.1, 0.32); u = u1; v = v1; a += (hash(i, k + 7) - 0.5) * 1.7; } }
  fillK(L, 0.73, 1, 2);
  // the grain: small plates of hide, a little tile of them over the whole sheet
  const TL = 128, CG = 23, GR = new Float32Array(TL * TL), EG = new Float32Array(TL * TL), cx = [], cy = []; for (let j = 0; j < CG; j++) for (let i = 0; i < CG; i++) { cx.push((i + 0.5 + (j & 1 ? 0.5 : 0) + (hash(i, j + 40) - 0.5) * 0.7) / CG); cy.push((j + 0.5 + (hash(i + 40, j) - 0.5) * 0.7) / CG); }
  for (let y = 0; y < TL; y++) for (let x = 0; x < TL; x++) { const px = x / TL, py = y / TL; let f1 = 9, f2 = 9; const ci = Math.floor(px * CG), cj = Math.floor(py * CG); for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) { const ii = ((ci + di) % CG + CG) % CG, jj = ((cj + dj) % CG + CG) % CG, w = jj * CG + ii; let dx = Math.abs(px - cx[w]), dy = Math.abs(py - cy[w]); dx = Math.min(dx, 1 - dx); dy = Math.min(dy, 1 - dy); const d = Math.hypot(dx, dy); if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d; } const e = (f2 - f1) * CG; GR[y * TL + x] = sst(0, 0.32, e) * (1 - 0.5 * f1 * CG * 0.5); EG[y * TL + x] = 1 - sst(0.02, 0.18, e); }
  const MOT = new Float32Array(64 * 64); for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) MOT[y * 64 + x] = vnoise(x / 8, y / 8, 8, 8, 3);
  // bake: colour and normal
  const col = new Uint8Array(W * W * 4), nrm = new Uint8Array(W * W * 4), HF = new Float32Array(W * W); for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) { const k = y * W + x, q = (y % TL) * TL + (x % TL); HF[k] = H[k] * 3.6 + GR[q] * 0.2; }
  for (let y = 0; y < W; y++) { const ym = Math.max(0, y - 1), yp = Math.min(W - 1, y + 1); for (let x = 0; x < W; x++) { const k = y * W + x, q = (y % TL) * TL + (x % TL), xm = Math.max(0, x - 1), xp = Math.min(W - 1, x + 1); let nx = (HF[y * W + xm] - HF[y * W + xp]) * 1.1, ny = (HF[ym * W + x] - HF[yp * W + x]) * 1.1; const inv = 1 / Math.sqrt(nx * nx + ny * ny + 1), i = k * 4; nrm[i] = (nx * inv * 0.5 + 0.5) * 255; nrm[i + 1] = (ny * inv * 0.5 + 0.5) * 255; nrm[i + 2] = (inv * 0.5 + 0.5) * 255; nrm[i + 3] = 255; const base = K[k] === 1 ? BRONZE : K[k] === 2 ? BOOT : SUIT, lift = 0.88 + 0.34 * Math.max(0, Math.min(1, H[k])), dark = (1 - 0.72 * G[k]) * (1 - 0.2 * EG[q]) * lift, noise = K[k] === 1 ? 1 : 0.94 + 0.12 * MOT[((y >> 2) & 63) * 64 + ((x >> 2) & 63)]; col[i] = Math.min(255, base[0] * dark * noise); col[i + 1] = Math.min(255, base[1] * dark * noise); col[i + 2] = Math.min(255, base[2] * dark * noise); col[i + 3] = 255; } }
  const tex = (d, srgb) => { const t = new THREE.DataTexture(d, W, W, THREE.RGBAFormat, THREE.UnsignedByteType); t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 4; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t; };
  ATLAS = { map: tex(col, true), normal: tex(nrm, false), ms: performance.now() - t00 }; if (typeof window !== 'undefined') window.__hdPaintMs = ATLAS.ms; return ATLAS;
}
function suitMat() {
  const A = atlas(), m = new THREE.MeshStandardMaterial({ vertexColors: true, map: A.map, normalMap: A.normal, normalScale: new THREE.Vector2(1, 1), roughness: 0.58, metalness: 0.08 });
  // a rim of the villain's own colour: a dark suit must still read against a dark sky and from far off
  m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', 'float rimH = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 3.6);\noutgoingLight += vec3(0.13, 0.07, 0.2) * rimH;\n#include <opaque_fragment>'); }; m.customProgramCacheKey = () => 'hd-suit-2';
  return m;
}

// ---------- the swept body
export function hdSmooth(r) {
  const body = new Body(suitMat()), H = r.hips, Tq = r.torso, Ch = r.chest, Hd = r.head, WHITE = [1, 1, 1], tubes = [];
  const T = (q, pts, ref, reg, mirror) => { const t = body.add({ lumps: 0, tile: 0.3, capStart: true, capEnd: true, ...q }); t.src = pts; t.refSrc = ref; tubes.push([t, reg, mirror]); };
  // the torso: wide lats and a narrow waist; f is how far round to the front, b to the back
  T({ rings: 46, cols: 42, len: 0.8, radii: [0.155, 0.168, 0.138, 0.18, 0.232, 0.105], shape: (u, c, s) => { const f = Math.max(0, -c), b = Math.max(0, c), as = Math.abs(s), dep = 0.6 + 0.08 * g(u - 0.72, 0.16) + 0.06 * g(u - 0.1, 0.1); let k = 1 / Math.sqrt((c / dep) ** 2 + s * s); k *= 1 + 0.13 * g(u - 0.77, 0.075) * g(as - 0.42, 0.34) * Math.sqrt(f) + 0.035 * g(u - 0.47, 0.14) * g(s, 0.36) * f + 0.15 * g(u - 0.86, 0.065) * b + 0.07 * g(u - 0.7, 0.09) * g(as - 0.5, 0.32) * b + 0.2 * g(u - 0.11, 0.075) * b * g(as - 0.4, 0.4) - 0.08 * g(as, 0.09) * g(u - 0.72, 0.1) * b; return k; }, tint: () => WHITE },
    [[H, 0, -0.08, 0], [H, 0, 0.02, 0], [Tq, 0, 0.12, 0], [Ch, 0, 0.02, 0], [Ch, 0, 0.2, 0], [Ch, 0, 0.3, 0]], [Ch, 0, 0, -1], REG.torso, false);
  // the neck, in skin, thick with the muscle down to the shoulders
  T({ rings: 10, cols: 16, len: 0.2, radii: [0.1, 0.073, 0.062], capEnd: false, shape: (u, c) => 1 + 0.08 * Math.max(0, c) * (1 - u), tint: () => [2.1, 1.35, 1.05] }, [[Ch, 0, 0.24, 0], [Hd, 0, -0.13, -0.008], [Hd, 0, -0.07, -0.012]], [Ch, 0, 0, -1], null);
  for (const L of r.legs) { const sx = Math.sign(L.hip.position.x) || 1;
    T({ rings: 38, cols: 24, len: 1.0, radii: [0.098, 0.1, 0.064, 0.05, 0.046], bulge: [0, 0.016, 0.01, 0], shape: (u, c, s) => { const f = Math.max(0, -c), b = Math.max(0, c), out = Math.max(0, s * sx); return 1 + 0.08 * g(u - 0.27, 0.15) * f + 0.08 * g(u - 0.3, 0.15) * out + 0.2 * g(u - 0.62, 0.085) * b + 0.06 * g(u - 0.3, 0.14) * b - 0.04 * g(u - 0.5, 0.035); }, tint: () => WHITE },
      [[H, sx * 0.06, 0.02, 0], [L.hip, 0, 0, 0], [L.knee, 0, 0, 0], [L.ank, 0, 0.05, 0], [L.ank, 0, 0, 0]], [H, 0, 0, -1], REG.leg, sx < 0); }
  for (const A of r.arms) {
    T({ rings: 30, cols: 20, len: 0.75, radii: [0.08, 0.088, 0.056, 0.047, 0.041], bulge: [0, 0.013, 0.012, 0], shape: (u, c) => 1 + 0.09 * g(u - 0.39, 0.11) * Math.max(0, -c) + 0.08 * g(u - 0.39, 0.13) * Math.max(0, c) + 0.04 * g(u - 0.66, 0.1), tint: () => WHITE },
      [[Ch, A.sx * 0.13, A.sh.position.y, 0], [A.sh, 0, 0, 0], [A.el, 0, 0, 0], [A.wr, 0, 0.03, 0], [A.wr, 0, -0.015, 0]], [Ch, 0, 0, -1], REG.arm, A.sx < 0); }
  const mesh = body.build([0, 1, 0], 2.4); mesh.visible = false; r.body.add(mesh);
  // each tube on its part of the painting (the neck on a plain patch of the arm's top: its tint makes it skin)
  const uv = mesh.geometry.attributes.uv; for (const [t, R, mir] of tubes) for (let k = 0; k < t.R; k++) for (let j = 0; j <= t.C; j++) { const v = t.off + k * (t.C + 1) + j; let U = j / t.C, V = k / (t.R - 1); if (!R) { uv.setXY(v, 800 / W + U * 0.02, 900 / W + V * 0.02); continue; } if (mir) U = 1 - U; uv.setXY(v, (R[0] + PAD + U * (R[2] - PAD * 2)) / W, (R[1] + PAD + V * (R[3] - PAD * 2)) / W); } uv.needsUpdate = true;
  return { body, mesh };
}

// ---------- the solid pieces
const STD = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, ...o });
let MT = null; const mats = () => (MT ??= { bronze: STD('#a87e42', { metalness: 0.55, roughness: 0.38 }), steel: STD('#4a4750', { metalness: 0.5, roughness: 0.42 }), boot: STD('#1e1c22', { roughness: 0.42, metalness: 0.2 }), sole: STD('#0e0d10', { roughness: 0.8 }), skin: STD('#c8977a', { roughness: 0.62 }), head: STD('#ffffff', { vertexColors: true, roughness: 0.6 }), hair: STD('#17120f', { roughness: 0.46 }), red: STD('#8c1224', { roughness: 0.85 }) });
const M4 = new THREE.Matrix4(), QQ = new THREE.Quaternion(), EU = new THREE.Euler();
const put = (geo, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => { const q = geo.index ? geo.toNonIndexed() : geo.clone(); EU.set(rx, ry, rz); M4.compose(new THREE.Vector3(x, y, z), QQ.setFromEuler(EU), new THREE.Vector3(sx, sy, sz)); q.applyMatrix4(M4); return q; };
const merged = (list) => { const o = mergeGeometries(list, false); for (const q of list) q.dispose(); o.computeBoundingSphere(); return o; };
const ball = () => new THREE.SphereGeometry(1, 12, 9), box = () => new THREE.BoxGeometry(1, 1, 1), tube = (a, b, h, n = 14) => new THREE.CylinderGeometry(a, b, h, n, 1, true);
// an angular plate seen from the front: outline in x, y, thickness d
const plate = (pts, d) => { const s = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y))); s.closePath(); return new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: d * 0.4, bevelSize: d * 0.4, bevelSegments: 1 }); };

// the head: a sphere pushed into a face. Painted by its vertices: skin, stubble, brows, lips
function headGeo() {
  const G0 = new THREE.SphereGeometry(1, 56, 44), p = G0.attributes.position, col = new Float32Array(p.count * 3), n = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    n.fromBufferAttribute(p, i); const front = Math.max(0, n.z); let X = n.x * 0.09, Y = n.y * 0.128, Z = n.z * 0.104; const low = Math.max(0, -Y / 0.128);
    X *= 1 - 0.1 * low ** 2.4; X *= 1 + 0.07 * g(Y + 0.07, 0.03); Z -= 0.008 * low * front; // a long square jaw
    const ax = Math.abs(X), fm = sst(0.05, 0.42, front), nose = g(X, 0.0105 + 0.006 * sst(-0.01, -0.05, Y));
    Z += fm * (0.013 * g(Y - 0.034, 0.012) * g(X, 0.07) - 0.018 * g(ax - 0.039, 0.019) * g(Y - 0.012, 0.0115) + 0.024 * nose * sst(0.026, -0.03, Y) * sst(-0.056, -0.042, Y) + 0.012 * g(ax - 0.058, 0.018) * g(Y + 0.018, 0.016) - 0.006 * g(ax - 0.03, 0.012) * g(Y + 0.058, 0.02) + 0.004 * g(X, 0.024) * g(Y + 0.07, 0.005) - 0.005 * g(X, 0.03) * g(Y + 0.077, 0.0022) + 0.004 * g(X, 0.02) * g(Y + 0.083, 0.005) - 0.004 * g(X, 0.02) * g(Y + 0.095, 0.005) + 0.016 * g(X, 0.03) * g(Y + 0.11, 0.014));
    p.setXYZ(i, X, Y, Z);
    // the colour, top down
    let c = [0.86, 0.62, 0.48]; const fade = (to, k) => { c = c.map((q, a) => q + (to[a] - q) * k); };
    fade([0.9, 0.58, 0.46], 0.5 * g(ax - 0.06, 0.03) * g(Y + 0.01, 0.03)); // the cheeks
    fade([0.36, 0.22, 0.2], 0.8 * g(ax - 0.039, 0.02) * g(Y - 0.012, 0.0115) * fm); // the sockets
    fade([0.1, 0.075, 0.065], 0.95 * sst(0.074, 0.088, Y + 0.05 * (1 - front))); // the hair at the crown
    fade([0.5, 0.25, 0.22], 0.75 * g(X, 0.025) * g(Y + 0.072, 0.008) * fm); // the lips
    fade([0.12, 0.09, 0.08], 0.92 * Math.min(1, g(X, 0.03) * g(Y + 0.108, 0.02) + g(X, 0.024) * g(Y + 0.061, 0.0045) + 0.8 * g(X, 0.012) * g(Y + 0.09, 0.008)) * fm); // the goatee and the moustache
    fade([0.36, 0.27, 0.24], 0.55 * sst(0.4, 0.8, low)); // stubble along the jaw
    col[i * 3] = c[0] ** 2.2; col[i * 3 + 1] = c[1] ** 2.2; col[i * 3 + 2] = c[2] ** 2.2;
  }
  G0.setAttribute('color', new THREE.BufferAttribute(col, 3)); G0.computeVertexNormals(); return G0;
}
function hairGeo() { const L = [], cone = new THREE.ConeGeometry(0.024, 0.085, 6), cap = new THREE.SphereGeometry(1, 22, 12, 0, Math.PI * 2, 0, 1.5); L.push(put(cap, 0, 0.0, -0.022, 0.097, 0.135, 0.109, -0.62)); cap.dispose(); for (let i = 0; i < 46; i++) { const a = (i * 2.399) % 6.283, r = Math.sqrt((i + 0.5) / 46), x = Math.cos(a) * r * 0.082, z = Math.sin(a) * r * 0.082 - 0.016, y = 0.122 * Math.sqrt(Math.max(0.04, 1 - r * r * 0.82)); if (z > 0.035 && y < 0.11) continue; if (z > 0.06) continue; L.push(put(cone, x, y + 0.004, z - 0.008, 1, 0.8 + hash(i, 9) * 0.5, 0.75, -1.5 + (z > 0 ? 0.3 : -0.3), 0, -x * 6)); } cone.dispose(); return merged(L); }
function fistGeo(sx) { const L = [], b = ball(), cy = new THREE.CapsuleGeometry(0.0125, 0.024, 3, 8); L.push(put(b, 0, -0.04, 0, 0.044, 0.05, 0.034)); for (let i = 0; i < 4; i++) { const x = (i - 1.5) * 0.0215; L.push(put(cy, x, -0.08, 0.012, 1, 1, 1, 1.25)); L.push(put(cy, x, -0.062, 0.03, 0.95, 0.85, 0.95, 0.15)); } L.push(put(cy, -sx * -0.036, -0.055, 0.022, 1.08, 1.05, 1.08, 0.9, 0, -sx * 0.5)); b.dispose(); cy.dispose(); return merged(L); }
function bracerGeo(sx) { const m0 = [put(tube(0.074, 0.059, 0.19), 0, -0.14, 0)], m1 = [put(tube(0.077, 0.074, 0.016), 0, -0.05, 0), put(tube(0.0625, 0.06, 0.016), 0, -0.232, 0), put(tube(0.07, 0.068, 0.009), 0, -0.1, 0)], fin = plate([[0, 0.1], [0.024, 0.055], [0.024, -0.05], [0, -0.1], [-0.024, -0.05], [-0.024, 0.055]], 0.008); m0.push(put(fin, sx * 0.066, -0.14, 0, 1, 1, 1, 0, sx * Math.PI / 2, 0)); const f2 = plate([[0, 0.05], [0.04, 0.02], [0.012, -0.05], [-0.04, 0.02]], 0.006); m1.push(put(f2, 0, -0.15, 0.06, 0.9, 1.4, 1)); fin.dispose(); f2.dispose(); return [merged(m0), merged(m1)]; }
function greaveGeo() { const m0 = [put(tube(0.075, 0.062, 0.3), 0, -0.285, 0)], m1 = [put(tube(0.079, 0.077, 0.018), 0, -0.14, 0), put(tube(0.066, 0.064, 0.02), 0, -0.43, 0)], fr = plate([[0, 0.17], [0.05, 0.11], [0.044, -0.11], [0, -0.16], [-0.044, -0.11], [-0.05, 0.11]], 0.011), ch = plate([[0, 0.03], [0.05, -0.015], [0.05, -0.04], [0, 0.003], [-0.05, -0.04], [-0.05, -0.015]], 0.006); m0.push(put(fr, 0, -0.285, 0.062, 1, 1, 1, -0.035)); for (const y of [-0.2, -0.27, -0.34]) m1.push(put(ch, 0, y, 0.075, 0.82, 1, 1, -0.035)); { const kp = plate([[0, 0.05], [0.04, 0.025], [0.034, -0.03], [0, -0.05], [-0.034, -0.03], [-0.04, 0.025]], 0.008); m1.push(put(kp, 0, -0.03, 0.058)); kp.dispose(); } fr.dispose(); ch.dispose(); return [merged(m0), merged(m1)]; }
function bootGeo() { const b = ball(), L = [put(b, 0, -0.012, 0.055, 0.058, 0.05, 0.125), put(tube(0.06, 0.064, 0.09), 0, 0.03, 0), put(b, 0, -0.005, -0.015, 0.058, 0.055, 0.075)]; const so = box(); const S0 = [put(so, 0, -0.061, 0.075, 0.102, 0.018, 0.2), put(so, 0, -0.058, -0.06, 0.098, 0.025, 0.08)]; b.dispose(); so.dispose(); return [merged(L), merged(S0)]; }
// all the solid pieces on the joints; part(mesh) is how rig() counts what stays when the smooth body is on
export function hdParts(r, keep) {
  const m = mats(), on = (parent, geo, mat, name) => { const q = new THREE.Mesh(geo, mat); q.castShadow = true; parent.add(q); keep(q); r.parts.push(q); return q; };
  const Hd = r.head, Ch = r.chest, Tq = r.torso;
  on(Hd, headGeo(), m.head); on(Hd, hairGeo(), m.hair);
  { const b = ball(), L = []; for (const s of [-1, 1]) { L.push(put(b, s * 0.039, 0.0255, 0.0925, 0.024, 0.0042, 0.009, 0, 0, s * -0.24)); } on(Hd, merged(L), m.hair); const E = [], Ea = []; for (const s of [-1, 1]) { E.push(put(b, s * 0.039, 0.012, 0.0845, 0.0135, 0.0058, 0.006)); Ea.push(put(b, s * 0.091, -0.004, -0.008, 0.008, 0.024, 0.015)); } on(Hd, merged(E), (MT.white ??= STD('#c9c2b8', { roughness: 0.35 }))); on(Hd, merged(Ea), m.skin); b.dispose(); }
  if (r.eyes) for (const [i, e] of r.eyes.entries()) { const s = i ? 1 : -1; e.position.set(s * 0.039, 0.012, 0.0882); e.scale.set(0.0052, 0.0052, 0.0035); }
  // the high collar and the rolled red cloth over the shoulders
  on(Ch, put(tube(0.083, 0.112, 0.055, 18), 0, 0.272, -0.012, 1, 1, 0.92), m.boot); { const b = new THREE.SphereGeometry(1, 16, 10), L = [put(b, 0, 0.23, -0.1, 0.2, 0.075, 0.075)]; for (const s of [-1, 1]) L.push(put(b, s * 0.17, 0.235, -0.04, 0.11, 0.048, 0.1, 0, 0, s * -0.32)); on(Ch, merged(L), m.red); b.dispose(); }
  // the belt and its round buckle, on the waist
  { const band = put(tube(0.142, 0.149, 0.05, 28), 0, 0.012, 0, 1, 1, 0.68), rimB = put(tube(0.151, 0.151, 0.008, 28), 0, 0.04, 0, 1, 1, 0.68), rimA = put(tube(0.151, 0.151, 0.008, 28), 0, -0.016, 0, 1, 1, 0.68); on(Tq, merged([band, rimB, rimA]), m.bronze); const c0 = new THREE.CylinderGeometry(0.043, 0.047, 0.016, 20), c1 = new THREE.CylinderGeometry(0.027, 0.033, 0.008, 16), R0 = new THREE.TorusGeometry(0.044, 0.005, 6, 20); on(Tq, merged([put(c0, 0, 0.012, 0.105, 1, 1, 1, Math.PI / 2), put(c1, 0, 0.012, 0.117, 1, 1, 1, Math.PI / 2), put(R0, 0, 0.012, 0.114)]), m.bronze); c0.dispose(); c1.dispose(); R0.dispose(); }
  for (const A of r.arms) { const sx = A.sx, [g0, g1] = bracerGeo(sx); on(A.el, g0, m.steel); on(A.el, g1, m.bronze); on(A.wr, fistGeo(sx), m.skin); }
  for (const L of r.legs) { const [g0, g1] = greaveGeo(), [b0, b1] = bootGeo(); on(L.knee, g0, m.steel); on(L.knee, g1, m.bronze); if (L.ank) { on(L.ank, b0, m.boot); on(L.ank, b1, m.sole); } }
}

// ---------- the cape: crimson, heavy, torn at the hem
let CAPE = null;
export function hdCapeMat() {
  if (CAPE) return CAPE; const S = 512, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'); x.fillStyle = '#8e1426'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 26; i++) { const px = hash(i, 11) * S, w = 8 + hash(i, 12) * 40, gr = x.createLinearGradient(px - w, 0, px + w, 0), d = hash(i, 13) < 0.55; gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, d ? 'rgba(30,0,8,.34)' : 'rgba(255,70,80,.14)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(px - w, 0, w * 2, S); }
  for (let i = 0; i < 2600; i++) { x.fillStyle = hash(i, 14) < 0.5 ? 'rgba(0,0,0,.05)' : 'rgba(255,120,120,.035)'; x.fillRect(hash(i, 15) * S, hash(i, 16) * S, 1 + hash(i, 17) * 3, 4 + hash(i, 18) * 22); }
  const sh = x.createLinearGradient(0, 0, 0, S); sh.addColorStop(0, 'rgba(255,60,70,.16)'); sh.addColorStop(0.55, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(20,0,6,.38)'); x.fillStyle = sh; x.fillRect(0, 0, S, S);
  // the torn hem: cut away below a jagged line, a few holes above it
  x.globalCompositeOperation = 'destination-out'; x.beginPath(); x.moveTo(0, S); for (let i = 0; i <= 44; i++) { const px = i / 44 * S, big = vnoise(i / 6, 0, 9999, 9999, 5), sm = hash(i, 19); x.lineTo(px, S - (10 + big * 72 + sm * sm * 50)); } x.lineTo(S, S); x.closePath(); x.fill(); for (let i = 0; i < 9; i++) { x.beginPath(); x.ellipse(hash(i, 20) * S, S - 70 - hash(i, 21) * 80, 3 + hash(i, 22) * 7, 4 + hash(i, 23) * 12, hash(i, 24), 0, 6.3); x.fill(); } x.globalCompositeOperation = 'source-over';
  const T = new THREE.CanvasTexture(c); T.colorSpace = THREE.SRGBColorSpace; T.anisotropy = 4; CAPE = new THREE.MeshStandardMaterial({ map: T, side: THREE.DoubleSide, roughness: 0.86, alphaTest: 0.5 }); return CAPE;
}
