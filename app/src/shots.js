// Fixed scenes for screenshots.
//   ?shot=cover&layout=<id>  — the cover alone, filling the window: the
//                              app's own drawing of an exported cover.
//   ?shot=editor             — the full editor with samples loaded and a
//                              finished cover in the preview.
// window.__shotReady is set once the scene has painted, and
// window.__textBottom reports the lettering bottom-margin proof.
export async function runShotIfRequested(api) {
  const query = new URLSearchParams(location.search);
  const shot = query.get('shot');
  if (!shot) return false;

  document.body.classList.add('shot');
  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    api.setLayout(query.get('layout') || 'wide');
  } else if (shot === 'editor') {
    api.syncEditor();
  }
  api.render();
  await document.fonts.ready;
  api.render();
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.__shotReady = true;
    });
  });
  return true;
}
