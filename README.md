# SOLMARA Cover Studio

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/qmyCode/solmara-cover-studio/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/qmyCode/solmara-cover-studio/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

A web app that turns your own photos into multi-panel cover art in the
style of GTA 6's posters — an entry for the make.fun bounty
[gta6-cover-art-01](https://make.fun/bounty/gta6-cover-art-01).

**Poster Ink** is the signature: every photo is posterized into flat
colour bands and recoloured through a gradient map (Sunset, Neon, Golden
or Miami), with a halftone dot screen punched into the shadows, so a
snapshot stops looking like a photo and reads as illustrated key art.
Five layouts — Wide Grid, Wide Neon, Portrait Polaroid, Square Strips
(one photo sliced into five cuts) and Square Grid — pair the panels with
a gradient block title, a neon script subtitle and a letter-spaced
tagline. Drag any panel to reframe it, scroll to zoom it, swap photos
between panels, edit the caption, and export a PNG in the common post
sizes: 1920 × 1080, 1080 × 1350 and 1080 × 1080.

Three steps: **1** add photos, **2** pick a layout, **3** export. Photos
are read on your own machine and never uploaded; the app is static files
and works fully offline.

## Run it

```sh
node serve.ts   # then open http://localhost:8080
```

Any static file server pointed at `app/` works just as well.

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

This copies `app/` and `screenshots/` to the output directory and writes
`dossier.json` with the vendored make.fun library.

## Credits

- Type: Anton and Yellowtail, both under the SIL Open Font License 1.1 —
  see `app/fonts/OFL.txt`.
- Sample photos under `app/samples/` were made with an image model for
  this entry and are free to use.
- Everything else is original: no Rockstar Games logo, artwork or fonts.
