// Layouts — the five cover compositions.
//
// Each layout owns its geometry: photo panels (cover-fit crops driven by a
// per-panel { photo, ox, oy, zoom } state whose defaults come from a focal
// point, so faces stay whole), the title band or title block, and the
// lettering zones. Lettering is always placed inside fixed zones with a
// hard bottom limit — no text may approach the canvas's bottom edge.

import { inkPhoto } from './ink.js';
import {
  TITLE_GRADIENTS,
  drawBlockTitle,
  drawStackedTitle,
  drawStarRating,
  drawScriptSubtitle,
  drawTaglineBar,
  drawStarburst,
  drawDotField,
  textTrace,
} from './lettering.js';

const GUTTER = 12;
const STICKER_LINE_1 = 'HOT';
const STICKER_LINE_2 = "SUMMER '26";

// Bottom-margin rule: nothing drawn by lettering may pass this row
// (30px at 1080 tall, scaled proportionally for other canvas heights).
export function bottomLimit(h) {
  return h - Math.round((30 * h) / 1080);
}

function clamp01(v) {
  return Math.min(1, Math.max(0, v));
}

// Last computed draw metrics per "layoutId:panelKey", for the editor's
// drag/zoom maths.
const metrics = new Map();
export function panelMetrics(layoutId, key) {
  return metrics.get(`${layoutId}:${key}`);
}

// Resolve a panel's effective state: layout defaults (photo + focal point)
// underneath the user's edits for this layout.
function panelState(view, layout, def) {
  const edit = (view.edits[layout.id] && view.edits[layout.id][def.key]) || {};
  return {
    photo: edit.photo !== undefined ? edit.photo : def.photo,
    ox: edit.ox,
    oy: edit.oy,
    zoom: edit.zoom !== undefined ? edit.zoom : def.zoom || 1,
    fx: def.fx !== undefined ? def.fx : 0.5,
    fy: def.fy !== undefined ? def.fy : 0.4,
  };
}

// Face ease (V3): portrait-dominant panels keep more of the photograph —
// a lighter gradient-map mix, halftone gated to the deepest shadows and
// softer when it lands — so faces keep photographic detail (skin, eyes,
// hair) instead of blowing out into flat poster bands. Scene panels
// (skylines, cars, rooftops) carry no panel override and keep the full
// sunset/neon grade punch of their layout profile.
const FACE_INK = { mapMix: 0.66, htGate: 0.8, htOpacity: 0.4 };

function inkedFor(view, layout, def) {
  const photo = view.photos[def.photoIndex % view.photos.length];
  const grade = def.grade ? def.grade(view) : view.grade;
  // A panel may soften the layout's ink profile for its own photo (the
  // neon-lit portrait needs less gradient map — its light is already in
  // the photo, and a full-strength map flattens the face).
  const opts = def.inkOpts ? { ...layout.inkOpts, ...def.inkOpts } : layout.inkOpts;
  return inkPhoto(photo, grade, view.bands, view.halftone, view.strength, opts);
}

// Draw one panel: the inked photo, cover-fitted into def.rect, positioned
// by the panel state (focal point by default, explicit offsets after the
// user drags). Records metrics for the editor.
export function drawPanel(ctx, view, layout, def, target) {
  const st = panelState(view, layout, def);
  const src = inkedFor(view, layout, { ...def, photoIndex: st.photo });
  const rect = target || def.rect;
  const scale = Math.max(rect.w / src.width, rect.h / src.height) * st.zoom;
  const dw = src.width * scale;
  const dh = src.height * scale;
  const maxX = Math.max(0, dw - rect.w);
  const maxY = Math.max(0, dh - rect.h);
  const ox = st.ox !== undefined ? st.ox : (maxX > 0 ? clamp01((st.fx * dw - rect.w / 2) / maxX) : 0);
  const oy = st.oy !== undefined ? st.oy : (maxY > 0 ? clamp01((st.fy * dh - rect.h / 2) / maxY) : 0);
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.drawImage(src, rect.x - ox * maxX, rect.y - oy * maxY, dw, dh);
  ctx.restore();
  metrics.set(`${layout.id}:${def.key}`, { rect, dw, dh, maxX, maxY, ox, oy, zoom: st.zoom, photo: st.photo });
  return src;
}

function fillCanvas(ctx, w, h, colour) {
  ctx.fillStyle = colour;
  ctx.fillRect(0, 0, w, h);
}

function gradientKeyFor(view, layout) {
  if (view.grade === 'neon') return 'neon';
  if (view.grade === 'golden') return 'golden';
  if (view.grade === 'miami') return 'miami';
  return layout.titleGradient || 'sunset';
}

// The wide/square title band: dark gradient strip with fixed zones —
// title left (a stacked two-line masthead on layouts that ask for it,
// one line otherwise), tagline top-right with the star-rating strip under
// it on hero layouts, script subtitle lower-right of the title.
// Zones never overlap, and every element is clamped to the bottom limit.
function drawTitleBand(ctx, view, layout, band, opts) {
  const [bandTop, bandBottom] = layout.band || ['#2C0A4E', '#14022A'];
  const grad = ctx.createLinearGradient(0, band.y, 0, band.y + band.h);
  grad.addColorStop(0, bandTop);
  grad.addColorStop(1, bandBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(band.x, band.y, band.w, band.h);

  // A layout may cap its band with a glowing neon horizon line where the
  // panels meet the title strip — the city-lights layouts use it.
  if (layout.bandGlow) {
    const glowH = Math.max(3, Math.round((5 * layout.h) / 1080));
    ctx.save();
    ctx.shadowColor = layout.bandGlow;
    ctx.shadowBlur = 22;
    ctx.fillStyle = layout.bandGlow;
    ctx.fillRect(band.x, band.y, band.w, glowH);
    ctx.fillRect(band.x, band.y, band.w, glowH);
    ctx.restore();
  }

  const limit = bottomLimit(layout.h);
  const stops = TITLE_GRADIENTS[gradientKeyFor(view, layout)];
  const baseline = band.y + band.h - Math.round((34 * layout.h) / 1080);

  drawTaglineBar(ctx, {
    text: view.tagline,
    right: band.x + band.w - opts.padX,
    cy: band.y + opts.taglineCy,
    maxWidth: opts.taglineMaxW,
    size: opts.taglineSize,
    limitBottom: limit,
  });

  if (layout.starRating) {
    drawStarRating(ctx, {
      right: band.x + band.w - opts.padX,
      y: band.y + opts.taglineCy + (opts.taglineSize * 1.78) / 2 + Math.round((14 * layout.h) / 1080),
      size: opts.starSize,
      count: 5,
    });
  }

  const titleW = layout.stackedTitle && view.title && view.titleLine2
    ? drawStackedTitle(ctx, {
      lines: [view.title, view.titleLine2],
      x: band.x + opts.padX,
      yBottom: baseline,
      maxWidth: opts.titleMaxW,
      size: opts.stackedSize,
      stops,
      limitBottom: limit,
    })
    : drawBlockTitle(ctx, {
      text: view.title,
      x: band.x + opts.padX,
      y: baseline,
      maxWidth: opts.titleMaxW,
      size: opts.titleSize,
      stops,
      limitBottom: limit,
    });

  const subX = band.x + opts.padX + titleW + opts.subGap;
  drawScriptSubtitle(ctx, {
    text: view.subtitle,
    x: subX,
    y: baseline + 2,
    maxWidth: band.x + band.w - opts.padX - subX,
    size: opts.subSize,
    limitBottom: limit,
  });
}

function stickerOnHero(ctx, view, cx, cy, r) {
  if (view.sticker) drawStarburst(ctx, { cx, cy, r, line1: STICKER_LINE_1, line2: STICKER_LINE_2 });
}

// ---------------------------------------------------------------- Wide grid
const widePanels = [
  { key: 'hero', rect: { x: 0, y: 0, w: 730, h: 752 }, photo: 0, fx: 0.46, fy: 0.30, inkOpts: FACE_INK },
  { key: 'couple', rect: { x: 742, y: 0, w: 610, h: 370 }, photo: 6, fx: 0.42, fy: 0.50 },
  { key: 'skyline', rect: { x: 742, y: 382, w: 610, h: 370 }, photo: 8, fx: 0.5, fy: 0.55 },
  { key: 'driver', rect: { x: 1364, y: 0, w: 556, h: 752 }, photo: 2, fx: 0.62, fy: 0.30, inkOpts: FACE_INK },
];

// The wide band is tall enough to carry the stacked two-line masthead.
const WIDE_BAND_H = 328;
const wideBandOpts = { padX: 48, titleSize: 218, stackedSize: 158, starSize: 30, titleMaxW: 1000, subSize: 118, subGap: 30, taglineCy: 74, taglineMaxW: 700, taglineSize: 38 };

function renderWide(ctx, view, layout) {
  fillCanvas(ctx, layout.w, layout.h, '#000000');
  for (const def of layout.panels) drawPanel(ctx, view, layout, def);
  stickerOnHero(ctx, view, 118, 118, 88);
  drawTitleBand(ctx, view, layout, { x: 0, y: layout.h - WIDE_BAND_H, w: layout.w, h: WIDE_BAND_H }, wideBandOpts);
}

// ---------------------------------------------------------------- Wide neon
// The city is the hero here: the skyline runs as a full-width banner of
// night lights across the top, and the three character panels sit under
// it like a cast strip on a movie poster.
const neonPanels = [
  { key: 'skyline', rect: { x: 0, y: 0, w: 1920, h: 400 }, photo: 8, fx: 0.5, fy: 0.25 },
  { key: 'hero', rect: { x: 0, y: 412, w: 620, h: 340 }, photo: 3, fx: 0.45, fy: 0.32, inkOpts: { mapMix: 0.62, htGate: 0.8, htOpacity: 0.4 } },
  { key: 'couple', rect: { x: 632, y: 412, w: 620, h: 340 }, photo: 1, fx: 0.5, fy: 0.28, inkOpts: FACE_INK },
  { key: 'driver', rect: { x: 1264, y: 412, w: 656, h: 340 }, photo: 7, fx: 0.5, fy: 0.42 },
];

// --------------------------------------------------------------- Square grid
const gridPanels = [
  { key: 'hero', rect: { x: 0, y: 0, w: 534, h: 424 }, photo: 0, fx: 0.46, fy: 0.30, inkOpts: FACE_INK },
  { key: 'couple', rect: { x: 546, y: 0, w: 534, h: 424 }, photo: 5, fx: 0.55, fy: 0.30, inkOpts: FACE_INK },
  { key: 'driver', rect: { x: 0, y: 436, w: 534, h: 424 }, photo: 4, fx: 0.5, fy: 0.30, inkOpts: FACE_INK },
  { key: 'skyline', rect: { x: 546, y: 436, w: 534, h: 424 }, photo: 8, fx: 0.5, fy: 0.55 },
];

const gridBand = { x: 0, y: 872, w: 1080, h: 208 };
const gridBandOpts = { padX: 36, titleSize: 148, titleMaxW: 552, subSize: 82, subGap: 22, taglineCy: 54, taglineMaxW: 424, taglineSize: 33 };

function renderGrid(ctx, view, layout) {
  fillCanvas(ctx, layout.w, layout.h, '#000000');
  for (const def of layout.panels) drawPanel(ctx, view, layout, def);
  stickerOnHero(ctx, view, 84, 84, 64);
  drawTitleBand(ctx, view, layout, gridBand, gridBandOpts);
}

// ----------------------------------------------------------- Portrait polaroid
const CARD_W = 458;
const CARD_H = 429;
const polaroidCards = [
  { key: 'hero', cx: 272, cy: 252, rot: -0.087, photo: 0, fx: 0.46, fy: 0.30, inkOpts: FACE_INK },
  { key: 'skyline', cx: 808, cy: 242, rot: 0.07, photo: 8, fx: 0.5, fy: 0.5 },
  // The night card carries a neon accent when the cover grade is sunset,
  // the way a night shot sits among golden-hour prints.
  { key: 'driver', cx: 282, cy: 1118, rot: 0.07, photo: 3, fx: 0.45, fy: 0.32, grade: (view) => (view.grade === 'sunset' ? 'neon' : view.grade), inkOpts: { mapMix: 0.58, htGate: 0.82, htOpacity: 0.38 } },
  { key: 'couple', cx: 798, cy: 1112, rot: -0.07, photo: 6, fx: 0.42, fy: 0.50 },
];

function renderPolaroid(ctx, view, layout) {
  fillCanvas(ctx, layout.w, layout.h, '#150329');
  drawDotField(ctx, { x: 90, y: 548, w: 900, h: 250 });

  for (const card of polaroidCards) {
    // Build the print on its own canvas, then place it rotated.
    const print = document.createElement('canvas');
    print.width = CARD_W;
    print.height = CARD_H;
    const pctx = print.getContext('2d');
    pctx.fillStyle = '#FFFFFF';
    pctx.fillRect(0, 0, CARD_W, CARD_H);
    drawPanel(pctx, view, layout, { ...card, rect: { x: 14, y: 14, w: CARD_W - 28, h: 335 } }, { x: 14, y: 14, w: CARD_W - 28, h: 335 });
    ctx.save();
    ctx.translate(card.cx, card.cy);
    ctx.rotate(card.rot);
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 12;
    ctx.drawImage(print, -CARD_W / 2, -CARD_H / 2);
    ctx.restore();
    // Keep the print render's drag metrics; only the rect becomes the
    // card's bounding box on the cover.
    const m = metrics.get(`${layout.id}:${card.key}`);
    if (m) {
      metrics.set(`${layout.id}:${card.key}`, {
        ...m,
        rect: { x: card.cx - CARD_W / 2, y: card.cy - CARD_H / 2, w: CARD_W, h: CARD_H },
      });
    }
  }

  const limit = bottomLimit(layout.h);
  const stops = TITLE_GRADIENTS[gradientKeyFor(view, layout)];
  // The full cover treatment, same as the wide band: a five-star rating
  // strip crowns the masthead so the portrait reads as a magazine cover,
  // not a postcard — stars, block title, script and tagline plate.
  const starSize = 34;
  const starW = drawStarRating(ctx, {
    x: layout.w / 2 - (5 * starSize + 4 * starSize * 0.22) / 2, y: 506, size: starSize, count: 5,
  });
  void starW;
  drawBlockTitle(ctx, {
    text: view.title, x: layout.w / 2, y: 716, maxWidth: 920, size: 168,
    stops, align: 'center', limitBottom: limit,
  });
  drawScriptSubtitle(ctx, {
    text: view.subtitle, x: 606, y: 812, maxWidth: 720, size: 100,
    align: 'center', limitBottom: limit,
  });
  drawTaglineBar(ctx, {
    text: view.tagline, cx: layout.w / 2, cy: 872, maxWidth: 700, size: 34, limitBottom: limit,
  });
  stickerOnHero(ctx, view, 96, 84, 58);
}

// -------------------------------------------------------------- Square strips
// One photo, rendered ONCE as a single cover-fit image, then sliced into
// five vertical strips nudged by tiny vertical offsets (±3%). The face
// appears once, aligned across the strips.
const STRIP_OFFSETS = [0, 0.02, -0.03, 0.015, -0.01];
// The strips panel is one big face wall-to-wall, so it takes the
// strongest face ease in the set: dots gated out of everything but the
// deepest shadow, the map thinned back so the portrait stays a photo.
const stripsPanel = { key: 'strips', rect: { x: 0, y: 0, w: 1080, h: 1080 }, photo: 5, fx: 0.55, fy: 0.30, inkOpts: { mapMix: 0.66, htGate: 0.82, htOpacity: 0.38 } };

function renderStrips(ctx, view, layout) {
  fillCanvas(ctx, layout.w, layout.h, '#000000');
  const full = document.createElement('canvas');
  full.width = layout.w;
  full.height = layout.h;
  const fctx = full.getContext('2d');
  drawPanel(fctx, view, layout, stripsPanel, { x: 0, y: 0, w: layout.w, h: layout.h });

  const stripW = layout.w / 5;
  const over = Math.ceil(layout.h * 0.07); // overscan so offsets never bare an edge
  for (let i = 0; i < 5; i++) {
    const dy = Math.round(STRIP_OFFSETS[i] * layout.h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(i * stripW, 0, stripW, layout.h);
    ctx.clip();
    ctx.drawImage(full, 0, dy - over / 2, layout.w, layout.h + over);
    ctx.restore();
  }
  ctx.fillStyle = '#000000';
  for (let i = 1; i < 5; i++) ctx.fillRect(i * stripW - 3, 0, 6, layout.h);

  // Centre shade behind the lettering.
  ctx.fillStyle = 'rgba(14, 3, 32, 0.40)';
  ctx.fillRect(0, 408, layout.w, 284);

  const limit = bottomLimit(layout.h);
  const stops = TITLE_GRADIENTS[gradientKeyFor(view, layout)];
  // Star strip over the title, like the other covers — the strips carry
  // the same lettering system, not a caption pasted on a photo.
  const stripStarSize = 30;
  drawStarRating(ctx, {
    x: layout.w / 2 - (5 * stripStarSize + 4 * stripStarSize * 0.22) / 2, y: 420, size: stripStarSize, count: 5,
  });
  drawBlockTitle(ctx, {
    text: view.title, x: layout.w / 2, y: 640, maxWidth: 940, size: 186,
    stops, align: 'center', limitBottom: limit,
  });
  drawScriptSubtitle(ctx, {
    text: view.subtitle, x: 596, y: 742, maxWidth: 700, size: 92,
    align: 'center', limitBottom: limit,
  });
  drawTaglineBar(ctx, {
    text: view.tagline, cx: layout.w / 2, cy: 812, maxWidth: 620, size: 34, limitBottom: limit,
  });
}

// ------------------------------------------------------------------ Registry
// The three export sizes, named once and used everywhere: every layout's
// canvas geometry comes from this registry, the editor's size buttons and
// PNG export read the same entries, so a cover always lands on an exact
// post size — 1080×1080 square, 1080×1350 portrait, 1920×1080 wide.
export const EXPORT_SIZES = {
  square: { key: 'square', w: 1080, h: 1080, label: '1080 × 1080' },
  portrait: { key: 'portrait', w: 1080, h: 1350, label: '1080 × 1350' },
  wide: { key: 'wide', w: 1920, h: 1080, label: '1920 × 1080' },
};

function sized(sizeKey) {
  const s = EXPORT_SIZES[sizeKey];
  return { exportSize: sizeKey, w: s.w, h: s.h, size: s.label };
}

export const LAYOUTS = [
  {
    id: 'wide', name: 'Wide Grid', ...sized('wide'),
    defaultGrade: 'sunset', titleGradient: 'sunset',
    stackedTitle: true, starRating: true,
    // Eased ink: dots only in the deep shadows and softer when they land,
    // a lighter map mix — faces stay photographic, the poster grade stays.
    inkOpts: { htGate: 0.64, htOpacity: 0.52, mapMix: 0.78 },
    captions: { subtitle: 'Bay of Sirens', tagline: 'EVERY SUNSET HAS A PRICE', titleLine2: 'NIGHTS' },
    panels: widePanels, render: renderWide,
  },
  {
    id: 'neon', name: 'Wide Neon', ...sized('wide'),
    defaultGrade: 'neon', titleGradient: 'neon',
    stackedTitle: true, starRating: true,
    // Night-city band: near-black indigo under a hot-pink neon horizon.
    band: ['#150838', '#030110'], bandGlow: '#FF2D96',
    // Eased halftone like the hero, but the map mix runs at full strength
    // so the neon grade owns the night.
    inkOpts: { htGate: 0.64, htOpacity: 0.52, mapMix: 0.86 },
    captions: { subtitle: 'Neon Confessions', tagline: 'THE CITY PAYS IN NEON', titleLine2: 'NIGHTS' },
    panels: neonPanels, render: renderWide,
  },
  {
    id: 'polaroid', name: 'Portrait Polaroid', ...sized('portrait'),
    defaultGrade: 'sunset', titleGradient: 'sunset',
    // The photographic ink easing applies here too — v1 ran the prints at
    // full halftone strength and the faces read as screenprint.
    inkOpts: { htGate: 0.68, htOpacity: 0.52, mapMix: 0.78 },
    captions: { subtitle: 'Postcards from the Bay', tagline: 'WISH YOU WERE HERE' },
    panels: polaroidCards, render: renderPolaroid,
  },
  {
    id: 'strips', name: 'Square Strips', ...sized('square'),
    defaultGrade: 'golden', titleGradient: 'golden',
    // Eased like every other layout: the sliced face stays photographic,
    // halftone only in the deepest shadows (a higher gate than the wide
    // hero — the dots must not crawl over the one big face).
    inkOpts: { htGate: 0.70, htOpacity: 0.52, mapMix: 0.78 },
    captions: { subtitle: 'The Racer', tagline: 'SHE OWNS EVERY FRAME' },
    panels: [stripsPanel], render: renderStrips,
  },
  {
    id: 'grid', name: 'Square Grid', ...sized('square'),
    defaultGrade: 'sunset', titleGradient: 'sunset',
    inkOpts: { htGate: 0.62, htOpacity: 0.55, mapMix: 0.80 },
    captions: { subtitle: 'Bay of Sirens', tagline: 'EVERY SUNSET HAS A PRICE' },
    panels: gridPanels, render: renderGrid,
  },
];

export function layoutById(id) {
  return LAYOUTS.find((l) => l.id === id) || LAYOUTS[0];
}

// Panel hit-rects in canvas coordinates, topmost last.
export function hitPanels(layout) {
  if (layout.id === 'polaroid') {
    return polaroidCards.map((c) => ({
      key: c.key,
      rect: { x: c.cx - CARD_W / 2, y: c.cy - CARD_H / 2, w: CARD_W, h: CARD_H },
    }));
  }
  return layout.panels.map((p) => ({ key: p.key, rect: p.rect }));
}

export { textTrace };
