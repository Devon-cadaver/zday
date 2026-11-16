// The armies the heroes fight on foot (Sean, 2026-11-16: "a few more armies that the heros can fight (similar to zombies, aliens, riots) ... Invading Armies, Robots (like terminators from the future),
// Orcs, Giants, Walking Trees/Forests. to mix up the battles", and to spill out of the Dimensional Rift). The pattern, from the aliens and the base's robots: an army's units are types in figures.js
// (army: its id), each drawn by a creature of its own (creaturekit.js BUILD); its level is HeroGame.armyLevel (the town's people hidden, their slots dropped again as its units, fought on foot: horde.js),
// its generals come for her one at a time (horde.js genRig, their look and name from here). The orcs are the first; the rest are added here.
import { armyMix } from './figures.js';

export const ARMIES = {
  orcs: {
    name: 'Orcs', label: 'ORCS', noun: ' orcs', threat: 'Orc horde', level: 'The orc horde', the: 'The horde', news: 'An orc horde storms', lost: 'The orcs overran you', lostTV: 'The orcs won', after: 'the orc warlords',
    toast: (n, town) => 'Defend ' + town + ': ' + n + ' orcs in the streets. Dash off their arrows, the brutes take four blows, their warlords come for you',
    shot: 'ARROW!', n: 150, more: 15, max: 220, winP: 0.62, color: '#5f8f2f',
    mix: armyMix('orcs', { orcGrunt: 6, orcArcher: 2, orcBrute: 1, wolfRider: 2, orcShaman: 1 }),
    general: { name: 'Orc warlord', an: 'An', hp: 440, dmgK: 0.9, look: { suit: '#5a4630', cape: '#7a1c16', dark: '#2a2018', belt: '#8a9098', skin: '#6f9a3c', eyec: '#ff4a22', beard: 'none', hair: 'bald', hg: 'spiked', back: 'none', chest: 'harness', sh: 'spike', arm: 'spike' } },
  },
};
export const ARMY_KINDS = Object.keys(ARMIES);
