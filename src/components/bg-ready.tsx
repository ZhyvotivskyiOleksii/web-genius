"use client";
import { useEffect } from "react";

export function BgReady() {
  useEffect(() => {
    try {
      const p = window.location.pathname || '';
      // Не включаем градиент на страницах редактора и предпросмотра
      if (p.startsWith('/editor') || p.startsWith('/preview')) return;
      document.body.classList.add('bg-ready');
    } catch {}
  }, []);
  return null;
}
