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
});

// Промпт для нашего "архитектора"
const structurePrompt = ai.definePrompt({
  name: 'siteStructurePrompt',
  input: { schema: SiteStructureInputSchema },
  output: { schema: SiteStructureOutputSchema },
  prompt: `Ты — AI-архитектор веб-сайтов. Проанализируй запрос пользователя и создай план сайта в формате JSON. НЕ генерируй HTML. Твоя задача — только создать структуру. Если пользователь явно указал, сколько секций или блоков нужно сделать, соблюдай это число (например, «1 секция» значит только одну секцию). В остальных случаях предложи 3-5 самых подходящих секций.

Запрос пользователя: "{{prompt}}"`,
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
