// File: src/lib/generation.ts
'use server';

import * as fs from 'fs';
import * as path from 'path';
import { generateGamePageContent, GamePageContent } from '@/ai/flows/generate-game-page-content';
import { generatePolicyContent, PolicyContent } from '@/ai/flows/generate-policy-content';
import { marked } from 'marked';
import { generateSiteStructure, SiteStructure } from '@/ai/flows/generate-site-structure';
import { generateHtmlForSection } from '@/ai/flows/generate-html-for-section';
import { getIndexHtmlTemplate, getGamePageTemplate, getPrivacyPolicyTemplate, mainJsTemplate, stylesCssTemplate, getTermsPageTemplate, getResponsibleGamingPageTemplate } from '@/lib/templates';

// Helper function to recursively read files from the game folder
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

export async function generateSingleSite(prompt: string, siteName: string, websiteTypes: string[] = [], history: string[] = []): Promise<Site | null> {
  try {
    const isGameSite = websiteTypes.includes('Game');

    // --- Step 1: Read Libraries (Images and Games) ---
    let imagePaths: string[] = Array.from({ length: 10 }, (_, i) => `image/${i + 1}.webp`);
    try {
      const casinoImageDir = path.join(process.cwd(), 'public', 'images', 'img-casino');
      const extra = fs.readdirSync(casinoImageDir)
        .filter(file => /\.(jpg|jpeg|png|webp|gif)$/i.test(file))
        .map(file => `images/img-casino/${file}`);
      imagePaths = Array.from(new Set([...imagePaths, ...extra]));
      console.log(`Prepared image set of ${imagePaths.length} paths.`);
    } catch (error) {
      console.warn('Could not read casino images. Using default image placeholders image/1.webp…image/10.webp.');
    }

    let gameFolders: string[] = [];
    const sourceGamesDir = path.join(process.cwd(), 'public', 'games');
    if (isGameSite) {
      try {
        gameFolders = fs.readdirSync(sourceGamesDir).filter(f => fs.statSync(path.join(sourceGamesDir, f)).isDirectory());
        console.log(`Found ${gameFolders.length} games:`, gameFolders);
      } catch (error) {
        console.warn('Could not read games directory.');
      }
    }

    // --- Step 2: AI Content Generation ---
    console.log('Step 2.1: Getting site structure...');
    const structureResult: FlowResult<SiteStructure> = await generateSiteStructure({ prompt, websiteTypes });
    const structure = structureResult;
    if (!structure || !structure.sections || structure.sections.length === 0) {
      throw new Error('The AI architect failed to create a site plan.');
    }
    let totalInputTokens = structureResult.usage?.inputTokens ?? 0;
    let totalOutputTokens = structureResult.usage?.outputTokens ?? 0;

    console.log(`Step 2.2: Generating ${structure.sections.length} sections in parallel (concurrency: 3)...`);
    const themeToUse = structure.theme || { primaryColor: "indigo-500", font: "Inter" };
    const usedImagePaths = new Set<string>();
    const sectionResults = [];
    let imageIndex = 0;

    const queue = [...structure.sections];
    const worker = async () => {
      while (queue.length > 0) {
        const section = queue.shift();
        if (!section) continue;

        let assignedImage: string | undefined = undefined;
        if (imagePaths.length > 0) {
          assignedImage = imagePaths[imageIndex % imagePaths.length];
          imageIndex += 1;
          usedImagePaths.add(assignedImage);
        }
        const res = await generateHtmlForSection({ section, theme: themeToUse, imageUrl: assignedImage });
        sectionResults.push(res);
        if (res.usage?.inputTokens) totalInputTokens += res.usage.inputTokens;
        if (res.usage?.outputTokens) totalOutputTokens += res.usage.outputTokens;
      }
    };

    await Promise.all(Array.from({ length: 3 }, () => worker()));

    // Join the HTML content, now guaranteed to be in the correct order
    const allSectionsHtml = sectionResults.map(result => result.htmlContent).join('\n\n');

    const policyLanguage = isGameSite ? 'English' : 'Ukrainian';
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
      const gameIframePath = `games/${randomGameFolder}/game.html`;

      const gamePageContentResult: FlowResult<GamePageContent> = await generateGamePageContent({ siteName: title });
      if (gamePageContentResult.usage?.inputTokens) totalInputTokens += gamePageContentResult.usage.inputTokens;
      if (gamePageContentResult.usage?.outputTokens) totalOutputTokens += gamePageContentResult.usage.outputTokens;

      files['game.html'] = getGamePageTemplate(title, gamePageContentResult.title, gameIframePath, gamePageContentResult.disclaimerHtml);

      // Recursively get all game files and add them to the files object
      const gameFilesDir = path.join(sourceGamesDir, randomGameFolder);
      const gameFiles = await getFilesRecursively(gameFilesDir);
      for (const [filePath, content] of Object.entries(gameFiles)) {
        files[`games/${randomGameFolder}/${filePath}`] = content;
      }
    }

    // Add standard files
    files['index.html'] = getIndexHtmlTemplate(title, allSectionsHtml, websiteTypes);
    files['privacy-policy.html'] = getPrivacyPolicyTemplate(title, domain, policyContentHtml);
    files['scripts/main.js'] = mainJsTemplate;
    files['styles/style.css'] = stylesCssTemplate;
    // Add placeholder pages for other legal documents
    files['terms.html'] = getTermsPageTemplate(title);
    files['responsible-gaming.html'] = getResponsibleGamingPageTemplate(title);
    
    // Add used images
    console.log(`Adding ${usedImagePaths.size} used images to the files object...`);
    for (const webPath of usedImagePaths) {
      const localPath = path.join(process.cwd(), 'public', webPath);
      try {
        files[webPath] = fs.readFileSync(localPath);
      } catch (error) {
        console.warn(`Could not read image file at ${localPath}`);
      }
    }

    console.log('Generation successful!');
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
