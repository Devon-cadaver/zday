// Creature hide and body. The skin is dark red flesh plated with green scales
// where a creature is armoured (back, outer limbs, top of the skull) and bare,
// creased and veined where it is soft (belly, throat, inner limbs). Both are
// painted procedurally into colour, normal and roughness maps, and a per-vertex
// value (aMask) blends from one to the other across the body.
// The body is a set of tubes swept through a rig's joints every frame, all in
// one mesh: a knee bends instead of meeting at a ball, and each limb's root is
// buried in the body it grows from. The large forms (muscle, ribs, brow, hunch)
// are in the tube profiles; the fine detail (scales, creases, veins, pores) can
// only be in the maps - a sculpted creature carries that in its mesh, which a
// procedural one built in the browser can't.
import * as THREE from 'three';

const N = 512, TAU = Math.PI * 2;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const sstep = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
function hash(x, y, s) { let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(s + 1, 1442695041); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
// value noise that repeats every px cells across and py cells down
export function vnoise(x, y, px, py, s) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const x0 = ((xi % px) + px) % px, y0 = ((yi % py) + py) % py, x1 = (x0 + 1) % px, y1 = (y0 + 1) % py;
  const a = hash(x0, y0, s), b = hash(x1, y0, s), c = hash(x0, y1, s), d = hash(x1, y1, s);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
// a tiling fractal noise field over the whole texture: base cells across, oct octaves
function field(base, oct, s) {
  const f = new Float32Array(N * N); let amp = 1, tot = 0;
  for (let o = 0; o < oct; o++) {
    const p = base << o, L = new Float32Array(p * p), cs = N / p;
    for (let i = 0; i < p * p; i++) L[i] = hash(i % p, (i / p) | 0, s + o * 31);
    for (let y = 0; y < N; y++) {
      const gy = y / cs, y0 = gy | 0, fy = gy - y0, uy = fy * fy * (3 - 2 * fy), r0 = y0 * p, r1 = ((y0 + 1) % p) * p;
      for (let x = 0; x < N; x++) {
        const gx = x / cs, x0 = gx | 0, fx = gx - x0, ux = fx * fx * (3 - 2 * fx), x1 = (x0 + 1) % p;
        const a = L[r0 + x0], b = L[r0 + x1], c = L[r1 + x0], d = L[r1 + x1];
        f[y * N + x] += amp * (a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy);
      }
    }
    tot += amp; amp *= 0.5;
  }
  for (let i = 0; i < f.length; i++) f[i] /= tot;
  return f;
}
// cells on a jittered grid (odd rows shifted half a cell, so they sit like scales); per pixel: distance to the nearest
// and second-nearest centre, which cell, and the offset from its centre
function cells(G, jit, s, stretch) {
  const ox = new Float32Array(G * G), oy = new Float32Array(G * G);
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) { const w = j * G + i; ox[w] = 0.5 + (j & 1 ? 0.5 : 0) + (hash(i, j, s) - 0.5) * jit; oy[w] = 0.5 + (hash(i, j, s + 7) - 0.5) * jit * 0.6; }
  const F1 = new Float32Array(N * N), F2 = new Float32Array(N * N), ID = new Int32Array(N * N), DY = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const px = x / N * G, py = y / N * G, ci = Math.floor(px), cj = Math.floor(py);
    let f1 = 9, f2 = 9, id = 0, dyy = 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -2; di <= 2; di++) {
      const cx = ci + di, cy = cj + dj, w = (((cy % G) + G) % G) * G + (((cx % G) + G) % G);
      const dx = px - (cx + ox[w]), dy = (py - (cy + oy[w])) * stretch, d = Math.sqrt(dx * dx + dy * dy);
      if (d < f1) { f2 = f1; f1 = d; id = w; dyy = dy; } else if (d < f2) f2 = d;
    }
    const k = y * N + x; F1[k] = f1; F2[k] = f2; ID[k] = id; DY[k] = dyy;
  }
  return { F1, F2, ID, DY };
}
function normalMap(H, k) {
  const out = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const l = H[y * N + ((x + N - 1) % N)], r = H[y * N + ((x + 1) % N)], d = H[((y + N - 1) % N) * N + x], u = H[((y + 1) % N) * N + x];
    let nx = (l - r) * k, ny = (d - u) * k; const inv = 1 / Math.sqrt(nx * nx + ny * ny + 1), i = (y * N + x) * 4;
    out[i] = (nx * inv * 0.5 + 0.5) * 255; out[i + 1] = (ny * inv * 0.5 + 0.5) * 255; out[i + 2] = (inv * 0.5 + 0.5) * 255; out[i + 3] = 255;
  }
  return out;
}
function tex(data, srgb) {
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true; return t;
}
const GREENS = [[40, 64, 34], [54, 70, 36], [30, 56, 44], [26, 40, 24], [46, 66, 30]];
let TEX = null;
export function hideTextures() {
  if (TEX) return TEX;
  const mot = field(4, 4, 11), mot2 = field(8, 3, 23), v1 = field(4, 4, 37), v2 = field(8, 3, 41), warp = field(4, 3, 53), fine = field(128, 1, 67);
  // the scale plates: domed, each rising towards its trailing edge so they lap like shingles; red flesh in the cracks between
  const G = 12, A = cells(G, 0.55, 5, 1.15), scol = new Uint8Array(N * N * 4), srgh = new Uint8Array(N * N * 4), sh = new Float32Array(N * N);
  for (let k = 0; k < N * N; k++) {
    const e = A.F2[k] - A.F1[k], gap = 1 - sstep(0.06, 0.19, e), dome = 1 - Math.min(1, A.F1[k] / 0.8) ** 2, sg = clamp01(0.5 + A.DY[k] * 0.6), id = A.ID[k];
    sh[k] = (0.35 + 0.4 * dome + 0.25 * sg) * (1 - gap) + 0.04 * fine[k];
    const g = GREENS[Math.floor(hash(id, 3, 9) * GREENS.length)], lit = (0.7 + 0.4 * dome) * (0.55 + 0.45 * sstep(0, 0.22, e)) * (0.76 + 0.48 * mot[k]) * (0.92 + 0.16 * fine[k]) * (0.85 + 0.3 * hash(id, 5, 2));
    const deep = 0.4 + 0.6 * sstep(0, 0.19, e), i = k * 4;
    scol[i] = g[0] * lit * (1 - gap) + 76 * deep * gap; scol[i + 1] = g[1] * lit * (1 - gap) + 13 * deep * gap; scol[i + 2] = g[2] * lit * (1 - gap) + 15 * deep * gap; scol[i + 3] = 255;
    srgh[i + 1] = 255 * ((0.62 - 0.16 * dome + 0.12 * (mot2[k] - 0.5)) * (1 - gap) + 0.36 * gap); srgh[i + 3] = 255;
  }
  // the bare flesh: mottled and bruised, veined, creased across, with a scattering of small scales
  const B = cells(24, 0.7, 13, 1), fcol = new Uint8Array(N * N * 4), frgh = new Uint8Array(N * N * 4), fh = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const k = y * N + x, m = mot[k], br = sstep(0.55, 0.78, mot2[k]);
    const vein = Math.max(1 - sstep(0.004, 0.02, Math.abs(v1[k] - 0.5)), 0.7 * (1 - sstep(0.003, 0.012, Math.abs(v2[k] - 0.5))));
    const crease = sstep(0.8, 0.97, 0.5 + 0.5 * Math.sin((y / N * 18 + warp[k] * 3) * TAU));
    const small = hash(B.ID[k], 1, 4) < 0.24 ? 1 - sstep(0.3, 0.42, B.F1[k]) : 0, d2 = 1 - Math.min(1, B.F1[k] / 0.42) ** 2;
    let r = 92 + (130 - 92) * sstep(0.35, 0.75, m), g = 18 + (38 - 18) * sstep(0.35, 0.75, m), b = 20 + (34 - 20) * sstep(0.35, 0.75, m);
    r += (50 - r) * br * 0.75; g += (12 - g) * br * 0.75; b += (26 - b) * br * 0.75;
    r += (48 - r) * vein * 0.8; g += (10 - g) * vein * 0.8; b += (32 - b) * vein * 0.8;
    const c = (1 - 0.4 * crease) * (0.9 + 0.12 * fine[k]);
    r *= c; g *= c; b *= c;
    const sl = 0.8 + 0.35 * d2; r += (50 * sl - r) * small; g += (74 * sl - g) * small; b += (40 * sl - b) * small;
    const i = k * 4; fcol[i] = r; fcol[i + 1] = g; fcol[i + 2] = b; fcol[i + 3] = 255;
    fh[k] = 0.5 + 0.12 * m + 0.3 * vein - 0.4 * crease + 0.25 * d2 * small + 0.05 * fine[k];
    frgh[i + 1] = 255 * clamp01(0.56 + 0.16 * (m - 0.5) - 0.14 * vein + 0.12 * crease - 0.06 * small); frgh[i + 3] = 255;
  }
  TEX = { scaleCol: tex(scol, true), scaleNrm: tex(normalMap(sh, 7), false), scaleRgh: tex(srgh, false), fleshCol: tex(fcol, true), fleshNrm: tex(normalMap(fh, 5), false), fleshRgh: tex(frgh, false) };
  return TEX;
}
// the hide material: scales where aMask is 1, flesh where it is 0; vertex colours for creases and claws; a rim of
// red light at the silhouette, scaled by the ambient light, standing in for light scattering through the skin
export function hideMaterial(o = {}) {
  const T = hideTextures();
  const m = new THREE.MeshStandardMaterial({ map: T.scaleCol, normalMap: T.scaleNrm, roughnessMap: T.scaleRgh, roughness: 1, metalness: 0, vertexColors: true, normalScale: new THREE.Vector2(o.normal ?? 1.3, o.normal ?? 1.3) });
  const rim = { value: new THREE.Color(...(o.rim ?? [0.07, 0.012, 0.01])) };
  const nm = THREE.ShaderChunk.normal_fragment_maps.replace('vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;', 'vec3 mapN = mix( texture2D( fleshNrm, vNormalMapUv ).xyz, texture2D( normalMap, vNormalMapUv ).xyz, vMask ) * 2.0 - 1.0;');
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { fleshMap: { value: T.fleshCol }, fleshNrm: { value: T.fleshNrm }, fleshRgh: { value: T.fleshRgh }, rimCol: rim });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aMask;\nvarying float vMask;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvMask = aMask;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D fleshMap;\nuniform sampler2D fleshNrm;\nuniform sampler2D fleshRgh;\nuniform vec3 rimCol;\nvarying float vMask;')
      .replace('#include <map_fragment>', 'diffuseColor *= mix( texture2D( fleshMap, vMapUv ), texture2D( map, vMapUv ), vMask );')
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = roughness * mix( texture2D( fleshRgh, vRoughnessMapUv ).g, texture2D( roughnessMap, vRoughnessMapUv ).g, vMask );')
      .replace('#include <normal_fragment_maps>', nm)
      .replace('#include <opaque_fragment>', 'float rimF = pow( 1.0 - saturate( dot( normal, normalize( vViewPosition ) ) ), 3.0 );\n' +
        'float ambL = dot( reflectedLight.indirectDiffuse, vec3( 0.299, 0.587, 0.114 ) ) / max( dot( diffuseColor.rgb, vec3( 0.299, 0.587, 0.114 ) ), 0.03 );\n' +
        'outgoingLight += rimCol * rimF * min( ambL, 3.0 );\n#include <opaque_fragment>');
  };
  m.customProgramCacheKey = () => 'hide-1';
  m.userData.rim = rim;
  return m;
}

// One mesh holding many tubes. Add the tubes, build(), then each frame set each tube's control points (tube.P,
// in the mesh's space) and its up direction (tube.ref), call tube.update(t) on each and commit().
export class Body {
  constructor(mat) { this.mat = mat; this.tubes = []; this.nv = 0; this.ni = 0; }
  add(o) { const t = new Tube(this, o); this.tubes.push(t); return t; }
  build(center = [0, 30, 0], radius = 90) {
    const nv = this.nv, g = new THREE.BufferGeometry();
    this.pos = new Float32Array(nv * 3); this.nrm = new Float32Array(nv * 3);
    const uv = new Float32Array(nv * 2), col = new Float32Array(nv * 3), msk = new Float32Array(nv), idx = new (nv > 65535 ? Uint32Array : Uint16Array)(this.ni);
    for (const t of this.tubes) t.init(uv, col, msk, idx);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('normal', new THREE.BufferAttribute(this.nrm, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('aMask', new THREE.BufferAttribute(msk, 1));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(...center), radius); // set by hand: the shape changes every frame
    this.geo = g; this.mesh = new THREE.Mesh(g, this.mat); this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    return this.mesh;
  }
  commit() { this.geo.attributes.position.needsUpdate = true; this.geo.attributes.normal.needsUpdate = true; }
}

// A tube: o.radii (one per control point), o.bulge (one per span: muscle swelling through its middle), o.rings
// along it, o.cols around, o.len (its rough length, for the texture), o.shape(u, c, s) (how far out each point of the
// cross-section sits: c, s are the cosine and sine round from the up side), o.mask(u, c, s) (1 scales, 0 flesh),
// o.tint(u, c, s) (vertex colour), o.mul(jc, t) (a radius multiplier over time; jc runs 0..points-1 along it),
// o.capStart / o.capEnd (rounded closed ends), o.pt (carry the up direction down the tube rather than re-aim it at
// tube.ref at every ring - for tentacles and fingers, which can point anywhere).
class Tube {
  constructor(body, o) {
    this.o = o; this.body = body; this.R = o.rings; this.C = o.cols; this.n = o.radii.length; this.S = 6;
    this.off = body.nv; this.ioff = body.ni; body.nv += this.R * (this.C + 1); body.ni += (this.R - 1) * this.C * 6;
    const nd = (this.n - 1) * this.S + 1; this.d = new Float32Array(nd * 3); this.cum = new Float32Array(nd);
    this.c = new Float32Array(this.R * 3); this.t = new Float32Array(this.R * 3); this.rad = new Float32Array(this.R);
    this.shape = new Float32Array(this.R * (this.C + 1)); this.cs = new Float32Array(this.C + 1); this.sn = new Float32Array(this.C + 1);
    this.P = Array.from({ length: this.n }, () => new THREE.Vector3()); this.ref = new THREE.Vector3(0, 1, 0);
  }
  init(uv, col, msk, idx) {
    const { R, C, o, off } = this, rm = o.radii.reduce((a, b) => a + b, 0) / this.n, circ = TAU * Math.max(0.2, rm), rep = Math.max(1, Math.round(circ / (o.tile ?? 11))), tl = circ / rep, seed = o.seed ?? 1;
    for (let j = 0; j <= C; j++) { this.cs[j] = Math.cos(j / C * TAU); this.sn[j] = Math.sin(j / C * TAU); }
    for (let k = 0; k < R; k++) {
      const u = k / (R - 1);
      for (let j = 0; j <= C; j++) {
        const v = off + k * (C + 1) + j, c = this.cs[j], s = this.sn[j], nz = vnoise(u * (o.len / 2.5), (j % C) / C * 6, 9999, 6, seed);
        uv[v * 2] = j / C * rep; uv[v * 2 + 1] = u * o.len / tl;
        this.shape[k * (C + 1) + j] = (o.shape ? o.shape(u, c, s) : 1) * (1 + (o.lumps ?? 0.05) * (nz - 0.5) * 2);
        msk[v] = o.mask ? o.mask(u, c, s, nz) : sstep(-0.35, 0.4, c + 0.5 * (nz - 0.5));
        const tn = o.tint ? o.tint(u, c, s) : null, ao = o.ao ? 0.5 + 0.5 * sstep(o.ao[0], o.ao[1], u) : 1;
        col[v * 3] = (tn ? tn[0] : 1) * ao; col[v * 3 + 1] = (tn ? tn[1] : 1) * ao; col[v * 3 + 2] = (tn ? tn[2] : 1) * ao;
      }
    }
    let q = this.ioff;
    for (let k = 0; k < R - 1; k++) for (let j = 0; j < C; j++) { const a = off + k * (C + 1) + j, b = a + C + 1; idx[q++] = a; idx[q++] = a + 1; idx[q++] = b; idx[q++] = a + 1; idx[q++] = b + 1; idx[q++] = b; }
  }
  update(time = 0) {
    const { R, C, S, n, P, d, cum, c, t, rad, o, off, shape, cs, sn } = this, pos = this.body.pos, nrm = this.body.nrm, radii = o.radii;
    // a smooth curve through the control points (Catmull-Rom), finely sampled
    let m = 0;
    for (let i = 0; i < n - 1; i++) {
      const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(n - 1, i + 2)];
      for (let s = 0; s < S; s++, m++) {
        const u = s / S, u2 = u * u, u3 = u2 * u;
        d[m * 3] = 0.5 * (2 * p1.x + (p2.x - p0.x) * u + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * u2 + (3 * p1.x - p0.x - 3 * p2.x + p3.x) * u3);
        d[m * 3 + 1] = 0.5 * (2 * p1.y + (p2.y - p0.y) * u + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * u2 + (3 * p1.y - p0.y - 3 * p2.y + p3.y) * u3);
        d[m * 3 + 2] = 0.5 * (2 * p1.z + (p2.z - p0.z) * u + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * u2 + (3 * p1.z - p0.z - 3 * p2.z + p3.z) * u3);
      }
    }
    d[m * 3] = P[n - 1].x; d[m * 3 + 1] = P[n - 1].y; d[m * 3 + 2] = P[n - 1].z;
    const nd = m + 1; cum[0] = 0;
    for (let i = 1; i < nd; i++) cum[i] = cum[i - 1] + Math.hypot(d[i * 3] - d[i * 3 - 3], d[i * 3 + 1] - d[i * 3 - 2], d[i * 3 + 2] - d[i * 3 - 1]);
    const L = cum[nd - 1] || 1e-3, cl0 = radii[0] * 0.9, cl1 = Math.max(radii[n - 1], 0.05);
    // rings evenly spaced along it, each with its radius
    let q = 0;
    for (let k = 0; k < R; k++) {
      const s = k / (R - 1) * L;
      while (q < nd - 2 && cum[q + 1] < s) q++;
      const f = clamp01((s - cum[q]) / ((cum[q + 1] - cum[q]) || 1));
      for (let a = 0; a < 3; a++) c[k * 3 + a] = d[q * 3 + a] + (d[q * 3 + 3 + a] - d[q * 3 + a]) * f;
      const jc = (q + f) / S, si = Math.min(n - 2, Math.floor(jc)), fr = jc - si, sm = fr * fr * (3 - 2 * fr);
      let r = radii[si] + (radii[si + 1] - radii[si]) * sm + (o.bulge ? o.bulge[si] * Math.sin(Math.PI * Math.min(1, fr)) : 0);
      if (o.mul) r *= o.mul(jc, time);
      if (o.capStart && s < cl0) r *= Math.sqrt(Math.max(0, 1 - (1 - s / cl0) ** 2));
      if (o.capEnd && L - s < cl1) r *= Math.sqrt(Math.max(0, 1 - (1 - (L - s) / cl1) ** 2));
      rad[k] = r;
    }
    // tangents, and the frame round each ring: up (N) towards tube.ref, or carried down from the ring before
    let nx = 0, ny = 1, nz = 0;
    for (let k = 0; k < R; k++) {
      const k0 = Math.max(0, k - 1), k1 = Math.min(R - 1, k + 1);
      let tx = c[k1 * 3] - c[k0 * 3], ty = c[k1 * 3 + 1] - c[k0 * 3 + 1], tz = c[k1 * 3 + 2] - c[k0 * 3 + 2]; const tl = Math.hypot(tx, ty, tz) || 1;
      tx /= tl; ty /= tl; tz /= tl; t[k * 3] = tx; t[k * 3 + 1] = ty; t[k * 3 + 2] = tz;
      let ax = nx, ay = ny, az = nz;
      if (k === 0 || !o.pt) { const rr = this.ref, dt = rr.x * tx + rr.y * ty + rr.z * tz, px = rr.x - dt * tx, py = rr.y - dt * ty, pz = rr.z - dt * tz, pl = Math.hypot(px, py, pz); if (pl > 0.25 || k === 0) { ax = px; ay = py; az = pz; if (pl < 1e-4) { ax = -tz; ay = 0; az = tx; if (Math.abs(tx) + Math.abs(tz) < 1e-4) { ax = 1; az = 0; } } } }
      const dt = ax * tx + ay * ty + az * tz; ax -= dt * tx; ay -= dt * ty; az -= dt * tz; const al = Math.hypot(ax, ay, az) || 1;
      nx = ax / al; ny = ay / al; nz = az / al;
      const bx = ty * nz - tz * ny, by = tz * nx - tx * nz, bz = tx * ny - ty * nx;
      for (let j = 0; j <= C; j++) {
        const v = (off + k * (C + 1) + j) * 3, rr = rad[k] * shape[k * (C + 1) + j], ex = cs[j] * nx + sn[j] * bx, ey = cs[j] * ny + sn[j] * by, ez = cs[j] * nz + sn[j] * bz;
        pos[v] = c[k * 3] + ex * rr; pos[v + 1] = c[k * 3 + 1] + ey * rr; pos[v + 2] = c[k * 3 + 2] + ez * rr;
      }
    }
    // normals from the surface itself: across the ring cross along the tube
    const W = C + 1;
    for (let k = 0; k < R; k++) {
      const k0 = Math.max(0, k - 1), k1 = Math.min(R - 1, k + 1);
      for (let j = 0; j < C; j++) {
        const a = (off + k1 * W + j) * 3, b = (off + k0 * W + j) * 3, l = (off + k * W + (j + 1) % C) * 3, r = (off + k * W + (j + C - 1) % C) * 3;
        const ux = pos[a] - pos[b], uy = pos[a + 1] - pos[b + 1], uz = pos[a + 2] - pos[b + 2], wx = pos[l] - pos[r], wy = pos[l + 1] - pos[r + 1], wz = pos[l + 2] - pos[r + 2];
        let x = wy * uz - wz * uy, y = wz * ux - wx * uz, z = wx * uy - wy * ux, ln = Math.hypot(x, y, z);
        if (ln < 1e-9) { const sg = k < R / 2 ? -1 : 1; x = t[k * 3] * sg; y = t[k * 3 + 1] * sg; z = t[k * 3 + 2] * sg; ln = 1; }
        const v = (off + k * W + j) * 3, v2 = (off + k * W + C) * 3;
        nrm[v] = x / ln; nrm[v + 1] = y / ln; nrm[v + 2] = z / ln;
        if (j === 0) { nrm[v2] = nrm[v]; nrm[v2 + 1] = nrm[v + 1]; nrm[v2 + 2] = nrm[v + 2]; }
      }
    }
  }
}
