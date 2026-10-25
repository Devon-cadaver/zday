// Procedural canvas textures: facades, shopfronts, roofs, ground.
// Textures are near-white so per-building vertex colours tint them.
import * as THREE from 'three';

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mk(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function addNoise(g, w, h, amt, r, tint = 0) {
  const img = g.getImageData(0, 0, w, h); const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * amt;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
    if (tint) { const k = (r() - 0.5) * tint; d[i] += k; d[i + 1] += k * 0.6; }
  }
  g.putImageData(img, 0, 0);
}

function blotches(g, w, h, r, count, rgb, amax, smin, smax) {
  for (let i = 0; i < count; i++) {
    const x = r() * w, y = r() * h, s = smin + r() * (smax - smin);
    const gr = g.createRadialGradient(x, y, 0, x, y, s);
    gr.addColorStop(0, 'rgba(' + rgb + ',' + (amax * r()) + ')');
    gr.addColorStop(1, 'rgba(' + rgb + ',0)');
    g.fillStyle = gr; g.fillRect(x - s, y - s, s * 2, s * 2);
  }
}

function streaks(g, w, h, r, count, alpha) {
  for (let i = 0; i < count; i++) {
    const x = r() * w, y = r() * h, ww = 1 + r() * 5, hh = 12 + r() * 90;
    const gr = g.createLinearGradient(0, y, 0, y + hh);
    gr.addColorStop(0, 'rgba(70,48,28,' + (alpha * r()) + ')');
    gr.addColorStop(1, 'rgba(70,48,28,0)');
    g.fillStyle = gr; g.fillRect(x, y, ww, hh);
  }
}

function finish(c, renderer) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  return t;
}

const pick = (r, a) => a[Math.floor(r() * a.length)];

function glass(g, x, y, w, h, r, mullion = true) {
  g.fillStyle = '#fbf6ec'; g.fillRect(x - 4, y - 4, w + 8, h + 8);
  const k = 26 + r() * 26;
  const gr = g.createLinearGradient(x, y, x + w * 0.6, y + h);
  const refl = r() < 0.25;
  gr.addColorStop(0, refl ? 'rgb(' + (k + 95) + ',' + (k + 85) + ',' + (k + 70) + ')' : 'rgb(' + (k + 34) + ',' + (k + 36) + ',' + (k + 40) + ')');
  gr.addColorStop(1, 'rgb(' + k + ',' + k + ',' + (k + 4) + ')');
  g.fillStyle = gr; g.fillRect(x, y, w, h);
  g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(x, y, w, 6);
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x, y, 5, h);
  if (mullion) { g.fillStyle = '#ddd5c6'; g.fillRect(x + w / 2 - 1.5, y, 3, h); g.fillRect(x, y + h * 0.38, w, 2); }
  g.fillStyle = '#fffaf0'; g.fillRect(x - 6, y + h + 3, w + 12, 4);
  g.fillStyle = 'rgba(50,30,12,0.35)'; g.fillRect(x - 6, y + h + 7, w + 12, 5);
}

function shutter(g, x, y, w, h, col) {
  g.fillStyle = '#fbf6ec'; g.fillRect(x - 4, y - 4, w + 8, h + 8);
  g.fillStyle = col; g.fillRect(x, y, w, h);
  g.fillStyle = 'rgba(0,0,0,0.22)';
  for (let k = 0; k < h; k += 5) g.fillRect(x, y + k, w, 2);
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x + w / 2 - 1, y, 2, h);
  g.fillStyle = '#fffaf0'; g.fillRect(x - 6, y + h + 3, w + 12, 4);
}

// 512x512 = 4 bays x 4 floors (each 3 m x 3 m), mapped at 12 m per repeat.
function facade(style, r) {
  const S = 512, C = 128; const [c, g] = mk(S, S);
  g.fillStyle = '#f3ece1'; g.fillRect(0, 0, S, S);
  addNoise(g, S, S, 16, r);
  blotches(g, S, S, r, 30, '120,90,60', 0.12, 20, 90);
  const shut = ['#8f6c4b', '#6f735e', '#a08d70', '#7c5944', '#cdbca2', '#5f6a6e'];
  for (let fy = 0; fy < 4; fy++) {
    const y = fy * C;
    if (style === 1) {
      const gy = y + 34, gh = 62;
      const gr = g.createLinearGradient(0, gy, 0, gy + gh);
      gr.addColorStop(0, '#5a5d63'); gr.addColorStop(1, '#2a2c30');
      g.fillStyle = gr; g.fillRect(0, gy, S, gh);
      g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, gy, S, 7);
      g.fillStyle = '#d9d2c4'; for (let x = 0; x < S; x += 32) g.fillRect(x, gy, 3, gh);
      g.fillStyle = '#fffaf0'; g.fillRect(0, gy + gh, S, 5);
      for (let bx = 0; bx < 16; bx++) if (r() < 0.15) { g.fillStyle = 'rgba(230,220,200,.75)'; g.fillRect(bx * 32 + 3, gy + 7, 29, gh * (0.3 + r() * 0.5)); }
    } else {
      for (let bx = 0; bx < 4; bx++) {
        const x = bx * C;
        if (style === 0) {
          const ww = 58, wh = 62, wx = x + (C - ww) / 2, wy = y + 30;
          if (r() < 0.24) shutter(g, wx, wy, ww, wh, pick(r, shut)); else glass(g, wx, wy, ww, wh, r);
          if (r() < 0.2) { g.fillStyle = '#d8d4cc'; g.fillRect(wx + ww - 26, wy + wh + 14, 22, 14); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(wx + ww - 26, wy + wh + 28, 22, 3); }
        } else if (style === 2) {
          const ww = 46, wh = 88, wx = x + (C - ww) / 2, wy = y + 22;
          if (r() < 0.2) shutter(g, wx, wy, ww, wh, pick(r, shut)); else glass(g, wx, wy, ww, wh, r);
          g.fillStyle = 'rgba(55,45,35,.75)';
          for (let k = 0; k < 4; k++) g.fillRect(wx - 8, wy + wh - 30 + k * 8, ww + 16, 2);
        } else {
          const ww = 44, wh = 70, wx = x + (C - ww) / 2, wy = y + 34;
          g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x + 2, y, 8, C);
          g.fillStyle = 'rgba(90,70,50,.18)'; g.fillRect(x + 10, y, 3, C);
          g.fillStyle = '#fbf6ec';
          g.beginPath(); g.moveTo(wx - 6, wy + wh + 4); g.lineTo(wx - 6, wy + 10); g.arc(wx + ww / 2, wy + 10, ww / 2 + 6, Math.PI, 0); g.lineTo(wx + ww + 6, wy + wh + 4); g.fill();
          const k = 30 + r() * 25;
          g.fillStyle = r() < 0.2 ? pick(r, shut) : 'rgb(' + (k + 20) + ',' + (k + 20) + ',' + (k + 24) + ')';
          g.beginPath(); g.moveTo(wx, wy + wh); g.lineTo(wx, wy + 10); g.arc(wx + ww / 2, wy + 10, ww / 2, Math.PI, 0); g.lineTo(wx + ww, wy + wh); g.fill();
          g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(wx, wy + 10, 4, wh - 10);
          g.fillStyle = '#fffaf0'; g.fillRect(wx - 9, wy + wh + 2, ww + 18, 6);
          g.fillStyle = 'rgba(50,30,12,.35)'; g.fillRect(wx - 9, wy + wh + 8, ww + 18, 5);
        }
      }
    }
    g.fillStyle = 'rgba(85,62,40,0.32)'; g.fillRect(0, y + C - 10, S, 4);
    g.fillStyle = 'rgba(255,255,255,0.38)'; g.fillRect(0, y + C - 6, S, 3);
  }
  streaks(g, S, S, r, 70, 0.22);
  return c;
}

// 1024x176 = 8 bays x ground floor (24 m x 4 m)
function shop(r) {
  const W = 1024, H = 176, B = 128; const [c, g] = mk(W, H);
  g.fillStyle = '#ece3d3'; g.fillRect(0, 0, W, H);
  addNoise(g, W, H, 16, r);
  const awn = ['#a8402f', '#2f6b4f', '#3f5f8a', '#c07a2a', '#7a3b5c', '#d8cdb5', '#8a8f3a'];
  let x = 0;
  while (x < W) {
    const bays = Math.min(1 + Math.floor(r() * 2), (W - x) / B);
    const w = bays * B, t = r();
    if (t < 0.68) {
      const gr = g.createLinearGradient(0, 60, 0, H);
      gr.addColorStop(0, '#4a4844'); gr.addColorStop(1, '#1d1c1b');
      g.fillStyle = gr; g.fillRect(x + 10, 62, w - 20, H - 74);
      g.fillStyle = 'rgba(230,215,190,.35)'; for (let k = x + 10; k < x + w - 10; k += 40) g.fillRect(k + 18, 70, 6 + r() * 10, 40 + r() * 50);
      g.fillStyle = '#d9d0bf'; for (let k = x + 10; k < x + w - 10; k += 64) g.fillRect(k, 62, 3, H - 74);
      g.fillStyle = r() < 0.5 ? '#2c2a28' : pick(r, awn); g.fillRect(x + 8, 30, w - 16, 26);
      g.fillStyle = 'rgba(255,245,220,.8)'; g.fillRect(x + 24, 38, (w - 48) * (0.3 + r() * 0.5), 9);
      if (r() < 0.55) {
        const ac = pick(r, awn);
        g.fillStyle = ac; g.beginPath(); g.moveTo(x + 6, 58); g.lineTo(x + w - 6, 58); g.lineTo(x + w + 4, 86); g.lineTo(x - 4, 86); g.fill();
        g.fillStyle = 'rgba(255,255,255,.35)'; for (let k = x + 6; k < x + w; k += 22) g.fillRect(k, 58, 10, 28);
        g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x - 4, 86, w + 8, 10);
      }
    } else if (t < 0.85) {
      g.fillStyle = '#2b2622'; g.fillRect(x + w / 2 - 26, 70, 52, H - 82);
      g.fillStyle = '#fbf6ec'; g.fillRect(x + w / 2 - 32, 64, 64, 6);
      glass(g, x + 16, 70, 30, 40, r, false); if (w > 140) glass(g, x + w - 46, 70, 30, 40, r, false);
    } else {
      g.fillStyle = '#9c968a'; g.fillRect(x + 10, 62, w - 20, H - 74);
      g.fillStyle = 'rgba(0,0,0,.18)'; for (let k = 62; k < H - 12; k += 6) g.fillRect(x + 10, k, w - 20, 2);
    }
    x += w;
  }
  g.fillStyle = 'rgba(70,50,30,.45)'; g.fillRect(0, H - 12, W, 12);
  g.fillStyle = 'rgba(255,255,255,.4)'; g.fillRect(0, 0, W, 6);
  g.fillStyle = 'rgba(80,60,40,.35)'; g.fillRect(0, 6, W, 4);
  streaks(g, W, H, r, 40, 0.18);
  return c;
}

function roof(r) {
  const S = 256; const [c, g] = mk(S, S);
  g.fillStyle = '#efe8dc'; g.fillRect(0, 0, S, S);
  addNoise(g, S, S, 30, r, 8);
  blotches(g, S, S, r, 26, '90,70,50', 0.28, 10, 50);
  blotches(g, S, S, r, 12, '255,250,240', 0.35, 8, 30);
  g.strokeStyle = 'rgba(80,60,45,.25)'; g.lineWidth = 1.5;
  for (let k = 0; k < S; k += 64) {
    g.beginPath(); g.moveTo(k + r() * 4, 0); g.lineTo(k + r() * 4, S); g.stroke();
    g.beginPath(); g.moveTo(0, k); g.lineTo(S, k + r() * 4); g.stroke();
  }
  return c;
}

function asphalt(r) {
  const S = 256; const [c, g] = mk(S, S);
  g.fillStyle = '#d9cfbf'; g.fillRect(0, 0, S, S);
  addNoise(g, S, S, 26, r, 6);
  blotches(g, S, S, r, 18, '110,90,70', 0.16, 12, 60);
  g.strokeStyle = 'rgba(90,70,55,.25)'; g.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    g.beginPath(); let x = r() * S, y = r() * S; g.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 30; y += (r() - 0.5) * 30; g.lineTo(x, y); }
    g.stroke();
  }
  return c;
}

function sidewalk(r) {
  const S = 256; const [c, g] = mk(S, S); // 4 m
  g.fillStyle = '#efe6d6'; g.fillRect(0, 0, S, S);
  addNoise(g, S, S, 18, r, 6);
  g.fillStyle = 'rgba(100,80,60,.22)';
  for (let k = 0; k < S; k += 32) { g.fillRect(k, 0, 1.5, S); g.fillRect(0, k, S, 1.5); }
  blotches(g, S, S, r, 10, '110,90,70', 0.15, 10, 40);
  return c;
}

function grass(r) {
  const S = 256; const [c, g] = mk(S, S);
  g.fillStyle = '#8c9452'; g.fillRect(0, 0, S, S);
  const img = g.getImageData(0, 0, S, S); const d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 50; d[i] += n * 0.8; d[i + 1] += n; d[i + 2] += n * 0.4; }
  g.putImageData(img, 0, 0);
  blotches(g, S, S, r, 20, '150,120,70', 0.4, 10, 40);
  blotches(g, S, S, r, 20, '50,70,30', 0.35, 8, 30);
  return c;
}

export function makeTextures(renderer, seed = 7) {
  const r = rng(seed);
  return {
    facades: [0, 1, 2, 3].map(s => finish(facade(s, r), renderer)),
    shop: finish(shop(r), renderer),
    roof: finish(roof(r), renderer),
    asphalt: finish(asphalt(r), renderer),
    sidewalk: finish(sidewalk(r), renderer),
    grass: finish(grass(r), renderer),
  };
}
