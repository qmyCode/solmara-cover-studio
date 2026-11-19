// SOLMARA Cover Studio — the hand-in program for gta6-cover-art-01.
//
// The entry itself is the static web app under app/ (plain files, ES
// modules, no build step, no network): it turns a person's photos into
// multi-panel GTA-style cover art and exports PNGs in the common post
// sizes. This program copies app/ and screenshots/ into the output
// directory and writes dossier.json there with the vendored make.fun
// library, byte for byte as the scorer rebuilds it.
//
// Run locally with:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// (MAKEFUN_OUTPUT_DIR stands in for /output outside the grader.)

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repoDir = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });
cpSync(join(repoDir, 'app'), join(outDir, 'app'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoDir, 'screenshots'))) {
  cpSync(join(repoDir, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

// The gate's own limits, passed to the dossier builder so an entry the
// scorer would refuse is refused here first: at most 4 screenshots of
// 256 KiB each, at most 993 files / 48 MiB under app/, no app path over
// 1000 bytes, and the judge's source text capped at 160 KiB.
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
