'use server';

import { promises as fs } from 'fs';
import path from 'path';
import { generateSingleSite } from '@/lib/generation';
import { editCode as editCodeFlow } from '@/ai/flows/edit-code';
import { editCodeBulkFlow } from '@/components/edit-code-bulk';
import { editElementFlow } from '@/ai/flows/edit-element';
import { enhancePrompt as enhancePromptFlow } from '@/ai/flows/enhance-prompt';
import JSZip from 'jszip';
import { z } from 'zod';
import { encryptText, decryptText } from '@/lib/crypto';
import { revalidateTag, unstable_cache } from 'next/cache';
import { parse } from 'parse5';
import type { DefaultTreeDocument, DefaultTreeElement, DefaultTreeNode } from 'parse5/dist/tree-adapters/default';
import type { Attribute } from 'parse5/dist/common/token';

type UsageLike = {
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
};

type ElementAsset = {
  path: string;
  content: string;
};

type ElementEditResult = Awaited<ReturnType<typeof editElementFlow>> & {
  assets?: ElementAsset[];
};

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']);

const MIME_TYPE_MAP: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
};

const CHANGE_VERBS = [
  'change',
  'update',
  'replace',
  'swap',
  'refresh',
  'смен',
  'замен',
  'помен',
  'обнов',
  'змiн',
  'змін',
  'замі',
  'заміни',
];

function detectPromptLanguage(prompt: string): 'ru' | 'uk' | 'pl' | 'en' {
  const lower = prompt.toLowerCase();
  if (/[а-яё]+/.test(lower)) {
    if (/[іїєґ]/.test(lower)) return 'uk';
    return 'ru';
  }
  if (/[ąćęłńóśźż]/.test(lower)) return 'pl';
  return 'en';
}

function buildReasoning(language: ReturnType<typeof detectPromptLanguage>, kind: 'logo' | 'image', pool: 'casino' | 'sport-bar'): string {
  const poolLabel = pool === 'sport-bar' ? 'sport bar' : 'casino';
  if (language === 'ru') {
    return kind === 'logo'
      ? `Заменил логотип на новое изображение из каталога ${poolLabel}.`
      : `Обновил изображение, установив файл из каталога ${poolLabel}.`;
  }
  if (language === 'uk') {
    return kind === 'logo'
      ? `Змінив логотип на новий файл із бібліотеки ${poolLabel}.`
      : `Оновив зображення, використавши файл із бібліотеки ${poolLabel}.`;
  }
  if (language === 'pl') {
    return kind === 'logo'
      ? `Podmieniłem logo na nową grafikę z katalogu ${poolLabel}.`
      : `Zaktualizowałem obraz, wybierając plik z katalogu ${poolLabel}.`;
  }
  return kind === 'logo'
    ? `Replaced the logo with a new asset from the ${poolLabel} library.`
    : `Updated the image using a file from the ${poolLabel} library.`;
}

async function pickRandomAsset(folder: string): Promise<ElementAsset | null> {
  const assetDir = path.join(process.cwd(), 'public', 'images', folder);
  let entries: string[] = [];
  try {
    entries = await fs.readdir(assetDir);
  } catch {
    return null;
  }
  const files = entries.filter((file) => IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase()));
  if (!files.length) return null;
  const randomFile = files[Math.floor(Math.random() * files.length)];
  const absolutePath = path.join(assetDir, randomFile);
  let buffer: Buffer;
  try {
    buffer = await fs.readFile(absolutePath);
  } catch {
    return null;
  }
  const ext = path.extname(randomFile).toLowerCase().replace('.', '');
  const mime = MIME_TYPE_MAP[ext] || 'application/octet-stream';
  const webPath = ['images', folder, randomFile].join('/');
  return {
    path: webPath,
    content: `data:${mime};base64,${buffer.toString('base64')}`,
  };
}

function containsVerb(promptLower: string): boolean {
  return CHANGE_VERBS.some((verb) => promptLower.includes(verb));
}

function hasBrandIcon(html: string): boolean {
  return /brand-icon-main/i.test(html) || /id="logo-icon"/i.test(html);
}

function swapBrandIcon(html: string, src: string): string | null {
  const mainRegex = /<img[^>]*class=["'][^"']*brand-icon-main[^"']*["'][^>]*>/i;
  if (!mainRegex.test(html)) return null;
  let updated = html.replace(mainRegex, (match) => {
    let next = match;
    if (/src\s*=/.test(next)) {
      next = next.replace(/src\s*=\s*(["'])[\s\S]*?\1/i, `src="${src}"`);
    } else {
      next = next.replace('<img', `<img src="${src}"`);
    }
    next = next.replace(/data-icon-key\s*=\s*(["'])[\s\S]*?\1/i, '');
    return next;
  });
  updated = updated.replace(/<img[^>]*class=["'][^"']*brand-icon-secondary[^"']*["'][^>]*>\s*/gi, '');
  return updated;
}

function swapFirstImage(html: string, src: string): string | null {
  const imgRegex = /<img[^>]*>/i;
  if (!imgRegex.test(html)) return null;
  return html.replace(imgRegex, (match) => {
    let next = match;
    if (/src\s*=/.test(next)) {
      next = next.replace(/src\s*=\s*(["'])[\s\S]*?\1/i, `src="${src}"`);
    } else {
      next = next.replace('<img', `<img src="${src}"`);
    }
    next = next.replace(/srcset\s*=\s*(["'])[\s\S]*?\1/i, '');
    next = next.replace(/data-icon-key\s*=\s*(["'])[\s\S]*?\1/i, '');
    return next;
  });
}

function detectSitePool(siteTypes: string[]): 'sport-bar' | 'casino' {
  if (siteTypes.some((type) => type.toLowerCase().includes('sport'))) {
    return 'sport-bar';
  }
  return 'casino';
}

async function maybeHandleCustomElementEdit({
  prompt,
  elementHtml,
  siteTypes,
}: {
  prompt: string;
  elementHtml: string;
  siteTypes: string[];
}): Promise<ElementEditResult | null> {
  const promptLower = prompt.toLowerCase();
  if (!containsVerb(promptLower)) {
    return null;
  }

  const language = detectPromptLanguage(prompt);
  const pool = detectSitePool(siteTypes);

  if ((/logo/.test(promptLower) || /логотип/.test(promptLower) || /лого/.test(promptLower)) && hasBrandIcon(elementHtml)) {
    const folder = pool === 'sport-bar' ? 'logo-bar' : 'logo-casino';
    const asset = await pickRandomAsset(folder);
    if (!asset) return null;
    const nextHtml = swapBrandIcon(elementHtml, asset.path);
    if (!nextHtml) return null;
    return {
      elementHtml: nextHtml,
      reasoning: buildReasoning(language, 'logo', pool),
      css: undefined,
      usage: undefined,
      model: 'manual-asset-swap',
      assets: [asset],
    } as ElementEditResult;
  }

  if ((/image/.test(promptLower) || /photo/.test(promptLower) || /фото/.test(promptLower) || /картин/.test(promptLower) || /obraz/.test(promptLower)) && /<img/i.test(elementHtml)) {
    const folder = pool === 'sport-bar' ? 'img-bar' : 'img-casino';
    const asset = await pickRandomAsset(folder);
    if (!asset) return null;
    const nextHtml = swapFirstImage(elementHtml, asset.path);
    if (!nextHtml) return null;
    return {
      elementHtml: nextHtml,
      reasoning: buildReasoning(language, 'image', pool),
      css: undefined,
      usage: undefined,
      model: 'manual-asset-swap',
      assets: [asset],
    } as ElementEditResult;
  }

  return null;
}

function computeDiffStats(oldText: string, newText: string): { added: number; removed: number } {
  const a = (oldText || '').split(/\r?\n/);
  const b = (newText || '').split(/\r?\n/);
  const m = a.length;
  const n = b.length;
  const prev = new Array<number>(n + 1).fill(0);
  const curr = new Array<number>(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1] + 1;
      } else {
        curr[j] = Math.max(prev[j], curr[j - 1]);
      }
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  const lcs = prev[n];
  return { added: Math.max(0, n - lcs), removed: Math.max(0, m - lcs) };
}

type ElementReference = {
  tagName?: string | null;
  id?: string | null;
  path?: string | null;
  outerHTML?: string | null;
};

type ReplaceResult = {
  updatedHtml: string;
  originalHtml: string;
};

type PathSegment = {
  tagName: string;
  id?: string | null;
  nth?: number | null;
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isElementNode(node: DefaultTreeNode): node is DefaultTreeElement {
  return typeof (node as DefaultTreeElement).tagName === 'string';
}

function getAttr(el: DefaultTreeElement, name: string): string | undefined {
  const attr = el.attrs?.find((attr: Attribute) => attr.name === name);
  return attr?.value;
}

function parsePathSegments(path: string): PathSegment[] {
  return path
    .split('>')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => {
      const nthMatch = segment.match(/:nth-of-type\((\d+)\)$/);
      let nth: number | null = null;
      if (nthMatch) {
        nth = parseInt(nthMatch[1], 10);
        segment = segment.replace(/:nth-of-type\((\d+)\)$/, '');
      }
      let id: string | null = null;
      const idMatch = segment.match(/#([A-Za-z0-9_-]+)$/);
      if (idMatch) {
        id = idMatch[1];
        segment = segment.replace(/#([A-Za-z0-9_-]+)$/, '');
      }
      const tagName = segment.toLowerCase();
      return { tagName, id, nth };
    });
}

function findBodyNode(doc: DefaultTreeDocument): DefaultTreeElement | null {
  const htmlNode = (doc.childNodes || []).find(
    (node): node is DefaultTreeElement => isElementNode(node) && node.tagName === 'html'
  );
  if (!htmlNode) return null;
  const bodyNode = (htmlNode.childNodes || []).find(
    (node): node is DefaultTreeElement => isElementNode(node) && node.tagName === 'body'
  );
  return bodyNode || null;
}

function findNodeBySegments(
  start: DefaultTreeElement,
  segments: PathSegment[],
): DefaultTreeElement | null {
  let current: DefaultTreeElement | null = start;
  for (const segment of segments) {
    if (!current) return null;
    const children = (current.childNodes || []).filter(isElementNode) as DefaultTreeElement[];
    if (!children.length) return null;
    let next: DefaultTreeElement | null = null;
    const matches = children.filter((child) => child.tagName === segment.tagName);
    if (segment.id) {
      next = matches.find((child) => getAttr(child, 'id') === segment.id) || null;
    }
    if (!next) {
      if (segment.nth && segment.nth > 0) {
        next = matches[segment.nth - 1] || null;
      } else {
        next = matches[0] || null;
      }
    }
    if (!next) return null;
    current = next;
  }
  return current;
}

function replaceElementInHtml(
  html: string,
  ref: ElementReference,
  nextHtml: string,
): ReplaceResult | null {
  const normalizedTag = ref.tagName ? ref.tagName.toLowerCase() : null;

  if (ref.id && normalizedTag) {
    const idRegex = new RegExp(
      `<${normalizedTag}[^>]*\\bid=[\"']${escapeRegex(ref.id)}[\"'][^>]*>[\\s\\S]*?<\\/${normalizedTag}>`,
      'i',
    );
    let original: string | null = null;
    const updatedHtml = html.replace(idRegex, (match) => {
      if (original) return match; // Only replace first occurrence
      original = match;
      return nextHtml;
    });
    if (original) {
      return { updatedHtml, originalHtml: original };
    }
  }

  if (ref.path) {
    const segments = parsePathSegments(ref.path);
    if (segments.length) {
      const doc = parse(html, { sourceCodeLocationInfo: true }) as DefaultTreeDocument;
      const body = findBodyNode(doc);
      if (body) {
        const target = findNodeBySegments(body, segments);
        const loc = target?.sourceCodeLocation;
        if (target && loc) {
          const originalHtml = html.slice(loc.startOffset, loc.endOffset);
          const updatedHtml =
            html.slice(0, loc.startOffset) + nextHtml + html.slice(loc.endOffset);
          return { updatedHtml, originalHtml };
        }
      }
    }
  }

  if (ref.outerHTML) {
    const index = html.indexOf(ref.outerHTML);
    if (index !== -1) {
      const updatedHtml =
        html.slice(0, index) + nextHtml + html.slice(index + ref.outerHTML.length);
      return { updatedHtml, originalHtml: ref.outerHTML };
    }
  }

  return null;
}

async function incrementSiteTokenTotals(sb: any, siteId: string, usage?: UsageLike) {
  if (!usage || (!usage.inputTokens && !usage.outputTokens)) return;
  const inputDelta = usage.inputTokens ?? 0;
  const outputDelta = usage.outputTokens ?? 0;
  if (!inputDelta && !outputDelta) return;
  try {
    const { data: current } = await sb
      .from('sites')
      .select('total_input_tokens,total_output_tokens')
      .eq('id', siteId)
      .maybeSingle();
    const nextInput = (current?.total_input_tokens || 0) + inputDelta;
    const nextOutput = (current?.total_output_tokens || 0) + outputDelta;
    await sb
      .from('sites')
      .update({
        total_input_tokens: nextInput,
        total_output_tokens: nextOutput,
        updated_at: new Date().toISOString(),
      })
      .eq('id', siteId);
  } catch (error) {
    console.error('Failed to update token counters', error);
  }
}

const formSchema = z.object({
  siteName: z.string().min(3, 'Site name must be at least 3 characters long.'),
  prompt: z.string().min(10, 'Prompt must be at least 10 characters long.'),
  websiteTypes: z.array(z.string()).optional(),
  history: z.array(z.string()).optional(), // Add history to schema
});

export async function generateWebsiteAction(prevState: any, formData: FormData) {
  try {
    const historyJson = formData.get('history');
    const history = historyJson && typeof historyJson === 'string' ? JSON.parse(historyJson) : [];

    const validatedFields = formSchema.safeParse({
      siteName: formData.get('siteName'),
      prompt: formData.get('prompt'),
      websiteTypes: formData.getAll('websiteTypes'),
      history: history,
    });

    if (!validatedFields.success) {
      return {
        success: false,
        error: 'Invalid input. Please check the form fields.',
        fieldErrors: validatedFields.error.flatten().fieldErrors,
        site: prevState.site, // Return previous site state on validation failure
      };
    }

    const { siteName, prompt, websiteTypes, history: prevHistory } = validatedFields.data;

    console.time('generate:full-site');
    const site = await generateSingleSite(prompt, siteName, websiteTypes, prevHistory);
    console.timeEnd('generate:full-site');
    
    if (!site) {
      return {
        success: false,
        error: 'Failed to generate the website. The AI may have returned an invalid or empty response.',
        site: prevState.site,
        fieldErrors: null,
      };
    }
    
    // Convert Buffer content to base64 for client-side handling
    const textExtensions = new Set([
      'html',
      'htm',
      'css',
      'js',
      'ts',
      'tsx',
      'json',
      'txt',
      'svg',
      'md',
      'xml',
    ]);
    const imageMimeMap: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
      avif: 'image/avif',
    };

    const serializedFiles: Record<string, string> = {};
    for (const [filePath, value] of Object.entries(site.files)) {
      if (typeof value === 'string') {
        serializedFiles[filePath] = value;
        continue;
      }
      if (!Buffer.isBuffer(value)) {
        console.warn(`generateWebsiteAction: skipping unsupported file payload for ${filePath}`);
        continue;
      }

      const ext = path.extname(filePath).replace('.', '').toLowerCase();
      if (textExtensions.has(ext)) {
        serializedFiles[filePath] = value.toString('utf-8');
        continue;
      }

      const mimeType = imageMimeMap[ext] || 'application/octet-stream';
      serializedFiles[filePath] = `data:${mimeType};base64,${value.toString('base64')}`;
    }

    const safeSite = {
      ...site,
      files: serializedFiles,
    };

    const result = {
      success: true,
      site: safeSite,
      error: null,
      fieldErrors: null,
    } as const;

    return structuredClone(result);
  } catch (error) {
    console.error('An unexpected error occurred during website generation:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return {
      success: false,
      error: `Generation Failed: ${errorMessage}`,
      site: prevState.site,
      fieldErrors: null,
    };
  }
}


export async function downloadZipAction(siteData: { domain: string, files: Record<string, string> }): Promise<{ success: boolean; zip?: string; filename?: string; error?: string; }> {
    try {
        const zip = new JSZip();
        const folder = zip.folder(siteData.domain);

        if (folder) {
            for (const [path, content] of Object.entries(siteData.files)) {
                if (content.startsWith('data:')) {
                    const base64Data = content.split(',')[1];
                    folder.file(path, base64Data, { base64: true });
                } else {
                    folder.file(path, content);
                }
            }
        }
        
        const zipBlob = await zip.generateAsync({ type: 'base64' });
        const filename = `${siteData.domain}-${Date.now()}.zip`;

        return {
            success: true,
            zip: zipBlob,
            filename: filename,
        };
    } catch (error) {
        console.error('ZIP creation failed:', error);
        return {
            success: false,
            error: 'Failed to create the ZIP file.',
        };
    }
}

// --- cPanel: Test connection ---
const testConnSchema = z.object({
  host: z.string().min(3),
  user: z.string().min(1),
  token: z.string().min(10),
  domain: z.string().min(1),
  docRoot: z.string().min(1),
});

export async function testCpanelConnectionAction(prev: any, formData: FormData): Promise<{ success: boolean; message: string; details?: any; }>{
  try {
    const parsed = testConnSchema.safeParse({
      host: formData.get('host'),
      user: formData.get('user'),
      token: formData.get('token'),
      domain: formData.get('domain'),
      docRoot: formData.get('docRoot'),
    });
    if (!parsed.success) {
      return { success: false, message: 'Missing or invalid connection fields' };
    }
    const { host, user, token, domain, docRoot } = parsed.data;

    const base = host.startsWith('http') ? host : `https://${host}`;
    const authHeader = { Authorization: `cpanel ${user}:${token}` } as Record<string, string>;

    // 1) List domains to verify auth works
    const listDomainsUrl = `${base}/execute/DomainInfo/list_domains`;
    const listResp = await fetch(listDomainsUrl, { headers: authHeader, cache: 'no-store' });
    if (!listResp.ok) {
      return { success: false, message: `DomainInfo failed: HTTP ${listResp.status}` };
    }
    const domainsJson = await listResp.json().catch(() => ({}));
    if (domainsJson.status !== 1 && domainsJson.status !== true) {
      return { success: false, message: 'DomainInfo returned error', details: domainsJson?.errors || domainsJson?.error };
    }

    // 2) Check docRoot parent exists (list directory)
    const parentDir = docRoot.replace(/\/+$/,'').split('/').slice(0, -1).join('/') || '/';
    const listFilesUrl = `${base}/execute/Fileman/list_files?dir=${encodeURIComponent(parentDir)}&types=dir`;
    const listFilesResp = await fetch(listFilesUrl, { headers: authHeader, cache: 'no-store' });
    if (!listFilesResp.ok) {
      return { success: false, message: `Fileman list_files failed: HTTP ${listFilesResp.status}` };
    }
    const listFilesJson = await listFilesResp.json().catch(() => ({}));
    const ok = listFilesJson.status === 1 || listFilesJson.status === true;
    if (!ok) {
      return { success: false, message: 'Fileman list_files returned error', details: listFilesJson?.errors || listFilesJson?.error };
    }

    return {
      success: true,
      message: 'Connection OK. API token valid and file access confirmed.',
      details: {
        domains: domainsJson?.data,
        checkedDir: parentDir,
        targetDomain: domain,
        targetDocRoot: docRoot,
      },
    };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Unexpected error during connection test' };
  }
}

const editCodeSchema = z.object({
  fileName: z.string(),
  code: z.string(),
  prompt: z.string(),
  userId: z.string().min(1),
  siteId: z.string().min(1),
});

const editElementSchema = z.object({
  fileName: z.string(),
  fileCode: z.string(),
  elementHtml: z.string(),
  prompt: z.string(),
  userId: z.string().min(1),
  siteId: z.string().min(1),
  cssContent: z.string().optional().nullable(),
  elementId: z.string().optional().nullable(),
  tagName: z.string().optional().nullable(),
  path: z.string().optional().nullable(),
  siteTypes: z.string().optional().nullable(),
});

export async function editCodeAction(prevState: any, formData: FormData) {
  const validatedFields = editCodeSchema.safeParse({
    fileName: formData.get('fileName'),
    code: formData.get('code'),
    prompt: formData.get('prompt'),
    userId: formData.get('userId'),
    siteId: formData.get('siteId'),
  });

  if (!validatedFields.success) {
    return {
      success: false,
      error: 'Invalid input for code editing.',
      fieldErrors: validatedFields.error.flatten().fieldErrors,
      response: null,
    };
  }

  const { fileName, code, prompt, userId, siteId } = validatedFields.data;

  try {
    const sb = await getSbService();
    const result = await editCodeFlow({ fileName, code, prompt });
    let chatEntry: any = null;
    const aiResponseText = result.reasoning;
    if (aiResponseText) {
      const diffStats = computeDiffStats(code, result.code);
      const metadata = { diff: diffStats };
      const { data: chatRow } = await safeInsertChat(sb, {
          user_id: userId,
          site_id: siteId,
          role: 'assistant',
          text: aiResponseText,
          file: fileName,
          input_tokens: result.usage?.inputTokens ?? null,
          output_tokens: result.usage?.outputTokens ?? null,
          model: result.model || null,
          metadata,
        });
      revalidateTag(`chat-history-${siteId}`);
      await incrementSiteTokenTotals(sb, siteId, result.usage);
      if (chatRow) {
        chatEntry = {
          created_at: chatRow.created_at,
          input_tokens: chatRow.input_tokens,
          output_tokens: chatRow.output_tokens,
          model: chatRow.model,
          metadata: chatRow.metadata,
          text: aiResponseText,
          file: fileName,
        };
      }
    }

    return {
      success: true,
      response: {
        code: result.code,
        reasoning: result.reasoning,
        usage: result.usage,
        model: result.model,
      },
      chat: chatEntry,
    };
  } catch (error) {
    console.error('Code editing failed:', error);
    return {
      success: false,
      error: 'An unexpected error occurred during code editing.',
      response: null,
    };
  }
}

export async function editElementAction(prevState: any, formData: FormData) {
  const validatedFields = editElementSchema.safeParse({
    fileName: formData.get('fileName'),
    fileCode: formData.get('fileCode'),
    elementHtml: formData.get('elementHtml'),
    prompt: formData.get('prompt'),
    userId: formData.get('userId'),
    siteId: formData.get('siteId'),
    cssContent: formData.get('cssContent'),
    elementId: formData.get('elementId'),
    tagName: formData.get('tagName'),
    path: formData.get('path'),
    siteTypes: formData.get('siteTypes'),
  });

  if (!validatedFields.success) {
    return {
      success: false,
      error: 'Invalid input for element editing.',
      fieldErrors: validatedFields.error.flatten().fieldErrors,
      response: null,
    };
  }

  const {
    fileName,
    fileCode,
    elementHtml,
    prompt,
    userId,
    siteId,
    cssContent,
    elementId,
    tagName,
    path,
    siteTypes,
  } = validatedFields.data;

  let parsedSiteTypes: string[] = [];
  if (typeof siteTypes === 'string' && siteTypes.trim().length) {
    try {
      const parsed = JSON.parse(siteTypes);
      if (Array.isArray(parsed)) {
        parsedSiteTypes = parsed.map((value) => String(value));
      }
    } catch {
      parsedSiteTypes = siteTypes.split(',').map((value) => value.trim()).filter(Boolean);
    }
  }

  try {
    const sb = await getSbService();
    let result: ElementEditResult | null = await maybeHandleCustomElementEdit({
      prompt,
      elementHtml,
      siteTypes: parsedSiteTypes,
    });

    if (!result) {
      result = await editElementFlow({
        elementHtml,
        prompt,
        css: cssContent || undefined,
      });
    }

    if (!result.elementHtml) {
      throw new Error('Model did not return updated markup.');
    }

    const replacement = replaceElementInHtml(
      fileCode,
      {
        tagName: tagName || null,
        id: elementId || null,
        path: path || null,
        outerHTML: elementHtml || null,
      },
      result.elementHtml,
    );

    if (!replacement) {
      throw new Error('Не вдалося знайти вибраний елемент у файлі.');
    }

    const updatedFileCode = replacement.updatedHtml;

    const updates: { site_id: string; path: string; content: string; updated_by: string }[] = [
      { site_id: siteId, path: fileName, content: updatedFileCode, updated_by: userId },
    ];

    if (Array.isArray(result.assets)) {
      for (const asset of result.assets) {
        updates.push({
          site_id: siteId,
          path: asset.path,
          content: asset.content,
          updated_by: userId,
        });
      }
    }

    let cssDiff: { added: number; removed: number } | null = null;

    if (typeof result.css === 'string') {
      updates.push({
        site_id: siteId,
        path: 'styles/style.css',
        content: result.css,
        updated_by: userId,
      });
      if (typeof cssContent === 'string') {
        cssDiff = computeDiffStats(cssContent, result.css);
      }
    }

    const { error: upsertError } = await sb
      .from('site_files')
      .upsert(updates, { onConflict: 'site_id,path' });
    if (upsertError) {
      throw new Error(upsertError.message);
    }

    await sb.from('sites').update({ updated_at: new Date().toISOString() }).eq('id', siteId);

    const diff = computeDiffStats(fileCode, updatedFileCode);

    const aiResponseText = result.reasoning || 'Оновив вибрану секцію.';
    let chatEntry: any = null;
    if (aiResponseText) {
      const metadata: Record<string, any> = { diff };
      if (cssDiff) {
        metadata.cssDiff = cssDiff;
      }
      const { data: chatRow } = await safeInsertChat(sb, {
        user_id: userId,
        site_id: siteId,
        role: 'assistant',
        text: aiResponseText,
        file: fileName,
        input_tokens: result.usage?.inputTokens ?? null,
        output_tokens: result.usage?.outputTokens ?? null,
        model: result.model || null,
        metadata,
      });
      revalidateTag(`chat-history-${siteId}`);
      await incrementSiteTokenTotals(sb, siteId, result.usage);
      if (chatRow) {
        chatEntry = {
          created_at: chatRow.created_at,
          input_tokens: chatRow.input_tokens,
          output_tokens: chatRow.output_tokens,
          model: chatRow.model,
          metadata: chatRow.metadata,
          text: aiResponseText,
          file: fileName,
        };
      }
    }

    await incrementSiteTokenTotals(sb, siteId, result.usage);

    return {
      success: true,
      response: {
        fileName,
        code: updatedFileCode,
        elementHtml: result.elementHtml,
        css: typeof result.css === 'string' ? result.css : null,
        reasoning: aiResponseText,
        usage: result.usage,
        model: result.model,
        assets: result.assets && result.assets.length ? result.assets : undefined,
      },
      chat: chatEntry,
    };
  } catch (error) {
    console.error('Element editing failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred.',
      response: null,
    };
  }
}

// Bulk edit: loop editCodeFlow across multiple files
const bulkSchema = z.object({
  prompt: z.string(),
  filesPayload: z.string(), // JSON: { files: { fileName:string; code:string }[] }
  userId: z.string().min(1),
  siteId: z.string().min(1),
});

export async function editCodeBulkAction(prevState: any, formData: FormData) {
  const parsed = bulkSchema.safeParse({
    prompt: formData.get('prompt'),
    filesPayload: formData.get('filesPayload'),
    userId: formData.get('userId'),
    siteId: formData.get('siteId'),
  });
  if (!parsed.success) {
    return { success: false, error: 'Invalid bulk edit payload', results: null, reasoning: null, answer: null };
  }
  try {
    const { prompt, filesPayload, userId, siteId } = parsed.data;
    const data = JSON.parse(filesPayload || '{}');
    const files: { fileName: string; code: string }[] = Array.isArray(data?.files) ? data.files : [];
    const originalMap = new Map<string, string>(files.map((f) => [f.fileName, f.code]));
    const sb = await getSbService();

    // 1. Сохраняем запрос пользователя в историю чата
    await sb.from('project_chat').insert({ user_id: userId, site_id: siteId, role: 'user', text: prompt, file: 'Whole Project' });

    // 2. Запускаем AI-flow для получения изменений в коде
    const result = await editCodeBulkFlow({ files, prompt });

    // 3. Сохраняем ответ AI и изменения файлов в базу данных
    const diffSummaries: { file: string; added: number; removed: number }[] = [];
    if (result.modifications && result.modifications.length > 0) {
      const changes: Record<string, string> = {};
      // Предполагаем, что `modifications` - это массив объектов с `fileName` и `code`
      result.modifications.forEach((mod: { fileName: string, code: string, status?: string }) => {
        const before = originalMap.get(mod.fileName) ?? '';
        const after = mod.code ?? '';
        const stats = computeDiffStats(before, after);
        diffSummaries.push({ file: mod.fileName, added: stats.added, removed: stats.removed });
        // Сохраняем только обновленные или созданные файлы
        if (!mod.status || mod.status === 'updated' || mod.status === 'created') {
          changes[mod.fileName] = mod.code;
        }
      });

      const rowsToUpsert = Object.entries(changes).map(([path, content]) => ({
        site_id: siteId,
        path,
        content,
        updated_by: userId,
      }));

      if (rowsToUpsert.length > 0) {
        const { error: upsertError } = await sb.from('site_files').upsert(rowsToUpsert, { onConflict: 'site_id,path' });
        if (upsertError) throw new Error(`Ошибка базы данных: не удалось сохранить изменения в файлах. ${upsertError.message}`);
        await sb.from('sites').update({ updated_at: new Date().toISOString() }).eq('id', siteId);
      }
    }

    // 4. Сохраняем текстовый ответ AI в историю чата
    const aiResponseText = result.answer || result.reasoning;
    let chatEntry: any = null;
    if (aiResponseText) {
      const metadata = diffSummaries.length ? { diffs: diffSummaries } : null;
      const { data: chatRow } = await safeInsertChat(sb, {
          user_id: userId,
          site_id: siteId,
          role: 'assistant',
          text: aiResponseText,
          file: 'Whole Project',
          input_tokens: result.usage?.inputTokens ?? null,
          output_tokens: result.usage?.outputTokens ?? null,
          model: result.model || null,
          metadata,
        });
      revalidateTag(`chat-history-${siteId}`);
      await incrementSiteTokenTotals(sb, siteId, result.usage);
      if (chatRow) {
        chatEntry = {
          created_at: chatRow.created_at,
          input_tokens: chatRow.input_tokens,
          output_tokens: chatRow.output_tokens,
          model: chatRow.model,
          metadata: chatRow.metadata,
          text: aiResponseText,
          file: 'Whole Project',
        };
      }
    }

    // 5. Возвращаем результат клиенту для немедленного обновления UI
    return {
      success: true,
      results: result.modifications,
      reasoning: result.reasoning,
      answer: result.answer,
      usage: result.usage,
      model: result.model,
      chat: chatEntry,
    };
  } catch (e: any) {
    const errorMessage = e instanceof Error ? e.message : 'Bulk edit failed';
    console.error('Bulk edit action failed:', e);
    return { success: false, error: errorMessage, results: null, reasoning: null, answer: null };
  }
}

const enhancePromptSchema = z.object({
    prompt: z.string(),
});

export async function enhancePromptAction(prevState: any, formData: FormData): Promise<{ success: boolean; enhancedPrompt?: string; error?: string; }> {
    const validatedFields = enhancePromptSchema.safeParse({ 
        prompt: formData.get('prompt') 
    });

    if (!validatedFields.success) {
        return {
            success: false,
            error: 'Invalid prompt for enhancement.',
        };
    }
    
    const { prompt } = validatedFields.data;

    try {
        const result = await enhancePromptFlow({ prompt });
        return {
            success: true,
            enhancedPrompt: result.enhancedPrompt,
        };
    } catch (error) {
        console.error('Prompt enhancement failed:', error);
        return {
            success: false,
            error: 'An unexpected error occurred during prompt enhancement.',
        };
    }
}

// --- cPanel: Publish (create domain if needed, upload ZIP, extract) ---
const publishSchema = z.object({
  userId: z.string().optional(),
  siteName: z.string().optional(),
  host: z.string().min(3),
  user: z.string().min(1),
  token: z.string().min(10),
  domain: z.string().min(1),
  docRoot: z.string().min(1),
  files: z.string().min(2), // JSON stringified Record<string,string>
});

export async function publishToCpanelAction(prev: any, formData: FormData): Promise<{ success: boolean; url?: string; log?: string[]; error?: string }>{
  const parsed = publishSchema.safeParse({
    userId: formData.get('userId'),
    siteName: formData.get('siteName'),
    host: formData.get('host'),
    user: formData.get('user'),
    token: formData.get('token'),
    domain: formData.get('domain'),
    docRoot: formData.get('docRoot'),
    files: formData.get('files'),
  });
  if (!parsed.success) {
    return { success: false, error: 'Missing or invalid publish fields' };
  }
  const { userId, siteName, host, user, token, domain, docRoot } = parsed.data;

  try {
    const files: Record<string, string> = JSON.parse(parsed.data.files);

    // Build ZIP from files
    const zip = new JSZip();
    // Flatten archive: files go to root (no extra top-level folder)
    for (const [path, content] of Object.entries(files)) {
      if (content.startsWith('data:')) {
        const base64Data = content.split(',')[1];
        zip.file(path, base64Data, { base64: true });
      } else {
        zip.file(path, content);
      }
    }
    const zipBlobBase64 = await zip.generateAsync({ type: 'base64' });
    const zipBuffer = Buffer.from(zipBlobBase64, 'base64');

    const base = host.startsWith('http') ? host : `https://${host}`;
    const authHeader = { Authorization: `cpanel ${user}:${token}` } as Record<string, string>;
    const log: string[] = [];
    const dirRel = docRoot.replace(/^\/+/, '');
    const zipRel = `${dirRel}/site.zip`;

    // 1) Check if domain exists
    const listResp = await fetch(`${base}/execute/DomainInfo/list_domains`, { headers: authHeader, cache: 'no-store' });
    if (!listResp.ok) return { success: false, error: `DomainInfo failed: HTTP ${listResp.status}` };
    const listJson: any = await listResp.json().catch(() => ({}));
    const all = [
      listJson?.data?.main_domain,
      ...(listJson?.data?.addon_domains || []),
      ...(listJson?.data?.parked_domains || []),
      ...(listJson?.data?.sub_domains || []),
    ].filter(Boolean);
    const exists = all.some((d: any) => (typeof d === 'string' ? d : d?.domain) === domain);
    if (!exists) {
      // Try to create addon domain
      // cPanel API for creating an addon domain requires `newdomain`.
      // The `subdomain` parameter should be just the first part of the domain name (e.g., 'blog' from 'blog.example.com').
      const subdomainPart = domain.split('.')[0];
      const addUrl = `${base}/json-api/cpanel?cpanel_jsonapi_version=2&cpanel_jsonapi_module=AddonDomain&cpanel_jsonapi_func=addaddondomain&newdomain=${encodeURIComponent(domain)}&subdomain=${encodeURIComponent(subdomainPart)}&dir=${encodeURIComponent(docRoot)}`;
      const addResp = await fetch(addUrl, { headers: authHeader, cache: 'no-store' });
      const addJson: any = await addResp.json().catch(() => ({}));
      if (!addResp.ok || addJson?.cpanelresult?.error) {
        return { success: false, error: `AddonDomain add failed: ${addJson?.cpanelresult?.error || addResp.status}` };
      }
      log.push('Addon domain created');
    } else {
      log.push('Domain already exists, skipping create');
    }

    // 2) Ensure parent dir exists (optional safety)
    const parentDir = docRoot.replace(/\/+$/,'').split('/').slice(0, -1).join('/') || '/';
    // Ensure parent first, then docRoot
    await fetch(`${base}/execute/Fileman/mkdir?path=${encodeURIComponent(parentDir)}`, { headers: authHeader }).catch(() => {});
    await fetch(`${base}/execute/Fileman/mkdir?path=${encodeURIComponent(docRoot)}`, { headers: authHeader }).catch(() => {});

    // 3) Upload ZIP (use file-1 key for better compatibility)
    const form = new FormData();
    form.append('dir', docRoot);
    form.append('file', new Blob([zipBuffer], { type: 'application/zip' }), 'site.zip');
    let upResp = await fetch(`${base}/execute/Fileman/upload_files`, { method: 'POST', headers: authHeader as any, body: form as any });
    const upJson: any = await upResp.json().catch(() => ({}));
    if (!upResp.ok || (upJson?.status !== 1 && upJson?.status !== true)) {
      // retry with relative and both keys
      const form2 = new FormData();
      form2.append('dir', dirRel);
      form2.append('file', new Blob([zipBuffer], { type: 'application/zip' }), 'site.zip');
      upResp = await fetch(`${base}/execute/Fileman/upload_files`, { method: 'POST', headers: authHeader as any, body: form2 as any });
      const up2Json: any = await upResp.json().catch(() => ({}));
      if (!upResp.ok || (up2Json?.status !== 1 && up2Json?.status !== true)) {
        const form3 = new FormData();
        form3.append('dir', dirRel);
        form3.append('file-1', new Blob([zipBuffer], { type: 'application/zip' }), 'site.zip');
        upResp = await fetch(`${base}/execute/Fileman/upload_files`, { method: 'POST', headers: authHeader as any, body: form3 as any });
        const up3Json: any = await upResp.json().catch(() => ({}));
        if (!upResp.ok || (up3Json?.status !== 1 && up3Json?.status !== true)) {
          return { success: false, error: `Upload failed: HTTP ${upResp.status} ${(up3Json?.errors || up3Json?.error || upJson?.error || '').toString()}` };
        }
      }
    }
    log.push('ZIP uploaded');

    // 4) Extract
    let exResp = await fetch(`${base}/execute/Fileman/extract_archive`, { method: 'POST', headers: { ...authHeader, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ dir: dirRel, file: 'site.zip', overwrite: '1' }) });
    const exJson: any = await exResp.json().catch(() => ({}));
    if (!exResp.ok || (exJson?.status !== 1 && exJson?.status !== true)) {
      // Fallback to API2 (some hosts disable UAPI Fileman::extract_archive)
      let api2Url = `${base}/json-api/cpanel?cpanel_jsonapi_version=2&cpanel_jsonapi_module=Fileman&cpanel_jsonapi_func=extract_archive&dir=${encodeURIComponent(dirRel)}&file=${encodeURIComponent(zipRel)}&overwrite=1`;
      let ex2Resp = await fetch(api2Url, { headers: authHeader });
      const ex2Json: any = await ex2Resp.json().catch(() => ({}));
      // Consider success if HTTP ok and no explicit error field
      let ok2 = ex2Resp.ok && !(ex2Json?.cpanelresult?.error);
      if (!ok2) {
        // Try absolute path
        api2Url = `${base}/json-api/cpanel?cpanel_jsonapi_version=2&cpanel_jsonapi_module=Fileman&cpanel_jsonapi_func=extract_archive&dir=${encodeURIComponent(docRoot)}&file=${encodeURIComponent(docRoot + '/site.zip')}&overwrite=1`;
        ex2Resp = await fetch(api2Url, { headers: authHeader });
        const ex2bJson: any = await ex2Resp.json().catch(() => ({}));
        ok2 = ex2Resp.ok && !(ex2bJson?.cpanelresult?.error);
      }
      if (!ok2) {
        // Fall back to per-file upload (no extract supported)
        log.push('Extract not available, switching to per-file upload…');
        // Create dirs and upload files one by one
        const ensureDir = async (fullPath: string) => {
          try {
            // try relative then absolute
            await fetch(`${base}/execute/Fileman/mkdir?path=${encodeURIComponent(fullPath.replace(/^\/+/, ''))}`, { headers: authHeader });
            await fetch(`${base}/execute/Fileman/mkdir?path=${encodeURIComponent(fullPath)}`, { headers: authHeader });
          } catch {}
        };
        // Ensure base docRoot exists
        await ensureDir(docRoot);
        let uploaded = 0;
        const guessMime = (filename: string) => {
          const ext = filename.split('.').pop()?.toLowerCase() || '';
          switch (ext) {
            case 'html': return 'text/html';
            case 'css': return 'text/css';
            case 'js': return 'application/javascript';
            case 'json': return 'application/json';
            case 'svg': return 'image/svg+xml';
            default: return 'application/octet-stream';
          }
        };
        for (const [path, content] of Object.entries(files)) {
          const parts = path.split('/');
          const name = parts.pop() as string;
          const dir = parts.length ? `${docRoot}/${parts.join('/')}` : docRoot;
          await ensureDir(dir);
          const isData = typeof content === 'string' && content.startsWith('data:');
          // Use upload_files для всех типов (и текстов), т.к. у некоторых хостов save_file_content отключён
          if (isData) {
            const bin = Buffer.from(content.split(',')[1] || '', 'base64');
            const f = new FormData();
            f.append('dir', dir.replace(/^\/+/, ''));
            f.append('file-1', new Blob([bin]), name);
            let resp = await fetch(`${base}/execute/Fileman/upload_files`, { method: 'POST', headers: authHeader as any, body: f as any });
            if (!resp.ok) {
              const f2 = new FormData();
              f2.append('dir', dir);
              f2.append('file-1', new Blob([bin]), name);
              resp = await fetch(`${base}/execute/Fileman/upload_files`, { method: 'POST', headers: authHeader as any, body: f2 as any });
              if (!resp.ok) throw new Error('upload_files failed');
            }
          } else {
            const text = String(content);
            const mime = guessMime(name);
            const f = new FormData();
            f.append('dir', dir.replace(/^\/+/, ''));
            f.append('file-1', new Blob([Buffer.from(text, 'utf8')], { type: mime }), name);
            let resp = await fetch(`${base}/execute/Fileman/upload_files`, { method: 'POST', headers: authHeader as any, body: f as any });
            if (!resp.ok) {
              const f2 = new FormData();
              f2.append('dir', dir);
              f2.append('file-1', new Blob([Buffer.from(text, 'utf8')], { type: mime }), name);
              resp = await fetch(`${base}/execute/Fileman/upload_files`, { method: 'POST', headers: authHeader as any, body: f2 as any });
              if (!resp.ok) throw new Error('upload_files failed');
            }
          }
          uploaded++;
        }
        log.push(`Uploaded ${uploaded} files (no extract).`);
      } else {
        log.push('Archive extracted (API2)');
      }
    } else {
      log.push('Archive extracted');
    }

    // Verify content exists (some hosts return 200 but still fail silently)
    try {
      const verify = await fetch(`${base}/execute/Fileman/list_files?dir=${encodeURIComponent(docRoot)}&types=file&limit=1`, { headers: authHeader });
      if (!verify.ok) log.push('Verification skipped (list_files not ok)');
      else log.push('Verified files in docroot');
    } catch {}

    // 5) Optionally remove ZIP (best-effort)
    // Try delete for both relative and absolute paths
    await fetch(`${base}/execute/Fileman/delete?path=${encodeURIComponent(zipRel)}`, { headers: authHeader }).catch(() => {});
    await fetch(`${base}/execute/Fileman/delete?path=${encodeURIComponent(docRoot + '/site.zip')}`, { headers: authHeader }).catch(() => {});
    log.push('ZIP removed');

    // --- Save deployment record to Supabase ---
    if (userId && siteName && domain) {
        try {
            const sbAdmin = await getSbService();
            const { error: dbError } = await sbAdmin.from('publish_deploys').insert({
                user_id: userId,
                domain: domain,
                docroot: docRoot,
                zip_size_bytes: zipBuffer.length,
                status: 'succeeded',
                url: `https://${domain}`,
                log: log,
            });
            if (dbError) log.push(`DB Save Error: ${dbError.message}`);
            else log.push('Deployment record saved.');
        } catch (dbError: any) {
            log.push(`DB Save Exception: ${dbError.message}`);
        }
    }

    return { success: true, url: `https://${domain}`, log };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Unexpected error during publish' };
  }
}

// --- Supabase: Save/Load Publish Settings ---
const settingsSchema = z.object({
  userId: z.string().min(1),
  host: z.string().min(3),
  username: z.string().min(1),
  token: z.string().min(5),
  domain: z.string().min(1),
  docroot: z.string().min(1),
});

async function getSbService() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error('Supabase env is not configured');
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(url, key, { auth: { persistSession: false } });
}

async function safeInsertChat(sb: any, payload: any) {
  try {
    const { data, error } = await sb
      .from('project_chat')
      .insert(payload)
      .select('id,created_at,input_tokens,output_tokens,model,metadata')
      .single();
    if (error) throw error;
    return { data };
  } catch (err: any) {
    // Retry with minimal columns for legacy schemas
    try {
      const minimal = {
        user_id: payload.user_id,
        site_id: payload.site_id,
        role: payload.role,
        text: payload.text,
        file: payload.file ?? null,
      };
      const { data, error } = await sb
        .from('project_chat')
        .insert(minimal)
        .select('id,created_at')
        .single();
      if (error) throw error;
      return { data };
    } catch (e2) {
      throw err || e2;
    }
  }
}

export async function savePublishSettingsAction(prev: any, formData: FormData) {
  try {
    const parsed = settingsSchema.safeParse({
      userId: formData.get('userId'),
      host: formData.get('host'),
      username: formData.get('username'),
      token: formData.get('token'),
      domain: formData.get('domain'),
      docroot: formData.get('docroot'),
    });
    if (!parsed.success) return { success: false, error: 'Invalid settings' };

    const sb = await getSbService();
    const token_enc = encryptText(parsed.data.token);
    const { error } = await sb.from('publish_settings').upsert({
      user_id: parsed.data.userId,
      cpanel_host: parsed.data.host,
      cpanel_username: parsed.data.username,
      cpanel_token_enc: token_enc,
      default_domain: parsed.data.domain,
      default_docroot: parsed.data.docroot,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Unexpected error' };
  }
}

export async function loadDeployedSitesAction(userId: string) {
  if (!userId) {
    return { success: false, error: 'User not provided', sites: null };
  }
  try {
    const sb = await getSbService();
    const { data, error } = await sb.from('publish_deploys')
      .select('id, domain, url, created_at, status')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return { success: true, sites: data, error: null };
  } catch (e: any) {
    return { success: false, error: e.message, sites: null };
  }
}

export async function loadPublishSettingsAction(prev: any, formData: FormData) {
  try {
    const userId = String(formData.get('userId') || '');
    if (!userId) return { success: false, error: 'No user' };
    const sb = await getSbService();
    const { data, error } = await sb.from('publish_settings').select('*').eq('user_id', userId).maybeSingle();
    if (error) return { success: false, error: error.message };
    if (!data) return { success: true, settings: null };
    const token = data.cpanel_token_enc ? decryptText(data.cpanel_token_enc) : '';
    return {
      success: true,
      settings: {
        host: data.cpanel_host,
        username: data.cpanel_username,
        token,
        domain: data.default_domain,
        docroot: data.default_docroot,
      }
    };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Unexpected error' };
  }
}

// ===== Phase 2: Revisions and Assets =====

const revisionSchema = z.object({
  userId: z.string().min(1),
  siteId: z.string().min(1),
  label: z.string().optional(),
});

export async function createRevisionAction(prev: any, formData: FormData) {
  try {
    const parsed = revisionSchema.safeParse({
      userId: formData.get('userId'),
      siteId: formData.get('siteId'),
      label: formData.get('label') || undefined,
    });
    if (!parsed.success) return { success: false, error: 'Invalid data' };
    const { userId, siteId, label } = parsed.data;
    const sb = await getSbService();
    // Verify ownership
    const { data: siteRow, error: sErr } = await sb.from('sites').select('id').eq('id', siteId).eq('user_id', userId).maybeSingle();
    if (sErr || !siteRow) return { success: false, error: 'Not found or no access' };
    // Load files
    const { data: files, error: fErr } = await sb.from('site_files').select('path,content').eq('site_id', siteId);
    if (fErr) return { success: false, error: fErr.message };
    const snapshot = { files: files || [] };
    const { data: rev, error: rErr } = await sb.from('site_revisions').insert({ site_id: siteId, label: label || null, snapshot, created_by: userId }).select('id,created_at').single();
    if (rErr) return { success: false, error: rErr.message };
    return { success: true, revision: rev };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Unexpected error' };
  }
}

export async function listRevisionsAction(userId: string, siteId: string) {
  try {
    if (!userId || !siteId) return { success: false, error: 'Missing params', revisions: [] };
    const sb = await getSbService();
    const { data: siteRow } = await sb.from('sites').select('id').eq('id', siteId).eq('user_id', userId).maybeSingle();
    if (!siteRow) return { success: false, error: 'Not found', revisions: [] };
    const { data, error } = await sb.from('site_revisions').select('id,label,created_at').eq('site_id', siteId).order('created_at', { ascending: false }).limit(50);
    if (error) return { success: false, error: error.message, revisions: [] };
    return { success: true, revisions: data };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Unexpected error', revisions: [] };
  }
}

export async function restoreRevisionAction(prev: any, formData: FormData) {
  try {
    const userId = String(formData.get('userId') || '');
    const siteId = String(formData.get('siteId') || '');
    const revisionId = String(formData.get('revisionId') || '');
    if (!userId || !siteId || !revisionId) return { success: false, error: 'Missing data' };
    const sb = await getSbService();
    const { data: siteRow } = await sb.from('sites').select('id').eq('id', siteId).eq('user_id', userId).maybeSingle();
    if (!siteRow) return { success: false, error: 'Not found' };
    const { data: rev, error: rErr } = await sb.from('site_revisions').select('snapshot').eq('id', revisionId).eq('site_id', siteId).maybeSingle();
    if (rErr || !rev) return { success: false, error: rErr?.message || 'Revision not found' };
    const files: { path: string; content: string }[] = (rev as any).snapshot?.files || [];
    if (!Array.isArray(files)) return { success: false, error: 'Invalid snapshot' };
    // Upsert files back
    const rows = files.map(f => ({ site_id: siteId, path: f.path, content: f.content, updated_by: userId }));
    const { error: upErr } = await sb.from('site_files').upsert(rows, { onConflict: 'site_id,path' });
    if (upErr) return { success: false, error: upErr.message };
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Unexpected error' };
  }
}

// Upload data: URLs in files to Storage and rewrite references in file contents
export async function optimizeAssetsAction(prev: any, formData: FormData) {
  try {
    const userId = String(formData.get('userId') || '');
    const siteId = String(formData.get('siteId') || '');
    if (!userId || !siteId) return { success: false, error: 'Missing data' };
    const sb = await getSbService();
    const { data: files, error: fErr } = await sb.from('site_files').select('path,content').eq('site_id', siteId);
    if (fErr) return { success: false, error: fErr.message };
    const assetPrefix = `${userId}/${siteId}`;
    const uploadedMap: Record<string, string> = {};
    // Helper: upload one data URI, return public URL
    const uploadDataUri = async (dataUri: string, suggestedName: string) => {
      if (uploadedMap[dataUri]) return uploadedMap[dataUri];
      const m = dataUri.match(/^data:([^;]+);base64,(.+)$/);
      if (!m) return dataUri;
      const mime = m[1];
      const b64 = m[2];
      const ext = mime.split('/')[1] || 'bin';
      const name = `${assetPrefix}/${Date.now()}-${Math.random().toString(36).slice(2)}-${suggestedName.replace(/[^a-z0-9._-]+/gi,'_')}.${ext}`;
      const bin = Buffer.from(b64, 'base64');
      // Upload
      const { data, error } = await (sb as any).storage.from('site-assets').upload(name, bin, { contentType: mime, upsert: true });
      if (error) throw error;
      const { data: pub } = (sb as any).storage.from('site-assets').getPublicUrl(name);
      uploadedMap[dataUri] = pub?.publicUrl || dataUri;
      return uploadedMap[dataUri];
    };
    // Process files: replace exact data URI occurrences with uploaded URLs
    const updated: { path: string; content: string }[] = [];
    for (const f of files || []) {
      let content = String(f.content || '');
      const matches = content.match(/data:[^"')\s]+;base64,[A-Za-z0-9+/=]+/g);
      if (matches && matches.length) {
        for (const du of Array.from(new Set(matches))) {
          const url = await uploadDataUri(du, f.path.split('/').pop() || 'asset');
          content = content.split(du).join(url);
        }
        updated.push({ path: f.path, content });
      }
    }
    if (updated.length) {
      const rows = updated.map(u => ({ site_id: siteId, path: u.path, content: u.content, updated_by: userId }));
      const { error: upErr } = await sb.from('site_files').upsert(rows, { onConflict: 'site_id,path' });
      if (upErr) return { success: false, error: upErr.message };
    }
    return { success: true, updated: updated.length };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Unexpected error' };
  }
}

export async function duplicateSiteAction(prev: any, formData: FormData) {
  try {
    const userId = String(formData.get('userId') || '');
    const siteId = String(formData.get('siteId') || '');
    const newName = String(formData.get('newName') || '').trim();
    if (!userId || !siteId || !newName) return { success: false, error: 'Missing data' };
    const sb = await getSbService();
    const { data: site } = await sb.from('sites').select('id,types,meta').eq('id', siteId).eq('user_id', userId).maybeSingle();
    if (!site) return { success: false, error: 'Not found' };
    const slug = newName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0,50) || `${Date.now()}`;
    const { data: created, error: cErr } = await sb.from('sites').insert({ user_id: userId, name: newName, slug, types: site.types || [], meta: site.meta || {} }).select('id').single();
    if (cErr) return { success: false, error: cErr.message };
    const newId = created!.id as string;
    const { data: files } = await sb.from('site_files').select('path,content').eq('site_id', siteId);
    if (files && files.length) {
      const rows = files.map(f => ({ site_id: newId, path: f.path, content: f.content, updated_by: userId }));
      await sb.from('site_files').upsert(rows, { onConflict: 'site_id,path' });
    }
    return { success: true, siteId: newId };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Unexpected error' };
  }
}

// ===== Chat persistence (DB) =====

export async function addChatMessageAction(prev: any, formData: FormData) {
  try {
    const userId = String(formData.get('userId') || '');
    const siteId = String(formData.get('siteId') || '');
    const role = String(formData.get('role') || '');
    const text = String(formData.get('text') || '');
    const file = formData.get('file') ? String(formData.get('file')) : null;
    const inputTokensRaw = formData.get('inputTokens');
    const outputTokensRaw = formData.get('outputTokens');
    const model = formData.get('model') ? String(formData.get('model')) : null;
    const metadataRaw = formData.get('metadata');
    if (!userId || !siteId || !role || !text) return { success: false, error: 'Missing data' };
    const sb = await getSbService();
    let metadata: any = null;
    if (metadataRaw) {
      try {
        metadata = JSON.parse(String(metadataRaw));
      } catch {
        metadata = null;
      }
    }
    const inputTokens = inputTokensRaw != null ? Number(inputTokensRaw) : null;
    const outputTokens = outputTokensRaw != null ? Number(outputTokensRaw) : null;
    const payload: Record<string, any> = {
      user_id: userId,
      site_id: siteId,
      role,
      text,
      file,
    };
    if (Number.isFinite(inputTokens ?? NaN)) payload.input_tokens = Math.round(Number(inputTokens));
    if (Number.isFinite(outputTokens ?? NaN)) payload.output_tokens = Math.round(Number(outputTokens));
    if (model) payload.model = model;
    if (metadata && typeof metadata === 'object') payload.metadata = metadata;
    const { data, error } = await sb.from('project_chat').insert(payload).select('id,created_at').single();
    if (error) return { success: false, error: error.message };
    return { success: true, id: data.id, created_at: data.created_at };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Unexpected error' };
  }
}

export async function listChatAction(userId: string, siteId: string, limit: number = 200) {
  try {
    if (!userId || !siteId) return { success: false, error: 'Missing params', messages: [] };
    const sb = await getSbService();
    // ensure ownership via sites
    const { data: site } = await sb.from('sites').select('id').eq('id', siteId).eq('user_id', userId).maybeSingle();
    if (!site) return { success: false, error: 'Not found', messages: [] };
    const { data, error } = await sb
      .from('project_chat')
      .select('id,role,text,file,created_at,input_tokens,output_tokens,model,metadata')
      .eq('site_id', siteId)
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) return { success: false, error: error.message, messages: [] };
    return { success: true, messages: data };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Unexpected error', messages: [] };
  }
}

// ===== Server-side persistence for editor (no client writes) =====

const ensureProjectSchema = z.object({
  userId: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  types: z.array(z.string()).optional(),
  domain: z.string().optional(),
  initialInputTokens: z
    .union([z.number(), z.string()])
    .optional()
    .transform((val) => (typeof val === 'string' ? Number(val) : val)),
  initialOutputTokens: z
    .union([z.number(), z.string()])
    .optional()
    .transform((val) => (typeof val === 'string' ? Number(val) : val)),
});

export async function ensureProjectAction(prev: any, formData: FormData) {
  try {
    const parsed = ensureProjectSchema.safeParse({
      userId: formData.get('userId'),
      slug: formData.get('slug'),
      name: formData.get('name'),
      types: JSON.parse(String(formData.get('types') || '[]') || '[]'),
      domain: formData.get('domain') || undefined,
      initialInputTokens: formData.get('initialInputTokens') || undefined,
      initialOutputTokens: formData.get('initialOutputTokens') || undefined,
    });
    if (!parsed.success) return { success: false, error: 'Invalid data' };
    const { userId, slug, name, types, domain, initialInputTokens, initialOutputTokens } = parsed.data;
    const sb = await getSbService();
    const { data: found } = await sb.from('sites').select('id').eq('user_id', userId).eq('slug', slug).maybeSingle();
    if (found?.id) return { success: true, siteId: found.id };
    const seedInput = Number(initialInputTokens ?? 0);
    const seedOutput = Number(initialOutputTokens ?? 0);
    const safeSeedInput = Number.isFinite(seedInput) ? Math.max(0, Math.round(seedInput)) : 0;
    const safeSeedOutput = Number.isFinite(seedOutput) ? Math.max(0, Math.round(seedOutput)) : 0;
    const { data: created, error } = await sb
      .from('sites')
      .insert({
        user_id: userId,
        name,
        slug,
        types: types || [],
        meta: { domain },
        total_input_tokens: safeSeedInput,
        total_output_tokens: safeSeedOutput,
      })
      .select('id')
      .single();
    if (error) return { success: false, error: error.message };
    return { success: true, siteId: created?.id };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Unexpected error' };
  }
}

const upsertFilesSchema = z.object({
  userId: z.string().min(1),
  siteId: z.string().min(1),
  changes: z.string().min(2), // JSON: Record<string,string>
});

export async function upsertSiteFilesAction(prev: any, formData: FormData) {
  try {
    const parsed = upsertFilesSchema.safeParse({
      userId: formData.get('userId'),
      siteId: formData.get('siteId'),
      changes: formData.get('changes'),
    });
    if (!parsed.success) return { success: false, error: 'Invalid data' };
    const { userId, siteId } = parsed.data;
    let changes: Record<string, string> = {};
    try { changes = JSON.parse(parsed.data.changes); } catch { return { success: false, error: 'Invalid JSON for changes' }; }
    const sb = await getSbService();
    // Ownership check
    const { data: site } = await sb.from('sites').select('id').eq('id', siteId).eq('user_id', userId).maybeSingle();
    if (!site) return { success: false, error: 'Not found' };
    const rows = Object.entries(changes).map(([path, content]) => ({ site_id: siteId, path, content, updated_by: userId }));
    if (rows.length) {
      const chunkSize = 40;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const slice = rows.slice(i, i + chunkSize);
        const { error } = await sb.from('site_files').upsert(slice, { onConflict: 'site_id,path' });
        if (error) return { success: false, error: error.message };
      }
      await sb.from('sites').update({ updated_at: new Date().toISOString(), last_opened_at: new Date().toISOString() }).eq('id', siteId);
    }
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Unexpected error' };
  }
}

const deleteFilesSchema = z.object({
  userId: z.string().min(1),
  siteId: z.string().min(1),
  paths: z.string().min(2), // JSON: string[]
});

export async function deleteSiteFilesAction(prev: any, formData: FormData) {
  try {
    const parsed = deleteFilesSchema.safeParse({
      userId: formData.get('userId'),
      siteId: formData.get('siteId'),
      paths: formData.get('paths'),
    });
    if (!parsed.success) return { success: false, error: 'Invalid data' };
    const { userId, siteId } = parsed.data;
    let arr: string[] = [];
    try { arr = JSON.parse(parsed.data.paths); } catch { return { success: false, error: 'Invalid JSON for paths' }; }
    const sb = await getSbService();
    const { data: site } = await sb.from('sites').select('id').eq('id', siteId).eq('user_id', userId).maybeSingle();
    if (!site) return { success: false, error: 'Not found' };
    for (const p of arr) {
      await sb.from('site_files').delete().eq('site_id', siteId).eq('path', p);
    }
    await sb.from('sites').update({ updated_at: new Date().toISOString() }).eq('id', siteId);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Unexpected error' };
  }
}
