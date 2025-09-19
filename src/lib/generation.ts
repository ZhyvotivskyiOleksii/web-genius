// File: src/lib/generation.ts
'use server';

import * as fs from 'fs';
import * as path from 'path';

import { generateGamePageContent, GamePageContent } from '@/ai/flows/generate-game-page-content';
import { generatePolicyContent, PolicyContent } from '@/ai/flows/generate-policy-content';
import { marked } from 'marked';
import { generateSiteStructure, SiteStructure } from '@/ai/flows/generate-site-structure';
import { generateHtmlForSection } from '@/ai/flows/generate-html-for-section';
import { getIndexHtmlTemplate, getGamePageTemplate, getLegalPageTemplate, stylesCssTemplate } from '@/lib/templates';

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

// Допоміжна функція для рекурсивного читання файлів з папки гри
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

export async function generateSingleSite(prompt: string, siteName: string, websiteTypes: string[] = [], history: string[] = []): Promise<Site | null> {
  try {
    const isGameSite = websiteTypes.includes('Game');
    
    // --- Етап 1: Зчитування бібліотек (зображення та ігри) ---
    let imagePaths: string[] = [];
    try {
      const casinoImageDir = path.join(process.cwd(), 'public', 'images', 'img-casino');
      imagePaths = fs.readdirSync(casinoImageDir)
        .filter(file => /\.(jpg|jpeg|png|webp|gif)$/i.test(file))
        .map(file => `images/img-casino/${file}`); // Відносний шлях
      console.log(`Found ${imagePaths.length} images to use.`);
    } catch (error) { console.warn('Could not read casino images.'); }

    let gameFolders: string[] = [];
    const sourceGamesDir = path.join(process.cwd(), 'public', 'games');
    if (isGameSite) {
      try {
        gameFolders = fs.readdirSync(sourceGamesDir).filter(f => fs.statSync(path.join(sourceGamesDir, f)).isDirectory());
        console.log(`Found ${gameFolders.length} games:`, gameFolders);
      } catch (error) { console.warn('Could not read games directory.'); }
    }

    // --- Етап 2: Генерація контенту через AI ---
    console.log('Step 2.1: Getting site structure...');
    const structureResult: FlowResult<SiteStructure> = await generateSiteStructure({ prompt, websiteTypes });
    const structure = structureResult;
    if (!structure || !structure.sections || structure.sections.length === 0) {
      throw new Error('The AI architect failed to create a site plan.');
    }
    let totalInputTokens = structureResult.usage?.inputTokens ?? 0;
    let totalOutputTokens = structureResult.usage?.outputTokens ?? 0;
    
    const mainSections = structure.sections.filter(s => !['terms', 'privacy', 'responsible-gaming'].includes(s.type));
    const legalSections = structure.sections.filter(s => ['terms', 'privacy', 'responsible-gaming'].includes(s.type));

    console.log(`Step 2.2: Generating ${mainSections.length} main sections in parallel...`);
    const usedImagePaths = new Set<string>();
    const mainSectionPromises = mainSections.map(section => {
      let randomImageUrl: string | undefined = imagePaths.length > 0 ? imagePaths[Math.floor(Math.random() * imagePaths.length)] : undefined;
      if (randomImageUrl) usedImagePaths.add(randomImageUrl);
      return generateHtmlForSection({ section, theme: structure.theme, imageUrl: randomImageUrl });
    });
    const mainSectionResults = await Promise.all(mainSectionPromises);
    mainSectionResults.forEach(res => {
        if (res.usage?.inputTokens) totalInputTokens += res.usage.inputTokens;
        if (res.usage?.outputTokens) totalOutputTokens += res.usage.outputTokens;
    });
    const allSectionsHtml = mainSectionResults.map(result => result.htmlContent).join('\n\n');

    // --- Етап 3: Збірка фінального об'єкта `files` ---
    console.log('Step 3: Assembling final files object...');
    const title = structure.siteName || siteName;
    const domain = title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 50);
    
    const files: Record<string, Buffer | string> = { 'favicon.ico': '' };

    files['index.html'] = getIndexHtmlTemplate(title, structure.metaDescription, allSectionsHtml, websiteTypes);

    for (const legalSection of legalSections) {
        console.log(`Generating content for ${legalSection.type} page...`);
        const lang = (legalSection.type === 'privacy' && isGameSite) ? 'English' : 'Ukrainian';
        
        let contentHtml = '';
        if (legalSection.type === 'privacy') {
            const policyResult: FlowResult<PolicyContent> = await generatePolicyContent({ siteName: title, siteDescription: prompt, language: lang });
            if (policyResult.usage?.inputTokens) totalInputTokens += policyResult.usage.inputTokens;
            if (policyResult.usage?.outputTokens) totalOutputTokens += policyResult.usage.outputTokens;
            contentHtml = policyResult.sections.map(s => {
                const parsedContent = marked.parse(s.content);
                return `<section id="${s.id}"><h2 class="text-3xl font-bold text-white !mt-12 !mb-4">${s.title}</h2>${parsedContent}</section>`;
            }).join('\n');
        } else {
            const pageResult = await generateHtmlForSection({ section: legalSection, theme: structure.theme });
            if (pageResult.usage?.inputTokens) totalInputTokens += pageResult.usage.inputTokens;
            if (pageResult.usage?.outputTokens) totalOutputTokens += pageResult.usage.outputTokens;
            contentHtml = pageResult.htmlContent;
        }

        files[`${legalSection.type}.html`] = getLegalPageTemplate(title, structure.metaDescription, legalSection.title, contentHtml);
    }
    
    if (isGameSite && gameFolders.length > 0) {
      console.log('Step 3.1: Generating game page...');
      const randomGameFolder = gameFolders[Math.floor(Math.random() * gameFolders.length)];
      const gameIframePath = `games/${randomGameFolder}/game.html`;

      const gamePageContentResult: FlowResult<GamePageContent> = await generateGamePageContent({ siteName: title });
      if (gamePageContentResult.usage?.inputTokens) totalInputTokens += gamePageContentResult.usage.inputTokens;
      if (gamePageContentResult.usage?.outputTokens) totalOutputTokens += gamePageContentResult.usage.outputTokens;

      files['game.html'] = getGamePageTemplate(title, structure.metaDescription, gamePageContentResult.title, gameIframePath, gamePageContentResult.disclaimerHtml);

      const gameFilesDir = path.join(sourceGamesDir, randomGameFolder);
      const gameFiles = await getFilesRecursively(gameFilesDir);
      for (const [filePath, content] of Object.entries(gameFiles)) {
          files[`games/${randomGameFolder}/${filePath}`] = content;
      }
    }

    files['styles/style.css'] = stylesCssTemplate;
    
    console.log(`Adding ${usedImagePaths.size} used images to the files object...`);
    for (const webPath of usedImagePaths) {
      const localPath = path.join(process.cwd(), 'public', webPath);
      try {
        files[webPath] = fs.readFileSync(localPath);
      } catch (error) { console.warn(`Could not read image file at ${localPath}`); }
    }

    console.log('Generation successful!');
    const usage: TokenUsageSummary = {
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      totalTokens: totalInputTokens + totalOutputTokens,
      model: structureResult.model || mainSectionResults[0]?.model,
    };

    return { domain, files, history: [...history, prompt], types: websiteTypes, usage };

  } catch (error) {
    console.error(`Fatal generation error for prompt "${prompt}":`, error);
    return null;
  }
}