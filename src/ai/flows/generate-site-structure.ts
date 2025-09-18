// Файл: src/ai/flows/generate-site-structure.ts
'use server';

import { ai } from '@/ai/genkit';
import { MODEL_NAME } from '@/ai/model';
import { z } from 'zod';

// Описываем, как должна выглядеть секция в нашем плане
const SectionSchema = z.object({
  type: z.string().describe("Тип секции, например 'hero', 'features', 'testimonials', 'contact'"),
  title: z.string().describe("Основной заголовок для этой секции"),
  details: z.string().optional().describe("Дополнительные детали или подзаголовок"),
});

// Описываем полную структуру сайта
const UsageSchema = z.object({
  inputTokens: z.number().int().optional(),
  outputTokens: z.number().int().optional(),
  totalTokens: z.number().int().optional(),
});

const SiteStructureOutputSchema = z.object({
  theme: z.object({
    primaryColor: z.string().describe("Основной акцентный цвет (например, 'indigo-500')"),
    font: z.string().describe("Название шрифта из Google Fonts (например, 'Inter')"),
  }),
  sections: z.array(SectionSchema),
});
export type SiteStructure = z.infer<typeof SiteStructureOutputSchema>;

const SiteStructureFlowOutputSchema = SiteStructureOutputSchema.extend({
  usage: UsageSchema.optional(),
  model: z.string().optional(),
});
export type SiteStructureFlowResult = z.infer<typeof SiteStructureFlowOutputSchema>;

const SiteStructureInputSchema = z.object({
  prompt: z.string(),
  websiteTypes: z.array(z.string()).optional(),
});

// Промпт для нашего "архитектора"
const structurePrompt = ai.definePrompt({
  name: 'siteStructurePrompt',
  input: { schema: SiteStructureInputSchema },
  output: { schema: SiteStructureOutputSchema },
  prompt: `Ты — креативный AI-архитектор веб-сайтов. Проанализируй пользовательский запрос и верни JSON-план сайта.
- Если пользователь явно указал количество секций или перечислил конкретные блоки, создай ровно их и в том порядке.
- Если точного числа нет, предложи 8–10 разнообразных уникальных секций без дубликатов header.
- Значение поля "type" пиши в kebab-case (hero, about, feature-grid, testimonial-slider, exclusive-offers, responsible, terms, privacy, call-to-action и т.д.).
- Если тематика связана с казино/играми (по prompt или websiteTypes содержит "Game"/"Casino"), добавь отдельные секции для Terms & Conditions, Privacy Policy и Responsible Gaming, а также убедись, что в других секциях есть дисклеймер о 18+ и отсутствии реальных денег.
- Если тематика иная (например, sport bar), адаптируй план под нее, не добавляй казино-специфику без необходимости.
- Указывай в описании секции, какие визуальные приемы и данные стоит использовать (стеклянные карточки, параллакс, иконки, счетчики, истории и т.д.).
- Всегда предусматривай блок с контактом/CTA и кнопку, ведущую на демо-игру, только если сайт действительно про игры.
- НЕ добавляй header, footer, глобальную навигацию.
- Возвращай строго валидный JSON, соответствующий схеме.

Пользовательский запрос: "{{prompt}}"
Выбранные типы сайта: {{#if websiteTypes}}{{websiteTypes}}{{else}}(не выбраны){{/if}}`,
});

// Genkit-флоу
export const generateSiteStructure = ai.defineFlow(
  {
    name: 'generateSiteStructure',
    inputSchema: SiteStructureInputSchema,
    outputSchema: SiteStructureFlowOutputSchema,
  },
  async (input) => {
    const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));
    let lastErr: any = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await structurePrompt(input);
        const output = response.output!;
        return {
          ...output,
          usage: response.usage || undefined,
          model: response.model || MODEL_NAME,
        };
      } catch (err) {
        lastErr = err;
        const backoff = Math.min(3000, 500 * attempt);
        await sleep(backoff);
      }
    }
    throw lastErr || new Error('Failed to generate site structure');
  }
);
