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
  prompt: `Ты — креативный копирайтер и дизайнер для сайтов социальных казино. Твоя задача — создать контент для игровой страницы.

**Инструкции:**
1.  **Придумай яркий, захватывающий заголовок** на английском языке. Он должен подчеркивать, что игра бесплатная, социальная и для развлечения. Примеры: "Experience the Ultimate Social Casino Fun!", "Spin for Fun, Not for Funds!", "Your Free-to-Play Slot Paradise Awaits!".
2.  **Создай крутой, заметный HTML-блок для дисклеймера 18+**. Он должен быть стильным и привлекать внимание, используя классы TailwindCSS (например, градиентный фон, тень, иконку Font Awesome). Дисклеймер должен четко указывать, что игры предназначены для взрослой аудитории (18+), не предлагают реальных денег и созданы исключительно для развлечения.
3.  Верни результат строго в формате JSON.

**Контекст сайта:**
-   Название: "{{siteName}}"`,
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