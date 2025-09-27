// File: src/lib/domain.ts

export const VALID_TLD_REGEX = /^[a-z]{2,}$/i;

export function normalizeDomainInput(value?: string | null): string {
  if (!value) return '';
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*/, '')
    .replace(/[^a-z0-9.-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/\.\.+/g, '.')
    .replace(/^-+|-+$/g, '')
    .replace(/\.$/, '');
}

export function slugifyForDomain(value?: string): string {
  if (!value) return '';
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

export function extractTypes(meta?: Record<string, any> | null): string[] {
  if (!meta) return [];
  const raw = meta.types ?? meta.siteTypes ?? meta.site_types;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    return raw
      .split(/[,;]+/)
      .map((value: string) => value.trim())
      .filter(Boolean);
  }
  return [];
}

export function inferDefaultTld(types?: string[] | null): string {
  const joined = (types || []).join(' ').toLowerCase();
  if (joined.includes('sport') && joined.includes('poland')) return 'pl';
  return 'com';
}

function splitLabels(hostname: string): string[] {
  return hostname
    .split('.')
    .map((label) => label.trim())
    .filter(Boolean);
}

function sanitiseLabel(label: string): string {
  const cleaned = label
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
  return cleaned;
}

function shouldTrimDuplicateSuffix(label: string, tld: string): boolean {
  const lower = label.toLowerCase();
  if (!lower.endsWith(tld)) return false;
  const withoutTld = lower.slice(0, -tld.length);
  if (!withoutTld) return false;
  const source = label.slice(0, label.length - tld.length);
  return /[-_]/.test(source.slice(-2));
}

export function deriveDomainName(
  meta: { domain?: string | null; customDomain?: string | null; types?: string[] | null },
  fallbackSlug?: string,
  fallbackName?: string,
  overrideTld?: string
): string {
  const types = Array.isArray(meta.types) ? meta.types : [];
  const preferredTld = (overrideTld || inferDefaultTld(types)).replace(/^\./, '').toLowerCase() || 'com';
  const candidate = normalizeDomainInput(meta.domain ?? meta.customDomain ?? '');
  const fallbackBase = slugifyForDomain(fallbackSlug) || slugifyForDomain(fallbackName) || 'demo-site';

  let labels = candidate ? splitLabels(candidate) : [];
  let detectedTld = preferredTld;
  if (labels.length) {
    const last = labels[labels.length - 1];
    if (VALID_TLD_REGEX.test(last)) {
      detectedTld = last.toLowerCase();
      labels = labels.slice(0, -1);
    }
  }

  if (!labels.length) {
    labels = [fallbackBase];
  }

  const cleanedLabels = labels
    .map((label) => sanitiseLabel(label))
    .filter(Boolean);

  if (!cleanedLabels.length) cleanedLabels.push(fallbackBase);

  const primaryIndex = cleanedLabels.length - 1;
  if (primaryIndex >= 0 && shouldTrimDuplicateSuffix(cleanedLabels[primaryIndex], detectedTld)) {
    const base = cleanedLabels[primaryIndex].slice(0, cleanedLabels[primaryIndex].length - detectedTld.length);
    const trimmed = sanitiseLabel(base.replace(/[-_.]+$/g, ''));
    if (trimmed.length >= 3) {
      cleanedLabels[primaryIndex] = trimmed;
    }
  }

  const finalLabels = cleanedLabels.length ? cleanedLabels : [fallbackBase];
  return `${finalLabels.join('.')}.${detectedTld}`;
}

export function toExternalUrl(domain: string): string {
  if (!domain) return '#';
  return /^https?:\/\//i.test(domain) ? domain : `https://${domain}`;
}
