# itch.io upload checklist — My Little Disaster

Everything for the page is in this `itch` folder.

| File | Use on itch.io | Size |
|---|---|---|
| `my-little-disaster-web.zip` | **Uploads** → the playable game (HTML). `index.html` is at the top of the zip | 19 MB |
| `cover.png` | **Cover image** (shows in itch listings and search) | 630 × 500 |
| `screenshots/01 … 11` | **Screenshots**, uploaded in number order (desktop shots first, then the three phone shots) | 1280 × 720, phone 780 × 1520 |
| `logo.png` | **Edit theme → Title image** (replaces the plain title text; transparent) | 960 × 400 |
| `banner.png` | **Edit theme → Banner image** (the thin strip across the top) | 960 × 200 |
| `background.png` | **Edit theme → Background image**: *don't repeat*, *centered*, *fixed* | 1920 × 1080 |
| `description.html` | **Description**: switch the editor to HTML and paste it in (or copy the text from `DESCRIPTION.md`) | |

The screenshots, in order: main menu · Sandbox tornado · kaiju · hero sky slam · play the band · Defend mode · Disaster TV · Destroy (giant worm) · phone menu · phone hero fight · phone band.
`source/` holds the raw pictures the cover was made from (not for upload).

## Create new project
- **Kind of project:** HTML
- **Uploads:** `my-little-disaster-web.zip` → tick **This file will be played in the browser**
- **Embed options:**
  - Viewport dimensions: **1280 × 720** (the game fits any size)
  - Tick **Mobile friendly**, orientation **Default**
  - Tick **Fullscreen button**
  - Leave **Automatically start on page load** unticked (players tap to start, which also turns the sound on)
  - No scrollbars
- **Classification:** Games · **Genre:** Simulation (or Action) · Release status: your call
- **Tags (up to 10):** disaster, sandbox, city, 3d, casual, destruction, zombies, kaiju, superheroes, rhythm
- **AI generation disclosure:** the music was made with Suno, so tick AI-generated audio when itch asks.
- **Pricing:** free / name your own price, your call
- **Visibility:** Draft first, open it on your phone and check it plays, then Public

## Edit theme (on the game page, top right, after saving)
- Background **#0b0712**, page **#160a26**, text **#f4eee4**, links **#ff4fa3**, buttons **#ff4fa3**
- Banner image `banner.png`; title image `logo.png` (hide the plain title)
- Background image `background.png`, not repeated, centred, fixed

## Before you publish
- Put your name in the last line of the description ("Made by [your name]").

## Good to know
- Tested as itch serves it (inside a frame, under `/html/<number>/`): menu, Sandbox, the band game, a hero fight, Commander, saving: all fine, no missing files.
- Saves are kept per website, so progress on GitHub Pages doesn't carry over to itch (or the other way).
- To update the game later: rebuild (`npx vite build --outDir itch/_web`), zip what is inside `_web` (not the folder itself) with `tar -a -cf ../my-little-disaster-web.zip *` from inside it, and replace the upload. itch keeps the page.
- Add `?fps` to the address to see the frame rate.
