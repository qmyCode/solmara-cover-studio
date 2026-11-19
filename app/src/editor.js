// Editor — every control around the stage: the photo tray, layout picker
// with live thumbnails, grade swatches, Poster Ink controls, caption
// fields, panel drag/zoom interaction and the PNG export.

import { LAYOUTS, hitPanels, panelMetrics } from './layouts.js';
import { GRADES } from './ink.js';

function clamp01(v) {
  return Math.min(1, Math.max(0, v));
}

export function initEditor(api) {
  const { state } = api;
  const $ = (id) => document.getElementById(id);
  const stage = $('stage');
  const trayList = $('trayList');
  const layoutList = $('layoutList');
  const gradeRow = $('gradeRow');

  // ------------------------------------------------------------ photo tray
  function refreshTray() {
    trayList.innerHTML = '';
    state.photos.forEach((photo, index) => {
      const li = document.createElement('li');
      const img = document.createElement('img');
      img.src = photo.url;
      img.alt = photo.label;
      const name = document.createElement('span');
      name.textContent = photo.label;
      const badge = document.createElement('b');
      badge.textContent = String(index + 1);
      li.append(img, name, badge);
      li.title = 'Click to place this photo in the selected panel';
      li.addEventListener('click', () => {
        if (state.selected) {
          editFor(state.selected).photo = index;
          api.render();
          refreshThumbs();
        }
      });
      trayList.appendChild(li);
    });
  }

  $('fileInput').addEventListener('change', (e) => {
    api.addPhotoFiles([...e.target.files]);
    e.target.value = '';
  });

  const dropZone = $('dropZone');
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('over');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('over'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('over');
    api.addPhotoFiles([...e.dataTransfer.files]);
  });

  $('autoFillBtn').addEventListener('click', () => {
    delete state.edits[state.layoutId];
    state.selected = null;
    api.render();
    refreshThumbs();
    syncZoom();
  });

  // --------------------------------------------------------- layout picker
  const layoutButtons = new Map();
  for (const layout of LAYOUTS) {
    const btn = document.createElement('button');
    btn.className = 'layout-btn';
    btn.type = 'button';
    const thumb = document.createElement('canvas');
    thumb.width = 216;
    thumb.height = Math.round((216 * layout.h) / layout.w);
    const label = document.createElement('span');
    label.textContent = `${layout.name} · ${layout.size}`;
    btn.append(thumb, label);
    btn.addEventListener('click', () => {
      api.setLayout(layout.id);
      syncControls();
    });
    layoutList.appendChild(btn);
    layoutButtons.set(layout.id, { btn, thumb });
  }

  function refreshThumbs() {
    if (state.photos.length === 0) return;
    const savedLayout = state.layoutId;
    for (const layout of LAYOUTS) {
      const { thumb } = layoutButtons.get(layout.id);
      const off = document.createElement('canvas');
      off.width = layout.w;
      off.height = layout.h;
      const octx = off.getContext('2d');
      const v = { ...api.view(), edits: state.edits };
      // Render each layout with its own default grade/captions for the thumb.
      const keep = { grade: state.grade, subtitle: state.subtitle, tagline: state.tagline };
      v.grade = layout.defaultGrade;
      v.subtitle = layout.captions.subtitle;
      v.tagline = layout.captions.tagline;
      layout.render(octx, v, layout);
      void keep;
      const tctx = thumb.getContext('2d');
      tctx.clearRect(0, 0, thumb.width, thumb.height);
      tctx.drawImage(off, 0, 0, thumb.width, thumb.height);
    }
    void savedLayout;
  }

  // ------------------------------------------------------------ grade row
  const gradeButtons = new Map();
  for (const grade of GRADES) {
    const btn = document.createElement('button');
    btn.className = 'grade-btn';
    btn.type = 'button';
    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    swatch.style.background = `linear-gradient(90deg, ${grade.stops.map(([, c]) => c).join(', ')})`;
    const label = document.createElement('span');
    label.textContent = grade.label;
    btn.append(swatch, label);
    btn.addEventListener('click', () => {
      state.grade = grade.id;
      api.render();
      syncControls();
    });
    gradeRow.appendChild(btn);
    gradeButtons.set(grade.id, btn);
  }

  // ------------------------------------------------------------- ink panel
  $('inkToggle').addEventListener('change', (e) => {
    state.halftone = e.target.checked;
    api.render();
    refreshThumbs();
  });
  $('bandsRange').addEventListener('input', (e) => {
    state.bands = Number(e.target.value);
    $('bandsVal').textContent = String(state.bands);
    api.render();
  });
  $('bandsRange').addEventListener('change', refreshThumbs);
  $('strengthRange').addEventListener('input', (e) => {
    state.strength = Number(e.target.value) / 100;
    $('strengthVal').textContent = `${e.target.value}%`;
    api.render();
  });
  $('strengthRange').addEventListener('change', refreshThumbs);

  // -------------------------------------------------------------- captions
  const captionBind = [
    ['titleInput', 'title'],
    ['subtitleInput', 'subtitle'],
    ['taglineInput', 'tagline'],
  ];
  for (const [id, key] of captionBind) {
    $(id).addEventListener('input', (e) => {
      state[key] = e.target.value;
      api.render();
    });
    $(id).addEventListener('change', refreshThumbs);
  }

  $('stickerToggle').addEventListener('change', (e) => {
    state.sticker = e.target.checked;
    api.render();
    refreshThumbs();
  });

  // ------------------------------------------------------------ size jumps
  for (const btn of document.querySelectorAll('.size-btn')) {
    btn.addEventListener('click', () => {
      const size = btn.dataset.size;
      if (size === '1080x1350') api.setLayout('polaroid');
      else if (size === '1920x1080') api.setLayout(state.layoutId === 'neon' ? 'neon' : 'wide');
      else api.setLayout(state.layoutId === 'strips' ? 'strips' : 'grid');
      syncControls();
    });
  }

  // ------------------------------------------------------------ panel play
  function editFor(key) {
    const lid = state.layoutId;
    if (!state.edits[lid]) state.edits[lid] = {};
    if (!state.edits[lid][key]) state.edits[lid][key] = {};
    return state.edits[lid][key];
  }

  function toCanvasPos(e) {
    const r = stage.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) * stage.width) / r.width,
      y: ((e.clientY - r.top) * stage.height) / r.height,
    };
  }

  function panelAt(pos) {
    const hits = hitPanels(api.currentLayout());
    for (let i = hits.length - 1; i >= 0; i--) {
      const { x, y, w, h } = hits[i].rect;
      if (pos.x >= x && pos.x <= x + w && pos.y >= y && pos.y <= y + h) return hits[i].key;
    }
    return null;
  }

  let drag = null;
  stage.addEventListener('pointerdown', (e) => {
    const pos = toCanvasPos(e);
    const key = panelAt(pos);
    if (!key) return;
    state.selected = key;
    const m = panelMetrics(state.layoutId, key);
    drag = { key, startX: pos.x, startY: pos.y, ox: m ? m.ox : 0, oy: m ? m.oy : 0 };
    stage.setPointerCapture(e.pointerId);
    syncZoom();
    api.render();
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const pos = toCanvasPos(e);
    const m = panelMetrics(state.layoutId, drag.key);
    if (!m) return;
    const edit = editFor(drag.key);
    if (m.maxX > 0) edit.ox = clamp01(drag.ox - (pos.x - drag.startX) / m.maxX);
    if (m.maxY > 0) edit.oy = clamp01(drag.oy - (pos.y - drag.startY) / m.maxY);
    api.render();
  });
  const endDrag = () => { drag = null; };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);

  stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    const key = panelAt(toCanvasPos(e)) || state.selected;
    if (!key) return;
    state.selected = key;
    const m = panelMetrics(state.layoutId, key);
    const zoomNow = m ? m.zoom : 1;
    const zoom = Math.min(4, Math.max(1, zoomNow * Math.exp(-e.deltaY * 0.0012)));
    editFor(key).zoom = zoom;
    syncZoom();
    api.render();
  }, { passive: false });

  function syncZoom() {
    const slider = $('zoomRange');
    if (!state.selected) {
      slider.value = '100';
      $('zoomVal').textContent = '—';
      return;
    }
    const m = panelMetrics(state.layoutId, state.selected);
    const zoom = m ? m.zoom : 1;
    slider.value = String(Math.round(zoom * 100));
    $('zoomVal').textContent = `${Math.round(zoom * 100)}%`;
  }

  $('zoomRange').addEventListener('input', (e) => {
    if (!state.selected) return;
    editFor(state.selected).zoom = Number(e.target.value) / 100;
    $('zoomVal').textContent = `${e.target.value}%`;
    api.render();
  });

  // ---------------------------------------------------------------- export
  $('exportBtn').addEventListener('click', () => {
    const layout = api.currentLayout();
    const wasSelected = state.selected;
    state.selected = null;
    api.render();
    stage.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `solmara-cover-${layout.id}-${layout.w}x${layout.h}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      state.selected = wasSelected;
      api.render();
    }, 'image/png');
  });

  // ------------------------------------------------------------------ sync
  function syncControls() {
    $('titleInput').value = state.title;
    $('subtitleInput').value = state.subtitle;
    $('taglineInput').value = state.tagline;
    $('inkToggle').checked = state.halftone;
    $('stickerToggle').checked = state.sticker;
    $('bandsRange').value = String(state.bands);
    $('bandsVal').textContent = String(state.bands);
    $('strengthRange').value = String(Math.round(state.strength * 100));
    $('strengthVal').textContent = `${Math.round(state.strength * 100)}%`;
    for (const [id, { btn }] of layoutButtons) btn.classList.toggle('on', id === state.layoutId);
    for (const [id, btn] of gradeButtons) btn.classList.toggle('on', id === state.grade);
    const size = `${api.currentLayout().w}x${api.currentLayout().h}`;
    for (const btn of document.querySelectorAll('.size-btn')) {
      btn.classList.toggle('on', btn.dataset.size === size);
    }
    syncZoom();
    refreshThumbs();
  }

  return { refreshTray, syncControls, refreshThumbs };
}
