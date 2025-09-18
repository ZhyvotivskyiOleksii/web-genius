"use client";

import React, { useActionState, useState, useEffect, useRef, useMemo, useCallback } from "react";
import { generateWebsiteAction } from "@/app/actions";
import { SiteGeneratorForm } from "@/components/site-generator-form";
import { SitePreview } from "@/components/site-preview";
import { FallingCodeBg } from "@/components/falling-code-bg";
import type { Site } from "@/lib/generation";
import Image from "next/image";
import { MODEL_NAME } from "@/ai/model";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getSupabase } from "@/lib/supabaseClient";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { Clock, LogOut, FolderKanban, ArrowUpRight, Loader2, ExternalLink, RefreshCw } from "lucide-react";
import Link from "next/link";

const initialState: {
  success: boolean;
  error: string | null;
  fieldErrors?: Record<string, string[]>;
  site: Site | null;
} = {
  success: false,
  error: null,
  site: null,
};

type ProjectRow = {
  id: string;
  name: string;
  slug: string;
  status?: string | null;
  updated_at: string;
  meta?: Record<string, any> | null;
};

const statusStyles = (status?: string | null) => {
  const token = (status || '').toLowerCase();
  switch (token) {
    case 'published':
    case 'live':
    case 'deployed':
      return {
        label: 'Published',
        badgeClass: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200',
      };
    case 'archived':
      return {
        label: 'Archived',
        badgeClass: 'border-amber-500/20 bg-amber-500/10 text-amber-200',
      };
    default:
      return {
        label: token ? token.charAt(0).toUpperCase() + token.slice(1) : 'Draft',
        badgeClass: 'border-white/10 bg-white/5 text-white/80',
      };
  }
};

const formatRelativeTime = (iso?: string | null) => {
  if (!iso) return 'Unknown update';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Unknown update';
  const diff = date.getTime() - Date.now();
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  const units: Array<{ unit: Intl.RelativeTimeFormatUnit; ms: number }> = [
    { unit: 'year', ms: 1000 * 60 * 60 * 24 * 365 },
    { unit: 'month', ms: 1000 * 60 * 60 * 24 * 30 },
    { unit: 'week', ms: 1000 * 60 * 60 * 24 * 7 },
    { unit: 'day', ms: 1000 * 60 * 60 * 24 },
    { unit: 'hour', ms: 1000 * 60 * 60 },
    { unit: 'minute', ms: 1000 * 60 },
    { unit: 'second', ms: 1000 },
  ];
  for (const { unit, ms } of units) {
    if (Math.abs(diff) >= ms || unit === 'second') {
      return formatter.format(Math.round(diff / ms), unit);
    }
  }
  return formatter.format(0, 'second');
};

const extractLiveUrl = (meta?: Record<string, any> | null) => {
  if (!meta) return null;
  const candidates = [meta.live_url, meta.publish_url, meta.production_url, meta.url];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }
  const domain = typeof meta.domain === 'string' ? meta.domain.trim() : '';
  if (domain && domain.includes('.')) {
    return domain.startsWith('http') ? domain : `https://${domain}`;
  }
  return null;
};

export default function Home() {
  const [state, formAction, isPending] = useActionState(
    generateWebsiteAction,
    initialState
  );
  const [showPreview, setShowPreview] = useState(false);
  const [pendingGeneration, setPendingGeneration] = useState(false);
  const modelName = MODEL_NAME.replace("googleai/", "");
  const [authOpen, setAuthOpen] = useState(false);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [projectsPopoverOpen, setProjectsPopoverOpen] = useState(false);
  const [highlightGenerator, setHighlightGenerator] = useState(false);
  const router = useRouter();

  const fetchProjects = useCallback(async () => {
    if (!userId) return [] as ProjectRow[];
    const sb = await getSupabase();
    if (!sb) throw new Error('Supabase client unavailable');
    const { data, error } = await sb
      .from('sites')
      .select('id,name,slug,status,updated_at,meta')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(20);
    if (error) throw error;
    return (data || []) as ProjectRow[];
  }, [userId]);

  useEffect(() => {
    let active = true;
    const fetchSession = async () => {
      try {
        const sb = await getSupabase();
        if (!sb) return;

        const { data: { session } } = await sb.auth.getSession();
        if (!active) return;

        setUserId(session?.user?.id ?? null);
        // Try session first, then fetch full user to read identities
        const profile1 = extractProfileFromUser(session?.user as any);
        if (profile1.avatar || profile1.name) {
          setUserAvatar(profile1.avatar ?? null);
          setDisplayName(profile1.name ?? null);
        }
        const { data: userResp } = await sb.auth.getUser();
        const profile2 = extractProfileFromUser(userResp.user as any);
        setUserAvatar(profile2.avatar ?? profile1.avatar ?? null);
        setDisplayName(profile2.name ?? profile1.name ?? null);

        const { data: { subscription } } = sb.auth.onAuthStateChange((_event, sess) => {
          setUserId(sess?.user?.id ?? null);
          const p = extractProfileFromUser(sess?.user as any);
          setUserAvatar(p.avatar ?? null);
          setDisplayName(p.name ?? null);
        });

        return () => {
          active = false;
          subscription?.unsubscribe();
        };
      } catch (error) {
        console.error("Error fetching auth session:", error);
      } finally {
        if (active) {
          setAuthLoading(false);
        }
      }
    };

    fetchSession();
  }, []);

  useEffect(() => {
    if (!highlightGenerator) return;
    const timer = window.setTimeout(() => setHighlightGenerator(false), 1600);
    return () => window.clearTimeout(timer);
  }, [highlightGenerator]);

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setProjects([]);
      setProjectsError(null);
      setProjectsLoading(false);
      setProjectsPopoverOpen(false);
      return;
    }
    setProjectsLoading(true);
    fetchProjects()
      .then((rows) => {
        if (!cancelled) {
          setProjects(rows);
          setProjectsError(null);
        }
      })
      .catch((e: any) => {
        if (!cancelled) {
          setProjects([]);
          setProjectsError(e?.message || 'Failed to load projects');
        }
      })
      .finally(() => {
        if (!cancelled) setProjectsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, fetchProjects]);

  const handleRefreshProjects = useCallback(() => {
    if (!userId) return;
    setProjectsLoading(true);
    fetchProjects()
      .then((rows) => {
        setProjects(rows);
        setProjectsError(null);
      })
      .catch((e: any) => {
        setProjects([]);
        setProjectsError(e?.message || 'Failed to load projects');
      })
      .finally(() => setProjectsLoading(false));
  }, [fetchProjects, userId]);

  const featuredProject = useMemo(() => (projects.length > 0 ? projects[0] : null), [projects]);
  const otherProjects = useMemo(() => (projects.length > 1 ? projects.slice(1, 6) : []), [projects]);
  const projectsEmpty = useMemo(() => !projectsLoading && projects.length === 0, [projectsLoading, projects]);
  const featuredLiveUrl = useMemo(() => extractLiveUrl(featuredProject?.meta), [featuredProject]);
  const featuredStatus = useMemo(() => statusStyles(featuredProject?.status), [featuredProject]);

  const generatorRef = useRef<HTMLDivElement | null>(null);

  const handleStartBuilding = useCallback(() => {
    setProjectsPopoverOpen(false);
    setHighlightGenerator(true);
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        generatorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const focusable = generatorRef.current?.querySelector('input, textarea');
        if (focusable instanceof HTMLElement) {
          focusable.focus({ preventScroll: true });
        }
      });
    }
  }, []);

  const redirectedRef = useRef(false);

  useEffect(() => {
    (async () => {
      if (!state.success || !state.site || redirectedRef.current) {
        if (!isPending && pendingGeneration && (!state.success || state.error)) {
          setPendingGeneration(false);
        }
        return;
      }
      // If user is signed in, persist and redirect to editor
      if (userId) {
        try {
          const sb = await getSupabase();
          if (!sb) { setShowPreview(true); return; }
          const slug = state.site.domain;
          const { data: found } = await sb
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
                name: slug,
                slug,
                types: state.site.types || [],
                meta: { domain: slug },
                total_input_tokens: state.site.usage?.inputTokens || 0,
                total_output_tokens: state.site.usage?.outputTokens || 0,
              })
              .select('id')
              .single();
            if (insErr) throw insErr;
            id = created?.id;
          }
          if (!id) { setShowPreview(true); return; }
          // Bulk upsert files
          const rows = Object.entries(state.site.files).map(([path, content]) => ({ site_id: id!, path, content: String(content || ''), updated_by: userId }));
          if (rows.length) await sb.from('site_files').upsert(rows, { onConflict: 'site_id,path' });
          redirectedRef.current = true;
          router.push(`/editor/${id}`);
          setPendingGeneration(false);
          return;
        } catch (e) {
          console.error('Post-generate persist failed:', e);
          // Fallback to inline preview
          setShowPreview(true);
          setPendingGeneration(false);
        }
      } else {
        // Not signed in: fallback to inline preview
        setShowPreview(true);
        setPendingGeneration(false);
      }
    })();
  }, [state, userId, router, isPending, pendingGeneration]);

  // Остаёмся на форме, пока сайт не готов — без промежуточного экрана
  const handleBackToGenerator = () => {
    setShowPreview(false);
    setPendingGeneration(false);
  };

  if (showPreview && state.site) {
    return <SitePreview site={state.site} onBack={handleBackToGenerator} />;
  }

  const handleSignOut = async () => {
    const sb = await getSupabase();
    await sb?.auth.signOut();
    // Перезагрузка не нужна, onAuthStateChange обновит состояние
  };

  const handleGoogleSignIn = async () => {
    const sb = await getSupabase();
    if (!sb) {
      alert('Add Supabase env to enable Google sign-in.');
      return;
    }
    await sb.auth.signInWithOAuth({
      provider: 'google', options: { redirectTo: window.location.href }
    });
  }

  const openProject = async (project?: ProjectRow | null) => {
    if (project?.id) {
      setProjectsPopoverOpen(false);
      router.push(`/editor/${project.id}`);
      return;
    }
    if (!userId) {
      setProjectsPopoverOpen(false);
      router.push('/sites');
      return;
    }
    try {
      const sb = await getSupabase();
      if (!sb) { router.push('/sites'); return; }
      const { data, error } = await sb
        .from('sites')
        .select('id')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      const last = data?.[0]?.id as string | undefined;
      setProjectsPopoverOpen(false);
      if (last) router.push(`/editor/${last}`);
      else router.push('/sites');
    } catch {
      setProjectsPopoverOpen(false);
      router.push('/sites');
    }
  };

  return (
    <main className="relative z-0 flex min-h-screen w-full flex-col items-center justify-center p-4 sm:p-8 bg-transparent">
      <div className="absolute inset-0 z-[-2]">
        <FallingCodeBg />
      </div>
      <div className="absolute inset-y-0 right-0 w-1/2 z-[-1] pointer-events-none">
        <Image
          src="/img/log-ket.png"
          alt="Kette background"
          fill
          style={{ objectFit: 'contain', objectPosition: 'bottom' }}
          className="opacity-20"
        />
      </div>
      {/* Top bar with container and side paddings */}
      <div className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-end gap-2">
        {userId ? (
          <Popover open={projectsPopoverOpen} onOpenChange={setProjectsPopoverOpen}>
            <PopoverTrigger asChild>
              <button
                className="group flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white/90 shadow-[0_10px_30px_rgba(10,10,25,0.2)] backdrop-blur transition-all hover:border-white/30 hover:bg-white/10"
                title="Open your projects"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white/80 transition group-hover:bg-white/20 group-hover:text-white">
                  <FolderKanban className="h-3.5 w-3.5" />
                </span>
                <span>My Projects</span>
                <ArrowUpRight className="h-4 w-4 text-white/60 transition group-hover:text-white" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" sideOffset={14} className="w-[380px] p-0 border border-white/10 bg-[#080a12]/95 text-white shadow-[0_24px_60px_rgba(5,10,30,0.55)] backdrop-blur-xl">
              <div className="relative overflow-hidden">
                <div className="pointer-events-none absolute inset-0 opacity-80">
                  <div className="absolute -top-20 right-0 h-56 w-56 rounded-full bg-primary/30 blur-3xl" />
                  <div className="absolute bottom-[-140px] left-[-60px] h-72 w-72 rounded-full bg-[#6a5cff]/20 blur-3xl" />
                </div>
                <div className="relative space-y-5 p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/90">
                      <FolderKanban className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-[0.35em] text-white/50">Project Hub</p>
                      <h3 className="text-base font-semibold text-white">Continue where you left off</h3>
                    </div>
                  </div>

                  {projectsLoading ? (
                    <div className="space-y-3">
                      {[0, 1].map((key) => (
                        <div key={key} className="animate-pulse rounded-2xl border border-white/5 bg-white/10 p-4">
                          <div className="mb-2 h-3 w-2/3 rounded bg-white/10" />
                          <div className="mb-1 h-2.5 w-1/2 rounded bg-white/10" />
                          <div className="h-2.5 w-1/3 rounded bg-white/5" />
                        </div>
                      ))}
                    </div>
                  ) : projectsError ? (
                    <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-100">
                      <p className="font-semibold">Couldn&apos;t load your projects</p>
                      <p className="mt-1 text-xs text-rose-100/80">{projectsError}</p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-3 border-rose-400/40 bg-transparent text-rose-50 hover:bg-rose-500/15"
                        onClick={handleRefreshProjects}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" /> Try again
                      </Button>
                    </div>
                  ) : projectsEmpty ? (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 text-sm text-white/70">
                      <p className="font-medium text-white">No projects yet</p>
                      <p className="mt-1 text-xs text-white/60">Generate your first website to see it here.</p>
                      <Button
                        size="sm"
                        className="mt-4 bg-gradient-to-r from-[#7f5af0] via-[#9b6dff] to-[#5ad1ff] text-white shadow-[0_12px_28px_rgba(120,90,255,0.35)] transition hover:shadow-[0_18px_38px_rgba(120,90,255,0.5)]"
                        onClick={handleStartBuilding}
                      >
                        Start building
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {featuredProject ? (
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_15px_40px_rgba(10,15,35,0.35)]">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 space-y-1">
                              <p className="text-[10px] uppercase tracking-[0.28em] text-white/45">Latest project</p>
                              <h4 className="truncate text-lg font-semibold text-white">{featuredProject.name || 'Untitled project'}</h4>
                              <p className="flex items-center gap-1 text-xs text-white/60">
                                <Clock className="h-3.5 w-3.5" />
                                {formatRelativeTime(featuredProject.updated_at)}
                              </p>
                              <p className="truncate text-xs text-white/45">{featuredProject.meta?.domain || featuredProject.slug}</p>
                            </div>
                            <Badge className={`whitespace-nowrap border ${featuredStatus.badgeClass}`}>
                              {featuredStatus.label}
                            </Badge>
                          </div>
                          <div className="mt-4 flex flex-wrap items-center gap-2">
                            <Button
                              size="sm"
                              className="bg-gradient-to-r from-[#7f5af0] via-[#9b6dff] to-[#5a8bff] text-white hover:opacity-90"
                              onClick={() => openProject(featuredProject)}
                            >
                              Resume in editor
                            </Button>
                            {featuredLiveUrl ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-white/20 bg-transparent text-white/80 hover:bg-white/10"
                                asChild
                              >
                                <Link href={featuredLiveUrl} target="_blank" rel="noopener noreferrer">
                                  Live site <ExternalLink className="ml-2 h-3.5 w-3.5" />
                                </Link>
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      ) : null}

                      {otherProjects.length ? (
                        <div className="rounded-2xl border border-white/5 bg-white/[0.01]">
                          <div className="flex items-center justify-between px-4 pt-4 pb-2 text-[11px] uppercase tracking-[0.3em] text-white/50">
                            <span>Recent work</span>
                            <span>Open</span>
                          </div>
                          <div className="divide-y divide-white/5">
                            {otherProjects.map((project) => {
                              const info = statusStyles(project.status);
                              return (
                                <button
                                  key={project.id}
                                  onClick={() => openProject(project)}
                                  className="group flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/5"
                                >
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-white">{project.name || 'Untitled project'}</p>
                                    <div className="mt-0.5 flex flex-col gap-1 text-xs text-white/55 sm:flex-row sm:items-center sm:gap-2">
                                      <span className="truncate">{project.meta?.domain || project.slug}</span>
                                      <span className="inline-flex items-center gap-1 text-white/40">
                                        <Clock className="h-3 w-3" />
                                        {formatRelativeTime(project.updated_at)}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex shrink-0 items-center gap-2">
                                    <Badge className={`border ${info.badgeClass}`}>{info.label}</Badge>
                                    <ArrowUpRight className="h-4 w-4 text-white/50 transition group-hover:text-white" />
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}

                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button
                          className="flex-1 border border-white/10 bg-white/10 text-white hover:bg-white/20"
                          variant="ghost"
                          asChild
                        >
                          <Link href="/sites">Open project dashboard</Link>
                        </Button>
                        <Button
                          variant="outline"
                          className="border-white/15 text-white/80 hover:bg-white/10"
                          size="sm"
                          onClick={handleRefreshProjects}
                          disabled={projectsLoading}
                        >
                          {projectsLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          Refresh
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        ) : null}
        {authLoading ? (
          <div className="h-8 w-8 rounded-full bg-white/10 animate-pulse" />
        ) : userId ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="rounded-full border border-white/10 overflow-hidden">
                <Avatar className="h-8 w-8">
                  {userAvatar ? (
                    <AvatarImage src={userAvatar} alt="User avatar" referrerPolicy="no-referrer" onError={() => setUserAvatar(null)} />
                  ) : null}
                  <AvatarFallback className="text-xs font-medium">
                    {getInitials(displayName)}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-72">
              <div className="px-4 pt-4 pb-2 flex flex-col items-center gap-2 text-center">
                <Avatar className="h-12 w-12">
                  {userAvatar ? (
                    <AvatarImage src={userAvatar} alt="User avatar" referrerPolicy="no-referrer" />
                  ) : null}
                  <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="font-semibold truncate">{displayName || 'User'}</div>
                  <div className="text-xs text-white/60 truncate">ID: {userId}</div>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="justify-center text-rose-400 hover:text-rose-300">
                <LogOut className="h-4 w-4" /> Sign out
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <div className="px-3 py-2 text-[11px] text-white/50 text-center">WebGenius Beta 2.0</div>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button variant="ghost" onClick={() => setAuthOpen(true)} className="rounded-xl bg-[#2f3136] text-white/90 hover:bg-[#3b3d42]">Sign in</Button>
        )}
        </div>
      </div>
      <div
        ref={generatorRef}
        className={`relative z-10 w-full flex items-center justify-center transition-all duration-500 ${highlightGenerator ? 'scale-[1.01] drop-shadow-[0_35px_65px_rgba(112,83,255,0.45)]' : ''}`}
      >
        <div
          className={`pointer-events-none absolute -inset-6 sm:-inset-8 -z-10 rounded-[40px] bg-gradient-to-r from-[#7f5af0]/35 via-[#9b6dff]/20 to-[#5ad1ff]/25 blur-3xl transition-all duration-500 transform ${highlightGenerator ? 'opacity-80 scale-100' : 'opacity-0 scale-95'}`}
        />
        <SiteGeneratorForm
          formAction={formAction}
          isPending={isPending || pendingGeneration}
          state={state}
          modelName={modelName}
          isAuthed={!!userId}
          onRequireAuth={() => setAuthOpen(true)}
          onStartGenerating={() => setPendingGeneration(true)}
        />
      </div>
      {/* Placeholder auth modal (Supabase Google to be wired) */}
      <Dialog open={authOpen} onOpenChange={setAuthOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sign in</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Button
              className="w-full justify-center gap-2 rounded-xl bg-white text-black hover:bg-white/90 border border-[#e5e5e5]"
              onClick={handleGoogleSignIn}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="h-5 w-5">
                <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.731 31.91 29.221 35 24 35c-7.18 0-13-5.82-13-13s5.82-13 13-13c3.314 0 6.314 1.251 8.594 3.306l5.657-5.657C34.943 3.053 29.735 1 24 1 11.85 1 2 10.85 2 23s9.85 22 22 22 22-9.85 22-22c0-1.497-.155-2.957-.389-4.417z"/>
                <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.4 16.224 18.824 13 24 13c3.314 0 6.314 1.251 8.594 3.306l5.657-5.657C34.943 3.053 29.735 1 24 1 15.317 1 7.992 5.781 4.065 12.691z"/>
                <path fill="#4CAF50" d="M24 45c5.166 0 9.8-1.977 13.294-5.206l-6.146-5.203C29.021 36.472 26.62 37 24 37c-5.192 0-9.684-3.088-11.57-7.505l-6.51 5.016C9.79 40.632 16.454 45 24 45z"/>
                <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-1.13 3.01-3.323 5.386-6.008 6.791.003-.002 6.146 5.203 6.146 5.203C37.709 37.627 42 31.5 42 23c0-1.497-.155-2.957-.389-4.417z"/>
              </svg>
              Continue with Google
            </Button>
            <p className="text-sm text-muted-foreground">После входа покажем аватар и дадим доступ к настройкам публикации.</p>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function getInitials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  const initials = `${first}${last}`.toUpperCase();
  return initials || name.slice(0, 2).toUpperCase();
}

function extractProfileFromUser(user: any): { avatar?: string; name?: string } {
  if (!user) return {};
  const meta: any = user.user_metadata ?? {};
  const identities: any[] = user.identities ?? [];
  const fromIdent = identities.reduce<{ avatar?: string; name?: string }>((acc, ident) => {
    const d = ident?.identity_data || {};
    return {
      avatar: acc.avatar || d.avatar_url || d.picture || d.photoURL || d.profile_image_url,
      name: acc.name || d.full_name || d.name || [d.given_name, d.family_name].filter(Boolean).join(" ") || d.nickname,
    };
  }, {});
  const email = user.email ?? undefined;
  return {
    avatar: meta.avatar_url || meta.picture || meta.profile_image_url || fromIdent.avatar,
    name: meta.full_name || meta.name || [meta.given_name, meta.family_name].filter(Boolean).join(" ") || fromIdent.name || email,
  };
}
