"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getSupabase } from "@/lib/supabaseClient";
import { loadPublishSettingsAction, savePublishSettingsAction, testCpanelConnectionAction } from "@/app/actions";
import { Loader2, Wifi, CheckCircle, XCircle } from "lucide-react";

export function PublishSettingsDialog({ open, onOpenChange, onSaved, suggestDomain, suggestDocroot }: { open: boolean; onOpenChange: (v: boolean) => void; onSaved?: () => void; suggestDomain?: string; suggestDocroot?: string }) {
  const { toast } = useToast();
  const [userId, setUserId] = useState<string>("");
  const [host, setHost] = useState("");
  const [username, setUsername] = useState("");
  const [token, setToken] = useState("");
  const [domain, setDomain] = useState("");
  const [docroot, setDocroot] = useState("");
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [testOk, setTestOk] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      try {
        if (!open) return;
        const sb = await getSupabase();
        if (!sb) return;
        const { data } = await sb.auth.getUser();
        const uid = data.user?.id || "";
        setUserId(uid);
        if (!uid) return;
        const fd = new FormData();
        fd.set("userId", uid);
        const res: any = await loadPublishSettingsAction({}, fd as any);
        if (res?.success && res.settings) {
          setHost(res.settings.host || "");
          setUsername(res.settings.username || "");
          setToken(res.settings.token || "");
          // Prioritize suggested domain for the current site context
          // Prioritize the suggested domain for the current site context
          setDomain(suggestDomain || res.settings.domain || "");
          setDocroot(suggestDocroot || res.settings.docroot || "");
        } else {
          // No saved settings — prefill from suggestions if provided
          // No saved settings — pre-fill from suggestions if provided
          if (suggestDomain) setDomain(suggestDomain);
          if (suggestDocroot || suggestDomain) setDocroot(suggestDocroot || `/website/${(suggestDomain || '').replace(/^www\./,'')}`);
        }
      } catch (err) {
        console.error('Failed to load publish settings:', err);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Could not load your saved publishing settings.',
        });
      }
    })();
  }, [open, suggestDomain, suggestDocroot, toast]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Publish Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-2">
            <label className="text-sm">cPanel Host</label>
            <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="https://server.example.com:2083" />
          </div>
          <div className="grid gap-2">
            <label className="text-sm">cPanel Username</label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" />
          </div>
          <div className="grid gap-2">
            <label className="text-sm">cPanel API Token</label>
            <Input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="••••••" />
          </div>
          <div className="grid gap-2">
            <label className="text-sm">Domain</label>
            <Input value={domain} onChange={(e) => { setDomain(e.target.value); setDocroot(`/website/${e.target.value.replace(/^www\./,'')}`); }} placeholder="mysite.com" />
          </div>
          <div className="grid gap-2">
            <label className="text-sm">Document Root</label>
            <Input value={docroot} onChange={(e) => setDocroot(e.target.value)} placeholder="/website/mysite.com" />
          </div>

          <div className="flex items-center justify-between">
            <form
              action={async () => {
                setTesting(true);
                setTestOk(null);
                setTestMessage('Testing connection…');
                try {
                  const fd = new FormData();
                  fd.set("host", host);
                  fd.set("user", username);
                  fd.set("token", token);
                  fd.set("domain", domain);
                  fd.set("docRoot", docroot);
                  const res: any = await testCpanelConnectionAction({}, fd as any);
                  setTestOk(!!res?.success);
                  setTestMessage(res?.message || (res?.success ? 'Connection OK' : 'Failed'));
                  if (res?.success) toast({ title: "Connection OK" });
                  else toast({ variant: 'destructive', title: 'Failed', description: res?.message || 'Check fields' });
                } finally {
                  setTesting(false);
                }
              }}
            >
              <Button type="submit" variant="outline" disabled={testing || !host || !username || !token} className={testing ? 'pointer-events-none opacity-80' : ''}>
                {testing ? (
                  <>
                    <Wifi className="mr-2 h-4 w-4 animate-pulse" />
                    Testing…
                  </>
                ) : (
                  <>Test connection</>
                )}
              </Button>
            </form>
            <form
              action={async () => {
                if (!userId) { toast({ variant: 'destructive', title: 'Please sign in' }); return; }
                setLoading(true);
                try {
                  const fd = new FormData();
                  fd.set("userId", userId);
                  fd.set("host", host);
                  fd.set("username", username);
                  fd.set("token", token);
                  fd.set("domain", domain);
                  fd.set("docroot", docroot);
                  const res: any = await savePublishSettingsAction({}, fd as any);
                  if (res?.success) { toast({ title: 'Saved' }); onSaved?.(); onOpenChange(false); }
                  else toast({ variant: 'destructive', title: 'Save failed', description: res?.error || 'Unknown error' });
                } finally {
                  setLoading(false);
                }
              }}
            >
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save
              </Button>
            </form>
          </div>
          {testing && (
            <p className="text-xs text-[#9da5b4] mt-2">Connecting to {host || 'host'} and checking DomainInfo/Fileman...</p>
          )}
          {!testing && testMessage && (
            <div className="flex items-center gap-2 mt-2 text-xs">
              {testOk ? (
                <CheckCircle className="h-4 w-4 text-emerald-400" />
              ) : (
                <XCircle className="h-4 w-4 text-rose-400" />
              )}
              <span className={testOk ? 'text-emerald-400' : 'text-rose-400'}>{testMessage}</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
