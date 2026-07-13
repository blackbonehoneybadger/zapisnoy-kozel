// Генерация исходных PNG для @capacitor/assets из фирменной эмблемы DOFFA.
// Тёплый эспрессо-фон + золото рассвета, как в приложении.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'assets');
mkdirSync(out, { recursive: true });

const EMBLEM = `
  <path d="M32 6v5" />
  <path d="M18.5 10.5l2.6 4.4" />
  <path d="M45.5 10.5l-2.6 4.4" />
  <path d="M26.5 20c-1.4-2.4 1.4-3.6 0-6" />
  <path d="M32 19c-1.4-2.4 1.4-3.6 0-6" />
  <path d="M37.5 20c-1.4-2.4 1.4-3.6 0-6" />
  <path d="M18 26h26v7c0 7.2-5.8 13-13 13s-13-5.8-13-13v-7Z" />
  <path d="M44 29h3.5a4.5 4.5 0 0 1 0 9H42.5" />
  <path d="M15 52c5 2.6 29 2.6 34 0" />
  <path d="M29.5 57.5c0-1.4 2.2-2.5 2.5-2.5s2.5 1.1 2.5 2.5-2.2 2.5-2.5 2.5-2.5-1.1-2.5-2.5Z" stroke-width="1.6" />
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

// Эмблема DOFFA (чашка с паром), отцентрованная в квадрате `size`, масштаб `scale` (px ширины).
function emblem(size, widthPx) {
  const s = widthPx / 64;
  const t = (size - widthPx) / 2;
  return `
    <g transform="translate(${t} ${t}) scale(${s})"
       fill="none" stroke="url(#gold)" stroke-width="2"
       stroke-linecap="round" stroke-linejoin="round">
      ${EMBLEM}
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
    ${emblem(S, 520)}
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
  // Адаптивная иконка: безопасная зона ~66%, поэтому эмблема меньше.
  const S = 1024;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
    <defs>${GOLD}</defs>
    ${emblem(S, 430)}
  </svg>`;
}

function splash(dark) {
  const S = 2732;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
    <defs>${obsidianBg(S)}${GOLD}</defs>
    <rect width="${S}" height="${S}" fill="url(#bg)" />
    <rect width="${S}" height="${S}" fill="url(#glow)" />
    ${emblem(S, 760)}
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
