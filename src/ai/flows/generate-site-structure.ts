// File: src/ai/flows/generate-site-structure.ts
'use server';

import { ai } from '@/ai/genkit';
import { MODEL_NAME } from '@/ai/model';
import { z } from 'zod';

const SectionSchema = z.object({
  type: z.string().describe("Тип секції в kebab-case (наприклад, 'hero', 'about', 'feature-grid', 'cta')"),
  title: z.string().describe("Основний заголовок для цієї секції"),
  details: z.string().optional().describe("Додаткові деталі, ключові слова або підзаголовок для контенту"),
});

const SiteStructureOutputSchema = z.object({
  siteName: z.string().describe("Креативна назва сайту англійською"),
  metaDescription: z.string().describe("Короткий SEO-опис сайту (150-160 символів) англійською"),
  theme: z.object({
    primaryColor: z.string().describe("Основний акцентний колір TailwindCSS (наприклад, 'indigo-500')"),
    font: z.string().describe("Назва шрифту з Google Fonts (наприклад, 'Inter')"),
  }),
  sections: z.array(SectionSchema),
});
export type SiteStructure = z.infer<typeof SiteStructureOutputSchema>;

const SiteStructureInputSchema = z.object({
  prompt: z.string(),
  websiteTypes: z.array(z.string()).optional(),
});

const structurePrompt = ai.definePrompt({
  name: 'siteStructurePrompt',
  input: { schema: SiteStructureInputSchema },
  output: { schema: SiteStructureOutputSchema },
  prompt: `Ты — AI-архитектор веб-сайтов. Проанализируй запрос и верни JSON-план сайта.
- Придумай креативное название сайта.
- Напиши краткое SEO-описание (meta description) до 160 символов.
- **Порядок секций критически важен.** Первая секция ОБЯЗАТЕЛЬНО должна быть типа 'hero'.
- Если пользователь указал точное число секций (например, "8 блоков"), создай ровно столько. Если нет, создай 8-10 секций.
- Если в 'websiteTypes' есть "Game" или "Casino", обязательно добавь в план отдельные секции с типами: 'terms', 'privacy', и 'responsible-gaming'. Эти секции должны идти после основных.
- **Для всех секций игрового сайта** в поле 'details' добавляй напоминание: "Упомянуть 18+ и отсутствие реальных денег".

Запрос пользователя: "{{prompt}}"
Типы сайта: {{#if websiteTypes}}{{websiteTypes}}{{else}}(не указаны){{/if}}`,
});

export const generateSiteStructure = ai.defineFlow(
  {
    name: 'generateSiteStructure',
    inputSchema: SiteStructureInputSchema,
    outputSchema: SiteStructureOutputSchema.extend({
      usage: z.any().optional(), model: z.string().optional()
    }),
  },
  async (input) => {
    const response = await structurePrompt(input);
    if (!response.output) {
      throw new Error('AI architect failed to return a valid structure.');
    }
    return { ...response.output, usage: response.usage, model: response.model || MODEL_NAME };
  }
);