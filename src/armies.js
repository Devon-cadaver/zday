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
    mix: armyMix('orcs', { orcGrunt: 18, orcArcher: 6, orcBrute: 3, wolfRider: 6, orcShaman: 3, orcChariot: 2 }), // two war chariots in 38
    general: { name: 'Orc warlord', an: 'An', hp: 440, dmgK: 0.9, look: { suit: '#5a4630', cape: '#7a1c16', dark: '#2a2018', belt: '#8a9098', skin: '#6f9a3c', eyec: '#ff4a22', beard: 'none', hair: 'bald', hg: 'spiked', back: 'none', chest: 'harness', sh: 'spike', arm: 'spike' } },
  },
  robots: {
    name: 'Robots', label: 'ROBOTS', noun: ' robots', threat: 'Robot army', level: 'The robot army', the: 'The machines', news: 'A robot army marches on', lost: 'The machines overran you', lostTV: 'The machines won', after: 'the Enforcers',
    toast: (n, town) => 'Defend ' + town + ': ' + n + ' robots in the streets. Dash off the red bolts, the assault bots take four blows, a titan many more, the Enforcers come for you',
    shot: 'SHOT!', shotCol: [1.7, 0.25, 0.15], n: 140, more: 15, max: 210, winP: 0.58, color: '#7c8794',
    mix: armyMix('robots', { combatBot: 18, assaultBot: 3, spiderBot: 6, sentryDrone: 6, titan: 1 }), // a titan: one in 34
    general: { name: 'Enforcer', an: 'An', hp: 460, dmgK: 0.95, look: { suit: '#3a4048', cape: '#20242a', dark: '#15181c', belt: '#ff3020', skin: '#aeb8c2', hairc: '#aeb8c2', eyec: '#ff2a1a', hair: 'bald', beard: 'none', hg: 'skull', back: 'none', chest: 'plate', sh: 'plate' } },
  },
  invaders: {
    name: 'Invading army', label: 'INVADERS', noun: ' soldiers', threat: 'Invading army', level: 'The invading army', the: 'The invaders', news: 'An invading army marches into', lost: 'The invaders overran you', lostTV: 'The invaders won', after: 'the Generals',
    toast: (n, town) => 'Defend ' + town + ': ' + n + ' soldiers in the streets. Dash off the energy bolts, the shield troopers take four blows, their walkers and tanks many more, their Generals come for you',
    shot: 'ZAPPED!', shotCol: [0.3, 0.9, 2.0], n: 150, more: 15, max: 220, winP: 0.6, color: '#3f6fb8',
    mix: armyMix('invaders', { invInfantry: 18, invShield: 3, invEnergy: 6, invScout: 6, invWalker: 2, invTank: 1, invTransport: 1, invDropship: 2, invArtillery: 1 }), // of 40: two walkers, a tank, a transport, two dropships, a gun
    general: { name: 'General', an: 'A', hp: 450, dmgK: 0.92, look: { suit: '#2f3d55', cape: '#b9a77a', dark: '#1c222c', belt: '#b9a77a', skin: '#c9a184', eyec: '#4ac8ff', hair: 'bald', beard: 'none', hg: 'skull', back: 'none', chest: 'plate', sh: 'plate' } },
  },
  trees: {
    name: 'Walking trees', label: 'TREES', noun: ' trees', threat: 'Walking forest', level: 'The walking forest', the: 'The forest', news: 'A walking forest marches on', lost: 'The forest overran you', lostTV: 'The forest won', after: 'the Ancient trees',
    toast: (n, town) => 'Defend ' + town + ': ' + n + ' walking trees in the streets. Dash off the green fire of the spirit trees, the forest golems take four blows, the Ancient trees come for you',
    shot: 'GREEN FIRE!', shotCol: [0.9, 2.0, 0.3], n: 150, more: 15, max: 220, winP: 0.6, color: '#2f8a3a',
    mix: armyMix('trees', { sapling: 5, treant: 3, rootWalker: 2, spiritTree: 2, forestGolem: 1 }),
    general: { name: 'Ancient tree', an: 'An', hp: 470, dmgK: 0.95, big: 1.35, look: { suit: '#5a4028', cape: '#3f7a2e', dark: '#2e2014', belt: '#5c7a2e', skin: '#7a5a36', eyec: '#ffb02a', hair: 'bald', beard: 'none', hg: 'spiked', back: 'none', chest: 'harness', sh: 'spike', arm: 'spike' } },
  },
  giants: {
    name: 'Giants', label: 'GIANTS', noun: ' giants', threat: 'Giants', level: 'The giants', the: 'The giants', news: 'Giants stride into', lost: 'The giants flattened you', lostTV: 'The giants won', after: 'the Giant kings',
    toast: (n, town) => 'Defend ' + town + ': ' + n + ' giants in the streets. Each one takes many blows, dash off the fire giants\' fireballs, the Giant kings come for you',
    shot: 'FIREBALL!', shotCol: [2.0, 0.7, 0.15], n: 30, more: 3, max: 48, tv: 34, camK: 1.4, winP: 0.55, color: '#b06a3a', // few and huge: tv is how many a show on television has (the other armies: 140)
    mix: armyMix('giants', { ogre: 4, stoneGiant: 2, frostGiant: 2, fireGiant: 2, mountainGiant: 1 }),
    general: { name: 'Giant king', an: 'A', hp: 520, dmgK: 1.05, big: 1.6, look: { suit: '#6b4a2c', cape: '#8a2a1a', dark: '#3a2c22', belt: '#c9a53a', skin: '#c98f6a', eyec: '#ffd24a', hair: 'bald', beard: 'none', hg: 'spiked', back: 'none', chest: 'harness', sh: 'spike', arm: 'spike' } },
  },
};
export const ARMY_KINDS = Object.keys(ARMIES);
