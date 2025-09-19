"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabaseClient";
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
        window.sessionStorage.removeItem(cacheKey);
      }
    } catch (cacheErr) {
      console.warn('Failed to hydrate editor cache:', cacheErr);
    }
  }, [siteId, site]);

  useEffect(() => {
    (async () => {
      try {
        const sb = await getSupabase();
        if (!sb) throw new Error("Supabase not configured");
        // Verify auth to satisfy RLS
        const { data: sessionData } = await sb.auth.getSession();
        const userId = sessionData.session?.user?.id;
        if (!userId) {
          const { data: auth } = await sb.auth.getUser();
          if (!auth.user?.id) {
            setError("Please sign in to access your project.");
            setLoading(false);
            return;
          }
        }
        const { data: s, error: e1 } = await sb
          .from("sites")
          .select("id,name,slug,types,meta")
          .eq("id", siteId)
          .maybeSingle();
        if (e1) throw e1;
        if (!s) {
          setError("Project not found or access denied.");
          setLoading(false);
          return;
        }
        const { data: files, error: e2 } = await sb
          .from("site_files")
          .select("path,content")
          .eq("site_id", siteId);
        if (e2) throw e2;
        const map: Record<string, string> = {};
        (files || []).forEach((f: any) => (map[f.path] = f.content));
        const domain = (s.meta && s.meta.domain) || s.slug || s.name || "website";
        setSite({ domain, files: map, history: [], types: s.types || [] });
      } catch (e: any) {
        setError(e?.message || "Failed to load project");
      } finally {
        setLoading(false);
      }
    })();
  }, [siteId]);

  if (loading) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-[#050109]">
        <div className="flex flex-col items-center gap-4 text-white/80">
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-purple-500/40 border-t-purple-300" />
          <p className="text-xs uppercase tracking-[0.4em] text-purple-200">Loading</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-[#050109] p-6 text-center text-sm text-white/80">
        <p className="mb-4 max-w-md text-rose-300">{error}</p>
        <button
          className="rounded-full bg-purple-600/80 px-4 py-2 text-white shadow-[0_18px_38px_rgba(90,60,255,0.35)] transition hover:bg-purple-500"
          onClick={() => router.push('/')}
        >
          Back to Generator
        </button>
      </div>
    );
  }
  if (!site) return null;

  return <SitePreview site={site} onBack={() => router.push("/")} initialSiteId={siteId} />;
}
