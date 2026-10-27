// The places in the world: the big city, and towns of different sizes and
// characters, each built by the same city generator with its own settings and
// seed. ?place=<key> picks one, else the last place you were (remembered), else
// the big city; the Travel row in the Sandbox's panel and Travel on the main menu
// go between them. Later these sit on the globe.
export const PLACES = {
  metro: { name: 'Metro City', blurb: 'The big city: towers, a stadium, ten thousand people' },
  harbor: { name: 'Harbor Town', blurb: 'A seaside town of pastel and white, a domed town hall', blocks: 7, seed: 7171, maxFloors: 7, tall: 0.03, landmarks: ['dome'], centers: 1, diag: false, tint: { white: 14, pastel: 12 }, people: 0.38, cars: 0.35 },
  dust: { name: 'Dust Creek', blurb: 'A low desert town of sandstone and adobe', blocks: 6, seed: 4242, maxFloors: 4, tall: 0, landmarks: [], centers: 1, diag: false, tint: { sand: 30, white: 4 }, people: 0.26, cars: 0.24 },
  pines: { name: 'Pine Hollow', blurb: 'A small old brick town by the forest', blocks: 5, seed: 9090, maxFloors: 5, tall: 0, landmarks: [], centers: 1, diag: false, tint: { brick: 16, stone: 4, brown: 4 }, people: 0.2, cars: 0.18 },
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
