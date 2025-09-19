// File: src/ai/flows/generate-policy-content.ts
"use server";

import { ai } from '@/ai/genkit';
import { MODEL_NAME } from '@/ai/model';
import { z } from 'zod';

const PolicySectionSchema = z.object({
  id: z.string().describe("Короткий ID для HTML-якоря (напр., 'data-collection')"),
  title: z.string().describe("Заголовок секції"),
  content: z.string().describe("Детальний текст для цієї секції у форматі Markdown."),
});

const UsageSchema = z.object({
  inputTokens: z.number().int().optional(),
  outputTokens: z.number().int().optional(),
  totalTokens: z.number().int().optional(),
});

const PolicyContentOutputSchema = z.object({
  sections: z.array(PolicySectionSchema).describe("Масив з 5-7 унікальних секцій для політики конфіденційності."),
});
export type PolicyContent = z.infer<typeof PolicyContentOutputSchema>;

const PolicyContentFlowOutputSchema = PolicyContentOutputSchema.extend({
  usage: UsageSchema.optional(),
  model: z.string().optional(),
});
export type PolicyContentFlowResult = z.infer<typeof PolicyContentFlowOutputSchema>;

// 1. ЗМІНА ТУТ: Додано поле `language`
const PolicyContentInputSchema = z.object({
  siteName: z.string(),
  siteDescription: z.string(),
  language: z.string().optional().describe("Мова для генерації контенту (наприклад, 'English' або 'Ukrainian')"),
});

// 2. ЗМІНА ТУТ: Оновлено промпт, щоб він враховував мову
const policyPrompt = ai.definePrompt({
  name: 'policyContentPrompt',
  input: { schema: PolicyContentInputSchema },
  output: { schema: PolicyContentOutputSchema },
  prompt: `Ты — AI-специалист по юридическим текстам и приватности данных. Твоя задача — создать содержательный и уникальный текст для страницы "Политика Конфиденциальности", адаптированный для сайта пользователя.

**Инструкции:**
1.  **Язык генерации: {{#if language}}{{language}}{{else}}English{{/if}}**. Весь текст (заголовки, контент) должен быть строго на этом языке.
2.  **Создай 5-7 развернутых секций**, покрывающих ключевые темы: сбор информации, использование cookie-файлов, как мы используем данные, права пользователей (GDPR/CCPA), безопасность данных, и изменения в политике.
3.  **Текст должен быть профессиональным**, но написан понятным для обычного пользователя языком.
4.  **КРИТИЧЕСКИ ВАЖНО:** Каждый раз генерируй **уникальный текст**. Активно используй синонимы, меняй структуру предложений, перефразируй стандартные положения, чтобы избежать дословного повторения между сайтами.
5.  **Адаптируй тон и примеры** под описание сайта.
6.  **Верни результат строго в формате JSON** в соответствии с предоставленной схемой. Никакого текста до или после JSON.

**Контекст сайта:**
-   Название: "{{siteName}}"
-   Описание: "{{siteDescription}}"`,
});

export const generatePolicyContent = ai.defineFlow(
  {
    name: 'generatePolicyContent',
    inputSchema: PolicyContentInputSchema,
    outputSchema: PolicyContentFlowOutputSchema,
  },
  async (input) => {
    // ... (решта коду залишається без змін) ...
    console.log(`Generating policy content for: ${input.siteName} in ${input.language || 'default English'}`);
    const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));
    let lastErr: any = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await policyPrompt(input);
        const output = response.output!;
        if (!output?.sections || output.sections.length === 0) {
          throw new Error('Empty policy output');
        }
        return {
          ...output,
          usage: response.usage || undefined,
          model: response.model || MODEL_NAME,
        };
      } catch (e) {
        lastErr = e;
        await sleep(Math.min(3200, 700 * attempt));
      }
    }
    console.error('generatePolicyContent: fallback used due to error:', lastErr?.message || lastErr);
    const sanitize = (s: string) => (s || '').toString().trim() || 'Our Website';
    const name = sanitize(input.siteName);
    const desc = sanitize(input.siteDescription);
    const fallback: PolicyContentFlowResult = {
      sections: [
        { id: 'introduction', title: 'Introduction', content: `This Privacy Policy explains how ${name} ("we", "us") handles information. This site is described as: ${desc}. We strive to collect as little personal data as possible and use it only for the purposes described below.`},
        { id: 'data-collection', title: 'Information We Collect', content: `We may collect non‑identifying technical details such as browser type, device characteristics, and basic usage analytics. If you choose to contact us, we may also store your email address and message for support purposes.`},
        { id: 'cookies', title: 'Cookies and Local Storage', content: `We use cookies or similar technologies to improve the site’s functionality (for example, saving your UI preferences). You can control cookies through your browser settings; disabling them may affect some features.`},
        { id: 'use-of-data', title: 'How We Use Information', content: `Collected information is used to operate and improve ${name}, measure basic usage, prevent abuse, and respond to user requests. We do not sell personal information.`},
        { id: 'rights', title: 'Your Rights', content: `Depending on your jurisdiction, you may have rights to access, correct, or delete your personal data. To exercise these rights, please contact us using the details on the site.`},
        { id: 'security', title: 'Data Security', content: `We apply reasonable administrative and technical safeguards to protect data. However, no method of transmission or storage is completely secure.`},
        { id: 'changes', title: 'Changes to This Policy', content: `We may update this Policy periodically. The latest version will always be available on this page. Continued use of ${name} after changes constitutes acceptance of the updated Policy.`},
      ],
      model: MODEL_NAME,
    };
    return fallback;
  }
);