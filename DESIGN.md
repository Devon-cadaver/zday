# My Tiny Disaster (was Z-Day): Commander mode design

Written 2026-10-25 from Sean's brief. The player stops dropping zombies and becomes the hero: the city's emergency commander,
dispatching police, fire crews, helicopters, the army and, as a last resort, a nuke. Everything built in the sandbox (infection,
panic, rooftop refuges, zombie piles, car crashes, fires) becomes the threat the player manages.

## The round

- Since v1.3 (2026-10-26) a round is a run of random incidents (2 to 5 by level) and a zombie outbreak is just one kind; see PROJECT-NOTES v1.3. The outbreak-only round below is the original design.
- A round is one city, one outbreak, about 10 minutes.
- Three 911 calls come in at random street locations a few seconds apart. Each is a small outbreak (1 to 3 Shamblers plus a
  couple of bitten civilians). Pins pulse on the map and a "Go" button on each alert pans the camera there.
- The player picks a unit card at the bottom of the screen and taps the map to send it. Units drive in from the city edge or fly
  in, then act on their own. No micromanagement after dispatch.
- The round ends in one of three ways:
  - Contained: zero zombies left. Big bonus.
  - Holdout: the 10 minute timer runs out. Scored on what survived.
  - City lost: fewer than 20% of the population alive. Nuke authorisation is usually the last chance before this.
- End screen: stars (1 to 3), score, XP earned, and the funniest stat of the round ("your police shot 412 zombies",
  "the nuke killed 2,300 of your own citizens").

## Reading the threat

Decided 2026-10-25 after the plan: NO zombie or infected markers and no outbreak pins. Finding the outbreaks is half the fun. The clues are screaming crowds, fleeing and crashing cars, smoke and fire, plus vague 911 calls that name a district. The block heat map below drives the alert level but is not drawn.


- Block heat map: once a second count zombies per street block. A block with 3 or more zombies is "infected". Infected blocks get
  a translucent red tint on the ground and a red edge glow. Connected infected blocks form an outbreak zone.
- Alert level (shown as a banner) rises with the number of infected blocks and unlocks heavier units:

| Alert | Name | Trigger | Unlocks |
|---|---|---|---|
| 1 | Outbreak | any zombies | Police cruiser, evacuation bus |
| 2 | Spreading | 2+ infected blocks or any building fire | Fire truck, water helicopter, rescue helicopter |
| 3 | Major incident | 3+ infected blocks | Army APC |
| 4 | City emergency | 5+ infected blocks | Airstrike, nuke authorisation |

- Alert never drops during a round, so a late heavy response is available but you pay for letting it get that far.

## Units

Costs are Response Points (RP). Cooldown is per unit type. All numbers are first guesses to tune in play.

| Unit | Alert | Cost | Cooldown | What it does | What can go wrong |
|---|---|---|---|---|---|
| Police cruiser | 1 | 50 | 20 s | Drives in with lights on, 2 officers get out and shoot zombies within 12 m (one shot per 0.8 s, 80% hit). Officers fall back when 8+ zombies are within 6 m. Slows a small outbreak; can wipe one if sent early. | Sent late into 20+ zombies, the officers are overrun and turn. The cruiser can crash like any car. |
| Evacuation bus | 1 | 60 | 30 s | Parks at a block, loads up to 30 civilians, drives off the map. Points per person saved. | Swarmed while loading: a bus full of zombies. |
| Fire truck | 2 | 80 | 30 s | Drives to a burning building and hoses it out in about 20 s, then douses neighbours so the fire stops spreading. | Crew attacked by zombies; the truck can be wrecked. |
| Water helicopter | 2 | 150 | 60 s | Flies straight in, hovers, drops water on a 40 m circle, putting out every building in it. | Slow to arrive; nothing to stop zombies. |
| Rescue helicopter | 2 | 120 | 45 s | Lands on a rooftop refuge and lifts up to 12 survivors. Points per person. | Zombies already on the roof; takes time to load. |
| Army APC | 3 | 250 | 60 s | A squad of 8 soldiers holds an intersection: faster fire, longer range, grenades on clumps. | Overrun by 100+; soldiers turn into a much nastier wave. |
| Airstrike | 4 | 300 | 45 s | Tap a spot, 3 s delay, 25 m blast kills everything in it and sets about a third of the buildings on fire. | Kills civilians in the radius, starts fires you then need to fight. |
| Nuke | 4 | 1000 | once per round | 150 m radius: flash, everything dies, buildings charred black, ring of fire. Ends an outbreak zone outright. | Enormous civilian penalty and the burnt zone earns nothing for the rest of the round. |

## Points

- Response Points (RP) are the in-round currency. Income: 5 RP/s base plus 1 RP/s per 500 living civilians (about 20 RP/s with
  the whole city alive, so losing the city also starves your response). Start of round: 150 RP, enough for two cruisers when
  there are three outbreaks. That first choice is the opening puzzle.
- Bonuses: +1 per zombie killed by your units, +30 per fire put out, +3 per civilian rescued or evacuated, +300 per outbreak
  zone contained, +500 for Contained.
- Penalties: -5 per civilian killed by your own airstrike or nuke, -50 per unit lost.
- Score at round end = RP earned in total + 10 per living civilian + 20 per intact building, times a difficulty multiplier.

## Levelling

- XP = score / 10, carried across rounds in localStorage (like Dead City coins). Commander level thresholds roughly double each
  level.
- Levels gate what exists at all; alert gates when it can be used within a round:
  - Level 1: police cruiser, evacuation bus. Rounds start with one outbreak and slower incubation (20 to 30 s).
  - Level 2: fire truck. Two outbreaks per round.
  - Level 3: water and rescue helicopters. Three outbreaks, normal incubation.
  - Level 4: army APC.
  - Level 5: airstrike. Police cooldown 15 s.
  - Level 6: nuke.
  - Level 7+: upgrades bought with XP: squads of 4 officers, riot barriers that slow zombies on a block, drone recon that marks
    incubating infected with an amber ring before they turn, bigger evacuation buses, two water drops per helicopter.
  - Level 10: Runner zombie type (fast, fragile) appears in some outbreaks. Bigger city option.
- Every round earns something, even a loss, so the casual loop is "one more round".

## Why it should feel casual but strategic

- One thumb: pick a card, tap the map. Everything after that is automatic and visible (sirens, muzzle flashes, hose spray, water
  splash, rotor wash).
- The map tells you what to do: red blocks, fire glow, pins. The three alerts plus "Go" buttons mean you never hunt for the action.
- Decisions are about where and when, never about micro: which outbreak gets the second cruiser, whether to spend on a fire truck
  now or save for the APC, whether an airstrike is worth the fires, whether to nuke a district to save the city.
- Mistakes are entertaining rather than fatal: a late cruiser becomes two more zombies, an airstrike starts a blaze, a nuke wins
  the round with one star.
- Speed control stays (1x to 4x) for players who want to watch it play out.

## Implementation phases

Each phase ships playable to GitHub Pages. The sandbox stays reachable at ?mode=sandbox for testing.

1. Round core: three random outbreak starts, block heat map with red tint, alert banner, RP income and HUD, 10 minute timer,
   end screen with stars and score. Dispatch bar with the police cruiser only. New agent kind in people.js: officer (shoot,
   retreat, can be bitten). Mission vehicles in traffic.js: road path from the city edge to a target intersection on the node
   graph, siren lights, officers get out on arrival. Zombies shot become corpses.
2. Fire response: fire truck (road, hose), water helicopter (air, drop), rescue helicopter (rooftop lift). Fire.extinguish, water
   splash and hose spray effects, simple instanced helicopter mesh with spinning rotor.
3. Army and airstrike: APC squad with grenades, airstrike with target ring, delay, blast, fires.
4. Nuke and evacuation: nuke (flash, shockwave ring, blackened buildings, firestorm), evacuation bus.
5. Meta: XP, commander level, unlock screen, upgrades, difficulty ramp by level, localStorage save, Runner zombie type, main menu
   with Commander and Sandbox.

## Balancing knobs (all in one config file)

Starting RP, income curve, unit costs and cooldowns, alert thresholds, police hit rate and retreat threshold, incubation range by
level, outbreak count by level, airstrike fire chance, nuke radius, score weights.

## Disasters and weather (v1.0)

- Each Commander round can bring weather and, from level 2, a disaster on top of the outbreak. They are new problems for the same
  cards, not a new control scheme: the alert floor they raise unlocks what you need.
  - Earthquake (L2): buildings collapse on people, fires from gas lines, panicked drivers. Fire trucks and rescue helicopters.
  - Riot (L2): a mob burning cars and shops. Police make arrests (+3 each), soldiers use tear gas.
  - Flood (L3): streets under water, cars stall, people climb onto roofs and the slow ones drown. Rescue helicopters.
  - Tornado (L4): a storm cell crossing the city, tearing up blocks. Clear-up afterwards: fires, roofs.
  - Tsunami (L5): an 18 second warning, then a wave from one coast. Get people high, then lift them off.
  - Alien invasion (L6): saucers abduct, burn and land troops. Soldiers and police shoot them down when they fly low (+500).
  - Sinkhole (L3): a street swallows people, cars and buildings. Cold wave (L5): anyone outdoors freezes; zombies freeze too
    until it breaks. Dust storm (L6): a wall of sand lifts people and cars. Solar flare (L7): blackout, fires, helicopters
    grounded, garbled 911 calls. Volcano (L8): lava through the streets and burning roofs. Meteor (L9): a warning, then a
    crater and a burning district. Nuclear attack (L10): sirens, a missile, a mushroom cloud. Plant meltdown (L11): the
    coastal reactor overheats, explodes and fallout drifts over the city.
- People react like people: they climb out onto roofs through the stair huts, crowd the side of the roof facing a disaster
  and run across as it passes, and anyone safe enough stops in the street to film it on their phone.
- Weather changes the rules a little: rain and storms slow fires, heat spreads them, snow and sand slow cars and make them skid,
  fog hides the city, storms throw lightning.

## Be The Disaster (was Storm mode)

- Pick a disaster your level has unlocked and be it for three minutes: steer a tornado, open sinkholes, tear fault lines,
  call down meteors, pour lava, pull a tsunami through the streets, or fly an alien saucer. One finger drives it, two fingers
  move the camera. Everything wrecked scores (scaled per disaster so ranks mean the same for each); earns Commander XP; best
  score per disaster on the picker.
