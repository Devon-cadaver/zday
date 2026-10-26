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

## Next
- Commander phases 2-5 per DESIGN.md: fire truck, water and rescue helicopters, army APC, airstrike, nuke, evacuation bus, XP and levels, menu.

## Earlier plan note
- Sean decided on 2026-10-25 to make the player the hero (emergency commander) instead of dropping zombies. The full plan is DESIGN.md (round, alert levels, units, points, levelling, 5 implementation phases). Sandbox stays at ?mode=sandbox.

## Private preview link
- https://claude.ai/artifact/Jemm5Sxje8y9XvJxcFNPwN (private, Sean only). Page source: artifact/zday-city.html.
- To update: `npx vite build --base ./`, then publish artifact/zday-city.html with files {"assets/<bundle>.js": "dist/assets/<bundle>.js"} and change the script src in the page to the new bundle name (the hash changes each build).
