"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabaseClient";
import assets from '@/lib/asset-manifest.json';
import type { Site } from "@/lib/generation";
import { SitePreview } from "@/components/site-preview";

export function EditorRoute({ siteId }: { siteId: string }) {
  const [site, setSite] = useState<Site | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (site) return;
    if (typeof window === 'undefined') return;
    try {
      const cacheKey = `wg-cache-${siteId}`;
      const cached = window.sessionStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === 'object' && parsed.files) {
          setSite(parsed as Site);
          setLoading(false);
        }
        // Do NOT remove the cache immediately. Keep as fallback in case DB fetch fails/timeouts.
      }
      // Also try a persistent fallback from localStorage
      const persisted = window.localStorage.getItem(`wg-editor-last-${siteId}`);
      if (!cached && persisted) {
        const parsed = JSON.parse(persisted);
        if (parsed && typeof parsed === 'object' && parsed.files) {
          setSite(parsed as Site);
          setLoading(false);
        }
      }
    } catch (cacheErr) {
      console.warn('Failed to hydrate editor cache:', cacheErr);
    }
  }, [siteId, site]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const sb = await getSupabase();
      if (!sb) {
        setError("Supabase not configured");
        setLoading(false);
        return;
      }

      const withRetry = async <T,>(fn: () => Promise<T>, attempts = 3): Promise<T> => {
        let lastErr: any = null;
        for (let i = 1; i <= attempts; i++) {
          try {
            return await fn();
          } catch (err: any) {
            lastErr = err;
            const msg = String(err?.message || err || '');
            // Friendly status for Postgres statement timeout
            if (/statement timeout/i.test(msg) || /canceling statement/i.test(msg)) {
              setError('Reconnecting to database…');
            }
            await new Promise(res => setTimeout(res, Math.min(3000, 600 * i)));
          }
        }
        throw lastErr;
      };

      try {
        // Verify auth to satisfy RLS
        const sessionData = await withRetry(() => sb.auth.getSession());
        const userId = (sessionData as any).data?.session?.user?.id as string | undefined;
        if (!userId) {
          const auth = await withRetry(() => sb.auth.getUser());
          if (!(auth as any).data?.user?.id) {
            setError("Please sign in to access your project.");
            setLoading(false);
            return;
          }
        }

        const sResp = await withRetry(() => sb
          .from("sites")
          .select("id,name,slug,types,meta")
          .eq("id", siteId)
          .maybeSingle());
        if ((sResp as any)?.error) {
          throw (sResp as any).error;
        }
        const s = (sResp as any).data ?? sResp;
        if (!s) {
          setError("Project not found or access denied.");
          setLoading(false);
          return;
        }

        const filesResp = await withRetry(() => sb
          .from("site_files")
          .select("path,content")
          .eq("site_id", siteId)
          // Only text-like files; heavy assets (games/, data URIs) не тянем из БД
          .or([
            'path.ilike.%.html','path.ilike.%.htm','path.ilike.%.css','path.ilike.%.js','path.ilike.%.ts',
            'path.ilike.%.tsx','path.ilike.%.json','path.ilike.%.md','path.ilike.%.svg','path.ilike.%.txt'
          ].join(','))
          .limit(4000));
        if ((filesResp as any)?.error) {
          throw (filesResp as any).error;
        }
        const rawFiles = (filesResp as any).data ?? filesResp;
        const files: any[] = Array.isArray(rawFiles) ? rawFiles : [];

        const map: Record<string, string> = {};
        (files || []).forEach((f: any) => (map[f.path] = f.content));
        // Ensure assets folders appear in the editor (virtual placeholders)
        try {
          const addPh = (p: string) => { if (!map[p]) map[p] = ''; };
          const imgs: string[] = Array.isArray((assets as any).images) ? (assets as any).images as any : [];
          if (imgs.length) {
            addPh('images/.placeholder');
            const imgDirs = new Set<string>();
            imgs.forEach((p) => {
              const parts = String(p).split('/');
              if (parts[0] !== 'images') return;
              const dir = parts.slice(0, -1).join('/');
              if (dir) imgDirs.add(dir);
            });
            imgDirs.forEach((d) => addPh(`${d}/.placeholder`));
          }
          const games: string[] = Array.isArray((assets as any).games) ? (assets as any).games as any : [];
          if (games.length) {
            addPh('games/.placeholder');
            games.forEach((g) => {
              addPh(`games/${g}/.placeholder`);
              if (!map[`games/${g}/game.html`]) {
                map[`games/${g}/game.html`] = `<!-- Served from /games/${g}/game.html at runtime. Use Download ZIP to get assets. -->`;
              }
            });
          }
        } catch {}
        const domain = (s.meta && s.meta.domain) || s.slug || s.name || "website";
        if (!cancelled) {
          setSite((prev) => {
            const mergedFiles = prev?.files ? { ...prev.files, ...map } : map;
            const merged: Site = { domain, files: mergedFiles, history: prev?.history || [], types: s.types || prev?.types || [] } as Site;
            try {
              if (typeof window !== 'undefined') {
                window.localStorage.setItem(`wg-editor-last-${siteId}`, JSON.stringify(merged));
              }
            } catch {}
            return merged;
          });
        }
      } catch (e: any) {
        if (!cancelled) {
          const raw = String(e?.message || 'Failed to load project');
          const msg = /statement timeout|canceling statement/i.test(raw)
            ? 'Database request timed out. Loaded the last saved version.'
            : raw;
          // Try to recover from cache
          try {
            const persisted = typeof window !== 'undefined' ? window.localStorage.getItem(`wg-editor-last-${siteId}`) : null;
            if (persisted) {
              const parsed = JSON.parse(persisted);
              if (parsed && typeof parsed === 'object' && parsed.files) {
                setSite(parsed as Site);
                setError(null);
                setLoading(false);
                return;
              }
            }
          } catch {}
          setError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [siteId]);

  if (loading) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-[#050109]" style={{ backgroundImage: 'none' }}>
        <div className="flex flex-col items-center gap-4 text-white/80">
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-purple-500/40 border-t-purple-300" />
          <p className="text-xs uppercase tracking-[0.4em] text-purple-200">Loading</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-[#050109] p-6 text-center text-sm text-white/80" style={{ backgroundImage: 'none' }}>
        <div className="flex flex-col items-center gap-4 max-w-md">
          <p className="text-rose-300">{error}</p>
          <button
            className="rounded-full bg-purple-600/80 px-4 py-2 text-white shadow-[0_18px_38px_rgba(90,60,255,0.35)] transition hover:bg-purple-500"
            onClick={() => router.push('/')}
          >
            Back to Generator
          </button>
        </div>
      </div>
    );
  }
  if (!site) return null;

  return <SitePreview site={site} onBack={() => router.push("/")} initialSiteId={siteId} />;
}
