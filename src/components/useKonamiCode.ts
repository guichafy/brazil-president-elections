"use client";

import { useEffect } from "react";
import { criarDetectorKonami } from "@/lib/konami";

export function useKonamiCode(aoAtivar: () => void, bloqueado = false) {
  useEffect(() => {
    if (bloqueado) return;
    let detectar = criarDetectorKonami();
    const aoTeclar = (evento: KeyboardEvent) => {
      // Campos e controles com navegação por setas mantêm seu próprio teclado.
      const alvo = evento.target;
      if (evento.defaultPrevented || (alvo instanceof Element && alvo.closest("input, textarea, select, [contenteditable]:not([contenteditable='false']), [role='slider'], [role='tablist']"))) {
        detectar = criarDetectorKonami();
        return;
      }
      if (detectar(evento)) aoAtivar();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aoAtivar, bloqueado]);
}
