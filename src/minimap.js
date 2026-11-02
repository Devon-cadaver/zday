// A mini map (Sean: coming out of the base he could not tell where the town was): the town's bounds, the base, and a dot for where the
// view is (the hero on foot, the flight, or the orbit camera's target), top left under the bars. Hidden inside the base and in the menus.
export class MiniMap {
  constructor(g) { this.g = g; const c = this.c = document.createElement('canvas'); c.id = 'zd-minimap'; c.width = c.height = 192; c.style.cssText = 'position:fixed;left:12px;top:calc(104px + env(safe-area-inset-top));width:96px;height:96px;border-radius:14px;background:rgba(10,8,16,.55);box-shadow:0 2px 10px rgba(0,0,0,.4);pointer-events:none;z-index:29;display:none'; document.body.appendChild(c); this.t = 0; }
  update(dt) {
    const g = this.g; this.t -= dt; if (this.t > 0) return; this.t = 0.12;
    const B = g.city && g.city.bounds, base = g.base, show = !!B && !!g.mode && !(base && base.active) && !document.body.classList.contains('zd-menu-on') && !document.getElementById('zd-hub');
    this.c.style.display = show ? 'block' : 'none'; if (!show) return;
    const pad = 24, x0 = B.x0 - pad, z0 = B.z0 - pad, x1 = Math.max(B.x1, base && base.placed ? base.x + 20 : B.x1) + pad, z1 = B.z1 + pad, s = 192 / Math.max(x1 - x0, z1 - z0), ox = (192 - (x1 - x0) * s) / 2, oz = (192 - (z1 - z0) * s) / 2;
    const X = (x) => ox + (x - x0) * s, Z = (z) => oz + (z - z0) * s, k = this.c.getContext('2d'); k.clearRect(0, 0, 192, 192);
    k.fillStyle = 'rgba(120,112,100,.55)'; k.strokeStyle = 'rgba(255,255,255,.35)'; k.lineWidth = 2; k.beginPath(); k.rect(X(B.x0), Z(B.z0), (B.x1 - B.x0) * s, (B.z1 - B.z0) * s); k.fill(); k.stroke();
    const cx = X((B.x0 + B.x1) / 2), cz = Z((B.z0 + B.z1) / 2); k.strokeStyle = 'rgba(255,255,255,.18)'; k.lineWidth = 1; k.beginPath(); k.moveTo(X(B.x0), cz); k.lineTo(X(B.x1), cz); k.moveTo(cx, Z(B.z0)); k.lineTo(cx, Z(B.z1)); k.stroke();
    if (base && base.placed) { const bx = X(base.x), bz = Z(base.z); k.fillStyle = '#ffb060'; k.beginPath(); k.rect(bx - 6, bz - 3, 12, 9); k.fill(); k.beginPath(); k.moveTo(bx - 8, bz - 3); k.lineTo(bx, bz - 10); k.lineTo(bx + 8, bz - 3); k.closePath(); k.fill(); }
    const F = g.flight, H = g.horde, p = F && F.active ? F.pos : H && H.active ? H.h : g.controls && g.controls.target; if (p) { const px = X(p.x), pz = Z(p.z); k.fillStyle = '#ff3fcf'; k.beginPath(); k.arc(px, pz, 5, 0, 6.3); k.fill(); k.strokeStyle = '#fff'; k.lineWidth = 2; k.stroke(); }
    k.fillStyle = 'rgba(255,255,255,.7)'; k.font = '800 16px system-ui,sans-serif'; k.textAlign = 'center'; k.fillText('N', 96, 20);
  }
}
