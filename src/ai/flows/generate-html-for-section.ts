// Файл: src/ai/flows/generate-html-for-section.ts
'use server';

import { ai, getAI } from '@/ai/genkit';
import { MODEL_NAME } from '@/ai/model';
import { z } from 'zod';

const SectionHtmlInputSchema = z.object({
  section: z.object({
    type: z.string(),
    title: z.string(),
    details: z.string().optional(),
  }),
  sitePrompt: z.string().describe("Оригінальний запит користувача, який описує сайт"),
  theme: z.object({
    primaryColor: z.string(),
  }),
  imageUrl: z.string().optional().describe("URL випадкового зображення, яке потрібно вставити"),
  imageUrls: z.array(z.string()).optional().describe("Колекція унікальних зображень для секції"),
  styleHint: z.string().optional().describe("Тематична підказка для фону, анімацій чи паралаксу"),
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
- Основывай контент и визуальные мотивы на брифе пользователя: "{{sitePrompt}}". В каждой секции явно упоминай ключевые идеи из этого описания (тематика, география, целевая аудитория, особенности сервиса).
- Учитывай режим темы: если \`{{themeMode}}\` = 'light', применяй светлые фоны и тёмный текст; если 'dark' — наоборот, оставляй глубокие тёмные фоны и светлый текст.
- Тримай фон секції нейтральним: не використовуй класи Tailwind \`bg-gradient-*\`, \`from-*\`, \`via-*\`, \`to-*\` і не додавай інлайнові градієнти чи кислотні заливки.
- Основний текст не роби напівпрозорим: жодних \`opacity-*\` для абзаців чи заголовків, щоб контраст залишався високим.
- Якщо тип секції 'hero', створи компактний рядок над заголовком з класом \`headline-kicker\`, а головний заголовок оформи як \`<h1 class="hero-headline">...\`. Щонайменше одне слово обгорни у \`<span class="headline-highlight">...</span>\` для акценту. Текст заголовка має бути uppercase.
- **ВАЖНО: Главному тегу <section> ОБЯЗАТЕЛЬНО добавь id, равный типу секции. Пример: \`<section id="{{section.type}}">\`.**
- **Если тип секции 'hero', сделай её полноэкранной, добавив классы \`min-h-screen flex flex-col justify-center\`**.
- **Пиши весь текст секции строго на языке {{#if language}}{{language}}{{else}}пользовательского запроса{{/if}} (заголовки, кнопки, описи).**
- **Никогда не генерируй собственные теги header, nav, footer или глобальные меню внутри секции — эти блоки уже есть в макете.**
- **Все кнопки и CTA делай ссылками с реальным адресом (никаких пустых или заглушек в href).**
{{#if ctaTarget}}- **Главный CTA (первый по смыслу) обязательно использует href="{{ctaTarget}}". Не оставляй \`href="#"\`, не подменяй адрес внешними ссылками.**{{/if}}
- Для кнопок и основних лінків використовуй заготовлені класи: головний CTA — \`btn-primary\`, додаткові дії — \`btn-secondary\`. Це звичайні <a> з атрибутом href.
- Не додавай до них класів виду \`text-*\` чи власних inline-стилів кольору, залишай контраст за замовчуванням.
- Використовуй лише іконки Font Awesome 6 (клас \`fa-solid\`). Обгорни кожну іконку у \`<div class="icon-badge">\` та розмісти саму іконку у тегу \`<i class="fa-solid fa-..."></i>\`. Ніяких емодзі чи випадкових SVG.
- Тримай типографіку чистою: жодних градієнтів усередині тексту, заголовки мають мати чіткий контраст з фоном.
- Фони секцій — акуратні, з делікатними шарами (легкий градієнт, soft-glow, сітка 5–10% прозорості). Уникай кислотних або перенасичених заливок.
- Для карток та списків підтримуй однакову сітку відступів: використовуйте flex або grid з \`gap\`, не застосовуй великі тіні без потреби.
- Это социальная демо-платформа без реальных ставок и выигрышей. Никогда не используй выражения про деньги, джекпоты, ставки, бонусы, депозиты, выплаты, лотереи или реальный выигрыш. Делай акцент на развлекательном опыте, коллекциях, челленджах и бесплатных демо-спинах.
- Строй фоны рівня преміум за рахунок акуратних декоративних шарів (не більше 2-3), м'яких світлових плям, сіток, легкого паралаксу.

{{#if styleHint}}
Використай наступну творчу підказку для оформлення секції: "{{styleHint}}". Додай відповідні фонові ефекти (градієнти, паралакс, рухомі елементи, SVG-патерни, canvas-ефекти) або декоративні шари, щоб секція виглядала унікально.
{{/if}}

{{#if imageUrls}}
У тебя есть подборка унікальних зображень (без повторів):
{{#each imageUrls}}
- {{this}}
{{/each}}
Розподіли їх між картками/блоками секции так, чтобы каждая картинка использовалась только один раз. Если секция содержит галерею, карточки или список — ставь отдельное изображение на каждый элемент.
**Кожне зображення потрібно додати через явний тег img з атрибутом src="..." (не лише фоново). Заборонено залишати картинки невикористаними чи дублювати одні й ті самі шляхи в кількох картках.**
{{else if imageUrl}}**ОБЯЗАТЕЛЬНО ИСПОЛЬЗУЙ ЭТО ИЗОБРАЖЕНИЕ:** \`{{imageUrl}}\`. Вставь его в тег img з атрибутом src=\"{{imageUrl}}\". Придумай осмысленный alt-текст, що описує типове зображення для казино (наприклад, \"Яскравий ігровий автомат у казино\").{{/if}}

- Если используешь иконки, убедись, что они явно видны на фоні: додай контрастні класи (наприклад, text-white або text-slate-900), тіні чи світіння. Кожна карточка/фіча повинна мати власну іконку (Font Awesome, Material Symbols чи емодзі).

// Правила чистого текста и иконок
- Категорически запрещены эмодзи и любые Unicode‑пиктограммы в тексте и атрибутах. Используй только иконки FA: <i class='fa-solid fa-sparkles'></i>, <i class='fa-solid fa-bolt'></i> и т.п.
- Не добавляй <script> и инлайновый JS в секции.

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
    const localAI = getAI(input.model);
    const localPrompt = localAI.definePrompt({
      name: 'sectionHtmlPromptDynamic',
      input: { schema: SectionHtmlInputSchema },
      output: { schema: SectionHtmlOutputSchema },
      prompt: `Ты — элитный фронтенд-разработчик, мастер TailwindCSS. Создай HTML-код для одной секции сайта.
- НЕ используй \`<html>\`, \`<body>\`, \`<style>\` теги. Только HTML-код для секции.
- Используй семантические теги (\`<section>\`, \`<h2>\`, и т.д.).
- Сделай дизайн современным, адаптивным и красивым.
- Используй акцентный цвет: \`{{theme.primaryColor}}\`.
- Основывай контент и визуальные мотивы на брифе пользователя: "{{sitePrompt}}". В каждой секции явно упоминай ключевые идеи из этого описания (тематика, география, целевая аудитория, особенности сервиса).
- Учитывай режим темы: если \`{{themeMode}}\` = 'light', применяй светлые фоны и тёмный текст; если 'dark' — наоборот, оставляй глубокие тёмные фоны и светлый текст.
- Тримай фон секції нейтральним: не використовуй класи Tailwind \`bg-gradient-*\`, \`from-*\`, \`via-*\`, \`to-*\` і не додавай інлайнові градієнти чи кислотні заливки.
- Основний текст не роби напівпрозорим: жодних \`opacity-*\` для абзаців чи заголовків, щоб контраст залишався високим.
- Якщо тип секції 'hero', створи компактний рядок над заголовком з класом \`headline-kicker\`, а головний заголовок оформи як \`<h1 class="hero-headline">...\`. Щонайменше одне слово обгорни у \`<span class="headline-highlight">...</span>\` для акценту. Текст заголовка має бути uppercase.
- **ВАЖНО: Главному тегу <section> ОБЯЗАТЕЛЬНО добавь id, равный типу секции. Пример: \`<section id="{{section.type}}">\`.**
- **Если тип секции 'hero', сделай её полноэкранной, добавив классы \`min-h-screen flex flex-col justify-center\`**.
- **Пиши весь текст секции строго на языке {{#if language}}{{language}}{{else}}пользовательского запроса{{/if}} (заголовки, кнопки, описи).**
- **Никогда не генерируй собственные теги header, nav, footer или глобальные меню внутри секции — эти блоки уже есть в макете.**
- **Все кнопки и CTA делай ссылками с реальным адресом (никаких пустых или заглушек в href).**
{{#if ctaTarget}}- **Главный CTA (первый по смыслу) обязательно использует href="{{ctaTarget}}". Не оставляй \`href=\"#\"\`, не подменяй адрес внешними ссылками.**{{/if}}
- Для кнопок и основних лінків використовуй заготовлені класи: головний CTA — \`btn-primary\`, додаткові дії — \`btn-secondary\`.
- Не додавай до них класів виду \`text-*\` чи inline-стилів кольору — контраст залишаємо типовий.
- Це соціальна демо‑платформа без реальних ставок і виграшів.

**Задание:**
- Тип секции: \`{{section.type}}\`
- Заголовок: \`{{section.title}}\`
- Детали: \`{{section.details}}\` 

Выдай только HTML-код в поле "htmlContent" JSON-ответа.`,
    });
    const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
    let lastErr: any = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
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
        const backoff = Math.min(3200, 600 * attempt);
        await sleep(backoff);
      }
    }
    const escapeHtml = (value: string) =>
      value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    const summarizePrompt = (raw: string) => {
      const normalized = (raw || '').replace(/\s+/g, ' ').trim();
      if (!normalized) return '';
      if (normalized.length <= 180) return normalized;
      return `${normalized.slice(0, 177)}...`;
    };
    const safeTitle = escapeHtml(input.section.title || input.section.type || 'Section');
    const safeDetails = input.section.details ? escapeHtml(input.section.details) : '';
    // Додаємо id також у резервний HTML для надійності
    const isLight = input.themeMode === 'light';
    const baseText = isLight ? 'text-slate-800' : 'text-white';
    const subText = isLight ? 'text-slate-600' : 'text-slate-300';
    const bg = isLight ? 'bg-white/80' : 'bg-white/10 backdrop-blur';
    const promptSummary = summarizePrompt(input.sitePrompt || '');
    const promptBlock = promptSummary ? `<p class="${subText} mt-3">${escapeHtml(promptSummary)}</p>` : '';
    const htmlFallback = `
<section class="py-12 ${bg}" id="${input.section.type || 'fallback'}">
  <div class="max-w-5xl mx-auto px-4">
    <h2 class="text-3xl font-bold mb-4 ${baseText}">${safeTitle}</h2>
    ${safeDetails ? `<p class="${subText}">${safeDetails}</p>` : ''}
    ${promptBlock}
  </div>
</section>`;
    console.error('generateHtmlForSection: fallback used due to error:', lastErr?.message || lastErr);
    return { htmlContent: htmlFallback, model: MODEL_NAME };
  }
);
