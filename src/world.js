// The connected world: what each place remembers (the buildings that came down
// there, so a town you come back to is as you left it), the craters meteors have
// left on the globe, and a meteor sent from orbit that is about to come down on
// a town. Kept in the browser between visits.
const KEY = 'zday_world';
let W = null;
function load() {
  if (W) return W;
  try { W = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { W = {}; }
  if (W.v !== 2) { W.places = {}; W.pending = {}; W.v = 2; } // version 2: the towns got their outlines (building numbers moved)
  W.places = W.places || {}; W.craters = W.craters || []; W.pending = W.pending || {};
  return W;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(load())); } catch (e) { /* no storage */ } }

// the buildings down in a place (indices into its city's buildings)
export function damageOf(key) { const p = load().places[key]; return p ? p.dead : []; }
export function rememberDamage(key, dead) {
  const w = load(), had = w.places[key] ? w.places[key].dead.length : 0;
  if (!dead.length && !had) return;
  w.places[key] = { dead, t: Date.now() }; save();
}
// craters on the globe: [lat, lon, size, when]; the last twenty
export function craters() { return load().craters; }
export function addCrater(lat, lon, size) { const w = load(); w.craters.push([lat, lon, size, Date.now()]); if (w.craters.length > 20) w.craters.shift(); save(); }
// a meteor on its way down on a place: where in it (metres from the middle) and how big
export function sendMeteor(key, m) { load().pending[key] = m; save(); }
export function takeMeteor(key) { const w = load(), m = w.pending[key]; if (m) { delete w.pending[key]; save(); } return m || null; }
