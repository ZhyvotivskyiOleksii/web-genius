"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabaseClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Row = { id: string; name: string; slug: string; updated_at: string; status?: string | null };

export default function MySitesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const sb = await getSupabase();
        if (!sb) throw new Error("Supabase not configured");
        const { data: auth } = await sb.auth.getUser();
        if (!auth.user?.id) { setError("Please sign in to see your sites."); setLoading(false); return; }
        const { data, error } = await sb
          .from("sites")
          .select("id,name,slug,updated_at,status")
          .order("updated_at", { ascending: false });
        if (error) throw error;
        setRows((data || []) as any);
      } catch (e: any) {
        setError(e?.message || "Failed to load sites");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      const matchQ = q.trim().length === 0 || r.name.toLowerCase().includes(q.toLowerCase()) || r.slug.toLowerCase().includes(q.toLowerCase());
      const matchS = status === "all" || (r.status || "draft") === status;
      return matchQ && matchS;
    });
  }, [rows, q, status]);

  return (
    <main className="min-h-screen p-6 text-[#d4d4d4] bg-[#1e1e1e]">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">My Sites</h1>
          <Link href="/"><Button variant="ghost">Back</Button></Link>
        </div>
        <div className="flex gap-3 mb-4">
          <Input placeholder="Search by name or slug" value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-2 rounded bg-[#2f3136]">
            <option value="all">All</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        {loading ? (
          <p className="text-sm text-[#9da5b4]">Loading…</p>
        ) : error ? (
          <p className="text-sm text-rose-400">{error}</p>
        ) : (
          <div className="space-y-2">
            {filtered.length === 0 ? (
              <p className="text-sm text-[#9da5b4]">No sites found.</p>
            ) : filtered.map((r) => (
              <div key={r.id} className="p-3 rounded-md border border-[#2a2d2e] bg-[#0f1011]/60 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{r.name}</div>
                  <div className="text-xs text-[#9da5b4] truncate">{r.slug}</div>
                </div>
                <div className="flex items-center gap-3 text-xs text-[#9da5b4]">
                  <span>{new Date(r.updated_at).toLocaleString()}</span>
                  <Link href={`/editor/${r.id}`} className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white">Open</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

