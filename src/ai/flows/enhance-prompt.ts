'use server';

/**
 * @fileOverview A flow to enhance a user's prompt for website generation.
 *
 * - enhancePrompt - A function that takes a prompt and returns an enhanced version.
 * - EnhancePromptInput - The input type for the enhancePrompt function.
 * - EnhancePromptOutput - The return type for the enhancePrompt function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const EnhancePromptInputSchema = z.object({
  prompt: z.string().describe('The user prompt to be enhanced.'),
});
export type EnhancePromptInput = z.infer<typeof EnhancePromptInputSchema>;

const EnhancePromptOutputSchema = z.object({
  enhancedPrompt: z.string().describe('The enhanced prompt.'),
});
export type EnhancePromptOutput = z.infer<typeof EnhancePromptOutputSchema>;

export async function enhancePrompt(
  input: EnhancePromptInput
): Promise<EnhancePromptOutput> {
  return enhancePromptFlow(input);
}

const prompt = ai.definePrompt({
  name: 'enhancePrompt',
  input: {schema: EnhancePromptInputSchema},
  output: {schema: EnhancePromptOutputSchema},
  prompt: `You are an expert prompt engineer for a website generation AI. Your task is to transform the user's short idea into a clear, inspiring brief for a uniquely styled, modern website.

Incorporate concrete ideas for:
- Animations: tasteful scroll reveals, subtle parallax, and micro‑interactions.
- Visual style: use modern trends (glassmorphism, bold gradients, futuristic/minimal layouts) with unique color palettes and typography.
- Icons: where appropriate, mention using Material Icons (by name) or Font Awesome classes for navigation, features, and CTAs.
- Graphics: suggest an optional decorative HTML <canvas id="fx-canvas"> in the hero for ambient particle/gradient effects when it fits the brand vibe.
- Sections: recommend a varied, non‑template structure (distinct hero, value props, galleries/charts, testimonials, pricing, contact, etc.).

Clarity rules:
- Write a single, cohesive paragraph. Be specific and avoid generic phrases.
- Avoid filler like “Lorem ipsum”. Use original, engaging copy ideas.

User Prompt:
"{{{prompt}}}"

Rewrite it now into a single, vivid paragraph that includes design, animation, icon, and (if suitable) canvas ideas. Output only the enhanced prompt string in the JSON response.
`,
});

const enhancePromptFlow = ai.defineFlow(
  {
    name: 'enhancePromptFlow',
    inputSchema: EnhancePromptInputSchema,
    outputSchema: EnhancePromptOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
