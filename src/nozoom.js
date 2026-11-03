// No zooming the page on a phone (Sean: two quick taps in the band game zoomed the whole page in; then, mashing a fight's
// circles with two thumbs, the page stuck at double zoom and even a refresh kept it: iPhone Safari remembers a page's zoom).
// iPhone Safari zooms on a double tap and on a pinch whatever the viewport tag says, so:
// - the second of two quick taps is cancelled before Safari sees it (its click sent by hand, so a button tapped twice works twice);
// - a pinch (two fingers) is cancelled while the page is not zoomed: Safari's own gesture events and a two-finger touchmove.
//   The game's own two-finger camera moves come through pointer events, which these don't touch;
// - a page zoomed anyway (visualViewport.scale over 1.05, on load or later) is set back by rewriting the viewport tag with a
//   changed maximum-scale, which Safari takes as a new zoom limit; if that fails, pinching is allowed again and a line at the
//   top says to pinch out. main.js sizes the picture by the layout viewport (not innerWidth, which shrinks when zoomed), so a
//   zoomed page shows part of a whole picture instead of a small one in the corner.
export function noZoom() {
  const vv = window.visualViewport, meta = document.querySelector('meta[name=viewport]');
  const zoomed = () => !!vv && vv.scale > 1.05;
  let sx = 0, sy = 0, st = 0, last = -1e9, lastDown = -1e9;
  // a touch's end goes to the thing touched. A band ball is gone from the page the moment it is hit, so its touchend never reached a listener on the window, and the second tap zoomed (Sean, 2026-11-03): listen on the thing itself too
  const onEnd = (e) => { if (e.zdSeen) return; e.zdSeen = true; ended(e); };
  const quickGame = (el) => el.closest && el.closest('#zd-band,#zd-fight') && !el.closest('.res,input,select,textarea');
  addEventListener('touchstart', (e) => { if (e.touches.length > 1) { if (!zoomed() && e.cancelable) e.preventDefault(); return; } const t = e.touches[0]; sx = t.clientX; sy = t.clientY; st = e.timeStamp; const el0 = e.target; if (el0 && el0.addEventListener) el0.addEventListener('touchend', onEnd, { passive: false, once: true }); if (e.timeStamp - lastDown < 450 && e.cancelable && !zoomed() && quickGame(el0)) e.preventDefault(); /* in the games, stopped at the second finger down as well: their taps are pointer events, which still come */ lastDown = e.timeStamp; }, { passive: false });
  addEventListener('touchmove', (e) => { if (e.touches.length > 1 && !zoomed() && e.cancelable) e.preventDefault(); }, { passive: false });
  const ended = (e) => {
    const t = e.changedTouches[0];
    const tap = e.touches.length === 0 && e.changedTouches.length === 1 && Math.hypot(t.clientX - sx, t.clientY - sy) < 14 && e.timeStamp - st < 500; // a tap, not a drag or a pinch
    if (!tap) return;
    const el = e.target, field = el.closest && el.closest('input,select,textarea');
    if (e.timeStamp - last < 450 && e.cancelable && !field) { e.preventDefault(); if (el.click) el.click(); } // the double tap: no zoom, the tap kept
    last = e.timeStamp;
  };
  addEventListener('touchend', onEnd, { passive: false });
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) addEventListener(ev, (e) => { if (!zoomed()) e.preventDefault(); }, { passive: false }); // Safari's pinch
  if (!vv || !meta) return;
  // zoomed in after all: back to 1. The game's touch-action:none also stopped the pinch out, so it is lifted while zoomed
  { const c = document.createElement('style'); c.textContent = 'html.zd-zoomed,html.zd-zoomed *{touch-action:pinch-zoom!important}'; document.head.appendChild(c); }
  const mark = () => document.documentElement.classList.toggle('zd-zoomed', zoomed());
  const fitHint = () => { if (!hint) return; hint.style.transformOrigin = '0 0'; hint.style.width = innerWidth + 'px'; hint.style.transform = 'translate(' + vv.offsetLeft + 'px,' + vv.offsetTop + 'px) scale(' + 1 / vv.scale + ')'; };
  const base = meta.content.replace(/,\s*maximum-scale=[^,]*/, ''); let tries = 0, hint = null;
  const reset = () => {
    mark(); if (!zoomed()) { if (hint) { hint.remove(); hint = null; } tries = 0; return; }
    if (!hint) { hint = document.createElement('div'); hint.textContent = 'Zoomed in: pinch out with two fingers'; hint.style.cssText = 'position:fixed;left:0;top:0;z-index:9999;padding:8px;box-sizing:border-box;text-align:center;background:#ff4fa3;color:#fff;font:700 14px system-ui,sans-serif;pointer-events:none'; document.body.appendChild(hint); } fitHint();
    if (tries++ < 3) { meta.content = base + ', maximum-scale=1.0' + (tries % 2 ? '1' : ''); setTimeout(() => { meta.content = base + ', maximum-scale=1'; setTimeout(reset, 250); }, 60); return; }
  };
  vv.addEventListener('resize', () => { mark(); if (zoomed()) { if (!tries) reset(); fitHint(); } else if (hint) { hint.remove(); hint = null; tries = 0; } });
  vv.addEventListener('scroll', fitHint);
  setTimeout(reset, 400);
}
