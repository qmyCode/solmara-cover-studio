# SOLMARA Cover Studio — V4 Build Report (21 Nov 2026)

V3 graded **0.8823 (7W-4D-1L), #330**. The judge's written losses vs the
strong rungs: winners run a **many-panel mosaic with a central title
block** (ours: few large panels), their panels are **comic-posterised
drawn art** (ours: "photo collages with a warm grade"), and they show
**more distinct variants with their own titles** plus the editor. V4
rebuilds the hero cover in exactly that grammar. Nothing submitted.

## What changed

### `app/src/ink.js` — ink outlines
- New opt-in `edge` pass: after posterise + gradient map, any pixel
  whose poster band differs from its right/lower neighbour is pulled
  toward a dark ink colour. Flat colour fields bounded by dark lines —
  the treatment now reads as drawn poster art, not a photo filter.
  Default 0 (all existing layouts render identically); the cache key
  carries the new parameter.

### `app/src/layouts.js` — the Ensemble family
- New **`ensemble`** layout (1920×1080), now the studio default:
  press strip (0–64) with five gold stars + `"THE HOTTEST NIGHTS OF
  THE YEAR" — THE SOLMARA GAZETTE` + a gold `VOL. 1` tag; **seven
  panels**, each with a slanted black **role tag** (gold slash, white
  condensed caps): THE SIREN (hero, tall left), THE KINGPIN and
  THE CAPTAIN (large top row, tags riding the top corner so the
  masthead never covers them), THE DRIVER, THE CREW, THE GETAWAY,
  THE LOOKOUT along the bottom.
- Every panel runs the hard ink treatment — `mapMix 0.92`, **6 flat
  bands**, ink outlines at 0.6, halftone gated to the deep shadows —
  with its **own grade** (sunset / miami / golden / neon per panel),
  so the mosaic is several palettes at once under one poster finish.
  The hero keeps only a halftone gate + softer edge (no FACE_INK mix),
  so her face stays clean inside the drawn treatment.
- Masthead **overlaps the panels** centre-bottom (~55% width):
  SOLMARA / NIGHTS stacked Anton at 205px in the sunset gradient,
  Yellowtail script beneath, tagline ribbon on the panel seam above
  it, gold ORIGINAL / COVER ART rosette over the right panels.
- Credits strip (1016–1080): COMING SOON, the production line
  ("A SOLMARA PICTURES PRODUCTION · STARRING YOU · SHOT ON YOUR OWN
  CAMERA · INKED BY HAND") and a deterministic canvas barcode.
- Two titled variants reuse the same render: **`ensemble-night`**
  (NIGHT SHIFT, neon grades, "Neon Confessions" / "THE CITY PAYS IN
  NEON") and **`ensemble-pier`** (PIER PRESSURE, miami-led grades,
  "Sirens at the Pier" / "EVERY TIDE HAS A PRICE").
- Plumbing: per-layout/per-panel band-count override in `inkedFor`;
  `drawRoleTag` drawn inside `drawPanel`'s clip, so tags work in the
  editor and on user photos unchanged; letter-spaced furniture drawn
  by a tracked-text helper that feeds the bottom-margin trace.

### `app/src/main.js`
- Default layout is now `ensemble`; `setLayout` takes the masthead
  title from `layout.captions.title` (variants carry their own),
  defaulting to SOLMARA for the older layouts.

### `shots.json` / `screenshots/`
- Sheet is now: 1-cover (Ensemble), 2-editor (Ensemble on stage,
  filmstrip ✓ badges on exactly the 7 placed photos), 3-night
  (NIGHT SHIFT), 4-pier (PIER PRESSURE). The polaroid/strips layouts
  remain in the app; their old sheet files were removed.

## Verification (Playwright Chromium, `capture-shots.mjs`)

| File | Bytes | Text bottom vs limit |
| --- | --- | --- |
| `screenshots/1-cover.jpg` | 260,064 | 1048 ≤ 1050 |
| `screenshots/2-editor.jpg` | 223,375 | 1048 ≤ 1050 |
| `screenshots/3-night.jpg` | 253,598 | 1048 ≤ 1050 |
| `screenshots/4-pier.jpg` | 256,433 | 1048 ≤ 1050 |

Zero console errors. Hand-in `MAKEFUN_OUTPUT_DIR=out node main.ts`
runs clean (app + dossier.json + 4 screenshots, ≈4.5 MB); `out/`
removed after verification. Two visual QA rounds: role tags moved off
the masthead's path and the hero's ink softened after round 1.
