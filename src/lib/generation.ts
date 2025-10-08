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

const IMAGE_FILE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.avif']);

const SECTION_ACCENTS = [
  'section-accent-aurora',
  'section-accent-wave',
  'section-accent-grid',
  'section-accent-noise',
  'section-accent-lens',
];

type SectionShape = 'flat' | 'soft' | 'sleek' | 'angular';

const SECTION_SHAPES: SectionShape[] = ['flat', 'soft', 'sleek', 'angular'];

const SECTION_SHAPE_CLASS_MAP: Record<SectionShape, string> = {
  flat: 'shape-flat',
  soft: 'shape-soft',
  sleek: 'shape-sleek',
  angular: 'shape-angular',
};

const SECTION_SHAPE_HINTS: Array<{ pattern: RegExp; shapes: SectionShape[] }> = [
  { pattern: /(hero|headline|banner|welcome|intro|experience)/i, shapes: ['sleek', 'soft'] },
  { pattern: /(cta|call-to-action|join|signup|ready)/i, shapes: ['sleek', 'angular'] },
  { pattern: /(stats|metrics|dashboard|timeline|pricing|table|faq|roadmap)/i, shapes: ['angular', 'sleek'] },
  { pattern: /(features|cards|gallery|about|story|benefit)/i, shapes: ['soft', 'sleek', 'flat'] },
  { pattern: /(contact|support|legal|policy|terms)/i, shapes: ['flat', 'angular'] },
];

const resolveExistingPath = (...segments: string[]): string => {
  const attempts: string[] = [];

  const cwd = process.cwd();
  attempts.push(path.join(cwd, ...segments));
  attempts.push(path.join(cwd, '..', ...segments));
  attempts.push(path.join(cwd, '..', '..', ...segments));
  attempts.push(path.join(cwd, '.next', 'standalone', ...segments));

  for (const candidate of attempts) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return attempts[0];
};

async function listImageFiles(relativeDir: string): Promise<string[]> {
  const baseDir = resolveExistingPath('public', relativeDir);
  try {
    const entries = await fs.promises.readdir(baseDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && IMAGE_FILE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
      .map((entry) => `${relativeDir}/${entry.name}`);
  } catch {
    return [];
  }
}

async function pickImageAsset(relativeDir: string): Promise<{ webPath: string; buffer: Buffer } | null> {
  const files = await listImageFiles(relativeDir);
  if (!files.length) return null;
  const webPath = files[Math.floor(Math.random() * files.length)];
  const absolute = resolveExistingPath('public', webPath);
  try {
    const buffer = await fs.promises.readFile(absolute);
    return { webPath, buffer };
  } catch {
    return null;
  }
}

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

function shouldInjectDisclaimer(prompt: string): boolean {
  if (!prompt) return false;
  const normalized = prompt.toLowerCase();
  return /18\s*\+|дискл|ответственн|відповідальн|responsible|disclaimer|responsyw|bezpieczeństw/.test(normalized);
}

function isDisclaimerSection(section: { type?: string; title?: string; details?: string }): boolean {
  const type = (section.type || '').toLowerCase();
  if (type.includes('disclaimer') || type.includes('responsible') || type.includes('compliance')) {
    return true;
  }
  const haystack = `${section.title || ''} ${section.details || ''}`.toLowerCase();
  return /18\s*\+|disclaimer|responsible|безопас|відповідальн|ostrzeż|uwaga/.test(haystack);
}

function createDisclaimerSection(language: string): { type: string; title: string; details: string } {
  switch (language) {
    case 'Polish':
      return {
        type: 'disclaimer',
        title: 'Informacja o Bezpiecznej Grze 18+',
        details: 'Dodaj wyraźną odznakę 18+ przed tekstem i podkreśl, że to darmowa, społecznościowa zabawa bez prawdziwych pieniędzy.',
      };
    case 'Ukrainian':
      return {
        type: 'disclaimer',
        title: 'Відповідальна гра 18+',
        details: 'Розмісти помітний бейдж 18+ перед повідомленням і наголоси, що це соціальний демо-досвід без реальних ставок.',
      };
    default:
      return {
        type: 'disclaimer',
        title: 'Responsible Play Notice 18+',
        details: 'Place a prominent 18+ badge ahead of the copy and stress that this is a social demo with zero real-money wagering.',
      };
  }
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
  const minimalShared = [
    'Keep the background clean and neutral (#f4f6ff or rgba(15,23,42,0.85) depending on theme) with a single 1px border and soft outer shadow',
    'Use balanced two-column layouts with generous padding, even grid spacing, and accent badges limited to indigo/sky shades from the palette',
    'Highlight sections with a delicate 1px top border or slim divider instead of gradients; reserve bold colour for CTAs and icons only',
    'Integrate a low-opacity 12px grid or dotted overlay (5–8% opacity) to add depth without introducing new colours',
    'Add very soft corner light spots (blur radius 120px) in the accent colour while keeping the main surface neutral and readable',
  ];

  const darkOnly = [
    'Rely on deep navy surfaces (#0b1224) with soft glass cards (backdrop-blur, 1px borders) and electric blue highlights',
    'Stack muted charcoal panels separated by thin cyan dividers and keep typography bright white for contrast',
    'Add oversized playing-card suits as 4–6% opacity watermarks in the corner, avoiding neon glows or heavy gradients',
  ];

  const lightOnly = [
    'Adopt a crisp white or very light slate background with floating cards, subtle 1px borders, and a single electric-blue accent colour',
    'Introduce a faint diagonal highlight (under 6% opacity) using the primary colour, then keep all text dark slate for legibility',
    'Use light grey panel dividers, tight typography rhythm, and reserve accent colour exclusively for CTA buttons and icon badges',
  ];

  const gameExtras = [
    'Add a subtle halo glow behind hero imagery using the brand accent colour while keeping the surface minimal',
    'Use icon badges shaped like chips or dice with soft shadows and avoid additional neon backgrounds',
    'Integrate a horizontal timeline or stat row with evenly spaced cards, each using a single accent stroke',
    'Apply gentle parallax on feature cards with transform hover states, but keep background neutral and text crisp',
  ];

  const pool = [
    ...minimalShared,
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
  clean = clean.replace(/\sstyle="[^"]*"/gi, '');
  const disallowedPrefixes = ['bg-gradient', 'from-', 'via-', 'to-', 'mix-blend-', 'shadow-inner', 'shadow-[', 'drop-shadow'];
  const disallowedContains = ['opacity-', 'text-transparent'];
  clean = clean.replace(/class="([^"]*)"/gi, (match, classValue) => {
    const tokens = classValue
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean);
    const filtered = tokens.filter((token) => {
      const lower = token.toLowerCase();
      if (lower.startsWith('btn-')) return true;
      if (disallowedPrefixes.some((prefix) => lower.startsWith(prefix))) return false;
      if (disallowedContains.some((snippet) => lower.includes(snippet))) return false;
      return true;
    });
    if (!filtered.length) {
      return '';
    }
    return `class="${filtered.join(' ')}"`;
  });
  clean = clean.replace(/class="([^"]*btn-(?:primary|secondary)[^"]*)"/gi, (_, classValue) => {
    const parts = classValue
      .split(/\s+/)
      .filter(Boolean)
      .filter((token: string) => {
        const lower = token.toLowerCase();
        if (lower === 'btn-primary' || lower === 'btn-secondary') return true;
        if (lower.startsWith('btn-')) return true;
        if (lower.startsWith('bg-') || lower.startsWith('from-') || lower.startsWith('to-') || lower.startsWith('via-') || lower.startsWith('shadow-')) return false;
        if (lower.startsWith('rounded')) return false;
        return true;
      });
    if (classValue.includes('btn-primary') && !parts.includes('btn-primary')) parts.push('btn-primary');
    if (classValue.includes('btn-secondary') && !parts.includes('btn-secondary')) parts.push('btn-secondary');
    const unique = Array.from(new Set(parts));
    return `class="${unique.join(' ')}"`;
  });
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

const createLocalizedHeroSection = (language: string, siteName: string) => {
  switch (language) {
    case 'Polish':
      return {
        type: 'hero',
        title: `Witamy w ${siteName}`,
        details: 'Stwórz przyjazny bohater sekcji z krótkim opisem społecznościowego kasyna i darmowymi turniejami.',
      };
    case 'Ukrainian':
      return {
        type: 'hero',
        title: `Ласкаво просимо до ${siteName}`,
        details: 'Опиши соціальне казино, безкоштовні турніри й щоденні бонуси, зосередь акцент на розвазі без ризику.',
      };
    default:
      return {
        type: 'hero',
        title: `Welcome to ${siteName}`,
        details: 'Craft a welcoming hero section that spotlights the social casino vibe, free tournaments, and nightly rewards.',
      };
  }
};

function createFallbackStructure(siteName: string, language: string, prompt: string): FlowResult<SiteStructure> {
  const library = getLocalizedSectionTemplates(language, siteName);
  const uniqueByType = new Map<string, { type: string; title: string; details?: string }>();
  library.forEach((section) => {
    const key = (section.type || '').toLowerCase();
    if (!uniqueByType.has(key)) {
      uniqueByType.set(key, section);
    }
  });
  let sections = Array.from(uniqueByType.values());
  if (!sections.length) {
    sections = [
      createLocalizedHeroSection(language, siteName),
      {
        type: 'features',
        title: language === 'Polish'
          ? `Dlaczego gracze wybierają ${siteName}`
          : language === 'Ukrainian'
            ? `Чому обирають ${siteName}`
            : `Why Players Choose ${siteName}`,
        details: language === 'Polish'
          ? 'Wypunktuj 3 atuty: codzienna pula monet, wydarzenia społecznościowe i brak prawdziwych stawek.'
          : language === 'Ukrainian'
            ? 'Підкресли 3 переваги: щоденні бонуси, спільнотні івенти та відсутність ставок.'
            : 'Highlight three perks: daily bonus drops, community challenges, and zero real-money wagering.',
      },
      {
        type: 'cta',
        title: language === 'Polish'
          ? 'Gotowy do gry?'
          : language === 'Ukrainian'
            ? 'Готові розпочати?'
            : 'Ready to Play?',
        details: language === 'Polish'
          ? 'Zaproś użytkownika do darmowej rejestracji i eksploracji lobby gier.'
          : language === 'Ukrainian'
            ? 'Запроси користувача створити безкоштовний акаунт і перейти до ігор.'
            : 'Invite visitors to create a free profile and explore the featured games lobby.',
      },
    ];
  }

  const heroIndex = sections.findIndex((section) => (section.type || '').toLowerCase() === 'hero');
  if (heroIndex === -1) {
    sections.unshift(createLocalizedHeroSection(language, siteName));
  } else if (heroIndex > 0) {
    const [heroSection] = sections.splice(heroIndex, 1);
    sections.unshift(heroSection);
  }

  const explicitCount = extractRequestedSectionCount(prompt);
  const targetCount = explicitCount != null
    ? Math.max(1, Math.min(explicitCount, 8))
    : Math.min(4, Math.max(3, sections.length));

  if (sections.length < targetCount) {
    const pool = library.length ? library : sections;
    let cursor = 0;
    while (sections.length < targetCount && pool.length) {
      const candidate = pool[cursor % pool.length];
      const key = (candidate.type || '').toLowerCase();
      const exists = sections.some((section) => (section.type || '').toLowerCase() === key);
      if (!exists || candidate.type === 'cta') {
        sections.push({
          type: candidate.type,
          title: candidate.title,
          details: candidate.details,
        });
      }
      cursor += 1;
      if (cursor > pool.length * 2) break;
    }
  }

  if (sections.length > targetCount) {
    sections = sections.slice(0, targetCount);
  }

  return {
    theme: { primaryColor: 'indigo-500', font: 'Inter' },
    sections,
    usage: { inputTokens: 0, outputTokens: 0 },
    model: 'fallback-template',
  };
}

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

function detectPreferredThemeMode(prompt: string): 'light' | 'dark' | undefined {
  const text = (prompt || '').toLowerCase();
  const lightHints = [
    'light theme', 'light mode', 'bright', 'clean white', 'pastel', 'minimal light',
    'sunny', 'airy', 'fresh', 'soft colors', 'white background', 'daylight',
    'white theme', 'white layout',
    'светлая тема', 'светлый стиль', 'светлый фон', 'светлая цветовая схема', 'белая тема', 'белый фон',
    'білий фон', 'світла тема', 'світлий стиль'
  ];
  const darkHints = [
    'dark theme', 'dark mode', 'midnight', 'neon', 'cyberpunk', 'night',
    'moody', 'black background', 'deep dark', 'futuristic dark',
    'тёмная тема', 'темный стиль', 'темный фон', 'темная цветовая схема',
    'темна тема', 'темний стиль'
  ];
  if (lightHints.some((token) => text.includes(token))) return 'light';
  if (darkHints.some((token) => text.includes(token))) return 'dark';
  const lightRegexes = [
    /\bсве[тд]?\w*\s+(?:тема|стиль|фон|палитр|схема|цвет)/,
    /\blig?ht\s+(?:theme|mode|palette|scheme)\b/,
  ];
  if (lightRegexes.some((rx) => rx.test(text))) return 'light';
  const darkRegexes = [
    /\bтемн\w*\s+(?:тема|стиль|фон|палитр|схема|цвет)/,
  ];
  if (darkRegexes.some((rx) => rx.test(text))) return 'dark';
  return undefined;
}

function detectSectionShape(prompt: string, preferredMode?: 'light' | 'dark'): SectionShape {
  const text = (prompt || '').toLowerCase();
  if (/\b(flat|minimalist|clean|corporate|business|grid|modern minimal)\b/.test(text)) {
    return 'flat';
  }
  if (/\b(brutalist|angular|square|sharp|edgy|techno|rectangular)\b/.test(text)) {
    return 'angular';
  }
  if (/\b(rounded|pill|soft edges|soft|organic|flowing|curved|fluid)\b/.test(text)) {
    return 'soft';
  }
  if (/\b(sleek|elegant|premium|lux|luxury|neon|futuristic|hi-tech)\b/.test(text)) {
    return 'sleek';
  }
  if (preferredMode === 'dark') {
    return Math.random() < 0.6 ? 'sleek' : 'flat';
  }
  if (preferredMode === 'light') {
    return Math.random() < 0.65 ? 'flat' : 'soft';
  }
  return 'flat';
}

function pickSectionShape(section: { type?: string; title?: string }, baseShape: SectionShape, index: number): SectionShape {
  const text = `${section.type || ''} ${section.title || ''}`.toLowerCase();
  const candidates = new Set<SectionShape>([baseShape]);

  SECTION_SHAPE_HINTS.forEach((hint) => {
    if (hint.pattern.test(text)) {
      hint.shapes.forEach((shape) => candidates.add(shape));
    }
  });

  // Always allow flat as a safe fallback.
  candidates.add('flat');

  let alternatives = Array.from(candidates).filter((shape) => shape !== baseShape);
  if (!alternatives.length) {
    if (baseShape === 'flat') {
      alternatives = ['sleek', 'soft'];
    } else {
      alternatives = ['flat'];
    }
  }

  const heroOrCta = /(hero|cta|call-to-action|banner|ready|join|signup)/.test(text);
  const structural = /(stats|metrics|timeline|roadmap|pricing|table|faq|grid)/.test(text);
  const varietyChance = heroOrCta ? 0.55 : structural ? 0.45 : 0.3;
  const indexBias = ((index + 1) % 4 === 0);

  if (alternatives.length && (indexBias || Math.random() < varietyChance)) {
    return alternatives[Math.floor(Math.random() * alternatives.length)];
  }

  if (baseShape !== 'flat' && Math.random() < 0.2) {
    return 'flat';
  }

  return baseShape;
}

function parseLayoutPreferences(prompt: string): { includeHeader: boolean; includeFooter: boolean } {
  const text = (prompt || '').toLowerCase();
  const headerOff = [
    'no header', 'without header', 'remove header', 'без хедера', 'без шапки',
    'без header', 'без навигации', 'без навигації'
  ];
  const footerOff = [
    'no footer', 'without footer', 'remove footer', 'без футера', 'без подвала',
    'без footer'
  ];
  const includeHeader = !headerOff.some((token) => text.includes(token));
  const includeFooter = !footerOff.some((token) => text.includes(token));
  return { includeHeader, includeFooter };
}

export async function generateSingleSite(prompt: string, siteName: string, websiteTypes: string[] = [], history: string[] = []): Promise<Site | null> {
  try {
    const startedAt = Date.now();
    const isGameSite = websiteTypes.some((type) => type.toLowerCase().includes('game'));
    const isSportSite = websiteTypes.some((type) => type.toLowerCase().includes('sport'));
    const publicDir = resolveExistingPath('public');
    const sourceGamesDir = resolveExistingPath('public', 'games');
    const { name: languageName } = resolveLanguage(prompt, websiteTypes);
    const preferredMode = detectPreferredThemeMode(prompt);
    let baseSectionShape = detectSectionShape(prompt, preferredMode);
    if (isGameSite) {
      baseSectionShape = 'angular';
    }
    const layoutPrefs = parseLayoutPreferences(prompt);
    const brandTheme = chooseBrandingTheme({ websiteTypes, preferredMode });
    const brandVisual = inferBrandVisual(websiteTypes, prompt);
    const styleHints = createStyleHintPool(brandTheme.mode, isGameSite);
    const selectedLogoAsset = await pickImageAsset(isSportSite ? 'images/logo-bar' : 'images/logo-casino');

    // --- Step 1: Read Libraries (Images and Games) via manifest ---
    let imagePaths = Array.isArray(assets.images) ? assets.images : [];
    if (isSportSite) {
      const barImages = await listImageFiles('images/img-bar');
      if (barImages.length) {
        imagePaths = barImages;
      }
    } else {
      const casinoImages = imagePaths.filter((value) => value.includes('img-casino'));
      if (casinoImages.length) {
        imagePaths = casinoImages;
      } else {
        const fallbackCasino = await listImageFiles('images/img-casino');
        if (fallbackCasino.length) {
          imagePaths = fallbackCasino;
        }
      }
    }
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
    let structureResult: FlowResult<SiteStructure>;
    try {
      structureResult = await generateSiteStructure({ prompt, language: languageName });
    } catch (error) {
      console.error('generateSiteStructure failed, using deterministic fallback plan.', error);
      structureResult = createFallbackStructure(siteName, languageName, prompt);
    }
    const structure = structureResult;
    if (!structure || !structure.sections || structure.sections.length === 0) {
      console.warn('Site structure empty after fallback; injecting minimal template.');
      structure.sections = createFallbackStructure(siteName, languageName, prompt).sections;
    }
    let sectionPlan = Array.isArray(structure.sections) ? [...structure.sections] : [];
    const desiredSections = getLocalizedSectionTemplates(languageName, siteName);
    const explicitSectionCount = extractRequestedSectionCount(prompt);
    const wantsDisclaimerSection = shouldInjectDisclaimer(prompt);

    if (wantsDisclaimerSection && !sectionPlan.some(isDisclaimerSection)) {
      sectionPlan.push(createDisclaimerSection(languageName));
    }

    if (explicitSectionCount != null) {
      if (sectionPlan.length > explicitSectionCount) {
        const trimmed = sectionPlan.slice(0, explicitSectionCount);
        if (wantsDisclaimerSection && !trimmed.some(isDisclaimerSection)) {
          const injected = sectionPlan.find(isDisclaimerSection);
          if (injected) {
            if (trimmed.length === 0) {
              trimmed.push(injected);
            } else {
              trimmed[trimmed.length - 1] = injected;
            }
          }
        }
        sectionPlan = trimmed;
      }
      if (sectionPlan.length < explicitSectionCount) {
        const normalized = new Set(sectionPlan.map(s => (s.type || '').toLowerCase()));
        for (const tpl of desiredSections) {
          if (sectionPlan.length >= explicitSectionCount) break;
          if (!normalized.has(tpl.type.toLowerCase())) {
            sectionPlan.push({ type: tpl.type, title: tpl.title, details: tpl.details });
            normalized.add(tpl.type.toLowerCase());
          }
        }
      }
    } else {
      const normalized = new Set(sectionPlan.map(s => (s.type || '').toLowerCase()));
      const limit = 8;
      for (const section of desiredSections) {
        if (sectionPlan.length >= limit) break;
        if (!normalized.has(section.type.toLowerCase())) {
          sectionPlan.push({ type: section.type, title: section.title, details: section.details });
          normalized.add(section.type.toLowerCase());
        }
      }
    }
    structure.sections = sectionPlan;

    const allowLegalInjection = explicitSectionCount == null;

    if (allowLegalInjection && !sectionPlan.some((s) => (s.type || '').toLowerCase() === 'terms')) {
      sectionPlan.push({
        type: 'terms',
        title: 'Terms & Conditions',
        details: 'Summarise eligibility (18+), non-monetary nature of the platform, and respectful play guidelines.',
      });
    }
    if (allowLegalInjection && !sectionPlan.some((s) => (s.type || '').toLowerCase() === 'privacy')) {
      sectionPlan.push({
        type: 'privacy',
        title: 'Privacy Snapshot',
        details: 'Highlight data handling basics, cookie usage, and a link to the full privacy policy.',
      });
    }
    structure.sections = sectionPlan;

    const mainSections = sectionPlan.filter(s => !['terms', 'privacy', 'responsible-gaming'].includes((s.type || '').toLowerCase()));
    const legalSections = sectionPlan.filter(s => ['terms', 'privacy', 'responsible-gaming'].includes((s.type || '').toLowerCase()));
    const hasTermsSection = sectionPlan.some((s) => (s.type || '').toLowerCase().includes('terms'));
    const hasPrivacySection = sectionPlan.some((s) => (s.type || '').toLowerCase().includes('privacy'));
    const showLegalNavFallback = allowLegalInjection && legalSections.length > 0;
    const legalLinks: Array<{ label: string; href: string }> = [];
    if (hasTermsSection) {
      legalLinks.push({ label: 'Terms & Conditions', href: 'index.html#terms' });
    }
    legalLinks.push({ label: 'Privacy Policy', href: 'privacy-policy.html' });

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
    let accentCursor = 0;

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
          sitePrompt: prompt,
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

        const accentClass = SECTION_ACCENTS[accentCursor % SECTION_ACCENTS.length];
        accentCursor += 1;
        const shapeChoice = pickSectionShape(section, baseSectionShape, i + index);
        const shapeClass = SECTION_SHAPE_CLASS_MAP[shapeChoice] ?? SECTION_SHAPE_CLASS_MAP.flat;

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
            if (!/data-section-accent=/.test(updated)) {
              updated += ` data-section-accent="${accentClass}"`;
            }
            if (!/data-section-shape=/.test(updated)) {
              updated += ` data-section-shape="${shapeChoice}"`;
            }
            if (/class\s*=/.test(updated)) {
              updated = updated.replace(/class\s*=\s*"([^"]*)"/i, (full: string, classes: string) => {
                const appended = classes.split(/\s+/).filter(Boolean);
                const filtered = appended.filter((cls: string) => cls && !cls.startsWith('shape-'));
                if (!filtered.includes('generated-section')) filtered.push('generated-section');
                if (!filtered.includes(accentClass)) filtered.push(accentClass);
                if (!filtered.includes(shapeClass)) filtered.push(shapeClass);
                return ` class="${filtered.join(' ')}"`;
              });
            } else {
              updated += ` class="generated-section ${accentClass} ${shapeClass}"`;
            }
            if (/data-section-shape=/.test(updated) && !new RegExp(shapeChoice).test(updated)) {
              updated = updated.replace(/data-section-shape="[^"]*"/i, ` data-section-shape="${shapeChoice}"`);
            }
            return `<section${updated}>`;
          });
        } else {
          const sectionTypeAttr = section.type ? ` data-section-type="${section.type}"` : '';
          cleanHtml = `<section id="${candidate}"${sectionTypeAttr} data-section-accent="${accentClass}" data-section-shape="${shapeChoice}" class="generated-section ${accentClass} ${shapeClass}">${cleanHtml}</section>`;
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

    const sortedNavAnchors = navAnchors
      .sort((a, b) => {
        const orderA = a.order ?? (NAV_RULES.length + 100);
        const orderB = b.order ?? (NAV_RULES.length + 100);
        return orderA - orderB;
      });

    const hasTermsAnchor = sortedNavAnchors.some((anchor) => /terms/.test(anchor.type) || anchor.id === 'terms');
    if (!hasTermsAnchor && sectionIdSet.has('terms')) {
      sortedNavAnchors.push({ id: 'terms', label: 'Terms', type: 'terms', order: NAV_RULES.length + sortedNavAnchors.length });
    }

    if (legalSections.length) {
      const legalHint = brandTheme.mode === 'light'
        ? 'Keep the layout extremely simple: neutral background, clear headings, ordered lists for key policies, and a prominent link to the full document.'
        : 'Use a flat dark surface with light typography, subtle borders, and concise bullet points summarising the policy.';
      for (const section of legalSections) {
        try {
          const res = await generateHtmlForSection({
            section,
            sitePrompt: prompt,
            theme: themeToUse,
            language: languageName,
            styleHint: legalHint,
            themeMode: brandTheme.mode,
            ctaTarget: isGameSite ? 'game.html' : undefined,
          });
          let cleanHtml = sanitizeSectionHtml(res.htmlContent || '');
          if (!cleanHtml) continue;
          const baseCandidate = sanitizeIdCandidate(section.type || section.title || 'legal');
          const candidate = baseCandidate && !sectionIdSet.has(baseCandidate)
            ? baseCandidate
            : `${baseCandidate || 'legal'}-${sectionResults.length + 1}`;
          sectionIdSet.add(candidate);
          const accentClass = SECTION_ACCENTS[accentCursor % SECTION_ACCENTS.length];
          accentCursor += 1;
          const shapeChoice = 'flat';
          const shapeClass = SECTION_SHAPE_CLASS_MAP[shapeChoice];
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
              if (!/data-section-accent=/.test(updated)) {
                updated += ` data-section-accent="${accentClass}"`;
              }
              if (!/data-section-shape=/.test(updated)) {
                updated += ` data-section-shape="${shapeChoice}"`;
              }
              if (/class\s*=/.test(updated)) {
                updated = updated.replace(/class\s*=\s*"([^"]*)"/i, (full: string, classes: string) => {
                  const filtered = classes.split(/\s+/).filter(Boolean).filter((cls: string) => !cls.startsWith('shape-'));
                  if (!filtered.includes('generated-section')) filtered.push('generated-section');
                  if (!filtered.includes(accentClass)) filtered.push(accentClass);
                  if (!filtered.includes(shapeClass)) filtered.push(shapeClass);
                  return ` class="${filtered.join(' ')}"`;
                });
              } else {
                updated += ` class="generated-section ${accentClass} ${shapeClass}"`;
              }
              return `<section${updated}>`;
            });
          } else {
            const sectionTypeAttr = section.type ? ` data-section-type="${section.type}"` : '';
            cleanHtml = `<section id="${candidate}"${sectionTypeAttr} data-section-accent="${accentClass}" data-section-shape="${shapeChoice}" class="generated-section ${accentClass} ${shapeClass}">${cleanHtml}</section>`;
          }
          sectionResults.push({ html: cleanHtml, model: res.model });
          if (!navKeysSeen.has(section.type || candidate)) {
            navKeysSeen.add(section.type || candidate);
            const legalLabel = section.title || (section.type === 'terms' ? 'Terms & Conditions' : 'Privacy Snapshot');
            sortedNavAnchors.push({ id: candidate, label: legalLabel, type: section.type || candidate, order: NAV_RULES.length + sortedNavAnchors.length });
          }
        } catch (error) {
          console.warn('Failed to render legal section', error);
        }
      }
    }

    const allSectionsHtml = sectionResults.map(result => result.html).join('\n\n');

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
        selectedFaviconPath,
        layoutPrefs.includeHeader,
        layoutPrefs.includeFooter,
        selectedLogoAsset?.webPath,
        baseSectionShape,
        {
          includeLegalNav: showLegalNavFallback,
          legalLinks,
        }
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
    files['index.html'] = getIndexHtmlTemplate(
      title,
      allSectionsHtml,
      websiteTypes,
      sortedNavAnchors,
      brandTheme,
      brandVisual,
      selectedFaviconPath,
      layoutPrefs.includeHeader,
      layoutPrefs.includeFooter,
      selectedLogoAsset?.webPath,
      baseSectionShape,
      {
        includeLegalNav: showLegalNavFallback,
        legalLinks,
      }
    );
    files['privacy-policy.html'] = getPrivacyPolicyTemplate(
      title,
      normalizedDomain,
      policyContentHtml,
      sortedNavAnchors,
      brandTheme,
      brandVisual,
      websiteTypes,
      selectedFaviconPath,
      layoutPrefs.includeHeader,
      layoutPrefs.includeFooter,
      selectedLogoAsset?.webPath,
      baseSectionShape,
      {
        includeLegalNav: showLegalNavFallback,
        legalLinks,
      }
    );
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

    if (selectedLogoAsset) {
      files[selectedLogoAsset.webPath] = selectedLogoAsset.buffer;
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
