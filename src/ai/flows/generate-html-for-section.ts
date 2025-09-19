// File: src/ai/flows/generate-html-for-section.ts
'use server';

import { ai } from '@/ai/genkit';
import { MODEL_NAME } from '@/ai/model';
import { z } from 'zod';

const SectionHtmlInputSchema = z.object({
  section: z.object({
    type: z.string(),
    title: z.string(),
    details: z.string().optional(),
  }),
  theme: z.object({
    primaryColor: z.string(),
  }),
  imageUrl: z.string().optional().describe("URL випадкового зображення для вставки"),
});

const SectionHtmlOutputSchema = z.object({
  htmlContent: z.string(),
});
export type SectionHtml = z.infer<typeof SectionHtmlOutputSchema>;

const sectionPrompt = ai.definePrompt({
  name: 'sectionHtmlPrompt',
  input: { schema: SectionHtmlInputSchema },
  output: { schema: SectionHtmlOutputSchema },
  prompt: `Ты — элитный фронтенд-разработчик и копирайтер. Создай HTML-код для ОДНОЙ секции сайта.
- **Пиши оригинальный и вовлекающий текст на английском.** НЕ ИСПОЛЬЗУЙ 'Lorem Ipsum'.
- **НЕ используй теги \`<html>, <head>, <body>, <header>, <footer>, <nav>, <style>\`** — только содержимое секции.
- Верхний элемент должен быть: \`<section id="{{section.type}}" class="...">…</section>\`.
- Если тип секции 'hero', сделай её полноэкранной (\`min-h-screen\`).
- Если это секции 'terms', 'privacy', или 'responsible-gaming', создай хорошо структурированный текстовый блок с заголовками и списками, используя классы Tailwind Typography (\`prose prose-invert\`).
- Используй разнообразные компоненты: карточки, аккордеоны для FAQ, таймлайны.
- Вставляй кнопки, ведущие к \`game.html\` или якорям (\`#contact\`), где это уместно.
- Если передан \`imageUrl\`, используй его в \`<img src="{{imageUrl}}">\`.

**Данные для секции:**
- Тип: \`{{section.type}}\`
- Заголовок: \`{{section.title}}\`
- Ключевые детали от архитектора: \`{{section.details}}\`

Верни строго JSON { "htmlContent": "..." }.`,
});

export const generateHtmlForSection = ai.defineFlow(
  {
    name: 'generateHtmlForSection',
    inputSchema: SectionHtmlInputSchema,
    outputSchema: SectionHtmlOutputSchema.extend({
      usage: z.any().optional(), model: z.string().optional()
    }),
  },
  async (input) => {
    const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));
    let lastErr: any = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await sectionPrompt(input);
        const output = response.output;
        if (output?.htmlContent) {
          return {
            ...output,
            usage: response.usage || undefined,
            model: response.model || MODEL_NAME,
          };
        }
        throw new Error('Empty model output');
      } catch (e: any) {
        lastErr = e;
        const backoff = Math.min(3200, 600 * attempt);
        await sleep(backoff);
      }
    }
    const safeTitle = input.section.title || input.section.type || 'Section';
    const safeDetails = input.section.details || '';
    const htmlFallback = `
<section class="py-12" id="${input.section.type || 'fallback'}">
  <div class="max-w-5xl mx-auto px-4">
    <h2 class="text-3xl font-bold mb-4">${safeTitle}</h2>
    ${safeDetails ? `<p class="text-gray-600">${safeDetails}</p>` : ''}
  </div>
</section>`;
    console.error('generateHtmlForSection: fallback used due to error:', lastErr?.message || lastErr);
    return { htmlContent: htmlFallback, model: MODEL_NAME };
  }
);