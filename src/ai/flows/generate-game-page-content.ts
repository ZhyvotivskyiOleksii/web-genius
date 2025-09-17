// File: src/ai/flows/generate-game-page-content.ts
'use server';

import { ai } from '@/ai/genkit';
import { MODEL_NAME } from '@/ai/model';
import { z } from 'zod';

const GamePageContentOutputSchema = z.object({
  title: z.string().describe("Яскравий, привабливий заголовок для сторінки з безкоштовною соціальною грою (англійською)."),
  disclaimerHtml: z.string().describe("Стильний та помітний HTML-блок з дисклеймером 18+. Використовуй іконки Font Awesome (напр., <i class='fa-solid fa-triangle-exclamation'></i>) та класи TailwindCSS."),
});
export type GamePageContent = z.infer<typeof GamePageContentOutputSchema>;

const GamePageContentInputSchema = z.object({
  siteName: z.string(),
});

const gamePagePrompt = ai.definePrompt({
  name: 'gamePagePrompt',
  input: { schema: GamePageContentInputSchema },
  output: { schema: GamePageContentOutputSchema },
  prompt: `Ти — креативний копірайтер та дизайнер для сайтів соціальних казино. Твоє завдання — створити контент для ігрової сторінки.

**Інструкції:**
1.  **Придумай яскравий, захоплюючий заголовок** англійською мовою. Він має підкреслювати, що гра безкоштовна, соціальна і для розваги. Приклади: "Experience the Ultimate Social Casino Fun!", "Spin for Fun, Not for Funds!", "Your Free-to-Play Slot Paradise Awaits!".
2.  **Створи крутий, помітний HTML-блок для дисклеймера 18+**. Він має бути стильним і привертати увагу, використовуючи класи TailwindCSS (наприклад, градієнтний фон, тінь, іконку Font Awesome). Дисклеймер має чітко вказувати, що ігри призначені для дорослої аудиторії (18+), не пропонують реальних грошей і створені виключно для розваги.
3.  Поверни результат строго у форматі JSON.

**Контекст сайту:**
-   Назва: "{{siteName}}"`,
});

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
    const response = await gamePagePrompt(input);
    return {
      ...response.output!,
      usage: response.usage,
      model: response.model || MODEL_NAME,
    };
  }
);