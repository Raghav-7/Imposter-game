/**
 * Renders the app icon set from vector source. Requires `sharp`, which is NOT a
 * project dependency — run with a temporary install:
 *
 *   npm i --no-save sharp && node scripts/icon/make-icons.js
 *
 * Concept: a masquerade mask (hidden identity) whose right eye is a glowing
 * coral pupil — someone is watching, and someone is lying.
 */
const path = require('path');
const fs = require('fs');
const sharp = require(process.env.SHARP_PATH || 'sharp');

const OUT = path.join(__dirname, '..', '..', 'assets');
const IMAGES = path.join(OUT, 'images');
fs.mkdirSync(IMAGES, { recursive: true });

const mask = (fill) => `
  <path fill="${fill}" fill-rule="evenodd" d="
    M 160 396 C 214 318, 374 316, 512 384 C 650 316, 810 318, 864 396
    C 900 486, 852 612, 744 632 C 650 650, 578 600, 512 566
    C 446 600, 374 650, 280 632 C 172 612, 124 486, 160 396 Z
    M 266 452 C 300 410, 400 404, 446 448 C 430 500, 340 520, 282 500 C 266 490, 258 470, 266 452 Z
    M 578 448 C 624 404, 724 410, 758 452 C 766 470, 758 490, 742 500 C 684 520, 594 500, 578 448 Z" />`;

const pupil = `
  <circle cx="668" cy="462" r="34" fill="#FF4F6D"/>
  <circle cx="668" cy="462" r="34" fill="url(#glow)"/>
  <circle cx="680" cy="450" r="9" fill="#FFFFFF" opacity="0.9"/>`;

const defs = `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#8D6BFF"/>
      <stop offset="0.55" stop-color="#4B2BC2"/>
      <stop offset="1" stop-color="#1A1040"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#FFB3C0" stop-opacity="0.9"/>
      <stop offset="1" stop-color="#FF4F6D" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="halo" cx="0.5" cy="0.42" r="0.55">
      <stop offset="0" stop-color="#B9A6FF" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#B9A6FF" stop-opacity="0"/>
    </radialGradient>
  </defs>`;

/** Full square icon (iOS / legacy / web). */
const full = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">
  ${defs}
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <rect width="1024" height="1024" fill="url(#halo)"/>
  <g transform="translate(0 30)">
    ${mask('#FFFFFF')}
    ${pupil}
  </g>
</svg>`;

/** Android adaptive foreground: artwork inside the 66% safe zone, transparent elsewhere. */
const foreground = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  ${defs}
  <g transform="translate(512 527) scale(0.62) translate(-512 -512)">
    ${mask('#FFFFFF')}
    ${pupil}
  </g>
</svg>`;

const background = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  ${defs}
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <rect width="1024" height="1024" fill="url(#halo)"/>
</svg>`;

const monochrome = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <g transform="translate(512 527) scale(0.62) translate(-512 -512)">
    ${mask('#FFFFFF')}
  </g>
</svg>`;

/** Splash / in-app logo: mask only, transparent background. */
const logo = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  ${defs}
  <g transform="translate(512 512) scale(1.12) translate(-512 -512)">
    ${mask('#FFFFFF')}
    ${pupil}
  </g>
</svg>`;

async function render(svg, file, size) {
  await sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toFile(file);
  console.log(path.relative(process.cwd(), file));
}

(async () => {
  await render(full(1024), path.join(OUT, 'icon.png'), 1024);
  await render(foreground, path.join(OUT, 'android-icon-foreground.png'), 1024);
  await render(background, path.join(OUT, 'android-icon-background.png'), 1024);
  await render(monochrome, path.join(OUT, 'android-icon-monochrome.png'), 1024);
  await render(logo, path.join(OUT, 'splash-icon.png'), 512);
  await render(logo, path.join(IMAGES, 'logo.png'), 512);
  await render(full(1024), path.join(OUT, 'favicon.png'), 64);
  fs.writeFileSync(path.join(__dirname, 'icon.svg'), full(1024).trim());
})();
