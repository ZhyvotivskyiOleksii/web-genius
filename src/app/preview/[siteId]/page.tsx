"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabaseClient";

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
        if (now !== prev) setFiles(map);
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

  if (err) return <div style={{padding:16,color:'#ccc'}}>Error: {err}</div>;
  if (!files) return <div style={{padding:16,color:'#ccc'}}>Loading…</div>;
  return <iframe title="Live Preview" style={{border:0,width:'100vw',height:'100vh'}} sandbox="allow-scripts allow-same-origin allow-pointer-lock" srcDoc={html} />;
}
