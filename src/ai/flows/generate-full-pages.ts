// File: src/ai/flows/generate-full-pages.ts
"use server";

import { ai, getAI } from '@/ai/genkit';
import { MODEL_NAME } from '@/ai/model';
import { z } from 'zod';

// Generic helpers
const UsageSchema = z.object({
  inputTokens: z.number().int().optional(),
  outputTokens: z.number().int().optional(),
  totalTokens: z.number().int().optional(),
});

// 1) Full Index Page
const IndexPageInputSchema = z.object({
  siteName: z.string(),
  sitePrompt: z.string(),
  language: z.string().optional(),
  sectionsHtml: z.string().describe('ВЖЕ згенерований HTML-код секцій. Його потрібно вставити всередину тега <main> без змін.'),
  hasGame: z
    .boolean()
    .optional()
    .describe('Якщо true — показати посилання/кнопки на ігри з масиву gamePages (href брати ЗВІДТИ). Не вигадуй game.html у корені. Якщо false — не згадувати гру.'),
  logoPath: z.string().optional().describe('Шлях до зображення логотипу для хедера.'),
  imageUrls: z.array(z.string()).optional().describe('Зображення для сайту, які можна використати в хедері або футері.'),
  themeMode: z.enum(['light','dark']).optional(),
  gamePages: z
    .array(
      z.object({
        title: z.string(),
        href: z.string(),
        cover: z.string().optional(),
      })
    )
    .optional()
    .describe('До 4 ігрових сторінок, на які треба посилатися в меню або футері.'),
  anchors: z
    .array(
      z.object({ id: z.string(), label: z.string().optional() })
    )
    .optional(),
  faviconPath: z.string().optional(),
});

const IndexPageOutputSchema = z.object({
  html: z.string().describe('Повний, самодостатній HTML5-документ. Без JSON або Markdown.'),
});

// FIXED: The main cause of the "crooked" output was this prompt.
// It contained contradictory instructions: to use the pre-generated HTML (`sectionsHtml`)
// AND to generate new sections from scratch.
// The updated prompt clearly states that the AI's job is to create the SHELL (header, footer, scripts)
// and insert the ALREADY-MADE content. This removes the ambiguity.
const INDEX_PAGE_PROMPT = `Ти — елітний фронтенд-дизайнер. Твоє завдання — створити оболонку для сайту: повний HTML5-документ з хедером, футером, мобільним меню та скриптами, і вставити в нього вже готовий контент.

Головне завдання:
Створити каркас сторінки і вставити готовий блок коду {{sectionsHtml}} всередину тега <main>. НЕ змінюй і не генеруй контент всередині <main> самостійно.

Правила та вимоги до оболонки:
- Мова сторінки: {{#if language}}{{language}}{{else}}мова запиту користувача{{/if}}.
- Тема: {{#if themeMode}}{{themeMode}}{{else}}adaptive{{/if}}. Якщо 'light' — світлий фон і темний текст; якщо 'dark' — темний фон і світлий текст. Контраст меню ≥ 4.5:1.
- У <head> підключи TailwindCDN: <script src="https://cdn.tailwindcss.com"></script>.
- У <head> підключи іконки: Font Awesome 6 та/або Material Icons.
- У <head> додай 1–2 кастомних шрифти з Google Fonts.
- Створи мінімалістичний, сучасний <header> (шапку сайту).
  - Якщо передано 'logoPath', використовуй <img src="{{logoPath}}" alt="{{siteName}} logo">.
  - Додай назву сайту {{siteName}}.
  - Реалізуй навігаційне меню з посиланнями-якорями (використовуй надані 'anchors'). Посилання повинні мати чіткий hover і бути добре видимими.
  - Додай кнопку "бургер" для мобільного меню.
- Створи стильний <footer> (підвал сайту) з посиланнями на 'privacy-policy.html' та 'terms.html', а також копірайтом.
- {{#if hasGame}}Якщо передано 'gamePages', додай помітне посилання або блок карток на ці ігри (href використовуй рівно такий, як у gamePages). НЕ створюй і не посилайся на game.html у корені.{{/if}}
- {{#unless hasGame}}Не додавай жодних посилань на ігри.{{/unless}}
 - Розмір основних CTA помірний (без гігантських кнопок): 'inline-flex items-center gap-2 px-5 py-3 text-sm md:text-base rounded-xl font-semibold'.

Мобільне меню (обов'язково):
- Реалізуй повноекранне мобільне меню-оверлей (#mobile-menu), що з'являється поверх сторінки (fixed, inset-0, z-50).
- Відкриття/закриття меню має відбуватися по кліку на кнопку-бургер.
- Додай невеликий inline-скрипт для керування меню (додавання/видалення класів 'hidden' або 'flex').
- При відкритті меню блокуй прокрутку сторінки (додавай/видаляй клас 'overflow-hidden' у тега <body>).
- Посилання в мобільному меню мають бути ті самі, що й у хедері.

Скрипти та інтерактивність (обов'язково):
- Додай inline-скрипт для плавної прокрутки до якорів (scrollIntoView({ behavior: 'smooth' })).
- Додай ненав'язливий cookie‑consent: компактний блок у правому нижньому куті (fixed bottom-4 right-4 z-40) розміру max-w-xs, з класами на кшталт 'text-xs px-3 py-2 rounded-lg shadow-lg bg-slate-800/90'. Кнопка "Accept" невелика: 'px-3 py-1.5 text-xs rounded-md'. Не створюй великі модалки, не перекривай контент.
- У розмітці використовуй клас 'reveal-on-scroll' для блоків, які повинні плавно з'являтися; також можеш додати елементи з атрибутом data-parallax (скрипт підтримує ефект паралаксу).

Навігаційні якорі для меню:
{{#if anchors}}
  Використовуй цей список для створення пунктів меню: 
  {{#each anchors}}
  - id: {{this.id}}, label: {{this.label}}
  {{/each}}
{{/if}}

Контекст сайту:
- Назва: "{{siteName}}"
- Опис: "{{sitePrompt}}"
- {{#if faviconPath}}Додай <link rel="icon" href="{{faviconPath}}">{{/if}}
{{#if gamePages}}
Доступні ігрові сторінки (використовуй ці href як є):
{{#each gamePages}}
- {{this.title}} => {{this.href}} {{#if this.cover}}(обкладинка: {{this.cover}}){{/if}}
{{/each}}
{{/if}}

Фінальний результат — це єдиний, повний HTML-файл.`;

export const generateIndexPageHtml = ai.defineFlow(
  {
    name: 'generateIndexPageHtml',
    inputSchema: IndexPageInputSchema,
    outputSchema: IndexPageOutputSchema.extend({ usage: UsageSchema.optional(), model: z.string().optional() }),
  },
  async (input) => {
    const localAI = getAI();
    const prompt = localAI.definePrompt({
      name: 'indexPageHtmlPrompt',
      input: { schema: IndexPageInputSchema },
      output: { schema: IndexPageOutputSchema },
      prompt: INDEX_PAGE_PROMPT,
    });
    const response = await prompt(input);
    return {
      ...response.output!,
      usage: response.usage,
      model: response.model || MODEL_NAME,
    };
  }
);

// 2) Privacy Policy Page
const PrivacyPageInputSchema = z.object({
  siteName: z.string(),
  domain: z.string(),
  language: z.string().optional(),
  contentHtml: z.string().describe('HTML-розмітка секцій політики (з <h2 id=...>) для вставки всередину <main>.'),
  faviconPath: z.string().optional(),
  logoPath: z.string().optional(),
});

const PrivacyPageOutputSchema = z.object({ html: z.string() });

const PRIVACY_PAGE_PROMPT = `Збери повноцінну сторінку "Privacy Policy" як завершений HTML5 документ.

Правила:
- Мова: {{#if language}}{{language}}{{else}}English{{/if}}.
- Підключи TailwindCDN, Font Awesome 6, Material Icons, 1–2 Google Fonts.
- Шапка: логотип/назва, меню (Home -> index.html, Terms -> terms.html, Privacy -> privacy-policy.html (активний пункт)). Якщо передано logoPath — використовуй <img src="{{logoPath}}" alt="{{siteName}} logo">.
- Основний контент встав як є в <main>: {{contentHtml}}
- Додай помітний дисклеймер 18+ (про розважальний характер, без реальних грошей).
- Обов'язково додай розділ Contact з email: contact@{{domain}} і згадай домен {{domain}} у 2–3 місцях природно (унікальність під конкретний сайт).
- Додай Cookie‑consent банер.
- У футері додай посилання на "Terms" та "Home".
- {{#if faviconPath}}Додай <link rel="icon" href="{{faviconPath}}">{{/if}}

Поверни тільки фінальний HTML.`;

export const generatePrivacyPolicyPageHtml = ai.defineFlow(
  {
    name: 'generatePrivacyPolicyPageHtml',
    inputSchema: PrivacyPageInputSchema,
    outputSchema: PrivacyPageOutputSchema.extend({ usage: UsageSchema.optional(), model: z.string().optional() }),
  },
  async (input) => {
    const localAI = getAI();
    const prompt = localAI.definePrompt({
      name: 'privacyPageHtmlPrompt',
      input: { schema: PrivacyPageInputSchema },
      output: { schema: PrivacyPageOutputSchema },
      prompt: PRIVACY_PAGE_PROMPT,
    });
    const response = await prompt(input);
    return { ...response.output!, usage: response.usage, model: response.model || MODEL_NAME };
  }
);

// 3) Terms Page
const TermsPageInputSchema = z.object({
  siteName: z.string(),
  domain: z.string(),
  language: z.string().optional(),
  faviconPath: z.string().optional(),
  logoPath: z.string().optional(),
});
const TermsPageOutputSchema = z.object({ html: z.string() });

const TERMS_PAGE_PROMPT = `Збери сторінку "Terms & Conditions" як завершений HTML5 документ.

Правила:
- Мова: {{#if language}}{{language}}{{else}}English{{/if}}.
- Підключи TailwindCDN, Font Awesome 6, Material Icons, 1–2 Google Fonts.
- Створи контент для секцій: Use of the Site, Eligibility (18+), Content & Intellectual Property, Disclaimer, Changes, Contact (mailto:contact@{{domain}}). Згадай домен {{domain}} у тексті кілька разів (унікальність).
- Неодноразово підкресли, що сайт для аудиторії 18+ і не передбачає гри на реальні гроші.
- Додай Cookie‑consent банер.
- Шапка/футер з навігацією (Home, Terms (активний), Privacy). Якщо передано logoPath — використовуй <img src="{{logoPath}}" alt="{{siteName}} logo">.
- {{#if faviconPath}}Додай <link rel="icon" href="{{faviconPath}}">{{/if}}

Поверни тільки фінальний HTML.`;

export const generateTermsPageHtml = ai.defineFlow(
  {
    name: 'generateTermsPageHtml',
    inputSchema: TermsPageInputSchema,
    outputSchema: TermsPageOutputSchema.extend({ usage: UsageSchema.optional(), model: z.string().optional() }),
  },
  async (input) => {
    const localAI = getAI();
    const prompt = localAI.definePrompt({
      name: 'termsPageHtmlPrompt',
      input: { schema: TermsPageInputSchema },
      output: { schema: TermsPageOutputSchema },
      prompt: TERMS_PAGE_PROMPT,
    });
    const response = await prompt(input);
    return { ...response.output!, usage: response.usage, model: response.model || MODEL_NAME };
  }
);

// 4) Game Page
const GamePageInputSchema = z.object({
  siteName: z.string(),
  pageTitle: z.string().optional(),
  gameIframePath: z.string(),
  disclaimerHtml: z.string().optional(),
  language: z.string().optional(),
  faviconPath: z.string().optional(),
  logoPath: z.string().optional(),
});
const GamePageOutputSchema = z.object({ html: z.string() });

const GAME_PAGE_PROMPT = `Створи повну сторінку з демо‑грою (HTML5 документ).

Правила:
- Мова: {{#if language}}{{language}}{{else}}English{{/if}}.
- Підключи TailwindCDN, Font Awesome 6, Material Icons.
- Шапка: посилання "Home" (index.html), "Privacy", "Terms". Активний розділ — Game. Якщо передано logoPath, використовуй <img src="{{logoPath}}" alt="{{siteName}} logo">.
- Заголовок: "{{pageTitle}}". Під ним відобрази iframe з грою src="{{gameIframePath}}" у центрованому контейнері max-w-6xl: використай пропорцію aspect-[16/9], rounded-xl, shadow, border. НЕ розтягуй на всю сторінку.
- Нижче додай явний дисклеймер 18+ (використай наданий HTML: {{disclaimerHtml}}) окремим блоком.
- Cookie‑consent банер.
- {{#if faviconPath}}Додай <link rel="icon" href="{{faviconPath}}">{{/if}}

Поверни тільки фінальний HTML.`;

export const generateGameFullPageHtml = ai.defineFlow(
  {
    name: 'generateGameFullPageHtml',
    inputSchema: GamePageInputSchema,
    outputSchema: GamePageOutputSchema.extend({ usage: UsageSchema.optional(), model: z.string().optional() }),
  },
  async (input) => {
    const localAI = getAI();
    const prompt = localAI.definePrompt({
      name: 'gameFullPageHtmlPrompt',
      input: { schema: GamePageInputSchema },
      output: { schema: GamePageOutputSchema },
      prompt: GAME_PAGE_PROMPT,
    });
    const response = await prompt(input);
    return { ...response.output!, usage: response.usage, model: response.model || MODEL_NAME };
  }
);
