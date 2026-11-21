// SOLMARA Cover Studio — boot and shared state.
//
// Loads the bundled fonts and sample photos, auto-fills the first layout so
// the opening paint is already a finished cover, wires the editor, and
// renders the current layout to the stage canvas at full export size.

import { layoutById, hitPanels, bottomLimit, textTrace } from './layouts.js';
import { initEditor } from './editor.js';
import { runShotIfRequested } from './shots.js';

// The built-in cast: six distinct characters plus three scenes, shot as
// one ensemble so every layout reads as the same crime epic. Panel
// defaults in layouts.js draw on this order — a face appears at most once
// per cover, and the same cast recurs across layouts.
const SAMPLES = [
  { file: 'samples/cast-1.jpg', label: 'Mara · The Lead' },
  { file: 'samples/cast-2.jpg', label: 'The Sailor' },
  { file: 'samples/cast-3.jpg', label: 'The Don' },
  { file: 'samples/cast-4.jpg', label: 'Night Owl' },
  { file: 'samples/cast-5.jpg', label: 'The Skater' },
  { file: 'samples/cast-6.jpg', label: 'The Racer' },
  { file: 'samples/cast-7.jpg', label: 'The Getaway' },
  { file: 'samples/cast-8.jpg', label: 'The Driver' },
  { file: 'samples/cast-9.jpg', label: 'The Rooftop' },
];

export const state = {
  photos: [],
  layoutId: 'ensemble',
  grade: 'sunset',
  bands: 8,
  halftone: true,
  strength: 0.8,
  title: 'SOLMARA',
  titleLine2: 'NIGHTS',
  subtitle: 'Bay of Sirens',
  tagline: 'EVERY SUNSET HAS A PRICE',
  sticker: true,
  edits: {}, // { layoutId: { panelKey: { photo, ox, oy, zoom } } }
  selected: null,
};

let photoSeq = 0;
// A photo carries both a display label (the cast name for the bundled
// samples) and its source file name — the tray shows the file name, the
// way a photo editor lists what you actually loaded.
export function makePhoto(img, label, url, name) {
  photoSeq += 1;
  return { id: `p${photoSeq}`, img, label, url, name: name || label };
}

export function currentLayout() {
  return layoutById(state.layoutId);
}

export function view() {
  const layout = currentLayout();
  return {
    photos: state.photos,
    grade: state.grade,
    bands: state.bands,
    halftone: state.halftone,
    strength: state.strength,
    title: state.title,
    titleLine2: state.titleLine2,
    subtitle: state.subtitle,
    tagline: state.tagline,
    sticker: state.sticker,
    edits: state.edits,
    H: layout.h,
  };
}

const stage = document.getElementById('stage');
const stageCtx = stage.getContext('2d');

export function render() {
  if (state.photos.length === 0) return;
  const layout = currentLayout();
  if (stage.width !== layout.w) stage.width = layout.w;
  if (stage.height !== layout.h) stage.height = layout.h;
  textTrace.reset();
  layout.render(stageCtx, view(), layout);
  window.__textBottom = {
    bottom: Math.round(textTrace.bottom),
    limit: bottomLimit(layout.h),
    height: layout.h,
    layout: layout.id,
  };
  drawSelection(layout);
}

function drawSelection(layout) {
  if (!state.selected || document.body.classList.contains('shot-cover')) return;
  const hit = hitPanels(layout).find((p) => p.key === state.selected);
  if (!hit) return;
  const { x, y, w, h } = hit.rect;
  stageCtx.save();
  stageCtx.strokeStyle = '#FF2D78';
  stageCtx.lineWidth = Math.max(3, layout.w / 480);
  stageCtx.setLineDash([18, 12]);
  stageCtx.strokeRect(x + 4, y + 4, w - 8, h - 8);
  stageCtx.restore();
}

export function setLayout(id) {
  const layout = layoutById(id);
  state.layoutId = layout.id;
  state.grade = layout.defaultGrade;
  // A layout may carry its own masthead (the ensemble variants are
  // titled posters in their own right); everything else is SOLMARA.
  state.title = layout.captions.title || 'SOLMARA';
  state.titleLine2 = layout.captions.titleLine2 || '';
  state.subtitle = layout.captions.subtitle;
  state.tagline = layout.captions.tagline;
  state.selected = null;
  render();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

let editor = null;

export async function addPhotoFiles(files) {
  for (const file of files) {
    if (!file.type || !file.type.startsWith('image/')) continue;
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      state.photos.push(makePhoto(img, file.name.replace(/\.[^.]+$/, ''), url, file.name));
    } catch {
      URL.revokeObjectURL(url);
    }
  }
  if (editor) editor.refreshTray();
  render();
}

async function boot() {
  const api = {
    state, view, render, setLayout, addPhotoFiles, currentLayout,
    syncEditor: () => { if (editor) editor.syncControls(); },
    refreshTray: () => { if (editor) editor.refreshTray(); },
  };
  editor = initEditor(api);

  try {
    await Promise.all([
      document.fonts.load('100px Anton'),
      document.fonts.load('100px Yellowtail'),
      document.fonts.ready,
    ]);
  } catch {
    // Fonts fall back to local stacks; the studio still runs.
  }

  for (const sample of SAMPLES) {
    const img = await loadImage(sample.file);
    state.photos.push(makePhoto(img, sample.label, sample.file, sample.file.split('/').pop()));
  }
  editor.refreshTray();

  const shot = await runShotIfRequested(api);
  if (!shot) {
    render();
    editor.syncControls();
  }
}

boot();
