// The outline of a town: which blocks of its street grid are built on and which
// are open land (fields, woods, desert scrub, the roads running on through them).
// The city builder and the globe's little models both ask here, so a town looks
// the same shape from orbit as on the ground. Ragged at the edges, the same every
// time for a place (from its seed).
const hash = (a, b, c) => { let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ Math.imul(c, 1440670441); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// above 0 inside; u, v run -1..1 across the grid (u east, v south)
const SHAPES = {
  ragged: (u, v) => 0.98 - Math.max(Math.abs(u), Math.abs(v)), // a square with its edges bitten
  round: (u, v) => 1.02 - Math.hypot(u, v),
  diamond: (u, v) => 1.16 - (Math.abs(u) + Math.abs(v)),
  cross: (u, v) => Math.min(1.08 - Math.max(Math.abs(u), Math.abs(v)), Math.max(0.42 - Math.abs(u), 0.42 - Math.abs(v))), // two main streets crossing
  ell: (u, v) => Math.max(0.12 - u, v + 0.12), // an L: the north-east quarter left open
  crescent: (u, v) => Math.min(1.06 - Math.hypot(u, v), Math.hypot(u - 0.9, v + 0.05) - 0.78), // round a bay to the east
  long: (u, v) => Math.min(0.42 - Math.abs(v), 1.08 - Math.abs(u)), // a strip along the main road
  twin: (u, v) => Math.max(0.62 - Math.hypot(u + 0.46, v + 0.22), 0.62 - Math.hypot(u - 0.46, v - 0.22), Math.min(0.2 - Math.abs(v), 0.5 - Math.abs(u))), // two neighbourhoods and the road between
};
export const SHAPE_NAMES = Object.keys(SHAPES);

// (i, j) -> is that block built on. No shape: all of it
export function townMask(shape, NB, seed = 1) {
  const f = SHAPES[shape];
  if (!f) return () => true;
  const s = (seed | 0) + 911;
  return (i, j) => {
    const u = ((i + 0.5) / NB) * 2 - 1, v = ((j + 0.5) / NB) * 2 - 1;
    if (Math.abs(u) <= 1.01 / NB && Math.abs(v) <= 1.01 / NB) return true; // the middle always
    return f(u, v) + (hash(i, j, s) - 0.5) * 0.34 > 0;
  };
}
