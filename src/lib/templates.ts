// File: src/lib/templates.ts

export type BrandingTheme = {
  id: string;
  mode: 'light' | 'dark';
  bodyClass: string;
  headerClass: string;
  navLinkClass: string;
  navActiveClass: string;
  menuToggleClass: string;
  mobileNavClass: string;
  mobileNavLinkClass: string;
  mobileNavActiveClass: string;
  gameLinkClass: string;
  gameActiveClass: string;
  mobileGameLinkClass: string;
  mobileGameActiveClass: string;
  footerClass: string;
  footerTextClass: string;
  cookieBannerClass: string;
  cookieTextClass: string;
  cookieButtonClass: string;
  brandBadgeClass: string;
  logoGradient: string;
  styleBlock: string;
};

const randomChoice = <T>(items: T[], fallback?: T): T => {
  if (!items || items.length === 0) {
    if (fallback !== undefined) return fallback;
    throw new Error('randomChoice called with empty array');
  }
  const index = Math.floor(Math.random() * items.length);
  return items[index] ?? (fallback !== undefined ? fallback : items[0]);
};

export type BrandVisual = {
  primaryIcon: string;
  secondaryIcon?: string;
};

const casinoIconPool = ['dice', 'chip', 'crown', 'gamepad', 'trophy', 'gem', 'spark', 'spade', 'club', 'diamond'];
const sportIconPool = ['trophy', 'medal', 'flag', 'rocket', 'shield', 'flare'];
const loungeIconPool = ['palm', 'wave', 'sun', 'spark'];

export function inferBrandVisual(websiteTypes: string[] = [], prompt: string = ''): BrandVisual {
  const typesJoined = websiteTypes.map((type) => type.toLowerCase()).join(' ');
  const promptLower = prompt.toLowerCase();
  let pool = casinoIconPool;
  if (typesJoined.includes('sport') || promptLower.includes('sport')) {
    pool = sportIconPool;
  } else if (typesJoined.includes('bar') || typesJoined.includes('lounge')) {
    pool = loungeIconPool.concat(casinoIconPool);
  }
  if (!pool.length) {
    pool = casinoIconPool;
  }
  const primary = pool[Math.floor(Math.random() * pool.length)] || 'star';
  const secondaryCandidates = pool.filter((icon) => icon !== primary);
  const secondary = secondaryCandidates.length && Math.random() > 0.55
    ? secondaryCandidates[Math.floor(Math.random() * secondaryCandidates.length)]
    : undefined;
  return { primaryIcon: primary, secondaryIcon: secondary };
}

const defaultBrandVisual: BrandVisual = {
  primaryIcon: 'star',
  secondaryIcon: 'spark',
};

const fallbackTheme: BrandingTheme = {
  id: 'minimal-dark',
  mode: 'dark',
  bodyClass: 'font-sans text-slate-100 bg-[#0b101c]',
  headerClass: 'bg-[#0b101c]/90 border-b border-white/8 backdrop-blur-lg',
  navLinkClass: 'text-slate-200 hover:text-white hover:bg-white/10 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
  navActiveClass: 'text-white bg-white/12 shadow-sm',
  menuToggleClass: 'p-2 inline-flex items-center justify-center rounded-md text-slate-200 hover:text-white focus-visible:ring-2 focus-visible:ring-sky-400/60',
  mobileNavClass: 'mobile-nav-base mobile-nav-hidden bg-[#0b101c]/95 text-slate-100',
  mobileNavLinkClass: 'text-slate-100 hover:text-white text-3xl font-semibold',
  mobileNavActiveClass: 'text-white',
  gameLinkClass: 'text-sky-300 font-semibold hover:bg-sky-400/15 hover:text-white px-3 py-2 rounded-lg text-sm transition-colors',
  gameActiveClass: 'ring-2 ring-sky-300/70 ring-offset-2 ring-offset-[#0b101c]',
  mobileGameLinkClass: 'text-sky-300 hover:text-white text-3xl font-semibold',
  mobileGameActiveClass: 'text-white',
  footerClass: 'bg-[#0b101c]/95 border-t border-white/8 backdrop-blur-lg',
  footerTextClass: 'text-slate-300/90',
  cookieBannerClass: 'fixed bottom-0 left-0 right-0 bg-[#0b101c]/92 backdrop-blur-lg p-4 z-50 transform translate-y-full transition-transform duration-300 ease-in-out border-t border-white/10',
  cookieTextClass: 'text-sm text-slate-200',
  cookieButtonClass: 'px-4 py-2 rounded-md bg-sky-500 text-white shadow-sm hover:bg-sky-400 transition',
  brandBadgeClass: 'bg-sky-500/20 text-white',
  logoGradient: 'linear-gradient(120deg, #38bdf8 0%, #6366f1 50%, #22d3ee 100%)',
  styleBlock: '.brand-title { color: #e2e8f0; }',
};

const auroraDarkTheme: BrandingTheme = {
  id: 'aurora-dark',
  mode: 'dark',
  bodyClass: 'font-sans text-slate-100 bg-gradient-to-br from-[#040511] via-[#0e1326] to-[#30145d]',
  headerClass: 'bg-black/60 backdrop-blur-lg border-b border-white/10',
  navLinkClass: 'text-slate-300 hover:bg-white/10 hover:text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors',
  navActiveClass: 'text-white bg-white/15 shadow-sm',
  menuToggleClass: 'p-2 inline-flex items-center justify-center rounded-md text-slate-300 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400',
  mobileNavClass: 'mobile-nav-base mobile-nav-hidden bg-gradient-to-b from-[#0b0f1e]/95 via-[#14092d]/95 to-[#1f0a3d]/95 text-slate-200',
  mobileNavLinkClass: 'text-slate-200 hover:text-white text-3xl font-bold tracking-tight',
  mobileNavActiveClass: 'text-white',
  gameLinkClass: 'text-purple-300 font-semibold hover:bg-white/12 hover:text-white px-3 py-2 rounded-lg text-sm transition-colors',
  gameActiveClass: 'ring-2 ring-purple-300/70 ring-offset-2 ring-offset-[#0b0f1e]',
  mobileGameLinkClass: 'text-purple-200 hover:text-white text-3xl font-bold',
  mobileGameActiveClass: 'text-white',
  footerClass: 'bg-black/60 border-t border-white/10',
  footerTextClass: 'text-slate-400',
  cookieBannerClass: 'fixed bottom-0 left-0 right-0 bg-[#0b0f1e]/90 backdrop-blur-lg p-4 z-50 transform translate-y-full transition-transform duration-300 ease-in-out border-t border-white/10',
  cookieTextClass: 'text-sm text-slate-200',
  cookieButtonClass: 'px-4 py-2 rounded-md bg-gradient-to-r from-[#a855f7] to-[#6366f1] text-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.25)] hover:brightness-105 hover:-translate-y-[1px] transition shadow-lg shadow-violet-500/25 hover:shadow-violet-400/35',
  brandBadgeClass: 'bg-white/10 text-white shadow-[0_6px_18px_rgba(124,58,237,0.35)]',
  logoGradient: 'linear-gradient(135deg, #c084fc 0%, #818cf8 50%, #22d3ee 100%)',
  styleBlock: '.brand-title { background: linear-gradient(135deg,#c084fc,#818cf8,#22d3ee); -webkit-background-clip: text; color: transparent; background-clip: text; }',
};

const minimalLightTheme: BrandingTheme = {
  id: 'minimal-light',
  mode: 'light',
  bodyClass: 'font-sans text-slate-800 bg-[#f7f8fb]',
  headerClass: 'bg-white/90 border-b border-slate-200/80 backdrop-blur-xl',
  navLinkClass: 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
  navActiveClass: 'text-slate-900 bg-slate-100 shadow-sm',
  menuToggleClass: 'p-2 inline-flex items-center justify-center rounded-md text-slate-600 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-400/60',
  mobileNavClass: 'mobile-nav-base mobile-nav-hidden bg-white/95 text-slate-800',
  mobileNavLinkClass: 'text-slate-800 hover:text-slate-900 text-3xl font-semibold',
  mobileNavActiveClass: 'text-slate-900',
  gameLinkClass: 'text-sky-600 font-semibold hover:bg-sky-100 hover:text-sky-700 px-3 py-2 rounded-lg text-sm transition-colors',
  gameActiveClass: 'ring-2 ring-sky-300/80 ring-offset-2 ring-offset-white',
  mobileGameLinkClass: 'text-sky-600 hover:text-sky-700 text-3xl font-semibold',
  mobileGameActiveClass: 'text-sky-700',
  footerClass: 'bg-white/90 border-t border-slate-200/80 backdrop-blur-xl',
  footerTextClass: 'text-slate-500',
  cookieBannerClass: 'fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg p-4 z-50 transform translate-y-full transition-transform duration-300 ease-in-out border-t border-slate-200/80',
  cookieTextClass: 'text-sm text-slate-600',
  cookieButtonClass: 'px-4 py-2 rounded-md bg-sky-500 text-white shadow-sm hover:bg-sky-400 transition',
  brandBadgeClass: 'bg-sky-100 text-sky-700',
  logoGradient: 'linear-gradient(120deg, #1d4ed8 0%, #0ea5e9 60%, #22d3ee 100%)',
  styleBlock: '.brand-title { color: #1f2937; }',
};

const cyberDarkTheme: BrandingTheme = {
  id: 'cyber-dark',
  mode: 'dark',
  bodyClass: 'font-sans text-slate-100 bg-gradient-to-br from-[#05080f] via-[#0d1b2a] to-[#011627]',
  headerClass: 'bg-slate-950/70 backdrop-blur-lg border-b border-cyan-400/30',
  navLinkClass: 'text-slate-300 hover:bg-cyan-500/10 hover:text-cyan-200 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
  navActiveClass: 'text-cyan-100 bg-cyan-500/20 shadow-inner',
  menuToggleClass: 'p-2 inline-flex items-center justify-center rounded-md text-cyan-200 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400',
  mobileNavClass: 'mobile-nav-base mobile-nav-hidden bg-[#03111f]/95 text-slate-200',
  mobileNavLinkClass: 'text-cyan-200 hover:text-white text-3xl font-bold tracking-tight',
  mobileNavActiveClass: 'text-white',
  gameLinkClass: 'text-cyan-300 font-semibold hover:bg-cyan-500/15 hover:text-white px-3 py-2 rounded-lg text-sm transition-colors',
  gameActiveClass: 'ring-2 ring-cyan-300/70 ring-offset-2 ring-offset-[#03111f]',
  mobileGameLinkClass: 'text-cyan-200 hover:text-white text-3xl font-bold',
  mobileGameActiveClass: 'text-white',
  footerClass: 'bg-slate-950/70 border-t border-cyan-400/10',
  footerTextClass: 'text-slate-400',
  cookieBannerClass: 'fixed bottom-0 left-0 right-0 bg-[#03111f]/90 backdrop-blur-xl p-4 z-50 transform translate-y-full transition-transform duration-300 ease-in-out border-t border-cyan-400/20',
  cookieTextClass: 'text-sm text-slate-200',
  cookieButtonClass: 'px-4 py-2 rounded-md bg-gradient-to-r from-[#06b6d4] to-[#3b82f6] text-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.2)] hover:brightness-105 hover:-translate-y-[1px] transition shadow-lg shadow-cyan-500/20 hover:shadow-cyan-400/30',
  brandBadgeClass: 'bg-cyan-500/20 text-white shadow-[0_6px_18px_rgba(6,182,212,0.45)]',
  logoGradient: 'linear-gradient(135deg, #67e8f9 0%, #38bdf8 50%, #818cf8 100%)',
  styleBlock: '.brand-title { background: linear-gradient(135deg,#67e8f9,#38bdf8,#818cf8); -webkit-background-clip: text; color: transparent; background-clip: text; }',
};

const sunriseLightTheme: BrandingTheme = {
  id: 'sunrise-light',
  mode: 'light',
  bodyClass: 'font-sans text-slate-800 bg-gradient-to-br from-[#fff9f1] via-[#fff5fb] to-[#f0f9ff]',
  headerClass: 'bg-white/80 backdrop-blur-xl border-b border-slate-200',
  navLinkClass: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
  navActiveClass: 'text-slate-900 bg-white shadow-sm',
  menuToggleClass: 'p-2 inline-flex items-center justify-center rounded-md text-slate-500 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400',
  mobileNavClass: 'mobile-nav-base mobile-nav-hidden bg-white/95 text-slate-800',
  mobileNavLinkClass: 'text-slate-700 hover:text-slate-900 text-3xl font-bold',
  mobileNavActiveClass: 'text-slate-900',
  gameLinkClass: 'text-amber-600 font-semibold hover:bg-amber-100 hover:text-amber-700 px-3 py-2 rounded-lg text-sm transition-colors',
  gameActiveClass: 'ring-2 ring-amber-300/80 ring-offset-2 ring-offset-white',
  mobileGameLinkClass: 'text-amber-500 hover:text-amber-700 text-3xl font-bold',
  mobileGameActiveClass: 'text-amber-700',
  footerClass: 'bg-white/80 border-t border-slate-200',
  footerTextClass: 'text-slate-500',
  cookieBannerClass: 'fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg p-4 z-50 transform translate-y-full transition-transform duration-300 ease-in-out border-t border-amber-200',
  cookieTextClass: 'text-sm text-slate-600',
  cookieButtonClass: 'px-4 py-2 rounded-md bg-gradient-to-r from-[#f97316] to-[#facc15] text-white shadow hover:brightness-110 transition',
  brandBadgeClass: 'bg-gradient-to-br from-white to-amber-100 text-amber-600 shadow-[0_8px_20px_rgba(249,115,22,0.25)]',
  logoGradient: 'linear-gradient(120deg, #f97316 0%, #facc15 45%, #f472b6 100%)',
  styleBlock: '.brand-title { background: linear-gradient(120deg,#f97316,#facc15,#f472b6); -webkit-background-clip: text; color: transparent; background-clip: text; }',
};

const coastalLightTheme: BrandingTheme = {
  id: 'coastal-light',
  mode: 'light',
  bodyClass: 'font-sans text-slate-800 bg-gradient-to-br from-[#f4fbff] via-[#fefefe] to-[#fff5f5]',
  headerClass: 'bg-white/85 backdrop-blur-xl border-b border-slate-200',
  navLinkClass: 'text-slate-600 hover:bg-blue-100/60 hover:text-blue-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
  navActiveClass: 'text-blue-700 bg-blue-100',
  menuToggleClass: 'p-2 inline-flex items-center justify-center rounded-md text-blue-500 hover:text-blue-700 focus-visible:ring-2 focus-visible:ring-blue-400',
  mobileNavClass: 'mobile-nav-base mobile-nav-hidden bg-white/95 text-slate-800',
  mobileNavLinkClass: 'text-blue-600 hover:text-blue-800 text-3xl font-bold',
  mobileNavActiveClass: 'text-blue-800',
  gameLinkClass: 'text-rose-500 font-semibold hover:bg-rose-100 hover:text-rose-600 px-3 py-2 rounded-lg text-sm transition-colors',
  gameActiveClass: 'ring-2 ring-rose-300/80 ring-offset-2 ring-offset-white',
  mobileGameLinkClass: 'text-rose-500 hover:text-rose-600 text-3xl font-bold',
  mobileGameActiveClass: 'text-rose-600',
  footerClass: 'bg-white/80 border-t border-slate-200',
  footerTextClass: 'text-slate-500',
  cookieBannerClass: 'fixed bottom-0 left-0 right-0 bg-white/92 backdrop-blur-lg p-4 z-50 transform translate-y-full transition-transform duration-300 ease-in-out border-t border-blue-200',
  cookieTextClass: 'text-sm text-slate-600',
  cookieButtonClass: 'px-4 py-2 rounded-md bg-gradient-to-r from-[#38bdf8] to-[#22d3ee] text-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.25)] hover:brightness-105 hover:-translate-y-[1px] transition shadow-lg shadow-sky-500/20 hover:shadow-sky-400/30',
  brandBadgeClass: 'bg-gradient-to-br from-blue-100 to-white text-blue-700 shadow-[0_8px_20px_rgba(56,189,248,0.25)]',
  logoGradient: 'linear-gradient(120deg, #38bdf8 0%, #22d3ee 50%, #fda4af 100%)',
  styleBlock: '.brand-title { background: linear-gradient(120deg,#38bdf8,#22d3ee,#fda4af); -webkit-background-clip: text; color: transparent; background-clip: text; }',
};

const brandingThemes: BrandingTheme[] = [
  fallbackTheme,
  auroraDarkTheme,
  cyberDarkTheme,
  minimalLightTheme,
  sunriseLightTheme,
  coastalLightTheme,
];

type ThemeOptions = {
  preferredMode?: 'light' | 'dark';
  websiteTypes?: string[];
};

const cloneTheme = (theme: BrandingTheme): BrandingTheme => JSON.parse(JSON.stringify(theme));

const applyContextualStyling = (theme: BrandingTheme, normalizedTypes: string[]): BrandingTheme => {
  const next = cloneTheme(theme);
  const isGame = normalizedTypes.some((type) => type.includes('game'));
  if (isGame) {
    const gameStyle = `
:root {
  --body-font: 'Rajdhani', 'Inter', sans-serif;
  --heading-font: 'Teko', 'Orbitron', 'Space Grotesk', sans-serif;
  --accent-font: 'Teko', 'Orbitron', 'Space Grotesk', sans-serif;
  --hero-glow: 0 36px 92px rgba(56, 189, 248, 0.38);
  --btn-radius: 0.55rem;
  --headline-highlight-background: linear-gradient(135deg, rgba(56, 189, 248, 0.26), rgba(129, 140, 248, 0.26));
  --headline-highlight-color: #e2e8f0;
  --headline-highlight-glow: rgba(59, 130, 246, 0.5);
  --headline-highlight-shadow: 0 18px 44px rgba(56, 189, 248, 0.28);
  --btn-primary-bg: linear-gradient(132deg, #2563eb 0%, #6366f1 48%, #f472b6 100%);
  --btn-primary-hover: linear-gradient(132deg, #1d4ed8 0%, #4f46e5 48%, #ec4899 100%);
  --btn-primary-shadow: 0 26px 52px rgba(56, 189, 248, 0.32);
  --btn-secondary-bg: rgba(148, 163, 184, 0.08);
  --btn-secondary-hover: rgba(148, 163, 184, 0.16);
  --btn-secondary-border: rgba(148, 163, 184, 0.28);
  --btn-secondary-color: rgba(226, 232, 240, 0.92);
}
body {
  font-family: var(--body-font, 'Inter', sans-serif);
  letter-spacing: 0.01em;
}
.headline-kicker {
  background: rgba(56, 189, 248, 0.18);
  color: rgba(248, 250, 252, 0.9);
}
.hero-headline {
  letter-spacing: 0.18em;
}
`;
    next.styleBlock = `${next.styleBlock || ''}\n${gameStyle}`;
    next.logoGradient = 'linear-gradient(135deg, #38bdf8 0%, #6366f1 45%, #f472b6 100%)';
  }
  return next;
};

export function chooseBrandingTheme(options: ThemeOptions = {}): BrandingTheme {
  const { preferredMode, websiteTypes = [] } = options;
  const normalizedTypes = websiteTypes.map((type) => type.toLowerCase());
  const isSport = normalizedTypes.some((type) => type.includes('sport'));
  const isGame = normalizedTypes.some((type) => type.includes('game'));

  let pool = brandingThemes.filter((theme) => !preferredMode || theme.mode === preferredMode);
  if (!pool.length) {
    pool = brandingThemes;
  }

  if (isSport) {
    const lightThemes = pool.filter((theme) => theme.mode === 'light');
    if (lightThemes.length && Math.random() < 0.8) {
      pool = lightThemes;
    }
  } else if (isGame && !preferredMode) {
    const darkThemes = pool.filter((theme) => theme.mode === 'dark');
    const lightThemes = pool.filter((theme) => theme.mode === 'light');
    const chooseDark = Math.random() < 0.65;
    if (chooseDark && darkThemes.length) {
      pool = darkThemes;
    } else if (!chooseDark && lightThemes.length) {
      pool = lightThemes;
    }
  }

  const minimalPool = pool.filter((theme) => theme.id.includes('minimal'));
  if (preferredMode) {
    if (minimalPool.length) {
      return applyContextualStyling(minimalPool[0], normalizedTypes);
    }
    const candidate = pool.find((theme) => theme.mode === preferredMode);
    if (candidate) {
      return applyContextualStyling(candidate, normalizedTypes);
    }
  }

  if (minimalPool.length) {
    return applyContextualStyling(minimalPool[Math.floor(Math.random() * minimalPool.length)], normalizedTypes);
  }

  return applyContextualStyling(pool[Math.floor(Math.random() * pool.length)] || fallbackTheme, normalizedTypes);
}

function resolveTheme(theme?: BrandingTheme): BrandingTheme {
  return cloneTheme(theme ?? fallbackTheme);
}

function resolveBrandVisual(visual?: BrandVisual): BrandVisual {
  if (!visual) return defaultBrandVisual;
  return {
    primaryIcon: visual.primaryIcon || defaultBrandVisual.primaryIcon,
    secondaryIcon: visual.secondaryIcon || defaultBrandVisual.secondaryIcon,
  };
}

const DEFAULT_FONT_FAMILIES = [
  'Inter:wght@400;600;700',
  'Space+Grotesk:wght@400;600;700',
];
const GAME_FONT_FAMILIES = [
  'Teko:wght@500;600;700',
  'Orbitron:wght@500;600;700',
  'Rajdhani:wght@500;600;700',
];

const isGameContext = (websiteTypes: string[] = []): boolean =>
  websiteTypes.some((type) => type.toLowerCase().includes('game'));

function resolveFontHref(websiteTypes: string[]): string {
  const families = [...DEFAULT_FONT_FAMILIES];
  if (isGameContext(websiteTypes)) {
    for (const family of GAME_FONT_FAMILIES) {
      if (!families.includes(family)) {
        families.push(family);
      }
    }
  }
  const normalize = (family: string) => family.replace(/\s+/g, '+');
  const query = families
    .map((family) => `family=${normalize(family)}`)
    .join('&');
  return `https://fonts.googleapis.com/css2?${query}&display=swap`;
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatBrandTitle(rawTitle: string): string {
  const fallback = 'My Website';
  if (!rawTitle) {
    return fallback;
  }

  const trimmed = rawTitle.trim();
  if (!trimmed) {
    return fallback;
  }

  const withoutProtocol = trimmed.replace(/^https?:\/\//i, '').replace(/\/.*/, '');
  const candidate = withoutProtocol || trimmed;
  const domainSlice = candidate.includes('.') ? candidate.split('.')[0] : candidate;
  const cleaned = domainSlice
    .replace(/[^a-z0-9\s\-_/]/gi, ' ')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) {
    return fallback;
  }

  return cleaned
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

type PageContext = 'index' | 'game' | 'policy';

export type SectionNavItem = { id: string; label: string; type: string; order?: number };

type NavItem = {
  href: string;
  label: string;
  active?: boolean;
  type?: 'game' | 'default' | 'legal';
};

type NavBuildOptions = {
  includeLegalFallback?: boolean;
};

function buildNavItems(
  currentPage: PageContext,
  websiteTypes: string[],
  sectionAnchors: SectionNavItem[] = [],
  options: NavBuildOptions = {}
): NavItem[] {
  const includeLegalFallback = options.includeLegalFallback ?? true;
  const hasGame = isGameContext(websiteTypes);
  const items: NavItem[] = [];
  items.push({ href: 'index.html', label: 'Home', active: currentPage === 'index' });
  if (hasGame) {
    items.push({ href: 'game.html', label: 'Play Game!', active: currentPage === 'game', type: 'game' });
  }
  const seen = new Set<string>();
  let termsAdded = false;
  let privacyAdded = false;
  for (const anchor of sectionAnchors) {
    const anchorId = (anchor.id || '').trim();
    if (!anchorId) continue;
    const key = anchor.type || anchorId;
    if (seen.has(key)) continue;
    seen.add(key);
    let href = currentPage === 'index' ? `#${anchorId}` : `index.html#${anchorId}`;
    let label = anchor.label?.trim() || anchorId.replace(/-/g, ' ');
    let type: NavItem['type'] | undefined;
    const normalizedKey = key.toLowerCase();
    const isTermsAnchor = normalizedKey.includes('terms');
    const isPrivacyAnchor = normalizedKey.includes('privacy');
    if (isTermsAnchor) {
      label = 'Terms';
      type = 'legal';
      termsAdded = true;
    }
    if (isPrivacyAnchor) {
      label = 'Privacy Policy';
      href = 'privacy-policy.html';
      type = 'legal';
      privacyAdded = true;
    }
    const item: NavItem = { href, label, type };
    if (isPrivacyAnchor && currentPage === 'policy') {
      item.active = true;
    }
    items.push(item);
  }
  if (includeLegalFallback && !termsAdded) {
    const href = currentPage === 'index' ? '#terms' : 'index.html#terms';
    items.push({ href, label: 'Terms', type: 'legal' });
  }
  if (includeLegalFallback && !privacyAdded) {
    items.push({ href: 'privacy-policy.html', label: 'Privacy Policy', active: currentPage === 'policy', type: 'legal' });
  }
  return items;
}

function renderLogo(
  title: string,
  theme: BrandingTheme,
  brandVisual: BrandVisual,
  logoAssetPath?: string,
): string {
  const displayTitle = formatBrandTitle(title);
  const titleAttr = escapeHtmlAttribute(title || displayTitle);
  const displayText = escapeHtmlText(displayTitle);
  const initials = displayText
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const primaryIconImg = logoAssetPath
    ? `<img id="logo-icon" src="${logoAssetPath}" alt="${displayText} logo" class="brand-icon-main absolute inset-0 h-full w-full object-contain" loading="lazy" />`
    : renderBrandIconImg(brandVisual.primaryIcon, 'brand-icon-main');
  const secondaryIconImg = logoAssetPath
    ? ''
    : brandVisual.secondaryIcon
      ? renderBrandIconImg(brandVisual.secondaryIcon, 'brand-icon-secondary')
      : '';
  return `
    <a href="index.html" class="flex items-center gap-3 text-xl font-bold">
      <span class="brand-badge flex h-11 w-11 items-center justify-center rounded-2xl relative overflow-hidden ${theme.brandBadgeClass}">
        ${logoAssetPath ? '' : `<span class="brand-initials" aria-hidden="true">${initials}</span>`}
        ${primaryIconImg}
        ${secondaryIconImg}
      </span>
      <span class="brand-title" title="${titleAttr}">${displayText}</span>
    </a>`;
}

function renderDesktopNav(theme: BrandingTheme, items: NavItem[]): string {
  return items
    .map((item) => {
      const baseClass = item.type === 'game' ? theme.gameLinkClass : theme.navLinkClass;
      const activeClass = item.active
        ? item.type === 'game'
          ? ` ${theme.gameActiveClass}`
          : ` ${theme.navActiveClass}`
        : '';
      return `<a href="${item.href}" class="${baseClass}${activeClass}">${item.label}</a>`;
    })
    .join('\n');
}

function renderMobileNav(theme: BrandingTheme, items: NavItem[]): string {
  return items
    .map((item) => {
      const baseClass = item.type === 'game' ? theme.mobileGameLinkClass : theme.mobileNavLinkClass;
      const activeClass = item.active
        ? item.type === 'game'
          ? ` ${theme.mobileGameActiveClass}`
          : ` ${theme.mobileNavActiveClass}`
        : '';
      return `<a href="${item.href}" class="${baseClass}${activeClass}">${item.label}</a>`;
    })
    .join('\n');
}

function renderHeader(
  title: string,
  theme: BrandingTheme,
  websiteTypes: string[],
  brandVisual: BrandVisual,
  currentPage: PageContext,
  sectionAnchors: SectionNavItem[] = [],
  logoAssetPath?: string,
  options: NavBuildOptions = {},
): string {
  const items = buildNavItems(currentPage, websiteTypes, sectionAnchors, options);
  return `
    <header id="header" class="${theme.headerClass} fixed top-0 left-0 right-0 z-40 transition-shadow duration-300">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">
          ${renderLogo(title, theme, brandVisual, logoAssetPath)}
          <nav class="hidden md:block">
            <div class="ml-10 flex items-baseline space-x-4">
              ${renderDesktopNav(theme, items)}
            </div>
          </nav>
          <div class="-mr-2 flex md:hidden">
            <button type="button" id="burger-menu" class="${theme.menuToggleClass}" aria-expanded="false" aria-controls="mobile-nav">
              <span class="sr-only">Toggle main menu</span>
              <span id="burger-icon" class="burger-icon" aria-hidden="true">
                <span class="burger-line"></span>
                <span class="burger-line"></span>
                <span class="burger-line"></span>
              </span>
            </button>
          </div>
        </div>
      </div>
    </header>
    <div id="mobile-nav" class="${theme.mobileNavClass}">
      <nav class="flex flex-col items-center justify-center h-full gap-y-8">
        ${renderMobileNav(theme, items)}
      </nav>
    </div>
  `;
}

type FooterLink = { label: string; href: string };
type FooterContext = { title: string; theme: BrandingTheme; legalLinks: FooterLink[] };

type FooterVariant = (payload: FooterContext) => string;

const footerVariants: FooterVariant[] = [
  ({ title, theme }) => {
    const accentText = theme.mode === 'light' ? 'text-slate-600' : 'text-slate-300';
    const strongText = theme.mode === 'light' ? 'text-slate-900' : 'text-white';
    return `
      <div class="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        <div class="flex flex-col md:flex-row items-center justify-between gap-6 ${theme.footerTextClass}">
          <div>
            <p class="${accentText} text-sm mb-1">Crafted with care</p>
            <h3 class="${strongText} text-xl font-semibold">${title}</h3>
            <p class="${accentText} text-sm mt-2">Design direction, storytelling, and responsive code merged into one streamlined concept.</p>
          </div>
          <div class="flex items-center gap-4 text-sm">
            <a href="mailto:hello@${title.replace(/\s+/g, '').toLowerCase()}.com" class="hover:text-indigo-400 transition">Email</a>
            <span class="opacity-40">•</span>
            <a href="privacy-policy.html" class="hover:text-indigo-400 transition">Privacy</a>
            <span class="opacity-40">•</span>
            <a href="#contact" class="hover:text-indigo-400 transition">Contact</a>
          </div>
        </div>
      </div>`;
  },
  ({ title, theme, legalLinks }) => {
    const borderClass = theme.mode === 'light' ? 'border-slate-200/80 bg-white' : 'border-white/10 bg-white/5 backdrop-blur';
    const accentButton = theme.mode === 'light'
      ? 'bg-sky-600 hover:bg-sky-500 text-white'
      : 'bg-sky-500/90 hover:bg-sky-400 text-slate-900';
    const essentialLinks = [
      ...legalLinks,
      { label: 'Contact', href: 'index.html#contact' },
    ];
    return `
      <div class="max-w-6xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div class="rounded-3xl border ${borderClass} flex flex-col md:flex-row items-stretch gap-8 p-8 ${theme.footerTextClass}">
          <div class="flex-1 flex flex-col gap-3">
            <h3 class="text-2xl font-semibold">Stay in the loop</h3>
            <p class="text-sm opacity-80">Monthly highlights, release notes, and responsible gaming updates. ${title} keeps it concise.</p>
            <form class="mt-2 flex flex-col sm:flex-row gap-3" onsubmit="return false;">
              <input type="email" required placeholder="name@example.com" class="flex-1 rounded-lg border border-slate-300/40 bg-transparent px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400/60" />
              <button class="${accentButton} px-5 py-2 rounded-lg text-sm font-semibold shadow-sm transition">Subscribe</button>
            </form>
          </div>
          ${essentialLinks.length ? `
          <div class="md:w-72 flex flex-col gap-2 text-sm">
            <span class="text-xs uppercase tracking-wide opacity-70">Essential links</span>
            ${essentialLinks.map(link => `<a href="${link.href}" class="hover:text-sky-400 transition">${link.label}</a>`).join('\n')}
          </div>` : ''}
        </div>
        <p class="${theme.footerTextClass} text-xs text-center mt-6">&copy; ${new Date().getFullYear()} ${title}. Crafted concepts, not production builds.</p>
      </div>`;
  },
  ({ title, theme, legalLinks }) => {
    const accentBorder = theme.mode === 'light' ? 'border-indigo-200' : 'border-indigo-500/60';
    const badgeClass = theme.mode === 'light' ? 'bg-indigo-100 text-indigo-600' : 'bg-indigo-500/20 text-indigo-200';
    const textMuted = theme.mode === 'light' ? 'text-slate-600' : 'text-slate-300';
    const policyHighlight = legalLinks.find(link => link.href.includes('privacy'));
    return `
      <div class="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8 ${theme.footerTextClass}">
        <div class="grid md:grid-cols-3 gap-8">
          <div>
            <span class="inline-flex px-3 py-1 rounded-full text-xs font-medium ${badgeClass}">Design Studio Prototype</span>
            <h3 class="text-xl font-semibold mt-4">${title}</h3>
            <p class="${textMuted} text-sm mt-2">This vision concept showcases tone of voice, motion cues, and structural hierarchy tailored for the brand.</p>
          </div>
          <div class="md:col-span-2 grid sm:grid-cols-2 gap-6">
            <div class="rounded-2xl border ${accentBorder} p-5">
              <h4 class="font-semibold mb-2">Ready to iterate?</h4>
              <p class="${textMuted} text-sm">Request bespoke sections, animations, or CMS-ready handover from the studio team.</p>
            </div>
            ${policyHighlight ? `
            <div class="rounded-2xl border ${accentBorder} p-5">
              <h4 class="font-semibold mb-2">Need policy details?</h4>
              <p class="${textMuted} text-sm">Our privacy stance is transparent and human-readable. <a href="${policyHighlight.href}" class="hover:text-indigo-300">${policyHighlight.label}</a>.</p>
            </div>` : ''}
          </div>
        </div>
      </div>`;
  },
];

function renderFooterLegal(theme: BrandingTheme, legalLinks: FooterLink[]): string {
  if (!legalLinks.length) {
    return '';
  }
  const borderClass = theme.mode === 'light' ? 'border-slate-200/70' : 'border-white/10';
  const linkClass = theme.mode === 'light' ? 'text-slate-600 hover:text-slate-900' : 'text-slate-300 hover:text-white';
  const dividerClass = theme.mode === 'light' ? 'text-slate-400/70' : 'text-white/20';
  const textClass = theme.mode === 'light' ? 'text-slate-500' : 'text-slate-300/90';
  return `
    <div class="mt-8 border-t ${borderClass} pt-6">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between ${theme.footerTextClass}">
        <p class="text-xs leading-relaxed ${textClass}">
          This is a social gaming platform intended for an adult audience (18+) for amusement purposes only. The games do not offer "real money gambling" or an opportunity to win real money or prizes. Practice or success at social casino gaming does not imply future success at "real money gambling."
        </p>
        <div class="flex items-center gap-3 text-xs">
          ${legalLinks.map((link, index) => {
            const divider = index < legalLinks.length - 1 ? `<span class="${dividerClass}">•</span>` : '';
            return `<a href="${link.href}" class="${linkClass}">${link.label}</a>${divider}`;
          }).join('')}
        </div>
      </div>
    </div>`;
}

function renderFooter(title: string, theme: BrandingTheme, options: { legalLinks?: FooterLink[] } = {}): string {
  const legalLinks = options.legalLinks ?? [];
  const variant = randomChoice(footerVariants);
  return `
    <footer class="${theme.footerClass}">
      ${variant({ title, theme, legalLinks })}
      ${renderFooterLegal(theme, legalLinks)}
    </footer>
  `;
}

type CookieBannerVariant = {
  id: string;
  wrapperClass: string;
  iconClass: string;
  icon: string;
  text: string;
};

const cookieBannerVariants: CookieBannerVariant[] = [
  {
    id: 'classic',
    wrapperClass: 'max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4',
    iconClass: 'text-amber-300 bg-white/10 border border-white/20',
    icon: 'fa-solid fa-cookie-bite',
    text: 'We use cookies to personalize content and remember your preferences. Accepting means you agree to tasty improvements.',
  },
  {
    id: 'minimal',
    wrapperClass: 'max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3',
    iconClass: 'text-indigo-300 bg-indigo-950/40 border border-indigo-400/30',
    icon: 'fa-solid fa-mug-hot',
    text: 'Cookies keep the experience warm and smooth. We only use the essentials.',
  },
  {
    id: 'playful',
    wrapperClass: 'max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4',
    iconClass: 'text-pink-300 bg-pink-900/30 border border-pink-400/30 animate-pulse',
    icon: 'fa-solid fa-ice-cream',
    text: 'A sprinkle of cookies powers animations, stats, and saved settings. Consent keeps the magic sweet.',
  },
  {
    id: 'serious',
    wrapperClass: 'max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4',
    iconClass: 'text-emerald-300 bg-emerald-900/30 border border-emerald-400/30',
    icon: 'fa-solid fa-shield-halved',
    text: 'We rely on cookies for secure sessions and analytics. Approve to help us guard your experience.',
  },
];

function pickCookieBannerVariant(): CookieBannerVariant {
  if (!cookieBannerVariants.length) {
    return {
      id: 'fallback',
      wrapperClass: 'max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4',
      iconClass: 'text-amber-300 bg-white/10 border border-white/20',
      icon: 'fa-solid fa-cookie-bite',
      text: 'We use cookies to enhance your experience. By accepting, you agree to our use of cookies.',
    };
  }
  const index = Math.floor(Math.random() * cookieBannerVariants.length);
  return cookieBannerVariants[index];
}

function renderCookieBanner(theme: BrandingTheme): string {
  const variant = pickCookieBannerVariant();
  return `
    <div id="cookie-banner" class="${theme.cookieBannerClass}" data-variant="${variant.id}">
      <div class="${variant.wrapperClass}">
        <div class="flex items-center gap-3 text-sm sm:text-base ${theme.cookieTextClass}">
          <span class="inline-flex h-10 w-10 items-center justify-center rounded-full ${variant.iconClass}" aria-hidden="true">
            <i class="fa-solid fa-cookie-bite"></i>
          </span>
          <p>${variant.text}</p>
        </div>
        <div class="flex items-center gap-3">
          <button id="accept-cookies" class="${theme.cookieButtonClass}">Accept</button>
          <a href="privacy-policy.html" class="text-xs sm:text-sm hover:text-white/80">Cookie policy</a>
        </div>
      </div>
    </div>
  `;
}

// Цей шаблон залишається без змін, він головний
export const getIndexHtmlTemplate = (
  title: string,
  allSectionsHtml: string,
  websiteTypes: string[] = [],
  sectionAnchors: SectionNavItem[] = [],
  theme?: BrandingTheme,
  brandVisual?: BrandVisual,
  faviconPath?: string,
  includeHeader: boolean = true,
  includeFooter: boolean = true,
  logoAssetPath?: string,
  sectionShape: string = 'soft',
  options: { includeLegalNav?: boolean; legalLinks?: FooterLink[] } = {},
) => {
  const appliedTheme = resolveTheme(theme);
  const brandGlyph = resolveBrandVisual(brandVisual);
  const hasGame = isGameContext(websiteTypes);
  const fontHref = resolveFontHref(websiteTypes);
  const faviconTag = faviconPath
    ? `<link rel="icon" type="image/png" href="${faviconPath}">`
    : '';
  const includeLegalNav = options.includeLegalNav ?? true;
  const legalLinks = options.legalLinks ?? [];
  return `
<!DOCTYPE html>
<html lang="en" class="scroll-smooth">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="${fontHref}" rel="stylesheet">
    <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" integrity="sha512-SnH5WK+bZxgPHs44uWIX+LLJAJ9/2PkPKZ5QiAj6Ta86w+fsb2TkcmfRyVX3pBnMFcV7oQPJkl9QevSCWr3W6A==" crossorigin="anonymous" referrerpolicy="no-referrer" />
    <link rel="stylesheet" href="https://unpkg.com/@phosphor-icons/web@2.1.1/src/regular/style.css">
    <link rel="stylesheet" href="styles/style.css">
    ${faviconTag}
    <style>
      ${appliedTheme.styleBlock}
    </style>
</head>
<body class="${appliedTheme.bodyClass}" data-theme-mode="${appliedTheme.mode}" data-theme-id="${appliedTheme.id}" data-has-game="${hasGame ? 'true' : 'false'}" data-page="index" data-section-shape="${sectionShape}">
    ${includeHeader ? renderHeader(title, appliedTheme, websiteTypes, brandGlyph, 'index', sectionAnchors, logoAssetPath, { includeLegalFallback: includeLegalNav }) : ''}

    <main class="${includeHeader ? 'pt-16' : ''}">
        ${allSectionsHtml}
    </main>

    ${includeFooter ? renderFooter(title, appliedTheme, { legalLinks }) : ''}

    ${renderCookieBanner(appliedTheme)}
    <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/ScrollTrigger.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/@studio-freight/lenis@1.0.6/bundled/lenis.min.js"></script>
    <script src="scripts/main.js"></script>
</body>
</html>
`;
};

// Оновлено: шаблон для ігрової сторінки
type GamePageVariant = {
  badge?: string;
  subtitle?: string;
  bulletList?: string[];
  ctaLabel: string;
  ctaIcon?: string;
  supportNote?: string;
};

const gamePageVariants: GamePageVariant[] = [
  {
    badge: 'Live Demo Access',
    subtitle: 'Preview the interactive lobby with adaptive controls before the full build ships.',
    bulletList: ['Instant load, zero plugins', 'Touch-friendly controls', 'Analytics-ready events'],
    ctaLabel: 'Launch Fullscreen',
    ctaIcon: 'fa-solid fa-expand',
    supportNote: 'Need additional skins or localized assets? Mention it in the handoff notes.',
  },
  {
    badge: 'Playable Concept',
    subtitle: 'This sandbox simulates core mechanics, transitions, and monetization hooks.',
    bulletList: ['Audio-ready environment', 'Supports keyboard + gamepad', 'Built for rapid iteration'],
    ctaLabel: 'Play Immersive Mode',
    ctaIcon: 'fa-solid fa-vr-cardboard',
    supportNote: 'Hook the iframe into your analytics stack or wrap it as a PWA for quick demos.',
  },
  {
    badge: 'Experience Preview',
    subtitle: 'See the cinematic entry, interactive HUD, and responsible play overlays in action.',
    bulletList: ['Particle-rich transitions', 'Session-safe overlays', 'Configurable bonus timers'],
    ctaLabel: 'Enter Demo Arena',
    ctaIcon: 'fa-solid fa-play-circle',
  },
];

type PolicyVariant = {
  heroTitle: string;
  heroCopy: string;
  highlightTitle: string;
  highlightCopy: string;
};

const policyVariants: PolicyVariant[] = [
  {
    heroTitle: 'Privacy without the maze',
    heroCopy: 'This document is structured for humans, legal teams, and regulators alike. Scan, audit, and share with confidence.',
    highlightTitle: 'Versioned & transparent',
    highlightCopy: 'We tag each revision with a timestamp, changelog, and point of contact so compliance stays stress-free.',
  },
  {
    heroTitle: 'Data respect is the default',
    heroCopy: 'Every tracking event and cookie has a purpose, documented here. Nothing hides in the fine print.',
    highlightTitle: 'Your control panel',
    highlightCopy: 'Download, delete, or export your data with a single request. We respond within two business days.',
  },
  {
    heroTitle: 'Trust scales with clarity',
    heroCopy: 'Plain-language sections outline how we collect, store, and safeguard information across platforms.',
    highlightTitle: 'Security first',
    highlightCopy: 'SOC2-aligned processes, rotating keys, and continuous monitoring keep your data protected.',
  },
];

export const getGamePageTemplate = (
  title: string,
  gamePageTitle: string,
  gameIframePath: string,
  disclaimerHtml: string,
  sectionAnchors: SectionNavItem[] = [],
  theme?: BrandingTheme,
  brandVisual?: BrandVisual,
  websiteTypes: string[] = [],
  faviconPath?: string,
  includeHeader: boolean = true,
  includeFooter: boolean = true,
  logoAssetPath?: string,
  sectionShape: string = 'soft',
  options: { includeLegalNav?: boolean; legalLinks?: FooterLink[] } = {},
) => {
  const appliedTheme = resolveTheme(theme);
  const brandGlyph = resolveBrandVisual(brandVisual);
  const fontHref = resolveFontHref(websiteTypes);
  const faviconTag = faviconPath
    ? `<link rel="icon" type="image/png" href="${faviconPath}">`
    : '';
  const includeLegalNav = options.includeLegalNav ?? true;
  const legalLinks = options.legalLinks ?? [];
  const variant = randomChoice(gamePageVariants);
  const headingClass = appliedTheme.mode === 'light' ? 'text-[#1f2440]' : 'text-white';
  const textClass = appliedTheme.mode === 'light' ? 'text-[#3b456a]' : 'text-gray-200/90';
  const frameWrapperClass = appliedTheme.mode === 'light'
    ? 'w-full max-w-5xl aspect-video bg-white/90 rounded-2xl shadow-[0_20px_50px_rgba(120,130,255,0.25)] border border-[#dbe2ff]'
    : 'w-full max-w-5xl aspect-video bg-black/70 rounded-2xl shadow-[0_32px_60px_rgba(30,10,90,0.55)] border border-white/10';
  const disclaimerBoxClass = appliedTheme.mode === 'light'
    ? 'mt-8 w-full max-w-5xl rounded-2xl border border-[#dbe2ff] bg-white/95 p-6 shadow-[0_16px_40px_rgba(115,120,255,0.15)]'
    : 'mt-8 w-full max-w-5xl rounded-2xl border border-white/10 bg-white/5 p-6 shadow-[0_24px_50px_rgba(10,5,40,0.6)] backdrop-blur';
  const backButtonClass = appliedTheme.mode === 'light'
    ? 'inline-flex items-center gap-2 rounded-xl bg-white text-[#1f2440] px-4 py-2 text-sm font-semibold shadow hover:bg-white/90 transition'
    : 'inline-flex items-center gap-2 rounded-xl bg-white/10 text-white px-4 py-2 text-sm font-semibold hover:bg-white/15 transition';
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${gamePageTitle} - ${title}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="${fontHref}" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" />
    <link rel="stylesheet" href="https://unpkg.com/@phosphor-icons/web@2.1.1/src/regular/style.css">
    <link rel="stylesheet" href="styles/style.css">
    ${faviconTag}
    <style>
      ${appliedTheme.styleBlock}
    </style>
</head>
<body class="${appliedTheme.bodyClass}" data-theme-mode="${appliedTheme.mode}" data-theme-id="${appliedTheme.id}" data-has-game="true" data-page="game" data-section-shape="${sectionShape}">
    ${includeHeader ? renderHeader(title, appliedTheme, websiteTypes, brandGlyph, 'game', sectionAnchors, logoAssetPath, { includeLegalFallback: includeLegalNav }) : ''}

    <main class="flex-grow flex flex-col items-center justify-center p-4">
        <div class="flex flex-col items-center gap-2 mb-2">
          ${variant.badge ? `<span class="px-4 py-1 rounded-full text-xs font-semibold bg-white/10 border border-white/10 uppercase tracking-wide">${variant.badge}</span>` : ''}
          <h1 class="${headingClass} text-3xl md:text-5xl font-bold text-center">${gamePageTitle}</h1>
        </div>
        ${variant.subtitle ? `<p class="${textClass} text-center max-w-2xl text-sm md:text-base mb-6">${variant.subtitle}</p>` : ''}
        <div class="${frameWrapperClass}">
            <iframe src="${gameIframePath}" frameborder="0" class="w-full h-full rounded-[18px]"></iframe>
        </div>
        <div class="${disclaimerBoxClass} ${textClass}">
            ${disclaimerHtml}
        </div>
        ${variant.bulletList ? `
          <ul class="mt-6 grid sm:grid-cols-3 gap-3 w-full max-w-5xl text-sm ${textClass}">
            ${variant.bulletList.map((item) => `<li class="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 flex gap-2 items-start"><i class="fa-solid fa-sparkles mt-1 opacity-70"></i><span>${item}</span></li>`).join('')}
          </ul>
        ` : ''}
        <div class="mt-6">
          <a href="index.html" class="${backButtonClass}"><i class="fa-solid fa-arrow-left"></i> Back to Home</a>
        </div>
        <div class="mt-6 flex flex-col sm:flex-row gap-3">
          <a href="${gameIframePath}" target="_blank" class="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-500/20 text-sm font-semibold hover:bg-indigo-500/30 transition text-white"><i class="${variant.ctaIcon || 'fa-solid fa-play'}"></i>${variant.ctaLabel}</a>
          ${variant.supportNote ? `<span class="${textClass} text-xs max-w-sm">${variant.supportNote}</span>` : ''}
        </div>
    </main>

    ${includeFooter ? renderFooter(title, appliedTheme, { legalLinks }) : ''}

    ${renderCookieBanner(appliedTheme)}
    <script src="https://cdn.jsdelivr.net/npm/@studio-freight/lenis@1.0.6/bundled/lenis.min.js"></script>
    <script src="scripts/main.js"></script>
</body>
</html>
`;
};

// Оновлено: шаблон для сторінки політики
export const getPrivacyPolicyTemplate = (
  title: string,
  domain: string,
  policyContentHtml: string,
  sectionAnchors: SectionNavItem[] = [],
  theme?: BrandingTheme,
  brandVisual?: BrandVisual,
  websiteTypes: string[] = [],
  faviconPath?: string,
  includeHeader: boolean = true,
  includeFooter: boolean = true,
  logoAssetPath?: string,
  sectionShape: string = 'soft',
  options: { includeLegalNav?: boolean; legalLinks?: FooterLink[] } = {},
) => {
  const contactEmail = `contact@${domain}`;
  const policyVariant = randomChoice(policyVariants);
  const menuItems = Array.from(policyContentHtml.matchAll(/<h2 id="([^"]+)"[^>]*>(.*?)<\/h2>/g))
    .map(match => ({ id: match[1], title: match[2] }));
  const appliedTheme = resolveTheme(theme);
  const brandGlyph = resolveBrandVisual(brandVisual);
  const fontHref = resolveFontHref(websiteTypes);
  const hasGame = websiteTypes.includes('Game');
  const faviconTag = faviconPath
    ? `<link rel="icon" type="image/png" href="${faviconPath}">`
    : '';
  const headingClass = appliedTheme.mode === 'light' ? 'text-[#1f2440]' : 'text-white';
  const subheadingClass = appliedTheme.mode === 'light' ? 'text-[#384063]' : 'text-white';
  const proseClass = appliedTheme.mode === 'light'
    ? 'prose prose-slate lg:prose-lg max-w-none'
    : 'prose prose-invert lg:prose-lg max-w-none';
  const sidebarTitleClass = appliedTheme.mode === 'light' ? 'font-bold text-[#1f2440] mb-4' : 'font-bold text-white mb-4';
  const sidebarLinkClass = appliedTheme.mode === 'light'
    ? 'block text-[#566094] hover:text-[#1f2440] transition-colors duration-200'
    : 'block text-gray-400 hover:text-indigo-400 transition-colors duration-200';
  const contactLinkClass = appliedTheme.mode === 'light'
    ? 'text-[#3a4fff] font-semibold hover:text-[#1f2440]'
    : 'text-indigo-400 font-semibold hover:text-white';
  const sidebarWrapperClass = appliedTheme.mode === 'light'
    ? 'sticky top-24 rounded-2xl border border-[#dbe2ff] bg-white/90 p-6 shadow-[0_14px_36px_rgba(120,130,255,0.15)]'
    : 'sticky top-24 rounded-2xl border border-white/10 bg-white/5 p-6 shadow-[0_22px_45px_rgba(10,5,40,0.55)] backdrop-blur';
  const includeLegalNav = options.includeLegalNav ?? true;
  const legalLinks = options.legalLinks ?? [];
  return `
<!DOCTYPE html>
<html lang="en" class="scroll-smooth">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Privacy Policy - ${title}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="${fontHref}" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" integrity="sha512-SnH5WK+bZxgPHs44uWIX+LLJAJ9/2PkPKZ5QiAj6Ta86w+fsb2TkcmfRyVX3pBnMFcV7oQPJkl9QevSCWr3W6A==" crossorigin="anonymous" referrerpolicy="no-referrer" />
    <link rel="stylesheet" href="https://unpkg.com/@phosphor-icons/web@2.1.1/src/regular/style.css">
    <link rel="stylesheet" href="styles/style.css">
    ${faviconTag}
    <style>
      ${appliedTheme.styleBlock}
    </style>
</head>
<body class="${appliedTheme.bodyClass}" data-theme-mode="${appliedTheme.mode}" data-theme-id="${appliedTheme.id}" data-has-game="${hasGame ? 'true' : 'false'}" data-page="policy" data-section-shape="${sectionShape}">
    ${renderHeader(title, appliedTheme, websiteTypes, brandGlyph, 'policy', sectionAnchors, logoAssetPath, { includeLegalFallback: includeLegalNav })}

    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <section class="rounded-3xl border border-white/10 bg-white/5 backdrop-blur mb-12 p-8 ${appliedTheme.mode === 'light' ? 'bg-white shadow-[0_24px_45px_rgba(90,110,255,0.18)] text-slate-700' : 'text-slate-100'}">
          <div class="flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between">
            <div class="max-w-2xl">
              <h1 class="text-3xl sm:text-4xl font-bold mb-3">${policyVariant.heroTitle}</h1>
              <p class="text-sm sm:text-base opacity-80">${policyVariant.heroCopy}</p>
            </div>
            <div class="rounded-2xl border border-indigo-400/20 bg-indigo-500/10 px-5 py-4 text-sm max-w-sm">
              <h2 class="font-semibold mb-1">${policyVariant.highlightTitle}</h2>
              <p class="opacity-90">${policyVariant.highlightCopy}</p>
            </div>
          </div>
        </section>
        <div class="grid grid-cols-1 md:grid-cols-4 gap-12">
            <main class="md:col-span-3 ${proseClass}">
                <h1 class="${headingClass} text-4xl sm:text-5xl font-extrabold !mb-8">Privacy Policy</h1>
                ${policyContentHtml}
                <section id="contact-us">
                  <h2 id="contact" class="${subheadingClass} text-3xl font-bold !mt-12 !mb-4">Contact Us</h2>
                  <p>If you have any questions about this Privacy Policy, please contact us at:
                  <a href="mailto:${contactEmail}" class="${contactLinkClass}">${contactEmail}</a></p>
                </section>
            </main>
            <aside class="md:col-span-1">
                <div class="${sidebarWrapperClass}">
                    <h3 class="${sidebarTitleClass}">On this page</h3>
                    <nav id="policy-nav">
                        <ul class="space-y-2">
                            ${menuItems.map(item => `<li><a href="#${item.id}" class="${sidebarLinkClass}" data-nav-link="${item.id}">${item.title}</a></li>`).join('\n')}
                            <li><a href="#contact" class="${sidebarLinkClass}" data-nav-link="contact">Contact Us</a></li>
                        </ul>
                    </nav>
                </div>
            </aside>
        </div>
    </div>

    ${includeFooter ? renderFooter(title, appliedTheme, { legalLinks }) : ''}

    ${renderCookieBanner(appliedTheme)}
    <script src="https://cdn.jsdelivr.net/npm/@studio-freight/lenis@1.0.6/bundled/lenis.min.js"></script>
    <script src="scripts/main.js"></script>
</body>
</html>`;
};

// ... (mainJsTemplate та stylesCssTemplate залишаються без змін) ...
export const mainJsTemplate = `
document.addEventListener('DOMContentLoaded', function () {
    const isEmbedded = (() => {
        try {
            return window.self !== window.top;
        } catch (error) {
            return true;
        }
    })();
    if (!isEmbedded && window.Lenis) {
        const lenis = new window.Lenis({
            lerp: 0.08,
            smoothWheel: true,
            wheelMultiplier: 1.05,
        });
        function raf(time) {
            lenis.raf(time);
            requestAnimationFrame(raf);
        }
        requestAnimationFrame(raf);
    } else {
        document.body.dataset.smoothScroll = 'native';
    }
    // --- Mobile Menu Logic ---
    const burgerMenu = document.getElementById('burger-menu');
    const burgerIcon = document.getElementById('burger-icon');
    const mobileNav = document.getElementById('mobile-nav');
    if (burgerMenu && mobileNav) {
        let iconContainer = burgerIcon;
        if (!iconContainer) {
            iconContainer = document.createElement('span');
            iconContainer.id = 'burger-icon';
            iconContainer.className = 'burger-icon';
            burgerMenu.appendChild(iconContainer);
        }
        if (iconContainer.children.length === 0) {
            for (let i = 0; i < 3; i++) {
                const line = document.createElement('span');
                line.className = 'burger-line';
                iconContainer.appendChild(line);
            }
        }

        const orientations = ['top', 'right', 'left'];
        const pickedOrientation = orientations[Math.floor(Math.random() * orientations.length)];
        mobileNav.classList.add('mobile-nav-orientation-' + pickedOrientation);

        const ensureClosed = () => {
            mobileNav.classList.remove('mobile-nav-visible');
            if (!mobileNav.classList.contains('mobile-nav-hidden')) {
                mobileNav.classList.add('mobile-nav-hidden');
            }
            iconContainer.classList.remove('is-open');
            document.body.classList.remove('overflow-hidden');
            burgerMenu.setAttribute('aria-expanded', 'false');
        };

        ensureClosed();

        const toggleMenu = () => {
            const isNavOpen = mobileNav.classList.contains('mobile-nav-visible');
            if (isNavOpen) {
                ensureClosed();
            } else {
                mobileNav.classList.add('mobile-nav-visible');
                mobileNav.classList.remove('mobile-nav-hidden');
                iconContainer.classList.add('is-open');
                document.body.classList.add('overflow-hidden');
                burgerMenu.setAttribute('aria-expanded', 'true');
            }
        };

        burgerMenu.addEventListener('click', (event) => {
            event.preventDefault();
            toggleMenu();
        });

        mobileNav.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                ensureClosed();
            });
        });
    }

    // --- Cookie Banner Logic ---
    const cookieBanner = document.getElementById('cookie-banner');
    const acceptCookiesBtn = document.getElementById('accept-cookies');
    if (cookieBanner && acceptCookiesBtn) {
        const cookieName = 'user_has_accepted_cookies';
        const hideBanner = () => {
            cookieBanner.style.transform = 'translateY(100%)';
            cookieBanner.style.pointerEvents = 'none';
            setTimeout(() => { cookieBanner.style.display = 'none'; }, 400);
        };
        if (!localStorage.getItem(cookieName)) {
            setTimeout(() => {
                cookieBanner.style.transform = 'translateY(0)';
            }, 500);
        } else {
            hideBanner();
        }
        acceptCookiesBtn.addEventListener('click', () => {
            localStorage.setItem(cookieName, 'true');
            hideBanner();
        }, { once: true });
    }

    // --- Auto-wire game CTAs ---
    const hasGame = document.body.dataset.hasGame === 'true';
    const currentPage = document.body.dataset.page || '';
    if (hasGame && currentPage === 'index') {
        const keywordMatch = (text) => {
            if (!text) return false;
            const lower = text.toLowerCase();
            return ['play', 'demo', 'spin', 'start', 'launch', 'free'].some((token) => lower.includes(token));
        };
        const looksLikeButton = (el) => {
            const rawClass = el && typeof el.className === 'object' && el.className && 'baseVal' in el.className
                ? el.className.baseVal
                : (el.className || '');
            const className = rawClass.toString().toLowerCase();
            const role = (el.getAttribute && el.getAttribute('role')) || '';
            if (role === 'button') return true;
            return ['btn', 'button', 'cta', 'pill', 'primary'].some((token) => className.includes(token));
        };
        const shouldSkipAnchor = (anchor) => {
            if (!anchor) return true;
            if (anchor.dataset.skipGame === 'true') return true;
            const href = anchor.getAttribute('href') || '';
            if (!href) return false;
            if (href.startsWith('#')) return true;
            const lowered = href.toLowerCase();
            if (lowered.includes('privacy') || lowered.includes('terms') || lowered.includes('policy') || lowered.includes('responsible')) return true;
            if (lowered.startsWith('mailto:') || lowered.startsWith('tel:')) return true;
            if (anchor.hasAttribute('download')) return true;
            if (anchor.closest('nav')) return true;
            return false;
        };

        document.querySelectorAll('a').forEach((anchor) => {
            if (shouldSkipAnchor(anchor)) return;
            if (!looksLikeButton(anchor) && !keywordMatch(anchor.textContent)) return;
            anchor.href = 'game.html';
            anchor.target = '_self';
            anchor.dataset.gameCta = 'true';
            anchor.addEventListener('click', (event) => {
                event.preventDefault();
                window.location.href = 'game.html';
            });
        });

        const shouldSkipButton = (button) => {
            if (!button) return true;
            if (button.dataset.skipGame === 'true') return true;
            if (button.id === 'accept-cookies') return true;
            if (button.id === 'burger-menu') return true;
            if (button.closest('#cookie-banner')) return true;
            return false;
        };

        document.querySelectorAll('button').forEach((button) => {
            if (shouldSkipButton(button)) return;
            button.dataset.gameCta = 'true';
            button.addEventListener('click', (event) => {
                event.preventDefault();
                window.location.href = 'game.html';
            });
        });
    }

    // --- Smooth Scroll for Anchor Links ---
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href.length > 1) {
                e.preventDefault();
                const targetElement = document.querySelector(href);
                if (targetElement) {
                    targetElement.scrollIntoView({ behavior: 'smooth' });
                }
            }
        });
    });

    // --- Header Shadow on Scroll ---
    const header = document.getElementById('header');
    if (header) {
        window.addEventListener('scroll', () => {
            header.classList.toggle('shadow-lg', window.scrollY > 10);
        });
    }
    
    // --- Logic for Policy Page Navigation ---
    const policyNav = document.getElementById('policy-nav');
    if (policyNav) {
        const navLinks = policyNav.querySelectorAll('a[data-nav-link]');
        const sections = Array.from(navLinks).map(link => {
            const id = link.getAttribute('data-nav-link');
            return document.getElementById(id);
        }).filter(Boolean);
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const id = entry.target.getAttribute('id');
                    const navLink = policyNav.querySelector(\`a[data-nav-link="\${id}"]\`);
                    navLinks.forEach(link => link.classList.remove('text-indigo-400', 'font-bold'));
                    if (navLink) {
                        navLink.classList.add('text-indigo-400', 'font-bold');
                    }
                }
            });
        }, { rootMargin: '-40% 0px -60% 0px', threshold: 0 });
        sections.forEach(section => {
            if (section) observer.observe(section);
        });
    }
});
`;

export const stylesCssTemplate = `
:root {
    --body-font: 'Inter', 'Segoe UI', sans-serif;
    --heading-font: 'Space Grotesk', 'Inter', sans-serif;
    --accent-font: 'Space Grotesk', 'Inter', sans-serif;
    --hero-glow: 0 24px 60px rgba(59, 130, 246, 0.28);
    --headline-highlight-color: #0f172a;
    --headline-highlight-background: linear-gradient(120deg, rgba(59, 130, 246, 0.22), rgba(14, 165, 233, 0.18));
    --headline-highlight-glow: rgba(14, 165, 233, 0.45);
    --headline-highlight-shadow: 0 12px 30px rgba(59, 130, 246, 0.25);
    --section-radius: 0.75rem;
    --section-radius-mobile: calc(var(--section-radius) * 0.9);
    --section-image-radius: calc(var(--section-radius) - 0.3rem);
    --section-padding-y: clamp(2rem, 5vw, 3.75rem);
    --section-padding-x: clamp(1.5rem, 4vw, 3rem);
    --section-padding-mobile-y: clamp(1.4rem, 5.5vw, 2.15rem);
    --section-padding-mobile-x: clamp(1rem, 4.5vw, 1.65rem);
    --section-blur: 14px;
    --section-border-width: 1px;
    --section-shadow: 0 16px 36px rgba(8, 12, 24, 0.2);
    --btn-radius: 0.75rem;
    --btn-primary-bg: #2563eb;
    --btn-primary-hover: #1d4ed8;
    --btn-primary-color: #f8fafc;
    --btn-primary-shadow: 0 12px 24px rgba(37, 99, 235, 0.2);
    --btn-secondary-bg: rgba(148, 163, 184, 0.12);
    --btn-secondary-hover: rgba(148, 163, 184, 0.22);
    --btn-secondary-color: #1f2937;
    --btn-secondary-border: rgba(148, 163, 184, 0.4);
    --icon-surface: rgba(37, 99, 235, 0.08);
    --icon-border: rgba(37, 99, 235, 0.2);
    --icon-color: #1f2937;
}

body {
    font-family: var(--body-font, 'Inter', sans-serif);
}

section.generated-section.shape-flat {
    --section-radius: 0rem;
    --section-radius-mobile: 0rem;
    --section-image-radius: 0rem;
    --section-shadow: 0 14px 32px rgba(7, 12, 24, 0.18);
    --btn-radius: 0.4rem;
}

section.generated-section.shape-soft {
    --section-radius: clamp(1.6rem, 3.5vw, 2.6rem);
    --section-radius-mobile: calc(var(--section-radius) * 0.7);
    --section-image-radius: calc(var(--section-radius) - 0.6rem);
    --section-padding-y: clamp(2.4rem, 5.8vw, 4.2rem);
    --section-shadow: 0 24px 58px rgba(7, 12, 28, 0.32);
    --btn-radius: 1.65rem;
}

section.generated-section.shape-sleek {
    --section-radius: clamp(1.2rem, 3vw, 2.1rem);
    --section-radius-mobile: calc(var(--section-radius) * 0.75);
    --section-image-radius: calc(var(--section-radius) - 0.45rem);
    --section-shadow: 0 22px 52px rgba(6, 10, 26, 0.3);
    --btn-radius: 1.1rem;
}

section.generated-section.shape-angular {
    --section-radius: 0rem;
    --section-radius-mobile: 0rem;
    --section-image-radius: 0rem;
    --section-padding-y: clamp(2rem, 4.6vw, 3.3rem);
    --section-padding-x: clamp(1.45rem, 4vw, 2.85rem);
    --section-shadow: 0 18px 42px rgba(6, 10, 24, 0.28);
    --section-border-width: 1.4px;
    --btn-radius: 0.25rem;
}

body.overflow-hidden { overflow: hidden; }
body[data-theme-mode="dark"] {
    --btn-primary-bg: #6366f1;
    --btn-primary-hover: #4f46e5;
    --btn-primary-color: #f8fafc;
    --btn-primary-shadow: 0 12px 30px rgba(99, 102, 241, 0.28);
    --btn-secondary-bg: rgba(148, 163, 184, 0.18);
    --btn-secondary-hover: rgba(148, 163, 184, 0.28);
    --btn-secondary-color: rgba(226, 232, 240, 0.96);
    --btn-secondary-border: rgba(148, 163, 184, 0.35);
    --icon-surface: rgba(148, 163, 184, 0.14);
    --icon-border: rgba(148, 163, 184, 0.18);
    --icon-color: #f8fafc;
}

body[data-theme-mode="light"] {
    --btn-primary-bg: #2563eb;
    --btn-primary-hover: #1d4ed8;
    --btn-secondary-bg: rgba(148, 163, 184, 0.12);
    --btn-secondary-hover: rgba(148, 163, 184, 0.22);
    --btn-secondary-color: #1f2937;
    --btn-secondary-border: rgba(148, 163, 184, 0.4);
    --icon-surface: rgba(37, 99, 235, 0.08);
    --icon-border: rgba(37, 99, 235, 0.18);
    --icon-color: #1f2937;
}
.mobile-nav-base {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100vh;
    z-index: 30;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4rem 1.25rem;
    opacity: 0;
    pointer-events: none;
    transform: translate3d(0,-100%,0);
    transition: opacity 0.35s ease, transform 0.45s cubic-bezier(0.22, 1, 0.36, 1);
}
.mobile-nav-visible {
    opacity: 1;
    pointer-events: auto;
    transform: translate3d(0,0,0);
}
.mobile-nav-hidden {
    opacity: 0;
    pointer-events: none;
}
.mobile-nav-orientation-top.mobile-nav-hidden { transform: translate3d(0,-100%,0); }
.mobile-nav-orientation-right.mobile-nav-hidden { transform: translate3d(100%,0,0); }
.mobile-nav-orientation-left.mobile-nav-hidden { transform: translate3d(-100%,0,0); }
.mobile-nav-orientation-right.mobile-nav-visible,
.mobile-nav-orientation-left.mobile-nav-visible,
.mobile-nav-orientation-top.mobile-nav-visible {
    transform: translate3d(0,0,0);
}
.burger-icon {
    position: relative;
    width: 1.75rem;
    height: 1.25rem;
    display: inline-flex;
    flex-direction: column;
    justify-content: space-between;
}
.burger-line {
    width: 100%;
    height: 0.2rem;
    border-radius: 9999px;
    background-color: currentColor;
    transition: transform 0.35s ease, opacity 0.3s ease, width 0.3s ease;
}
section.generated-section {
    position: relative;
    margin: clamp(1.25rem, 4vw, 3rem) auto;
    padding: var(--section-padding-y) var(--section-padding-x);
    border-radius: var(--section-radius);
    background: var(--section-surface, rgba(17, 24, 39, 0.86));
    border: var(--section-border-width, 1px) solid var(--section-border, rgba(148, 163, 184, 0.12));
    box-shadow: var(--section-shadow, 0 22px 60px rgba(8, 12, 24, 0.32));
    color: inherit;
    overflow: hidden;
    backdrop-filter: blur(var(--section-blur, 16px));
    -webkit-backdrop-filter: blur(var(--section-blur, 16px));
}
section.generated-section::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: var(--section-overlay, transparent);
    opacity: var(--section-overlay-opacity, 0);
    mix-blend-mode: var(--section-overlay-blend, normal);
    pointer-events: none;
    transition: opacity 0.35s ease;
    background-size: var(--section-overlay-size, cover);
    background-position: center;
}
section.generated-section:hover::before {
    opacity: calc(var(--section-overlay-opacity, 0) * 1.05);
}

body[data-theme-mode="dark"] section.generated-section {
    --section-surface: rgba(15, 23, 42, 0.88);
    --section-border: rgba(94, 105, 140, 0.24);
    --section-shadow: 0 24px 64px rgba(7, 12, 28, 0.45);
    color: rgba(233, 239, 255, 0.92);
}

body[data-theme-mode="light"] section.generated-section {
    --section-surface: rgba(255, 255, 255, 0.94);
    --section-border: rgba(203, 213, 225, 0.7);
    --section-shadow: 0 18px 40px rgba(148, 163, 184, 0.22);
    color: #1f2937;
}

.section-accent-aurora {
    --section-overlay: radial-gradient(circle at top left, rgba(120, 255, 214, 0.35), transparent 60%);
    --section-overlay-opacity: 1;
}

.section-accent-wave {
    --section-overlay: linear-gradient(135deg, rgba(59, 130, 246, 0.18), rgba(236, 72, 153, 0.14));
    --section-overlay-opacity: 1;
}

.section-accent-grid {
    --section-overlay: linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px),
      linear-gradient(0deg, rgba(255,255,255,0.05) 1px, transparent 1px);
    --section-overlay-opacity: 1;
    --section-overlay-blend: overlay;
    --section-overlay-size: 24px 24px;
}

.section-accent-noise {
    --section-overlay: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="1" numOctaves="4" stitchTiles="stitch"/></filter><rect width="200" height="200" filter="url(#n)" opacity="0.18"/></svg>');
    --section-overlay-opacity: 1;
}

.section-accent-lens {
    --section-overlay: radial-gradient(circle at center, rgba(255,255,255,0.18), transparent 72%);
    --section-overlay-opacity: 1;
}

body[data-theme-mode="light"] .section-accent-grid {
    --section-overlay: linear-gradient(90deg, rgba(17,24,39,0.04) 1px, transparent 1px),
      linear-gradient(0deg, rgba(17,24,39,0.04) 1px, transparent 1px);
    --section-overlay-size: 24px 24px;
}

section.generated-section :where(h1, h2, h3, h4) {
    font-family: var(--heading-font, 'Space Grotesk', 'Inter', sans-serif);
    letter-spacing: -0.015em;
    margin-bottom: 0.9em;
    background: none !important;
    -webkit-background-clip: border-box !important;
    -webkit-text-fill-color: currentColor !important;
}

section.generated-section :where(p) {
    line-height: 1.7;
    margin-bottom: 1.1em;
    opacity: 0.92;
}

body[data-theme-mode="light"] section.generated-section :where(p) {
    color: rgba(55, 65, 81, 0.9);
}

section.generated-section :where(a) {
    text-decoration: none;
}

body[data-theme-mode="dark"] section.generated-section :where(a) {
    color: #60a5fa;
}

body[data-theme-mode="light"] section.generated-section :where(a) {
    color: #2563eb;
}

section.generated-section :where(img) {
    display: block;
    width: min(520px, 100%);
    max-height: clamp(220px, 45vh, 520px);
    object-fit: cover;
    border-radius: var(--section-image-radius, calc(var(--section-radius) - 0.4rem));
    margin: clamp(1.1rem, 3.2vw, 2.35rem) auto;
    box-shadow: 0 18px 45px rgba(12, 18, 35, 0.25);
}

body[data-theme-mode="light"] section.generated-section :where(img) {
    box-shadow: 0 16px 40px rgba(148, 163, 184, 0.24);
    border: 1px solid rgba(203, 213, 225, 0.45);
}

section.generated-section :where(figure) {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
}

section.generated-section :where(figcaption) {
    font-size: 0.9rem;
    opacity: 0.7;
    max-width: min(520px, 100%);
    text-align: center;
}

.headline-kicker {
    font-family: var(--accent-font, var(--heading-font, 'Space Grotesk', 'Inter', sans-serif));
    text-transform: uppercase;
    letter-spacing: 0.22em;
    font-size: 0.72rem;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.35rem 0.75rem;
    border-radius: 999px;
    background: rgba(59, 130, 246, 0.12);
    color: rgba(59, 130, 246, 0.9);
}

.hero-headline {
    font-family: var(--heading-font, 'Space Grotesk', 'Inter', sans-serif);
    text-transform: uppercase;
    letter-spacing: 0.12em;
    text-shadow: var(--hero-glow);
    animation: heroHeadlineGlow 9s ease-in-out infinite;
}

.hero-headline span {
    display: inline-block;
}

.headline-highlight {
    position: relative;
    display: inline-flex;
    align-items: center;
    padding: 0.12em 0.35em;
    border-radius: 0.65rem;
    font-family: var(--accent-font, var(--heading-font, 'Space Grotesk', 'Inter', sans-serif));
    color: var(--headline-highlight-color, #0f172a);
    background: var(--headline-highlight-background);
    box-shadow: var(--headline-highlight-shadow, 0 12px 30px rgba(59, 130, 246, 0.25));
}

.headline-highlight::after {
    content: '';
    position: absolute;
    inset: 50% -30% -20%;
    background: var(--headline-highlight-glow);
    filter: blur(32px);
    opacity: 0.6;
    z-index: -1;
}

.headline-highlight i {
    font-size: 0.8em;
}

.hero-headline .headline-highlight {
    text-transform: none;
}

@keyframes heroHeadlineGlow {
    0%, 100% { text-shadow: var(--hero-glow); }
    45% { text-shadow: 0 18px 48px rgba(99, 102, 241, 0.35); }
}

@media (prefers-reduced-motion: reduce) {
    .hero-headline {
        animation: none;
    }
}

.icon-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 3.25rem;
    height: 3.25rem;
    border-radius: 1rem;
    background: var(--icon-surface);
    color: var(--icon-color);
    border: 1px solid var(--icon-border);
    box-shadow: 0 14px 36px rgba(15, 23, 42, 0.16);
    backdrop-filter: blur(12px);
    margin-bottom: 1rem;
}

.icon-badge i {
    font-size: 1.3rem;
    line-height: 1;
}

section.generated-section :where(i.fa-solid, i.fa-regular) {
    vertical-align: middle;
}

.btn-primary, a.btn-primary, button.btn-primary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.85rem 1.75rem;
    border-radius: var(--btn-radius, 0.75rem);
    font-weight: 600;
    font-size: 0.95rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    background: var(--btn-primary-bg);
    color: var(--btn-primary-color) !important;
    box-shadow: var(--btn-primary-shadow);
    border: none;
    transition: transform 0.25s ease, box-shadow 0.25s ease, background 0.25s ease;
    position: relative;
    overflow: hidden;
}

.btn-primary:hover {
    background: var(--btn-primary-hover);
    transform: translateY(-1px);
}

.btn-primary::after {
    content: '';
    position: absolute;
    inset: -40% -20%;
    background: linear-gradient(120deg, rgba(255, 255, 255, 0.25), transparent 55%);
    opacity: 0;
    transition: opacity 0.3s ease;
}

.btn-primary:hover::after {
    opacity: 0.6;
}

.btn-secondary, a.btn-secondary, button.btn-secondary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.8rem 1.6rem;
    border-radius: var(--btn-radius, 0.75rem);
    font-weight: 600;
    font-size: 0.9rem;
    text-transform: uppercase;
    letter-spacing: 0.075em;
    background: var(--btn-secondary-bg);
    color: var(--btn-secondary-color) !important;
    border: 1px solid var(--btn-secondary-border);
    transition: transform 0.25s ease, background 0.25s ease, border-color 0.25s ease, color 0.25s ease;
}

.btn-secondary:hover {
    background: var(--btn-secondary-hover);
    transform: translateY(-1px);
    border-color: var(--btn-secondary-border);
}

.btn-primary:focus, .btn-secondary:focus {
    outline: 2px solid rgba(99, 102, 241, 0.4);
    outline-offset: 2px;
}

@media (max-width: 768px) {
    section.generated-section {
        border-radius: var(--section-radius-mobile, calc(var(--section-radius) * 0.7));
        padding: var(--section-padding-mobile-y, 1.75rem) var(--section-padding-mobile-x, 1.35rem);
        margin: 1.25rem auto;
    }
    section.generated-section :where(img) {
        border-radius: calc(var(--section-image-radius, 1.2rem) * 0.9);
    }
}
.burger-icon.is-open .burger-line:nth-child(1) {
    transform: translateY(0.525rem) rotate(45deg);
}
.burger-icon.is-open .burger-line:nth-child(2) {
    opacity: 0;
    width: 60%;
}
.burger-icon.is-open .burger-line:nth-child(3) {
    transform: translateY(-0.525rem) rotate(-45deg);
}
.brand-badge {
    position: relative;
    color: inherit;
}
.brand-badge svg, .brand-badge img {
    position: relative;
    width: 1.65rem;
    height: 1.65rem;
    z-index: 2;
    filter: drop-shadow(0 6px 12px rgba(0,0,0,0.35));
}
.brand-icon-secondary {
    position: absolute;
    width: 1.15rem;
    height: 1.15rem;
    bottom: 0.4rem;
    right: 0.35rem;
    opacity: 0.7;
    z-index: 1;
}
.brand-initials {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    letter-spacing: 0.05em;
    opacity: 0.18;
    z-index: 0;
}
`;
const iconLibrary: Record<string, string> = {
  dice: `<rect x="3" y="3" width="18" height="18" rx="5" ry="5"></rect>
        <circle cx="9" cy="9" r="1.6"></circle>
        <circle cx="15" cy="9" r="1.6"></circle>
        <circle cx="9" cy="15" r="1.6"></circle>
        <circle cx="15" cy="15" r="1.6"></circle>`,
  chip: `<circle cx="12" cy="12" r="9"></circle>
        <circle cx="12" cy="12" r="5" fill="currentColor" opacity="0.35"></circle>
        <path d="M12 3v3M12 18v3M21 12h-3M6 12H3M18.36 5.64l-2.12 2.12M7.76 16.24l-2.12 2.12M18.36 18.36l-2.12-2.12M7.76 7.76L5.64 5.64" stroke-width="1.5" stroke="currentColor" fill="none" stroke-linecap="round"></path>`,
  crown: `<path d="M4 16l2-8 6 5 6-5 2 8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
          <path d="M4 16h16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
          <circle cx="6" cy="6" r="1"></circle>
          <circle cx="12" cy="5" r="1"></circle>
          <circle cx="18" cy="6" r="1"></circle>`,
  gamepad: `<path d="M6 16l-1.5-1.5A4 4 0 018 8h8a4 4 0 013.5 6.5L18 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
            <path d="M9.5 13h-3M8 11.5v3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
            <circle cx="15.5" cy="12.5" r="1"></circle>
            <circle cx="18" cy="11" r="1"></circle>`,
  headset: `<path d="M4 13v-1a8 8 0 0116 0v1" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
            <rect x="3" y="12" width="4" height="7" rx="1.5"></rect>
            <rect x="17" y="12" width="4" height="7" rx="1.5"></rect>
            <path d="M7 19a3 3 0 006 0" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>`,
  puzzle: `<path d="M9 3h2a2 2 0 012 2v1a1 1 0 001 1h1a2 2 0 012 2v1h-1.5a1.5 1.5 0 100 3H16v1a2 2 0 01-2 2h-1a1 1 0 00-1 1v1a2 2 0 01-2 2H9v-2.5a1.5 1.5 0 10-3 0V21H4a2 2 0 01-2-2v-2.5a1.5 1.5 0 113 0V15a2 2 0 012-2h1a1 1 0 001-1V11a2 2 0 012-2V6a3 3 0 00-3-3V3z" fill="currentColor"></path>`,
  trophy: `<path d="M8 4h8v2a4 4 0 01-4 4 4 4 0 01-4-4V4z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
           <path d="M8 4H5a2 2 0 002 3h1M16 4h3a2 2 0 01-2 3h-1" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
           <path d="M12 11v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
           <path d="M9 21h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
           <path d="M10 19h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>`,
  medal: `<circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="1.5"></circle>
          <path d="M8 12l-2 8 6-3 6 3-2-8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
          <path d="M10 2l2 4 2-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>`,
  flag: `<path d="M5 3v18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
         <path d="M6 4h10l-2 4 2 4H6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>`,
  spade: `<path d="M12 3c3 3 7 6 7 9a4 4 0 01-7 2 4 4 0 01-7-2c0-3 4-6 7-9z" fill="currentColor"></path>
          <path d="M12 14v5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
          <path d="M9.5 21h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>`,
  club: `<path d="M12 3a3 3 0 013 3 3 3 0 013 3 3 3 0 01-3 3h-1l1 4h-4l1-4h-1a3 3 0 01-3-3 3 3 0 013-3 3 3 0 013-3z" fill="currentColor"></path>
          <path d="M11 16v5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
          <path d="M9 21h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>`,
  diamond: `<path d="M12 3l7 9-7 9-7-9 7-9z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"></path>
            <path d="M5 12h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>`,
  gem: `<path d="M7 4h10l3 5-8 11-8-11 3-5z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"></path>
        <path d="M7 4l5 5 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
        <path d="M12 9v11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>`,
  spark: `<path d="M12 2l1.2 4.2L17 7l-3.2 2.3L14 13l-2-2-2 2 .2-3.7L7 7l3.8-.8L12 2z" fill="currentColor"></path>
          <path d="M5 15l1 3M19 15l-1 3M12 17l.8 2.8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>`,
  sun: `<circle cx="12" cy="12" r="4"></circle>
        <path d="M12 3v2M12 19v2M4.22 4.22l1.4 1.4M18.36 18.36l1.42 1.42M3 12h2M19 12h2M4.22 19.78l1.4-1.4M18.36 5.64l1.42-1.42" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"></path>`,
  wave: `<path d="M3 15c2 0 2.5-2 4.5-2s2.5 2 4.5 2 2.5-2 4.5-2 2.5 2 4.5 2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
         <path d="M3 11c2 0 2.5-2 4.5-2s2.5 2 4.5 2 2.5-2 4.5-2 2.5 2 4.5 2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.6"></path>`,
  palm: `<path d="M12 21v-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
          <path d="M12 15c.5-2 1.5-7-3-8 4.5-1 6 3 6 6 0-5 4-7 6-5-2 1-4 5-4 7 0-3-3-5-5-3z" fill="currentColor" fill-rule="evenodd"></path>`,
  snow: `<path d="M12 3v18M5 7l14 10M19 7L5 17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
         <path d="M9 5l3 3 3-3M9 19l3-3 3 3M5 10l3 2-3 2M19 10l-3 2 3 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>`,
  mountain: `<path d="M3 19l7-12 2 4 3-5 6 13H3z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"></path>
             <path d="M10 12l1 2 2-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>`,
  tree: `<path d="M12 3l4 5h-2l3 4h-2l3 4h-6v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
         <path d="M12 3L8 8h2l-3 4h2l-3 4h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>`,
  meteor: `<path d="M4 4l12 4-4-4 8 8-8 8-4-4 4 12-12-4 4-4-8-8 8-8z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
           <circle cx="9.5" cy="14.5" r="2.5" fill="currentColor" opacity="0.6"></circle>`,
  rocket: `<path d="M12 2c3 1.5 5 5.5 5 9v3l2 2-2 2-2-2h-6l-2 2-2-2 2-2v-3c0-3.5 2-7.5 5-9z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"></path>
           <circle cx="12" cy="9" r="2" fill="currentColor"></circle>
           <path d="M9 21l3-2 3 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>`,
  star: `<path d="M12 3l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8L12 3z" fill="currentColor"></path>`,
  shield: `<path d="M12 3l8 3v5c0 6-4 10-8 11-4-1-8-5-8-11V6l8-3z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"></path>
           <path d="M12 7v10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>`,
  flare: `<circle cx="12" cy="12" r="2.5" fill="currentColor"></circle>
          <path d="M12 4v2.5M12 17.5V20M4 12h2.5M17.5 12H20M6.5 6.5l1.8 1.8M15.7 15.7l1.8 1.8M17.5 6.5l-1.8 1.8M8.3 15.7l-1.8 1.8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>`
};

function iconToDataUri(id: string): string {
  const content = iconLibrary[id] || iconLibrary['star'];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">${content}</svg>`;
  const encoded = encodeURIComponent(svg)
    .replace(/%20/g, ' ')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29');
  return `data:image/svg+xml;utf8,${encoded}`;
}

function renderBrandIconImg(id: string, classes: string): string {
  const src = iconToDataUri(id);
  const keyAttr = ` data-icon-key="${id}"`;
  const idAttr = classes.includes('brand-icon-main') ? ' id="logo-icon"' : '';
  return `<img${idAttr} src="${src}" alt="logo icon" class="${classes}"${keyAttr} />`;
}
