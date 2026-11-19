// Screenshot capture for SOLMARA Cover Studio.
//
// Serves app/ locally, drives headless Chrome over CDP, waits for each
// scene in shots.json to paint (window.__shotReady), verifies the
// lettering bottom-margin proof (window.__textBottom), and saves the
// screenshots as JPEGs inside the gate's limits (long side <= 1280,
// short side >= 480, <= 256 KiB). Also reports any console errors.

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoDir = fileURLToPath(new URL('.', import.meta.url));
const appDir = join(repoDir, 'app');
const shots = JSON.parse(readFileSync(join(repoDir, 'shots.json'), 'utf8'));
const PORT = 8077;
const CDP_PORT = 9333;
const CHROME = process.env.CHROME_BIN || '/opt/meta-chromium/chrome';

const TYPES = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.json': 'application/json',
};

const server = createServer((req, res) => {
  const path = normalize(join(appDir, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (!path.startsWith(appDir)) { res.writeHead(403).end(); return; }
  try {
    const body = readFileSync(path);
    res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});
await new Promise((r) => server.listen(PORT, r));

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  `--remote-debugging-port=${CDP_PORT}`, '--user-data-dir=/tmp/ca-chrome-profile',
  '--window-size=1280,720', 'about:blank',
], { stdio: 'ignore' });

async function waitForCdp() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
      if (r.ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('Chrome CDP did not come up');
}
await waitForCdp();

const target = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));

let seq = 0;
const pending = new Map();
const consoleErrors = [];
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    consoleErrors.push(`exception: ${msg.params.exceptionDetails.text} ${msg.params.exceptionDetails.exception?.description || ''}`);
  }
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    consoleErrors.push(`console: ${msg.params.args.map((a) => a.value || a.description || '').join(' ')}`);
  }
  if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
    consoleErrors.push(`log: ${msg.params.entry.text}`);
  }
});
function send(method, params = {}) {
  return new Promise((resolve) => {
    const id = ++seq;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (res.result?.exceptionDetails) throw new Error(`evaluate failed: ${expression}`);
  return res.result?.result?.value;
}

await send('Page.enable');
await send('Runtime.enable');
await send('Log.enable');

function jpegSize(buf) {
  // Scan JPEG markers for a start-of-frame segment.
  let i = 2;
  while (i < buf.length - 9) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    }
    const len = buf.readUInt16BE(i + 2);
    i += 2 + len;
  }
  return null;
}

const results = [];
for (const shot of shots) {
  await send('Emulation.setDeviceMetricsOverride', { width: shot.w, height: shot.h, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html${shot.query}` });
  let ready = false;
  for (let i = 0; i < 120 && !ready; i++) {
    await new Promise((r) => setTimeout(r, 250));
    ready = (await evaluate('window.__shotReady === true').catch(() => false)) === true;
  }
  if (!ready) throw new Error(`shot ${shot.name} never became ready`);
  const textBottom = await evaluate('window.__textBottom');
  let quality = 90;
  let buf = null;
  while (quality >= 60) {
    const shotRes = await send('Page.captureScreenshot', { format: 'jpeg', quality, captureBeyondViewport: false });
    buf = Buffer.from(shotRes.result.data, 'base64');
    if (buf.length <= 262144) break;
    quality -= 8;
  }
  const outPath = join(repoDir, 'screenshots', shot.name);
  writeFileSync(outPath, buf);
  const dims = jpegSize(buf);
  results.push({ name: shot.name, bytes: buf.length, dims, quality, textBottom });
  console.log(`${shot.name}: ${buf.length} bytes, ${dims ? `${dims.w}x${dims.h}` : '?'}, q${quality}, textBottom=${JSON.stringify(textBottom)}`);
}

console.log('console errors:', consoleErrors.length ? consoleErrors : 'none');
for (const r of results) {
  const tb = r.textBottom;
  if (tb && tb.bottom > tb.limit) {
    console.log(`BOTTOM MARGIN VIOLATION in ${r.name}: text bottom ${tb.bottom} > limit ${tb.limit}`);
    process.exitCode = 2;
  }
  if (r.bytes > 262144) {
    console.log(`SIZE VIOLATION in ${r.name}: ${r.bytes} bytes`);
    process.exitCode = 2;
  }
}
void statSync;

ws.close();
chrome.kill();
server.close();
