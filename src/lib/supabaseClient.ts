"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const STORAGE_KEY = "wg-auth-token";

declare global {
  // eslint-disable-next-line no-var
  var __supabaseClient: SupabaseClient | null | undefined;
}

const createStorageAdapter = () => {
  const ls = typeof window !== "undefined" ? window.localStorage : undefined;
  if (!ls) return undefined;
  return {
    getItem(key: string) {
      return Promise.resolve(ls.getItem(key));
    },
    setItem(key: string, value: string) {
      ls.setItem(key, value);
      return Promise.resolve();
    },
    removeItem(key: string) {
      ls.removeItem(key);
      return Promise.resolve();
    },
  };
};

export async function getSupabase() {
  if (!url || !anon) return null as any;
  if (typeof window === "undefined") return null as any;

  if (!globalThis.__supabaseClient) {
    try {
      const mod = await import("@supabase/supabase-js");
      const storage = createStorageAdapter();
      const client = mod.createClient(url, anon, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          storageKey: STORAGE_KEY,
          storage,
        },
      });
      globalThis.__supabaseClient = client;
    } catch (error) {
      console.error("Failed to load Supabase client:", error);
      return null as any;
    }
  }

  return globalThis.__supabaseClient!;
}
