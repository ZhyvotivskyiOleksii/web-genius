'use server';

import { ai } from '@/ai/genkit';
import { MODEL_NAME } from '@/ai/model';
import { z } from 'zod';

const EditElementInputSchema = z.object({
  elementHtml: z.string().describe('Current HTML markup of the selected element.'),
  prompt: z.string().describe('Instructions describing how to update the element.'),
  css: z.string().optional().describe('The complete contents of the shared CSS file.'),
});

const UsageSchema = z.object({
  inputTokens: z.number().int().optional(),
  outputTokens: z.number().int().optional(),
  totalTokens: z.number().int().optional(),
});

const EditElementPromptOutputSchema = z.object({
  elementHtml: z.string().describe('The updated HTML markup for the element.'),
  reasoning: z.string().describe('A concise explanation of the applied changes.'),
  css: z.string().optional().describe('Updated CSS file content if styles were modified. Omit when unchanged.'),
});

const EditElementFlowOutputSchema = EditElementPromptOutputSchema.extend({
  usage: UsageSchema.optional(),
  model: z.string().optional(),
});

const editElementPrompt = ai.definePrompt({
  name: 'editElementPrompt',
  input: { schema: EditElementInputSchema },
  output: { schema: EditElementPromptOutputSchema },
  prompt: `You will receive the current HTML snippet for a single element and, optionally, the full CSS file that styles the page.

- Apply the requested changes described in the prompt.
- Keep the markup well structured and only change what is necessary.
- Preserve existing ids, classes, and accessibility attributes unless the prompt requires otherwise.
- Do not modify anything outside of the provided element. Parents, siblings, and other parts of the document must remain unchanged.
- Maintain indentation that matches the input (two spaces per level) and include the full element markup.
- Keep navigation/menu structures intact: do not remove or reorder existing nav links and always preserve classes that control menu visibility (for example \"mobile-nav-hidden\", \"mobile-nav-visible\", \"burger-icon\", \"brand-badge\").
- When updating a logo or icon, swap the graphic inside the existing container instead of adding new wrapper elements or altering surrounding layout.
- Preserve any existing anchor tags around the logo so it remains clickable and continues to link to the homepage or original target.
- If you need to adjust shared styles, return the COMPLETE updated CSS file in the \"css\" field. Otherwise omit the field.
- Keep every unrelated CSS rule identical; only touch declarations that are required for the requested change.
- Write the reasoning in the same language as the user's prompt. Detect Ukrainian, Russian, Polish, or English automatically and stay consistent.
- Never wrap the response in markdown. Respond using the output schema.

Input HTML:
{{{elementHtml}}}

{{#if css}}
Current CSS file:
{{{css}}}
{{/if}}

User request:
{{{prompt}}}`,
});

export const editElementFlow = ai.defineFlow(
  {
    name: 'editElementFlow',
    inputSchema: EditElementInputSchema,
    outputSchema: EditElementFlowOutputSchema,
  },
  async (input) => {
    const response = await editElementPrompt(input);
    const output = response.output!;
    return {
      ...output,
      usage: response.usage || undefined,
      model: response.model || MODEL_NAME,
    };
  },
);
