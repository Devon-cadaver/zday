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
  robots: {
    name: 'Robots', label: 'ROBOTS', noun: ' robots', threat: 'Robot army', level: 'The robot army', the: 'The machines', news: 'A robot army marches on', lost: 'The machines overran you', lostTV: 'The machines won', after: 'the Enforcers',
    toast: (n, town) => 'Defend ' + town + ': ' + n + ' robots in the streets. Dash off the red bolts, the assault bots take four blows, the Enforcers come for you',
    shot: 'SHOT!', shotCol: [1.7, 0.25, 0.15], n: 140, more: 15, max: 210, winP: 0.58, color: '#7c8794',
    mix: armyMix('robots', { combatBot: 6, assaultBot: 1, spiderBot: 2, sentryDrone: 2 }),
    general: { name: 'Enforcer', an: 'An', hp: 460, dmgK: 0.95, look: { suit: '#3a4048', cape: '#20242a', dark: '#15181c', belt: '#ff3020', skin: '#aeb8c2', hairc: '#aeb8c2', eyec: '#ff2a1a', hair: 'bald', beard: 'none', hg: 'skull', back: 'none', chest: 'plate', sh: 'plate' } },
  },
  invaders: {
    name: 'Invading army', label: 'INVADERS', noun: ' soldiers', threat: 'Invading army', level: 'The invading army', the: 'The invaders', news: 'An invading army marches into', lost: 'The invaders overran you', lostTV: 'The invaders won', after: 'the Generals',
    toast: (n, town) => 'Defend ' + town + ': ' + n + ' soldiers in the streets. Dash off the energy bolts, the shield troopers take four blows, their Generals come for you',
    shot: 'ZAPPED!', shotCol: [0.3, 0.9, 2.0], n: 150, more: 15, max: 220, winP: 0.6, color: '#3f6fb8',
    mix: armyMix('invaders', { invInfantry: 6, invShield: 1, invEnergy: 2, invScout: 2 }),
    general: { name: 'General', an: 'A', hp: 450, dmgK: 0.92, look: { suit: '#2f3d55', cape: '#b9a77a', dark: '#1c222c', belt: '#b9a77a', skin: '#c9a184', eyec: '#4ac8ff', hair: 'bald', beard: 'none', hg: 'skull', back: 'none', chest: 'plate', sh: 'plate' } },
  },
  trees: {
    name: 'Walking trees', label: 'TREES', noun: ' trees', threat: 'Walking forest', level: 'The walking forest', the: 'The forest', news: 'A walking forest marches on', lost: 'The forest overran you', lostTV: 'The forest won', after: 'the Ancient trees',
    toast: (n, town) => 'Defend ' + town + ': ' + n + ' walking trees in the streets. Dash off the green fire of the spirit trees, the forest golems take four blows, the Ancient trees come for you',
    shot: 'GREEN FIRE!', shotCol: [0.9, 2.0, 0.3], n: 150, more: 15, max: 220, winP: 0.6, color: '#2f8a3a',
    mix: armyMix('trees', { sapling: 5, treant: 3, rootWalker: 2, spiritTree: 2, forestGolem: 1 }),
    general: { name: 'Ancient tree', an: 'An', hp: 470, dmgK: 0.95, look: { suit: '#5a4028', cape: '#3f7a2e', dark: '#2e2014', belt: '#5c7a2e', skin: '#7a5a36', eyec: '#ffb02a', hair: 'bald', beard: 'none', hg: 'spiked', back: 'none', chest: 'harness', sh: 'spike', arm: 'spike' } },
  },
};
export const ARMY_KINDS = Object.keys(ARMIES);
