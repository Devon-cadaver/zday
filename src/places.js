// The places in the world: the big city, and towns of different sizes and
// characters, each built by the same city generator with its own settings and
// seed. ?place=<key> picks one, else the last place you were (remembered), else
// the big city; the Travel row in the Sandbox's panel and Travel on the main menu
// go between them. Later these sit on the globe.
export const PLACES = {
  metro: { name: 'Metro City', blurb: 'The big city: towers, a stadium, ten thousand people' },
  harbor: { name: 'Harbor Town', blurb: 'A seaside town of pastel and white, a domed town hall', blocks: 7, seed: 7171, maxFloors: 7, tall: 0.03, landmarks: ['dome'], centers: 1, diag: false, tint: { white: 14, pastel: 12 }, people: 0.38, cars: 0.35, land: 'coast' },
  dust: { name: 'Dust Creek', blurb: 'A low desert town of sandstone and adobe', blocks: 6, seed: 4242, maxFloors: 4, tall: 0, landmarks: [], centers: 1, diag: false, tint: { sand: 30, white: 4 }, people: 0.26, cars: 0.24, land: 'desert' },
  bayview: { name: 'Bayview', blurb: 'The second city, on the bay: glass towers and a stadium', blocks: 10, seed: 3131, maxFloors: 14, tall: 0.1, landmarks: ['deco', 'stadium'], centers: 2, tint: { concrete: 4, white: 4, glass: 2 }, people: 0.7, cars: 0.7, land: 'coast' },
  lakeside: { name: 'Lakeside', blurb: 'A painted town of parks and pastel streets', blocks: 6, seed: 5252, maxFloors: 5, tall: 0, landmarks: ['dome'], centers: 1, diag: false, tint: { pastel: 10, brick: 4 }, people: 0.26, cars: 0.24, land: 'forest' },
  mesa: { name: 'Red Mesa', blurb: 'A hamlet of red adobe out in the desert', blocks: 4, seed: 6363, maxFloors: 3, tall: 0, landmarks: [], centers: 1, diag: false, tint: { sand: 20, brown: 10 }, people: 0.14, cars: 0.12, land: 'desert' },
  pines: { name: 'Pine Hollow', blurb: 'A small old brick town by the forest', blocks: 5, seed: 9090, maxFloors: 5, tall: 0, landmarks: [], centers: 1, diag: false, tint: { brick: 16, stone: 4, brown: 4 }, people: 0.2, cars: 0.18, land: 'forest' },
};

export function placeKey() {
  let k = new URLSearchParams(location.search).get('place');
  if (!k) try { k = localStorage.getItem('zday_place'); } catch (e) { /* no storage */ }
  return k && PLACES[k] ? k : 'metro';
}
// go to another place: the page is built again around it (in the mode given, or to the menu)
export function travel(key, mode) {
  try { localStorage.setItem('zday_place', key); } catch (e) { /* no storage */ }
  const P = new URLSearchParams(location.search); P.set('place', key); if (mode) P.set('mode', mode); else P.delete('mode');
  location.search = P.toString();
}
