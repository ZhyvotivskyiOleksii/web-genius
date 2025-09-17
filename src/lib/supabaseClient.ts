"use client";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

let cached: any = null;
export async function getSupabase() {
  if (!url || !anon) return null as any;
  if (cached) return cached;
  try {
    const mod = await import("@supabase/supabase-js");
    cached = mod.createClient(url, anon);
    return cached;
  } catch {
    return null as any;
  }
}
