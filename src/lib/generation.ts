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
  generateIndexPageHtml,
  generatePrivacyPolicyPageHtml,
  generateTermsPageHtml,
  generateGameFullPageHtml,
} from '@/ai/flows/generate-full-pages';
type SectionNavItem = { id: string; label: string; type: string; order?: number };
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

// Helper: pick a visual accent class for section backgrounds
function pickSectionAccent(index: number): string {
  if (!SECTION_ACCENTS.length) return '';
  return SECTION_ACCENTS[index % SECTION_ACCENTS.length];
}

// Inject small CSS/JS helpers into final HTML to improve visual quality
function injectEnhancements(html: string): string {
  if (!html || typeof html !== 'string') return html;
  const styleBlock = [
    '<style id="site-enhancements-css">',
    '  .reveal-on-scroll{opacity:0;transform:translateY(14px) scale(.98);transition:opacity .6s ease,transform .6s ease;will-change:transform,opacity}',
    '  .reveal-on-scroll.is-visible{opacity:1;transform:none}',
    '  /* Normalize section layout: keep content in a centered container */',
    '  section > .max-w-6xl{width:100%}',
    '  /* Tame oversized CTAs from model output */',
    '  button, a[role="button"], .btn, a.btn{font-size:clamp(.9rem,1.1vw,1rem);padding:.6rem 1rem;border-radius:.75rem}',
    '  .btn-lg, a.btn-lg, .cta-large{font-size:clamp(1rem,1.2vw,1.05rem);padding:.7rem 1.1rem;border-radius:.9rem}',
    '  /* Ensure inline images don’t overflow and look consistent */',
    '  img{max-width:100%;height:auto;display:block}',
    '  .section-accent-aurora{position:relative;overflow:hidden}',
    "  .section-accent-aurora::before{content:'';position:absolute;inset:-25%;pointer-events:none;filter:blur(40px);background:radial-gradient(40% 40% at 20% 20%,rgba(99,102,241,.35),transparent 70%),radial-gradient(40% 40% at 80% 20%,rgba(236,72,153,.25),transparent 70%),radial-gradient(40% 40% at 50% 80%,rgba(34,197,94,.2),transparent 70%)}",
    '  .section-accent-grid{background-image:linear-gradient(rgba(148,163,184,.12) 1px,transparent 1px),linear-gradient(90deg,rgba(148,163,184,.12) 1px,transparent 1px);background-size:28px 28px;background-position:-14px -14px}',
    '  .section-accent-wave{background:linear-gradient(135deg,rgba(59,130,246,.15),rgba(139,92,246,.15));backdrop-filter:saturate(120%)}',
    '  .section-accent-noise{position:relative;overflow:hidden}',
    "  .section-accent-noise::after{content:'';position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(rgba(255,255,255,.04) 1px,transparent 1px),radial-gradient(rgba(0,0,0,.05) 1px,transparent 1px);background-size:3px 3px,4px 4px;mix-blend-mode:overlay;opacity:.6}",
    '  .section-accent-lens{position:relative;overflow:hidden}',
    "  .section-accent-lens::before{content:'';position:absolute;inset:-30%;background:radial-gradient(50% 50% at 50% 50%,rgba(255,255,255,.05),transparent 70%);pointer-events:none}",
    '</style>'
  ].join('\n');

  const scriptBlock = [
    '<script id="site-enhancements" data-auto>',
    '(function(){',
    '  var prefersReduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;',
    '  if(!prefersReduced){',
    '    var els = Array.from(document.querySelectorAll(".reveal-on-scroll"));',
    '    try {',
    '      var io = new IntersectionObserver(function(entries){ entries.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add("is-visible"); io.unobserve(e.target);} }); }, {rootMargin:"0px 0px -10% 0px", threshold:0.08});',
    '      els.forEach(function(el){ io.observe(el); });',
    '    } catch (e) {',
    '      els.forEach(function(el){ el.classList.add("is-visible"); });',
    '    }',
    '  }',
    '  if(!prefersReduced){',
    '    var pEls = Array.from(document.querySelectorAll("[data-parallax]"));',
    '    var ticking = false;',
    '    var raf = window.requestAnimationFrame || function(fn){ return setTimeout(fn, 16); };',
    '    function update(){',
    '      ticking = false;',
    '      var vh = window.innerHeight || 1;',
    '      pEls.forEach(function(el){',
    '        var speed = parseFloat(el.getAttribute("data-parallax")) || 0.15;',
    '        var r = el.getBoundingClientRect();',
    '        var center = (r.top + r.bottom) / 2;',
    '        var delta = (center - vh/2) / vh;',
    '        var translate = Math.max(-40, Math.min(40, -delta * speed * 120));',
    '        el.style.transform = "translate3d(0," + translate + "px,0)";',
    '      });',
    '    }',
    '    function onScroll(){ if(!ticking){ ticking = true; raf(update); } }',
    '    window.addEventListener("scroll", onScroll, { passive: true });',
    '    window.addEventListener("resize", onScroll, { passive: true });',
    '    onScroll();',
    '  }',
    '})();',
    '</script>'
  ].join('\n');

  let out = html;
  if (!/id=\"site-enhancements-css\"/.test(out)) {
    out = out.replace(/<\/head>/i, styleBlock + '\n</head>');
  }
  if (!/id=\"site-enhancements\"/.test(out)) {
    out = out.replace(/<\/body>/i, scriptBlock + '\n</body>');
  }
  return out;
}

// Replace broken <img src> URLs with a known asset from our library so UI never shows empty images.
function normalizeImageTags(html: string, pool: string[], extras?: string[]): string {
  if (!html || !pool || pool.length === 0) return html;
  try {
    const combined = [...pool, ...((extras || []).filter(Boolean))];
    const first = combined[0] || pool[0];
    const set = new Set(combined.map((p) => p.replace(/^\/?/, '')));
    return html.replace(/<img\b([^>]*?)src=("|')([^"']+)(\2)([^>]*)>/gi, (m, pre, q, url, _q2, post) => {
      const u = (url || '').trim();
      if (!u || /^https?:/i.test(u) || /^data:/i.test(u)) return m;
      // Do not rewrite explicit logo or favicon assets
      if (/\/logo-(bar|casino)\//i.test(u) || /\/favicon\//i.test(u) || /(^|\/)logo(\.|\b)/i.test(u)) return m;
      const normalized = u.replace(/^\/?/, '');
      if (set.has(normalized)) return m.replace(url, normalized);
      return `<img${pre}src=${q}${first}${q}${post}>`;
    });
  } catch {
    return html;
  }
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
    // FIXED: Default to Ukrainian for Cyrillic as per user preference
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

// Remove emojis and non‑ASCII pictographs to keep design clean and consistent
function stripEmojis(html: string): string {
  if (!html) return '';
  // Blocks: Misc Symbols, Dingbats, Emoticons, Supplemental Symbols and Pictographs, Symbols and Pictographs Extended-A,
  // plus common variation selectors and zero-width joiners.
  const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}]/gu;
  let cleaned = html.replace(emojiRegex, '');
  // Also strip any remaining surrogate pairs in the emoji range
  cleaned = cleaned.replace(/[\uD83C-\uDBFF][\uDC00-\uDFFF]/g, '');
  return cleaned;
}

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

// FIXED: This function was too aggressive and stripped valid styling.
// It's better to trust the AI's Tailwind skills and only remove potentially harmful tags.
function sanitizeSectionHtml(html: string): string {
  if (!html) return '';
  let clean = html;
  
  // Remove only potentially harmful or layout-breaking elements.
  const patterns = [
    /<\s*(header|nav|footer)[^>]*>[\s\S]*?<\/\s*\1>/gi, // These are handled by the main page template
    /<\s*style[^>]*>[\s\S]*?<\/\s*style>/gi,           // Avoid inline styles
    /<\s*script[^>]*>[\s\S]*?<\/\s*script>/gi,          // Avoid inline scripts
    /<!--[\s\S]*?-->/g,                                 // Remove comments
  ];

  for (const pattern of patterns) {
    clean = clean.replace(pattern, '');
  }

  // Removing inline style attributes is still a good idea for consistency.
  clean = clean.replace(/\sstyle="[^"]*"/gi, '');
  
  // REMOVED: The aggressive class filtering logic. We will now trust the AI to generate correct Tailwind classes.
  // This was likely a major cause of the "crooked" visual output.

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
        details: 'Create a welcoming hero that highlights the social gaming vibe, free community events, and nightly highlights. No real‑money play.',
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
            : 'Highlight three perks: daily perks, community challenges, and zero real‑money wagering.',
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
    creativeBrief: 'Modern, clean, and engaging design with a user-friendly layout.',
    theme: { primaryColor: 'indigo-500', font: 'Inter' },
    sections,
    usage: { inputTokens: 0, outputTokens: 0 },
    model: 'fallback-template',
  };
}

function extractRequestedSectionCount(input: string): number | null {
  if (!input) return null;
  const normalized = input.toLowerCase();
  // Accept forms like "3 секции", "3-секции", "3 sections", "3 blocks", "3 розділи"
  const digitMatch = normalized.match(/(\d+)\s*[-–—]?\s*(?:section|sections|секц|раздел|block|blocks|блок|розділ|розділи)/);
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
  const wordMatch = normalized.match(/\b(один|одна|одну|одной|два|две|двух|три|трех|трёх|четыре|пять|шесть|семь|восемь|девять|десять|one|two|three|four|five|six|seven|eight|nine|ten|single)\b[^\S\r\n]*[-–—]?[^\S\r\n]*(?:секц|section|раздел|block|блок|розділ)/);
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

function levenshteinDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (let i = 0; i < rows; i += 1) dp[i][0] = i;
  for (let j = 0; j < cols; j += 1) dp[0][j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[rows - 1][cols - 1];
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

  const cleaned = text
    .replace(/[^a-zа-яёіїґ\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const tokens = cleaned.split(' ').filter(Boolean);

  const fuzzyMatch = (targets: string[], maxDistance: number) => {
    return targets.some((target) => {
      const base = target.toLowerCase();
      return tokens.some((token) => {
        if (Math.abs(token.length - base.length) > maxDistance + 1) return false;
        return levenshteinDistance(token, base) <= maxDistance;
      });
    });
  };

  const lightFuzzy = ['светлая', 'світла', 'світлий', 'light', 'легка', 'bright'];
  const darkFuzzy = ['темная', 'темна', 'темний', 'dark', 'night', 'тёмная'];

  if (fuzzyMatch(lightFuzzy, 3)) return 'light';
  if (fuzzyMatch(darkFuzzy, 2)) return 'dark';

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

export async function generateSingleSite(prompt: string, siteName: string, websiteTypes: string[] = [], history: string[] = [], model?: string): Promise<Site | null> {
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
    const themeMode: 'light' | 'dark' = preferredMode
      ? preferredMode
      : (isGameSite ? 'dark' : (Math.random() < 0.5 ? 'light' : 'dark'));
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
    const allImagePoolGlobal: string[] = Array.isArray((manifest as any).images) ? (manifest as any).images as any : [];
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
    // Choose single game folder ahead of time (no wrapper pages)
    let selectedGameFolder: string | undefined = undefined;
    if (isGameSite && gameFolders.length > 0) {
      selectedGameFolder = gameFolders[Math.floor(Math.random() * gameFolders.length)];
    }

    // --- Step 2: AI Content Generation ---
    console.log('Step 2.1: Getting site structure...');
    let structureResult: FlowResult<SiteStructure>;
    try {
      structureResult = await generateSiteStructure({ prompt, language: languageName, model });
    } catch (error) {
      console.error('generateSiteStructure failed, using deterministic fallback plan.', error);
      structureResult = createFallbackStructure(siteName, languageName, prompt);
    }
    const structure = structureResult;
    const creativeBrief: string = (structureResult as any).creativeBrief || 'Modern, clean, responsive visual language with cohesive color palette and bold typography.';
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
      const limit = (String(process.env.WG_FAST || '').toLowerCase() === 'true' || process.env.WG_FAST === '1' || process.env.NODE_ENV !== 'production') ? 3 : 8;
      for (const section of desiredSections) {
        if (sectionPlan.length >= limit) break;
        if (!normalized.has(section.type.toLowerCase())) {
          sectionPlan.push({ type: section.type, title: section.title, details: section.details });
          normalized.add(section.type.toLowerCase());
        }
      }
    }
    structure.sections = sectionPlan;

    // We no longer inject legal sections into the index page. They are separate pages.
    const looksLegalByTitle = (s: { title?: string; type?: string }) => {
      const t = (s.title || '').toLowerCase();
      return /(terms|privacy|policy|legal|responsible)/i.test(t);
    };
    let mainSections = sectionPlan.filter(
      (s) => !['terms', 'privacy', 'responsible-gaming'].includes((s.type || '').toLowerCase()) && !looksLegalByTitle(s)
    );
    if (explicitSectionCount != null && Number.isFinite(explicitSectionCount) && explicitSectionCount > 0) {
      mainSections = mainSections.slice(0, explicitSectionCount);
    }

    let totalInputTokens = structureResult.usage?.inputTokens ?? 0;
    let totalOutputTokens = structureResult.usage?.outputTokens ?? 0;

    console.log(`Step 2.2: Generating ${mainSections.length} sections with limited concurrency...`);
    const themeToUse = structure.theme || { primaryColor: "indigo-500", font: "Inter" };
    const usedImagePaths = new Set<string>();
    // Prepare a site-wide image selection to encourage AI usage on index page
    const siteImagePool: string[] = [];
    const FAST = (process.env.WG_FAST === '0') ? false : (String(process.env.WG_FAST || '').toLowerCase() === 'true' || process.env.WG_FAST === '1' || process.env.NODE_ENV !== 'production');
    const maxSiteImages = FAST ? 4 : 12;
    {
      const poolCopy = [...imagePaths];
      while (siteImagePool.length < maxSiteImages && poolCopy.length) {
        const idx = Math.floor(Math.random() * poolCopy.length);
        const pick = poolCopy.splice(idx, 1)[0];
        if (pick) siteImagePool.push(pick);
      }
      for (const p of siteImagePool) usedImagePaths.add(p);
    }
    const sectionResults: { html: string; model?: string }[] = [];
    // Aggressive parallelism in fast mode or with pro
    const fastMode = FAST;
    const parFromEnv = Number.parseInt(String(process.env.WG_PAR || ''), 10);
    const parValid = Number.isFinite(parFromEnv) && parFromEnv > 0 && parFromEnv <= 16 ? parFromEnv : undefined;
    const CHUNK_SIZE = parValid ?? (((model && model.includes('pro')) || fastMode) ? (process.env.NODE_ENV !== 'production' ? 10 : 8) : 4);
    const ctaTarget = isGameSite && selectedGameFolder ? `games/${selectedGameFolder}/game.html` : undefined;
    const sectionIdSet = new Set<string>();
    const navAnchors: SectionNavItem[] = [];
    const navKeysSeen = new Set<string>();

    for (let i = 0; i < mainSections.length; i += CHUNK_SIZE) {
      const slice = mainSections.slice(i, i + CHUNK_SIZE);
      const generated = await Promise.all(slice.map(async (section, index) => {
        let sectionImages: string[] = [];
        if (imagePaths.length > 0) {
          const pool = imagePaths.filter((p) => !usedImagePaths.has(p));
          const isGallery = /^(gallery|games?)$/i.test(section.type || '');
          const target = isGallery ? 10 : 4;
          const take = Math.min(target, Math.max(1, Math.floor(Math.random() * (target - 1)) + 1));
          for (let t = 0; t < take && pool.length; t++) {
            const pick = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
            if (pick) {
              sectionImages.push(pick);
              usedImagePaths.add(pick);
            }
          }
          if (!sectionImages.length && imagePaths.length) {
            const idx = Math.floor(Math.random() * imagePaths.length);
            sectionImages = [imagePaths[idx]];
            usedImagePaths.add(imagePaths[idx]);
          }
        }
        const res = await generateHtmlForSection({
          section,
          sitePrompt: prompt,
          creativeBrief,
          theme: themeToUse,
          imageUrls: sectionImages,
          language: languageName,
          themeMode: themeMode,
          ctaTarget,
          model: fastMode ? 'googleai/gemini-2.5-flash' : model,
        });
        if (res.usage?.inputTokens) totalInputTokens += res.usage.inputTokens;
        if (res.usage?.outputTokens) totalOutputTokens += res.usage.outputTokens;
        let cleanHtml = stripEmojis(sanitizeSectionHtml(res.htmlContent || ''));
        if (!cleanHtml) {
          return { html: '', model: res.model };
        }
        if ((section.type || '').toLowerCase() === 'hero') {
          cleanHtml = stripNavLikeBlocks(cleanHtml);
        }
        if (sectionImages.length && !/<img\b/i.test(cleanHtml)) {
          const safeAlt = (section.title || section.type || 'image').toString().slice(0, 60);
          const imgs = sectionImages
            .map((src) => `<img src="${src}" alt="${safeAlt}" loading="lazy" class="w-full aspect-[16/9] md:aspect-[21/9] object-cover rounded-xl shadow-md" />`)
            .join('');
          cleanHtml += `<div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8"><div class="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6">${imgs}</div></div>`;
        }
        const baseCandidate = sanitizeIdCandidate(section.type || section.title || `section-${i + index + 1}`) || `section-${i + index + 1}`;
        let candidate = baseCandidate;
        let attempt = 1;
        while (sectionIdSet.has(candidate)) {
          candidate = `${baseCandidate}-${++attempt}`;
        }
        sectionIdSet.add(candidate);

        const shapeChoice = pickSectionShape(section, baseSectionShape, i + index);
        const accentClass = pickSectionAccent(i + index);

        if (/^<section\b/i.test(cleanHtml)) {
          cleanHtml = cleanHtml.replace(/^<section\b([^>]*)>/i, (match, attrs) => {
            let updated = attrs || '';
            // id
            if (/id\s*=/.test(updated)) {
              updated = updated.replace(/id\s*=\s*\"[^\"]*\"/i, ` id=\"${candidate}\"`);
            } else {
              updated += ` id=\"${candidate}\"`;
            }
            // data-section-type
            if (section.type && !/data-section-type=/.test(updated)) {
              updated += ` data-section-type=\"${section.type}\"`;
            }
            // classes: ensure reveal-on-scroll + accent present
            if (/class\s*=\s*\"([^\"]*)\"/i.test(updated)) {
              updated = updated.replace(/class\s*=\s*\"([^\"]*)\"/i, (m: string, cls: string) => ` class=\"${cls} reveal-on-scroll ${accentClass}\"`);
            } else {
              updated += ` class=\"reveal-on-scroll ${accentClass}\"`;
            }
            return `<section${updated}>`;
          });
          // Ensure a centered container wrapper exists to avoid odd full-width stripes
          const cap = cleanHtml.match(/^<section\b[^>]*>([\s\S]*?)<\/section>$/i);
          if (cap) {
            const inner = cap[1] || '';
            const hasContainer = /max-w-\d|\bcontainer\b/.test(inner);
            if (!hasContainer) {
              cleanHtml = cleanHtml.replace(
                /^<section\b([^>]*)>([\s\S]*?)<\/section>$/i,
                (all, a, content) => `<section${a}><div class=\"max-w-6xl mx-auto px-4 sm:px-6 lg:px-8\">${content}</div></section>`
              );
            }
          }
        } else {
          const sectionTypeAttr = section.type ? ` data-section-type=\"${section.type}\"` : '';
          cleanHtml = `<section id=\"${candidate}\" class=\"reveal-on-scroll ${accentClass}\"${sectionTypeAttr}><div class=\"max-w-6xl mx-auto px-4 sm:px-6 lg:px-8\">${cleanHtml}</div></section>`;
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

    const allSectionsHtml = sectionResults.map(result => result.html).join('\n\n');

    const policyLanguage = languageName;
    let policyContentHtml = '';
    if (!FAST) {
      console.log(`Step 2.3: Generating unique privacy policy in ${policyLanguage}...`);
      const policyResult: FlowResult<PolicyContent> = await generatePolicyContent({ siteName, siteDescription: prompt, language: policyLanguage });
      if (policyResult.usage?.inputTokens) totalInputTokens += policyResult.usage.inputTokens;
      if (policyResult.usage?.outputTokens) totalOutputTokens += policyResult.usage.outputTokens;
      const policyHeadingClass = themeMode === 'light'
        ? 'text-3xl font-bold text-slate-900 !mt-12 !mb-4'
        : 'text-3xl font-bold text-white !mt-12 !mb-4';
      policyContentHtml = policyResult.sections.map(section => {
        const contentHtml = marked.parse(section.content);
        return stripEmojis(`<section><h2 id="${section.id}" class="${policyHeadingClass}">${section.title}</h2>${contentHtml}</section>`);
      }).join('\n\n');
    } else {
      policyContentHtml = `<section><h2 id="intro" class="text-3xl font-bold">Privacy Policy</h2><p>This demo does not store personal data. Cookies may be used for basic preferences. 18+ entertainment only.</p></section>`;
    }

    // --- Step 3: Assemble Final Files Object ---
    console.log('Step 3: Assembling final files object...');
    const trimmedSiteName = siteName?.trim();
    const title = trimmedSiteName && trimmedSiteName.length > 1 ? trimmedSiteName : 'My Website';
    const normalizedDomain = deriveDomainName({ domain: siteName, types: websiteTypes }, siteName, title);
    
    const files: Record<string, Buffer | string> = {};
    
    // Game page logic disabled: do NOT generate wrapper pages
    if (false && isGameSite && gameFolders.length > 0) {
      console.log('Step 3.1: Generating game page...');
      const randomGameFolder = gameFolders[Math.floor(Math.random() * gameFolders.length)];

      const absoluteHost = process.env.NEXT_PUBLIC_GAME_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
      const gameIframePath = absoluteHost
        ? `${absoluteHost.replace(/\/$/, '')}/games/${randomGameFolder}/game.html`
        : `games/${randomGameFolder}/game.html`;

      const gamePageContentResult: FlowResult<GamePageContent> = await generateGamePageContent({ siteName: title, language: languageName, model });
      totalInputTokens += gamePageContentResult.usage?.inputTokens ?? 0;
      totalOutputTokens += gamePageContentResult.usage?.outputTokens ?? 0;

      const gpTitle = stripEmojis(gamePageContentResult.title || '');
      const gpDisc = stripEmojis(gamePageContentResult.disclaimerHtml || '');
      try {
        const gameHtml = await generateGameFullPageHtml({
          siteName: title,
          pageTitle: gpTitle,
          gameIframePath,
          disclaimerHtml: gpDisc,
          language: languageName,
          faviconPath: selectedFaviconPath,
          logoPath: selectedLogoAsset?.webPath,
        });
        files['game.html'] = gameHtml.html;
      } catch (e) {
        console.warn('generateGameFullPageHtml failed. Inserting minimal game page.');
        files['game.html'] = `<!doctype html><html><head><meta charset="utf-8"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">` +
          `<title>${title} — Demo Game</title><script src=\"https://cdn.tailwindcss.com\"></script></head><body class=\"bg-slate-950 text-slate-100\">` +
          `<main class=\"max-w-6xl mx-auto p-6\"><h1 class=\"text-3xl font-bold mb-4\">${gpTitle || 'Demo Game'}</h1>` +
          `<div class=\"rounded-xl overflow-hidden aspect-video bg-black mb-6\"><iframe src=\"${gameIframePath}\" class=\"w-full h-full\" frameborder=\"0\"></iframe></div>` +
          `<p class=\"text-sm opacity-80\"><span class=\"material-icons align-middle mr-1\">eighteen_up_rating</span> Entertainment-only social casino demo. 18+ only. No real-money play.</p>` +
          `</main></body></html>`;
      }

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

    // Bundle only one game's assets (no wrapper pages)
    if (isGameSite && selectedGameFolder) {
      try {
        const gameAssets = await getFilesRecursively(path.join(sourceGamesDir, selectedGameFolder));
        for (const [relative, buffer] of Object.entries(gameAssets)) {
          const normalizedRelative = relative.split(path.sep).join('/');
          const zipPath = ['games', selectedGameFolder, normalizedRelative].join('/');
          files[zipPath] = buffer;
        }
      } catch (error) {
        console.warn(`Failed to attach game assets for ${selectedGameFolder}:`, error);
      }
    }

    // Generate additional game pages (total up to 4) and provide links to index
    let gamePageEntries: Array<{ title: string; href: string; cover?: string }> = [];
    if (isGameSite && gameFolders.length > 0) {
      try {
        // Single entry only
        if (selectedGameFolder) {
          const cover = imagePaths.length ? imagePaths[Math.floor(Math.random() * imagePaths.length)] : undefined;
          gamePageEntries = [{
            title: stripEmojis(`Game: ${selectedGameFolder.replace(/[-_]/g, ' ')}`) || 'Game',
            href: `games/${selectedGameFolder}/game.html`,
            cover,
          }];
        }
      } catch (err) {
        console.warn('Multi-game generation skipped due to error:', err);
      }
    }

    // Add standard files via AI (no static templates)
    try {
      const anchorsPayload = sortedNavAnchors.map((a) => ({ id: a.id, label: a.label }));
      const indexResult = await generateIndexPageHtml({
        siteName: title,
        sitePrompt: prompt,
        language: languageName,
        sectionsHtml: allSectionsHtml,
        hasGame: isGameSite,
        logoPath: selectedLogoAsset?.webPath,
        imageUrls: siteImagePool,
        gamePages: gamePageEntries,
        anchors: anchorsPayload,
        faviconPath: selectedFaviconPath,
      });
      let indexHtml = injectEnhancements(indexResult.html);
      indexHtml = normalizeImageTags(indexHtml, allImagePoolGlobal.length ? allImagePoolGlobal : siteImagePool, [selectedLogoAsset?.webPath || '', selectedFaviconPath || '']);
      if (selectedFaviconPath && !/<link[^>]+rel=("|')icon\1/i.test(indexHtml)) {
        indexHtml = indexHtml.replace(/<\/head>/i, `<link rel=\"icon\" href=\"/${selectedFaviconPath}\">\n</head>`);
      }
      // Fix stray links to /game or /game/index.html -> point to first actual game
      const fixGameHref = (html: string): string => {
        const firstHref = gamePageEntries[0]?.href || (ctaTarget || '');
        if (!firstHref) return html;
        return html
          .replace(/href=("|')\.?\/?game(?:\/index\.html|\/|\.html)?\1/gi, (m, q) => `href=${q}${firstHref}${q}`);
      };
      indexHtml = fixGameHref(indexHtml);
      if (!isGameSite) {
        // Safety: remove accidental links to game.html if model added any.
        indexHtml = indexHtml
          .replace(/href=("|')game\.html\1/gi, 'href="#"')
          .replace(/data-preview-path=("|')game\.html\1/gi, '');
      }
      files['index.html'] = indexHtml;
    } catch (e) {
      console.warn('generateIndexPageHtml failed. Falling back to concatenated sections only.');
      files['index.html'] = `<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">` +
        `<title>${title}</title><script src=\"https://cdn.tailwindcss.com\"></script></head><body>` +
        `${allSectionsHtml}` +
        `</body></html>`;
    }
    try {
      const privacyResult = await generatePrivacyPolicyPageHtml({
        siteName: title,
        domain: normalizedDomain,
        language: languageName,
        contentHtml: policyContentHtml,
        faviconPath: selectedFaviconPath,
        logoPath: selectedLogoAsset?.webPath,
      });
      files['privacy-policy.html'] = injectEnhancements(normalizeImageTags(privacyResult.html, allImagePoolGlobal.length ? allImagePoolGlobal : siteImagePool, [selectedLogoAsset?.webPath || '', selectedFaviconPath || '']));
    } catch (e) {
      console.warn('generatePrivacyPolicyPageHtml failed. Inserting minimal fallback.');
      files['privacy-policy.html'] = `<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">` +
        `<title>Privacy Policy - ${title}</title><script src=\"https://cdn.tailwindcss.com\"></script></head><body>` +
        `<main class=\"max-w-3xl mx-auto p-6\">${policyContentHtml}</main></body></html>`;
    }
    try {
      const termsResult = await generateTermsPageHtml({
        siteName: title,
        domain: normalizedDomain,
        language: languageName,
        faviconPath: selectedFaviconPath,
        logoPath: selectedLogoAsset?.webPath,
      });
      files['terms.html'] = injectEnhancements(normalizeImageTags(termsResult.html, allImagePoolGlobal.length ? allImagePoolGlobal : siteImagePool, [selectedLogoAsset?.webPath || '', selectedFaviconPath || '']));
    } catch (e) {
      console.warn('generateTermsPageHtml failed. Inserting minimal fallback.');
      files['terms.html'] = `<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">` +
        `<title>Terms & Conditions - ${title}</title><script src=\"https://cdn.tailwindcss.com\"></script></head><body>` +
        `<main class=\"max-w-3xl mx-auto p-6\"><h1 class=\"text-3xl font-bold mb-4\">Terms & Conditions</h1>` +
        `<p>This platform is intended for adult audiences (18+) and offers entertainment-only social gaming. No real-money play, deposits, or cash prizes.</p>` +
        `</main></body></html>`;
    }
    
    // Add used images (and include the rest of our library as safe fallback)
    const allLibImages: string[] = Array.isArray((manifest as any).images) ? (manifest as any).images : [];
    const packAllImages = String(process.env.WG_PACK_ALL_IMAGES || '').toLowerCase() === 'true' || process.env.WG_PACK_ALL_IMAGES === '1';
    let imagesToPack = new Set<string>(packAllImages ? [...usedImagePaths, ...allLibImages] : [...usedImagePaths]);
    // Safety: if AI разметка почти не использовала изображения — возьми весь пул, чтобы на сайте точно были картинки
    if (imagesToPack.size === 0 && allLibImages.length > 0) {
      imagesToPack = new Set<string>(allLibImages);
    }
    console.log(`Adding ${imagesToPack.size} images to the files object... (packAll=${packAllImages})`);
    for (const webPath of imagesToPack) {
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
    console.log(`Generation successful! Main sections: ${mainSections.length}, elapsed ${Math.round(elapsedMs / 100) / 10}s`);
    const usage: TokenUsageSummary = {
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      totalTokens: totalInputTokens + totalOutputTokens,
      model: structureResult.model || sectionResults[0]?.model,
    };

    return { domain: normalizedDomain, files, history: [...history, prompt], types: websiteTypes, usage };

  } catch (error) {
    console.error(`Fatal generation error for prompt "${prompt}":`, error);
    // Robust fallback: always return a minimal site so UI doesn't fail
    const safeTitle = siteName?.trim() || 'My Website';
    const indexHtml = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${safeTitle}</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-slate-950 text-slate-100">
    <header class="sticky top-0 bg-slate-900/80 backdrop-blur border-b border-slate-800"><div class="max-w-6xl mx-auto p-4 flex items-center justify-between"><strong>${safeTitle}</strong><nav class="text-sm space-x-4"><a href="#about" class="hover:text-sky-400">About</a><a href="#features" class="hover:text-sky-400">Features</a><a href="privacy-policy.html" class="hover:text-sky-400">Privacy</a><a href="terms.html" class="hover:text-sky-400">Terms</a></nav></div></header>
    <main class="max-w-6xl mx-auto p-6">
      <section id="hero" class="py-16"><h1 class="text-4xl font-bold">${safeTitle}</h1><p class="mt-3 opacity-80">Entertainment-only demo site. 18+ only. No real-money play, deposits or prizes.</p></section>
      <section id="about" class="py-10"><h2 class="text-2xl font-semibold">About</h2><p class="opacity-80">Unique social experience built by AI.</p></section>
      <section id="features" class="py-10"><h2 class="text-2xl font-semibold">Features</h2><ul class="list-disc ml-6 opacity-80"><li>Free-to-play</li><li>Modern responsive UI</li><li>Cookie consent</li></ul></section>
    </main>
    <section class="bg-slate-900 border-t border-slate-800 p-6 text-sm opacity-80"><p>This is a social gaming concept for an adult audience (18+) for amusement only. No real-money gambling or prizes.</p></section>
    </body></html>`;
    const termsHtml = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Terms & Conditions - ${safeTitle}</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-slate-950 text-slate-100"><main class="max-w-3xl mx-auto p-6"><h1 class="text-3xl font-bold mb-4">Terms & Conditions</h1><p class="opacity-90">You must be 18+ to use this site. This is an entertainment-only social experience; no deposits, no real-money gambling, no prizes.</p></main></body></html>`;
    const privacyHtml = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Privacy Policy - ${safeTitle}</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-slate-950 text-slate-100"><main class="max-w-3xl mx-auto p-6"><h1 class="text-3xl font-bold mb-4">Privacy Policy</h1><p class="opacity-90">We keep data collection minimal and only for essential functionality (e.g., cookie consent). You can contact us to request updates or deletion.</p></main></body></html>`;
    const files: Record<string, Buffer | string> = {
      'index.html': indexHtml,
      'terms.html': termsHtml,
      'privacy-policy.html': privacyHtml,
    };
    return { domain: deriveDomainName({ domain: siteName, types: websiteTypes }, siteName, safeTitle), files, history: [...history, prompt], types: websiteTypes };
  }
}
