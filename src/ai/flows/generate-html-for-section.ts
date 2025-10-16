"use server";

import { ai, getAI } from '@/ai/genkit';
import { MODEL_NAME } from '@/ai/model';
import { z } from 'zod';

const SectionHtmlInputSchema = z.object({
  section: z.object({
    type: z.string(),
    title: z.string(),
    details: z.string().optional(),
  }),
  sitePrompt: z.string().describe('Оригінальний запит користувача, який описує сайт'),
  creativeBrief: z.string().describe('Творчий бриф з візуальним стилем сайту'),
  theme: z.object({
    primaryColor: z.string(),
  }),
  imageUrl: z.string().optional().describe('URL випадкового зображення, яке потрібно вставити'),
  imageUrls: z.array(z.string()).optional().describe('Колекція унікальних зображень для секції'),
  gamePages: z
    .array(
      z.object({ title: z.string(), href: z.string(), cover: z.string().optional() })
    )
    .optional()
    .describe('Список сторінок ігор для секції Games (1–4).'),
  language: z.string().optional(),
  themeMode: z.enum(['light', 'dark']).optional(),
  ctaTarget: z.string().optional(),
  model: z.string().optional(),
});

const UsageSchema = z.object({
  inputTokens: z.number().int().optional(),
  outputTokens: z.number().int().optional(),
  totalTokens: z.number().int().optional(),
});

const SectionHtmlOutputSchema = z.object({
  htmlContent: z.string(),
  cssContent: z.string().optional(), // This is legacy, we don't use it but keep for schema compatibility
});
export type SectionHtml = z.infer<typeof SectionHtmlOutputSchema>;

const SectionHtmlFlowOutputSchema = SectionHtmlOutputSchema.extend({
  usage: UsageSchema.optional(),
  model: z.string().optional(),
});
export type SectionHtmlFlowResult = z.infer<typeof SectionHtmlFlowOutputSchema>;

// FIXED: Prompt is now in Ukrainian for consistency.
const SECTION_PROMPT_TEMPLATE = `Ти — елітний фронтенд-розробник і креативний дизайнер, майстер TailwindCSS. Твоє завдання — створити HTML-код для ОДНІЄЇ секції сайту.

Головний орієнтир — творчий бриф:
"{{creativeBrief}}"

Правила:
- НЕ використовуй теги <html>, <body>, <style>. Поверни лише HTML-код секції.
- Головному тегу <section> додай id відповідно до типу секції: <section id="{{section.type}}">.
- Якщо тип секції 'hero' — зроби її повноекранною (min-h-screen).
- Весь текст пиши мовою: {{#if language}}{{language}}{{else}}мовою запиту користувача{{/if}}.
- Жодних header/nav/footer всередині секцій.
 - Додавай мікроанімації: плавні появи елементів, hover‑ефекти карток, легкі паралакси для декоративних шарів.
 - Для елементів, які мають з'являтися при прокрутці, додай клас 'reveal-on-scroll'. Для декоративних шарів можеш додати data-parallax="0.1..0.3".
 - Весь ВНУТРІШНІЙ контент секції ОБГОРНИ у контейнер <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">…</div> для вирівнювання і відступів.
 - Кнопки (CTA) роби помірними: клас наприклад 'inline-flex items-center gap-2 px-5 py-3 text-sm md:text-base rounded-xl font-semibold'. Уникай гігантських відступів (px-10/py-5 тощо).

Контент базуй на загальному запиті ("{{sitePrompt}}") та деталях секції.
Якщо є зображення (imageUrls), ОБОВ'ЯЗКОВО встав їх органічно відповідно до брифу. Не використовуй зовнішні "placeholder"‑картинки.
{{#if imageUrls}}
  Доступні зображення для цієї секції:
  {{#each imageUrls}}
  - {{this}}
  {{/each}}
{{/if}}

Якщо є gamePages і тип секції саме 'games' — створи ОДНУ картку/CTA з посиланням на перший елемент gamePages (без сітки). Для інших типів секцій не виводь список ігор.
{{#if gamePages}}
  Доступні ігрові сторінки (використай лише першу):
  {{#each gamePages}}
  - {{this.title}} => {{this.href}} {{#if this.cover}}(обкладинка: {{this.cover}}){{/if}}
  {{/each}}
{{/if}}

Вимоги до зображень та анімацій:
- Для секцій типу 'gallery' або 'games' розмісти сітку з 6–12 картками з <img>, використовуючи лише надані imageUrls.
   Для типу 'games' — якщо використовується card‑CTA на гру, зроби її ОДНІЄЮ, з великою обкладинкою і коротким підзаголовком.
- Для 'features'/'about' додай хоча б 1–2 зображення.
- Додай легкі анімації без сторонніх бібліотек: hover‑ефекти карток (scale/opacity/translate), м'які появи елементів через CSS (utility‑класи Tailwind або прості keyframes).
 - Для поодиноких зображень використовуй співвідношення сторін (наприклад 'aspect-[16/9] md:aspect-[21/9]') + 'object-cover rounded-xl shadow', щоб картинка не «випирала».

Завдання:
- Тип секції: {{section.type}}
- Заголовок: {{section.title}}
- Деталі: {{section.details}}

Поверни JSON з полем htmlContent.`;

export const generateHtmlForSection = ai.defineFlow(
  {
    name: 'generateHtmlForSection',
    inputSchema: SectionHtmlInputSchema,
    outputSchema: SectionHtmlFlowOutputSchema,
  },
  async (input) => {
    const localAI = getAI(input.model);
    const localPrompt = localAI.definePrompt({
      name: 'sectionHtmlPromptDynamic',
      input: { schema: SectionHtmlInputSchema },
      output: { schema: SectionHtmlOutputSchema },
      prompt: SECTION_PROMPT_TEMPLATE,
    });
    const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
    let lastErr: any = null;
    const fastMode = String(process.env.WG_FAST || '').toLowerCase() === 'true' || process.env.WG_FAST === '1';
    const maxAttempts = fastMode ? 2 : (input.model && input.model.includes('flash') ? 3 : 5);
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await localPrompt(input);
        const output = response.output;
        if (output?.htmlContent) {
          return {
            ...output,
            usage: response.usage || undefined,
            model: response.model || (input.model ?? MODEL_NAME),
          };
        }
        throw new Error('Empty model output');
      } catch (e: any) {
        lastErr = e;
        await sleep(Math.min(1600, 400 * attempt));
      }
    }

    const esc = (v: string) => v.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const safeTitle = esc(input.section.title || input.section.type || 'Section');
    const safeDetails = input.section.details ? esc(input.section.details) : '';
    const htmlFallback = `<section id="${input.section.type || 'section'}" class="py-12 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <h2 class="text-3xl font-bold mb-4">${safeTitle}</h2>
    ${safeDetails ? `<p class="text-slate-500">${safeDetails}</p>` : ''}
    <p class="mt-4 text-red-500">Error: AI failed to generate this section. This is a fallback content.</p>
  </div>
</section>`;
    console.error('generateHtmlForSection: fallback used due to error:', lastErr?.message || lastErr);
    return { htmlContent: htmlFallback, cssContent: '', model: MODEL_NAME };
  }
);
