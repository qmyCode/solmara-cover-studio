// Poster Ink engine — turns one photo into flat-band poster art.
//
// Pipeline per photo: luminance is posterized into a small number of flat
// bands, each band is recoloured through the active grade's gradient map
// (mixed 84% mapped colour / 16% original photo), and a halftone dot screen
// is punched into the shadow bands. A layout may ease the treatment with
// per-call options (a higher halftone gate so dots live only in the deep
// shadows, a softer dot opacity, a lighter map mix) so faces read more
// photographic while the poster character stays. Results are cached per
// (photo, grade, bands, halftone settings, ease options) so re-renders
// stay instant.

export const GRADES = [
  { id: 'sunset', label: 'Sunset', stops: [[0, '#2B0A46'], [0.24, '#8C1D5F'], [0.44, '#E23A54'], [0.62, '#F96D1B'], [0.78, '#FFB92E'], [0.9, '#FFD968'], [1, '#FFF3C4']] },
  { id: 'neon', label: 'Neon', stops: [[0, '#040118'], [0.22, '#2A0A5E'], [0.42, '#7C3AED'], [0.58, '#D926AA'], [0.72, '#FF2D96'], [0.86, '#22D3EE'], [1, '#FEF9FF']] },
  { id: 'golden', label: 'Golden', stops: [[0, '#3A2008'], [0.30, '#925414'], [0.55, '#D68A2C'], [0.78, '#F5C55A'], [1, '#FFF4CC']] },
  { id: 'miami', label: 'Miami', stops: [[0, '#062A3A'], [0.30, '#0E5A6D'], [0.55, '#E85D8A'], [0.80, '#FFB35C'], [1, '#FFF3D6']] },
];

const MAP_MIX = 0.84;          // gradient map vs original photo
const DOT_COLOUR = [30, 6, 54]; // halftone dot ink (deep violet)
const DOT_CELL = 9;             // halftone cell size in photo pixels

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Build a 256-entry RGB lookup table by interpolating a grade's stops.
function buildLut(stops) {
  const pts = stops.map(([t, hex]) => [t, hexToRgb(hex)]);
  const lut = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let a = pts[0];
    let b = pts[pts.length - 1];
    for (let s = 0; s < pts.length - 1; s++) {
      if (t >= pts[s][0] && t <= pts[s + 1][0]) { a = pts[s]; b = pts[s + 1]; break; }
    }
    const span = b[0] - a[0] || 1;
    const f = Math.min(1, Math.max(0, (t - a[0]) / span));
    for (let c = 0; c < 3; c++) lut[i * 3 + c] = Math.round(a[1][c] + (b[1][c] - a[1][c]) * f);
  }
  return lut;
}

const LUTS = {};
for (const grade of GRADES) LUTS[grade.id] = buildLut(grade.stops);

const cache = new Map();

// inkPhoto(photo, gradeId, bands, halftoneOn, strength, opts) -> canvas
// photo: { id, img } where img is a loaded HTMLImageElement.
// opts (all optional, defaults reproduce the full-strength treatment):
//   htGate    — darkness a band must exceed before dots appear (0.52)
//   htOpacity — how hard the dots ink over the band colour (0.82)
//   mapMix    — gradient map vs original photo mix (MAP_MIX)
export function inkPhoto(photo, gradeId, bands, halftoneOn, strength, opts = {}) {
  const htGate = opts.htGate !== undefined ? opts.htGate : 0.52;
  const htOpacity = opts.htOpacity !== undefined ? opts.htOpacity : 0.82;
  const mapMix = opts.mapMix !== undefined ? opts.mapMix : MAP_MIX;
  const key = [photo.id, gradeId, bands, halftoneOn ? 1 : 0, Math.round(strength * 20), htGate, htOpacity, mapMix].join('|');
  const hit = cache.get(key);
  if (hit) return hit;

  const img = photo.img;
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);

  const frame = ctx.getImageData(0, 0, w, h);
  const px = frame.data;
  const lut = LUTS[gradeId] || LUTS.sunset;
  const steps = Math.max(2, bands - 1);
  const keep = 1 - mapMix;
  const halfCell = DOT_CELL / 2;

  for (let y = 0; y < h; y++) {
    // halftone: distance from this row to the nearest dot-centre row
    const dy = Math.abs(((y % DOT_CELL) + DOT_CELL) % DOT_CELL - halfCell);
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = px[i];
      const g = px[i + 1];
      const b = px[i + 2];
      const lum = (r * 299 + g * 587 + b * 114) / 1000; // 0..255
      const band = Math.round((lum / 255) * steps) / steps;
      const li = Math.round(band * 255) * 3;
      let nr = lut[li] * mapMix + r * keep;
      let ng = lut[li + 1] * mapMix + g * keep;
      let nb = lut[li + 2] * mapMix + b * keep;

      if (halftoneOn) {
        const darkness = 1 - band;
        if (darkness > htGate) {
          const dx = Math.abs(((x % DOT_CELL) + DOT_CELL) % DOT_CELL - halfCell);
          const radius = ((darkness - htGate) / (1 - htGate)) * halfCell * (0.35 + strength * 0.85);
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < radius) {
            const inkAmt = htOpacity * Math.min(1, (radius - dist) / 1.5 + 0.55);
            nr = nr * (1 - inkAmt) + DOT_COLOUR[0] * inkAmt;
            ng = ng * (1 - inkAmt) + DOT_COLOUR[1] * inkAmt;
            nb = nb * (1 - inkAmt) + DOT_COLOUR[2] * inkAmt;
          }
        }
      }

      px[i] = nr;
      px[i + 1] = ng;
      px[i + 2] = nb;
    }
  }

  ctx.putImageData(frame, 0, 0);
  cache.set(key, canvas);
  return canvas;
}

export function inkCacheSize() {
  return cache.size;
}
