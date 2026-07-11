// Генерация исходных PNG для @capacitor/assets из фирменной эмблемы козла.
// Обсидиановый фон + шампань-металл, как в приложении.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'assets');
mkdirSync(out, { recursive: true });

const GOAT = `
  <path d="M21 23c-5-3.5-9.5-2-10.5 2.5 6.5 1 8 6.5 7.6 10.5" />
  <path d="M43 23c5-3.5 9.5-2 10.5 2.5-6.5 1-8 6.5-7.6 10.5" />
  <path d="M22.5 21c2-5.2 5.6-8 9.5-8s7.5 2.8 9.5 8c2.6 6.4 2 13.6-2.2 18.8-2.4 3-5 4.6-7.3 4.6s-4.9-1.6-7.3-4.6C20.5 34.6 19.9 27.4 22.5 21Z" />
  <path d="M27 30.5h.01M37 30.5h.01" />
  <path d="M28.5 40.5c2.2 2 4.8 2 7 0" />
  <path d="M32 13c0-2 .1-3.6.4-4.8" />
  <path d="M30.5 46.5c1 1.4 2.5 1.4 3 0" />
`;

const GOLD = `
  <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#f4e7c6" />
    <stop offset="0.5" stop-color="#d4b577" />
    <stop offset="1" stop-color="#9c7c4a" />
  </linearGradient>`;

function obsidianBg(size) {
  return `
    <radialGradient id="bg" cx="50%" cy="42%" r="75%">
      <stop offset="0" stop-color="#15181c" />
      <stop offset="0.55" stop-color="#0c0e11" />
      <stop offset="1" stop-color="#06070a" />
    </radialGradient>
    <radialGradient id="glow" cx="50%" cy="42%" r="55%">
      <stop offset="0" stop-color="#cdb077" stop-opacity="0.16" />
      <stop offset="1" stop-color="#cdb077" stop-opacity="0" />
    </radialGradient>`;
}

// Эмблема козла, отцентрованная в квадрате `size`, масштаб `scale` (px ширины).
function goat(size, widthPx) {
  const s = widthPx / 64;
  const t = (size - widthPx) / 2;
  return `
    <g transform="translate(${t} ${t}) scale(${s})"
       fill="none" stroke="url(#gold)" stroke-width="2"
       stroke-linecap="round" stroke-linejoin="round">
      ${GOAT}
    </g>`;
}

function iconOnly() {
  const S = 1024;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
    <defs>${obsidianBg(S)}${GOLD}</defs>
    <rect width="${S}" height="${S}" fill="url(#bg)" />
    <rect width="${S}" height="${S}" fill="url(#glow)" />
    <rect x="70" y="70" width="${S - 140}" height="${S - 140}" rx="190"
      fill="none" stroke="url(#gold)" stroke-width="7" opacity="0.55" />
    <rect x="104" y="104" width="${S - 208}" height="${S - 208}" rx="160"
      fill="none" stroke="url(#gold)" stroke-width="3.5" opacity="0.32" />
    ${goat(S, 520)}
  </svg>`;
}

function iconBackground() {
  const S = 1024;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
    <defs>${obsidianBg(S)}</defs>
    <rect width="${S}" height="${S}" fill="url(#bg)" />
    <rect width="${S}" height="${S}" fill="url(#glow)" />
  </svg>`;
}

function iconForeground() {
  // Адаптивная иконка: безопасная зона ~66%, поэтому козёл меньше.
  const S = 1024;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
    <defs>${GOLD}</defs>
    ${goat(S, 430)}
  </svg>`;
}

function splash(dark) {
  const S = 2732;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
    <defs>${obsidianBg(S)}${GOLD}</defs>
    <rect width="${S}" height="${S}" fill="url(#bg)" />
    <rect width="${S}" height="${S}" fill="url(#glow)" />
    ${goat(S, 760)}
  </svg>`;
}

const jobs = [
  ['icon-only.png', iconOnly(), 1024],
  ['icon-background.png', iconBackground(), 1024],
  ['icon-foreground.png', iconForeground(), 1024],
  ['splash.png', splash(false), 2732],
  ['splash-dark.png', splash(true), 2732],
];

for (const [name, svg, size] of jobs) {
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(resolve(out, name));
  console.log('✓', name, `${size}×${size}`);
}
