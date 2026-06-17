#!/usr/bin/env tsx
/**
 * Генерирует SVG-ассеты через Gemini 2.5 Flash (бесплатно).
 * Для пиксельных изображений через Imagen 4 — нужен биллинг на ai.dev/projects.
 *
 * Запуск: GEMINI_API_KEY=<ключ> npm run gen-art
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('\n❌  GEMINI_API_KEY не задан.\n   Получи ключ: https://aistudio.google.com/app/apikey\n');
  process.exit(1);
}

const outDir = join(process.cwd(), 'public', 'art');
mkdirSync(outDir, { recursive: true });

async function askGemini(prompt: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 1.0, maxOutputTokens: 16384 },
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${await res.text()}`);
  const d = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  let text = d.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  // Убираем markdown code fences если есть
  text = text.replace(/^```[a-z]*\n?/im, '').replace(/\n?```\s*$/im, '');
  const start = text.indexOf('<svg');
  const end = text.lastIndexOf('</svg>');
  if (start === -1 || end === -1) {
    throw new Error('SVG не найден в ответе Gemini.\n' + text.slice(0, 400));
  }
  return text.slice(start, end + 6);
}

async function generate(name: string, prompt: string): Promise<void> {
  process.stdout.write(`  ⬆  ${name} … `);
  const svg = await askGemini(prompt);
  const filename = `${name}.svg`;
  writeFileSync(join(outDir, filename), svg, 'utf8');
  console.log(`✓  public/art/${filename}`);
}

console.log('\n🎨  Gemini 2.5 Flash — генерация SVG-ассетов\n');

await generate(
  'app-bg',
  `Output ONLY a valid SVG (viewBox="0 0 400 800" xmlns="http://www.w3.org/2000/svg"). No XML comments. No explanation. No markdown.
Content: obsidian background rect #08090b; defs with radialGradient id="bg" from #10130f to #08090b and filter id="blur" feGaussianBlur stdDeviation="70"; three blurred ellipses deep emerald #0d3829 opacity 0.2; linearGradient id="shimmer" from gold #cdb077 opacity 0 to 0.06 at top; feTurbulence grain rect opacity 0.035 mix-blend-mode soft-light. Close with </svg>.`,
);

await generate(
  'table-felt',
  `Output ONLY a valid SVG (viewBox="0 0 600 600" xmlns="http://www.w3.org/2000/svg"). No XML comments. No explanation. No markdown.
Content: defs with radialGradient id="felt" cx=50% cy=45% from #0d3829 to #061a15 and filter id="fabric" with feTurbulence type="fractalNoise" baseFrequency="0.65 0.9" numOctaves="3" and feColorMatrix and feDisplacementMap scale="4"; main rect fill url(#felt); texture rect using filter url(#fabric) opacity 0.5 mix-blend-mode multiply; vignette radial gradient rect black to transparent opacity 0.5; thin oval ellipse cx=300 cy=300 rx=200 ry=140 fill=none stroke=#cdb077 stroke-width=0.8 opacity=0.1. Close with </svg>.`,
);

await generate(
  'card-back',
  `Output ONLY a valid SVG (viewBox="0 0 300 420" xmlns="http://www.w3.org/2000/svg"). No XML comments. No explanation. No markdown.
Content: defs with linearGradient id="gold" from #f4e7c6 to #9c7c4a and radialGradient id="glow" from #cdb077 opacity 0.1 to transparent; background rect #0c0e11; outer border rect x=6 y=6 w=288 h=408 fill=none stroke url(#gold) stroke-width=0.8 opacity=0.6; inner border rect x=12 y=12 w=276 h=396 fill=none stroke url(#gold) stroke-width=0.5 opacity=0.3; central glow ellipse rx=80 ry=110; Art Deco pattern: 4 diagonal lines forming diamond grid stroke #cdb077 opacity 0.15; central circle r=32 fill=none stroke url(#gold) opacity=0.5; 8 petal paths around center using M/Q bezier curves fill none stroke url(#gold) opacity=0.4; corner flourish paths at 4 corners using simple L/C paths fill none stroke #cdb077 opacity=0.35. Close with </svg>.`,
);

console.log('\n✅  Готово! Запусти: npm run build\n');
console.log('💡  Для Imagen 4 (фото-реализм): включи биллинг на https://ai.dev/projects\n');
