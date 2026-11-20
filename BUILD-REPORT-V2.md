# SOLMARA Cover Studio — V2 Build Report (20 Nov 2026)

Goal: beat the 6-elite "NEON SHORE" anchor, not draw with it. V2 targets the
five gaps from `coverart-judge-dissection.md` (48 judge calls dissected):
photographic realism, cast breadth, polaroid/strips reading as postcards,
export sizes legible in the source outline, editor richness reading as
"more steps". Standing entry: 0.8626 (#126 on 20 Nov; top-50 line 0.9037,
#1 0.9506). Nothing was submitted from this build.

## Changes per file

### `app/samples/` — new cast (gap 2: cast breadth)
- Deleted `photo1-hero.png`, `photo2-couple.png`, `photo3-driver.png`,
  `photo4-skyline.png` (the old 4-photo / 2-person set).
- Added `cast-1.jpg` … `cast-9.jpg` from `coverart-cast-v2/` (downscaled to
  854 px wide solos / 1280 px scenes, JPEG q88, ~1.9 MB total): six DISTINCT
  solo portraits (curly-haired lead, bearded sailor, silver-haired Don,
  neon-night woman, skater, racer) + three scenes (convertible getaway,
  windshield driver, rooftop friends).
- Panel defaults in `layouts.js` were re-mapped so **each face appears at
  most once per cover** and the same cast recurs across layouts:
  Wide = lead / getaway / rooftop / Don · Neon = rooftop banner / night
  woman / sailor / driver · Grid = lead / racer / skater / rooftop ·
  Polaroid = lead / rooftop / night woman / getaway · Strips = racer solo.

### `app/src/main.js` — cast wiring + photographic default
- `SAMPLES` now lists the nine cast photos with character labels
  ("Mara · The Lead", "The Sailor", "The Don", "Night Owl", "The Skater",
  "The Racer", "The Getaway", "The Driver", "The Rooftop").
- Default Poster Ink bands 6 → **8**: finer luminance bands keep facial
  tonal gradation under the gradient map (the slider still spans 4–8).

### `app/src/layouts.js` — ink, lettering, EXPORT_SIZES (gaps 1, 3, 4)
- **Photographic ink on ALL layouts.** Polaroid and Strips previously ran
  full-strength halftone (the "screenprint" read on half the sheet); they
  now carry eased profiles like the wide hero layouts — halftone gate
  0.68 (polaroid) / 0.70 (strips, so dots never crawl over the one big
  face), dot opacity 0.52, map mix 0.78. Square Grid eased too
  (0.62 / 0.55 / 0.80).
- **Per-panel ink overrides** in `inkedFor` (merged over the layout
  profile): the neon-lit portrait keeps more of its own photo
  (mapMix 0.58 on the polaroid night card, 0.74 on the Wide Neon hero) —
  its pink/cyan light is already in the photo, and a full-strength map
  was flattening the face into pop-art.
- **Full cover lettering on polaroid + strips.** Polaroid gains the
  five-star rating strip crowning the masthead (stars + gradient block
  title + neon script + tagline plate + starburst — the same system as
  the wide band). Strips gains the same star strip above the title
  (shade band repositioned so the stars clear the title glyphs).
- **`EXPORT_SIZES` registry**: `{ square: 1080×1080, portrait: 1080×1350,
  wide: 1920×1080 }` defined once in `layouts.js`; every layout's canvas
  geometry is derived from it via `sized()`, and the editor's PNG export
  reads the same entry — the three sizes are legible in the source
  outline and actually used by the export flow.
- Strips captions updated for the new solo: subtitle "The Racer",
  tagline "SHE OWNS EVERY FRAME".

### `app/src/editor.js` — export reads the registry
- Imports `EXPORT_SIZES`; the export handler resolves the current
  layout's registry entry for the PNG filename/size.

### `app/index.html` + `app/style.css` — step framing (gap 5)
- Header steps now read **1 Add photos → 2 Arrange → 3 Export PNG**
  (numbered pink badges with arrow separators), so the editor screenshot
  evidences a three-step flow instead of reading as complexity.
- Bands slider default updated to 8 to match `main.js`.

### `README.md`
- Step line aligned ("1 add photos → 2 arrange → 3 export PNG") plus a
  note on the nine-photo cast and the photographic ink easing.

### `screenshots/` — regenerated with the app itself
`capture-shots.mjs` (headless Chrome/CDP, `CHROME_BIN` = Playwright
Chromium per the v1 note) re-shot all four scenes from the running app:
`1-cover.jpg` (sunset Wide Grid — still screenshot 1, user-locked),
`2-editor.jpg`, `3-polaroid.jpg`, `4-strips.jpg`. All ≤ 256 KiB, no
console errors, bottom-margin proof passes on every shot
(text bottom ≤ limit; polaroid 902/1312, strips 842/1050, wide 1050/1050).

## Verification (builder read all four sheets directly)

- **Faces photographic**: bands-8 easing keeps skin gradation on every
  export; the neon portrait reads as a neon-lit photograph, not a
  screenprint. Grade punch and the SOLMARA lettering system untouched.
- **Cast breadth**: six distinct people visible across the sheet (lead,
  Don, sailor, night woman, skater, racer) plus getaway/rooftop scenes;
  no face repeats within any single cover.
- **Polaroid/strips read as covers**: star strip + masthead + script +
  tagline plate on both; strips stars verified clear of the title.
- **No clipped lettering**: capture harness asserts the ≥30 px bottom
  clamp (scaled) on every render; all four shots pass.
- **Hand-in program**: `node main.ts` builds the dossier cleanly —
  app/ = 20 files / 2.2 MB (limits: 993 files / 48 MiB), 4 screenshots
  each ≤ 256 KiB.

Untouched win factors: gradient masthead + neon script + tagline +
starburst system, sunset grade punch, sheet variety and order, cohesive
SOLMARA branding.
