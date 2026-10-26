"use client";

import { usePathname } from "next/navigation";

/** La ruta que se pidió, para el cajetín de la 404 (`not-found` no la recibe como prop). */
export function RutaActual() {
  return usePathname();
}
