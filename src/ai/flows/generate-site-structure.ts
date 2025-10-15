'use server';

import { ai, getAI } from '@/ai/genkit';
import { MODEL_NAME } from '@/ai/model';
import { z } from 'zod';

// Секція контенту (без header/footer)
const SectionSchema = z.object({
  type: z.string().describe("Тип секції, наприклад 'hero', 'features', 'gallery', 'faq', 'cta', 'contact'"),
  title: z.string().describe('Основний заголовок для цієї секції'),
  details: z.string().optional().describe('Додаткові деталі або підзаголовок'),
});

const UsageSchema = z.object({
  inputTokens: z.number().int().optional(),
  outputTokens: z.number().int().optional(),
  totalTokens: z.number().int().optional(),
});

const SiteStructureOutputSchema = z.object({
  creativeBrief: z.string().describe('Детальний творчий бриф для дизайнера: настрій, палітра, типографіка, унікальні елементи'),
  theme: z.object({
    primaryColor: z.string().describe("Основний акцентний колір (наприклад, 'indigo-500')"),
    font: z.string().describe("Назва шрифту з Google Fonts (наприклад, 'Inter')"),
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
  language: z.string().optional(),
  model: z.string().optional(),
});

// FIXED: Prompt is now in Ukrainian for consistency.
const SITE_STRUCTURE_PROMPT = `Ти — AI-арт-директор та архітектор веб-сайтів. Проаналізуй запит користувача та створи план сайту у форматі JSON.

1. Створи детальний творчий бриф (creativeBrief):
   - Настрій (Mood)
   - Кольорова палітра (Color Palette)
   - Типографіка (Typography)
   - Візуальні елементи (Visual Elements)
   Цей бриф буде використовуватися для генерації всіх секцій.

2. Сплануй 3–5 контентних секцій (sections). Якщо користувач вказав точну кількість — дотримуйся її.
   ВАЖЛИВО: не додавай до 'sections' юридичні розділи (Terms, Privacy, Legal, Responsible Gaming) — вони будуть створені як окремі сторінки.

Правила:
- НЕ генеруй HTML — лише JSON.
- НЕ включай секції header, footer, navigation, Terms, Privacy, Legal. Лише контент: hero, features, about, gallery, faq, cta, contact тощо.
- Пиши мовою, вказаною у параметрі 'language', або мовою запиту користувача, якщо 'language' не задано. Поточна мова: {{#if language}}{{language}}{{else}}мова запиту{{/if}}.
- Жодних емодзі.

Запит користувача: "{{prompt}}"`;

export const generateSiteStructure = ai.defineFlow(
  {
    name: 'generateSiteStructure',
    inputSchema: SiteStructureInputSchema,
    outputSchema: SiteStructureFlowOutputSchema,
  },
  async (input) => {
    const localAI = getAI(input.model);
    const structurePrompt = localAI.definePrompt({
      name: 'siteStructurePrompt',
      input: { schema: SiteStructureInputSchema },
      output: { schema: SiteStructureOutputSchema },
      prompt: SITE_STRUCTURE_PROMPT,
    });
    const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
    let lastErr: any = null;
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        const response = await structurePrompt(input);
        const output = response.output!;
        // Precaution: filter out any accidental header/footer/nav sections
        if (output.sections) {
          output.sections = output.sections.filter((s) => {
            const t = (s.type || '').toLowerCase();
            return t !== 'header' && t !== 'footer' && t !== 'navigation' && t !== 'nav';
          });
        }
        return {
          ...output,
          usage: response.usage || undefined,
          model: response.model || (input.model ?? MODEL_NAME),
        };
      } catch (err) {
        lastErr = err;
        await sleep(Math.min(4500, 600 * attempt));
      }
    }
    throw lastErr || new Error('Failed to generate site structure');
  }
);
