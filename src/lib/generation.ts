// File: src/lib/generation.ts
'use server';

import * as fs from 'fs';
import * as path from 'path';
import { generateGamePageContent, GamePageContent } from '@/ai/flows/generate-game-page-content';
import { generatePolicyContent, PolicyContent } from '@/ai/flows/generate-policy-content';
import { marked } from 'marked';
import { generateSiteStructure, SiteStructure } from '@/ai/flows/generate-site-structure';
import { generateHtmlForSection } from '@/ai/flows/generate-html-for-section';
import {
  getIndexHtmlTemplate,
  getGamePageTemplate,
  getPrivacyPolicyTemplate,
  mainJsTemplate,
  stylesCssTemplate,
  chooseBrandingTheme,
  inferBrandVisual,
} from '@/lib/templates';
import type { SectionNavItem } from '@/lib/templates';
import { deriveDomainName } from '@/lib/domain';
import manifest from '@/lib/asset-manifest.json';

function randomChoice<T>(items: T[], fallback?: T): T {
  if (!items || items.length === 0) {
    if (fallback !== undefined) return fallback;
    throw new Error('randomChoice called with empty array');
  }
  const index = Math.floor(Math.random() * items.length);
  return items[index] ?? (fallback !== undefined ? fallback : items[0]);
}

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

type SectionSpec = { type: string; titles: ((site: string) => string)[]; details?: ((site: string) => string)[] };

const englishSectionLibrary: SectionSpec[] = [
  {
    type: 'hero',
    titles: [
      (site) => `Discover ${site}`,
      (site) => `Experience ${site}`,
      (site) => `${site}: Crafted for Forward Thinkers`,
      (site) => `Step Into ${site}`,
    ],
    details: [
      () => 'A bold digital launchpad built with cinematic visuals and human-first storytelling.',
      () => 'An immersive hero spotlight that merges narrative copy with kinetic UI gestures.',
      () => 'Spark curiosity with a layered hero atmosphere and adaptive call-to-action states.',
    ],
  },
  {
    type: 'about',
    titles: [
      () => 'Our Origin Story',
      () => 'Who We Champion',
      () => 'The Journey So Far',
      () => 'Built by Explorers',
    ],
    details: [
      () => 'Paint a timeline narrative explaining mission, founding sparks, and guiding principles.',
      () => 'Highlight the people, culture, and beliefs that power the brand every day.',
    ],
  },
  {
    type: 'features',
    titles: [
      () => 'Signature Highlights',
      () => 'What Sets Us Apart',
      () => 'Core Experience Pillars',
      () => 'Reasons Teams Switch',
    ],
    details: [
      () => 'Curate three to five feature tiles with iconography, emotional benefit, and proof.',
      () => 'Blend performance metrics with story-driven copy for each differentiator.',
    ],
  },
  {
    type: 'stats',
    titles: [
      () => 'Momentum in Numbers',
      () => 'Impact Dashboard',
      () => 'Growth Signals',
      () => 'Quantified Wins',
    ],
    details: [
      () => 'Feature animated counters, sparkline charts, and celebratory microcopy.',
    ],
  },
  {
    type: 'parallax',
    titles: [
      () => 'Immersive Moments',
      () => 'Scenes from the Universe',
      () => 'Behind the Experience',
    ],
    details: [
      () => 'Use layered imagery, scroll-based reveals, and short captions to dramatize the brand.',
    ],
  },
  {
    type: 'faq',
    titles: [
      () => 'Questions People Ask',
      () => 'Answers on Demand',
      () => 'Help Center Highlights',
    ],
    details: [
      () => 'Draft conversational Q&A with supportive microcopy and direct action prompts.',
    ],
  },
  {
    type: 'responsible',
    titles: [
      () => 'Responsible Play Matters',
      () => 'Safe & Transparent',
      () => 'Ethics at the Core',
    ],
    details: [
      () => 'Outline policies, safeguards, and support resources with trust badges.',
    ],
  },
  {
    type: 'cta',
    titles: [
      () => 'Ready to Dive In?',
      () => 'Start Your Next Chapter',
      () => 'Launch the Experience',
    ],
    details: [
      () => 'Pair a bold CTA with social proof, guarantee, or onboarding teaser.',
    ],
  },
];

const polishSectionLibrary: SectionSpec[] = [
  {
    type: 'hero',
    titles: [
      (site) => `Poznaj ${site}`,
      (site) => `${site}: Twój nowy kierunek`,
      (site) => `Wejdź do świata ${site}`,
    ],
    details: [
      () => 'Hero o filmowej estetyce z mocnym hasłem i dynamiczną grafiką.',
      () => 'Wyeksponuj kluczową propozycję wartości oraz przycisk akcji.',
    ],
  },
  {
    type: 'about',
    titles: [
      () => 'Kim jesteśmy',
      () => 'Nasza historia',
      () => 'Zespół i wartości',
    ],
    details: [
      () => 'Przedstaw genezę, misję i unikalną kulturę marki.',
    ],
  },
  {
    type: 'features',
    titles: [
      () => 'Najważniejsze atuty',
      () => 'Co oferujemy',
      () => 'Powody, by nam zaufać',
    ],
    details: [
      () => 'Zbuduj sekcję kart z ikonami i benefitami opisanymi językiem korzyści.',
    ],
  },
  {
    type: 'stats',
    titles: [
      () => 'Kluczowe liczby',
      () => 'Wyniki i osiągnięcia',
      () => 'Nasze tempo wzrostu',
    ],
  },
  {
    type: 'parallax',
    titles: [
      () => 'Zajrzyj za kulisy',
      () => 'Galeria wrażeń',
    ],
  },
  {
    type: 'faq',
    titles: [
      () => 'Najczęstsze pytania',
      () => 'Masz wątpliwości?',
    ],
  },
  {
    type: 'responsible',
    titles: [
      () => 'Odpowiedzialna rozrywka',
      () => 'Bezpieczeństwo i wsparcie',
    ],
  },
  {
    type: 'cta',
    titles: [
      () => 'Dołącz teraz',
      () => 'Sprawdź demo',
      () => 'Rozpocznij dziś',
    ],
  },
];

const ukrainianSectionLibrary: SectionSpec[] = [
  {
    type: 'hero',
    titles: [
      (site) => `Відкрийте ${site}`,
      (site) => `${site}: новий вимір`,
      (site) => `Зануртесь у ${site}`,
    ],
  },
  {
    type: 'about',
    titles: [
      () => 'Про команду',
      () => 'Наша історія',
      () => 'Цінності та люди',
    ],
  },
  {
    type: 'features',
    titles: [
      () => 'Головні переваги',
      () => 'Чому ми інші',
      () => 'Особливості сервісу',
    ],
  },
  {
    type: 'stats',
    titles: [
      () => 'Цифри, що надихають',
      () => 'Ми зростаємо',
    ],
  },
  {
    type: 'parallax',
    titles: [
      () => 'Яскраві моменти',
      () => 'Живі кадри',
    ],
  },
  {
    type: 'faq',
    titles: [
      () => 'Поширені запитання',
      () => 'FAQ',
    ],
  },
  {
    type: 'responsible',
    titles: [
      () => 'Відповідальна гра',
      () => 'Безпека та довіра',
    ],
  },
  {
    type: 'cta',
    titles: [
      () => 'Спробуйте демо',
      () => 'Почніть зараз',
    ],
  },
];

function buildSectionTemplates(library: SectionSpec[], siteName: string) {
  return library.map((spec) => ({
    type: spec.type,
    title: randomChoice(spec.titles.map((fn) => fn(siteName))),
    details: spec.details ? randomChoice(spec.details.map((fn) => fn(siteName))) : undefined,
  }));
}

function getLocalizedSectionTemplates(language: string, siteName: string) {
  if (language === 'Polish') return buildSectionTemplates(polishSectionLibrary, siteName);
  if (language === 'Ukrainian') return buildSectionTemplates(ukrainianSectionLibrary, siteName);
  return buildSectionTemplates(englishSectionLibrary, siteName);
}

function shuffleArray<T>(items: T[]): T[] {
  const clone = [...items];
  for (let i = clone.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
}

function createStyleHintPool(themeMode: 'light' | 'dark', isGameSite: boolean): string[] {
  const shared = [
    'Layer rich parallax background images with subtle depth and add floating chips moving at different speeds',
    'Use organic gradients and animated radial glows behind the content blocks with CSS motion blur',
    'Compose a split layout with diagonal glass panels, soft drop shadows and animated SVG sparkles',
    'Overlay a faint grid of neon lines and animated particles drifting upward to simulate casino lights',
    'Apply blurred spotlight beams in the background and add rotating geometric accents on the corners',
  ];

  const darkOnly = [
    'Create a midnight neon atmosphere with deep purple gradients, glowing borders and animated dust',
    'Blend a cosmic starfield with slow-moving light streaks and reflective card surfaces',
    'Add glossy glassmorphism cards hovering above a smoky background with shimmering edges',
  ];

  const lightOnly = [
    'Use soft peach-to-gold gradients with translucent frosted panels and gentle shadow play',
    'Incorporate watercolor textures with bright highlights and floating translucent bubbles',
    'Design a sunlit lounge vibe with warm gradients, subtle noise textures and animated confetti lines',
  ];

  const gameExtras = [
    'Center a rotating 3D slot wheel silhouette with glowing reels in the background and layered chips',
    'Feature animated jackpot burst lines behind CTA buttons with shimmering coin trails',
    'Stack cascading card suits using CSS masks and animate them with slow parallax on scroll',
  ];

  const pool = [
    ...shared,
    ...(themeMode === 'dark' ? darkOnly : lightOnly),
    ...(isGameSite ? gameExtras : []),
  ];

  if (!pool.length) {
    return ['Use layered gradients, floating particles, and parallax imagery to keep the section dynamic.'];
  }
  return shuffleArray(Array.from(new Set(pool)));
}

function sanitizeSectionHtml(html: string): string {
  if (!html) return '';
  let clean = html;
  const patterns = [
    /<\s*(header|nav|footer)[^>]*>[\s\S]*?<\/\s*\1>/gi,
    /<\s*style[^>]*>[\s\S]*?<\/\s*style>/gi,
    /<\s*script[^>]*>[\s\S]*?<\/\s*script>/gi,
    /<!--[\s\S]*?-->/g,
  ];
  for (const pattern of patterns) {
    clean = clean.replace(pattern, '');
  }
  return clean.trim();
}

function sanitizeIdCandidate(value: string): string {
  return (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

function stripNavLikeBlocks(html: string): string {
  if (!html) return '';
  let cleaned = html;
  const regex = /<(div|section)[^>]*class="[^"]*(?:nav|navbar|menu|header)[^"]*"[^>]*>[\s\S]*?<\/\1>/gi;
  cleaned = cleaned.replace(regex, '');
  return cleaned;
}

type NavRule = { key: string; label: string; pattern: RegExp };

const NAV_RULES: NavRule[] = [
  { key: 'about', label: 'About', pattern: /(about|story|mission|who|team|values)/i },
  { key: 'features', label: 'Features', pattern: /(feature|benefit|highlight|advantage|why)/i },
  { key: 'games', label: 'Games', pattern: /(game|collection|gallery|experience)/i },
  { key: 'pricing', label: 'Pricing', pattern: /(pricing|plan|package|subscription)/i },
  { key: 'faq', label: 'FAQ', pattern: /(faq|question|help)/i },
  { key: 'contact', label: 'Contact', pattern: /(contact|support|reach|connect|get in touch|message)/i },
];

function resolveNavAnchor(section: { type?: string; title?: string }): { key: string; label: string; order: number } | null {
  const typeToken = (section.type || '').toLowerCase();
  const title = (section.title || '').trim();
  const haystack = `${typeToken} ${title.toLowerCase()}`.trim();
  for (let idx = 0; idx < NAV_RULES.length; idx++) {
    const rule = NAV_RULES[idx];
    if (rule.pattern.test(haystack)) {
      return { key: rule.key, label: rule.label, order: idx };
    }
  }
  return null;
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
  favicons?: string[];
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
    const brandTheme = chooseBrandingTheme({ websiteTypes });
    const brandVisual = inferBrandVisual(websiteTypes, prompt);
    const styleHints = createStyleHintPool(brandTheme.mode, isGameSite);

    // --- Step 1: Read Libraries (Images and Games) via manifest ---
    const imagePaths = Array.isArray(assets.images) ? assets.images : [];
    const manifestGames = Array.isArray(assets.games) ? assets.games : [];
    const faviconPaths = Array.isArray(assets.favicons)
      ? assets.favicons.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      : [];
    let selectedFaviconPath: string | undefined;
    let selectedFaviconBuffer: Buffer | undefined;
    if (faviconPaths.length > 0) {
      const candidateIndex = Math.floor(Math.random() * faviconPaths.length);
      const candidateFavicon = faviconPaths[candidateIndex];
      const faviconDiskPath = path.join(publicDir, candidateFavicon);
      try {
        const buffer = await fs.promises.readFile(faviconDiskPath);
        selectedFaviconPath = candidateFavicon.split(path.sep).join('/');
        selectedFaviconBuffer = buffer;
      } catch (error) {
        console.warn(`Could not read favicon file at ${faviconDiskPath}`, error);
      }
    }
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
    const ctaTarget = isGameSite ? 'game.html' : undefined;
    const sectionIdSet = new Set<string>();
    const navAnchors: SectionNavItem[] = [];
    const navKeysSeen = new Set<string>();

    for (let i = 0; i < mainSections.length; i += CHUNK_SIZE) {
      const slice = mainSections.slice(i, i + CHUNK_SIZE);
      const generated = await Promise.all(slice.map(async (section, index) => {
        const styleHint = styleHints.length ? styleHints[(i + index) % styleHints.length] : undefined;
        let randomImageUrl: string | undefined = imagePaths.length > 0 ? imagePaths[Math.floor(Math.random() * imagePaths.length)] : undefined;
        if (randomImageUrl) {
          usedImagePaths.add(randomImageUrl);
        }
        const res = await generateHtmlForSection({
          section,
          theme: themeToUse,
          imageUrl: randomImageUrl,
          language: languageName,
          styleHint,
          themeMode: brandTheme.mode,
          ctaTarget,
        });
        if (res.usage?.inputTokens) totalInputTokens += res.usage.inputTokens;
        if (res.usage?.outputTokens) totalOutputTokens += res.usage.outputTokens;
        let cleanHtml = sanitizeSectionHtml(res.htmlContent || '');
        if (!cleanHtml) {
          return { html: '', model: res.model };
        }
        if ((section.type || '').toLowerCase() === 'hero') {
          cleanHtml = stripNavLikeBlocks(cleanHtml);
        }
        const baseCandidate = sanitizeIdCandidate(section.type || section.title || `section-${i + index + 1}`) || `section-${i + index + 1}`;
        let candidate = baseCandidate;
        let attempt = 1;
        while (sectionIdSet.has(candidate)) {
          candidate = `${baseCandidate}-${++attempt}`;
        }
        sectionIdSet.add(candidate);

        if (/^<section\b/i.test(cleanHtml)) {
          cleanHtml = cleanHtml.replace(/^<section\b([^>]*)>/i, (match, attrs) => {
            let updated = attrs || '';
            if (/id\s*=/.test(updated)) {
              updated = updated.replace(/id\s*=\s*"[^"]*"/i, ` id="${candidate}"`);
            } else {
              updated += ` id="${candidate}"`;
            }
            if (section.type && !/data-section-type=/.test(updated)) {
              updated += ` data-section-type="${section.type}"`;
            }
            if (/class\s*=/.test(updated)) {
              updated = updated.replace(/class\s*=\s*"([^"]*)"/i, (full, classes) => {
                const appended = classes.split(/\s+/).filter(Boolean);
                if (!appended.includes('generated-section')) appended.push('generated-section');
                return ` class="${appended.join(' ')}"`;
              });
            } else {
              updated += ' class="generated-section"';
            }
            return `<section${updated}>`;
          });
        } else {
          const sectionTypeAttr = section.type ? ` data-section-type="${section.type}"` : '';
          cleanHtml = `<section id="${candidate}"${sectionTypeAttr} class="generated-section">${cleanHtml}</section>`;
        }

        const sectionLower = cleanHtml.toLowerCase();
        if (sectionLower.includes('cookie') && (sectionLower.includes('accept') || sectionLower.includes('consent'))) {
          return { html: '', model: res.model };
        }

        const navInfo = resolveNavAnchor(section);
        if (navInfo && !navKeysSeen.has(navInfo.key)) {
          navKeysSeen.add(navInfo.key);
          navAnchors.push({ id: candidate, label: navInfo.label, type: navInfo.key, order: navInfo.order });
        } else if (!navInfo) {
          const fallbackLabelSource = (section.title || section.type || 'Section').trim();
          const words = fallbackLabelSource.split(/\s+/).filter(Boolean);
          const fallbackLabel = words
            .slice(0, Math.min(words.length, 2))
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ') || 'Section';
          const fallbackKey = `section-${candidate}`;
          if (!navKeysSeen.has(fallbackKey)) {
            navKeysSeen.add(fallbackKey);
            navAnchors.push({ id: candidate, label: fallbackLabel, type: fallbackKey, order: NAV_RULES.length + navAnchors.length });
          }
        }

        return { html: cleanHtml, model: res.model };
      }));
      sectionResults.push(...generated);
    }

    const allSectionsHtml = sectionResults.map(result => result.html).join('\n\n');
    const sortedNavAnchors = navAnchors
      .sort((a, b) => {
        const orderA = a.order ?? (NAV_RULES.length + 100);
        const orderB = b.order ?? (NAV_RULES.length + 100);
        return orderA - orderB;
      })
      .slice(0, 4);

    const policyLanguage = languageName;
    console.log(`Step 2.3: Generating unique privacy policy in ${policyLanguage}...`);
    const policyResult: FlowResult<PolicyContent> = await generatePolicyContent({ siteName, siteDescription: prompt, language: policyLanguage });
    if (policyResult.usage?.inputTokens) totalInputTokens += policyResult.usage.inputTokens;
    if (policyResult.usage?.outputTokens) totalOutputTokens += policyResult.usage.outputTokens;
    const policyHeadingClass = brandTheme.mode === 'light'
      ? 'text-3xl font-bold text-slate-900 !mt-12 !mb-4'
      : 'text-3xl font-bold text-white !mt-12 !mb-4';
    const policyContentHtml = policyResult.sections.map(section => {
      const contentHtml = marked.parse(section.content);
      return `<section><h2 id="${section.id}" class="${policyHeadingClass}">${section.title}</h2>${contentHtml}</section>`;
    }).join('\n\n');

    // --- Step 3: Assemble Final Files Object ---
    console.log('Step 3: Assembling final files object...');
    const trimmedSiteName = siteName?.trim();
    const title = trimmedSiteName && trimmedSiteName.length > 1 ? trimmedSiteName : 'My Website';
    const normalizedDomain = deriveDomainName({ domain: siteName, types: websiteTypes }, siteName, title);
    
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

      files['game.html'] = getGamePageTemplate(
        title,
        gamePageContentResult.title,
        gameIframePath,
        gamePageContentResult.disclaimerHtml,
        sortedNavAnchors,
        brandTheme,
        brandVisual,
        websiteTypes,
        selectedFaviconPath
      );

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
    files['index.html'] = getIndexHtmlTemplate(title, allSectionsHtml, websiteTypes, sortedNavAnchors, brandTheme, brandVisual, selectedFaviconPath);
    files['privacy-policy.html'] = getPrivacyPolicyTemplate(title, normalizedDomain, policyContentHtml, sortedNavAnchors, brandTheme, brandVisual, websiteTypes, selectedFaviconPath);
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

    if (selectedFaviconPath && selectedFaviconBuffer) {
      files[selectedFaviconPath] = selectedFaviconBuffer;
    }

    const elapsedMs = Date.now() - startedAt;
    console.log(`Generation successful! Main sections: ${mainSections.length}, legal sections: ${legalSections.length}, elapsed ${Math.round(elapsedMs / 100) / 10}s`);
    const usage: TokenUsageSummary = {
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      totalTokens: totalInputTokens + totalOutputTokens,
      model: structureResult.model || sectionResults[0]?.model,
    };

    return { domain: normalizedDomain, files, history: [...history, prompt], types: websiteTypes, usage };

  } catch (error) {
    console.error(`Fatal generation error for prompt "${prompt}":`, error);
    return null;
  }
}
