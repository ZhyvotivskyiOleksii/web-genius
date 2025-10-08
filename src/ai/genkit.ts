import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
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
