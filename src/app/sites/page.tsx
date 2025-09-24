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

const pageSize = 10;

type Row = {
  id: string;
  name: string;
  slug: string;
  updated_at: string;
  status?: string | null;
  meta?: Record<string, any> | null;
};

type StatusPresetKey = "all" | "work" | "deploy" | "cloaking" | "archived";

const statusPresets: { key: StatusPresetKey; label: string; matches: string[] | null }[] = [
  { key: "all", label: "Все", matches: null },
  { key: "work", label: "В работе", matches: ["draft", "work", "in_progress", "pending", "edit"] },
  { key: "deploy", label: "Деплой", matches: ["deploy", "published", "live", "production"] },
  { key: "cloaking", label: "Клоакинг", matches: ["cloak", "cloaking", "stealth"] },
  { key: "archived", label: "Архив", matches: ["archive", "archived"] },
];

const statusStyles: Record<StatusPresetKey, { label: string; badgeClass: string; icon: JSX.Element }> = {
  all: {
    label: "Все",
    badgeClass: "border-white/10 bg-white/5 text-slate-100",
    icon: <Rocket className="h-3.5 w-3.5" />,
  },
  work: {
    label: "В работе",
    badgeClass: "border-sky-500/30 bg-sky-500/15 text-sky-200",
    icon: <Wrench className="h-3.5 w-3.5" />,
  },
  deploy: {
    label: "Деплой",
    badgeClass: "border-emerald-500/30 bg-emerald-500/15 text-emerald-200",
    icon: <Rocket className="h-3.5 w-3.5" />,
  },
  cloaking: {
    label: "Клоакинг",
    badgeClass: "border-purple-500/30 bg-purple-500/15 text-purple-200",
    icon: <EyeOff className="h-3.5 w-3.5" />,
  },
  archived: {
    label: "Архив",
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
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      try {
        const sb = await getSupabase();
        if (!sb) throw new Error("Supabase not configured");
        const { data: auth } = await sb.auth.getUser();
        if (!auth.user?.id) {
          setError("Авторизуйтесь, чтобы увидеть свои проекты.");
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
      } catch (e: any) {
        setError(e?.message || "Не удалось загрузить проекты.");
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
      if (!auth.user?.id) throw new Error("Авторизация истекла");
      const siteId = deleteTarget.id;
      await sb.from("site_files").delete().eq("site_id", siteId);
      const { error } = await sb.from("sites").delete().eq("id", siteId).eq("user_id", auth.user.id);
      if (error) throw error;
      setRows((prev) => prev.filter((row) => row.id !== siteId));
      toast({ title: "Проект удалён", description: `«${deleteTarget.name}» перемещён в архив.` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Не получилось", description: e?.message || "Удаление не удалось." });
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
                <p className="text-sm uppercase tracking-[0.35em] text-sky-400/70">Мои проекты</p>
                <h1 className="text-3xl font-semibold text-white sm:text-4xl">Панель управления сайтами</h1>
                <p className="text-sm text-slate-400">Фильтруй, управляй деплоем и скрытыми версиями из одного места.</p>
              </div>
              <Link href="/">
                <Button variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10" size="sm">
                  На главную
                </Button>
              </Link>
            </div>

            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input
                  placeholder="Поиск по названию, домену или slug"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="h-12 rounded-2xl border-white/10 bg-white/[0.03] pl-11 text-base text-white placeholder:text-slate-500 focus-visible:border-sky-500/60 focus-visible:ring-sky-500/40"
                />
              </div>
              <div className="flex w-full gap-3 sm:w-auto">
                <Select value={sort} onValueChange={(value) => setSort(value as typeof sort)}>
                  <SelectTrigger className="h-12 w-full rounded-2xl border-white/10 bg-white/[0.03] text-white sm:w-48">
                    <SelectValue placeholder="Сортировка" />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-[#0f172a] text-slate-100">
                    <SelectItem value="recent">По обновлению</SelectItem>
                    <SelectItem value="name">По названию</SelectItem>
                    <SelectItem value="status">По статусу</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Tabs value={activePreset} onValueChange={(value) => setActivePreset(value as StatusPresetKey)}>
              <TabsList className="grid grid-cols-2 gap-2 rounded-2xl border border-white/5 bg-white/5 p-2 sm:flex sm:flex-wrap">
                {statusPresets.map((preset) => (
                  <TabsTrigger
                    key={preset.key}
                    value={preset.key}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-transparent px-4 py-2 text-sm font-medium text-slate-200 transition data-[state=active]:border-sky-400/50 data-[state=active]:bg-sky-400/10 data-[state=active]:text-white"
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
            <Card className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-12 text-center text-slate-400">
              <Rocket className="h-8 w-8 text-sky-400" />
              <p className="text-lg font-medium text-white">Ничего не найдено</p>
              <p className="max-w-md text-sm text-slate-400">Попробуй поменять фильтры или начни новый проект, чтобы оживить эту ленту.</p>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {paginatedRows.map((row) => {
                const domain = row.meta?.domain ? String(row.meta.domain) : null;
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
                          <span>Обновлено</span>
                          <span>{new Date(row.updated_at).toLocaleString()}</span>
                        </div>
                        {domain ? (
                          <div className="flex items-center justify-between text-xs text-slate-400">
                            <span>Домен</span>
                            <span className="truncate text-slate-200">{domain}</span>
                          </div>
                        ) : null}
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <div className="flex gap-2">
                          <Link href={`/editor/${row.id}`}>
                            <Button className="rounded-xl bg-sky-500/90 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-sky-400" size="sm">
                              Открыть
                            </Button>
                          </Link>
                          {domain ? (
                            <Link href={`https://${domain}`} target="_blank">
                              <Button variant="ghost" className="rounded-xl border border-white/10 bg-white/5 px-3 text-xs text-slate-200 hover:border-sky-400/50 hover:text-white" size="sm">
                                <ExternalLink className="mr-1 h-4 w-4" />
                                В продакшн
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
                          Удалить
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!loading && !error && filteredRows.length > 0 ? (
            <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3 text-xs text-slate-400 sm:flex-row">
              <div>
                Страница {currentPage} из {totalPages} • {filteredRows.length} проектов
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-xl border border-white/10 bg-white/5 px-3 text-xs text-slate-200 hover:border-sky-400/50 hover:text-white"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />Назад
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-xl border border-white/10 bg-white/5 px-3 text-xs text-slate-200 hover:border-sky-400/50 hover:text-white"
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Далее<ChevronRight className="ml-1 h-4 w-4" />
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
            <AlertDialogTitle>Удалить проект?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие навсегда удалит «{deleteTarget?.name}» и связанные файлы. Его нельзя будет отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePending}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deletePending}
              className="bg-rose-500 text-white hover:bg-rose-600"
            >
              {deletePending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
