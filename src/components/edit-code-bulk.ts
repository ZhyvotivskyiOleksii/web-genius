import { ai } from '@/ai/genkit';
import { MODEL_NAME } from '@/ai/model';
import { z } from 'zod';

function detectLanguage(text: string): 'uk' | 'ru' | 'pl' | 'en' {
  const lower = text.toLowerCase();
  if (/[їєґі]/.test(lower)) return 'uk';
  if (/[ąćęłńóśźż]/.test(lower)) return 'pl';
  if (/[а-яё]/.test(lower)) return 'ru';
  return 'en';
}

function messageForRateLimit(lang: 'uk' | 'ru' | 'pl' | 'en'): string {
  switch (lang) {
    case 'uk':
      return 'Модель тимчасово обмежена за квотою. Зачекайте кілька секунд і спробуйте знову.';
    case 'ru':
      return 'Модель сейчас ограничена по квоте. Подождите несколько секунд и попробуйте снова.';
    case 'pl':
      return 'Model jest chwilowo ograniczony limitem. Poczekaj kilka sekund i spróbuj ponownie.';
    default:
      return 'The AI model is rate limited right now. Please wait a few seconds and try again.';
  }
}

function messageForOverload(lang: 'uk' | 'ru' | 'pl' | 'en'): string {
  switch (lang) {
    case 'uk':
      return 'Модель тимчасово перевантажена. Спробуйте повторити запит трохи пізніше.';
    case 'ru':
      return 'Модель временно перегружена. Попробуйте повторить запрос чуть позже.';
    case 'pl':
      return 'Model jest tymczasowo przeciążony. Spróbuj ponownie za chwilę.';
    default:
      return 'The AI model is temporarily overloaded. Please try again shortly.';
  }
}

function messageForParse(lang: 'uk' | 'ru' | 'pl' | 'en'): string {
  switch (lang) {
    case 'uk':
      return 'Не вдалося застосувати зміни. Спробуйте описати запит детальніше або повторіть його.';
    case 'ru':
      return 'Не удалось применить изменения. Попробуйте описать запрос подробнее или повторить его.';
    case 'pl':
      return 'Nie udało się zastosować zmian. Opisz prośbę dokładniej lub spróbuj ponownie.';
    default:
      return 'I could not apply changes this time. Please add more detail or try again.';
  }
}

const EditCodeBulkInputSchema = z.object({
  files: z.array(z.object({
    fileName: z.string(),
    code: z.string(),
  })),
  prompt: z.string().describe('A prompt describing the desired changes across the whole project.'),
});

const FileModificationSchema = z.object({
  fileName: z.string().describe('The full path of the file to modify, create, or delete.'),
  code: z.string().nullable().describe('The new content of the file. If null, the file should be deleted.'),
});

const UsageSchema = z.object({
  inputTokens: z.number().int().optional(),
  outputTokens: z.number().int().optional(),
  totalTokens: z.number().int().optional(),
});

const EditCodeBulkOutputSchema = z.object({
  answer: z.string().optional().describe("A direct, conversational answer to the user's question. Used when no code changes are made."),
  reasoning: z.string().optional().describe('A high-level summary of the changes made across all files. Used when modifications are made.'),
  modifications: z.array(FileModificationSchema).optional().describe('A list of file modifications. Should be empty or omitted if just answering a question.'),
  usage: UsageSchema.optional(),
  model: z.string().optional(),
});

export const editCodeBulkFlow = ai.defineFlow(
  {
    name: 'editCodeBulkFlow',
    inputSchema: EditCodeBulkInputSchema,
    outputSchema: EditCodeBulkOutputSchema,
  },
  async (input) => {
    // Simple retry with backoff for transient 5xx overloads
    const lang = detectLanguage(input.prompt);
    // This function calls the AI and should return the entire response object.
    // The previous `Promise<string>` was incorrect.
    const gen = async (): Promise<any> => { // This function calls the AI and should return the entire response object.
      let lastErr: any = null;
      const MAX_RETRIES = 3;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const response = await ai.generate({
            prompt: `You are an expert, friendly web developer. Your goal is to be a helpful colleague.

**INTENT ANALYSIS:**
First, determine the user's intent from their prompt.
- **If the user is asking a question** (e.g., "what does this do?", "explain this part", "how can I..."), your primary goal is to provide a helpful answer.
- **If the user is giving a command** (e.g., "change the color", "add a new section", "fix the layout"), your primary goal is to modify the code.

**OUTPUT FORMAT:**
Your entire response MUST be a single, valid JSON object and nothing else. Do not include any explanatory text, greetings, or markdown formatting like \`\`\`json before or after the JSON object.

- **For questions:**
  - The JSON should have one key: \`"answer"\`.
  - The value should be a friendly, conversational, and helpful explanation in the same language as the user's prompt.
  - The \`modifications\` and \`reasoning\` keys MUST be omitted.

- **For commands:**
  - The JSON must have two keys: \`"reasoning"\` and \`"modifications"\`.
  - The \`"reasoning"\` should be a friendly summary of the changes you're making. For example, instead of "За запитом користувача...", say something like "Звісно, я оновив дизайн, щоб він виглядав сучасніше!". Respond in the same language as the user's prompt.
  - The \`"modifications"\` must be an array of file operations.
  - The \`answer\` key MUST be omitted.

**CRITICAL RULES:**
1.  **PRIORITIZE EDITING EXISTING FILES:** Before creating a new file, you MUST check if a similar file already exists. For example, for style changes, edit the existing \`styles/style.css\` file. Only create new files if the user explicitly asks for a new page or a new, separate functionality.
2.  **Correct File Placement:** If you must create a new file, place it in the correct directory (e.g., new JS in \`scripts/\`, new CSS in \`styles/\`).
3.  **File Operations:** Each object in the "modifications" array must have:
    - \`fileName\`: The full path of the file. For new files, provide a full, sensible path.
    - \`code\`: The **full, updated content** of the file. To delete a file, set \`code\` to \`null\`.
4.  **JSON STRING ESCAPING:** The \`code\` property is a JSON string. All special characters within the file content, such as backslashes (\\), double quotes ("), and newlines, MUST be properly escaped (e.g., \\\\, \\", \\n) to ensure the final output is valid JSON.
5.  **No Partial Code:** Always return the complete code for any file you are updating.
6.  **Be Conservative:** If a file is not affected by the prompt, do not include it in the "modifications" array.
7.  **ALWAYS ATTEMPT COMMANDS:** If the prompt is a command to change something, you MUST attempt to produce code modifications. Do not use the \`answer\` field to refuse a command. If the command is unclear, make a best-effort attempt and explain your assumptions in the \`reasoning\` field.
8.  **ASK ONLY IF IMPOSSIBLE:** Only if it is absolutely impossible to interpret the command or find any relevant code, you may use the \`answer\` field to ask a clarifying question.
9.  **EXPLAIN NO-OP:** If a command is given but no code changes are necessary (e.g., the requested state is already present), you MUST explain this in the \`answer\` field. Do not return empty modifications without an explanation. For example: "The logo color is already blue as requested."

**CONTEXT FOR THIS TASK:**
- User's Prompt: ${input.prompt}
- Project Files:
${input.files.map(f => `
---
File: ${f.fileName}
\`\`\`
${f.code}
\`\`\`
---
`).join('\n')}
`,
          });
          return response;
        } catch (e: any) {
          lastErr = e;
          const status = e?.status;

          // Don't retry on client-side or non-retryable server errors
          if (status && status >= 400 && status < 500 && status !== 429) {
            throw e;
          }

          // Exponential backoff with jitter
          let delay = 1000 * Math.pow(2, attempt - 1) + Math.random() * 1000;

          if (status === 429) {
            console.warn(`Rate limit hit. Attempt ${attempt}/${MAX_RETRIES}.`);
            const retryFromDetails = Array.isArray(e?.errorDetails)
              ? e.errorDetails
                  .map((d: any) => d?.retryDelay)
                  .find(Boolean)
              : undefined;
            if (retryFromDetails) {
              const parsedDelay = Math.ceil((parseFloat(String(retryFromDetails).replace(/s$/, '')) || 0) * 1000);
              delay = Math.max(delay, parsedDelay); // Use the larger of our backoff or the API's suggestion
            }
          } else {
            console.warn(`AI call failed. Attempt ${attempt}/${MAX_RETRIES}. Retrying in ${Math.round(delay)}ms...`);
          }

          await new Promise(r => setTimeout(r, delay));
        }
      }
      throw lastErr || new Error('AI generation failed after multiple retries.');
    };

    let response: any;
    try {
      response = await gen();
    } catch (err: any) {
      if (err?.status === 429) {
        return {
          answer: messageForRateLimit(lang),
          modifications: [],
          usage: undefined,
          model: MODEL_NAME,
        };
      }
      if (err?.status === 503) {
        return {
          answer: messageForOverload(lang),
          modifications: [],
          usage: undefined,
          model: MODEL_NAME,
        };
      }
      throw err;
    }

    // Now `response` is the object, and `response.text` is the string content.
    const text = response.text || '';

    try {
      // Extract JSON block (inside ```json ... ``` or between outermost braces)
      let jsonCandidate = '';
      const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (fenced && fenced[1]) {
        jsonCandidate = fenced[1];
      } else {
        const s = text.indexOf('{');
        const e = text.lastIndexOf('}');
        if (s !== -1 && e > s) jsonCandidate = text.substring(s, e + 1);
      }
      if (!jsonCandidate) throw new Error('No JSON found in model output');

      const repair = (src: string) => {
        let s = src.trim();
        // Remove BOM/zero width, normalize exotic line separators
        s = s.replace(/\uFEFF/g, '').replace(/[\u2028\u2029]/g, '\n');
        // Strip comments if any
        s = s.replace(/\/(?:\*[^]*?\*\/|\/[^\n]*)/g, '');
        // Remove dangling commas
        s = s.replace(/,\s*([}\]])/g, '$1');
        return s;
      };

      let parsed: any;
      try {
        parsed = JSON.parse(jsonCandidate.trim());
      } catch {
        parsed = JSON.parse(repair(jsonCandidate));
      }

      const base = EditCodeBulkOutputSchema.parse(parsed);
      return {
        ...base,
        usage: response.usage || undefined,
        model: response.model || MODEL_NAME, // This now works
      };
    } catch (e) {
      console.error('Failed to parse bulk edit AI response as JSON', e);
      console.error('Original AI text:', text);
      // Graceful fallback: treat as answer-only so UI не падает
      return {
        answer: messageForParse(lang),
        modifications: [],
        reasoning: undefined,
        usage: response.usage || undefined, // This now works
        model: response.model || MODEL_NAME, // This now works
      };
    }
  },
);
