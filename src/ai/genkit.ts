import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { MODEL_NAME } from '@/ai/model';

// Ensure the Google AI plugin sees an API key.
// Many setups use GEMINI_API_KEY; the plugin expects GOOGLE_GENAI_API_KEY.
if (!process.env.GOOGLE_GENAI_API_KEY && process.env.GEMINI_API_KEY) {
  process.env.GOOGLE_GENAI_API_KEY = process.env.GEMINI_API_KEY;
}

export const ai = genkit({
  plugins: [googleAI()],
  model: MODEL_NAME,
});

// Helper to create an AI instance with a specific model at call time.
// This lets us switch between Pro/Flash per request without restarting.
export function getAI(model?: string) {
  return genkit({
    plugins: [googleAI()],
    model: model || MODEL_NAME,
  });
}
