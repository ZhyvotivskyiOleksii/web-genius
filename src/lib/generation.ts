// File: src/lib/generation.ts
'use server';

import * as fs from 'fs';
import * as path from 'path';
import { generateGamePageContent, GamePageContent } from '@/ai/flows/generate-game-page-content';
import { generatePolicyContent, PolicyContent } from '@/ai/flows/generate-policy-content';
import { marked } from 'marked';
import { generateSiteStructure, SiteStructure } from '@/ai/flows/generate-site-structure';
import { generateHtmlForSection } from '@/ai/flows/generate-html-for-section';
import { getIndexHtmlTemplate, getGamePageTemplate, getPrivacyPolicyTemplate, mainJsTemplate, stylesCssTemplate } from '@/lib/templates';
import manifest from '@/lib/asset-manifest.json';

function detectLanguage(prompt: string): { name: string; iso: string } {
  const text = (prompt || '').toLowerCase();

  const explicitChecks: Array<{ name: string; iso: string; regex: RegExp[] }> = [
    {
      name: 'Polish',
      iso: 'pl',
      regex: [
        /\bpo\s+polsku\b/,
        /\bпо\s+польськ(?:ій|ою)\b/,
        /\bна\s+польск(?:ом|ом языке)\b/,
        /\bin\s+polish\b/,
        /\bwebsite\s+(should|must)\s+be\s+in\s+polish\b/,
        /\bstrona\s+powinna\s+być\s+po\s+polsku\b/,
      ],
    },
    {
      name: 'Ukrainian',
      iso: 'uk',
      regex: [
        /\bукраїнськ(?:ою|ій)\b/,
        /\bна\s+українській\b/,
        /\bin\s+ukrainian\b/,
      ],
    },
    {
      name: 'English',
      iso: 'en',
      regex: [
        /\bв\s+английском\b/,
        /\bна\s+англійській\b/,
        /\bin\s+english\b/,
      ],
    },
  ];

  for (const lang of explicitChecks) {
    if (lang.regex.some((rx) => rx.test(text))) {
      return { name: lang.name, iso: lang.iso };
    }
  }

  const polishRegex = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;
  const cyrillicRegex = /[\u0400-\u04FF]/;
  if (polishRegex.test(prompt)) {
    return { name: 'Polish', iso: 'pl' };
  }
  if (cyrillicRegex.test(prompt)) {
    return { name: 'Ukrainian', iso: 'uk' };
  }
  return { name: 'English', iso: 'en' };
}

function getLocalizedSectionTemplates(language: string, siteName: string) {
  const templates: Record<string, { type: string; title: string; details?: string }[]> = {
    English: [
      { type: 'hero', title: `Experience ${siteName}` },
      { type: 'about', title: 'About Us' },
      { type: 'features', title: 'Highlights & Features' },
      { type: 'stats', title: 'Key Stats & Milestones' },
      { type: 'parallax', title: 'Immersive Moments' },
      { type: 'faq', title: 'Frequently Asked Questions' },
      { type: 'responsible', title: 'Responsible Entertainment' },
      { type: 'cta', title: 'Try the Demo Experience' },
    ],
    Polish: [
      { type: 'hero', title: `Poznaj ${siteName}` },
      { type: 'about', title: 'O nas' },
      { type: 'features', title: 'Najważniejsze atuty' },
      { type: 'stats', title: 'Statystyki i sukcesy' },
      { type: 'parallax', title: 'Sportowe emocje' },
      { type: 'faq', title: 'Najczęstsze pytania' },
      { type: 'responsible', title: 'Odpowiedzialna rozrywka' },
      { type: 'cta', title: 'Wypróbuj demo' },
    ],
    Ukrainian: [
      { type: 'hero', title: `Відкрийте ${siteName}` },
      { type: 'about', title: 'Про нас' },
      { type: 'features', title: 'Наші переваги' },
      { type: 'stats', title: 'Статистика та досягнення' },
      { type: 'parallax', title: 'Яскраві моменти' },
      { type: 'faq', title: 'Поширені запитання' },
      { type: 'responsible', title: 'Відповідальна гра' },
      { type: 'cta', title: 'Спробуйте демо' },
    ],
  };
  return templates[language] || templates.English;
}

// Helper to grab all files within a directory (used for game bundles)
async function getFilesRecursively(dir: string): Promise<Record<string, Buffer>> {
  const fileList: Record<string, Buffer> = {};
  const readDir = async (currentDir: string, relativeDir: string) => {
    const files = await fs.promises.readdir(currentDir);
    for (const file of files) {
      const filePath = path.join(currentDir, file);
      const fileStat = await fs.promises.stat(filePath);
      const relativeFilePath = path.join(relativeDir, file);
      if (fileStat.isDirectory()) {
        await readDir(filePath, relativeFilePath);
      } else {
        fileList[relativeFilePath] = await fs.promises.readFile(filePath);
      }
    }
  };
  await readDir(dir, '');
  return fileList;
}

// Type definitions (unchanged)
type FlowResult<T> = T & {
  usage?: { inputTokens?: number; outputTokens?: number };
  model?: string;
};
export type TokenUsageSummary = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  model?: string;
};
export type Site = {
  domain: string;
  files: Record<string, Buffer | string>;
  history: string[];
  types?: string[];
  usage?: TokenUsageSummary;
};

type AssetManifest = {
  images?: string[];
  games?: string[];
};

const assets = manifest as AssetManifest;

function extractRequestedSectionCount(input: string): number | null {
  if (!input) return null;
  const normalized = input.toLowerCase();
  const digitMatch = normalized.match(/(\d+)\s*(?:section|sections|секц|раздел|block|blocks|блок)/);
  if (digitMatch) {
    const count = Number.parseInt(digitMatch[1], 10);
    if (Number.isFinite(count) && count > 0 && count < 50) {
      return count;
    }
  }
  const wordToNumber: Record<string, number> = {
    one: 1,
    single: 1,
    'один': 1,
    'одна': 1,
    'одну': 1,
    'одной': 1,
    two: 2,
    'два': 2,
    'две': 2,
    'двух': 2,
    three: 3,
    'три': 3,
    'трех': 3,
    'трёх': 3,
    four: 4,
    'четыре': 4,
    five: 5,
    'пять': 5,
    six: 6,
    'шесть': 6,
    seven: 7,
    'семь': 7,
    eight: 8,
    'восемь': 8,
    nine: 9,
    'девять': 9,
    ten: 10,
    'десять': 10,
  };
  const wordMatch = normalized.match(/\b(один|одна|одну|одной|два|две|двух|три|трех|трёх|четыре|пять|шесть|семь|восемь|девять|десять|one|two|three|four|five|six|seven|eight|nine|ten|single)\b[^\S\r\n]*(?:секц|section|раздел|block|блок)/);
  if (wordMatch) {
    const value = wordToNumber[wordMatch[1]];
    if (typeof value === 'number') {
      return value;
    }
  }
  return null;
}

function resolveLanguage(prompt: string, websiteTypes: string[]): { name: string; iso: string } {
  if (websiteTypes?.includes('Sport bar Poland')) {
    return { name: 'Polish', iso: 'pl' };
  }
  if (websiteTypes?.includes('Game')) {
    return { name: 'English', iso: 'en' };
  }
  return detectLanguage(prompt);
}

export async function generateSingleSite(prompt: string, siteName: string, websiteTypes: string[] = [], history: string[] = []): Promise<Site | null> {
  try {
    const startedAt = Date.now();
    const isGameSite = websiteTypes.includes('Game');
    const publicDir = path.join(process.cwd(), 'public');
    const sourceGamesDir = path.join(publicDir, 'games');
    const { name: languageName } = resolveLanguage(prompt, websiteTypes);

    // --- Step 1: Read Libraries (Images and Games) via manifest ---
    const imagePaths = Array.isArray(assets.images) ? assets.images : [];
    const manifestGames = Array.isArray(assets.games) ? assets.games : [];
    const gameFolders = manifestGames.filter((folder) => {
      if (!folder) return false;
      try {
        return fs.existsSync(path.join(sourceGamesDir, folder));
      } catch {
        return false;
      }
    });
    console.log(`Using manifest: found ${imagePaths.length} images and ${gameFolders.length} games (available on disk).`);

    // --- Step 2: AI Content Generation ---
    console.log('Step 2.1: Getting site structure...');
    const structureResult: FlowResult<SiteStructure> = await generateSiteStructure({ prompt, language: languageName });
    const structure = structureResult;
    if (!structure || !structure.sections || structure.sections.length === 0) {
      throw new Error('The AI architect failed to create a site plan.');
    }
    const desiredSections = getLocalizedSectionTemplates(languageName, siteName);
    const explicitSectionCount = extractRequestedSectionCount(prompt);
    if (explicitSectionCount != null && structure.sections.length > explicitSectionCount) {
      structure.sections = structure.sections.slice(0, explicitSectionCount);
    }
    const normalized = new Set(structure.sections.map(s => s.type.toLowerCase()));
    const limit = explicitSectionCount ?? 8;
    for (const section of desiredSections) {
      if (structure.sections.length >= limit) break;
      if (!normalized.has(section.type.toLowerCase())) {
        structure.sections.push({ type: section.type, title: section.title, details: section.details });
        normalized.add(section.type.toLowerCase());
      }
    }
    const mainSections = structure.sections.filter(s => !['terms', 'privacy', 'responsible-gaming'].includes(s.type));
    const legalSections = structure.sections.filter(s => ['terms', 'privacy', 'responsible-gaming'].includes(s.type));

    let totalInputTokens = structureResult.usage?.inputTokens ?? 0;
    let totalOutputTokens = structureResult.usage?.outputTokens ?? 0;

    console.log(`Step 2.2: Generating ${mainSections.length} sections with limited concurrency...`);
    const themeToUse = structure.theme || { primaryColor: "indigo-500", font: "Inter" };
    const usedImagePaths = new Set<string>();
    const sectionResults: { html: string; model?: string }[] = [];
    const CHUNK_SIZE = 4;

    for (let i = 0; i < mainSections.length; i += CHUNK_SIZE) {
      const slice = mainSections.slice(i, i + CHUNK_SIZE);
      const generated = await Promise.all(slice.map(async (section) => {
        let randomImageUrl: string | undefined = imagePaths.length > 0 ? imagePaths[Math.floor(Math.random() * imagePaths.length)] : undefined;
        if (randomImageUrl) {
          usedImagePaths.add(randomImageUrl);
        }
        const res = await generateHtmlForSection({ section, theme: themeToUse, imageUrl: randomImageUrl, language: languageName });
        if (res.usage?.inputTokens) totalInputTokens += res.usage.inputTokens;
        if (res.usage?.outputTokens) totalOutputTokens += res.usage.outputTokens;
        return { html: res.htmlContent, model: res.model };
      }));
      sectionResults.push(...generated);
    }

    const allSectionsHtml = sectionResults.map(result => result.html).join('\n\n');

    const policyLanguage = languageName;
    console.log(`Step 2.3: Generating unique privacy policy in ${policyLanguage}...`);
    const policyResult: FlowResult<PolicyContent> = await generatePolicyContent({ siteName, siteDescription: prompt, language: policyLanguage });
    if (policyResult.usage?.inputTokens) totalInputTokens += policyResult.usage.inputTokens;
    if (policyResult.usage?.outputTokens) totalOutputTokens += policyResult.usage.outputTokens;
    const policyContentHtml = policyResult.sections.map(section => {
      const contentHtml = marked.parse(section.content);
      return `<section><h2 id="${section.id}" class="text-3xl font-bold text-white !mt-12 !mb-4">${section.title}</h2>${contentHtml}</section>`;
    }).join('\n\n');

    // --- Step 3: Assemble Final Files Object ---
    console.log('Step 3: Assembling final files object...');
    const title = siteName || "My Website";
    const domain = title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 50) || 'my-website';
    
    const files: Record<string, Buffer | string> = {};
    
    // Game page logic
    if (isGameSite && gameFolders.length > 0) {
      console.log('Step 3.1: Generating game page...');
      const randomGameFolder = gameFolders[Math.floor(Math.random() * gameFolders.length)];

      const absoluteHost = process.env.NEXT_PUBLIC_GAME_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
      const gameIframePath = absoluteHost
        ? `${absoluteHost.replace(/\/$/, '')}/games/${randomGameFolder}/game.html`
        : `games/${randomGameFolder}/game.html`;

      const gamePageContentResult: FlowResult<GamePageContent> = await generateGamePageContent({ siteName: title, language: languageName });
      if (gamePageContentResult.usage?.inputTokens) totalInputTokens += gamePageContentResult.usage.inputTokens;
      if (gamePageContentResult.usage?.outputTokens) totalOutputTokens += gamePageContentResult.usage.outputTokens;

      files['game.html'] = getGamePageTemplate(title, gamePageContentResult.title, gameIframePath, gamePageContentResult.disclaimerHtml);

      // Bundle the selected game's assets into the export so the iframe works offline.
      try {
        const gameAssets = await getFilesRecursively(path.join(sourceGamesDir, randomGameFolder));
        for (const [relative, buffer] of Object.entries(gameAssets)) {
          const normalizedRelative = relative.split(path.sep).join('/');
          const zipPath = ['games', randomGameFolder, normalizedRelative].join('/');
          files[zipPath] = buffer;
        }
      } catch (error) {
        console.warn(`Failed to attach game assets for ${randomGameFolder}:`, error);
      }
    }

    // Add standard files
    files['index.html'] = getIndexHtmlTemplate(title, allSectionsHtml, websiteTypes);
    files['privacy-policy.html'] = getPrivacyPolicyTemplate(title, domain, policyContentHtml);
    files['scripts/main.js'] = mainJsTemplate;
    files['styles/style.css'] = stylesCssTemplate;
    
    // Add used images
    console.log(`Adding ${usedImagePaths.size} used images to the files object...`);
    for (const webPath of usedImagePaths) {
      const localPath = path.join(publicDir, webPath);
      try {
        files[webPath] = await fs.promises.readFile(localPath);
      } catch (error) {
        console.warn(`Could not read image file at ${localPath}`, error);
      }
    }

    const elapsedMs = Date.now() - startedAt;
    console.log(`Generation successful! Main sections: ${mainSections.length}, legal sections: ${legalSections.length}, elapsed ${Math.round(elapsedMs / 100) / 10}s`);
    const usage: TokenUsageSummary = {
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      totalTokens: totalInputTokens + totalOutputTokens,
      model: structureResult.model || sectionResults[0]?.model,
    };

    return { domain, files, history: [...history, prompt], types: websiteTypes, usage };

  } catch (error) {
    console.error(`Fatal generation error for prompt "${prompt}":`, error);
    return null;
  }
}
