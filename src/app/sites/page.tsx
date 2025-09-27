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
import { loadDeployedSitesAction } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { deriveDomainName, extractTypes, toExternalUrl } from "@/lib/domain";
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

const pageSize = 10;

type Row = {
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

type StatusPresetKey = "all" | "work" | "deploy" | "cloaking" | "archived";

const statusPresets: { key: StatusPresetKey; label: string; matches: string[] | null }[] = [
  { key: "all", label: "All", matches: null },
  { key: "work", label: "In Progress", matches: ["draft", "work", "in_progress", "pending", "edit"] },
  { key: "deploy", label: "Deployed", matches: ["deploy", "published", "live", "production"] },
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
    label: "Deployed",
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

const getProjectDomain = (row: Row): string => {
  const meta = row.meta || null;
  return deriveDomainName(
    {
      domain: typeof meta?.domain === "string" ? meta.domain : undefined,
      customDomain: typeof meta?.customDomain === "string" ? meta.customDomain : undefined,
      types: extractTypes(meta),
    },
    row.slug,
    row.name,
  );
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
  const [deployments, setDeployments] = useState<DeployedRecord[]>([]);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sb = await getSupabase();
      if (!sb) {
        setUserId(null);
        setLoading(false);
        return;
      }
      const { data: auth } = await sb.auth.getUser();
      const uid = auth.user?.id || null;
      setUserId(uid);
      if (!uid) {
        setRows([]);
        setDeployments([]);
        setDeployError(null);
        setError(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const { data, error } = await sb
          .from("sites")
          .select("id,name,slug,updated_at,status,meta")
          .eq("user_id", uid)
          .order("updated_at", { ascending: false });
        if (error) throw error;
        if (!cancelled) {
          setRows(((data || []) as Row[]).map((row) => ({ ...row, meta: row.meta || null })));
        }

        const deployed = await loadDeployedSitesAction(uid);
        if (!cancelled) {
          if (deployed.success && Array.isArray(deployed.sites)) {
            setDeployments(deployed.sites as DeployedRecord[]);
            setDeployError(null);
          } else if (deployed.error) {
            setDeployments([]);
            setDeployError(deployed.error);
          }
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "Failed to load projects.");
          setDeployError((prev) => prev ?? (e?.message || null));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    setPage(1);
  }, [search, activePreset]);

  const sortedRows = useMemo(() => {
    if (!rows.length) return [];
    const clone = [...rows];
    switch (sort) {
      case "name":
        return clone.sort((a, b) => a.name.localeCompare(b.name, "en"));
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
        getProjectDomain(row).toLowerCase().includes(query)
      );
    });
  }, [sortedRows, activePreset, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    if (page !== currentPage) setPage(currentPage);
  }, [currentPage, page]);

  const {
    totalProjects,
    inProgressCount,
    deployedProjectsCount,
    cloakingCount,
    archivedCount,
  } = useMemo(() => {
    const inProgress = rows.filter((row) => resolvePreset(row) === "work").length;
    const deployed = rows.filter((row) => resolvePreset(row) === "deploy").length;
    const cloaking = rows.filter((row) => resolvePreset(row) === "cloaking").length;
    const archived = rows.filter((row) => resolvePreset(row) === "archived").length;
    return { totalProjects: rows.length, inProgressCount: inProgress, deployedProjectsCount: deployed, cloakingCount: cloaking, archivedCount: archived };
  }, [rows]);


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
      toast({ title: "Project removed", description: `“${deleteTarget.name}” has been moved to the archive.` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Could not delete", description: e?.message || "Deletion failed." });
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
        <div className="panel-glow p-8 sm:p-10">
          <div className="relative flex flex-col gap-8">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div className="space-y-1">
                <p className="text-sm uppercase tracking-[0.35em] text-sky-400/70">My Projects</p>
                <h1 className="text-3xl font-semibold text-white sm:text-4xl">Website Control Center</h1>
                <p className="text-sm text-slate-400">Filter, manage deployments, and monitor hidden versions from one place.</p>
              </div>
              <Link href="/">
                <Button variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10" size="sm">
                  Back to Home
                </Button>
              </Link>
            </div>

            <div className="control-surface flex flex-col gap-4 border border-white/10 bg-white/[0.02] p-4 md:flex-row md:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input
                  placeholder="Search by name, domain, or slug"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="h-12 rounded-2xl border-white/10 bg-transparent pl-11 text-base text-white placeholder:text-slate-500 focus-visible:border-sky-500/60 focus-visible:ring-sky-500/40"
                />
              </div>
              <div className="flex w-full gap-3 sm:w-auto">
                <Select value={sort} onValueChange={(value) => setSort(value as typeof sort)}>
                  <SelectTrigger className="h-12 w-full rounded-2xl border-white/10 bg-transparent text-white sm:w-48">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-[#0f172a] text-slate-100">
                    <SelectItem value="recent">Recently updated</SelectItem>
                    <SelectItem value="name">Alphabetical</SelectItem>
                    <SelectItem value="status">By status</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Tabs value={activePreset} onValueChange={(value) => setActivePreset(value as StatusPresetKey)}>
              <TabsList className="control-surface grid grid-cols-2 gap-2 border border-white/10 bg-white/[0.02] p-2 sm:flex sm:flex-wrap">
                {statusPresets.map((preset) => (
                  <TabsTrigger
                    key={preset.key}
                    value={preset.key}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-transparent px-4 py-2 text-sm font-medium text-slate-200 transition data-[state=active]:border-sky-400/60 data-[state=active]:bg-sky-400/15 data-[state=active]:text-white"
                  >
                    {statusStyles[preset.key].icon}
                    <span>{statusStyles[preset.key].label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {loading ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="stat-chip h-[88px] animate-pulse bg-white/5" />
                ))}
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="stat-chip">
                  <span className="text-[0.65rem] uppercase tracking-[0.35em] text-slate-500">Total projects</span>
                  <strong className="text-white">{totalProjects}</strong>
                  <p className="text-xs text-slate-400">{inProgressCount} in progress • {deployedProjectsCount} deployed</p>
                </div>
                <div className="stat-chip">
                  <span className="text-[0.65rem] uppercase tracking-[0.35em] text-slate-500">Deployments</span>
                  <strong className="text-white">{deployments.filter(d => d.status === 'succeeded').length}</strong>
                  <p className="text-xs text-slate-400">{deployments.length > 0 ? `Last: ${new Date(deployments[0].created_at).toLocaleDateString()}` : "Publish to see history"}</p>
                </div>
                <div className="stat-chip">
                  <span className="text-[0.65rem] uppercase tracking-[0.35em] text-slate-500">Special flows</span>
                  <strong className="text-white">{cloakingCount + archivedCount}</strong>
                  <p className="text-xs text-slate-400">{cloakingCount} cloaking • {archivedCount} archived</p>
                </div>
                <div className="stat-chip">
                  <span className="text-[0.65rem] uppercase tracking-[0.35em] text-slate-500">Current view</span>
                  <strong className="text-white">{filteredRows.length}</strong>
                  <p className="text-xs text-slate-400">{activePreset === "all" ? "All categories" : statusStyles[activePreset].label}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {loading ? (
            <div className="flex justify-center py-16 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-200">{error}</div>
          ) : paginatedRows.length === 0 && !(activePreset === "deploy" && deployments.length > 0) ? (
            <Card className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-12 text-center text-slate-400">
              <Rocket className="h-8 w-8 text-sky-400" />
              <p className="text-lg font-medium text-white">Nothing found</p>
              <p className="max-w-md text-sm text-slate-400">Try adjusting the filters or create a new project to bring this feed to life.</p>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {paginatedRows.map((row) => {
                const domain = getProjectDomain(row);
                return (
                  <div key={row.id} className="card-veil p-6 md:p-7">
                    <div className="flex flex-col gap-6">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-2">
                          <h2 className="text-xl font-semibold text-white line-clamp-1">{row.name}</h2>
                          <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">{row.slug}</p>
                        </div>
                        {renderStatus(row)}
                      </div>

                      <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
                        <div className="space-y-1 text-xs text-slate-400">
                          <span className="text-slate-500">Updated</span>
                          <p className="text-slate-200">{new Date(row.updated_at).toLocaleString()}</p>
                        </div>
                        <div className="space-y-1 text-xs text-slate-400">
                          <span className="text-slate-500">Domain</span>
                          <p className="truncate text-slate-200">{domain}</p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex gap-2">
                          <Link href={`/editor/${row.id}`}>
                            <Button className="rounded-full bg-sky-500/90 px-5 py-2 text-sm font-medium text-white shadow-[0_12px_32px_rgba(59,130,246,0.35)] transition hover:bg-sky-400/90" size="sm">
                              Open
                            </Button>
                          </Link>
                          <Link href={toExternalUrl(domain)} target="_blank">
                            <Button
                              variant="ghost"
                              className="rounded-full border border-white/10 bg-white/5 px-4 text-xs font-medium text-slate-200 hover:border-sky-400/50 hover:text-white"
                              size="sm"
                            >
                              <ExternalLink className="mr-1 h-4 w-4" />
                              Live site
                            </Button>
                          </Link>
                        </div>
                        <Button
                          variant="ghost"
                          className="rounded-full border border-white/10 bg-white/5 px-4 text-xs font-medium text-rose-200 hover:border-rose-400/50 hover:bg-rose-500/20 hover:text-white"
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
            <div className="panel-glow p-6 sm:p-7">
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
                            href={deploy.url || toExternalUrl(deploy.domain)}
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
                            <a href={deploy.url || toExternalUrl(deploy.domain)} target="_blank" rel="noopener noreferrer">
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
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-xl border border-white/10 bg-white/5 px-3 text-xs text-slate-200 hover:border-sky-400/50 hover:text-white"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />Previous
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-xl border border-white/10 bg-white/5 px-3 text-xs text-slate-200 hover:border-sky-400/50 hover:text-white"
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
            <AlertDialogTitle>Delete this project?</AlertDialogTitle>
            <AlertDialogDescription>
              This action permanently removes “{deleteTarget?.name}” and its files. You won’t be able to undo it.
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
