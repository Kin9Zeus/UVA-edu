"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Paginacion } from "@/components/Paginacion";

/**
 * Envoltorio delgado sobre `Paginacion` (src/components/Paginacion.tsx) que
 * sabe cómo vive la página del feed en la URL — mismo patrón que
 * `irAPagina` en BitacoraTable.tsx: preserva `categoria`/`mias`/`q`/`orden`
 * y solo pisa `page`.
 */
export function ComunidadPaginacion({ pagina, totalPaginas }: { pagina: number; totalPaginas: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function irAPagina(nuevaPagina: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (nuevaPagina <= 1) params.delete("page");
    else params.set("page", String(nuevaPagina));
    const cadena = params.toString();
    router.push(cadena ? `${pathname}?${cadena}` : pathname, { scroll: false });
  }

  return <Paginacion pagina={pagina} totalPaginas={totalPaginas} onCambiarPagina={irAPagina} />;
}
