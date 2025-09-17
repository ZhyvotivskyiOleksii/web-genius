"use client";

import React, { useActionState, useState, useEffect, useRef } from "react";
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
import { useRouter } from "next/navigation";
import { Clock, LogOut } from "lucide-react";

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
  const router = useRouter();

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

  const handleOpenLastProject = async () => {
    try {
      const sb = await getSupabase();
      if (!sb || !userId) { router.push('/sites'); return; }
      const { data, error } = await sb.from('sites')
        .select('id')
        .order('updated_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      const last = data?.[0]?.id as string | undefined;
      if (last) router.push(`/editor/${last}`);
      else router.push('/sites');
    } catch {
      router.push('/sites');
    }
  }

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
          <Button
            onClick={handleOpenLastProject}
            className="rounded-xl bg-primary/90 hover:bg-primary text-primary-foreground px-3 py-2 flex items-center gap-2 shadow-[0_2px_10px_rgba(0,0,0,0.35)] border border-white/10"
            title="Open last project"
          >
            <Clock className="h-4 w-4" /> Last Project
          </Button>
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
      <div className="relative z-10 w-full flex items-center justify-center">
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
