'use server';

/**
 * @fileOverview A flow to edit code based on a user's prompt.
 *
 * - editCode - A function that takes code and a prompt and returns edited code.
 * - EditCodeInput - The input type for the editCode function.
 * - EditCodeOutput - The return type for the editCode function.
 */

import {ai, getAI} from '@/ai/genkit';
import { MODEL_NAME } from '@/ai/model';
import {z} from 'genkit';

const EditCodeInputSchema = z.object({
  code: z.string().describe('The code to be edited.'),
  prompt: z
    .string()
    .describe(
      'A prompt describing the desired changes. Be precise and clear.'
    ),
  fileName: z.string().describe('The name of the file being edited.'),
  model: z.string().optional(),
});
export type EditCodeInput = z.infer<typeof EditCodeInputSchema>;

const UsageSchema = z.object({
  inputTokens: z.number().int().optional(),
  outputTokens: z.number().int().optional(),
  totalTokens: z.number().int().optional(),
});

const EditCodePromptOutputSchema = z.object({
  code: z.string().describe('The edited code.'),
  reasoning: z
    .string()
    .describe('A brief explanation of the changes made to the code.'),
});
const EditCodeFlowOutputSchema = EditCodePromptOutputSchema.extend({
  usage: UsageSchema.optional(),
  model: z.string().optional(),
});
export type EditCodeOutput = z.infer<typeof EditCodeFlowOutputSchema>;

export async function editCode(input: EditCodeInput): Promise<EditCodeOutput> {
  return editCodeFlow(input);
}

const prompt = ai.definePrompt({
  name: 'editCodePrompt',
  input: {schema: EditCodeInputSchema},
  output: {schema: EditCodePromptOutputSchema},
  prompt: `You are an expert web developer specializing in React, Tailwind CSS, and Next.js. You will be given the content of a file and a prompt to edit it.
  
  Your task is to return the **full, edited code** for the file along with a brief, user-friendly explanation of what you changed.
  
  - **Analyze the Request:** Carefully understand the user's prompt.
  - **Apply Changes:** Modify the code to fulfill the request and touch only the lines that are absolutely necessary. Preserve existing structure, formatting, comments, and unrelated content exactly as they are. For example, if asked to change a color or logo, only update the pertinent attributes or markup.
  - **Return Full Content:** You MUST return the complete file content, not just a snippet.
  - **Do Not Add Comments:** Do not add any comments to the code itself.
  - **Keep Logos Clickable:** If the file contains a logo wrapped in a link, preserve that anchor tag so the logo remains clickable and points to the same destination.
  - **Provide Reasoning:** Briefly explain the changes you made in the 'reasoning' field. For example: "I updated the button's background color to blue by changing the Tailwind CSS class from 'bg-red-500' to 'bg-blue-500'."
  - **Language:** Detect the user's prompt language and write the 'reasoning' in that language. If the user writes in Ukrainian, reply in Ukrainian; if in Polish, reply in Polish; if in Russian, reply in Russian. Otherwise reply in the prompt language.

  File Name: {{{fileName}}}
  Prompt: {{{prompt}}}

  Code to edit:
  \`\`\`
  {{{code}}}
  \`\`\`
  `,
});

const editCodeFlow = ai.defineFlow(
  {
    name: 'editCodeFlow',
    inputSchema: EditCodeInputSchema,
    outputSchema: EditCodeFlowOutputSchema,
  },
  async input => {
    // Rebind prompt to chosen model per-request
    const localAI = getAI(input.model);
    const localPrompt = localAI.definePrompt({ name: 'editCodePromptDynamic', input: { schema: EditCodeInputSchema }, output: { schema: EditCodePromptOutputSchema }, prompt: (prompt as any).prompt });
    const response = await localPrompt(input);
    const output = response.output!;
    return {
      ...output,
      usage: response.usage || undefined,
      model: response.model || (input.model ?? MODEL_NAME),
    };
  }
);

    
