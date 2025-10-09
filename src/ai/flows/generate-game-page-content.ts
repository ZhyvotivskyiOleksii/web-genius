// File: src/ai/flows/generate-game-page-content.ts
'use server';

import { ai, getAI } from '@/ai/genkit';
import { MODEL_NAME } from '@/ai/model';
import { z } from 'zod';

const GamePageContentOutputSchema = z.object({
  title: z.string().describe("Яскравий, привабливий заголовок для сторінки з безкоштовною соціальною грою."),
  disclaimerHtml: z.string().describe("Стильний та помітний HTML-блок з дисклеймером 18+. Використовуй іконки Font Awesome (напр., <i class='fa-solid fa-triangle-exclamation'></i>) та класи TailwindCSS."),
});
export type GamePageContent = z.infer<typeof GamePageContentOutputSchema>;

const GamePageContentInputSchema = z.object({
  siteName: z.string(),
  language: z.string().optional(),
  model: z.string().optional(),
});

const baseGamePrompt = `Ти — креативний копірайтер та дизайнер для сайтів соціальних казино. Твоє завдання — створити контент для ігрової сторінки.

**Інструкції:**
1.  **Придумай яскравий, захоплюючий заголовок** мовою {{#if language}}{{language}}{{else}}англійською{{/if}}. Він має підкреслювати, що гра безкоштовна, соціальна і для розваги.
2.  **Створи крутий, помітний HTML-блок для дисклеймера 18+** тією самою мовою. Він має бути стильним і привертати увагу, використовуючи класи TailwindCSS (наприклад, градієнтний фон, тінь, іконку Font Awesome). Дисклеймер має чітко вказувати, що ігри призначені для дорослої аудиторії (18+), не пропонують реальних грошей і створені виключно для розваги. Не використовуй емодзі — тільки іконки FA.
3.  Категорично уникай слів про джекпоти, депозити, ставки, бонуси, виплати, лотереї чи «real money wins». Наголошуй, що це безкоштовний демонстраційний досвід без можливості поповнення рахунку чи отримання грошових призів. Уникай емодзі.

**Контекст сайту:**
-   Назва: "{{siteName}}"`;

export const generateGamePageContent = ai.defineFlow(
  {
    name: 'generateGamePageContent',
    inputSchema: GamePageContentInputSchema,
    outputSchema: GamePageContentOutputSchema.extend({
      usage: z.any().optional(),
      model: z.string().optional(),
    }),
  },
  async (input) => {
    const localAI = getAI(input.model);
    const gamePagePrompt = localAI.definePrompt({
      name: 'gamePagePromptDynamic',
      input: { schema: GamePageContentInputSchema },
      output: { schema: GamePageContentOutputSchema },
      prompt: baseGamePrompt,
    });
    const response = await gamePagePrompt(input);
    return {
      ...response.output!,
      usage: response.usage,
      model: response.model || (input.model ?? MODEL_NAME),
    };
  }
);
