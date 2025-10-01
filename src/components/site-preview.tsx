'use client';

import { useState, useEffect, useMemo, useRef, useCallback, useActionState } from 'react';
import type { Site } from '@/lib/generation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Globe } from 'lucide-react';

import {
  ArrowLeft,
  Download,
  Folder,
  FolderOpen,
  RefreshCw,
  Code,
  Loader2,
  Check,
  Circle,
  Settings as SettingsIcon,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Send,
  Eye,
  UploadCloud,
  User,
  LogOut,
  // extra icons for menus (Folder/Globe already imported above)
  FilePlus,
  FolderPlus,
  FileCode,
  FileJson,
  Image as ImageIcon,
  FileText,
  File,
  Palette,
  X,
  Package,
  MousePointerSquareDashed as MousePointerSquare,
  Search,
  Rocket,
  EyeOff,
  Wrench,
  Trash2,
  Archive,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

import { downloadZipAction, editCodeAction, editCodeBulkAction, editElementAction, testCpanelConnectionAction, loadPublishSettingsAction, loadDeployedSitesAction, addChatMessageAction, listChatAction, ensureProjectAction, upsertSiteFilesAction, deleteSiteFilesAction } from '@/app/actions';
import { getSupabase } from '@/lib/supabaseClient';
import { PublishSettingsDialog } from '@/components/publish-settings-dialog';
import { publishToCpanelAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import Editor, { DiffEditor } from '@monaco-editor/react';
import debounce from 'lodash/debounce';
import { emmetHTML, emmetCSS, emmetJSX } from 'emmet-monaco-es';
import { deriveDomainName, extractTypes, slugifyForDomain, toExternalUrl } from '@/lib/domain';

interface SitePreviewProps {
  site: Site;
  onBack: () => void;
  initialSiteId?: string;
}

type TreeNode = {
  name: string;
  type: 'folder' | 'file';
  path: string;
  children?: TreeNode[];
};

type ChatMessage = {
  id?: string;
  sender: 'user' | 'ai';
  text: string;
  file?: string;
  diff?: { added: number; removed: number };
  diffs?: { file: string; added: number; removed: number }[];
  createdAt?: string;
  inputTokens?: number;
  outputTokens?: number;
  model?: string;
  pending?: boolean;
  language?: string;
  modifications?: { fileName: string; code: string | null }[];
  isApplied?: boolean;
};

type OpenTab = {
  path: string;
};

type ElementTarget = {
  fileName: string;
  elementHtml: string;
  tagName?: string | null;
  elementId?: string | null;
  path?: string | null;
};

const CHAT_CACHE_PREFIX = 'wg-chat-cache:';

const decodeBytes = (bytes: Uint8Array): string => {
  if (typeof TextDecoder !== 'undefined') {
    try {
      return new TextDecoder().decode(bytes);
    } catch {
      /* ignore */
    }
  }
  let result = '';
  for (let i = 0; i < bytes.length; i += 1) {
    result += String.fromCharCode(bytes[i]);
  }
  return result;
};

const toUint8Array = (raw: unknown): Uint8Array | null => {
  if (raw instanceof Uint8Array) return raw;
  if (typeof ArrayBuffer !== 'undefined') {
    if (raw instanceof ArrayBuffer) {
      return new Uint8Array(raw);
    }
    if (typeof ArrayBuffer.isView === 'function' && ArrayBuffer.isView(raw as ArrayBufferView)) {
      const view = raw as ArrayBufferView;
      return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
    }
  }
  if (raw && typeof raw === 'object') {
    const maybe = raw as any;
    if (maybe.type === 'Buffer' && Array.isArray(maybe.data)) {
      try {
        return Uint8Array.from(maybe.data as number[]);
      } catch {
        return null;
      }
    }
    if (Array.isArray(maybe)) {
      try {
        return Uint8Array.from(maybe as number[]);
      } catch {
        return null;
      }
    }
  }
  return null;
};

const toStringContent = (raw: unknown): string => {
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object') {
    const maybe = raw as any;
    if (typeof maybe.content === 'string') return maybe.content;
    if (maybe.content) {
      const nested = toUint8Array(maybe.content);
      if (nested) return decodeBytes(nested);
    }
  }
  const bytes = toUint8Array(raw);
  if (bytes) return decodeBytes(bytes);
  if (raw != null) {
    return String(raw);
  }
  return '';
};
type BulkModification = { fileName: string; code?: string | null | undefined };


const getChatCacheKey = (siteId: string | null, slug: string) => {
  const safeSlug = slug && slug.length ? slug : 'untitled';
  const base = siteId ? `site:${siteId}` : `draft:${safeSlug}`;
  return `${CHAT_CACHE_PREFIX}${base}`;
};

const generateMessageId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const createPendingAiMessage = (id: string, file?: string): ChatMessage => ({
  id,
  sender: 'ai',
  text: '',
  file,
  createdAt: new Date().toISOString(),
  pending: true,
});

type ProjectRecord = {
  id: string;
  name: string;
  slug: string;
  updated_at: string;
  status?: string | null;
  meta?: Record<string, any> | null;
};

type DeployedRecord = {
  id: string;
  domain: string;
  url?: string | null;
  created_at: string;
  status?: string | null;
};

type ProjectStatusKey = 'all' | 'work' | 'deploy' | 'cloaking' | 'archived';

const deriveProjectDomain = (project: ProjectRecord): string =>
  deriveDomainName(
    {
      domain: typeof project.meta?.domain === 'string' ? project.meta.domain : undefined,
      customDomain: typeof project.meta?.customDomain === 'string' ? project.meta.customDomain : undefined,
      types: extractTypes(project.meta || null),
    },
    project.slug,
    project.name,
  );

const PROJECT_STATUS_PRESETS: { key: ProjectStatusKey; label: string; matches: string[] | null }[] = [
  { key: 'all', label: 'All', matches: null },
  { key: 'work', label: 'In Progress', matches: ['draft', 'work', 'in_progress', 'pending', 'edit'] },
  { key: 'deploy', label: 'Deploy', matches: ['deploy', 'published', 'live', 'production'] },
  { key: 'cloaking', label: 'Cloaking', matches: ['cloak', 'cloaking', 'stealth'] },
  { key: 'archived', label: 'Archived', matches: ['archive', 'archived'] },
];

const PROJECT_GROUP_ORDER: ProjectStatusKey[] = ['work', 'deploy', 'cloaking', 'archived', 'all'];

const PROJECT_STATUS_STYLES: Record<ProjectStatusKey, { label: string; badgeClass: string; icon: JSX.Element; accentColor: string }> = {
  all: {
    label: 'All',
    badgeClass: 'border border-white/15 bg-white/10 text-slate-100/85',
    accentColor: 'rgba(148, 163, 184, 0.6)',
    icon: <Rocket className="h-3.5 w-3.5" />,
  },
  work: {
    label: 'In Progress',
    badgeClass: 'border border-sky-400/35 bg-sky-500/15 text-sky-100',
    accentColor: 'rgba(56, 189, 248, 0.65)',
    icon: <Wrench className="h-3.5 w-3.5" />,
  },
  deploy: {
    label: 'Deployed',
    badgeClass: 'border border-emerald-400/35 bg-emerald-500/15 text-emerald-100',
    accentColor: 'rgba(16, 185, 129, 0.65)',
    icon: <Rocket className="h-3.5 w-3.5" />,
  },
  cloaking: {
    label: 'Cloaking',
    badgeClass: 'border border-purple-400/35 bg-purple-500/15 text-purple-100',
    accentColor: 'rgba(168, 85, 247, 0.65)',
    icon: <EyeOff className="h-3.5 w-3.5" />,
  },
  archived: {
    label: 'Archived',
    badgeClass: 'border border-rose-400/35 bg-rose-500/15 text-rose-100',
    accentColor: 'rgba(244, 63, 94, 0.6)',
    icon: <Archive className="h-3.5 w-3.5" />,
  },
};

const PROJECTS_PAGE_SIZE = 10;

const deriveProjectStatus = (row: ProjectRecord): ProjectStatusKey => {
  const status = (row.status || '').toLowerCase();
  const metaMode = typeof row.meta?.mode === 'string' ? row.meta.mode.toLowerCase() : '';
  if ([status, metaMode].some((value) => value.includes('cloak'))) return 'cloaking';
  if ([status, metaMode].some((value) => value.includes('deploy') || value.includes('publish') || value.includes('live'))) return 'deploy';
  if ([status, metaMode].some((value) => value.includes('draft') || value.includes('work') || value.includes('pending'))) return 'work';
  if ([status, metaMode].some((value) => value.includes('archive'))) return 'archived';
  return 'all';
};

const normalizeCachedMessage = (entry: any): ChatMessage | null => {
  if (!entry || typeof entry !== 'object') return null;
  const sender = entry.sender === 'ai' ? 'ai' : entry.sender === 'user' ? 'user' : null;
  if (!sender) return null;
  const text = typeof entry.text === 'string' ? entry.text : '';
  const message: ChatMessage = { sender, text };
  message.id = typeof entry.id === 'string' ? entry.id : generateMessageId();
  if (typeof entry.file === 'string') message.file = entry.file;
  if (typeof entry.createdAt === 'string') message.createdAt = entry.createdAt;
  if (typeof entry.inputTokens === 'number') message.inputTokens = entry.inputTokens;
  if (typeof entry.outputTokens === 'number') message.outputTokens = entry.outputTokens;
  if (typeof entry.model === 'string') message.model = entry.model;
  message.pending = !!entry.pending && sender === 'ai';
  if (entry.diff && typeof entry.diff === 'object') {
    const { added, removed } = entry.diff as { added?: unknown; removed?: unknown };
    if (typeof added === 'number' && typeof removed === 'number') {
      message.diff = { added, removed };
    }
  }
  if (Array.isArray(entry.diffs)) {
    const diffs = entry.diffs
      .map((d: any) => {
        if (!d || typeof d !== 'object') return null;
        const { file, added, removed } = d as { file?: unknown; added?: unknown; removed?: unknown };
        if (typeof file === 'string' && typeof added === 'number' && typeof removed === 'number') {
          return { file, added, removed };
        }
        return null;
      })
      .filter((d: { file: string; added: number; removed: number } | null): d is { file: string; added: number; removed: number } => d !== null);
    if (diffs.length) message.diffs = diffs;
  }
  return message;
};

// Compute line-based diff statistics (added/removed) using LCS (memory-optimized)
function computeDiffStats(oldText: string, newText: string): { added: number; removed: number } {
  const a = (oldText || '').split(/\r?\n/);
  const b = (newText || '').split(/\r?\n/);
  const m = a.length;
  const n = b.length;
  const prev: number[] = new Array(n + 1).fill(0);
  const curr: number[] = new Array(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1] + 1;
      } else {
        curr[j] = Math.max(prev[j], curr[j - 1]);
      }
    }
    // swap rows
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  const lcs = prev[n];
  return {
    added: Math.max(0, n - lcs),
    removed: Math.max(0, m - lcs),
  };
}

const formatTimestamp = (iso?: string) => {
  if (!iso) return '';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleString();
};

const initialEditState: {
  success: boolean;
  error: string | null;
  response: { code: string; reasoning: string; usage?: { inputTokens?: number; outputTokens?: number }; model?: string } | null;
  chat: {
    created_at?: string;
    input_tokens?: number | null;
    output_tokens?: number | null;
    model?: string | null;
    metadata?: any;
    text?: string;
    file?: string;
  } | null;
} = {
  success: false,
  error: null,
  response: null,
  chat: null,
};

const initialElementEditState: {
  success: boolean;
  error: string | null;
  response: {
    fileName: string;
    code: string;
    elementHtml: string;
    css: string | null;
    reasoning: string;
    usage?: { inputTokens?: number; outputTokens?: number };
    model?: string;
    assets?: { path: string; content: string }[];
  } | null;
  chat: {
    created_at?: string;
    input_tokens?: number | null;
    output_tokens?: number | null;
    model?: string | null;
    metadata?: any;
    text?: string;
    file?: string;
  } | null;
} = {
  success: false,
  error: null,
  response: null,
  chat: null,
};


export function SitePreview({
  site: initialSite,
  onBack,
  initialSiteId,
}: SitePreviewProps) {
  const [site, setSite] = useState(initialSite);
  // Derive a human-readable site name from index.html <title> if present
  const displayName = useMemo(() => {
    try {
      const html = (site.files['index.html'] as string) || '';
      const match = html.match(/<title>([^<]*)<\/title>/i);
      const title = match?.[1]?.trim();
      return title && title.length > 0 ? title : (site.domain || 'Website');
    } catch {
      return site.domain || 'Website';
    }
  }, [site]);

  // Slug for filenames/folders (fallbacks to domain or generic name)
  const slugName = useMemo(() => {
    const base = displayName || site.domain || 'website';
    const slug = slugifyForDomain(base);
    if (slug) return slug;
    const domainSlug = typeof site.domain === 'string' ? slugifyForDomain(site.domain) : '';
    return domainSlug || 'website';
  }, [displayName, site.domain]);
  const cacheIdentity = site.domain || slugName;
  const [activeFile, setActiveFile] = useState<string>('index.html');
  const [previewSrc, setPreviewSrc] = useState<string>('');
  const previewWindowsRef = useRef(new Set<Window>());
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const { toast } = useToast();
  const [isPublishOpen, setIsPublishOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userDisplayName, setUserDisplayName] = useState<string | null>(null);
  const [siteId, setSiteId] = useState<string | null>(initialSiteId || null);
  const [isPersisting, setIsPersisting] = useState(false);
  const [persistError, setPersistError] = useState<string | null>(null);
  const [autoPublishPending, setAutoPublishPending] = useState(false);
  const [cpHost, setCpHost] = useState('');
  const [cpUser, setCpUser] = useState('');
  const [cpToken, setCpToken] = useState('');
  const [targetDomain, setTargetDomain] = useState('');
  const [docRoot, setDocRoot] = useState(`/website/${slugName}`);
  const initialTestState = { success: false, message: '' };
  const [testState, setTestState] = useState<any>(initialTestState);
  const [isTestingConn, setIsTestingConn] = useState(false);
  const testConnFormAction = async (formData: FormData) => {
    setIsTestingConn(true);
    try {
      const result = await testCpanelConnectionAction({}, formData);
      setTestState(result);
    } catch (e) {
      setTestState({ success: false, message: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      setIsTestingConn(false);
    }
  };
  const [publishProgress, setPublishProgress] = useState<number>(0);
  const [publishLog, setPublishLog] = useState<string[]>([]);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [credsLoaded, setCredsLoaded] = useState(false);
  const [revisions, setRevisions] = useState<Record<string, { before: string; after: string; ts: number; added: number; removed: number }[]>>({});
  const [diffView, setDiffView] = useState<{ file: string; before: string; after: string } | null>(null);
  const initialBulkState: any = { success: false, error: null, results: null, usage: null, model: null, chat: null };
  const [bulkState, bulkFormAction, isBulkEditing] = useActionState<any, FormData>(editCodeBulkAction as any, { ...initialBulkState, reasoning: null } as any);
  const [wholeSiteScope, setWholeSiteScope] = useState(true);
  const [pendingBulkOriginal, setPendingBulkOriginal] = useState<Record<string,string> | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [deployedSites, setDeployedSites] = useState<DeployedRecord[]>([]);
  const [isProjectsOpen, setIsProjectsOpen] = useState(false);
  const [myProjects, setMyProjects] = useState<ProjectRecord[]>([]);
  const [projectsSearch, setProjectsSearch] = useState('');
  const [projectsPreset, setProjectsPreset] = useState<ProjectStatusKey>('all');
  const [projectsSort, setProjectsSort] = useState<'recent' | 'name' | 'status'>('recent');
  const [projectsPage, setProjectsPage] = useState(1);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [projectsDeleteTarget, setProjectsDeleteTarget] = useState<ProjectRecord | null>(null);
  const [projectsDeletePending, setProjectsDeletePending] = useState(false);
  

  const suggestedDomain = useMemo(() => {
    const selectedTypes = ((site as any).types as string[]) || [];
    return deriveDomainName(
      {
        domain: typeof site.domain === 'string' ? site.domain : undefined,
        types: selectedTypes,
      },
      slugName,
      displayName,
    );
  }, [site, slugName, displayName]);
  const suggestedDocroot = useMemo(() => `/website/${suggestedDomain}`, [suggestedDomain]);

  // Fetch user profile on mount
  useEffect(() => {
    (async () => {
      const sb = await getSupabase();
      if (!sb) return;
      const { data: { user } } = await sb.auth.getUser();
      if (user?.id) {
        setUserId(user.id);
        setUserDisplayName((user.user_metadata as any)?.full_name || (user.user_metadata as any)?.name || user.email || null);
        const { data: profile } = await sb.from('profiles').select('avatar_url').eq('id', user.id).single();
        if (profile) setAvatarUrl(profile.avatar_url);
      }
    })();
  }, []);

  // Ensure a persistent project exists for this session; create if missing
  useEffect(() => {
    (async () => {
      if (!userId || siteId) return;
      const sb = await getSupabase();
      if (!sb) return;
      try {
        setIsPersisting(true);
        // Try find existing by (user, slug)
        const slug = slugName;
        const { data: found, error: findErr } = await sb
          .from('sites')
          .select('id')
          .eq('user_id', userId)
          .eq('slug', slug)
          .maybeSingle();
        let id = found?.id as string | undefined;
        if (!id) {
          const { data: created, error: insErr } = await sb
            .from('sites')
            .insert({
              user_id: userId,
              name: displayName,
              slug,
              types: (site as any).types || [],
              meta: { domain: site.domain },
            })
            .select('id')
            .single();
          if (insErr) {
            console.error('Supabase insert error (sites):', insErr);
            throw new Error(insErr.message || 'Insert failed');
          }
          id = created?.id;
        } else {
          // keep metadata fresh
          const { error: updErr } = await sb.from('sites').update({ name: displayName, updated_at: new Date().toISOString() }).eq('id', id);
          if (updErr) {
            console.error('Supabase update error (sites):', updErr);
          }
        }
        if (!id) throw new Error('Failed to create site');
        setSiteId(id);
        // Bulk upsert initial files
        const rows = Object.entries(site.files).map(([path, content]) => ({
          site_id: id,
          path,
          content: String(content || ''),
          updated_by: userId,
        }));
        if (rows.length) {
          const chunkSize = 40;
          for (let i = 0; i < rows.length; i += chunkSize) {
            const slice = rows.slice(i, i + chunkSize);
            const { error: upErr } = await sb.from('site_files').upsert(slice, { onConflict: 'site_id,path' });
            if (upErr) {
              console.error('Supabase upsert error (site_files):', upErr);
              break;
            }
          }
        }
      } catch (e: any) {
        console.error('Persist init failed', e?.message || e);
        setPersistError(e?.message || 'Failed to persist');
      } finally {
        setIsPersisting(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, slugName]);

  // Flush pending saves when siteId/userId become available
  useEffect(() => {
    if (siteId && userId) {
      try { (flushSavesDebounced as any).flush?.(); } catch {}
      flushSavesDebounced();
    }
  }, [siteId, userId]);


  // Prefill domain with TLD based on selected types when opening modal
  // Load saved Publish settings from DB when opening modal (if not already filled)
  useEffect(() => {
    if (!isPublishOpen) {
      // Reset on close to ensure fresh state next time
      if (testState.message) setTestState(initialTestState);
      return;
    }

    setCredsLoaded(false);
    setPublishProgress(0);
    setPublishLog([]);
    setPublishedUrl(null);

    const immediateDomain = suggestedDomain || '';
    setTargetDomain(immediateDomain);
    if (immediateDomain) {
      setDocRoot(`/website/${immediateDomain.replace(/^www\./, '')}`);
    } else {
      setDocRoot('');
    }

    (async () => {
      try {
        const sb = await getSupabase();
        if (!sb) return;
        const { data } = await sb.auth.getUser();
        const uid = data.user?.id;
        setUserId(uid || null);

        let dbSettings: any = {};
        if (!uid) return;
        const fd = new FormData();
        fd.set('userId', uid);
        const res: any = await loadPublishSettingsAction({}, fd as any);
        if (res?.success && res.settings) {
          dbSettings = res.settings;
        }

        // Set credentials from DB, always overwriting
        setCpHost(dbSettings.host || '');
        setCpUser(dbSettings.username || '');
        setCpToken(dbSettings.token || '');

        const savedDomain = typeof dbSettings.domain === 'string' ? dbSettings.domain : '';
        const savedDocroot = typeof dbSettings.docroot === 'string' ? dbSettings.docroot : '';

        if (!suggestedDomain && savedDomain) {
          setTargetDomain(savedDomain);
          setDocRoot(savedDocroot || `/website/${savedDomain.replace(/^www\./, '')}`);
        } else if (suggestedDomain && savedDomain && suggestedDomain === savedDomain && savedDocroot) {
          setDocRoot(savedDocroot);
        }
      } catch (e) { console.error("Failed to load publish settings", e); }
      finally { setCredsLoaded(true); }
    })();
  }, [isPublishOpen, suggestedDomain, suggestedDocroot]);

  // Load deployed sites when modal is opened
  useEffect(() => {
    if (!isProjectsOpen || !userId) return;
    let cancelled = false;
    (async () => {
      setProjectsLoading(true);
      setProjectsError(null);
      try {
        const sb = await getSupabase();
        if (!sb) throw new Error('Supabase not configured');
        const [projectsRes, deployRes] = await Promise.all([
          sb
            .from('sites')
            .select('id,name,slug,updated_at,status,meta')
            .eq('user_id', userId)
            .order('updated_at', { ascending: false }),
          loadDeployedSitesAction(userId),
        ]);
        if (cancelled) return;
        if (projectsRes.error) throw projectsRes.error;
        const rows = (projectsRes.data || []).map((row: any) => ({
          ...row,
          meta: row.meta || null,
        })) as ProjectRecord[];
        setMyProjects(rows);
        if (deployRes.success) {
          setDeployedSites((deployRes.sites || []) as DeployedRecord[]);
        } else if (deployRes.error) {
          setProjectsError((prev) => prev ?? (deployRes.error as string));
        }
      } catch (e: any) {
        if (cancelled) return;
        const message = e?.message || 'Failed to load projects';
        setProjectsError(message);
        toast({ variant: 'destructive', title: 'Error', description: message });
      } finally {
        if (!cancelled) setProjectsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isProjectsOpen, userId, toast]);

  useEffect(() => {
    setProjectsPage(1);
  }, [projectsSearch, projectsPreset, projectsSort]);

  const sortedProjects = useMemo(() => {
    if (!myProjects.length) return [];
    const clone = [...myProjects];
    switch (projectsSort) {
      case 'name':
        return clone.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
      case 'status':
        return clone.sort((a, b) => deriveProjectStatus(a).localeCompare(deriveProjectStatus(b)));
      case 'recent':
      default:
        return clone.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    }
  }, [myProjects, projectsSort]);

  const filteredProjects = useMemo(() => {
    const query = projectsSearch.trim().toLowerCase();
    return sortedProjects.filter((project) => {
      const presetMeta = PROJECT_STATUS_PRESETS.find((preset) => preset.key === projectsPreset);
      const matchesPreset = !presetMeta || !presetMeta.matches
        ? true
        : presetMeta.matches.some((value) => {
            const status = (project.status || '').toLowerCase();
            const metaMode = typeof project.meta?.mode === 'string' ? project.meta.mode.toLowerCase() : '';
            const derived = deriveProjectStatus(project);
            return status.includes(value) || metaMode.includes(value) || derived === presetMeta.key;
          });
      if (!matchesPreset) return false;
      if (!query) return true;
      const domain = deriveProjectDomain(project).toLowerCase();
      return (
        project.name.toLowerCase().includes(query) ||
        project.slug.toLowerCase().includes(query) ||
        domain.includes(query)
      );
    });
  }, [sortedProjects, projectsPreset, projectsSearch]);

  const projectsTotalPages = Math.max(1, Math.ceil(filteredProjects.length / PROJECTS_PAGE_SIZE));
  const projectsCurrentPage = Math.min(projectsPage, projectsTotalPages);
  const paginatedProjects = filteredProjects.slice((projectsCurrentPage - 1) * PROJECTS_PAGE_SIZE, projectsCurrentPage * PROJECTS_PAGE_SIZE);

  const groupedProjects = useMemo(() => {
    const buckets = new Map<ProjectStatusKey, ProjectRecord[]>();
    paginatedProjects.forEach((project) => {
      const resolved = deriveProjectStatus(project);
      const bucketKey = PROJECT_GROUP_ORDER.includes(resolved) ? resolved : 'all';
      const list = buckets.get(bucketKey) ?? [];
      list.push(project);
      buckets.set(bucketKey, list);
    });
    return PROJECT_GROUP_ORDER
      .filter((key) => (buckets.get(key) ?? []).length > 0)
      .map((key) => ({
        key,
        label: key === 'all' ? 'Other' : PROJECT_STATUS_STYLES[key].label,
        accent: PROJECT_STATUS_STYLES[key].accentColor,
        projects: buckets.get(key) ?? [],
      }));
  }, [paginatedProjects]);

  useEffect(() => {
    if (projectsPage !== projectsCurrentPage) setProjectsPage(projectsCurrentPage);
  }, [projectsCurrentPage, projectsPage]);

  const renderProjectBadge = (project: ProjectRecord) => {
    const descriptor = PROJECT_STATUS_STYLES[deriveProjectStatus(project)];
    return (
      <Badge className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium ${descriptor.badgeClass}`}>
        {descriptor.icon}
        <span>{descriptor.label}</span>
      </Badge>
    );
  };

  const handleProjectOpen = useCallback(async (project: ProjectRecord) => {
    try {
      const sb = await getSupabase();
      if (!sb) throw new Error('Supabase is not configured');
      const { data: files, error } = await sb
        .from('site_files')
        .select('path,content')
        .eq('site_id', project.id);
      if (error) throw error;
      const map: Record<string, string> = {};
      (files || []).forEach((file: any) => {
        if (file?.path) map[file.path] = file.content || '';
      });
      setSite((prev) => ({
        ...prev,
        domain: project.slug || prev.domain,
        files: { ...map },
      }));
      setSiteId(project.id);
      setIsProjectsOpen(false);
      toast({ title: 'Project opened', description: `Loaded “${project.name}”.` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Unable to open', description: e?.message || 'Project load failed.' });
    }
  }, [toast, setSite, setSiteId, setIsProjectsOpen]);

  const handleProjectDelete = useCallback(async () => {
    if (!projectsDeleteTarget) return;
    try {
      setProjectsDeletePending(true);
      const sb = await getSupabase();
      if (!sb) throw new Error('Supabase is not configured');
      const { data: auth } = await sb.auth.getUser();
      if (!auth.user?.id) throw new Error('Session expired');
      const id = projectsDeleteTarget.id;
      await sb.from('site_files').delete().eq('site_id', id);
      const { error } = await sb.from('sites').delete().eq('id', id).eq('user_id', auth.user.id);
      if (error) throw error;
      setMyProjects((prev) => prev.filter((project) => project.id !== id));
      if (siteId === id) {
        setSiteId(null);
      }
      toast({ title: 'Project removed', description: `“${projectsDeleteTarget.name}” moved to archive.` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Failed', description: e?.message || 'Could not delete project.' });
    } finally {
      setProjectsDeletePending(false);
      setProjectsDeleteTarget(null);
    }
  }, [projectsDeleteTarget, toast, siteId, setSiteId]);


  // Auto-start removed — publish runs only when the user clicks Publish

  const runPublish = async () => {
    const baseOk = !!cpHost && !!cpUser && !!cpToken;
    if (!baseOk || !targetDomain || !docRoot) {
      toast({ variant: 'destructive', title: 'Missing data', description: 'Fill in the required fields before publishing.' });
      return;
    }
    setIsPublishing(true);
    setPublishProgress(0);
    setPublishLog(['Starting publish...']);
    setPublishedUrl(null);
    const payload = new FormData();
    if (userId) payload.set('userId', userId);
    payload.set('siteName', displayName);
    payload.set('host', cpHost);
    payload.set('user', cpUser);
    payload.set('token', cpToken);
    payload.set('domain', targetDomain);
    payload.set('docRoot', docRoot);
    payload.set('files', JSON.stringify(site.files));
    try {
      const res = await publishToCpanelAction({}, payload as any);
      setIsPublishing(false);
      // keep modal open and show result
      if (res.success) {
        setPublishProgress(4);
        setPublishLog((prev) => [...prev, ...(res.log || []), 'Done']);
        setPublishedUrl(res.url || null);
        toast({ title: 'Published', description: `Deployed to ${res.url}` });
      } else {
        setPublishLog((prev) => [...prev, res.error || 'Unknown error']);
        toast({ variant: 'destructive', title: 'Publish failed', description: res.error || 'Unknown error' });
      }
    } catch (err: any) {
      console.error('Publish action failed', err);
      setIsPublishing(false);
      const message = err?.message || 'Unexpected server response';
      setPublishLog((prev) => [...prev, message]);
      toast({ variant: 'destructive', title: 'Publish failed', description: message });
    }
  };

  // Revisions/Snapshots removed per request

  // Optimizer removed per request

  useEffect(() => {
    if (!isPublishOpen) return;
    if (!testState) return;
    if ((testState as any).message) {
      if ((testState as any).success) {
        toast({ title: 'Connection OK', description: (testState as any).message });
      } else {
        toast({ variant: 'destructive', title: 'Connection Failed', description: (testState as any).message });
      }
    }
  }, [testState, isPublishOpen, toast]);
  const [openFolders, setOpenFolders] = useState<Set<string>>(
    new Set(['scripts', 'styles', 'assets', 'assets/images'])
  );
  const [chatPrompt, setChatPrompt] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const pendingAiMessageIdsRef = useRef<{ code: string | null; element: string | null; bulk: string | null }>({ code: null, element: null, bulk: null });

  const settlePendingMessage = useCallback((key: 'code' | 'element' | 'bulk', message: ChatMessage) => {
    const placeholderId = pendingAiMessageIdsRef.current[key];
    pendingAiMessageIdsRef.current[key] = null;
    setChatHistory((prev) => {
      const next = [...prev];
      if (placeholderId) {
        const idx = next.findIndex((msg) => msg.id === placeholderId);
        if (idx !== -1) {
          next[idx] = { ...message, id: placeholderId, pending: false };
          return next;
        }
      }
      next.push({ ...message, id: message.id || generateMessageId(), pending: false });
      return next;
    });
  }, []);

  const clearPendingMessage = useCallback((key: 'code' | 'element' | 'bulk') => {
    const placeholderId = pendingAiMessageIdsRef.current[key];
    pendingAiMessageIdsRef.current[key] = null;
    if (!placeholderId) return;
    setChatHistory((prev) => prev.filter((msg) => msg.id !== placeholderId));
  }, []);

  const removeLatestUserMessage = useCallback((fileLabel?: string) => {
    setChatHistory((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i--) {
        const msg = next[i];
        if (msg.sender === 'user' && (fileLabel ? msg.file === fileLabel : true)) {
          next.splice(i, 1);
          break;
        }
      }
      return next;
    });
  }, []);

  const previousSiteIdRef = useRef<string | null>(siteId);
  const previousCacheIdentityRef = useRef<string>(cacheIdentity);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const cacheKey = getChatCacheKey(siteId, cacheIdentity);
    try {
      const raw = window.localStorage.getItem(cacheKey);
      if (!raw) {
        setChatHistory([]);
        return;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        setChatHistory([]);
        return;
      }
      const normalized = parsed
        .map(normalizeCachedMessage)
        .filter((msg): msg is ChatMessage => msg !== null);
      setChatHistory(normalized);
    } catch {
      setChatHistory([]);
    }
    previousCacheIdentityRef.current = cacheIdentity;
  }, [siteId, cacheIdentity]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const cacheKey = getChatCacheKey(siteId, cacheIdentity);
    try {
      const persistable = chatHistory.filter((msg) => !msg.pending);
      if (!persistable.length) {
        window.localStorage.removeItem(cacheKey);
      } else {
        window.localStorage.setItem(cacheKey, JSON.stringify(persistable));
      }
    } catch {
      // Ignore storage failures (e.g., private mode)
    }
  }, [chatHistory, siteId, cacheIdentity]);

  useEffect(() => {
    if (previousSiteIdRef.current === siteId) return;
    if (typeof window !== 'undefined' && !previousSiteIdRef.current && siteId) {
      const draftKey = getChatCacheKey(null, previousCacheIdentityRef.current);
      const siteKey = getChatCacheKey(siteId, cacheIdentity);
      try {
        const draftData = window.localStorage.getItem(draftKey);
        if (draftData && !window.localStorage.getItem(siteKey)) {
          window.localStorage.setItem(siteKey, draftData);
        }
        window.localStorage.removeItem(draftKey);
      } catch {
        // Ignore storage failures
      }
    }
    previousSiteIdRef.current = siteId;
    previousCacheIdentityRef.current = cacheIdentity;
  }, [siteId, cacheIdentity]);

  // Load chat from DB when siteId/userId available
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!siteId || !userId) return;
      const res = await listChatAction(userId, siteId, 200);
      if (!res.success || cancelled) return;
      const msgs: ChatMessage[] = (res.messages || []).map((m: any) => {
        let meta = m.metadata;
        if (meta && typeof meta === 'string') {
          try { meta = JSON.parse(meta); } catch { meta = null; }
        }
        const diff = meta?.diff;
        const diffs = meta?.diffs;
        return {
          id: typeof m.id === 'string' ? m.id : generateMessageId(),
          sender: m.role === 'user' ? 'user' : 'ai',
          text: m.text,
          file: m.file || undefined,
          diff: diff && typeof diff === 'object' ? diff : undefined,
          diffs: Array.isArray(diffs) ? diffs : undefined,
          createdAt: m.created_at || undefined,
          inputTokens: typeof m.input_tokens === 'number' ? m.input_tokens : undefined,
          outputTokens: typeof m.output_tokens === 'number' ? m.output_tokens : undefined,
          model: undefined,
          pending: false,
        };
      });
      setChatHistory(msgs);
    })();
    return () => { cancelled = true; };
  }, [siteId, userId]);

  const [activeTab, setActiveTab] = useState('preview');
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const [currentPreviewPath, setCurrentPreviewPath] =
    useState<string>('index.html');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([{ path: 'index.html' }]);
  const [activeEditorTab, setActiveEditorTab] = useState<string>('index.html');
  const [newFileName, setNewFileName] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedFolderForNew, setSelectedFolderForNew] = useState<string>('');
  const [isAddFileOpen, setIsAddFileOpen] = useState(false);
  const [isAddFolderOpen, setIsAddFolderOpen] = useState(false);
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);
  const [selectedFileInTree, setSelectedFileInTree] = useState<string | null>('index.html');
  const [inspectorEnabled, setInspectorEnabled] = useState(false);
  const [elementTarget, setElementTarget] = useState<ElementTarget | null>(null);
  const [elementDialogOpen, setElementDialogOpen] = useState(false);
  const [elementPrompt, setElementPrompt] = useState('');
  const [elementCssContext, setElementCssContext] = useState('');
  const [pendingElementTarget, setPendingElementTarget] = useState<ElementTarget | null>(null);
  const [pendingElementOriginalFile, setPendingElementOriginalFile] = useState<string>('');
  const [pendingElementOriginalCss, setPendingElementOriginalCss] = useState<string>('');
  const [editState, editCodeFormAction, isEditing] = useActionState<any, FormData>(
    editCodeAction as any,
    initialEditState as any
  );
  const [elementEditState, editElementFormAction, isElementEditing] = useActionState<any, FormData>(
    editElementAction as any,
    initialElementEditState as any
  );

  const serializedSiteTypes = useMemo(() => {
    try {
      return JSON.stringify(Array.isArray((site as any)?.types) ? (site as any).types : []);
    } catch {
      return '[]';
    }
  }, [site]);

  const previewFilePayload = useMemo(() => {
    const map: Record<string, string> = {};
    Object.entries(site.files).forEach(([path, raw]) => {
      map[path] = toStringContent(raw);
    });
    return map;
  }, [site.files]);

  const postPreviewState = useCallback((target: Window | null | undefined, extra?: { currentPath?: string }) => {
    if (!target) return;
    try {
      const payload = {
        type: 'wg-preview-sync' as const,
        siteId,
        files: previewFilePayload,
        currentPath: extra?.currentPath ?? currentPreviewPath,
      };
      target.postMessage(payload, '*');
    } catch (error) {
      console.warn('Failed to post preview state', error);
    }
  }, [previewFilePayload, currentPreviewPath, siteId]);

  useEffect(() => {
    if (!previewWindowsRef.current.size) return;
    Array.from(previewWindowsRef.current).forEach((win) => {
      if (!win || win.closed) {
        previewWindowsRef.current.delete(win);
        return;
      }
      postPreviewState(win);
    });
  }, [postPreviewState]);

  const ensureProjectId = useCallback(async (): Promise<boolean> => {
    if (siteId && userId) return true;
    if (!userId) return false;
    const fd = new FormData();
    fd.set('userId', userId);
    fd.set('slug', slugName);
    fd.set('name', displayName);
    try { fd.set('types', JSON.stringify((site as any).types || [])); } catch { fd.set('types', '[]'); }
    fd.set('domain', site.domain || '');
    if ((site as any).usage) {
      const usage = (site as any).usage as { inputTokens?: number; outputTokens?: number };
      if (typeof usage.inputTokens === 'number') fd.set('initialInputTokens', String(usage.inputTokens));
      if (typeof usage.outputTokens === 'number') fd.set('initialOutputTokens', String(usage.outputTokens));
    }
    const res: any = await ensureProjectAction({}, fd as any);
    if (res?.success && res.siteId) {
      setSiteId(res.siteId);
      return true;
    }
    return false;
  }, [siteId, userId, slugName, displayName, site]);

  const saveImmediate = useCallback(async (changes: Record<string, string>) => {
    const ok = await ensureProjectId();
    if (!ok || !siteId || !userId) return false;
    const fd = new FormData();
    fd.set('userId', userId);
    fd.set('siteId', siteId);
    fd.set('changes', JSON.stringify(changes));
    const res: any = await upsertSiteFilesAction({}, fd as any);
    return !!res?.success;
  }, [ensureProjectId, siteId, userId]);

  const pendingSavesRef = useRef<Record<string, string>>({});
  const flushSavesDebounced = useMemo(() => debounce(async () => {
    const sb = await getSupabase();
    if (!sb || !siteId || !userId) return;
    const entries = Object.entries(pendingSavesRef.current);
    if (!entries.length) return;
    const batch = entries.map(([path, content]) => ({ site_id: siteId!, path, content, updated_by: userId }));
    try {
      pendingSavesRef.current = {};
      const chunkSize = 40;
      for (let i = 0; i < batch.length; i += chunkSize) {
        const slice = batch.slice(i, i + chunkSize);
        await sb.from('site_files').upsert(slice, { onConflict: 'site_id,path' });
      }
      await sb.from('sites').update({ updated_at: new Date().toISOString(), last_opened_at: new Date().toISOString() }).eq('id', siteId);
    } catch (e) {
      // keep pending in case of failure
      batch.forEach(({ path, content }) => { (pendingSavesRef.current as any)[path] = content; });
      console.error('Autosave failed', e);
    }
  }, 800), [siteId, userId]);

  const queueSave = useCallback((path: string, rawContent: unknown) => {
    const content = toStringContent(rawContent);
    pendingSavesRef.current[path] = content;
    flushSavesDebounced();
  }, [flushSavesDebounced]);

  useEffect(() => {
    if (siteId && userId) {
      flushSavesDebounced();
    }
    return () => {
      if (typeof (flushSavesDebounced as any)?.cancel === 'function') {
        (flushSavesDebounced as any).cancel();
      }
      flushSavesDebounced();
    };
  }, [siteId, userId, flushSavesDebounced]);

  const revStorageKey = useCallback((file: string) => `webgenius:revisions:${site.domain}:${file}`, [site.domain]);

  const loadLocalRevisions = useCallback((file: string) => {
    try {
      const raw = localStorage.getItem(revStorageKey(file));
      if (!raw) return [] as { before: string; after: string; ts: number; added: number; removed: number }[];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch { return [] as any[]; }
  }, [revStorageKey]);

  const persistRevisions = useCallback((file: string, list: { before: string; after: string; ts: number; added: number; removed: number }[]) => {
    try { localStorage.setItem(revStorageKey(file), JSON.stringify(list.slice(-20))); } catch {}
  }, [revStorageKey]);

  const pushRevision = useCallback((file: string, before: string, after: string, added: number, removed: number) => {
    setRevisions((prev) => {
      const list = (prev[file] || loadLocalRevisions(file)).concat([{ before, after, ts: Date.now(), added, removed }]).slice(-20);
      persistRevisions(file, list);
      return { ...prev, [file]: list };
    });
  }, [loadLocalRevisions, persistRevisions]);

  type ChatPersistExtras = {
    inputTokens?: number;
    outputTokens?: number;
    model?: string;
    metadata?: Record<string, any>;
  };

  const persistChat = useCallback(async (
    sender: 'user' | 'ai',
    text: string,
    file?: string,
    extras?: ChatPersistExtras
  ): Promise<{ success: boolean; created_at?: string } | undefined> => {
    if (!siteId || !userId) return;
    const fd = new FormData();
    fd.set('userId', userId);
    fd.set('siteId', siteId);
    fd.set('role', sender);
    fd.set('text', text);
    if (file) fd.set('file', file);
    if (typeof extras?.inputTokens === 'number') fd.set('inputTokens', String(Math.round(extras.inputTokens)));
    if (typeof extras?.outputTokens === 'number') fd.set('outputTokens', String(Math.round(extras.outputTokens)));
    if (extras?.model) fd.set('model', extras.model);
    if (extras?.metadata) fd.set('metadata', JSON.stringify(extras.metadata));
    return await addChatMessageAction({}, fd as any);
  }, [siteId, userId]);

  // Track which file the user asked the AI to edit to avoid applying
  // responses when tabs change or multiple edits overlap.
  const [pendingEditFile, setPendingEditFile] = useState<string | null>(null);
  const [pendingOriginalCode, setPendingOriginalCode] = useState<string>('');
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [progressStep, setProgressStep] = useState<number>(0);
  // Prevent re-applying the same server response on subsequent submits
  const lastHandledResponseRef = useRef<{ code: string; reasoning: string } | null>(null);
  const lastHandledErrorRef = useRef<string | null>(null);
  const lastHandledElementResponseRef = useRef<any>(null);
  const lastHandledElementErrorRef = useRef<string | null>(null);

  // --- MONACO EDITOR ENHANCEMENTS ---
  const fileListForMonaco = useRef(Object.keys(site.files));
  useEffect(() => {
    fileListForMonaco.current = Object.keys(site.files);
  }, [site.files]);

  useEffect(() => {
    if (activeTab !== 'preview' && inspectorEnabled) {
      setInspectorEnabled(false);
    }
  }, [activeTab, inspectorEnabled]);

  const deriveRelevantCss = useCallback((css: string, html: string) => {
    if (!css || !html) return '';
    const classMatches = Array.from(html.matchAll(/class=["']([^"']+)["']/g)).flatMap((m) => m[1]?.split(/\s+/) ?? []);
    const idMatches = Array.from(html.matchAll(/id=["']([^"']+)["']/g)).map((m) => m[1]);
    const selectors = new Set<string>();
    classMatches.filter(Boolean).forEach((cls) => selectors.add('.' + cls.trim()));
    idMatches.filter(Boolean).forEach((id) => selectors.add('#' + id.trim()));
    if (!selectors.size) return '';

    const blocks = css.split('}');
    const relevant: string[] = [];
    for (const block of blocks) {
      const trimmed = block.trim();
      if (!trimmed) continue;
      const [selectorPart, declarations] = trimmed.split('{');
      if (!selectorPart || !declarations) continue;
      const selectorText = selectorPart.trim();
      for (const token of selectors) {
        if (selectorText.includes(token)) {
          relevant.push(selectorText + ' {' + declarations + '}');
          break;
        }
      }
    }
    return relevant.join('\n\n');
  }, []);

  useEffect(() => {
    if (!elementTarget) {
      setElementCssContext('');
      return;
    }
    const cssContent = typeof site.files['styles/style.css'] === 'string'
      ? (site.files['styles/style.css'] as string)
      : '';
    setElementCssContext(deriveRelevantCss(cssContent, elementTarget.elementHtml));
  }, [deriveRelevantCss, elementTarget, site.files]);

  // --- AI CHAT LOGIC ---
  useEffect(() => {
    if (!pendingEditFile) return;
    if (editState.success && editState.response && editState.response !== lastHandledResponseRef.current) {
      const { code, reasoning, usage, model } = editState.response as any;
      const updatedFile = pendingEditFile;

      setSite((prev) => ({
        ...prev,
        files: { ...prev.files, [updatedFile]: code },
      }));
      // Persist the change to the DB immediately so it survives reloads
      (async () => { await saveImmediate({ [updatedFile]: code }); })();
      const { added, removed } = computeDiffStats(pendingOriginalCode, code);
      pushRevision(updatedFile, pendingOriginalCode, code, added, removed);
      (async () => {
        const extras = {
          inputTokens: usage?.inputTokens,
          outputTokens: usage?.outputTokens,
          model: model as string | undefined,
          metadata: { diff: { added, removed } },
        };
        const saved = await persistChat('ai', reasoning, updatedFile, extras);
        const createdAt = (saved as any)?.created_at || new Date().toISOString();
        settlePendingMessage('code', {
          sender: 'ai',
          text: reasoning,
          file: updatedFile,
          diff: { added, removed },
          createdAt,
          inputTokens: extras.inputTokens,
          outputTokens: extras.outputTokens,
          model: extras.model,
        });
      })();
      lastHandledResponseRef.current = editState.response;
      lastHandledErrorRef.current = null;
      toast({
        title: 'Code Updated',
        description: `Changes applied to ${updatedFile}.`,
      });
      setPendingEditFile(null);
    } else if (!editState.success && editState.error && editState.error !== lastHandledErrorRef.current) {
      toast({
        variant: 'destructive',
        title: 'Editing Failed',
        description: editState.error,
      });
      clearPendingMessage('code');
      if (pendingEditFile) {
        removeLatestUserMessage(pendingEditFile);
      }
      setPendingEditFile(null);
      lastHandledErrorRef.current = editState.error;
      lastHandledResponseRef.current = null;
    }
    // Only react to changes in editState when a pending file exists.
  }, [editState, pendingEditFile, toast, pendingOriginalCode, persistChat, pushRevision, saveImmediate, settlePendingMessage, clearPendingMessage]);
  
  useEffect(() => {
    if (!pendingElementTarget) return;
    if (
      elementEditState.success &&
      elementEditState.response &&
      elementEditState !== lastHandledElementResponseRef.current
    ) {
      const { fileName, code, css, reasoning, usage, model, elementHtml, assets } = elementEditState.response as any;
      const updates: Record<string, string> = { [fileName]: code };
      if (typeof css === 'string' && css.length > 0) {
        updates['styles/style.css'] = css;
      }
      if (Array.isArray(assets) && assets.length > 0) {
        for (const asset of assets) {
          if (asset && typeof asset.path === 'string' && typeof asset.content === 'string') {
            updates[asset.path] = asset.content;
          }
        }
      }
      setSite((prev) => ({
        ...prev,
        files: { ...prev.files, ...updates },
      }));
      (async () => {
        await saveImmediate(updates);
      })();
      const { added, removed } = computeDiffStats(pendingElementOriginalFile, code);
      pushRevision(fileName, pendingElementOriginalFile, code, added, removed);
      if (updates['styles/style.css'] && typeof pendingElementOriginalCss === 'string') {
        const cssMetrics = computeDiffStats(pendingElementOriginalCss, updates['styles/style.css']);
        pushRevision('styles/style.css', pendingElementOriginalCss, updates['styles/style.css'], cssMetrics.added, cssMetrics.removed);
      }
      (async () => {
        const extras = {
          inputTokens: usage?.inputTokens,
          outputTokens: usage?.outputTokens,
          model: model as string | undefined,
          metadata: {
            diff: { added, removed },
            elementHtml,
          },
        };
        const saved = await persistChat('ai', reasoning, fileName, extras);
        const createdAt = (saved as any)?.created_at || new Date().toISOString();
        settlePendingMessage('element', {
          sender: 'ai',
          text: reasoning,
          file: fileName,
          diff: { added, removed },
          createdAt,
          inputTokens: extras.inputTokens,
          outputTokens: extras.outputTokens,
          model: extras.model,
        });
      })();
      toast({
        title: 'Section Updated',
        description: `Changes applied to ${fileName}.`,
      });
      lastHandledElementResponseRef.current = elementEditState;
      lastHandledElementErrorRef.current = null;
      setPendingElementTarget(null);
      setPendingElementOriginalFile('');
      setPendingElementOriginalCss('');
      setElementDialogOpen(false);
      setElementPrompt('');
    } else if (
      !elementEditState.success &&
      elementEditState.error &&
      elementEditState.error !== lastHandledElementErrorRef.current
    ) {
      toast({
        variant: 'destructive',
        title: 'Element Editing Failed',
        description: elementEditState.error,
      });
      clearPendingMessage('element');
      if (pendingElementTarget) {
        removeLatestUserMessage(pendingElementTarget.fileName);
      }
      setPendingElementTarget(null);
      setPendingElementOriginalFile('');
      setPendingElementOriginalCss('');
      lastHandledElementErrorRef.current = elementEditState.error;
      lastHandledElementResponseRef.current = null;
    }
  }, [elementEditState, pendingElementTarget, pendingElementOriginalFile, pendingElementOriginalCss, toast, pushRevision, saveImmediate, persistChat, settlePendingMessage, clearPendingMessage]);

  // --- AI BULK EDIT LOGIC ---
  const lastHandledBulkResponseRef = useRef<any>(null);
  useEffect(() => {
    if (isBulkEditing || !bulkState?.success || bulkState === lastHandledBulkResponseRef.current) {
      if (!isBulkEditing && bulkState?.error && bulkState !== lastHandledBulkResponseRef.current) {
        lastHandledBulkResponseRef.current = bulkState;
        toast({
          variant: 'destructive',
          title: 'Bulk Editing Failed',
          description: bulkState.error
        });
        clearPendingMessage('bulk');
        removeLatestUserMessage('Whole Project');
        setPendingBulkOriginal(null);
      }
      return;
    }
    lastHandledBulkResponseRef.current = bulkState;

    let reasoning = bulkState.reasoning || 'Changes applied across the site.';
    const answer = bulkState.answer;
    const modifications = (bulkState.results || []) as BulkModification[];

    (async () => {
      const extras: ChatPersistExtras = {
        inputTokens: bulkState.usage?.inputTokens,
        outputTokens: bulkState.usage?.outputTokens,
        model: bulkState.model as string | undefined,
      };

      if (modifications && modifications.length > 0 && pendingBulkOriginal) {
        const changes = modifications.map((mod: BulkModification) => {
          const oldCode = pendingBulkOriginal[mod.fileName];
          const { added, removed } = computeDiffStats(oldCode ?? '', mod.code ?? '');
          return { file: mod.fileName, added, removed };
        });
        extras.metadata = { diffs: changes };

        const saved = await persistChat('ai', reasoning, 'Whole Project', extras);
        const createdAt = (saved as any)?.created_at || new Date().toISOString();

        settlePendingMessage('bulk', {
          sender: 'ai',
          text: reasoning,
          file: 'Whole Project',
          diffs: changes,
          modifications: modifications,
          isApplied: false,
          createdAt,
          inputTokens: extras.inputTokens,
          outputTokens: extras.outputTokens,
          model: extras.model,
        } as ChatMessage);
        toast({ title: 'AI has suggested changes', description: 'Review and apply them in the chat.' });
      } else if (answer) {
        const saved = await persistChat('ai', answer, 'Whole Project', extras);
        const createdAt = (saved as any)?.created_at || new Date().toISOString();
        settlePendingMessage('bulk', {
          sender: 'ai',
          text: answer,
          file: 'Whole Project',
          createdAt,
          inputTokens: extras.inputTokens,
          outputTokens: extras.outputTokens,
          model: extras.model,
        });
      } else {
        // No changes and no answer, maybe an error case not caught before
        toast({ title: 'No Changes Made', description: 'The AI did not suggest any code modifications.' });
        clearPendingMessage('bulk');
        removeLatestUserMessage('Whole Project');
      }
      setPendingBulkOriginal(null);
    })();
  }, [bulkState, isBulkEditing, toast, pendingBulkOriginal, persistChat, pushRevision, saveImmediate, settlePendingMessage, clearPendingMessage, removeLatestUserMessage]);

  // Visual progress while the AI is editing (client-side simulated steps, no loop)
  useEffect(() => {
    if (!isEditing && !isBulkEditing) return;
    let cancelled = false;
    setProgressStep(0);
    const stepDelay = 1400; // slower and linear
    const run = (i: number) => {
      if (cancelled) return;
      if (i >= 3) return; // hold at last step until result arrives
      setTimeout(() => {
        if (cancelled) return;
        setProgressStep(i + 1);
        run(i + 1);
      }, stepDelay);
    };
    run(0);
    return () => {
      cancelled = true;
    };
  }, [isEditing, isBulkEditing]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, isEditing]);

  const handleChatSubmit = () => {
    if (!chatPrompt.trim() || !activeFile) return;
    (async () => {
      // ensure project is persisted before saving chat
      const ok = await ensureProjectId();
      if (!ok) { toast({ variant: 'destructive', title: 'Not saved', description: 'Sign in required' }); return; }
      const saved = await persistChat('user', chatPrompt, activeFile);
      const createdAt = (saved as any)?.created_at || new Date().toISOString();
      const userMessageId = generateMessageId();
      const placeholderId = generateMessageId();
      setChatHistory((prev) => [
        ...prev,
        { id: userMessageId, sender: 'user', text: chatPrompt, file: activeFile, createdAt },
        createPendingAiMessage(placeholderId, activeFile),
      ]);
      pendingAiMessageIdsRef.current.code = placeholderId;
    })();
    setChatPrompt('');
  };

  const handleRename = (path: string, newName: string) => {
    if (!newName.trim() || newName.includes('/')) {
      setRenamingPath(null);
      return;
    }
    const parts = path.split('/');
    const oldName = parts.pop() as string;
    if (newName === oldName) {
      setRenamingPath(null);
      return;
    }
    const parentDir = parts.join('/');
    const newPath = parentDir ? `${parentDir}/${newName}` : newName;

    setSite(prev => {
      const files = { ...prev.files };
      if (files[newPath] || Object.keys(files).some(f => f.startsWith(newPath + '/'))) {
        toast({ variant: 'destructive', title: 'Rename failed', description: 'A file or folder with that name already exists.' });
        return prev;
      }

      if (files[path] !== undefined) { // It's a file
        files[newPath] = toStringContent(files[path]);
        delete files[path];
        // Update tabs
        setOpenTabs(tabs => tabs.map(t => t.path === path ? { path: newPath } : t));
        if (activeEditorTab === path) setActiveEditorTab(newPath);
        // Persist rename: upsert new, delete old
        if (siteId && userId) {
          queueSave(newPath, files[newPath] as string);
          (async () => { const sb = await getSupabase(); if (sb) await sb.from('site_files').delete().eq('site_id', siteId).eq('path', path); })();
        }
      } else { // It's a folder
        const prefix = path + '/';
        const newMap: Record<string, string> = {};
        Object.keys(files).forEach(k => {
          if (k.startsWith(prefix)) {
            const rest = k.slice(prefix.length);
            const newKey = `${newPath}/${rest}`;
            newMap[newKey] = toStringContent(files[k]);
            delete files[k];
          }
        });
        Object.assign(files, newMap);
        if (siteId && userId) {
          // Persist folder rename: upsert all new and delete old paths
          Object.entries(newMap).forEach(([k, v]) => queueSave(k, v));
          (async () => { const sb = await getSupabase(); if (sb) {
            const del = Object.keys(newMap).map(oldNew => oldNew.replace(newPath + '/', path + '/'));
            for (const oldPath of del) { await sb.from('site_files').delete().eq('site_id', siteId).eq('path', oldPath); }
          }})();
        }
        // Update open folders state
        setOpenFolders(open => {
          const newSet = new Set<string>();
          open.forEach(p => {
            if (p === path) {
              newSet.add(newPath);
            } else if (p.startsWith(prefix)) {
              newSet.add(newPath + p.slice(path.length));
            } else {
              newSet.add(p);
            }
          });
          return newSet;
        });
        // Update tabs
        setOpenTabs(tabs => tabs.map(t => t.path.startsWith(prefix) ? { path: newPath + t.path.slice(path.length) } : t));
        if (activeEditorTab?.startsWith(prefix)) {
          setActiveEditorTab(newPath + activeEditorTab.slice(path.length));
        }
      }
      return { ...prev, files };
    });

    setRenamingPath(null);
    toast({ title: 'Renamed', description: `${path} → ${newPath}` });
  };

  // --- FILE TREE ---
  const fileTree = useMemo(() => {
    const root: TreeNode = {
      name: displayName,
      type: 'folder',
      path: '',
      children: [],
    };
    const nodeMap: Record<string, TreeNode> = { '': root };

    const allPaths = Object.keys(site.files).sort();

    allPaths.forEach((fullPath) => {
      const parts = fullPath.split('/');
      let currentPath = '';
      let parentNode = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isFile = i === parts.length - 1;
        currentPath = currentPath ? `${currentPath}/${part}` : part;

        if (isFile) {
          if (fullPath.endsWith('/.placeholder')) continue;
          if (!parentNode.children) parentNode.children = [];
          parentNode.children.push({
            name: part,
            type: 'file',
            path: fullPath,
          });
        } else {
          if (!nodeMap[currentPath]) {
            const newNode: TreeNode = {
              name: part,
              type: 'folder',
              path: currentPath,
              children: [],
            };
            if (!parentNode.children) parentNode.children = [];
            parentNode.children.push(newNode);
            nodeMap[currentPath] = newNode;
          }
          parentNode = nodeMap[currentPath];
        }
      }
    });

    const sortNodes = (nodes: TreeNode[]) => {
      nodes.sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'folder' ? -1 : 1;
      });
      // prefer index.html first within files
      nodes.sort((a, b) => {
        if (a.type === 'file' && b.type === 'file') {
          if (a.name.toLowerCase() === 'index.html') return -1;
          if (b.name.toLowerCase() === 'index.html') return 1;
        }
        return 0;
      });
      nodes.forEach((node) => {
        if (node.children) sortNodes(node.children);
      });
    };
    if (root.children) sortNodes(root.children);

    return root;
  }, [site, displayName]);

  // --- FILE ICONS ---
  const fileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'html':
        return <Globe className="h-4 w-4 text-orange-500" />;
      case 'css':
        return <Palette className="h-4 w-4 text-sky-600" />;
      case 'js':
      case 'mjs':
      case 'cjs':
      case 'jsx':
        return <FileCode className="h-4 w-4 text-yellow-500" />;
      case 'ts':
      case 'tsx':
        return <FileCode className="h-4 w-4 text-blue-600" />;
      case 'json':
        return <FileJson className="h-4 w-4 text-emerald-600" />;
      case 'md':
        return <FileText className="h-4 w-4 text-purple-600" />;
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'ico':
      case 'webp':
      case 'avif':
      case 'svg':
        return <ImageIcon className="h-4 w-4 text-pink-500" />;
      default:
        return <File className="h-4 w-4 text-gray-500" />;
    }
  };

  const toggleFolder = (path: string) => {
    setOpenFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  const FileTreeView = ({ node, level = 0 }: { node: TreeNode; level?: number }) => (
    <div className={level > 0 ? 'pl-4' : ''}>
      {node.children?.map((child) => (
        <div key={child.path}>
          <ContextMenu>
            <ContextMenuTrigger>
              {child.type === 'folder' ? (
                <>
                  <div
                    className={`flex items-center justify-between h-7 px-2 cursor-pointer group rounded-md ${dragOverPath === child.path ? 'bg-accent/20 border border-accent/40' : 'hover:bg-accent/10'}`}
                    onClick={(e) => { e.stopPropagation(); toggleFolder(child.path); }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverPath(child.path);
                    }}
                    onDragLeave={() => setDragOverPath(null)}
                    onDrop={(e) => handleDrop(e, child.path)}
                  >
                    <div className="flex items-center gap-2">
                      {openFolders.has(child.path) ? (
                        <ChevronDown className="h-4 w-4 text-[#c5c5c5]" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-[#c5c5c5]" />
                      )}
                      {folderIcon(child.name, openFolders.has(child.path))}
                      {renamingPath === child.path ? (
                        <Input
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          onBlur={() => handleRename(child.path, renameValue)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleRename(child.path, renameValue);
                            if (e.key === 'Escape') setRenamingPath(null);
                          }}
                          autoFocus
                          onFocus={e => {
                            const length = e.currentTarget.value.length;
                            e.currentTarget.setSelectionRange(length, length);
                          }}
                          className="h-6 text-xs bg-card-foreground/10 border-accent"
                          onClick={e => e.stopPropagation()}
                        />
                      ) : (
                        <span className="text-[#cccccc] text-[13px]" title={child.name}>{ellipsisMiddle(child.name, 20)}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-[#cccccc] hover:text-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFolderForNew(child.path);
                          setIsAddFileOpen(true);
                        }}
                      >
                        <FilePlus className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-[#cccccc] hover:text-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFolderForNew(child.path);
                          setIsAddFolderOpen(true);
                        }}
                      >
                        <FolderPlus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  {openFolders.has(child.path) && child.children && (
                    <FileTreeView node={child} level={level + 1} />
                  )}
                </>
              ) : (
                <div
              className={`flex items-center justify-between h-7 px-2 ml-4 group cursor-pointer hover:bg-accent/10 border-l-2 rounded-md ${
                selectedFileInTree === child.path
                  ? 'bg-accent/20 border-accent'
                  : 'border-transparent'
              }`}
              onClick={(e) => { e.stopPropagation(); openFileInTab(child.path); }}
              draggable
              onDragStart={(ev) => {
                ev.dataTransfer.setData('text/x-internal-path', child.path);
                ev.dataTransfer.effectAllowed = 'move';
              }}
            >
                  <div className="flex items-center gap-2" title={child.name}>
                    {fileIcon(child.name)}
                    {renamingPath === child.path ? (
                      <Input
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onBlur={() => handleRename(child.path, renameValue)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleRename(child.path, renameValue);
                          if (e.key === 'Escape') setRenamingPath(null);
                        }}
                        autoFocus
                        onFocus={e => {
                          const length = e.currentTarget.value.length;
                          e.currentTarget.setSelectionRange(length, length);
                        }}
                        className="h-6 text-xs bg-card-foreground/10 border-accent"
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      (() => { const p = splitName(child.name); return (
                        <>
                          <span className="text-[#cccccc] text-[13px]">{p.baseShort}</span>
                          {p.ext && (<span className={`px-1.5 py-0.5 rounded-md text-[10px] ${extPillClass(p.ext)}`}>.{p.ext}</span>)}
                        </>
                      ); })()
                    )}
                  </div>
                </div>
              )}
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onSelect={() => {
                setRenamingPath(child.path);
                setRenameValue(child.name);
              }}>Rename</ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem className="text-destructive" onSelect={() => handleDelete(child.path, child.type)}>
                Delete {child.type === 'folder' ? 'Folder' : 'File'}
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
            </div>
      ))}
    </div>
  );

  // --- DND / PASTE UPLOADS ---
  const ellipsisMiddle = (value: string, max: number) => {
    if (value.length <= max) return value;
    if (max <= 3) return value.slice(0, max);
    const front = Math.ceil((max - 1) / 2);
    const back = Math.floor((max - 1) / 2);
    return `${value.slice(0, front)}…${value.slice(value.length - back)}`;
  };

  const shortFileName = (name: string) => {
    const dot = name.lastIndexOf('.');
    const base = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot + 1) : '';
    const baseShort = ellipsisMiddle(base, 12);
    return ext ? `${baseShort}.${ext}` : baseShort;
  };

  const splitName = (name: string) => {
    const dot = name.lastIndexOf('.');
    const base = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
    const baseShort = ellipsisMiddle(base, 18);
    return { baseShort, ext };
  };

  const extPillClass = (ext: string) => {
    switch (ext) {
      case 'html': return 'bg-orange-500/20 text-orange-300';
      case 'css': return 'bg-sky-500/20 text-sky-300';
      case 'js': case 'mjs': case 'cjs': case 'jsx': return 'bg-yellow-500/20 text-yellow-300';
      case 'ts': case 'tsx': return 'bg-blue-500/20 text-blue-300';
      case 'json': return 'bg-emerald-500/20 text-emerald-300';
      case 'md': return 'bg-violet-500/20 text-violet-300';
      case 'png': case 'jpg': case 'jpeg': case 'gif': case 'svg': case 'webp': case 'avif': case 'ico': return 'bg-pink-500/20 text-pink-300';
      default: return 'bg-[#2f3136] text-[#b0b0b0]';
    }
  };

  const folderIcon = (name: string, open: boolean) => {
    const n = name.toLowerCase();
    const iconClass = 'h-4 w-4';
    if (n === 'assets') return <Package className={`${iconClass} text-amber-400`} />;
    if (n === 'images' || n === 'img' || n === 'assets' || n === 'assets/images') return <ImageIcon className={`${iconClass} text-pink-400`} />;
    if (n === 'scripts' || n === 'js' || n === 'ts') return <FileCode className={`${iconClass} text-yellow-400`} />;
    if (n === 'styles' || n === 'css') return <Palette className={`${iconClass} text-sky-400`} />;
    if (n === 'public') return <Globe className={`${iconClass} text-emerald-400`} />;
    return open ? <FolderOpen className={`${iconClass} text-[#e7ba47]`} /> : <Folder className={`${iconClass} text-[#e7ba47]`} />;
  };

  // Returns a unique path if desiredPath already exists in filesMap
  const getUniquePath = (desiredPath: string, filesMap: Record<string, any>) => {
    if (!filesMap[desiredPath]) return desiredPath;
    const parts = desiredPath.split('/');
    const baseName = parts.pop() as string;
    const dot = baseName.lastIndexOf('.');
    const name = dot > 0 ? baseName.slice(0, dot) : baseName;
    const ext = dot > 0 ? baseName.slice(dot) : '';
    let i = 1;
    let candidate = '';
    do {
      candidate = [...parts, `${name}-${i}${ext}`].filter(Boolean).join('/');
      i++;
    } while (filesMap[candidate]);
    return candidate;
  };

  const readFileAsDataURL = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result || ''));
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });

  const readFileAsText = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result || ''));
      fr.onerror = reject;
      fr.readAsText(file);
    });

  const isImage = (name: string) => /\.(png|jpe?g|gif|svg|webp|avif|ico)$/i.test(name);

  const writeFilesIntoSite = async (targetDir: string, fileList: File[]) => {
    if (!fileList || fileList.length === 0) return;
    const updates: Record<string, string> = {};
    for (const f of fileList) {
      const path = `${targetDir ? targetDir + '/' : ''}${f.name}`;
      const content = isImage(f.name) ? await readFileAsDataURL(f) : await readFileAsText(f);
      updates[path] = content;
    }
    setSite((prev) => ({ ...prev, files: { ...prev.files, ...updates } }));
    if (siteId && userId) {
      Object.entries(updates).forEach(([p, c]) => queueSave(p, c));
    }
    toast({ title: 'Files added', description: `${fileList.length} file(s) added to ${targetDir || 'root'}` });
  };

  const traverseDataTransfer = async (dt: DataTransfer, targetDir: string) => {
    const files: File[] = [];
    const items = dt.items;
    if (items && items.length > 0 && (items as any)[0]?.webkitGetAsEntry) {
      const walk = async (entry: any, base: string) => {
        if (entry.isFile) {
          await new Promise<void>((resolve, reject) => {
            entry.file((file: File) => {
              Object.defineProperty(file, 'name', { value: base ? base + '/' + file.name : file.name });
              files.push(file);
              resolve();
            }, reject);
          });
        } else if (entry.isDirectory) {
          const dirReader = entry.createReader();
          const readAllEntries = async (): Promise<any[]> => {
            const entries: any[] = await new Promise((resolve, reject) => dirReader.readEntries(resolve, reject));
            if (entries.length > 0) {
              return entries.concat(await readAllEntries());
            }
            return [];
          };
          const allEntries = await readAllEntries();
          await Promise.all(allEntries.map((subEntry: any) => walk(subEntry, base ? `${base}/${entry.name}` : entry.name)));
        }
      };
      await Promise.all(Array.from(items).map(it => {
        const entry = (it as any).webkitGetAsEntry();
        if (entry) return walk(entry, '');
        return Promise.resolve();
      }));
    } else if (dt.files) {
      for (const f of Array.from(dt.files)) files.push(f);
    }
    await writeFilesIntoSite(targetDir, files);
  };

  const handleDrop = async (e: React.DragEvent, targetDir: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverPath(null);
    try {
      const internal = e.dataTransfer.getData('text/x-internal-path');
      if (internal) {
        await moveInternal(internal, targetDir || '');
      } else {
        await traverseDataTransfer(e.dataTransfer, targetDir);
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Upload failed', description: 'Could not read dropped files.' });
    }
  };

  const moveInternal = async (fromPath: string, toDir: string) => {
    if (!fromPath) return;
    if (toDir && (toDir + '/').startsWith(fromPath + '/')) return; // cannot move folder into itself
    setSite((prev) => {
      const files = { ...prev.files } as Record<string, string>;
      if (files[fromPath] !== undefined) {
        // file
        const base = fromPath.split('/').pop() as string;
        let dest = toDir ? `${toDir}/${base}` : base;
        if (files[dest]) dest = getUniquePath(dest, files);
        files[dest] = toStringContent(files[fromPath]);
        delete files[fromPath];
        if (activeEditorTab === fromPath) setActiveEditorTab(dest);
        setOpenTabs(openTabs.map(t => t.path === fromPath ? { path: dest } : t));
        if (siteId && userId) {
          queueSave(dest, files[dest]);
          (async () => { const sb = await getSupabase(); if (sb) await sb.from('site_files').delete().eq('site_id', siteId).eq('path', fromPath); })();
        }
      } else {
        // folder
        const prefix = fromPath + '/';
        const baseFolder = fromPath.split('/').pop() as string;
        const targetBase = toDir ? `${toDir}/${baseFolder}` : baseFolder;
        const newMap: Record<string,string> = {};
        Object.keys(files).forEach((k) => {
          if (k.startsWith(prefix)) {
            const rest = k.slice(prefix.length);
            let newKey = `${targetBase}/${rest}`;
            if (files[newKey]) newKey = getUniquePath(newKey, { ...files, ...newMap });
            newMap[newKey] = toStringContent(files[k]);
            delete files[k];
          }
        });
        files[targetBase + '/.placeholder'] = files[targetBase + '/.placeholder'] || '';
        Object.assign(files, newMap);
        setOpenFolders(new Set([...Array.from(openFolders).filter(p=>!p.startsWith(fromPath)), targetBase]));
        (async () => {
          const ok = await ensureProjectId();
          if (!ok || !userId) return;
          // upsert new paths
          await saveImmediate(newMap);
          // delete old paths
          const dels: string[] = Object.keys(newMap).map(old => old.replace(targetBase + '/', fromPath + '/'));
          const fd = new FormData();
          fd.set('userId', userId);
          if (siteId) fd.set('siteId', siteId);
          fd.set('paths', JSON.stringify(dels));
          await deleteSiteFilesAction({}, fd as any);
        })();
      }
      return { ...prev, files } as any;
    });
    toast({ title: 'Moved', description: `${fromPath} → ${toDir || 'root'}` });
  };

  useEffect(() => {
    const onPaste = async (evt: ClipboardEvent) => {
      const fl = evt.clipboardData?.files;
      if (!fl || fl.length === 0) return;
      evt.preventDefault();
      await writeFilesIntoSite(dragOverPath || '', Array.from(fl));
    };
    window.addEventListener('paste', onPaste as any);
    return () => window.removeEventListener('paste', onPaste as any);
  }, [dragOverPath]);

  // Clear drag highlight on global drop/end
  useEffect(() => {
    const clear = () => setDragOverPath(null);
    window.addEventListener('dragend', clear);
    window.addEventListener('drop', clear);
    return () => {
      window.removeEventListener('dragend', clear);
      window.removeEventListener('drop', clear);
    };
  }, []);

  // --- MANAGE FILES ---
  const addFile = () => {
    if (!newFileName.trim()) return;
    const path = selectedFolderForNew ? `${selectedFolderForNew}/${newFileName}` : newFileName;
    if (site.files[path]) {
      toast({ variant: 'destructive', title: 'File exists' });
      return;
    }
    setSite((prev) => ({
      ...prev,
      files: { ...prev.files, [path]: '' },
    }));
    (async () => { await saveImmediate({ [path]: '' }); })();
    openFileInTab(path);
    setNewFileName('');
    setIsAddFileOpen(false);
  };

  const addFolder = () => {
    if (!newFolderName.trim()) return;
    const path = selectedFolderForNew ? `${selectedFolderForNew}/${newFolderName}` : newFolderName;
    if (Object.keys(site.files).some((f) => f.startsWith(path + '/'))) {
      toast({ variant: 'destructive', title: 'Folder exists' });
      return;
    }
    // Add placeholder to create folder
    setSite((prev) => ({
      ...prev,
      files: { ...prev.files, [`${path}/.placeholder`]: '' },
    }));
    (async () => { await saveImmediate({ [`${path}/.placeholder`]: '' }); })();
    setOpenFolders((prev) => new Set([...prev, path]));
    setNewFolderName('');
    setIsAddFolderOpen(false);
  };

  const handleDelete = (path: string, type: 'file' | 'folder') => {
    if (type === 'file') {
      if (path === 'index.html') {
        toast({ variant: 'destructive', title: 'Cannot delete index.html' });
        return;
      }
      setSite((prev) => {
        const newFiles = { ...prev.files };
        delete newFiles[path];
        return { ...prev, files: newFiles };
      });
      if (siteId && userId) { (async () => { const sb = await getSupabase(); if (sb) await sb.from('site_files').delete().eq('site_id', siteId).eq('path', path); })(); }
      if (activeEditorTab === path) {
        setActiveEditorTab('index.html');
        setSelectedFileInTree('index.html');
      }
      setOpenTabs((prev) => prev.filter((tab) => tab.path !== path));
      (async () => {
        const sb = await getSupabase();
        if (sb && siteId) await sb.from('site_files').delete().eq('site_id', siteId).eq('path', path);
      })();
    } else {
      setSite((prev) => {
        const newFiles = { ...prev.files };
        Object.keys(newFiles).forEach((key) => {
          if (key.startsWith(path + '/')) delete newFiles[key];
        });
        return { ...prev, files: newFiles };
      });
      if (activeEditorTab.startsWith(path + '/')) {
        setActiveEditorTab('index.html');
        setSelectedFileInTree('index.html');
      }
      setOpenTabs((prev) => prev.filter((tab) => !tab.path.startsWith(path + '/')));
      setOpenFolders((prev) => {
        const newSet = new Set(prev);
        newSet.delete(path);
        return newSet;
      });
      (async () => {
        const sb = await getSupabase();
        if (sb && siteId) await sb.from('site_files').delete().eq('site_id', siteId).like('path', `${path}/%`);
      })();
    }
  };

  // --- EDITOR TABS ---
  const openFileInTab = (path: string) => {
    if (!openTabs.find((tab) => tab.path === path)) {
      setOpenTabs((prev) => [...prev, { path }]);
    }
    setSelectedFileInTree(path);
    setActiveEditorTab(path);
    setActiveFile(path);
    if (activeTab !== 'code') {
      setActiveTab('code');
    }
  };

  const closeTab = (path: string) => {
    const newTabs = openTabs.filter((tab) => tab.path !== path);
    setOpenTabs(newTabs);
    if (activeEditorTab === path) {
      const newActivePath = newTabs.length > 0 ? newTabs[newTabs.length - 1].path : 'index.html';
      setActiveEditorTab(newActivePath);
      setSelectedFileInTree(newActivePath);
      setActiveFile(newActivePath);
    }
  };

  // --- CODE EDITING ---
  const handleEditorChange = useCallback(
    debounce((value: string | undefined, path: string) => {
      if (value === undefined) return;
      setSite((prev) => ({
        ...prev,
        files: { ...prev.files, [path]: value },
      }));
      queueSave(path, value || '');
    }, 300),
    []
  );

  // --- PREVIEW GENERATION ---
  const updatePreviewDebounced = useCallback(
    debounce((siteToRender: Site, previewPath: string) => {
      const rawHtmlContent =
        siteToRender.files[previewPath] ?? siteToRender.files['index.html'];
      const htmlContent = toStringContent(rawHtmlContent);
      if (!htmlContent) return;

      let processedHtml = htmlContent;

      try {
        Object.entries(siteToRender.files).forEach(([path, rawContent]) => {
          if (path === 'index.html') return;
          const content = toStringContent(rawContent);
          if (!content) return;
          if (content.startsWith('data:') || path.endsWith('.js') || path.endsWith('.css')) {
            const regexSafePath = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            const assetPath1 = new RegExp(`"${regexSafePath}"`, 'g');
            const assetPath2 = new RegExp(`'${regexSafePath}'`, 'g');
            const assetPath3 = new RegExp(
              `"assets/images/${regexSafePath.split('/').pop()}"`,
              'g'
            );
            const assetPath4 = new RegExp(`'assets/images/${regexSafePath.split('/').pop()}'`, 'g');

            if (content.startsWith('data:')) {
              processedHtml = processedHtml
                .replace(assetPath1, `"${content}"`)
                .replace(assetPath2, `'${content}'`)
                .replace(assetPath3, `"${content}"`)
                .replace(assetPath4, `'${content}'`);
            }
          }
        });

        const scriptRegex = /<script src="scripts\/main.js"><\/script>/;
        const styleRegex = /<link rel="stylesheet" href="styles\/style.css">/;

        const mainJsContent = toStringContent(siteToRender.files['scripts/main.js']);
        const styleCssContent = toStringContent(siteToRender.files['styles/style.css']);

        processedHtml = processedHtml.replace(
          scriptRegex,
          `<script>${mainJsContent}</script>`
        );
        processedHtml = processedHtml.replace(
          styleRegex,
          `<style>${styleCssContent}</style>`
        );

        // Router for iframe
        const internalPaths = Object.keys(siteToRender.files).filter((p) =>
          p.endsWith('.html')
        );
        internalPaths.forEach((p) => {
          const fileName = p.replace(/^\/?/, '');
          const esc = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const patterns = [
            new RegExp(`href=\"${esc}\"`, 'g'),
            new RegExp(`href=\'${esc}\'`, 'g'),
            new RegExp(`href=\"\./${esc}\"`, 'g'),
            new RegExp(`href=\'\./${esc}\'`, 'g'),
            new RegExp(`href=\"/${esc}\"`, 'g'),
            new RegExp(`href=\'/${esc}\'`, 'g'),
          ];
          patterns.forEach((rx) => {
            processedHtml = processedHtml.replace(
              rx,
              `href="#" data-preview-path="${fileName}"`
            );
          });
        });
      } catch (error) {
        console.error('Preview assembly failed, falling back to raw HTML', error);
        processedHtml = htmlContent;
      }

      const routerScript = `\n<script>(function(){document.addEventListener('click',function(e){var a=e.target&&(e.target.closest?e.target.closest('a[data-preview-path]'):null);if(!a)return;e.preventDefault();var p=a.getAttribute('data-preview-path');if(p&&window.parent){window.parent.postMessage({type:'open-path',path:p},'*');}},true);})();<\/script>`;

      const inspectorScript = `
<script>
(function(){
  if (window.__WG_INSPECTOR_READY) { return; }
  window.__WG_INSPECTOR_READY = true;

  var highlight = null;
  var badge = null;
  var buttonWrapper = null;
  var button = null;
  var details = null;
  var currentTarget = null;
  var rafId = null;
  var active = false;
  var parentWin = window.parent;

  function ensureElements() {
    if (highlight) return;

    highlight = document.createElement('div');
    highlight.id = 'wg-hover-highlight';
    Object.assign(highlight.style, {
      position: 'fixed',
      border: '2px solid #2563eb',
      borderRadius: '10px',
      background: 'rgba(37,99,235,0.08)',
      pointerEvents: 'none',
      zIndex: 2147483646,
      display: 'none',
      transition: 'transform 80ms ease, width 80ms ease, height 80ms ease',
      overflow: 'visible'
    });

    badge = document.createElement('div');
    Object.assign(badge.style, {
      position: 'absolute',
      top: '-26px',
      left: '0',
      padding: '2px 8px',
      borderRadius: '6px',
      background: '#1e293b',
      color: '#e2e8f0',
      fontSize: '11px',
      fontFamily: 'Inter, system-ui, sans-serif',
      fontWeight: '600',
      pointerEvents: 'none',
      maxWidth: '220px',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      boxShadow: '0 8px 18px rgba(15,23,42,0.35)'
    });
    highlight.appendChild(badge);

    buttonWrapper = document.createElement('div');
    buttonWrapper.setAttribute('data-wg-inspector-ui', '');
    Object.assign(buttonWrapper.style, {
      position: 'fixed',
      pointerEvents: 'none',
      zIndex: 2147483647,
      display: 'none'
    });

    button = document.createElement('button');
    button.textContent = 'Edit';
    Object.assign(button.style, {
      padding: '6px 14px',
      fontSize: '12px',
      fontFamily: 'Inter, system-ui, sans-serif',
      background: '#2563eb',
      color: '#0f172a',
      border: 'none',
      borderRadius: '999px',
      cursor: 'pointer',
      pointerEvents: 'auto',
      boxShadow: '0 12px 28px rgba(37,99,235,0.35)',
      fontWeight: '600'
    });

    button.addEventListener('click', function(ev) {
      ev.preventDefault();
      ev.stopPropagation();
      if (!currentTarget || !parentWin) return;
      var payload = {
        type: 'edit-element',
        tagName: currentTarget.tagName || null,
        id: currentTarget.id || null,
        classes: (currentTarget.className || '').toString(),
        path: getElementPath(currentTarget),
        outerHTML: currentTarget.outerHTML || ''
      };
      parentWin.postMessage(payload, '*');
    });

    details = document.createElement('div');
    Object.assign(details.style, {
      marginTop: '6px',
      fontSize: '11px',
      fontFamily: 'Inter, system-ui, sans-serif',
      padding: '4px 10px',
      background: 'rgba(15,23,42,0.92)',
      color: '#cbd5f5',
      borderRadius: '999px',
      display: 'inline-flex',
      gap: '6px',
      alignItems: 'center',
      pointerEvents: 'none',
      maxWidth: '260px',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    });

    buttonWrapper.appendChild(button);
    buttonWrapper.appendChild(details);
  }

  function mountUi() {
    ensureElements();
    if (!highlight.parentNode) document.body.appendChild(highlight);
    if (!buttonWrapper.parentNode) document.body.appendChild(buttonWrapper);
  }

  function unmountUi() {
    if (highlight && highlight.parentNode) highlight.parentNode.removeChild(highlight);
    if (buttonWrapper && buttonWrapper.parentNode) buttonWrapper.parentNode.removeChild(buttonWrapper);
  }

  function describe(el) {
    if (!el) return '';
    var parts = [el.tagName.toLowerCase()];
    if (el.id) parts.push('#' + el.id);
    var cls = (el.className || '').toString().trim();
    if (cls) parts.push('.' + cls.split(/\s+/).slice(0, 2).join('.'));
    return parts.join('');
  }

  function isEligible(el) {
    if (!el || el === document.documentElement || el === document.body) return false;
    if (highlight && (el === highlight || el === badge)) return false;
    var tag = el.tagName;
    var rect = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
    if (tag === 'SECTION' || tag === 'HEADER' || tag === 'FOOTER' || tag === 'NAV' || tag === 'MAIN' || tag === 'ARTICLE' || tag === 'ASIDE') return true;
    if (tag === 'DIV') {
      var clsName = (el.className || '').toString();
      if (/hero|section|footer|header|nav|cta|banner|feature/i.test(clsName)) return true;
      if (rect && rect.width > 160 && rect.height > 80) return true;
    }
    if (tag === 'IMG' && el.parentElement) return isEligible(el.parentElement);
    return el.hasAttribute('data-editable');
  }

  function handlePointerMove(ev) {
    if (!active) return;
    if (buttonWrapper && buttonWrapper.contains(ev.target)) return;
    var el = ev.target;
    while (el && !isEligible(el)) {
      el = el.parentElement;
    }
    if (el !== currentTarget) {
      currentTarget = el || null;
      updateOverlay();
    }
  }

  function refreshPosition() {
    if (!active) return;
    if (currentTarget) updateOverlay();
  }

  function hideOverlay() {
    if (highlight) highlight.style.display = 'none';
    if (buttonWrapper) buttonWrapper.style.display = 'none';
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function updateOverlay() {
    if (!active) return;
    if (!highlight) {
      mountUi();
      return;
    }
    if (!currentTarget) {
      hideOverlay();
      return;
    }
    if (!document.contains(currentTarget)) {
      currentTarget = null;
      hideOverlay();
      return;
    }

    var rect = currentTarget.getBoundingClientRect();
    var width = Math.max(rect.width, 1);
    var height = Math.max(rect.height, 1);
    var left = rect.left;
    var top = rect.top;

    rafId = requestAnimationFrame(function () {
      if (!highlight) return;
      highlight.style.display = 'block';
      highlight.style.left = Math.round(left) + 'px';
      highlight.style.top = Math.round(top) + 'px';
      highlight.style.width = Math.round(width) + 'px';
      highlight.style.height = Math.round(height) + 'px';

      if (badge) {
        badge.textContent = describe(currentTarget);
        var badgeOffset = 0;
        if (left + badge.offsetWidth > window.innerWidth - 12) {
          badgeOffset = window.innerWidth - left - badge.offsetWidth - 12;
        }
        badge.style.left = Math.max(badgeOffset, -4) + 'px';
      }

      if (buttonWrapper) {
        buttonWrapper.style.display = 'block';
        var buttonTop = rect.bottom + 14;
        if (buttonTop + 44 > window.innerHeight - 8) {
          buttonTop = rect.top - 58;
        }
        var buttonLeft = rect.left + width / 2 - 95;
        buttonLeft = Math.max(12, Math.min(buttonLeft, window.innerWidth - 210));
        buttonWrapper.style.left = Math.round(buttonLeft) + 'px';
        buttonWrapper.style.top = Math.round(buttonTop) + 'px';
        if (details) {
          details.textContent = describe(currentTarget);
        }
      }
    });
  }

  function getElementPath(node) {
    if (!node || node.nodeType !== 1) return '';
    var segments = [];
    while (node && node.nodeType === 1 && node !== document.body) {
      var selector = node.nodeName.toLowerCase();
      if (node.id) {
        selector += '#' + node.id;
        segments.unshift(selector);
        break;
      } else {
        var sib = node, idx = 1;
        while ((sib = sib.previousElementSibling)) {
          if (sib.nodeName === node.nodeName) idx++;
        }
        selector += ':nth-of-type(' + idx + ')';
        segments.unshift(selector);
        node = node.parentElement;
      }
    }
    return segments.join(' > ');
  }

  function enableInspector() {
    if (active) return;
    active = true;
    mountUi();
    hideOverlay();
    document.addEventListener('pointermove', handlePointerMove, true);
    document.addEventListener('scroll', refreshPosition, true);
    window.addEventListener('resize', refreshPosition);
  }

  function disableInspector() {
    if (!active) return;
    active = false;
    document.removeEventListener('pointermove', handlePointerMove, true);
    document.removeEventListener('scroll', refreshPosition, true);
    window.removeEventListener('resize', refreshPosition);
    currentTarget = null;
    hideOverlay();
    unmountUi();
  }

  window.addEventListener('click', function(ev){
    if (!active) return;
    var el = ev.target;
    while (el && !isEligible(el)) {
      el = el.parentElement;
    }
    if (!el) {
      currentTarget = null;
      hideOverlay();
      return;
    }
    currentTarget = el;
    updateOverlay();
    if (button && button.contains(ev.target)) {
      return;
    }
    ev.preventDefault();
    ev.stopPropagation();
    var payload = {
      type: 'edit-element',
      tagName: el.tagName || null,
      id: el.id || null,
      classes: (el.className || '').toString(),
      path: getElementPath(el),
      outerHTML: el.outerHTML || ''
    };
    parentWin.postMessage(payload, '*');
  }, true);

  window.addEventListener('message', function(event) {
    var data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'wg-set-inspector') {
      if (data.enabled) {
        enableInspector();
      } else {
        disableInspector();
      }
    }
  });
})();
<\/script>`;
      try {
        if (/<\/body>/i.test(processedHtml)) {
          processedHtml = processedHtml.replace(
            /<\/body>/i,
            routerScript + inspectorScript + '</body>'
          );
        } else {
          processedHtml = `${processedHtml}${routerScript}${inspectorScript}`;
        }
      } catch (error) {
        console.error('Failed to inject inspector script', error);
      }

      const blob = new Blob([processedHtml], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      setPreviewSrc(url);
    }, 500),
    []
  );

  useEffect(() => {
    updatePreviewDebounced(site, currentPreviewPath);
  }, [site, currentPreviewPath, updatePreviewDebounced]);

  // This effect handles the cleanup of the blob URL
  useEffect(() => {
    // This is the cleanup function for the PREVIOUS value of previewSrc
    return () => {
      if (previewSrc) {
        URL.revokeObjectURL(previewSrc);
      }
    };
  }, [previewSrc]); // Runs ONLY when previewSrc changes


  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'wg-preview-request') {
        const requester = event.source as Window | null;
        if (requester && typeof requester.postMessage === 'function') {
          previewWindowsRef.current.add(requester);
          postPreviewState(requester, { currentPath: currentPreviewPath });
        }
        return;
      }

      const sourceWindow = iframeRef.current?.contentWindow;
      if (event.source !== sourceWindow) return;
      if (data.type === 'open-path') {
        const path = data.path;
        if (site.files[path]) {
          setCurrentPreviewPath(path);
        }
      }
      if (data.type === 'edit-element') {
        setInspectorEnabled(false);
        const targetPath = currentPreviewPath || 'index.html';
        setElementTarget({
          fileName: targetPath,
          elementHtml: data.outerHTML || '',
          tagName: data.tagName || null,
          elementId: data.id || null,
          path: data.path || null,
        });
        setElementPrompt('');
        setElementDialogOpen(true);
      }
      if (data.type === 'close-edit-element') {
        setElementTarget(null);
        setElementDialogOpen(false);
        setElementPrompt('');
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [site, currentPreviewPath]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const postState = () => {
      try {
        iframe.contentWindow?.postMessage({ type: 'wg-set-inspector', enabled: inspectorEnabled }, '*');
      } catch (error) {
        console.error('Failed to sync inspector state', error);
      }
    };

    if (iframe.contentWindow) {
      postState();
    }

    const handleLoad = () => {
      postState();
    };

    iframe.addEventListener('load', handleLoad);
    return () => {
      iframe.removeEventListener('load', handleLoad);
    };
  }, [inspectorEnabled, previewSrc]);

  const getLanguage = (path: string) => {
    const ext = path.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'html': return 'html';
      case 'css': return 'css';
      case 'js': case 'jsx': return 'javascript';
      case 'ts': case 'tsx': return 'typescript';
      case 'json': return 'json';
      case 'md': return 'markdown';
      case 'yaml': case 'yml': return 'yaml';
      default: return 'plaintext';
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      // Use a safe slug for ZIP filename/folder
      const result = await downloadZipAction({
        domain: slugName,
        files: site.files as Record<string, string>,
      });

      if (result.success && result.zip && result.filename) {
        const link = document.createElement('a');
        link.href = `data:application/zip;base64,${result.zip}`;
        link.download = result.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast({
          title: 'Download Started',
          description: `Your file ${result.filename} is downloading.`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Download Failed',
          description: result.error || 'Could not create ZIP file.',
        });
      }
    } catch (err) {
      console.error('Download error', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Unexpected error during download.',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  // Placeholder publish flow (to be replaced with real hosting)
  const handlePublish = async () => {
    setIsPublishOpen(true);
    setAutoPublishPending(true);
  };

  // Monaco: subtle, thin scrollbars
  const handleEditorMount = useCallback((editor: any, monaco: any) => {
    try {
      monaco.editor.defineTheme('webgenius-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [],
        colors: {
          // White sliders over dark track (consistent across app)
          'scrollbarSlider.background': '#cdd5ff88',
          'scrollbarSlider.hoverBackground': '#cdd5ffcc',
          'scrollbarSlider.activeBackground': '#cdd5ffff',
          // Make selection highly visible, close to VS Code defaults
          'editor.selectionBackground': '#345fe8b8',
          'editor.selectionHighlightBackground': '#4f6ee533',
          'editor.selectionForeground': '#ffffff',
          'editor.selectionHighlightBorder': '#6b83ff66',
          'editor.lineHighlightBackground': '#262c3d80',
          'editorCursor.foreground': '#b7d7ff',
        },
      });
      monaco.editor.setTheme('webgenius-dark');
    } catch (e) {
      // noop: fallback to vs-dark if theme definition fails
    }

    // Enable Emmet for HTML, CSS, and JSX/TSX
    emmetHTML(monaco);
    emmetCSS(monaco);
    emmetJSX(monaco);

    // Path autocompletion provider
    const completionProvider = monaco.languages.registerCompletionItemProvider(['html', 'css', 'javascript', 'typescript'], {
      triggerCharacters: ['"', "'", '/', '.'],
      provideCompletionItems: (model: any, position: any) => {
        const textUntilPosition = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        });

        // Trigger inside src="", href="", or url()
        const pathTriggerMatch = textUntilPosition.match(/(src|href)=["']([^"']*)?$/) || textUntilPosition.match(/url\(["']?([^"']*)?$/);

        if (!pathTriggerMatch) {
          return { suggestions: [] };
        }

        const currentInput = pathTriggerMatch[2] || '';
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: position.column - currentInput.length,
          endColumn: position.column,
        };

        const suggestions = fileListForMonaco.current.map(path => ({
          label: path,
          kind: monaco.languages.CompletionItemKind.File,
          insertText: path,
          range: range,
        }));

        return {
          suggestions: suggestions,
        };
      },
    });
    // It's good practice to dispose of the provider on unmount, but since the editor
    // instance lives for the lifetime of the component, and onMount is called only once,
    // we don't have a corresponding unmount hook from the editor itself.
  }, []); // Empty dependency array is correct here, we use a ref for the file list.

  // --- RENDER ---
  return (
    <div className="flex flex-col h-screen w-screen bg-[#1e1e1e] text-[#d4d4d4] overflow-hidden">
      <Dialog
        open={elementDialogOpen && !!elementTarget}
        onOpenChange={(open) => {
          if (!open) {
            setElementDialogOpen(false);
            setElementTarget(null);
            setElementPrompt('');
          }
        }}
      >
        <DialogContent className="max-w-md rounded-xl border border-white/10 bg-[#111216] text-slate-100">
          <DialogHeader>
            <DialogTitle>Edit element</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="max-h-48 overflow-auto rounded-md bg-black/30 border border-white/10 p-3 text-xs text-slate-300">
              <pre className="whitespace-pre-wrap break-words">{elementTarget?.elementHtml}</pre>
            </div>
            <form
              action={editElementFormAction}
              onSubmit={(e) => {
                if (!elementTarget) { e.preventDefault(); return; }
                const trimmed = elementPrompt.trim();
                if (!trimmed || isElementEditing) { e.preventDefault(); return; }
                if (!userId || !siteId) {
                  e.preventDefault();
                  toast({ variant: 'destructive', title: 'Sign in required', description: 'Save your project before editing.' });
                  return;
                }
                setPendingElementTarget(elementTarget);
                const originalFile = (site.files[elementTarget.fileName] as string) || '';
                setPendingElementOriginalFile(originalFile);
                setPendingElementOriginalCss(elementCssContext);
                const userMessageId = generateMessageId();
                const placeholderId = generateMessageId();
                const createdAt = new Date().toISOString();
                setChatHistory((prev) => [
                  ...prev,
                  {
                    id: userMessageId,
                    sender: 'user',
                    text: trimmed,
                    file: elementTarget.fileName,
                    createdAt,
                  },
                  createPendingAiMessage(placeholderId, elementTarget.fileName),
                ]);
                pendingAiMessageIdsRef.current.element = placeholderId;
                setElementPrompt('');
              }}
              className="space-y-3"
            >
              <Textarea
                name="prompt"
                value={elementPrompt}
                onChange={(e) => setElementPrompt(e.target.value)}
                placeholder="Describe the changes you want to apply..."
                className="min-h-[120px] bg-[#131417] text-sm text-slate-200 border border-slate-700"
                disabled={isElementEditing}
              />
              <input type="hidden" name="fileName" value={elementTarget?.fileName || ''} />
              <input type="hidden" name="fileCode" value={(elementTarget && typeof site.files[elementTarget.fileName] === 'string' ? (site.files[elementTarget.fileName] as string) : '')} />
              <input type="hidden" name="elementHtml" value={elementTarget?.elementHtml || ''} />
              <input type="hidden" name="elementId" value={elementTarget?.elementId || ''} />
              <input type="hidden" name="tagName" value={elementTarget?.tagName || ''} />
              <input type="hidden" name="path" value={elementTarget?.path || ''} />
              <input type="hidden" name="cssContent" value={elementCssContext} />
              <input type="hidden" name="userId" value={userId || ''} />
              <input type="hidden" name="siteId" value={siteId || ''} />
              <input type="hidden" name="siteTypes" value={serializedSiteTypes} />
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="text-slate-300"
                  onClick={() => {
                    setElementDialogOpen(false);
                    setElementTarget(null);
                  }}
                  disabled={isElementEditing}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={!elementPrompt.trim() || isElementEditing}>
                  {isElementEditing ? 'Applying…' : 'Apply changes'}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>
      

      <Dialog
        open={isProjectsOpen}
        onOpenChange={(open) => {
          setIsProjectsOpen(open);
          if (!open) {
            setProjectsSearch('');
            setProjectsPreset('all');
            setProjectsPage(1);
            setProjectsError(null);
            setProjectsDeleteTarget(null);
            setProjectsDeletePending(false);
          }
        }}
      >
        <DialogContent className="w-[98vw] h-[96vh] sm:w-[98vw] sm:h-[96vh] max-w-none overflow-hidden border border-white/10 bg-[#05070f] text-slate-100 p-0 rounded-xl md:rounded-2xl gap-0">
          <div className="flex h-full min-h-0 flex-col">
            <div className="space-y-6 px-6 py-6 sm:px-8 sm:py-7">
              <div className="flex items-start justify-between gap-3">
                <DialogHeader className="space-y-1 text-left">
                  <DialogTitle className="text-2xl font-semibold text-white sm:text-3xl">My Projects</DialogTitle>
                  <p className="text-sm text-slate-400">Drafts, deploys, and cloaked versions in one place.</p>
                </DialogHeader>
                <Button
                  variant="ghost"
                  size="sm"
                  className="sm:hidden rounded-full border border-white/10 bg-white/5 px-3 text-xs font-medium text-slate-200 hover:border-sky-400/50 hover:text-white"
                  onClick={() => setIsProjectsOpen(false)}
                >
                  Back to editor
                </Button>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <Input
                      placeholder="Search by name or domain"
                      value={projectsSearch}
                      onChange={(event) => setProjectsSearch(event.target.value)}
                      className="h-11 rounded-2xl border-white/10 bg-white/[0.04] pl-11 text-sm text-white placeholder:text-slate-500 focus-visible:border-white/10 focus-visible:ring-0"
                    />
                  </div>
                  <div className="w-full sm:w-auto">
                    <Select value={projectsSort} onValueChange={(value) => setProjectsSort(value as typeof projectsSort)}>
                      <SelectTrigger className="h-11 w-full rounded-2xl border-white/10 bg-white/[0.04] text-sm text-white sm:w-48">
                        <SelectValue placeholder="Sort" />
                      </SelectTrigger>
                      <SelectContent className="border-white/10 bg-[#0f172a] text-slate-100">
                        <SelectItem value="recent">Latest updates</SelectItem>
                        <SelectItem value="name">Alphabetical</SelectItem>
                        <SelectItem value="status">By status</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Tabs value={projectsPreset} onValueChange={(value) => setProjectsPreset(value as ProjectStatusKey)}>
                  <TabsList className="mt-4 grid grid-cols-2 gap-2 p-0 sm:flex sm:flex-wrap">
                    {PROJECT_STATUS_PRESETS.map((preset) => (
                      <TabsTrigger
                        key={preset.key}
                        value={preset.key}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-transparent px-4 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-0 data-[state=active]:bg-sky-500/20 data-[state=active]:text-white sm:flex-none"
                      >
                        {PROJECT_STATUS_STYLES[preset.key].icon}
                        <span>{PROJECT_STATUS_STYLES[preset.key].label}</span>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>
            </div>

            {projectsError ? (
              <div className="px-6 pb-4 sm:px-8">
                <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{projectsError}</div>
              </div>
            ) : null}

            <ScrollArea className="flex-1 min-h-0 px-6 pb-6 pr-1 sm:px-8">
              <div className="flex flex-col gap-4 pb-2">
                {projectsLoading ? (
                  <div className="flex justify-center py-12 text-slate-400">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : paginatedProjects.length === 0 ? (
                  <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-slate-300 shadow-[0_20px_45px_rgba(8,15,35,0.35)]">
                    No projects match this view yet.
                  </div>
                ) : (
                  <div className="board-panel">
                    <div className="board-header">
                      <span>Project</span>
                      <span>Domain</span>
                      <span>Updated</span>
                      <span>Status</span>
                      <span className="text-right">Actions</span>
                    </div>
                    <div className="board-body">
                      {groupedProjects.map((group) => (
                        <div
                          key={group.key}
                          className="board-group"
                          style={{ ['--group-accent' as any]: group.accent }}
                        >
                          <div className="board-group-header">{group.label}</div>
                          {group.projects.map((project) => {
                            const domain = deriveProjectDomain(project);
                            const liveUrl = domain ? toExternalUrl(domain) : null;
                            return (
                              <div key={project.id} className="board-row">
                                <div className="board-cell">
                                  <button
                                    className="board-title text-left hover:text-sky-300 transition"
                                    onClick={() => handleProjectOpen(project)}
                                  >
                                    {project.name}
                                  </button>
                                  <span className="board-subtitle">{project.slug}</span>
                                </div>
                                <div className="board-cell">
                                  <span className="board-label">Domain</span>
                                  <span className="board-meta truncate">{domain || '—'}</span>
                                </div>
                                <div className="board-cell board-cell--meta-right">
                                  <span className="board-label">Updated</span>
                                  <span className="board-meta">{new Date(project.updated_at).toLocaleString()}</span>
                                </div>
                                <div className="board-cell board-cell--status">
                                  <span className="board-label">Status</span>
                                  {renderProjectBadge(project)}
                                </div>
                                <div className="board-cell board-cell--actions">
                                  <span className="board-label">Actions</span>
                              <div className="board-actions">
                                <Button
                                  size="sm"
                                  className="h-8 rounded-md bg-[#3b82f6] px-4 text-xs font-medium text-white transition-colors hover:bg-[#2563eb]"
                                  onClick={() => handleProjectOpen(project)}
                                >
                                  Open
                                </Button>
                                {liveUrl ? (
                                  <Button
                                    asChild
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 rounded-md border border-slate-500/40 bg-transparent px-3 text-xs font-medium text-slate-200 transition-colors hover:border-slate-400/60 hover:bg-slate-500/10 hover:text-white"
                                  >
                                    <a href={liveUrl} target="_blank" rel="noopener noreferrer">
                                      <ExternalLink className="mr-1 h-3.5 w-3.5" /> Live site
                                    </a>
                                  </Button>
                                ) : null}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 rounded-md border border-rose-400/45 bg-transparent px-3 text-xs font-medium text-rose-200 transition-colors hover:border-rose-400 hover:bg-rose-500/10 hover:text-white"
                                  onClick={() => setProjectsDeleteTarget(project)}
                                >
                                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                                </Button>
                              </div>
                          </div>
                        </div>
                      );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!projectsLoading && paginatedProjects.length > 0 ? (
                  <div className="mx-auto flex max-w-3xl flex-col items-center justify-between gap-3 rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3 text-[11px] text-slate-400 sm:flex-row">
                    <div>
                      Page {projectsCurrentPage} of {projectsTotalPages} • {filteredProjects.length} projects
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-full border border-white/10 bg-white/5 px-3 text-xs text-slate-200 hover:border-sky-400/50 hover:text-white"
                        onClick={() => setProjectsPage((prev) => Math.max(1, prev - 1))}
                        disabled={projectsCurrentPage === 1}
                      >
                        <ChevronLeft className="mr-1 h-4 w-4" />Prev
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-full border border-white/10 bg-white/5 px-3 text-xs text-slate-200 hover:border-sky-400/50 hover:text-white"
                        onClick={() => setProjectsPage((prev) => Math.min(projectsTotalPages, prev + 1))}
                        disabled={projectsCurrentPage === projectsTotalPages}
                      >
                        Next<ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : null}

                {projectsPreset === 'deploy' && !projectsLoading ? (
                  <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-200">Deployed sites</h3>
                    {deployedSites.length === 0 ? (
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-xs text-slate-400">
                        No deployments yet.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {deployedSites.map((deploy) => (
                          <div
                            key={deploy.id}
                            className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3 text-xs"
                          >
                            <div className="truncate">
                              <a
                                href={deploy.url || `https://${deploy.domain}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-sky-300 hover:text-sky-200"
                              >
                                {deploy.domain}
                              </a>
                              <p className="text-[11px] text-slate-400">{new Date(deploy.created_at).toLocaleString()}</p>
                            </div>
                            <Badge className={`px-2 py-1 text-[11px] font-medium ${deploy.status === 'succeeded' ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200' : 'border-rose-500/40 bg-rose-500/15 text-rose-200'}`}>
                              {deploy.status || 'pending'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!projectsDeleteTarget}
        onOpenChange={(open) => {
          if (!open) {
            setProjectsDeleteTarget(null);
            setProjectsDeletePending(false);
          }
        }}
      >
        <AlertDialogContent className="border-white/10 bg-[#0b1120] text-slate-100">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              This action permanently removes “{projectsDeleteTarget?.name}” and related files.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={projectsDeletePending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleProjectDelete}
              disabled={projectsDeletePending}
              className="bg-rose-500 text-white hover:bg-rose-600"
            >
              {projectsDeletePending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={!!diffView} onOpenChange={(v)=>{ if(!v) setDiffView(null); }}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Changes: {diffView?.file}</DialogTitle>
          </DialogHeader>
          <div className="h-[70vh]">
            {diffView && (
              <DiffEditor
                height="100%"
                language={getLanguage(diffView.file)}
                original={diffView.before}
                modified={diffView.after}
                theme="vs-dark"
                options={{ readOnly: true, renderSideBySide: true, minimap: { enabled: false }, wordWrap: 'on' }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
      <header className="flex items-center justify-between p-2 flex-shrink-0 bg-transparent">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Generator
        </Button>
        <h1 className="text-lg font-bold truncate px-4">{displayName}</h1>
        <div className="flex items-center gap-2">
          {/* Icon pills (style like in example) */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-2 rounded-full px-4 h-9 bg-[#24262c] text-slate-200 border border-white/5 hover:bg-[#2f3036] hover:text-white transition"
                  onClick={() => setIsProjectsOpen(true)}
                >
                  <Folder className="h-4 w-4" />
                  <span className="text-sm font-medium">My Projects</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open saved projects</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-pressed={inspectorEnabled}
                  className={`flex items-center gap-2 rounded-full px-4 h-9 border transition ${
                    inspectorEnabled
                      ? 'bg-white text-slate-900 border-white'
                      : 'bg-[#24262c] text-slate-200 border-white/5 hover:bg-[#2f3036] hover:text-white'
                  }`}
                  onClick={() => setInspectorEnabled((prev) => !prev)}
                >
                  <MousePointerSquare className="h-4 w-4" />
                  <span className="text-sm font-medium">Select</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{inspectorEnabled ? 'Disable selection mode' : 'Enable selection mode'}</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Button
            variant="ghost"
            size="icon"
            title="Refresh"
            className="h-9 w-9 rounded-xl bg-[#2f3136] text-white/80 hover:text-white hover:bg-[#3b3d42] shadow-sm"
            onClick={updatePreviewDebounced.flush}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Open in new tab"
            className="h-9 w-9 rounded-xl bg-[#2f3136] text-white/80 hover:text-white hover:bg-[#3b3d42] shadow-sm disabled:opacity-40"
            onClick={() => {
              if (!siteId) return;
              const win = window.open(`/preview/${siteId}`, '_blank');
              if (win) {
                previewWindowsRef.current.add(win);
                setTimeout(() => postPreviewState(win), 120);
              }
            }}
            disabled={!siteId}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-9 w-9 rounded-xl shadow-sm ${
                    activeTab === 'preview'
                      ? 'bg-white text-black'
                      : 'bg-[#2f3136] text-white/80 hover:text-white hover:bg-[#3b3d42]'
                  }`}
                  onClick={() => setActiveTab('preview')}
                  aria-label="Preview"
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Preview</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button
            variant="ghost"
            size="icon"
            title="Code"
            className={`h-9 w-9 rounded-xl shadow-sm ${
              activeTab === 'code'
                ? 'bg-white text-black'
                : 'bg-[#2f3136] text-white/80 hover:text-white hover:bg-[#3b3d42]'
            }`}
            onClick={() => setActiveTab('code')}
          >
            <Code className="h-4 w-4" />
          </Button>

          {/* Settings */}
          <Button
            variant="ghost"
            size="icon"
            title="Publish Settings"
            className="h-9 w-9 rounded-xl bg-[#2f3136] text-white/80 hover:text-white hover:bg-[#3b3d42] shadow-sm"
            onClick={() => setIsSettingsOpen(true)}
          >
            <SettingsIcon className="h-4 w-4" />
          </Button>

          {/* Publish pill */}
          <Button
            variant="ghost"
            size="sm"
            className="h-9 rounded-xl px-3 bg-[#3a3a3a] text-white/90 hover:bg-[#4a4a4a]"
            onClick={handlePublish}
            disabled={isPublishing}
          >
            {isPublishing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <UploadCloud className="mr-2 h-4 w-4" />
            )}
            Publish
          </Button>
          <Button
            size="sm"
            className="h-9 rounded-xl px-3 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
            onClick={handleDownload}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Download ZIP
          </Button>
          {avatarUrl && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={avatarUrl} alt="User avatar" />
                    <AvatarFallback><User className="h-5 w-5" /></AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-72" align="center" forceMount>
                <div className="px-4 pt-4 pb-2 flex flex-col items-center gap-2 text-center">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={avatarUrl} alt="User avatar" />
                    <AvatarFallback><User className="h-5 w-5" /></AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{userDisplayName || 'User'}</div>
                    <div className="text-xs text-white/60 truncate">ID: {userId}</div>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="justify-center text-rose-400 hover:text-rose-300" onClick={() => window.location.assign('/') }>
                  <LogOut className="h-4 w-4" /> Sign out
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <div className="px-3 py-2 text-[11px] text-white/50 text-center">WebGenius Beta 2.0</div>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* File Explorer */}
        <div
          className={`w-64 border-r bg-transparent overflow-y-auto ${dragOverPath !== null ? 'bg-accent/5' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            // keep highlight while dragging over explorer area
            if (dragOverPath === null) setDragOverPath('');
          }}
          onDragLeave={() => setDragOverPath(null)}
          onDrop={(e) => handleDrop(e, dragOverPath || '')}
          onMouseDown={() => setDragOverPath(null)}
        >
          <Card className={`rounded-none border-0 bg-transparent flex flex-col h-full ${dragOverPath !== null ? 'ring-1 ring-accent/40' : ''}`}>
            <CardHeader className="p-2 border-b border-transparent flex items-center justify-between bg-transparent">
              <CardTitle className="text-xs uppercase tracking-wider text-[#9da5b4] flex items-center gap-2">
                <Folder className="h-4 w-4 text-[#9da5b4]" /> File Explorer
              </CardTitle>
              <div className="flex items-center">
                 <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-[#c5c5c5] hover:bg-[#2a2d2e] hover:text-white rounded-md"
                  onClick={() => {
                    setSelectedFolderForNew('');
                    setIsAddFileOpen(true);
                  }}
                >
                  <FilePlus className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-[#c5c5c5] hover:bg-[#2a2d2e] hover:text-white rounded-md"
                  onClick={() => {
                    setSelectedFolderForNew('');
                    setIsAddFolderOpen(true);
                  }}
                  
                >
                  <FolderPlus className="h-4 w-4" />
                </Button>
              </div>
          </CardHeader>
          <CardContent className="p-2 flex-1 overflow-y-auto" onClick={() => {
            setSelectedFolderForNew('');
            setSelectedFileInTree(null);
          }}>
            <FileTreeView node={fileTree} />
          </CardContent>
          {dragOverPath !== null && (
            <div className="p-2 text-[11px] text-[#c5c5c5] border-t border-accent/30 bg-accent/5">
              Drop files here → {dragOverPath || 'root'}
            </div>
          )}
          </Card>
        </div>

        {/* Editor + Preview */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 p-3 border-b border-[#3a3d3e]">
            <div className="h-full rounded-2xl border border-[#2a2d2e] bg-[#0f1011]/80 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_10px_30px_rgba(0,0,0,0.45)] overflow-hidden backdrop-blur-md">
              <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="flex-1 flex flex-col overflow-hidden h-full"
              >

            <TabsContent value="code" className="flex-1 overflow-hidden mt-0">
              <div className="flex h-full min-h-0 flex-col bg-transparent">
                {/* Editor Tabs */}
                <div className="flex overflow-x-auto border-b border-[#333333] bg-[#252526]">
                  {openTabs.map((tab) => (
                    <div
                      key={tab.path}
                      className={`flex items-center gap-2 px-4 py-2 cursor-pointer border-r border-[#333333] ${
                        activeEditorTab === tab.path
                          ? 'bg-[#1e1e1e] border-b-2 border-b-accent'
                          : 'bg-[#252526]'
                      }`}
                      onClick={() => {
                        setActiveEditorTab(tab.path);
                        setSelectedFileInTree(tab.path);
                        setActiveFile(tab.path);
                      }}
                    >
                      {fileIcon(tab.path.split('/').pop() || '')}
                      <span className="text-sm text-[#cccccc]">
                        {tab.path.split('/').pop()}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 ml-2 text-[#c5c5c5] hover:text-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          closeTab(tab.path);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="relative flex-1 min-h-0 bg-[#1e1e1e]">
                  {activeEditorTab ? (
                    /\.(png|jpe?g|gif|svg|webp|avif|ico)$/i.test(activeEditorTab) ? (
                      <div className="flex h-full items-center justify-center p-4">
                        <img
                          src={toStringContent(site.files[activeEditorTab])}
                          alt={activeEditorTab}
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                    ) : (
                      <Editor
                        height="100%"
                        path={activeEditorTab}
                        defaultLanguage={getLanguage(activeEditorTab)}
                        value={toStringContent(site.files[activeEditorTab]) || ''}
                        onChange={(value) => handleEditorChange(value, activeEditorTab)}
                        theme="webgenius-dark"
                        onMount={handleEditorMount}
                        options={{
                          fontSize: 14,
                          minimap: { enabled: false },
                          automaticLayout: true,
                          smoothScrolling: true,
                          cursorBlinking: 'phase',
                          cursorSmoothCaretAnimation: true,
                          mouseWheelScrollSensitivity: 1.4,
                          fastScrollSensitivity: 4,
                          scrollBeyondLastColumn: 6,
                          selectionHighlight: true,
                          roundedSelection: true,
                          renderLineHighlight: 'all',
                          renderWhitespace: 'selection',
                          mouseWheelZoom: false,
                          dragAndDrop: true,
                          wordWrap: 'off',
                          multiCursorModifier: 'alt',
                          scrollbar: {
                            vertical: 'visible',
                            horizontal: 'visible',
                            useShadows: false,
                            verticalScrollbarSize: 12,
                            horizontalScrollbarSize: 12,
                            handleMouseWheel: true,
                            horizontalHasArrows: true,
                            verticalHasArrows: false,
                            arrowSize: 12,
                          },
                        }}
                      />
                    )
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-[#a6accd]">
                      <FileCode className="h-10 w-10 text-[#636b90]" />
                      <p>Select a file from the tree to start editing.</p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="preview" className="flex-1 overflow-hidden mt-0">
              <div className="flex-1 relative h-full">
                {previewSrc ? (
                  <iframe
                    src={previewSrc}
                    title="Website Preview"
                    className="w-full h-full border-0"
                    sandbox="allow-scripts allow-same-origin allow-pointer-lock"
                    ref={iframeRef}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-300">
                    <div className="h-14 w-14 rounded-full border-2 border-indigo-500/40 border-t-indigo-400 animate-spin"></div>
                    <p className="text-sm uppercase tracking-[0.3em] text-indigo-200">Loading</p>
                  </div>
                )}
              </div>
            </TabsContent>
              </Tabs>
            </div>
          </div>
        </main>

        {/* AI Chat */}
        <aside className="w-[21.3%] max-w-sm flex flex-col bg-transparent relative">
          <Card className="h-full rounded-none border-0 flex flex-col bg-transparent">
            <CardHeader className="p-4 bg-transparent">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                AI Code Assistant
              </CardTitle>
            </CardHeader>
            <div className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <CardContent className="p-4 space-y-4">
                  {chatHistory.length === 0 ? (
                    <div className="text-sm text-center text-muted-foreground py-10">
                      Select a file and ask the AI to make changes. Try "change
                      the button color to blue".
                    </div>
                  ) : (
                    chatHistory.map((msg, index) => {
                      const timestamp = formatTimestamp(msg.createdAt);
                      const contextLabel = msg.file ? msg.file : 'Whole Project';
                      const isAi = msg.sender === 'ai';
                      const isPending = !!msg.pending;
                      return (
                        <div key={msg.id ?? index} className={`flex gap-3 ${isAi ? '' : 'justify-end'}`}>
                          {isAi && (
                            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary/30 to-primary/5 text-primary flex items-center justify-center border border-primary/40">
                              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                            </div>
                          )}
                          <div className="max-w-xs w-full">
                            <div className={`group rounded-2xl border px-3 py-3 text-sm transition ${isAi ? 'border-[#2d313c] bg-[#16171c] text-[#e7e9f3] shadow-[0_8px_24px_rgba(10,10,25,0.32)]' : 'border-primary/30 bg-primary/20 text-white shadow-[0_8px_24px_rgba(80,56,237,0.32)]'} ${isPending ? 'opacity-90' : ''}`}>
                              <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.08em]">
                                <span className={`font-semibold ${isAi ? 'text-[#aab0c7]' : 'text-white/80'}`}>
                                  {isAi ? (isPending ? 'AI · Working' : 'AI · Edited') : 'You · Editing'} — {contextLabel}
                                </span>
                                <span className={isAi ? 'text-[#7a8193]' : 'text-white/70'}>{timestamp}</span>
                              </div>
                              {isPending ? (
                                <div className="mt-3 flex items-center gap-2 text-[12px] text-[#aab0c7]">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  <span>AI is crafting the update...</span>
                                </div>
                              ) : (
                                msg.text && (
                                  <p className={`mt-3 whitespace-pre-wrap leading-6 ${isAi ? 'text-[#eceff8]' : 'text-white'}`}>{msg.text}</p>
                                )
                              )}
                              {!isPending && msg.diff && (
                                <div className="mt-4 rounded-xl border border-[#2b2e35] bg-gradient-to-br from-[#181920] to-[#121218] p-2.5">
                                  <div className="flex items-center justify-between text-[10px] text-[#c1c6d8]">
                                    <span>{msg.file}</span>
                                    <div className="flex items-center gap-1.5">
                                      <span className="inline-flex min-w-[28px] justify-center rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">+{msg.diff.added}</span>
                                      <span className="inline-flex min-w-[28px] justify-center rounded-full bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300">-{msg.diff.removed}</span>
                                    </div>
                                  </div>
                                  <div className="mt-2 flex items-center gap-1.5 text-[11px]">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-6 rounded-lg border-[#343743] px-2 text-[11px] text-[#d5d9ec] hover:bg-[#262832]"
                                      onClick={() => {
                                        const revs = revisions[msg.file || ''] || [];
                                        const last = revs[revs.length - 1];
                                        if (last) setDiffView({ file: msg.file || '', before: last.before, after: last.after });
                                      }}
                                    >
                                      View
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 rounded-lg px-2 text-[11px] text-[#aab0c7] hover:text-white"
                                      onClick={() => {
                                        const f = msg.file || '';
                                        const list = revisions[f] || [];
                                        const last = list[list.length - 1];
                                        if (!last) return;
                                        setSite((prev) => ({ ...prev, files: { ...prev.files, [f]: last.before } }));
                                        pushRevision(f, last.after, last.before, last.removed, last.added);
                                        toast({ title: 'Restored', description: `Reverted changes in ${f}` });
                                      }}
                                    >
                                      Restore
                                    </Button>
                                  </div>
                                </div>
                              )}
                              {!isPending && msg.diffs && (
                                <div className="mt-4 rounded-xl border border-[#2b2e35] bg-gradient-to-br from-[#16161d] to-[#101015] p-2.5 space-y-2.5">
                                  {msg.diffs.map((d, i) => (
                                    <div key={i} className="flex items-center justify-between gap-2 text-[11px] text-[#d4d7e5]">
                                      <div>
                                        <div className="text-[#b9bdd0]">{d.file}</div>
                                        <div className="mt-1 flex items-center gap-1.5">
                                          <span className="inline-flex min-w-[26px] justify-center rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">+{d.added}</span>
                                          <span className="inline-flex min-w-[26px] justify-center rounded-full bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300">-{d.removed}</span>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-6 rounded-lg border-[#343743] px-2 text-[11px] text-[#d5d9ec] hover:bg-[#262832]"
                                          onClick={() => {
                                            const revs = revisions[d.file] || [];
                                            const last = revs[revs.length - 1];
                                            if (last) setDiffView({ file: d.file, before: last.before, after: last.after });
                                          }}
                                        >
                                          View
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 rounded-lg px-2 text-[11px] text-[#aab0c7] hover:text-white"
                                          onClick={() => {
                                            const list = revisions[d.file] || [];
                                            const last = list[list.length - 1];
                                            if (!last) return;
                                            setSite((prev) => ({ ...prev, files: { ...prev.files, [d.file]: last.before } }));
                                            pushRevision(d.file, last.after, last.before, last.removed, last.added);
                                            toast({ title: 'Restored', description: `Reverted changes in ${d.file}` });
                                          }}
                                        >
                                          Restore
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          {!isAi && (
                            <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                              <User className="h-4 w-4" />
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                   {(isEditing || isBulkEditing) && (
                    <div className="flex items-start gap-3 text-sm">
                      <Sparkles className="h-6 w-6 text-primary flex-shrink-0 animate-pulse" />
                      <div className="p-3 rounded-lg bg-[#252526] max-w-xs break-words w-full">
                        <p className="text-xs mb-2 text-primary/90 font-medium">
                          Working on: {isBulkEditing ? 'Whole Project' : (pendingEditFile || activeEditorTab)}
                        </p>
                        <div className="space-y-1.5">
                          {[
                            'Understanding request',
                            isBulkEditing ? 'Analyzing project files' : 'Analyzing current code',
                            'Generating changes',
                            'Applying & updating preview'
                          ].map((label, i) => (
                            <div key={label} className="flex items-center gap-2">
                              {i < progressStep ? (
                                <Check className="h-3.5 w-3.5 text-emerald-500" />
                              ) : i === progressStep ? (
                                <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
                              ) : (
                                <Circle className="h-3.5 w-3.5 text-[#666]" />
                              )}
                              <span className={i === progressStep ? 'text-white' : 'text-[#bdbdbd]'}>{label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={chatScrollRef} />
                </CardContent>
              </ScrollArea>
            </div>
            <div className="p-4 bg-transparent">
              <div className="flex items-center justify-between mb-3">
                <Label htmlFor="whole-site-scope" className="flex items-center gap-2.5 cursor-pointer text-sm text-[#c5c5c5]">
                  <Switch id="whole-site-scope" checked={wholeSiteScope} onCheckedChange={setWholeSiteScope} />
                  Analyze whole project
                </Label>
              </div>
               <form
                action={wholeSiteScope ? bulkFormAction : editCodeFormAction}
                onSubmit={(e) => {
                  const formData = new FormData(e.currentTarget);
                  const prompt = formData.get('prompt') as string;
                  if (!prompt.trim() || (isEditing || isBulkEditing)) {
                    e.preventDefault();
                    return;
                  }
                  if (wholeSiteScope) {
                    const candidates = Object.entries(site.files)
                      .filter(([p, c]) => typeof c === 'string')
                      .filter(([p]) => !(/\.(png|jpe?g|gif|svg|webp|avif|ico)$/i.test(p)))
                      .filter(([p]) => {
                        const normalized = p.replace(/^\.\/?/, '');
                        return !normalized.startsWith('games/') && !normalized.startsWith('images/');
                      })
                      .filter(([p]) => (/\.(html|css|js|ts|tsx|json|md)$/i.test(p)))
                      .map(([p, c]) => ({ fileName: p, code: c as string }));
                    setPendingBulkOriginal(Object.fromEntries(candidates.map(c => [c.fileName, c.code])));
                    // Find the existing hidden input and set its value right before submission
                    const filesPayloadInput = e.currentTarget.elements.namedItem('filesPayload') as HTMLInputElement;
                    if (filesPayloadInput) {
                      filesPayloadInput.value = JSON.stringify({ files: candidates });
                    }
                    const userMessageId = generateMessageId();
                    const placeholderId = generateMessageId();
                    const createdAt = new Date().toISOString();
                    setChatHistory((prev) => [
                      ...prev,
                      { id: userMessageId, sender: 'user', text: chatPrompt, file: 'Whole Project', createdAt },
                      createPendingAiMessage(placeholderId, 'Whole Project'),
                    ]);
                    pendingAiMessageIdsRef.current.bulk = placeholderId;
                    setChatPrompt('');
                  } else {
                    // Remember which file is being edited at submission time.
                    setPendingEditFile(activeEditorTab);
                    setPendingOriginalCode((site.files[activeEditorTab] as string) || '');
                    handleChatSubmit();
                    setChatPrompt('');
                  }
                }}
              >
                <div className="relative">
                  <Input
                    name="prompt"
                    placeholder={wholeSiteScope ? 'e.g., "add a dark mode toggle"' : `Changes for ${activeEditorTab}...`}
                    className="pr-10 bg-[#1f1f1f] text-[#e6e6e6] border border-[#3a3a3a] rounded-md focus:bg-[#1f1f1f] focus-visible:bg-[#1f1f1f] focus-visible:ring-0 focus-visible:ring-offset-0 focus:ring-0 focus:ring-offset-0 focus-visible:border-[#555555] placeholder:text-[#b0b0b0] transition-none"
                    value={chatPrompt}
                    onChange={(e) => setChatPrompt(e.target.value)}
                    disabled={
                      isEditing || isBulkEditing || (!wholeSiteScope && (!activeEditorTab || !!activeEditorTab.match(/\.(png|jpe?g|gif|svg)$/i)))
                    }
                    autoComplete="off"
                  />
                  {/* Placeholder for bulk payload */}
                  <input type="hidden" name="filesPayload" value="" />
                  <input type="hidden" name="fileName" value={activeEditorTab || ''} />
                  <input
                    type="hidden"
                    name="code"
                    value={(site.files[activeEditorTab] as string) || ''}
                  />
                  <input type="hidden" name="userId" value={userId || ''} />
                  <input type="hidden" name="siteId" value={siteId || ''} />
                  <Button
                    type="submit"
                    size="icon"
                    variant="ghost"
                    className="absolute top-1/2 right-1 -translate-y-1/2 h-8 w-8 text-[#a8a8a8] hover:text-white disabled:opacity-50"
                    disabled={isEditing || isBulkEditing || !chatPrompt.trim()}
                  >
                    {isEditing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        </aside>
      </div>

      {/* Footer */}
      <footer className="flex items-center justify-center h-10 text-xs text-[#9da5b4] px-3 shrink-0">
        Crafted by <span className="mx-1 font-semibold text-[#c5c5c5]">Web‑Impuls</span>
      </footer>

      {/* Modals for Add File/Folder */}
      <Dialog open={isAddFileOpen} onOpenChange={setIsAddFileOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New File</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="example.js"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            autoComplete="off"
          />
          <Button onClick={addFile}>Create</Button>
        </DialogContent>
      </Dialog>

      {/* Publish Modal */}
      <Dialog open={isPublishOpen} onOpenChange={setIsPublishOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Publish to cPanel</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {credsLoaded ? (
              (cpHost && cpUser && cpToken) ? (
                <div className="text-xs text-[#9da5b4] -mt-2">Using saved server settings</div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-3">
                    <label className="text-sm text-[#c5c5c5]">cPanel Host</label>
                    <Input placeholder="cpanel.example.com (or IP:2083)" value={cpHost} onChange={(e) => setCpHost(e.target.value)} autoComplete="off" />
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <label className="text-sm text-[#c5c5c5]">cPanel Username</label>
                    <Input placeholder="account username" value={cpUser} onChange={(e) => setCpUser(e.target.value)} autoComplete="off" />
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <label className="text-sm text-[#c5c5c5]">cPanel API Token</label>
                    <Input type="password" placeholder="paste API token" value={cpToken} onChange={(e) => setCpToken(e.target.value)} autoComplete="off" />
                  </div>
                </>
              )
            ) : (
              <div className="text-xs text-[#9da5b4] -mt-2">Loading saved settings…</div>
            )}

            <div className="grid grid-cols-1 gap-3">
              <label className="text-sm text-[#c5c5c5]">Domain</label>
              <Input
                placeholder="site.com or sub.site.com"
                value={targetDomain}
                onChange={(e) => {
                  const val = e.target.value.trim().replace(/^https?:\/\//,'').replace(/\/$/,'');
                  setTargetDomain(val);
                  if (val) setDocRoot(`/website/${val.replace(/^www\./,'')}`);
                }}
                autoComplete="off"
              />
              <p className="text-xs text-[#9da5b4]">You can supply either a root domain (mysite.com) or a subdomain (app.example.com). We will inject the proper parameters automatically.</p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <label className="text-sm text-[#c5c5c5]">Document Root</label>
              <Input
                placeholder="public_html/mysite"
                value={docRoot}
                onChange={(e) => setDocRoot(e.target.value)}
                autoComplete="off"
              />
              <p className="text-xs text-[#9da5b4]">Follow your structure, e.g. /website/domain. The folder is created automatically if needed.</p>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2">
              {/* Test connection form */}
              <form onSubmit={async (e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  await testConnFormAction(formData);
                }}
                className="flex items-center gap-2">
                <input type="hidden" name="host" value={cpHost} />
                <input type="hidden" name="user" value={cpUser} />
                <input type="hidden" name="token" value={cpToken} />
                <input type="hidden" name="domain" value={targetDomain} />
                <input type="hidden" name="docRoot" value={docRoot} />
                <Button type="submit" variant="outline" disabled={isTestingConn || !cpHost || !cpUser || !cpToken}>
                  {isTestingConn ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Test connection
                </Button>
              </form>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => setIsPublishOpen(false)}>Cancel</Button>
                <form onSubmit={(e) => { e.preventDefault(); void runPublish(); }}>
                  <Button type="submit" disabled={isPublishing}>
                    {isPublishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />} 
                    Publish
                  </Button>
                </form>
              </div>
            </div>

            {(isPublishing || publishLog.length > 0) && (
              <div className="mt-4 rounded-md border border-[#3a3d3e] bg-[#111213] p-3">
                <p className="text-xs mb-2 text-[#c5c5c5]">Progress</p>
                <div className="space-y-1.5">
                  {['Ensure domain', 'Upload ZIP', 'Extract archive', 'Cleanup'].map((label, i) => (
                    <div key={label} className="flex items-center gap-2 text-sm">
                      {isPublishing ? (
                        i === publishProgress ? <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" /> : i < publishProgress ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Circle className="h-3.5 w-3.5 text-[#666]" />
                      ) : (
                        i < publishProgress ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Circle className="h-3.5 w-3.5 text-[#666]" />
                      )}
                      <span className={i === publishProgress ? 'text-white' : 'text-[#bdbdbd]'}>{label}</span>
                    </div>
                  ))}
                </div>
                {publishLog.length > 0 && (
                  <div className="mt-3 rounded bg-[#1b1c1d] p-2 text-xs text-[#c5c5c5]">
                    {publishLog.map((l, idx) => (
                      <div key={idx}>• {l}</div>
                    ))}
                  </div>
                )}
                {publishedUrl && (
                  <div className="mt-3 text-xs">
                    <a href={publishedUrl} target="_blank" className="text-emerald-400 underline">Open {publishedUrl}</a>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Publish Settings Dialog */}
      <PublishSettingsDialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen} suggestDomain={suggestedDomain} suggestDocroot={suggestedDocroot} />

      {/* Revisions removed per request */}

      <Dialog open={isAddFolderOpen} onOpenChange={setIsAddFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Folder</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="newFolder"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            autoComplete="off"
          />
          <Button onClick={addFolder}>Create</Button>
        </DialogContent>
      </Dialog>

    </div>
  );
}
