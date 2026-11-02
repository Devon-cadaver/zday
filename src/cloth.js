// Cloth for the figures (HERO-PLAN 3e.4; Sean: the suits looked shiny and balloon-like). A woven bump map drawn once on a
// canvas (warp and weft threads, a little uneven) and a matte material that wears it: rough, no metal, the hero's glow kept
// but dimmer, so the suit catches the light like fabric. The smooth close-up body (villains.js smoothBody) copies the bump
// from the suit material, and its tints draw seams.
import * as THREE from 'three';

let weave = null;
export function weaveTexture(repeat = [1, 1]) {
  if (!weave) {
    const n = 256, c = document.createElement("canvas"); c.width = c.height = n; const x = c.getContext("2d"), img = x.createImageData(n, n), d = img.data;
    const T = 8; // threads: 32 across the tile
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const wx = (i % T) / T, wy = (j % T) / T, over = ((Math.floor(i / T) + Math.floor(j / T)) % 2) === 0; // which thread lies on top here
      const a = over ? Math.sin(wx * Math.PI) : Math.sin(wy * Math.PI), b = over ? Math.sin(wy * Math.PI) : Math.sin(wx * Math.PI); // the top thread's round, the one under showing at its edges
      const h = 0.55 * a + 0.25 * b + 0.2 * ((Math.sin(i * 0.37) * Math.cos(j * 0.23) + 1) * 0.5), v = Math.round(60 + 170 * Math.max(0, Math.min(1, h)));
      const o = (j * n + i) * 4; d[o] = d[o + 1] = d[o + 2] = v; d[o + 3] = 255;
    }
    x.putImageData(img, 0, 0); weave = new THREE.CanvasTexture(c); weave.wrapS = weave.wrapT = THREE.RepeatWrapping;
  }
  if (repeat[0] === 1 && repeat[1] === 1) return weave;
  const t = weave.clone(); t.repeat.set(repeat[0], repeat[1]); t.needsUpdate = true; return t;
}
// a matte woven material in a colour; o: emissive, emissiveIntensity, side, repeat (the weave's repeats across a 0..1 UV)
export function clothMat(hex, o = {}) {
  const m = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.92, metalness: 0, bumpMap: weaveTexture(o.repeat || [1, 1]), bumpScale: o.bumpScale ?? 0.22, side: o.side ?? THREE.FrontSide });
  if (o.emissive) { m.emissive = new THREE.Color(o.emissive); m.emissiveIntensity = o.emissiveIntensity ?? 0.2; }
  return m;
}
