// Файл: src/ai/flows/generate-html-for-section.ts
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
  imageUrl: z.string().optional().describe("URL випадкового зображення, яке потрібно вставити"),
});

const UsageSchema = z.object({
  inputTokens: z.number().int().optional(),
  outputTokens: z.number().int().optional(),
  totalTokens: z.number().int().optional(),
});

const SectionHtmlOutputSchema = z.object({
  htmlContent: z.string(),
});
export type SectionHtml = z.infer<typeof SectionHtmlOutputSchema>;

const SectionHtmlFlowOutputSchema = SectionHtmlOutputSchema.extend({
  usage: UsageSchema.optional(),
  model: z.string().optional(),
});
export type SectionHtmlFlowResult = z.infer<typeof SectionHtmlFlowOutputSchema>;

const sectionPrompt = ai.definePrompt({
  name: 'sectionHtmlPrompt',
  input: { schema: SectionHtmlInputSchema },
  output: { schema: SectionHtmlOutputSchema },
  prompt: `Ты — элитный фронтенд-разработчик, мастер TailwindCSS. Создай HTML-код для одной секции сайта.
- НЕ используй теги <html>, <head>, <body>, <header>, <footer>, <nav>, <style> — только содержимое секции.
- Верхний элемент: <section id="{{section.type}}" class="...">…</section> с уникальным, насыщенным дизайном.
- Используй семантические теги, смелые сетки, градиенты, иконки, микроанимации (классы Tailwind).
- Акцентный цвет: {{theme.primaryColor}} (добавляй классы типа text-{{theme.primaryColor}}/bg-{{theme.primaryColor}}/from-{{theme.primaryColor}}/to-… ).
- Для hero/CTA обязательно добавляй кнопки Play Demo/Explore, ведущие к game.html или якорям.
- На релевантных секциях явно повторяй дисклеймеры: 18+, без реальных выигрышей.
- Если передан imageUrl, вставь <img src="{{imageUrl}}" alt="..."> с описательным alt (не более одного крупного изображения).
- Для legal-секций добавь краткие списки bullet-пунктов и ссылки на terms.html, privacy-policy.html, responsible-gaming.html.
- Каждый блок должен отличаться по композиции: карточки, timeline, диаграммы, стеклянные панели и т.п.
- Верни строго JSON { "htmlContent": "..." }.

Данные блока:
- Тип: {{section.type}}
- Заголовок: {{section.title}}
- Дополнительно: {{section.details}}
`,
});

// Genkit-флоу
export const generateHtmlForSection = ai.defineFlow(
  {
    name: 'generateHtmlForSection',
    inputSchema: SectionHtmlInputSchema,
    outputSchema: SectionHtmlFlowOutputSchema,
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
    // Додаємо id також у резервний HTML для надійності
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
