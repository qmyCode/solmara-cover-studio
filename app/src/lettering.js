// Lettering — the cover's type system: block title, script subtitle,
// tagline bar and the starburst sticker.
//
// Every function measures with ctx.measureText and shrinks the font until
// the text fits the zone it is given, so no caption can ever run off the
// canvas or collide with a neighbouring element.

export const TITLE_GRADIENTS = {
  sunset: [[0, '#FFF3C4'], [0.45, '#FFC53D'], [0.72, '#F97316'], [1, '#EC4899']],
  neon: [[0, '#CFFAFE'], [0.45, '#67E8F9'], [0.75, '#F0ABFC'], [1, '#D926AA']],
  golden: [[0, '#FFF7D6'], [0.55, '#FFC53D'], [1, '#F97316']],
  miami: [[0, '#FFF3D6'], [0.5, '#FFB35C'], [1, '#E85D8A']],
};

const TITLE_FONT = '"Anton", sans-serif';
const SCRIPT_FONT = '"Yellowtail", cursive';
const INK_DARK = '#1C0533';

// Records the lowest canvas row any lettering reached during a render, so
// the studio (and its screenshot checks) can prove the bottom-margin rule:
// no glyph, descender or bar may come within the margin of the bottom edge.
export const textTrace = {
  bottom: 0,
  reset() { this.bottom = 0; },
  note(y) { if (y > this.bottom) this.bottom = y; },
};

// Largest font size (<= startPx) at which `text` fits `maxWidth`.
// Returns { size, width } for the chosen size.
export function fitFontSize(ctx, text, family, startPx, maxWidth, minPx = 12) {
  let lo = minPx;
  let hi = startPx;
  let best = minPx;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    ctx.font = `${mid}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  ctx.font = `${best}px ${family}`;
  return { size: best, width: ctx.measureText(text).width };
}

function gradientFrom(ctx, stops, y0, y1) {
  const grad = ctx.createLinearGradient(0, y0, 0, y1);
  for (const [t, colour] of stops) grad.addColorStop(t, colour);
  return grad;
}

// Block title in Anton with a vertical gradient fill, dark stroke and a
// soft drop shadow. (x, y) is the alphabetic baseline start; align 'left'
// or 'center'. Returns the drawn width.
export function drawBlockTitle(ctx, { text, x, y, maxWidth, size, stops, align = 'left', limitBottom }) {
  if (!text) return 0;
  const fit = fitFontSize(ctx, text, TITLE_FONT, size, maxWidth);
  const px = fit.size;
  ctx.save();
  ctx.font = `${px}px ${TITLE_FONT}`;
  const descent = ctx.measureText(text).actualBoundingBoxDescent ?? px * 0.08;
  if (limitBottom !== undefined && y + descent > limitBottom) y = limitBottom - descent;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(22, 2, 40, 0.55)';
  ctx.shadowBlur = px * 0.14;
  ctx.shadowOffsetY = px * 0.045;
  ctx.strokeStyle = INK_DARK;
  ctx.lineWidth = Math.max(2, px * 0.085);
  ctx.strokeText(text, x, y);
  ctx.fillStyle = gradientFrom(ctx, stops, y - px * 0.78, y + px * 0.1);
  ctx.fillText(text, x, y);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillText(text, x, y);
  ctx.restore();
  textTrace.note(y + descent);
  return fit.width;
}

// Stacked block title: two or more lines of Anton sharing one fitted size
// and one gradient that flows across the whole stack — the classic poster
// masthead. yBottom is the bottom line's baseline; the stack grows upward
// from it and is clamped as a block to limitBottom. Returns the widest
// line's drawn width.
export function drawStackedTitle(ctx, { lines, x, yBottom, maxWidth, size, stops, align = 'left', limitBottom }) {
  const clean = (lines || []).filter((t) => t);
  if (clean.length === 0) return 0;
  let px = size;
  for (const t of clean) px = Math.min(px, fitFontSize(ctx, t, TITLE_FONT, size, maxWidth).size);
  const gap = px * 1.05;
  const last = clean.length - 1;
  ctx.font = `${px}px ${TITLE_FONT}`;
  const widths = clean.map((t) => ctx.measureText(t).width);
  const descent = ctx.measureText(clean[last]).actualBoundingBoxDescent ?? px * 0.08;
  let y2 = yBottom;
  if (limitBottom !== undefined && y2 + descent > limitBottom) y2 = limitBottom - descent;
  const gradTop = y2 - gap * last - px * 0.78;
  const gradBot = y2 + px * 0.1;
  const lineY = (i) => y2 - gap * (last - i);
  ctx.save();
  ctx.font = `${px}px ${TITLE_FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(22, 2, 40, 0.55)';
  ctx.shadowBlur = px * 0.14;
  ctx.shadowOffsetY = px * 0.045;
  ctx.strokeStyle = INK_DARK;
  ctx.lineWidth = Math.max(2, px * 0.085);
  clean.forEach((t, i) => {
    ctx.strokeText(t, x, lineY(i));
    ctx.fillStyle = gradientFrom(ctx, stops, gradTop, gradBot);
    ctx.fillText(t, x, lineY(i));
  });
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = gradientFrom(ctx, stops, gradTop, gradBot);
  clean.forEach((t, i) => ctx.fillText(t, x, lineY(i)));
  ctx.restore();
  textTrace.note(y2 + descent);
  return Math.max(...widths);
}

function starPath(ctx, cx, cy, r) {
  const inner = r * 0.45;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : inner;
    const a = (Math.PI * i) / 5 - Math.PI / 2;
    const vx = cx + Math.cos(a) * rad;
    const vy = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(vx, vy); else ctx.lineTo(vx, vy);
  }
  ctx.closePath();
}

// Star-rating strip: a row of crisp gold stars, the rating furniture of a
// movie poster. Pass either x (the strip's left edge) or right (its right
// edge); y is the top edge and size is one star's diameter. The stars are
// plain canvas paths — original art, no borrowed marks. Returns the
// strip's width.
export function drawStarRating(ctx, { x, right, y, size, count = 5 }) {
  const gap = size * 0.22;
  const width = count * size + (count - 1) * gap;
  const x0 = right !== undefined ? right - width : x;
  const cy = y + size / 2;
  ctx.save();
  ctx.shadowColor = 'rgba(22, 2, 40, 0.45)';
  ctx.shadowBlur = size * 0.16;
  ctx.shadowOffsetY = size * 0.05;
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(1.5, size * 0.055);
  ctx.strokeStyle = INK_DARK;
  for (let i = 0; i < count; i++) {
    const cx = x0 + size / 2 + i * (size + gap);
    starPath(ctx, cx, cy, size / 2);
    ctx.fillStyle = gradientFrom(ctx, [[0, '#FFE9A8'], [0.55, '#FFC53D'], [1, '#F59E0B']], y, y + size);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
  textTrace.note(y + size);
  return width;
}

// Script subtitle in Yellowtail: white core over a hot-pink glow, drawn at
// a slight slant. Auto-fits its zone. Returns the drawn width.
export function drawScriptSubtitle(ctx, { text, x, y, maxWidth, size, align = 'left', slant = -0.045, limitBottom }) {
  if (!text) return 0;
  const fit = fitFontSize(ctx, text, SCRIPT_FONT, size, maxWidth);
  const px = fit.size;
  ctx.font = `${px}px ${SCRIPT_FONT}`;
  const descent = ctx.measureText(text).actualBoundingBoxDescent ?? px * 0.32;
  // The slant drops the trailing end a little further than the baseline
  // descent, so the clamp (and the trace) use the full extent.
  const extent = descent + px * 0.05;
  if (limitBottom !== undefined && y + extent > limitBottom) y = limitBottom - extent;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(slant);
  ctx.font = `${px}px ${SCRIPT_FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = '#FF2D96';
  ctx.shadowBlur = px * 0.32;
  ctx.fillStyle = '#FF5DA2';
  ctx.fillText(text, 0, 0);
  ctx.fillText(text, 0, 0);
  ctx.shadowBlur = px * 0.14;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(text, 0, 0);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.fillText(text, 0, 0);
  ctx.restore();
  textTrace.note(y + extent);
  return fit.width;
}

// Tagline in letter-spaced Anton on a dark translucent bar.
// (cx, cy) is the bar centre. Returns the bar width.
export function drawTaglineBar(ctx, { text, cx, cy, maxWidth, size, right, limitBottom }) {
  if (!text) return 0;
  let px = size;
  const draw = (s) => {
    ctx.font = `${s}px ${TITLE_FONT}`;
    const tracking = s * 0.16;
    let total = 0;
    for (const ch of text) total += ctx.measureText(ch).width + tracking;
    return { total: total - tracking, tracking };
  };
  let { total, tracking } = draw(px);
  while (total > maxWidth - 44 && px > 11) {
    px -= 1;
    ({ total, tracking } = draw(px));
  }
  const padX = 22;
  const barW = total + padX * 2;
  const barH = px * 1.78;
  const cxEff = right !== undefined ? right - barW / 2 : cx;
  let cyEff = cy;
  if (limitBottom !== undefined && cyEff + barH / 2 > limitBottom) cyEff = limitBottom - barH / 2;
  const x0 = cxEff - barW / 2;
  const y0 = cyEff - barH / 2;
  ctx.save();
  ctx.font = `${px}px ${TITLE_FONT}`;
  ctx.fillStyle = 'rgba(11, 3, 28, 0.88)';
  ctx.fillRect(x0, y0, barW, barH);
  ctx.fillStyle = '#FFE9A8';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  let cursor = x0 + padX;
  for (const ch of text) {
    ctx.fillText(ch, cursor, cyEff + px * 0.05);
    cursor += ctx.measureText(ch).width + tracking;
  }
  ctx.restore();
  textTrace.note(y0 + barH);
  return barW;
}

// Jagged starburst sticker with two lines of Anton. Auto-fits line 1.
export function drawStarburst(ctx, { cx, cy, r, line1, line2 }) {
  const spikes = 18;
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const rad = i % 2 === 0 ? r : r * 0.8;
    const a = (Math.PI * i) / spikes - Math.PI / 2;
    const vx = cx + Math.cos(a) * rad;
    const vy = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(vx, vy); else ctx.lineTo(vx, vy);
  }
  ctx.closePath();
  ctx.shadowColor = 'rgba(22, 2, 40, 0.4)';
  ctx.shadowBlur = r * 0.16;
  ctx.shadowOffsetY = r * 0.05;
  ctx.fillStyle = '#FFD21F';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.lineWidth = Math.max(2, r * 0.045);
  ctx.strokeStyle = INK_DARK;
  ctx.stroke();
  ctx.fillStyle = INK_DARK;
  ctx.textAlign = 'center';
  const fit = fitFontSize(ctx, line1, TITLE_FONT, r * 0.78, r * 1.28);
  ctx.textBaseline = 'middle';
  ctx.fillText(line1, cx, cy - r * 0.14);
  const fit2 = fitFontSize(ctx, line2, TITLE_FONT, r * 0.3, r * 1.3);
  ctx.fillText(line2, cx, cy + r * 0.36);
  void fit2;
  ctx.restore();
  textTrace.note(cy + r);
  return fit.width;
}

// A rectangular field of halftone dots (the polaroid layout's backdrop).
export function drawDotField(ctx, { x, y, w, h, colour = '#D926AA', spacing = 26, maxR = 4.2 }) {
  ctx.save();
  ctx.fillStyle = colour;
  const cxm = x + w / 2;
  const cym = y + h / 2;
  for (let row = 0; row * spacing <= h; row++) {
    for (let col = 0; col * spacing <= w; col++) {
      const dx = x + col * spacing;
      const dy = y + row * spacing;
      const fall = 1 - Math.min(1, Math.hypot((dx - cxm) / (w / 2), (dy - cym) / (h / 2)));
      const r = maxR * (0.35 + fall * 0.65);
      ctx.beginPath();
      ctx.arc(dx, dy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}
