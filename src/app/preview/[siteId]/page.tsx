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

const PREVIEW_CACHE_LIMIT = 3_500_000; // ~3.5MB safety margin for sessionStorage
const DATA_URI_PLACEHOLDER = 'data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=';
const DATA_URI_CACHE_THRESHOLD = 240_000;

const splitPreviewTarget = (raw?: string | null): { file: string; hash: string } => {
  if (typeof raw !== 'string') {
    return { file: 'index.html', hash: '' };
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return { file: 'index.html', hash: '' };
  }
  const [pathPart, hashPart] = trimmed.split('#', 2);
  const [filePart] = pathPart.split('?', 1);
  const normalized = filePart.replace(/^\.?\/+/, '').trim();
  const file = normalized.length ? normalized : 'index.html';
  const hash = hashPart ? `#${hashPart}` : '';
  return { file, hash };
};

const sanitizeFilesForCache = (files: Record<string, string>): Record<string, string> => {
  const sanitized: Record<string, string> = {};
  Object.entries(files).forEach(([key, value]) => {
    if (typeof value !== 'string') {
      return;
    }
    if (value.startsWith('data:') && value.length > DATA_URI_CACHE_THRESHOLD) {
      sanitized[key] = DATA_URI_PLACEHOLDER;
      return;
    }
    sanitized[key] = value;
  });
  return sanitized;
};

const safeStorePreviewCache = (siteId: string, files: Record<string, string>) => {
  if (typeof window === 'undefined') return false;
  try {
    const payload = JSON.stringify({ files: sanitizeFilesForCache(files) });
    if (payload.length > PREVIEW_CACHE_LIMIT) {
      console.warn(
        `Preview cache skipped for ${siteId}: payload size ${payload.length} exceeds limit ${PREVIEW_CACHE_LIMIT}`
      );
      return false;
    }
    window.sessionStorage.setItem(`wg-preview-${siteId}`, payload);
    return true;
  } catch (storeErr) {
    console.warn('Preview cache store failed:', storeErr);
    return false;
  }
};

function buildHtml(files: Record<string, string>, path: string) {
  const { file: filePath, hash: fragment } = splitPreviewTarget(path);
  let html = files[filePath] || files['index.html'] || '<!doctype html><title>Preview</title>';
  // If content looks like a bare script or too small to be a page, wrap into a minimal HTML shell
  const looksBare = (s: string) => {
    const t = (s || '').trim();
    if (t.length < 32) return true;
    const hasMarkup = /<html|<body|<head|<section|<div/i.test(t);
    const onlyScriptOrText = /^\s*<script[\s>]/i.test(t) || (!hasMarkup && /^[\(\{A-Za-z]/.test(t));
    return !hasMarkup && onlyScriptOrText;
  };
  if (looksBare(html)) {
    const t = (html || '').trim();
    const scriptLike = /^(?:\(function|function\s|var\s|let\s|const\s|window\.|document\.|\()/i.test(t);
    if (scriptLike) {
      const safe = t.replace(/<\/script>/gi, '<\\/script>');
      html = `<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><title>Preview</title></head><body><script>${safe}</script></body></html>`;
    } else {
      html = `<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><title>Preview</title></head><body>${t}</body></html>`;
    }
  }
  let processed = html;
  processed = processed.replace(/<script src="scripts\/main.js"><\/script>/, `<script>${files['scripts/main.js'] || ''}<\/script>`);
  processed = processed.replace(/<link rel="stylesheet" href="styles\/style.css">/, `<style>${files['styles/style.css'] || ''}<\/style>`);
  Object.entries(files).forEach(([p, c]) => {
    if (typeof c === 'string' && c.startsWith('data:')) {
      const esc = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      processed = processed.replace(new RegExp(`\"${esc}\"`, 'g'), `"${c}"`).replace(new RegExp(`'${esc}'`, 'g'), `'${c}'`);
    }
  });
  const normalizePath = (href: string) => href.replace(/^\.?\//, '');
  const isInternal = (href: string) => {
    const key = normalizePath(href.split('#')[0]);
    return key in files;
  };

  processed = processed.replace(/href=\"([^\"#?]+\.html)(#[^\"]*)?\"/g, (match, href, hash = '') => {
    if (!isInternal(href)) return match;
    const normalized = normalizePath(href);
    return `href=\"#\" data-preview-path=\"${normalized}${hash}\"`;
  });

  processed = processed.replace(/href='([^'#?]+\.html)(#[^']*)?'/g, (match, href, hash = '') => {
    if (!isInternal(href)) return match;
    const normalized = normalizePath(href);
    return `href='#' data-preview-path=\"${normalized}${hash}\"`;
  });

  processed = processed
    .replace(
      /(href|src)=\"(games\/[^\"]+)\"/g,
      (_match, attr, path) => `${attr}="/${path}"`
    )
    .replace(
      /(href|src)='(games\/[^']+)'/g,
      (_match, attr, path) => `${attr}='/${path}'`
    );
  // Also normalize local image paths to absolute from public
  processed = processed
    .replace(
      /(href|src)=\"(images\/[^\"]+)\"/g,
      (_match, attr, path) => `${attr}="/${path}"`
    )
    .replace(
      /(href|src)='(images\/[^']+)'/g,
      (_match, attr, path) => `${attr}='/${path}'`
    );

  const routerScript = `\n<script>(function(){document.addEventListener('click',function(e){var a=e.target&&(e.target.closest?e.target.closest('a[data-preview-path]'):null);if(!a)return;e.preventDefault();if(typeof e.stopImmediatePropagation==='function'){e.stopImmediatePropagation();}else if(typeof e.stopPropagation==='function'){e.stopPropagation();}var p=a.getAttribute('data-preview-path');if(p&&window.parent){window.parent.postMessage({type:'open-path',path:p},'*');}},true);})();</script>`;
  const anchorScrollScript = `\n<script>(function(){document.addEventListener('click',function(e){try{var a=e.target&&(e.target.closest?e.target.closest('a[href^="#"]'):null);if(!a)return;var href=a.getAttribute('href')||'';if(href.length<2)return;e.preventDefault();var id=decodeURIComponent(href.slice(1));var el=document.getElementById(id);if(el&&el.scrollIntoView){el.scrollIntoView({behavior:'smooth'});}var mm=document.getElementById('mobile-menu');if(mm){mm.style.display='none';mm.style.opacity='0';mm.style.pointerEvents='none';}if(document.body){document.body.classList.remove('overflow-hidden');}}catch(_){}},true);})();</script>`;
  const safetyMenuScript = `\n<script>(function(){function closeMenu(){try{var mm=document.getElementById('mobile-menu');if(mm){mm.style.display='none';mm.style.opacity='0';mm.style.pointerEvents='none';mm.classList.remove('open','visible','show','active');}if(document.body){document.body.classList.remove('overflow-hidden');}}catch(_){} }if(document.readyState!=='loading'){closeMenu();}else{document.addEventListener('DOMContentLoaded',closeMenu);}window.addEventListener('hashchange',closeMenu);})();</script>`;
  const extraScripts: string[] = [routerScript];
  if (fragment) {
    const safeHash = fragment
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/`/g, '\\`')
      .replace(/<\/script>/gi, '<\\/script>');
    const hashScript = `\n<script>(function(){try{var hash='${safeHash}';if(hash&&hash.length>1){if(hash.charAt(0)==='#'){hash=hash.slice(1);}if(hash){location.hash=hash;}}}catch(err){}})();</script>`;
    extraScripts.push(hashScript);
  }
  const scriptBundle = [routerScript, anchorScrollScript, safetyMenuScript, ...extraScripts].join('');
  if (/<\/body>/i.test(processed)) {
    processed = processed.replace(/<\/body>/i, `${scriptBundle}</body>`);
  } else {
    processed = `${processed}${scriptBundle}`;
  }
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
              safeStorePreviewCache(siteId, data.files as Record<string, string>);
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
            safeStorePreviewCache(siteId, map);
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
              safeStorePreviewCache(siteId, map);
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
              safeStorePreviewCache(siteId, map);
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
        const rawPath = typeof e.data.path === 'string' ? e.data.path : '';
        const extraHash = typeof e.data.hash === 'string' ? e.data.hash : '';
        const base = splitPreviewTarget(rawPath);
        const hashCandidate = extraHash
          ? extraHash.startsWith('#')
            ? extraHash
            : `#${extraHash.replace(/^#/, '')}`
          : base.hash;
        const nextPath = hashCandidate ? `${base.file}${hashCandidate}` : base.file;
        setCurrentPath(nextPath);
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
      sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-popups allow-forms"
      srcDoc={html}
    />
  );
}
