"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Lleva el recorrido de pantallas de la app dentro de esta pestana, para que
// "Volver" sepa si hay una pantalla anterior de la app o si se entro directo.
export const NAV_KEY = "croacia_nav";

export function leerRecorrido(): string[] {
  try {
    const v = JSON.parse(sessionStorage.getItem(NAV_KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export default function NavTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    const pila = leerRecorrido();
    const ultimo = pila[pila.length - 1];
    if (ultimo === pathname) return; // recarga de la misma pantalla
    if (pila.length >= 2 && pila[pila.length - 2] === pathname) {
      pila.pop(); // se volvio a la pantalla anterior
    } else {
      pila.push(pathname);
    }
    try {
      sessionStorage.setItem(NAV_KEY, JSON.stringify(pila.slice(-30)));
    } catch {}
  }, [pathname]);

  return null;
}
