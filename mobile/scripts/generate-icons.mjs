import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mkdir, writeFile } from 'node:fs/promises';

/**
 * Generates the app icon set from one vector mark.
 *
 * The mark is drawn as plain SVG geometry on purpose: no font is needed, so
 * the output is identical on every machine. The generated PNGs are
 * committed, so this script only needs to run when the mark itself changes.
 *
 * Usage: node scripts/generate-icons.mjs
 */

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const outDir = join(root, 'assets', 'images');

const TEAL = '#0d9488';
const DEEP_TEAL = '#0f766e';
const MINT = '#f0fdfa';

/** The mark: a shield with a pulse line through it. */
function markSvg({ stroke, strokeWidth = 56 }) {
  return `
    <g fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
      <path d="M512 176 L792 266 V512 c0 152-122 266-280 326-158-60-280-174-280-326V266Z" />
      <path d="M360 512 h104 l46 -96 l68 190 l52 -94 h84" />
    </g>`;
}

/** A full-bleed square icon. */
function iconSvg({ background }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="${background}" />
  ${markSvg({ stroke: MINT })}
</svg>`;
}

/**
 * The adaptive-icon foreground: the mark inset to the safe zone on a
 * transparent canvas, because the launcher crops the outer edges.
 */
function foregroundSvg() {
  const scale = 0.58;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <g transform="translate(512 512) scale(${scale}) translate(-512 -512)">
    ${markSvg({ stroke: MINT })}
  </g>
</svg>`;
}

/** The monochrome variant: white on transparent, for themed icons. */
function monochromeSvg() {
  const scale = 0.58;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <g transform="translate(512 512) scale(${scale}) translate(-512 -512)">
    ${markSvg({ stroke: '#000000' })}
  </g>
</svg>`;
}

/** The splash mark: the shield only, on transparent. */
function splashSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 1024 1024">
  ${markSvg({ stroke: MINT, strokeWidth: 64 })}
</svg>`;
}

function backgroundSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="${TEAL}" />
</svg>`;
}

/** Resolves sharp from either package, so the script works from the repo. */
function loadSharp() {
  const candidates = [
    join(root, 'package.json'),
    resolve(root, '..', 'web', 'package.json'),
  ];
  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    try {
      return createRequire(candidate)('sharp');
    } catch {
      // Try the next location.
    }
  }
  throw new Error('sharp is not installed. Run `npm install sharp` in web/ or mobile/ first.');
}

const sharp = loadSharp();

async function write(name, svg, size) {
  const buffer = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
  await writeFile(join(outDir, name), buffer);
  console.log(`wrote assets/images/${name} (${size}x${size})`);
}

await mkdir(outDir, { recursive: true });

await write('icon.png', iconSvg({ background: TEAL }), 1024);
await write('android-icon-foreground.png', foregroundSvg(), 1024);
await write('android-icon-background.png', backgroundSvg(), 1024);
await write('android-icon-monochrome.png', monochromeSvg(), 1024);
await write('splash-icon.png', splashSvg(), 512);
await write('favicon.png', iconSvg({ background: DEEP_TEAL }), 64);
