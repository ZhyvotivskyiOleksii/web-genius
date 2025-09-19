"use client";

import { useEffect, useState } from "react";

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

  useEffect(() => {
    const spawn = () => {
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
    };

    spawn();

    const handleHide = () => setItems([]);
    const handleShow = () => spawn();
    const visHandler = () => {
      if (document.visibilityState === 'hidden') handleHide();
      else handleShow();
    };
    document.addEventListener('visibilitychange', visHandler);
    window.addEventListener('beforeunload', handleHide);
    window.addEventListener('pagehide', handleHide as any);
    window.addEventListener('pageshow', handleShow as any);
    return () => {
      document.removeEventListener('visibilitychange', visHandler);
      window.removeEventListener('beforeunload', handleHide);
      window.removeEventListener('pagehide', handleHide as any);
      window.removeEventListener('pageshow', handleShow as any);
    };
  }, [count]);

  if (!items.length) return null;

  return (
    <div className="falling-code-layer fade-out" aria-hidden suppressHydrationWarning>
      {items.map((s, i) => (
        <pre
          key={i}
          className="falling-code animate"
          style={{
            left: `${s.x}%`,
            // CSS custom props consumed by CSS animation in globals.css
            // @ts-expect-error custom property
            "--rot": `${s.rot}deg`,
            // @ts-expect-error custom property
            "--h": `${s.hue}`,
            // @ts-expect-error custom property
            "--dur": `${s.dur}s`,
            // @ts-expect-error custom property
            "--delay": `${s.delay}s`,
            // @ts-expect-error custom property
            "--start": s.start,
            // @ts-expect-error custom property
            "--end": s.end,
            fontSize: `${s.size}px`,
          } as React.CSSProperties}
        >
          {s.text}
        </pre>
      ))}
    </div>
  );
}
