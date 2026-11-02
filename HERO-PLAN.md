# The hero game: plan (Sean, 2026-11-01)

The pivot: the main game becomes a super hero game. You start with a few powers, fly from city to city round the globe defending them from disasters, earn XP, grow stronger, unlock skills that change how you fight, dress your team of three, and build the team's home tower. Save a town carelessly and the town fears you; wreck too much and you become the villain, hunted by heroes. The Sandbox is the test bench for every move.

Build order (one thing at a time, each tested in the Sandbox and pushed):

1. Floors inside the buildings you smash through (quick, and Sean asked)
2. Hero lab in the Sandbox: pick a hero, set the level and skills, spawn any enemy or disaster, see damage and fear numbers
3. Combat round 3: villains fight back; more hand to hand moves; more ranged powers
4. Powers against disasters, one disaster at a time
5. The collateral meter: damage, fear, reputation
6. Outfits for the three
7. Progression: XP, the skill tree, the campaign across the globe, the home tower
8. Becoming the villain: hero fights against you

## 1. Floors inside smashed buildings

Every building is one shell today (merged into the city's big meshes, by vertex range), which is what keeps the frame rate up. Floors for every building would mean tens of thousands more triangles and would show nowhere. So floors only exist in a building the hero is inside:

- The moment the hero bursts in, that one building is pulled out of the city mesh into its own group (the code already does this when one falls) and given an interior: a floor slab every storey (the building knows its storey count and height), a row of columns, a few boxes for desks, beds and shelves tinted by district (offices downtown, flats in the old town), and a dark hole where the hero came in.
- The shell's walls are drawn from both sides while the interior exists, so looking out from inside you see walls and not the sky.
- The chase camera, 10 m behind the hero, comes into the building with them; the wall between camera and hero is hidden (the usual trick) so the floors are on screen.
- Flying through a floor punches a hole in it and throws its bits ahead; furniture goes flying.
- When the building comes down, the interior rides the same fall (it is in the same group) and is freed with the shell. Only one or two buildings at a time ever have an interior, so the cost is a few hundred triangles.

## 2. Hero lab (Sandbox)

Built (2026-11-01): a Hero lab block in the Sandbox panel under Be a hero: hero level and villain level sliders (1 to 20), the five moves on or off, Spawn Blur, Tyrant, Weaver or all three, and a Readout toggle that adds a line under the hero name while flying: damage dealt and taken, fights won, buildings brought down, people scared, fear. Levels take hold at the next take-off or spawn. Disasters are spawned from the Disasters tab as before. A script (lab-fights.cjs) plays every hero against every villain at levels 1, 10 and 20 and prints a line a fight; run it after any change to the fights. Everything from here on is built against this bench.

## 3. Combat round 3

The fights stay in the town's own view (Sean: the models are too plain up close for first or third person). When a fight starts the chase camera hands back to the town camera, which glides in over the two of them at a fight distance (closer than the town view, far enough that they read as miniatures, the tilt-shift blur on), turned so the hero is nearer the camera than the villain, and follows them when a throw moves the fight. The weak spots, dodge circles and hold circles are screen overlays as now, so they work at any distance; the spin, throws and sky slam are watched from above and look like the kaiju game. Flying between fights stays in the chase view (or the town view with the hero as a dot, to be tried in the lab: both, then Sean picks).

Built (2026-11-01, 3a): the fight camera is the town's lens (fov 18), 64 m off and 48 degrees up, from the villain's side of the hero, so the hero is nearer the camera; it eases between them and follows them up through a sky slam; the blur is on. Flying between fights is still the chase view.

The street fight (Sean's inspiration, 2026-11-01: a film's street brawl between the hero, two invading soldiers and the army). The beats we take from it, in our own game:
- Two villains at once: a fast, trained one who out-fights the hero up close, and a huge one who relies on strength and slams the hero across the street. Fighting both is harder than the sum; the hero can split them up (throw the big one into a building two blocks away, then deal with the fast one).
- The hero gets thrown too: through a diner, into a train station, into a building. Taking a hit can mean the hero crashing through a building, with the same floors and dust, and climbing out.
- A rogue army unit arrives and attacks everyone: jets and helicopters fire missiles at hero and villains alike, soldiers on the ground are useless against the villains and in danger from them. The hero can stop a jet being torn apart, catch a missile, and pull a soldier out from under a villain.
- Saving the soldiers and the crowd turns the army: the commander calls off the attack and the town's fear of the hero drops (the collateral and reputation meter, item 5). Ignore them and the army keeps firing at you too.
- A villain's weakness: a mask or breather the hero can break (a special weak spot), after which the villain is dazed by the world's noise and light for a while, easy to hit, and will try to retreat.
- The army's missile can finish a dazed villain; a dropship (or a getaway) comes to carry a beaten villain off, so villains retreat rather than die.
- The hero is not invincible: a villain with training can out-fight them; protecting people costs the hero openings.

Villains fight back:
- Counters: while you tap weak spots, the villain winds up (a flash and a sound); a dodge circle appears left or right and you have half a second. Miss it and you take a hit and lose the combo.
- Grabs: a villain can grab you; mash the circle (or rub the stick) to break free, or a teammate breaks it after a moment.
- Ranged: villains fire while you are flying at them (Blur's blur bolts, Tyrant's thrown cars, Weaver's webs); weave with the stick, or punch the car back.
- A second wind: at half health the villain changes (faster, a new attack, a shield that only a ranged power breaks).
- Villain levels: the same villain at level 5 has more health, winds up faster, grabs more.

Hand to hand (all from the dazed state, chosen on buttons or a wheel, each unlocked by skill):
- Jab combo: tap to a rhythm (like the band game), three hits then a knock-back
- Uppercut: launches them, then a follow-up in the air (links into the sky slam)
- Ground pound: slam the street, a shockwave knocks everyone near over (crowd control for zombies and riots, stuns the worm)
- Grab and throw into a building: aim with the stick, the building takes the hit (they go through it; it comes down)
- Hammer throw: spin and let go toward whatever you aim at (a saucer, a walker, the kaiju)
- Elbow drop: fly up, hold, come down on them (the sky slam's cousin, no launch needed)
- Tag team: call a teammate for a double move (a throw to them and a punch back, or two beams crossing)

Ranged (hold to charge, tap to fire; from the air or on the ground):
- Laser (have): burns, cuts vines, cracks shields
- Freeze breath: ice; freezes zombies, lava, flood water, the tornado's base, a dust devil
- Fire blast: burns the plant, thaws the cold wave, lights a dust storm's devils out
- Lightning: chains through a crowd of zombies, overloads walkers and saucers, stuns the worm
- Sonic clap: a cone of sound; scatters dust devils, breaks glass (fear goes up), disperses a riot
- Gravity pulse: pulls cars and rubble into a ball you can throw; pushes a black hole's pull back
- Wind blast: a counter-spin for a tornado, blows a dust storm back, clears gas and smoke
- Shield bubble: a dome over a crowd (tsunami, meteor, nuke); hold it and take no damage, can't attack
- Telekinesis: lift a bus of people out of a flood, catch a meteor, hold a building up in an earthquake

## 4. Powers against disasters (what beats what)

| Disaster | What the hero does |
|---|---|
| Tornado | Fly round it the other way (wind blast) to unwind it; freeze its base; the plane's seeding stays an option |
| Dust storm | Sonic clap or wind blast on each devil; fly into the wall and find the eye |
| Flood, tsunami | Ice wall across the street; lift buses of people; shield the crowd on the shore |
| Earthquake, sinkhole | Hold up a leaning building (telekinesis, a hold circle); fill the hole with rubble (gravity pulse) |
| Volcano | Freeze the lava rivers; fly up and cap the vent with a thrown building |
| Meteor | Catch it (a long hold), laser it into pieces in the sky, or punch it off course |
| Black hole | Gravity pulse against its pull, feed it rubble to fill it, seal it like a rift |
| Dimensional rift | Hold a circle to seal it while fighting what comes out |
| Aliens | Catch a saucer and throw it at a walker; rip a walker's leg; lightning overloads them; bend a beam back |
| Giant worm | Ground pound to stun it, grab it when it surfaces and pull it out, hammer throw it, freeze the ground so it can't dive |
| Kaiju | The kaiju game as a hero: weak spots, throw its cars back, lightning on the tentacles |
| Zombies, riot | Crowd control: ground pound, sonic clap, lightning chains; speed runs carry people out |
| Nuclear attack, meltdown | Fly the bomb up and away (hold longer, higher), absorb the radiation (health for the town) |
| Solar flare, cold wave | Shield the town square; fire blast thaws; the ice is a weapon for you |
| Rogue army (new) | Catch missiles and shells, EMP (lightning) the tanks, disarm the troops, turn the tank on the villain |
| Killer plant | Fire, freeze, laser the vines, pull the root out (telekinesis) |
| Villains | The fights above |

## 5. The collateral meter

Counted every round: buildings you brought down, cars wrecked, people hurt, and fear (people who ran from you, windows you broke, crowds you scattered). Shown as a bar: Hero, Vigilante, Menace, Villain. A town saved with little damage pays more XP; damage costs some; people hurt cost a lot. The town remembers: the next time you visit, the crowd cheers or runs.

Fear tips over at Villain: the next city sends heroes after you (rival heroes, or your own team if you went solo), and you fight them with everything you have, from the villain's side. Win and the globe shows you as the menace; towns start locked down. A way back: save a few towns clean.

## 6. Outfits

Each of the three gets: suit colours (main, trim, emblem, cape, boots and gloves), cape or no cape, mask or hood, armour plates, jet wings (Dragonfly's), a trench coat, a crest, a few emblems. Palettes and parts unlock with levels and towns saved; some are rewards (the Far Isles' suit). Saved per hero in the profile. The heroes are built from a kit (heroes.js: materials per look, cape, hair), so the outfit is a data object the kit reads: colours per part, which parts are on.

## 7. Progression and the campaign

- XP from saves (town clean bonus), villains beaten, people rescued, minus collateral.
- Skill tree per hero, four branches: Strength (melee, throws, sky slam power), Speed (dashes, dodge window, time slow for Tempo), Energy (ranged powers, charge speed), Control (telekinesis, shields, team moves). Each skill has three ranks.
- The campaign on the globe: the road of towns becomes the hero's route; each town has a disaster set and a villain; some need a power you don't have yet (a locked town shows what).
- The home tower: a single tower in your home city that grows a floor with each level (never two towers alike). Inside: the team room (pick who flies, the other two assist), the wardrobe (outfits), the trophy wall (villains beaten), the map table (the globe). Later: the tower itself can be attacked, and you defend it.

## 8. Becoming the villain

The hero fights from the other side: rival heroes use the same moves against you. They lock on, you dodge; they tap your weak spots (you break free by tapping yours); they spin and toss you. The fight is the same mini game mirrored. Beat them and you keep the city in fear; lose and you wake in the tower, demoted a rank.

## Testing

Everything goes through the Sandbox hero lab first: a script spawns each enemy against the hero at level 1, 10 and 20 and records the fight (won, time, damage taken, collateral), so a change to one move can't quietly break another.
