// The world's trouble in story mode (Sean): you pick Defend or Destroy, the globe comes up with the disasters hitting cities, and you play the one you like.
// One board per side, kept on the device (zday_threats). Always (Sean, 2026-11-03): 1 city with villains, 1 with aliens, 2 with the worm, 2 with weather, and
// 1 or 2 with a rotating disaster, until a good flow is found (SLOTS is the place to change it). A win clears the city and the same kind of trouble hits
// somewhere else; a loss leaves it there to retry. After every level one rotating disaster moves on too, so there is always something new on the map.
// Danger goes with your level, a little more in the bigger towns. The Sandbox's numbered test levels do not use any of this.
import { PATH, PLACES } from './places.js';

const KEY = 'zday_threats';
export const SLOTS = { villains: 1, aliens: 1, worm: 2, weather: 2 };
const WEATHER = ['tornado', 'flood', 'haboob', 'tsunami', 'coldwave'], RANDOM = ['zombies', 'kaiju', 'riot', 'quake', 'plant', 'volcano', 'rift', 'sinkhole', 'blackhole', 'spill'];
const COAST = ['harbor', 'bayview', 'umihama', 'minato', 'metro', 'lakeside']; // where the sea can come in
const NEEDS = { tsunami: COAST };
export const VILLAIN_IDS = ['blur', 'tyrant', 'weaver'];
export const KIND_NAME = { villains: 'Villains', aliens: 'Alien invasion', worm: 'Giant worm', tornado: 'Tornado', flood: 'Flood', haboob: 'Dust storm', tsunami: 'Tsunami', coldwave: 'Cold wave', zombies: 'Zombies', kaiju: 'Kaiju', riot: 'Riot', quake: 'Earthquake', plant: 'Killer plant', volcano: 'Volcano', rift: 'Rift', sinkhole: 'Sinkhole', blackhole: 'Black hole', spill: 'Toxic spill' };
const rnd = (a) => a[Math.floor(Math.random() * a.length)];
let boards = null;
const load = () => { if (boards) return boards; try { boards = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { boards = null; } return (boards = boards && typeof boards === 'object' ? boards : {}); };
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(boards)); } catch (e) { /* no storage: the board lasts as long as the page */ } };
function freeCity(B, kind, not) { const taken = B.list.map((t) => t.key), want = NEEDS[kind] || PATH, open = want.filter((k) => !taken.includes(k) && k !== not && PLACES[k]); return open.length ? rnd(open) : null; }
function add(B, slot, kind, o) { const key = freeCity(B, kind, B.avoid); if (!key) return null; const t = { id: ++B.n, key, slot, kind, ...o }; B.list.push(t); B.fresh.push(t.id); return t; }
// a kind not played just now and not on the board already, if there is one
function pick(B, pool) { const on = B.list.map((t) => t.kind), a = pool.filter((k) => !on.includes(k) && !B.recent.includes(k)), b = pool.filter((k) => !on.includes(k)); return rnd(a.length ? a : b.length ? b : pool); }
// each slot made up to its number. villainsLeft: who is still a villain, for Defend; Destroy's villains slot is the heroes standing guard
function fill(B, side, villainsLeft) {
  const count = (s) => B.list.filter((t) => t.slot === s).length;
  while (count('villains') < SLOTS.villains) { const v = side === 'hero' ? rnd(villainsLeft) : null; if (side === 'hero' && !v) { if (!add(B, 'villains', 'kaiju')) break; continue; } if (!add(B, 'villains', 'villains', v ? { v } : {})) break; }
  while (count('aliens') < SLOTS.aliens) if (!add(B, 'aliens', 'aliens')) break;
  while (count('worm') < SLOTS.worm) if (!add(B, 'worm', 'worm')) break;
  while (count('weather') < SLOTS.weather) if (!add(B, 'weather', pick(B, WEATHER))) break;
  while (count('random') < B.randomN) if (!add(B, 'random', pick(B, RANDOM))) break;
}
export function board(side, villainsLeft = []) {
  const all = load(); if (all[side] && !Array.isArray(all[side].list)) delete all[side];
  const B = all[side] || (all[side] = { list: [], fresh: [], recent: [], n: 0, randomN: 1 + Math.floor(Math.random() * 2), cur: null });
  B.fresh = B.fresh || []; B.recent = B.recent || []; B.n = B.n || 1000; B.randomN = B.randomN || 1; B.list = B.list.filter((t) => t && PLACES[t.key] && KIND_NAME[t.kind]);
  B.list = B.list.filter((t) => t.slot !== 'villains' || t.kind !== 'villains' || side !== 'hero' || villainsLeft.includes(t.v)); // a villain who has crossed over is not attacking anyone
  fill(B, side, villainsLeft); save(); return B;
}
export const current = (side) => { const B = load()[side]; return B ? B.list.find((t) => t.id === B.cur) || null : null; };
export const setCurrent = (side, id) => { load()[side].cur = id; save(); };
export const clearFresh = (side) => { const B = load()[side]; if (B) { B.fresh = []; save(); } };
export const freshOnes = (side) => { const B = load()[side]; return B ? B.list.filter((t) => B.fresh.includes(t.id)) : []; };
// a level over: won, that city is clear and the trouble moves on; one rotating disaster moves on as well. What is new is what the map station flashes for
export function resolve(side, id, won, villainsLeft = []) {
  const B = board(side, villainsLeft), t = B.list.find((q) => q.id === id); B.cur = null; if (t) { B.recent = [t.kind, ...B.recent].slice(0, 3); if (won) B.list.splice(B.list.indexOf(t), 1); }
  const rot = B.list.filter((q) => q.slot === 'random' && q !== t).sort((a, b) => a.id - b.id)[0]; if (rot) B.list.splice(B.list.indexOf(rot), 1);
  B.randomN = 1 + Math.floor(Math.random() * 2); while (B.list.filter((q) => q.slot === 'random').length > B.randomN) B.list.splice(B.list.findIndex((q) => q.slot === 'random'), 1);
  B.avoid = t && won ? t.key : null; fill(B, side, villainsLeft); B.avoid = null; save(); return B; // the trouble moves on: not back to the city just saved
}
export const danger = (t, level) => level + Math.floor(Math.max(0, PATH.indexOf(t.key)) / 6); // the bigger towns come later on the road
// what is fought: Defend's villain by name, Destroy's guard has no disaster of its own (the heroes come for you anyway)
const WITH_VILLAIN = ['flood', 'coldwave', 'quake', 'plant', 'volcano', 'rift', 'sinkhole', 'blackhole', 'spill'];
export const partnerOf = (t, left = []) => (t.kind !== 'villains' && WITH_VILLAIN.includes(t.kind) && left.length ? left[t.id % left.length] : null);
export const waveOf = (t, left = []) => (t.kind === 'villains' ? (t.v ? [t.v] : []) : partnerOf(t, left) ? [t.kind, partnerOf(t, left)] : [t.kind]);
export const threatName = (t, side, shown) => (t.kind === 'villains' ? (side === 'hero' ? (t.v ? shown(t.v) : 'Villains') : 'The heroes on guard') : KIND_NAME[t.kind] || t.kind);

// the icons on the globe, drawn here so no phone is missing an emoji. The little animation is in storymap.js
const C = { villains: '#b04dff', aliens: '#27d86a', worm: '#d98a3a', tornado: '#8fa3b8', flood: '#2f8fe6', haboob: '#c99a55', tsunami: '#1f6fd6', coldwave: '#7fd8ff', zombies: '#6e9c3a', kaiju: '#d6452f', riot: '#ff7a2a', quake: '#a5764a', plant: '#35a84a', volcano: '#ff4a1f', rift: '#8a3cff', sinkhole: '#6a5a4a', blackhole: '#30205a', spill: '#b8d820' };
const W = 'fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"', F = 'fill="#fff"';
const ART = {
  villains: `<path ${F} d="M6 15c5-3 9-4 14-1 5-3 9-2 14 1 0 9-5 14-9 14-3 0-3-3-5-3s-2 3-5 3c-4 0-9-5-9-14z"/><path fill="#b04dff" d="M11 18l6 2-1 3-5-2zM29 18l-6 2 1 3 5-2z"/>`,
  aliens: `<g class="a-bob"><ellipse ${F} cx="20" cy="17" rx="15" ry="5"/><path ${F} d="M13 14c1-7 13-7 14 0z" opacity=".75"/></g><path class="a-beam" fill="#fff" opacity=".55" d="M15 23h10l5 13H10z"/>`,
  worm: `<g class="a-bob"><path ${W} stroke-width="7" d="M7 34c0-14 4-22 12-22 6 0 9 4 9 9"/><path ${W} stroke-width="2" d="M24 16l6 0M25 24l5-2"/><circle ${F} cx="28" cy="24" r="4"/></g><path ${W} d="M3 36h34"/>`,
  tornado: `<g class="a-sway"><path ${W} d="M6 8h28M10 15h20M13 22h14M16 28h8M18 34h4"/></g>`,
  flood: `<g class="a-bob"><path ${W} d="M4 16c4-4 8-4 12 0s8 4 12 0 6-3 8-2M4 25c4-4 8-4 12 0s8 4 12 0 6-3 8-2"/></g>`,
  haboob: `<g class="a-sway"><circle ${F} cx="13" cy="20" r="8"/><circle ${F} cx="25" cy="16" r="9"/><circle ${F} cx="29" cy="25" r="6"/><circle ${F} cx="17" cy="27" r="6"/></g>`,
  tsunami: `<g class="a-bob"><path ${F} d="M3 33c2-14 11-25 23-25 6 0 10 3 11 8-3-3-8-3-10 1-2 5 2 11 9 16z"/></g>`,
  coldwave: `<g class="a-spin"><path ${W} d="M20 5v30M7 12l26 16M33 12L7 28M20 11l-4-3M20 11l4-3M20 29l-4 3M20 29l4 3"/></g>`,
  zombies: `<g class="a-bob"><path ${F} d="M12 36V19l-3-7 3-1 3 6 1-11h3l1 10 2-11h3l-1 12 4-8 3 1-5 13v13z"/></g>`,
  kaiju: `<g class="a-bob"><path ${F} d="M6 36l3-13c0-9 5-15 13-15 4 0 7 1 10 4l-3 3 4 2-5 2 1 5-5-2-1 14h-5l-1-9-4 1-2 8z"/></g>`,
  riot: `<g class="a-bob"><path ${F} d="M12 36v-8l-3-4v-9c0-3 4-3 4 0v-3c0-3 4-3 4 0v-1c0-3 4-3 4 0v1c0-3 4-3 4 0v3c0-3 4-3 4 0v8l-3 5v8z"/></g>`,
  quake: `<g class="a-shake"><path ${W} d="M4 20h7l3-9 5 19 5-14 3 4h9"/></g>`,
  plant: `<g class="a-sway"><path ${W} d="M20 36c0-9-2-14-6-18"/><path ${F} d="M14 18C7 18 5 12 6 6c7 0 12 4 8 12zM20 28c0-8 4-13 13-13 0 8-5 13-13 13z"/></g>`,
  volcano: `<path ${F} d="M4 36l11-20h10l11 20z"/><g class="a-bob"><path fill="#ffd23d" d="M16 14c-3-4 0-6 1-10 2 2 3 3 3 5 1-2 2-3 3-4 1 4 3 6 0 9z"/></g>`,
  rift: `<g class="a-shake"><path ${F} d="M22 3l-7 13 6 2-8 19 14-21-7-2 6-11z"/></g>`,
  sinkhole: `<g class="a-spin"><path ${W} d="M20 20c0-2 3-2 3 0 0 4-6 4-6 0 0-6 10-6 10 0 0 9-15 9-15 0 0-11 20-11 20 1"/></g>`,
  blackhole: `<g class="a-spin"><circle fill="none" stroke="#fff" stroke-width="3" cx="20" cy="20" r="11" stroke-dasharray="14 6"/></g><circle fill="#000" cx="20" cy="20" r="7"/>`,
  spill: `<g class="a-bob"><path ${F} d="M20 5c6 9 11 14 11 20a11 11 0 0 1-22 0c0-6 5-11 11-20z"/></g>`,
};
export const iconOf = (kind) => '<svg viewBox="0 0 40 40" width="100%" height="100%" aria-hidden="true">' + (ART[kind] || ART.quake) + '</svg>';
export const colourOf = (kind) => C[kind] || '#888';
if (typeof window !== 'undefined') window.__threats = { board }; // the test scripts read it
