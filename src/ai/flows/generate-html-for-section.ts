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
- НЕ используй \`<html>\`, \`<body>\`, \`<style>\` теги. Только HTML-код для секции.
- Используй семантические теги (\`<section>\`, \`<h2>\`, и т.д.).
- Сделай дизайн современным, адаптивным и красивым.
- Используй акцентный цвет: \`{{theme.primaryColor}}\`.
- **ВАЖНО: Главному тегу <section> ОБЯЗАТЕЛЬНО добавь id, равный типу секции. Пример: \`<section id="{{section.type}}">\`.**
- **Если тип секции 'hero', сделай её полноэкранной, добавив классы \`min-h-screen flex flex-col justify-center\`**.

{{#if imageUrl}}
**ОБЯЗАТЕЛЬНО ИСПОЛЬЗУЙ ЭТО ИЗОБРАЖЕНИЕ:** \`{{imageUrl}}\`. Вставь его в тег \`<img src="{{imageUrl}}">\`. Придумай осмысленный alt-текст, що описує типове зображення для казино (наприклад, "Яскравий ігровий автомат у казино").
{{/if}}

**Задание:**
- Тип секции: \`{{section.type}}\`
- Заголовок: \`{{section.title}}\`
- Детали: \`{{section.details}}\`

Выдай только HTML-код в поле "htmlContent" JSON-ответа.`,
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