// Creature skin: rows of overlapping scales painted onto a canvas, used both as
// the colour map (light scale centres, dark edges) and as a bump map, so each
// scale catches the light. It tiles in both directions.
import * as THREE from 'three';

const cache = new Map();
// rows x cols scales per tile; repeat: how many tiles across a mesh's uv
export function scaleTexture(rows = 8, cols = 6, repeat = [1, 1]) {
  const key = rows + ',' + cols;
  let base = cache.get(key);
  if (!base) {
    const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
    x.fillStyle = '#4a4a4a'; x.fillRect(0, 0, S, S);
    const w = S / cols, h = S / rows;
    for (let r = -1; r <= rows; r++) { // top row first: each row overlaps the bottom of the one above, like shingles
      for (let k = -1; k <= cols; k++) {
        const cx = (k + (r & 1 ? 0.5 : 0)) * w, cy = (r + 0.5) * h, j = ((r * 7 + k * 13) % 5) * 4 - 8;
        const g = x.createRadialGradient(cx, cy - h * 0.35, h * 0.1, cx, cy, h * 1.05);
        g.addColorStop(0, 'rgb(' + (238 + j) + ',' + (238 + j) + ',' + (238 + j) + ')'); g.addColorStop(0.6, 'rgb(' + (190 + j) + ',' + (190 + j) + ',' + (190 + j) + ')'); g.addColorStop(1, 'rgb(96,96,96)');
        x.fillStyle = g; x.beginPath(); x.ellipse(cx, cy, w * 0.6, h * 0.95, 0, 0, Math.PI * 2); x.fill();
        x.strokeStyle = 'rgba(40,40,40,0.55)'; x.lineWidth = 1.5; x.beginPath(); x.ellipse(cx, cy, w * 0.6, h * 0.95, 0, 0.15 * Math.PI, 0.85 * Math.PI); x.stroke(); // the dark lower rim
      }
    }
    base = new THREE.CanvasTexture(c); base.wrapS = base.wrapT = THREE.RepeatWrapping; base.anisotropy = 4; cache.set(key, base);
  }
  const t = base.clone(); t.repeat.set(repeat[0], repeat[1]); t.needsUpdate = true;
  return t;
}
// a scaly material: the texture as colour (sRGB) and as a bump map
export function scaly(color, repeat, o = {}) {
  const map = scaleTexture(o.rows, o.cols, repeat); map.colorSpace = THREE.SRGBColorSpace;
  const bump = scaleTexture(o.rows, o.cols, repeat);
  return new THREE.MeshStandardMaterial({ color, map, bumpMap: bump, bumpScale: o.bump ?? 2.5, roughness: o.roughness ?? 0.7, metalness: 0.02, side: o.side ?? THREE.FrontSide });
}
