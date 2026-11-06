// What opens in the wardrobe at which level (HERO-PLAN item 6, outfits for the three: unlocks with levels; Sean, 2026-11-06). The plain
// pieces from the start, the showier ones as a fighter levels up, to level 8. Each fighter by their own level. What one already wears stays on
// whatever its level (wardrobe.js shows it worn, the others locked with the level they open at). Colours, hair, body and skin are always free.
import { WARD } from './hdbody.js';
import { HEADGEAR } from './headgear.js';

export const UNLOCK = {
  face: { paint: 2, mask: 3, skull: 4, android: 6, robot: 8 },
  back: { torn: 2, jet: 3, feather: 4, bat: 5, insect: 6 },
  sh: { plate: 2, spike: 4 },
  chest: { harness: 2, plate: 3 },
  arm: { spike: 3 },
  hg: { goggles: 2, visor: 2, ninja: 2, fedora: 2, cowboy: 2, helmet: 3, tophat: 3, pirate: 3, mohawk: 3, viking: 4, tiara: 4, wizard: 4, antennae: 4, crown: 5, halo: 5, gasmask: 5, skull: 5, knight: 6, spiked: 6, horns: 6, space: 7, robot: 7, pumpkin: 8, pumpkin2: 8, pumpkin3: 8,
    // the lair's own
    demon: 2, ram: 3, antlers: 3, hoodskull: 4, reaper: 4, overlord: 5, demonface: 5, plague: 5, ironcrown: 6, ironmaw: 6, flameskull: 7, spikehalo: 8 },
};
export const unlockAt = (k, v) => (UNLOCK[k] && UNLOCK[k][v]) || 1;
const PART = { sh: { plate: 'Shoulder plates', spike: 'Spiked shoulders' }, arm: { spike: 'Spiked forearms' } }; // the same word on two parts, told apart
const NAME = (k, v) => (PART[k] && PART[k][v]) || (k === 'hg' ? (HEADGEAR.find((q) => q[0] === v) || [])[1] : ((WARD[k] || []).find((q) => q[0] === v) || [])[1]) || v;
const EVIL = new Set(HEADGEAR.filter((q) => q[4]).map((q) => q[0])); // the lair's own headgear, not offered to a hero
// what opens at the levels after `from` up to `to` (a level up's line: New in the wardrobe: ...); a hero is not told of the lair's headgear
export function opened(from, to, lair) { const out = []; for (const [k, m] of Object.entries(UNLOCK)) for (const [v, L] of Object.entries(m)) if (L > from && L <= to && (lair || k !== 'hg' || !EVIL.has(v))) out.push(NAME(k, v)); return out; }
