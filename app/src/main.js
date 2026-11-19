// SOLMARA Cover Studio — boot and shared state.
//
// Loads the bundled fonts and sample photos, auto-fills the first layout so
// the opening paint is already a finished cover, wires the editor, and
// renders the current layout to the stage canvas at full export size.

import { layoutById, hitPanels, bottomLimit, textTrace } from './layouts.js';
import { initEditor } from './editor.js';
import { runShotIfRequested } from './shots.js';

const SAMPLES = [
  { file: 'samples/photo1-hero.png', label: 'Beach Hero' },
  { file: 'samples/photo2-couple.png', label: 'The Couple' },
  { file: 'samples/photo3-driver.png', label: 'The Driver' },
  { file: 'samples/photo4-skyline.png', label: 'The Skyline' },
];

export const state = {
  photos: [],
  layoutId: 'wide',
  grade: 'sunset',
  bands: 6,
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
export function makePhoto(img, label, url) {
  photoSeq += 1;
  return { id: `p${photoSeq}`, img, label, url };
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
      state.photos.push(makePhoto(img, file.name.replace(/\.[^.]+$/, ''), url));
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
    state.photos.push(makePhoto(img, sample.label, sample.file));
  }
  editor.refreshTray();

  const shot = await runShotIfRequested(api);
  if (!shot) {
    render();
    editor.syncControls();
  }
}

boot();
