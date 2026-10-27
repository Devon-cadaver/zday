// Small pieces of interface shared by every screen: the column of round buttons down
// the right side (sound, music, the globe), and finger scrolling for rows and panels
// that are longer than the screen.
const CSS = `
#zd-side{position:fixed;right:max(10px, env(safe-area-inset-right));top:50%;transform:translateY(-50%);z-index:30;display:flex;flex-direction:column;gap:8px}
.zd-side-btn{width:40px;height:40px;border-radius:20px;border:1px solid rgba(255,236,200,.18);background:rgba(28,20,12,.72);color:#f6ead2;padding:0;cursor:pointer;
  font-size:16px;line-height:1;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);touch-action:manipulation}
.zd-side-btn:active{transform:translateY(1px)}
#zd-sound{order:1}#zd-music{order:2}#zd-globe{order:3}
body.zd-panel #zd-side{display:none}
body.zd-menu-on #zd-side{display:none}
body.zd-menu-on #zd-menu #zd-side{display:flex;position:static;transform:none;flex-direction:row}
#zd-menu #zd-globe{display:none}
body.zd-globe-on #zd-globe{display:none}
body.zd-globe-on #zd-side{top:calc(12px + env(safe-area-inset-top));transform:none}
`;
let side = null;
// a round button in the right-hand column
export function sideButton(id, title) {
  if (!side) {
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    side = document.createElement('div'); side.id = 'zd-side'; document.body.appendChild(side);
  }
  const b = document.createElement('button'); b.type = 'button'; b.id = id; b.title = title; b.className = 'zd-side-btn';
  b.setAttribute('aria-label', title); side.appendChild(b);
  return b;
}

// Drag a row (axis 'x') or a panel ('y') with a finger or the mouse, with a little glide after letting go. Done by hand
// rather than left to the browser, so it works the same on every phone; a drag never counts as a tap on the button it
// started on. Returns by(d): glide d pixels along (the arrows on a row)
export function dragScroll(el, axis = 'x') {
  el.style.touchAction = 'none';
  const X = axis === 'x', at = (e) => (X ? e.clientX : e.clientY);
  const get = () => (X ? el.scrollLeft : el.scrollTop), set = (s) => { if (X) el.scrollLeft = s; else el.scrollTop = s; };
  let id = null, start = 0, s0 = 0, last = 0, lastT = 0, v = 0, moved = false, raf = 0;
  const glide = () => {
    let t = performance.now();
    const step = () => { const now = performance.now(), dt = Math.min(40, now - t); t = now; v *= Math.pow(0.994, dt); if (Math.abs(v) < 0.02) return; const was = get(); set(was + v * dt); if (get() === was) return; raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
  };
  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    cancelAnimationFrame(raf); id = e.pointerId; start = last = at(e); s0 = get(); lastT = performance.now(); v = 0; moved = false;
  });
  el.addEventListener('pointermove', (e) => {
    if (e.pointerId !== id) return;
    const p = at(e), now = performance.now();
    if (!moved && Math.abs(p - start) > 8) { moved = true; try { el.setPointerCapture(id); } catch (er) { /* fine without */ } }
    if (!moved) return;
    set(s0 - (p - start));
    const dt = now - lastT; if (dt > 0) v = 0.7 * ((last - p) / dt) + 0.3 * v;
    last = p; lastT = now;
  });
  const up = (e) => { if (e.pointerId !== id) return; id = null; if (moved && performance.now() - lastT < 80) glide(); };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  el.addEventListener('click', (e) => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
  if (X) el.addEventListener('wheel', (e) => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { el.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
  return (d) => { cancelAnimationFrame(raf); const from = get(), to = from + d, t0 = performance.now(); const step = () => { const k = Math.min(1, (performance.now() - t0) / 260), e = 1 - Math.pow(1 - k, 3); set(from + (to - from) * e); if (k < 1) raf = requestAnimationFrame(step); }; raf = requestAnimationFrame(step); };
}
