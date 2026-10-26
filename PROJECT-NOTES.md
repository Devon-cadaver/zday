# Z-Day: project notes

READ THIS FIRST after a compaction. Current as of 2026-10-25.

## Concept (from Sean)
- Living miniature city. The player drops zombies in to spread the infection.
- Army and police respond and try to take out the zombies.
- Look target: warm sepia tilt-shift miniature city (Sean's reference: 4 aerial Midjourney-style shots of a dense sand-coloured mid-rise city, rooftop greenery, terracotta roof patches, tiny people and cars, strong depth of field top and bottom).

## Stack
- Three.js 0.170 + Vite 6, plain JS, same as Dead City (010) and Valhalla's Tide (012). No Blender: everything is procedural.
- Dev server: `.claude/launch.json` config "zday" on port 5191.
- Live: https://devon-cadaver.github.io/zday/ (GitHub Pages, deploys on every push to main via .github/workflows/deploy.yml, about 1 minute).
- Repo: https://github.com/Devon-cadaver/zday (public, branch main). Sean approved publishing on 2026-10-25.
- No gh CLI on this PC. The repo was created through the GitHub REST API with the token from git credential manager (git credential fill), never printed.
- The claude.ai artifact link does NOT open on Sean's older iPhone (viewer says browser unsupported). Use the GitHub Pages link for phone testing.

## Files
- `src/main.js`: renderer, MapControls camera (fov 18, distance ~470, pitch 48, yaw 45), sun + hemisphere light, shadow camera follows the view target, render loop. Debug hook `window.__z`.
- `src/city.js`: street grid (12x12 blocks, 10 m road + 3 m sidewalks), lot subdivision, buildings (shop band ground floor, 4 facade styles, setbacks, balconies, parapets, roof huts, AC units, tanks, roof gardens, terracotta patches), parks, plazas, parking lots, street trees, lamps, crosswalks, parked cars. Geometry merged per material, trees/tanks/lamps instanced.
- `src/traffic.js`: cars on the intersection graph (right-hand lanes, bezier turns), pedestrians walking block perimeters, static crowds.
- `src/post.js`: scene to HDR target with depth, half-res golden-angle depth-of-field, composite with glow, ACES, sepia/split-tone grade, vignette, grain.
- `src/textures.js`: canvas textures (facades, shopfronts, roof, asphalt, sidewalk, grass).

## URL params
- `q=low|high` (low is auto on touch devices: 10x10 blocks, fewer people/cars, no MSAA, 2048 shadows).
- `x`, `z`, `d`, `p`, `a`, `fov`: camera target, distance, pitch, yaw, field of view.
- `dof=0`, `grade=0`, `blur=0.022`, `sun`, `hemi`, `fog`, `seed`.

## Screenshots
- `shots/`: shot3/shot4 desktop, shot5-low phone quality (sent to Sean 2026-10-25).

## Outbreak (v0.2, 2026-10-25)
- src/people.js: typed-array agent sim for every person. States WALK (block loop), IDLE (crowd), FLEE, RETURN, GRABBED, TURNING, ZOMBIE, FALLING. inf flag + incubation timer.
- Walk grid at 0.5 m (street corridors + open lots: plazas, parks, parking) with wall sliding. Spatial hash (6 m cells) of civilians, rebuilt every step.
- Shambler (ZTYPES[0]): wander 0.55, chase 1.3, lunge 2.9 under 2.2 m, sight 12, notice 5.5 m at 30% per think, bite 1.1 s, incubation 10-18 s. Bites scream-panic civilians within 12 m.
- panic() must re-check isCivilian: states change mid-tick (this caused bitten victims to be cured; fixed).
- Spread with one Shambler, no defenders: first bite from seconds (crowded drop) to ~3 min (quiet street); ~800 zombies at 7 min; city overrun ~15 min.
- src/game.js: tap a street to drop (3 Shamblers per run), HUD counters, outbreak clock, speed 1/2/4/8x (fixed 1/30 s substeps), Follow (zooms to 170 m and tracks a zombie, cancels on drag), Reset.
- Markers: green ring = zombie, amber = infected; drawn through buildings; scale with zoom. Blood decals at bites.

## Chaos (v0.3, 2026-10-25)
- Cars (src/traffic.js): lane following with braking, intersection reservation taken at the stop line (STOPLINE 3.4 m), stale reservations dropped, U-turn only mid-block with a clear opposite lane. Panic when 2+ zombies within 22 m or a bite within 20 m (game calls traffic.panicNear on bite events): x1.6 speed, weak late braking, ignore pedestrians and right of way. Run-overs kill civilians; zombies hit under 11 m/s are knocked down 65% of the time and get back up. Crashes (relative speed > 5 m/s) become sliding spinning wrecks (REST when stopped) with 28-63% fire chance; crash panics drivers within 18 m for 10 s. Spawn placement keeps cars 10 m apart (overlapping spawns caused phantom crashes).
- Rooftops (src/people.js): city.buildings gives each street-facing building a door, wall anchor, outward normal, roof rect, roofY and vertex ranges. Panicked civilians (60% when 30+ zombies or 2+ within 18 m) SEEK the nearest refuge door within 35 m, go INSIDE (hidden, stairs time), then ROOF (lvl = building index; interactions only on the same lvl). Capacity area/5.
- Piles: ground zombies with no prey head for buildings with living roof survivors within 60 m, join a PILE on the door side (pileH = 1.7 sqrt(n) + 0.5, pileR = 0.65 H + 1). Mound mesh (half cone, tangled-bodies canvas texture) per pile. When pileH reaches the roof the building is breached: top 8 climb (CLIMB) onto the roof, later arrivals climb straight up. Roof zombies hunt roof survivors; idle roof zombies eventually step off the edge (FALLING). When a roof has no living survivors for 3 s the pile collapses (everyone falls back to the street).
- Fire (src/fire.js): GPU point sprites, teardrop flames (additive) and smoke (alpha), pools with free-list recycling. Building fires: overrun at breach (25%) or at collapse (30%) after 3-11 s; burn 90-160 s, spread to buildings within 2 m at 0.6% per 4 s, char vertex colours (city.char, undone by city.uncharAll on reset). Survivors on a burning roof jump (JUMP, die on landing). Car fires burn 50-100 s.
- Corpses (DEAD) lie flat, darkened. HUD has a Dead counter. Camera min distance 200 (Follow zooms to 230). Camera edge clamp margin 10 m.
- Test harness note: when stepping the sim by hand call people.sync() every simulated second; roof counts (bRoof) come from sync and piles collapse without it.

## Commander mode phase 1 (v0.4, 2026-10-25) - DEFAULT MODE
- Default page is Commander; ?mode=sandbox keeps the zombie-drop sandbox. src/game.js is the shared layer (HUD scaffolding, toasts, tap input, speed, fixed-step loop, follow camera) with a Sandbox class; src/commander.js is the round.
- Round: 3 outbreak sites (random walkable, 140 m apart, 50 m from the edge) fire at 3/14/26 s via people.infectAt(x, z, 3) (nearest civilians bitten, incubate 3-8 s). No markers, no pins: Sean wants finding the outbreaks to be the fun. Hints: a 911 toast naming the district (3x3 grid, North/South x West/East/Central) at each start, then every 25-40 s a caller from a random zombie's district.
- Alert: once a second count zombies per street block; a block with 5+ is overrun. Alert 1 any zombies, 2 at 2+ blocks or any fire, 3 at 5+, 4 at 10+. Never drops. Shown in a HUD pill.
- Points (RP): start 100; income 1 + humans/2000 per second (about 6/s); +1 per zombie shot. Police card costs 50, cooldown 20 s.
- Police cruiser (traffic.dispatch): BFS route on the intersection graph from the nearest city-edge node to the node nearest the tap, parks beside the tap (stopAt), or wherever it is after 4 s stuck within 30 m of the stop / 15 s stuck anywhere. Mission cars never panic, skip intersection reservations, brake for civilians but not zombies, drive at 14. dispatchTo picks an edge start with no car within 14 m (up to 6 tries) and new cruisers get a 2.5 s collision grace. Calm traffic waits at the stop line while a driving cruiser is within 22 m of the intersection (sirenNear); cruisers ease to 6 m/s through busy crossings. Headless: 26 of 28 cruisers arrive, the rest are wrecked in traffic (intended drama). Separate cruiserMesh (white, navy hood stripe, red/blue bar) with emissive flashing while any cruiser is driving. Wrecked cruiser = onLost toast.
- Officers (people.js state COP, kind OFFICER): spawn on the sidewalk by the car, post = car. Hunt zombies within 60 m (160 m with no leash once zombies <= 12), advance to 12 m at 2.8 m/s, shoot within 22 m every 0.6 s, hit chance 1.05 - 0.025*d (capped 0.95). Fall back (FLEE 4 s) when 8+ zombies within 6 m. Gunfire draws idle zombies within 25 m toward the shooter (fx 3 = alerted, chase speed). Officers can be bitten (keep shooting while infected, then turn) and run over.
- Balance from headless runs (3 cruisers per outbreak, resent twice): sent at 20 s the police grind 3 outbreaks down to stragglers; sent at 45 s they hold ~2 min then lose; sent at 75 s they are swallowed. That is the intended timing pressure.
- End: contained (all 3 started, t > 40, zombies 0, infected 0), lost (humans < 20%), holdout (600 s). Score = RP earned + 10/human + 20/intact building. Stars: contained 3 (>= 90% alive) or 2; holdout 2 (>= 70%) or 1; lost 0. Overlay #zd-end (needs the [hidden]{display:none} rule because it is display:flex).
- Figures (src/figures.js): merged low-poly person (92 tris: icosahedron head, hair cap, torso, 2 arms, 2 legs), one instanced mesh, per-instance aShirt/aPants/aSkin/aAnim attributes, MeshStandardMaterial patched in onBeforeCompile: legs/arms swing by aAnim (1 walk, 2 run, 3 shamble, 5 arms out, 6 aim, 7 aim+walk) using gl_InstanceID as phase; zombies have arms forward and head tilted. people.sync writes rotation matrices by hand (Ry(yaw)*Rz(tilt)). Zombie look = green skin, dulled clothes; infected skin lerps to green; dead = darkened. Rings/markers removed.
- Perf: 61 fps at 390x844 on the dev PC in low mode. Not measured on Sean's phone yet.

## Roster, zombie types, hunt aids, day and night (v0.5, 2026-10-25)
- Sean sent four reference sheets (civilians, zombies, police/military/rescue vehicles, jets, civilian vehicles). They are reference only; models are procedural box kits.
- src/figures.js: one figure kit (92 base tris + hat, vest, backpack, hand item props) with per-instance aKit (hat type, flag bits VEST/PACK/ITEM/BALD/GLOW, torso girth, scale), aAccent (hat), aAccent2 (gear), aAnim. Props collapse in the vertex shader when off. ARCHETYPES (casual, businessman, construction, nurse, student, homeless, shopper, traveler, off-duty officer) roll looks; OFFICER_LOOK; ZTYPES (walker 62%, runner 12%, crawler 8%, bloater 6%, juggernaut 3%, screamer 3%, skeleton 6%) with per-type speeds, hp, anim, tilt and look(). Zombies glow faint green (emissive via FLAG.GLOW, uGlow uniform; brighter at night).
- src/people.js: per-agent zombie type (zt) and hp; becomeZombie() on turn; kill() handles damage: shots 1 hp, cars knock walkers down or kill, juggernaut armoured; bloater pops (blood, scare, infects civilians within 3 m); screamer screams every 8-13 s (panics civilians within 28 m, draws zombies within 45 m); crawler is hard to hit (hitMod -0.3). People keep their archetype gear when they turn.
- src/vehicles.js: vehicle library. CAR_TYPES for traffic (sedan, hatchback, suv, pickup, van, taxi, sports, weighted) built white so instance colour tints; named VEHICLES for showcase/missions: police interceptor, Tahoe, SWAT Bearcat, fire truck, ambulance, HMMWV, MRAP, Stryker, M1 Abrams, helicopters (police, air ambulance, search and rescue, wildfire with bucket, Black Hawk; groups with userData.rotor), jets (A-10, F-16, B-2, B-52), city bus. Only the interceptor is used in gameplay so far.
- src/traffic.js: one InstancedMesh per car type (typeMeshes) for moving and parked cars; car.type/car.slot; tint() helper.
- Hunt aids (Sean: outbreaks were too hard to find): every 911 call (outbreak start, then every 15-25 s from a random zombie's position) draws a red search-zone ring on the ground (radius 70/55 m, centre jittered up to 45% of the radius, fades over 45 s) and fills the #zd-call strip with a GO button (g.lookAt at 330 m). Still no exact markers.
- src/daylight.js: phase 0..1 per round (commander t/600, sandbox clock/600): sun elevation 45 deg -> sunset at 0.4 -> night 0.5-0.82 (moonlight, blue) -> dawn 0.9 -> morning. Drives sun/hemi/fog/background, post night uniform (cool grade, more exposure), lit windows (emissiveMap from textures.js facadesLit/shopLit, intensity 0.75 at night), street lamp light pools (instanced additive quads at city.lamps), car headlight pools, zombie glow.
- showcase.html + src/showcase.js: roster page, one WebGL canvas with scissor viewports per tile, sections Civilians / Responders / Zombies / Police / Fire and rescue / Military / Aircraft / Civilian. Live at /zday/showcase.html.

## Commander phase 2: fire response (v0.6, 2026-10-25)
- Cards: Fire truck 80 pts / 30 s, Water heli 150 / 60 s, Rescue heli 120 / 45 s, all from alert 2.
- src/fire.js: bFire 3 = put out. douse(k, dt) accumulates wet, extinguish at 20 s; extinguish() ends flames, soaks neighbours (soaked[k] = simT + 150 s, no ignition or spread while soaked), stats.out++, event fireout. dropWater(x, z, 40) extinguishes every fire within 40 m, soaks all buildings in it for 200 s, big mist splash, stats.drops++. Mist pool (white smoke shader with uColA/uColB uniforms) for hose spray and drops: spray(x, z, y, n, spread, size).
- Fire truck: traffic MISSION_KINDS { police: cruiser cap 12 cruise 14, fire: VEHICLES.fire_truck cap 8 cruise 11 }, one InstancedMesh per kind, car.kind/car.slot. Commander.sendFire routes to the door of the nearest fire within 80 m of the tap, else to the tap (truck stands by). On arrival people.spawnFirefighters(x, z, 2): kind FIREFIGHTER, state FIREMAN, post = truck. firemanStep: every 1 s pick the nearest burning building within 110 m of the post, walk to door + normal*1.6 (detours), then face the wall, fire.douse and spray every 0.35 s; fall back (FLEE) when panicked, return to FIREMAN; can be bitten.
- Calm drivers (panic <= 0, incl. mission cars) no longer run over non-zombies: they brake to 0.4 m/s on contact. Panicked drivers still kill. This was needed because crews crossing streets died instantly.
- src/aircraft.js Helicopters: send(kind, x, z, {k, onDone}) spawns a buildVehicle group (heli_wildfire / heli_rescue, scale 2) 600+ m out, flies in at 30 m/s, cruise alt 48. Water: hover at 28 m for 2.5 s, fire.dropWater, leave. Rescue: Commander.sendRescue picks the roof with the most survivors within 90 m of the tap (bRoof), heli descends to roofY + 4, people.evacuateFrom(k) every 0.5 s (uninfected ROOF survivors -> state EVAC, hidden, stats.rescued), leaves at 12 or after 6 s with nobody, event rescued. Helis fly out and are removed 300 m past the bounds.
- Points: +30 per fire put out, +3 per rescued. End screen: helicopters sent, rescued, fires put out.
- Headless check: at a 325-zombie outbreak at 163 s, truck + crew arrive but the crew dies within a minute (fine, sent late); water drop put out 3 buildings; rescue heli lifted 12. Calm test: crew hoses a building out in ~10 s with two on the line.

## Commander phase 3: army and airstrike (v0.7, 2026-10-25)
- Cards: Army APC 250 pts / 60 s at alert 3, Airstrike 300 pts / 45 s at alert 4.
- APC: traffic MISSION_KINDS.apc = VEHICLES.stryker, cap 6, cruise 12, tough: never crashes (the other car wrecks), ignores pedestrians, parks in the intersection it was sent to (stopAt = len - 1). On arrival people.spawnOfficers(x, z, 8, KIND.SOLDIER): state COP with kind SOLDIER, SOLDIER_LOOK (olive, helmet, vest, pack), post = the APC. Soldiers: search 70 m, leash 45 m from the post, engage from 18 m, fire every 0.35 s within 32 m with accuracy as if the target were at 0.6x the distance, fall back at 14 zombies within 6 m (police: 8). Their gunfire draws idle zombies within 45 m (police 25 m), so a squad is a horde magnet. Grenades: when 6+ zombies sit 10-30 m away, one soldier lobs at their centroid; squad-wide cooldown people.grenadeCd 4 s; 1.5 s fuse, people.blast(x, z, 5, civilians=false) kills zombies only, puff + mist.
- Airstrike: Commander.sendStrike -> helis.strike(x, z, {radius 25}): an A-10 (buildVehicle('a10'), scale 2.2) spawns 900 m out on a random heading through the target at 120 m/s, 60 m up; releases a bomb (cylinder mesh) at lead = 120*sqrt(2*60/9.8) m before the target, ballistic fall; on impact fire.blast (fireball + smoke + dust, char every building within 25 m, 35% ignite) and people.blast (everything within 25 m dies incl. rooftop people; civilians count stats.bombedCiv, -5 pts each, +1 per zombie). Camera shake if within 500 m. The strike is marked with an exact red ring (report(..., exact=true)) and 'Impact in N s' in the call strip.
- Headless: an APC squad against a 10-20 zombie clump kills everything approaching within 30 m (34 kills / 90 s with few arrivals, 8 alive). Airstrike on a 24-zombie clump in a busy street: 24 zombies and ~40 civilians dead, 2-8 fires. Expensive on purpose.
- Screenshot trick: g.speed = 0 freezes the sim while the render loop keeps drawing; to frame a jet at height H with pitch 35 shift the camera target toward the camera by H*cos(35)/... (about 86 m for H=60, azimuth 45: target = jet + (-0.707, -0.707) * 86).

## Next
- Commander phases 4-5 per DESIGN.md: nuke, evacuation bus, XP and levels, menu.: fire truck, water and rescue helicopters, army APC, airstrike, nuke, evacuation bus, XP and levels, menu.

## Earlier plan note
- Sean decided on 2026-10-25 to make the player the hero (emergency commander) instead of dropping zombies. The full plan is DESIGN.md (round, alert levels, units, points, levelling, 5 implementation phases). Sandbox stays at ?mode=sandbox.

## Private preview link
- https://claude.ai/artifact/Jemm5Sxje8y9XvJxcFNPwN (private, Sean only). Page source: artifact/zday-city.html.
- To update: `npx vite build --base ./`, then publish artifact/zday-city.html with files {"assets/<bundle>.js": "dist/assets/<bundle>.js"} and change the script src in the page to the new bundle name (the hash changes each build).
