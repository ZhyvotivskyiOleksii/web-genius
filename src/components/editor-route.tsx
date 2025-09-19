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

  if (loading) return <div className="p-6 text-sm text-[#9da5b4]">Loading project…</div>;

  if (error) return (
    <div className="p-6 text-sm">
      <p className="text-rose-400 mb-3">{error}</p>
      <button className="px-3 py-2 rounded bg-[#2f3136] text-white/90" onClick={() => router.push("/")}>Back</button>
    </div>
  );
  if (!site) return null;

  return <SitePreview site={site} onBack={() => router.push("/")} initialSiteId={siteId} />;
}
