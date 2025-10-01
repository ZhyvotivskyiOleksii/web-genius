"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabaseClient";

const PreviewLoader = () => (
  <div className="wg-preview-loader">
    <div className="wg-spinner" />
    <p>Loading preview…</p>
    <style jsx>{`
      .wg-preview-loader {
        position: fixed;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 18px;
        background: radial-gradient(circle at top, rgba(76, 29, 149, 0.28), rgba(11, 16, 31, 0.96));
        color: #cbd5ff;
        font-family: 'Inter', system-ui, sans-serif;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        z-index: 10;
      }

      .wg-spinner {
        width: 64px;
        height: 64px;
        border-radius: 9999px;
        border: 3px solid rgba(99, 102, 241, 0.2);
        border-top-color: rgba(99, 102, 241, 0.85);
        animation: wg-spin 0.9s linear infinite;
        box-shadow: 0 0 35px rgba(79, 70, 229, 0.38);
      }

      @keyframes wg-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }

      @media (max-width: 768px) {
        .wg-preview-loader {
          gap: 14px;
          letter-spacing: 0.12em;
          font-size: 12px;
        }
        .wg-spinner {
          width: 52px;
          height: 52px;
        }
      }
    `}</style>
  </div>
);

function buildHtml(files: Record<string, string>, path: string) {
  const html = files[path] || files['index.html'] || '<!doctype html><title>Preview</title>';
  let processed = html;
  processed = processed.replace(/<script src="scripts\/main.js"><\/script>/, `<script>${files['scripts/main.js'] || ''}<\/script>`);
  processed = processed.replace(/<link rel="stylesheet" href="styles\/style.css">/, `<style>${files['styles/style.css'] || ''}<\/style>`);
  Object.entries(files).forEach(([p, c]) => {
    if (typeof c === 'string' && c.startsWith('data:')) {
      const esc = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      processed = processed.replace(new RegExp(`\"${esc}\"`, 'g'), `"${c}"`).replace(new RegExp(`'${esc}'`, 'g'), `'${c}'`);
    }
  });
  // Rewrite links to use router messaging to parent
  const internalPaths = Object.keys(files).filter((p) => p.endsWith('.html'));
  internalPaths.forEach((p) => {
    const fileName = p.replace(/^\/?/, '');
    const esc = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp(`href=\"${esc}\"`, 'g'),
      new RegExp(`href=\'${esc}\'`, 'g'),
      new RegExp(`href=\"\./${esc}\"`, 'g'),
      new RegExp(`href=\'\./${esc}\'`, 'g'),
      new RegExp(`href=\"/${esc}\"`, 'g'),
      new RegExp(`href=\'/${esc}\'`, 'g'),
    ];
    patterns.forEach((rx) => {
      processed = processed.replace(rx, `href=\"#\" data-preview-path=\"${fileName}\"`);
    });
  });
  const routerScript = `\n<script>(function(){document.addEventListener('click',function(e){var a=e.target&&(e.target.closest?e.target.closest('a[data-preview-path]'):null);if(!a)return;e.preventDefault();var p=a.getAttribute('data-preview-path');if(p&&window.parent){window.parent.postMessage({type:'open-path',path:p},'*');}},true);})();</script>`;
  processed = processed.replace(/<\/body>/i, routerScript + '</body>');
  return processed;
}

export default function PreviewPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = use(params);
  const [files, setFiles] = useState<Record<string,string> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState('index.html');
  const html = useMemo(() => (files ? buildHtml(files, currentPath) : ''), [files, currentPath]);
  const sbRef = useRef<any>(null);

  // Hydrate from sessionStorage cache first for instant preview when available
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const keys = [`wg-preview-${siteId}`, `wg-cache-${siteId}`];
    for (const key of keys) {
      try {
        const raw = window.sessionStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const cachedFiles = parsed?.files;
        if (cachedFiles && typeof cachedFiles === 'object') {
          setFiles((prev) => prev ?? cachedFiles);
          break;
        }
      } catch (cacheErr) {
        console.warn('Preview cache hydration failed:', cacheErr);
      }
    }
  }, [siteId]);

  // Listen for postMessage syncs from the editor window
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'wg-preview-sync' && (!data.siteId || data.siteId === siteId)) {
        if (data.files && typeof data.files === 'object') {
          setFiles(data.files as Record<string, string>);
          try {
            if (typeof window !== 'undefined') {
              window.sessionStorage.setItem(`wg-preview-${siteId}`, JSON.stringify({ files: data.files }));
            }
          } catch (storeErr) {
            console.warn('Preview cache store failed:', storeErr);
          }
        }
        if (typeof data.currentPath === 'string') {
          setCurrentPath(data.currentPath);
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [siteId]);

  // Request freshest files from the opener/editor as soon as possible
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const payload = { type: 'wg-preview-request', siteId, path: currentPath };
    const target = window.opener && !window.opener.closed
      ? window.opener
      : window.parent !== window
        ? window.parent
        : null;
    if (target) {
      try {
        target.postMessage(payload, '*');
      } catch (err) {
        console.warn('Preview sync request failed:', err);
      }
    }
  // we intentionally re-run if currentPath changes so the editor can align routing
  }, [siteId, currentPath]);

  useEffect(() => {
    (async () => {
      try {
        const sb = await getSupabase();
        if (!sb) { setErr('Supabase not configured'); return; }
        sbRef.current = sb;
        const { data } = await sb.from('site_files').select('path,content').eq('site_id', siteId);
        const map: Record<string,string> = {};
        (data || []).forEach((f: any) => { map[f.path] = f.content; });
        setFiles(map);
        try {
          if (typeof window !== 'undefined') {
            window.sessionStorage.setItem(`wg-preview-${siteId}`, JSON.stringify({ files: map }));
          }
        } catch (storeErr) {
          console.warn('Preview cache store failed:', storeErr);
        }
      } catch (e: any) {
        setErr(e?.message || 'Failed to load');
      }
    })();
  }, [siteId]);

  // Realtime updates
  useEffect(() => {
    (async () => {
      const sb = sbRef.current || (await getSupabase());
      if (!sb || !siteId) return;
      const channel = (sb as any)
        .channel(`site-files-${siteId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'site_files', filter: `site_id=eq.${siteId}` }, async () => {
          const { data } = await sb.from('site_files').select('path,content').eq('site_id', siteId);
          const map: Record<string,string> = {};
          (data || []).forEach((f: any) => { map[f.path] = f.content; });
          setFiles(map);
          try {
            if (typeof window !== 'undefined') {
              window.sessionStorage.setItem(`wg-preview-${siteId}`, JSON.stringify({ files: map }));
            }
          } catch (storeErr) {
            console.warn('Preview cache store failed:', storeErr);
          }
        })
        .subscribe();
      return () => { (sb as any).removeChannel(channel); };
    })();
  }, [siteId]);

  // Polling fallback (every 2s) to ensure refreshed content after manual reload
  useEffect(() => {
    let timer: any;
    (async () => {
      const sb = sbRef.current || (await getSupabase());
      if (!sb || !siteId) return;
      timer = setInterval(async () => {
        const { data } = await sb.from('site_files').select('path,content').eq('site_id', siteId);
        const map: Record<string,string> = {};
        (data || []).forEach((f: any) => { map[f.path] = f.content; });
        // shallow diff
        const now = JSON.stringify(map);
        const prev = JSON.stringify(files || {});
        if (now !== prev) {
          setFiles(map);
          try {
            if (typeof window !== 'undefined') {
              window.sessionStorage.setItem(`wg-preview-${siteId}`, JSON.stringify({ files: map }));
            }
          } catch (storeErr) {
            console.warn('Preview cache store failed:', storeErr);
          }
        }
      }, 2000);
    })();
    return () => { if (timer) clearInterval(timer); };
  }, [siteId, files]);

  // Handle router messages from iframe
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.data && e.data.type === 'open-path') {
        setCurrentPath(e.data.path);
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  if (err) {
    return <div style={{ padding: 16, color: '#ccc', fontFamily: 'Inter, system-ui, sans-serif' }}>Error: {err}</div>;
  }
  if (!files) {
    return <PreviewLoader />;
  }

  return (
    <iframe
      title="Live Preview"
      style={{ border: 0, width: '100vw', height: '100vh' }}
      sandbox="allow-scripts allow-same-origin allow-pointer-lock"
      srcDoc={html}
    />
  );
}
