"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getSupabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Archive,
  ChevronLeft,
  ChevronRight,
  EyeOff,
  Loader2,
  Rocket,
  Search,
  Wrench,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { loadDeployedSitesAction } from "@/app/actions";

const pageSize = 10;

type Row = {
  id: string;
  name: string;
  slug: string;
  updated_at: string;
  status?: string | null;
  meta?: Record<string, any> | null;
};

type DeploymentRecord = {
  id: string;
  domain: string | null;
  url?: string | null;
  status?: string | null;
  created_at: string;
};

const normalizeDomainInput = (value?: string | null): string => {
  if (!value) return '';
  let cleaned = value.trim();
  cleaned = cleaned.replace(/^https?:\/\//i, '').replace(/\/$/, '');
  return cleaned.toLowerCase();
};

const extractTypes = (meta?: Record<string, any> | null): string[] => {
  if (!meta) return [];
  const raw = meta.types ?? meta.siteTypes ?? meta.site_types;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') return raw.split(/[,;]+/).map((t: string) => t.trim()).filter(Boolean);
  return [];
};

const inferTld = (types: string[]): string => {
  const joined = types.join(' ').toLowerCase();
  if (joined.includes('sport') && joined.includes('poland')) return '.pl';
  return '.com';
};

const slugifyBase = (value?: string): string => {
  if (!value) return '';
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const deriveDomain = (meta: Record<string, any> | null | undefined, fallbackSlug?: string, fallbackName?: string): string => {
  const candidate = normalizeDomainInput(
    typeof meta?.domain === 'string'
      ? meta.domain
      : typeof meta?.customDomain === 'string'
      ? meta.customDomain
      : undefined
  );
  const types = extractTypes(meta);
  const candidateTld = (() => {
    if (!candidate) return undefined;
    const match = candidate.match(/\.([a-z]{2,})$/i);
    return match ? `.${match[1].toLowerCase()}` : undefined;
  })();
  const ensureTld = (base: string, preferredTld?: string): string => {
    if (!base) return '';
    let next = base.trim().toLowerCase();
    next = next.replace(/^https?:\/\//, '').replace(/\/.*/, '');
    next = next.replace(/^www\./, '');
    next = next.replace(/[^a-z0-9.-]/g, '-');
    next = next.replace(/-{2,}/g, '-');
    next = next.replace(/^-+|-+$/g, '');
    next = next.replace(/\.\.+/g, '.').replace(/\.$/, '');
    const normalizedPreferred = preferredTld
      ? (preferredTld.startsWith('.') ? preferredTld : `.${preferredTld}`)
      : '';
    const fallbackSuffix = normalizedPreferred || inferTld(types);
    if (!next.includes('.')) {
      if (next.endsWith('com') && next.length > 3) {
        const prefix = next.slice(0, -3);
        if (prefix.includes('-')) {
          const trimmed = prefix.replace(/[-_.]+$/g, '');
          next = trimmed ? `${trimmed}.com` : `site${fallbackSuffix}`;
        } else {
          next = `${next}.com`;
        }
      } else if (next.endsWith('pl') && next.length > 2) {
        const prefix = next.slice(0, -2);
        if (prefix.includes('-')) {
          const trimmed = prefix.replace(/[-_.]+$/g, '');
          next = trimmed ? `${trimmed}.pl` : `site${fallbackSuffix}`;
        } else {
          next = `${next}.pl`;
        }
      } else {
        next = `${next}${fallbackSuffix}`;
      }
    }
    if (!next.includes('.')) {
      next = `${next}${fallbackSuffix}`;
    }
    next = next.replace(/\.\.+/g, '.').replace(/\.$/, '');
    if (normalizedPreferred && !next.endsWith(normalizedPreferred)) {
      const withoutSuffix = next.replace(/\.[^.]+$/, '');
      next = `${withoutSuffix}${normalizedPreferred}`;
    }
    return next;
  };
  const hasDuplicateSuffix = (value: string): boolean => {
    const match = value.match(/^(.+)\.(com|pl)$/i);
    if (!match) return false;
    const [, before, tld] = match;
    return before.endsWith(tld);
  };
  const fallbackBase = slugifyBase(fallbackSlug) || slugifyBase(fallbackName);
  const fallbackDomain = fallbackBase ? ensureTld(fallbackBase, candidateTld) : '';
  if (candidate) {
    const candidateDomain = ensureTld(candidate, candidateTld);
    if (hasDuplicateSuffix(candidateDomain) && fallbackDomain && fallbackDomain !== candidateDomain) {
      return fallbackDomain;
    }
    return candidateDomain;
  }
  if (fallbackDomain) {
    return fallbackDomain;
  }
  return ensureTld('demo-site', candidateTld);
};

const toExternalUrl = (domain: string): string => {
  if (!domain) return '#';
  return /^https?:\/\//i.test(domain) ? domain : `https://${domain}`;
};

type StatusPresetKey = "all" | "work" | "deploy" | "cloaking" | "archived";

const statusPresets: { key: StatusPresetKey; label: string; matches: string[] | null }[] = [
  { key: "all", label: "All", matches: null },
  { key: "work", label: "In Progress", matches: ["draft", "work", "in_progress", "pending", "edit"] },
  { key: "deploy", label: "Deploy", matches: ["deploy", "published", "live", "production"] },
  { key: "cloaking", label: "Cloaking", matches: ["cloak", "cloaking", "stealth"] },
  { key: "archived", label: "Archived", matches: ["archive", "archived"] },
];

const statusStyles: Record<StatusPresetKey, { label: string; badgeClass: string; icon: JSX.Element }> = {
  all: {
    label: "All",
    badgeClass: "border-white/10 bg-white/5 text-slate-100",
    icon: <Rocket className="h-3.5 w-3.5" />,
  },
  work: {
    label: "In Progress",
    badgeClass: "border-sky-500/30 bg-sky-500/15 text-sky-200",
    icon: <Wrench className="h-3.5 w-3.5" />,
  },
  deploy: {
    label: "Deploy",
    badgeClass: "border-emerald-500/30 bg-emerald-500/15 text-emerald-200",
    icon: <Rocket className="h-3.5 w-3.5" />,
  },
  cloaking: {
    label: "Cloaking",
    badgeClass: "border-purple-500/30 bg-purple-500/15 text-purple-200",
    icon: <EyeOff className="h-3.5 w-3.5" />,
  },
  archived: {
    label: "Archived",
    badgeClass: "border-rose-500/30 bg-rose-500/15 text-rose-200",
    icon: <Archive className="h-3.5 w-3.5" />,
  },
};

function resolvePreset(row: Row): StatusPresetKey {
  const status = (row.status || "").toLowerCase();
  const metaMode = typeof row.meta?.mode === "string" ? row.meta.mode.toLowerCase() : "";
  if ([status, metaMode].some((value) => value.includes("cloak"))) return "cloaking";
  if ([status, metaMode].some((value) => value.includes("deploy") || value.includes("publish") || value.includes("live"))) return "deploy";
  if ([status, metaMode].some((value) => value.includes("archive"))) return "archived";
  if ([status, metaMode].some((value) => value.includes("draft") || value.includes("work") || value.includes("pending"))) return "work";
  return "work";
}

export default function MySitesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [activePreset, setActivePreset] = useState<StatusPresetKey>("all");
  const [sort, setSort] = useState<"recent" | "name" | "status">("recent");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deployments, setDeployments] = useState<DeploymentRecord[]>([]);
  const [deployError, setDeployError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      try {
        const sb = await getSupabase();
        if (!sb) throw new Error("Supabase not configured");
        const { data: auth } = await sb.auth.getUser();
        if (!auth.user?.id) {
          setError("Sign in to access your projects.");
          setLoading(false);
          return;
        }
        const { data, error } = await sb
          .from("sites")
          .select("id,name,slug,updated_at,status,meta")
          .eq("user_id", auth.user.id)
          .order("updated_at", { ascending: false });
        if (error) throw error;
        setRows(((data || []) as Row[]).map((row) => ({ ...row, meta: row.meta || null })));

        const deployRes = await loadDeployedSitesAction(auth.user.id);
        if (deployRes.success && Array.isArray(deployRes.sites)) {
          setDeployments(deployRes.sites as DeploymentRecord[]);
          setDeployError(null);
        } else {
          setDeployments([]);
          setDeployError(deployRes.error || null);
        }
      } catch (e: any) {
        setError(e?.message || "Failed to load projects.");
        setDeployments([]);
        setDeployError(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, activePreset]);

  const sortedRows = useMemo(() => {
    if (!rows.length) return [];
    const clone = [...rows];
    switch (sort) {
      case "name":
        return clone.sort((a, b) => a.name.localeCompare(b.name, "ru"));
      case "status":
        return clone.sort((a, b) => resolvePreset(a).localeCompare(resolvePreset(b)));
      case "recent":
      default:
        return clone.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    }
  }, [rows, sort]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return sortedRows.filter((row) => {
      const presetMeta = statusPresets.find((item) => item.key === activePreset);
      const matchesPreset = !presetMeta || !presetMeta.matches
        ? true
        : presetMeta.matches.some((value) => {
            const status = (row.status || "").toLowerCase();
            const metaMode = typeof row.meta?.mode === "string" ? row.meta.mode.toLowerCase() : "";
            const resolved = resolvePreset(row);
            return status.includes(value) || metaMode.includes(value) || resolved === presetMeta.key;
          });
      if (!matchesPreset) return false;
      if (!query) return true;
      return (
        row.name.toLowerCase().includes(query) ||
        row.slug.toLowerCase().includes(query) ||
        (row.meta?.domain ? String(row.meta.domain).toLowerCase().includes(query) : false)
      );
    });
  }, [sortedRows, activePreset, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    if (page !== currentPage) setPage(currentPage);
  }, [currentPage, page]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeletePending(true);
      const sb = await getSupabase();
      if (!sb) throw new Error("Supabase not configured");
      const { data: auth } = await sb.auth.getUser();
      if (!auth.user?.id) throw new Error("Session expired");
      const siteId = deleteTarget.id;
      await sb.from("site_files").delete().eq("site_id", siteId);
      const { error } = await sb.from("sites").delete().eq("id", siteId).eq("user_id", auth.user.id);
      if (error) throw error;
      setRows((prev) => prev.filter((row) => row.id !== siteId));
      toast({ title: "Project removed", description: `“${deleteTarget.name}” was moved to the archive.` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed", description: e?.message || "Could not delete project." });
    } finally {
      setDeletePending(false);
      setDeleteTarget(null);
    }
  };

  const renderStatus = (row: Row) => {
    const preset = resolvePreset(row);
    const descriptor = statusStyles[preset];
    return (
      <Badge className={cn("flex items-center gap-1.5 px-3 py-1 text-xs font-medium", descriptor.badgeClass)}>
        {descriptor.icon}
        <span>{descriptor.label}</span>
      </Badge>
    );
  };

  return (
    <main className="min-h-screen bg-[#06070c] text-slate-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-16 pt-12">
        <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-[#111827] via-[#0b1120] to-[#05060b] p-8 shadow-xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),_transparent_55%)]" />
          <div className="relative flex flex-col gap-8">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div className="space-y-1">
                <p className="text-sm uppercase tracking-[0.35em] text-sky-400/70">My Projects</p>
                <h1 className="text-3xl font-semibold text-white sm:text-4xl">Site Operations Control</h1>
                <p className="text-sm text-slate-400">Filter, deploy, and manage cloaked versions from one place.</p>
              </div>
              <Link href="/">
                <Button variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10" size="sm">
                  Back to Generator
                </Button>
              </Link>
            </div>

            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input
                  placeholder="Search by name, domain, or slug"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="h-12 rounded-2xl border-white/10 bg-white/[0.03] pl-11 text-base text-white placeholder:text-slate-500 focus-visible:border-sky-500/60 focus-visible:ring-sky-500/40"
                />
              </div>
              <div className="flex w-full gap-3 sm:w-auto">
                <Select value={sort} onValueChange={(value) => setSort(value as typeof sort)}>
                  <SelectTrigger className="h-12 w-full rounded-2xl border-white/10 bg-white/[0.03] text-white sm:w-48">
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

            <Tabs value={activePreset} onValueChange={(value) => setActivePreset(value as StatusPresetKey)}>
              <TabsList className="flex flex-wrap gap-2 rounded-full bg-transparent p-1 border border-transparent">
                {statusPresets.map((preset) => (
                  <TabsTrigger
                    key={preset.key}
                    value={preset.key}
                    className="group relative flex flex-1 items-center justify-center gap-2 rounded-full border border-transparent px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08] data-[state=active]:border-sky-400/70 data-[state=active]:bg-sky-400/15 data-[state=active]:text-white sm:flex-none"
                  >
                    {statusStyles[preset.key].icon}
                    <span>{statusStyles[preset.key].label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </div>

        <div className="space-y-6">
          {loading ? (
            <div className="flex justify-center py-16 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-200">{error}</div>
          ) : paginatedRows.length === 0 ? (
            <Card className="mx-auto flex max-w-3xl flex-col items-center justify-center gap-3 rounded-3xl border border-white/5 bg-white/[0.02] px-10 py-12 text-center text-slate-300 shadow-[0_25px_55px_rgba(4,12,29,0.35)]">
              <Rocket className="h-8 w-8 text-sky-400" />
              <p className="text-lg font-medium text-white">No projects found</p>
              <p className="max-w-md text-sm text-slate-400">Adjust the filters or start a new project to bring this feed to life.</p>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {paginatedRows.map((row) => {
                const domain = deriveDomain(row.meta ?? null, row.slug, row.name);
                const liveUrl = domain ? toExternalUrl(domain) : null;
                return (
                  <div
                    key={row.id}
                    className="group relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-[#111827] via-[#0b1120] to-[#05060b] p-6 shadow-lg transition-transform duration-200 hover:-translate-y-1 hover:border-sky-400/50 hover:shadow-2xl"
                  >
                    <div className="absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-hover:[background:radial-gradient(circle_at_top,_rgba(56,189,248,0.12),_transparent_55%)]" />
                    <div className="relative flex flex-col gap-6">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-2">
                          <h2 className="text-xl font-semibold text-white line-clamp-1">{row.name}</h2>
                          <p className="text-xs uppercase tracking-[0.25em] text-slate-500">{row.slug}</p>
                        </div>
                        {renderStatus(row)}
                      </div>

                      <div className="space-y-2 text-sm text-slate-300">
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span>Updated</span>
                          <span>{new Date(row.updated_at).toLocaleString()}</span>
                        </div>
                        {domain ? (
                          <div className="flex items-center justify-between text-xs text-slate-400">
                            <span>Domain</span>
                            <span className="truncate text-slate-200">{domain}</span>
                          </div>
                        ) : null}
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <div className="flex gap-2">
                          <Link href={`/editor/${row.id}`}>
                            <Button className="rounded-xl bg-sky-500/90 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-sky-400" size="sm">
                              Open
                            </Button>
                          </Link>
                          {liveUrl ? (
                            <Link href={liveUrl} target="_blank">
                              <Button variant="ghost" className="rounded-xl border border-white/10 bg-white/5 px-3 text-xs text-slate-200 hover:border-sky-400/50 hover:text-white" size="sm">
                                <ExternalLink className="mr-1 h-4 w-4" />
                                View live
                              </Button>
                            </Link>
                          ) : null}
                        </div>
                        <Button
                          variant="ghost"
                          className="rounded-xl border border-white/10 bg-white/5 px-3 text-xs text-rose-200 hover:border-rose-400/50 hover:bg-rose-500/20 hover:text-white"
                          size="sm"
                          onClick={() => setDeleteTarget(row)}
                        >
                          <Trash2 className="mr-1 h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {!loading && activePreset === "deploy" ? (
            <div className="panel-glow mx-auto max-w-5xl p-6 sm:p-7">
              <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-white">Deployed sites</h3>
                  <p className="text-xs text-slate-400">Active deployments, domains, and connection history.</p>
                </div>
                  <div className="text-xs text-slate-500">{deployments.filter(d => d.status === 'succeeded').length} successful</div>
              </div>
              {deployError ? (
                <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{deployError}</div>
              ) : deployments.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">No deployment records yet.</div>
              ) : (
                <div className="space-y-3 text-sm text-slate-200">
                  {deployments.map((deploy) => {
                    const deployStatus = (deploy.status || "pending").toLowerCase();
                    const pillClass = deployStatus === "succeeded" ? "status-pill status-pill-success" : "status-pill status-pill-neutral";
                    return (
                      <div key={deploy.id} className="card-veil flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                          <a
                            href={deploy.url || `https://${deploy.domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-base font-semibold text-white hover:text-sky-300"
                          >
                            {deploy.domain}
                          </a>
                          <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">
                            {new Date(deploy.created_at).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={pillClass}>{deployStatus}</span>
                          <Button asChild variant="ghost" className="rounded-full border border-white/10 bg-white/5 px-4 text-xs text-slate-200 hover:border-sky-400/50 hover:text-white" size="sm">
                            <a href={deploy.url || `https://${deploy.domain}`} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="mr-1 h-4 w-4" /> View site
                            </a>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}
          {!loading && !error && filteredRows.length > 0 ? (
            <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3 text-xs text-slate-400 sm:flex-row">
              <div>
                Page {currentPage} of {totalPages} • {filteredRows.length} projects
              </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-xl border border-white/10 bg-transparent px-3 text-xs hover:border-sky-400/50 hover:text-white"
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                  <ChevronLeft className="mr-1 h-4 w-4" />Prev
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-xl border border-white/10 bg-transparent px-3 text-xs hover:border-sky-400/50 hover:text-white"
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                  Next<ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeletePending(false);
          }
        }}
      >
        <AlertDialogContent className="border-white/10 bg-[#0b1120] text-slate-100">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              This action permanently removes “{deleteTarget?.name}” and its files. It cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deletePending}
              className="bg-rose-500 text-white hover:bg-rose-600"
            >
              {deletePending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
