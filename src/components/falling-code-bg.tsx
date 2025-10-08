"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";

type Snippet = {
  text: string;
  x: number; // 0..100
  rot: number; // deg
  hue: number; // 0..360
  dur: number; // seconds
  delay: number; // seconds
  size: number; // px
  start: string; // e.g. '18vh'
  end: string; // e.g. '60vh'
};

const CANDIDATES = [
  "const sum=(a,b)=>a+b;",
  "fetch('/api').then(r=>r.json())",
  "<section id=\"hero\"></section>",
  ".btn:hover{transform:translateY(-1px)}",
  "gsap.from('.animate-in',{y:30,opacity:0})",
  "<i class=\"fa-solid fa-bolt\"></i>",
  "<span class=\"material-icons\">menu</span>",
];

export function FallingCodeBg({ count = 10 }: { count?: number }) {
  const [items, setItems] = useState<Snippet[]>([]);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const rnd = (min: number, max: number) => Math.random() * (max - min) + min;
    const hues = [199, 262, 187, 210];
    const snips = Array.from({ length: count }).map(() => ({
      text: CANDIDATES[Math.floor(Math.random() * CANDIDATES.length)],
      x: Math.random() < 0.5 ? rnd(8, 28) : rnd(72, 92),
      rot: rnd(-10, 10),
      hue: hues[Math.floor(Math.random() * hues.length)],
      dur: rnd(6.5, 9.5),
      delay: rnd(0, 2.5),
      size: rnd(12, 18),
      start: `${rnd(12, 26)}vh`,
      end: `${rnd(45, 62)}vh`,
    }));
    setItems(snips);
    const handleHide = () => { setVisible(false); setItems([]); };
    const visHandler = () => { if (document.visibilityState === 'hidden') handleHide(); };
    document.addEventListener('visibilitychange', visHandler);
    window.addEventListener('beforeunload', handleHide);
    window.addEventListener('pagehide', handleHide as any);
    return () => {
      document.removeEventListener('visibilitychange', visHandler);
      window.removeEventListener('beforeunload', handleHide);
      window.removeEventListener('pagehide', handleHide as any);
    };
  }, [count]);

  if (!items.length || !visible) return null;

  return (
    <div className="falling-code-layer fade-out" aria-hidden suppressHydrationWarning>
      {items.map((s, i) => {
        const style: CSSProperties & Record<'--rot' | '--h' | '--dur' | '--delay' | '--start' | '--end', string> = {
          left: `${s.x}%`,
          '--rot': `${s.rot}deg`,
          '--h': `${s.hue}`,
          '--dur': `${s.dur}s`,
          '--delay': `${s.delay}s`,
          '--start': s.start,
          '--end': s.end,
          fontSize: `${s.size}px`,
        };
        return (
          <pre key={i} className="falling-code animate" style={style}>
            {s.text}
          </pre>
        );
      })}
    </div>
  );
}
