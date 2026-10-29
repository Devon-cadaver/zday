// No zooming the page on a phone (Sean: two quick taps in the band game zoomed the whole page in, menus and all, and it wouldn't
// zoom back out). iPhone Safari zooms on a double tap whatever the viewport tag says, so the second of two quick taps is cancelled
// before Safari sees it (its click is sent by hand, so a button tapped twice still works twice), and a page that got zoomed
// anyway is set back by rewriting the viewport tag.
export function noZoom() {
  let sx = 0, sy = 0, st = 0, last = -1e9;
  addEventListener('touchstart', (e) => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; st = e.timeStamp; }, { passive: true });
  addEventListener('touchend', (e) => {
    const t = e.changedTouches[0];
    const tap = e.touches.length === 0 && e.changedTouches.length === 1 && Math.hypot(t.clientX - sx, t.clientY - sy) < 14 && e.timeStamp - st < 500; // a tap, not a drag or a pinch
    if (!tap) return;
    const el = e.target, field = el.closest && el.closest('input,select,textarea');
    if (e.timeStamp - last < 450 && e.cancelable && !field) { e.preventDefault(); if (el.click) el.click(); } // the double tap: no zoom, the tap kept
    last = e.timeStamp;
  }, { passive: false });
  const vv = window.visualViewport, meta = document.querySelector('meta[name=viewport]');
  if (!vv || !meta) return;
  const base = meta.content; let flip = false;
  vv.addEventListener('resize', () => { if (vv.scale > 1.05) { flip = !flip; meta.content = base + (flip ? ', minimum-scale=1' : ''); } }); // zoomed in after all: back to 1
}
