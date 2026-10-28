// The places in the world: the big city, and towns of different sizes and
// characters, each built by the same city generator with its own settings and
// seed. ?place=<key> picks one, else the last place you were (remembered), else
// the big city; the Travel row in the Sandbox's panel and Travel on the main menu
// go between them. Each has its own outline (shape, shapes.js): round, an L, a crossroads, a diamond, a crescent
// round a bay or a lake, a long strip, two neighbourhoods; the blocks outside it are open land.
export const PLACES = {
  metro: { name: 'Metro City', blurb: 'The big city: towers, a stadium, ten thousand people', shape: 'ragged' },
  harbor: { name: 'Harbor Town', blurb: 'A long seaside town of pastel and white, a domed town hall', blocks: 9, seed: 7171, maxFloors: 7, tall: 0.03, landmarks: ['dome'], centers: 1, diag: false, tint: { white: 14, pastel: 12 }, people: 0.38, cars: 0.35, land: 'coast', shape: 'long' },
  dust: { name: 'Dust Creek', blurb: 'A low desert town of sandstone and adobe', blocks: 7, seed: 4242, maxFloors: 4, tall: 0, landmarks: [], centers: 1, diag: false, tint: { sand: 30, white: 4 }, people: 0.26, cars: 0.24, land: 'desert', shape: 'diamond' },
  bayview: { name: 'Bayview', blurb: 'The second city: two downtowns of glass towers, a stadium', blocks: 11, seed: 3131, maxFloors: 14, tall: 0.1, landmarks: ['deco', 'stadium'], centers: 2, tint: { concrete: 4, white: 4, glass: 2 }, people: 0.7, cars: 0.7, land: 'coast', shape: 'twin' },
  lakeside: { name: 'Lakeside', blurb: 'A painted town curled round its lake', blocks: 7, seed: 5252, maxFloors: 5, tall: 0, landmarks: ['dome'], centers: 1, diag: false, tint: { pastel: 10, brick: 4 }, people: 0.26, cars: 0.24, land: 'forest', shape: 'crescent' },
  mesa: { name: 'Red Mesa', blurb: 'A round hamlet of red adobe out in the desert', blocks: 5, seed: 6363, maxFloors: 3, tall: 0, landmarks: [], centers: 1, diag: false, tint: { sand: 20, brown: 10 }, people: 0.14, cars: 0.12, land: 'desert', shape: 'round' },
  pines: { name: 'Pine Hollow', blurb: 'A small old brick town by the forest', blocks: 6, seed: 9090, maxFloors: 5, tall: 0, landmarks: [], centers: 1, diag: false, tint: { brick: 16, stone: 4, brown: 4 }, people: 0.2, cars: 0.18, land: 'forest', shape: 'ell' },
  crossing: { name: 'Cross Plains', blurb: 'A farm town where two highways cross', blocks: 7, seed: 1111, maxFloors: 4, tall: 0, landmarks: [], centers: 1, diag: false, tint: { white: 10, brick: 8, brown: 4 }, people: 0.24, cars: 0.22, shape: 'cross' },
  sunvale: { name: 'Sun Valley', blurb: 'A round desert town of white walls and a domed mission', blocks: 8, seed: 8282, maxFloors: 5, tall: 0, landmarks: ['dome'], centers: 1, diag: false, tint: { white: 14, sand: 12, pastel: 4 }, people: 0.32, cars: 0.3, land: 'desert', shape: 'round' },
  ironside: { name: 'Ironside', blurb: 'A brick and concrete mill town, smoke and rail yards', blocks: 9, seed: 4444, maxFloors: 8, tall: 0.04, landmarks: [], centers: 1, tint: { brick: 14, concrete: 8, dark: 3 }, people: 0.42, cars: 0.42, shape: 'ell' },
  northgate: { name: 'Northgate', blurb: 'A busy city in the hills, an Art Deco tower over it', blocks: 10, seed: 6060, maxFloors: 10, tall: 0.07, landmarks: ['deco'], centers: 1, tint: { stone: 8, concrete: 6, brick: 4 }, people: 0.55, cars: 0.55, land: 'forest', shape: 'diamond' },
};

// the road through the world in Commander and Be The Disaster: the smallest town first, up to the big city. Win in a
// place and the next one opens
export const PATH = ['mesa', 'pines', 'crossing', 'dust', 'lakeside', 'harbor', 'sunvale', 'ironside', 'northgate', 'bayview', 'metro'];

export function placeKey() {
  let k = new URLSearchParams(location.search).get('place');
  if (!k) try { k = localStorage.getItem('zday_place'); } catch (e) { /* no storage */ }
  return k && PLACES[k] ? k : 'metro';
}
// go to another place: the page is built again around it (in the mode given, or to the menu; more settings in extra)
export function travel(key, mode, extra) {
  try { localStorage.setItem('zday_place', key); } catch (e) { /* no storage */ }
  const P = new URLSearchParams(location.search); P.set('place', key); if (mode) P.set('mode', mode); else P.delete('mode');
  if (extra) for (const k in extra) P.set(k, extra[k]);
  location.search = P.toString();
}
