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
  imageUrls: z.array(z.string()).optional().describe("Колекція унікальних зображень для секції"),
  styleHint: z.string().optional().describe("Тематична підказка для фону, анімацій чи паралаксу"),
  language: z.string().optional(),
  themeMode: z.enum(['light', 'dark']).optional(),
  ctaTarget: z.string().optional(),
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
- Учитывай режим темы: если \`{{themeMode}}\` = 'light', применяй светлые фоны и тёмный текст; если 'dark' — наоборот, оставляй глубокие тёмные фоны и светлый текст.
- **ВАЖНО: Главному тегу <section> ОБЯЗАТЕЛЬНО добавь id, равный типу секции. Пример: \`<section id="{{section.type}}">\`.**
- **Если тип секции 'hero', сделай её полноэкранной, добавив классы \`min-h-screen flex flex-col justify-center\`**.
- **Пиши весь текст секции строго на языке {{#if language}}{{language}}{{else}}пользовательского запроса{{/if}} (заголовки, кнопки, описи).**
- **Никогда не генерируй собственные теги header, nav, footer или глобальные меню внутри секции — эти блоки уже есть в макете.**
- **Все кнопки и CTA делай ссылками с реальным адресом (никаких пустых или заглушек в href).**
{{#if ctaTarget}}- **Главные призывы к действию должны вести на {{ctaTarget}}. Не используй другие внешние адреса для кнопок, допускается якорь, если добавишь соответствующий id в разметку.**{{/if}}
- Это социальная демо-платформа без реальных ставок и выигрышей. Никогда не используй выражения про деньги, джекпоты, ставки, бонусы, депозиты, выплаты, лотереи или реальный выигрыш. Делай акцент на развлекательном опыте, коллекциях, челленджах и бесплатных демо-спинах.
- Строй сложные фоны: добавляй параллакс-слои, динамические градиенты, размытия и декоративные фигуры, чтобы секция выглядела как премиальный промо-блок.

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
    const isLight = input.themeMode === 'light';
    const baseText = isLight ? 'text-slate-800' : 'text-white';
    const subText = isLight ? 'text-slate-600' : 'text-slate-300';
    const bg = isLight ? 'bg-white/80' : 'bg-white/10 backdrop-blur';
    const htmlFallback = `
<section class="py-12 ${bg}" id="${input.section.type || 'fallback'}">
  <div class="max-w-5xl mx-auto px-4">
    <h2 class="text-3xl font-bold mb-4 ${baseText}">${safeTitle}</h2>
    ${safeDetails ? `<p class="${subText}">${safeDetails}</p>` : ''}
  </div>
</section>`;
    console.error('generateHtmlForSection: fallback used due to error:', lastErr?.message || lastErr);
    return { htmlContent: htmlFallback, model: MODEL_NAME };
  }
);
