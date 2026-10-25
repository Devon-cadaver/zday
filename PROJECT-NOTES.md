# Z-Day: project notes

READ THIS FIRST after a compaction. Current as of 2026-10-25.

## Concept (from Sean)
- Living miniature city. The player drops zombies in to spread the infection.
- Army and police respond and try to take out the zombies.
- Look target: warm sepia tilt-shift miniature city (Sean's reference: 4 aerial Midjourney-style shots of a dense sand-coloured mid-rise city, rooftop greenery, terracotta roof patches, tiny people and cars, strong depth of field top and bottom).

## Stack
- Three.js 0.170 + Vite 6, plain JS, same as Dead City (010) and Valhalla's Tide (012). No Blender: everything is procedural.
- Dev server: `.claude/launch.json` config "zday" on port 5191.
- Not a git repo yet, not published.

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

## Next (not started)
- Zombie drop and infection spread, police and army response.

## Private preview link
- https://claude.ai/artifact/Jemm5Sxje8y9XvJxcFNPwN (private, Sean only). Page source: artifact/zday-city.html.
- To update: `npx vite build --base ./`, then publish artifact/zday-city.html with files {"assets/<bundle>.js": "dist/assets/<bundle>.js"} and change the script src in the page to the new bundle name (the hash changes each build).
