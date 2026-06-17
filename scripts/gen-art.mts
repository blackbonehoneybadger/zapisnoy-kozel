#!/usr/bin/env tsx
/**
 * Генерирует визуальные ассеты через Gemini AI (image generation).
 *
 * Запуск:
 *   GEMINI_API_KEY=<ключ> npm run gen-art
 *
 * Результат — public/art/{app-bg, table-felt, card-back}.{jpg|png}
 * Без этих файлов приложение нормально работает на CSS-фоллбэках.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('\n❌  GEMINI_API_KEY не задан.\n');
  console.error('   Получи ключ на https://aistudio.google.com/app/apikey');
  console.error('   Затем запусти: GEMINI_API_KEY=твой_ключ npm run gen-art\n');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);
const outDir = join(process.cwd(), 'public', 'art');
mkdirSync(outDir, { recursive: true });

async function generate(name: string, prompt: string): Promise<void> {
  process.stdout.write(`  ⬆  ${name} … `);

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-preview-image-generation',
  });

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    // @ts-expect-error — responseModalities отсутствует в типах, но нужен для image-gen
    generationConfig: { responseModalities: ['image', 'text'] },
  });

  for (const part of result.response.candidates?.[0]?.content?.parts ?? []) {
    if (part.inlineData?.mimeType?.startsWith('image/')) {
      const { mimeType, data } = part.inlineData;
      const ext = mimeType === 'image/png' ? 'png' : 'jpg';
      const filename = `${name}.${ext}`;
      writeFileSync(join(outDir, filename), Buffer.from(data!, 'base64'));
      console.log(`✓  public/art/${filename}`);
      return;
    }
  }
  throw new Error(`Gemini не вернул изображение для «${name}»`);
}

console.log('\n🎨  Gemini AI — генерация ассетов\n');

await generate(
  'app-bg',
  [
    'Ultra-luxury mobile app background texture.',
    'Pure obsidian black (#08090b) with microscopic champagne gold dust particles.',
    'Extremely subtle shimmer. Film grain. Deep. Rich. Dark.',
    'No objects, no text, no patterns, no borders.',
    'Seamless. Perfect for premium mobile UI. 4K detail.',
  ].join(' '),
);

await generate(
  'table-felt',
  [
    'Photorealistic luxury casino card table baize texture.',
    'Deep emerald green velvet (#0a2c23). Fine woven ribbed fabric.',
    'Natural soft shadows. Seamless tileable surface.',
    'No cards, no chips, no markings, no text, no borders.',
    'Top-down close-up. Perfect for mobile game table background. Ultra HD.',
  ].join(' '),
);

await generate(
  'card-back',
  [
    'Premium luxury playing card back design.',
    'Obsidian black background (#0c0e11).',
    'Intricate champagne gold foil ornamental Art Deco pattern (#cdb077 to #f4e7c6).',
    'Symmetric damask motif. Thin double gold border lines.',
    'Classic high-end casino card quality.',
    'No text, no letters, no numbers.',
    'Square format. Flat. Digital-ready.',
  ].join(' '),
);

console.log('\n✅  Готово! Пересобери приложение: npm run build\n');
