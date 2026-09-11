"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Mismo criterio que CatalogoContent (Revf3): no disparar una consulta al
// servidor por cada tecla.
const DEBOUNCE_MS = 300;

const OPCIONES_ORDEN = [
  { valor: "reciente", label: "Tiempo" },
  { valor: "relevancia", label: "Relevancia" },
] as const;

/**
 * Búsqueda de texto + orden del feed de Comunidad — mismo patrón de "vive
 * en la URL, no en estado perdido al recargar" que el buscador del
 * catálogo (CatalogoContent): ?q= y ?orden= se leen en getComunidadFeed
 * (src/lib/comunidad.ts), así que un link compartido reproduce el mismo
 * resultado. Categoría/"mías" (los otros params de la URL) se preservan
 * al tocar estos dos, nunca se resetean entre sí.
 */
export function ComunidadFiltros() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [texto, setTexto] = useState(searchParams.get("q") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ordenActual = searchParams.get("orden") === "relevancia" ? "relevancia" : "reciente";

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function actualizarUrl(cambios: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor) params.set(clave, valor);
      else params.delete(clave);
    }
    startTransition(() => {
      router.push(params.size > 0 ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
    });
  }

  function alEscribir(valor: string) {
    setTexto(valor);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => actualizarUrl({ q: valor || undefined }), DEBOUNCE_MS);
  }

  function limpiarTexto() {
    setTexto("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    actualizarUrl({ q: undefined });
  }

  return (
    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative sm:max-w-[280px] sm:flex-1">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-uva-text-faint"
          strokeWidth={2}
        />
        <input
          type="search"
          value={texto}
          onChange={(event) => alEscribir(event.target.value)}
          placeholder="Buscar en Comunidad"
          aria-label="Buscar en Comunidad"
          className="h-10 w-full rounded-uva-md border border-uva-divider bg-uva-surface py-2 pr-9 pl-9 text-sm text-uva-text outline-none placeholder:text-uva-text-faint hover:border-uva-text-faint focus-visible:border-uva-accent focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-uva-accent"
        />
        {texto && (
          <button
            type="button"
            onClick={limpiarTexto}
            aria-label="Limpiar búsqueda"
            className="absolute top-1/2 right-3 -translate-y-1/2 text-uva-text-faint hover:text-uva-text"
          >
            <X className="size-3.5" strokeWidth={2} />
          </button>
        )}
      </div>

      <div
        role="group"
        aria-label="Ordenar por"
        className="inline-flex shrink-0 gap-0.5 self-start rounded-uva-md border border-uva-divider bg-uva-surface p-0.5"
      >
        {OPCIONES_ORDEN.map((opcion) => (
          <button
            key={opcion.valor}
            type="button"
            aria-pressed={ordenActual === opcion.valor}
            onClick={() => actualizarUrl({ orden: opcion.valor === "reciente" ? undefined : opcion.valor })}
            className={cn(
              "rounded-uva-sm px-3 py-1.5 text-[12.5px] font-semibold text-uva-text-muted transition-colors hover:text-uva-text",
              ordenActual === opcion.valor && "bg-uva-hover text-uva-text",
            )}
          >
            {opcion.label}
          </button>
        ))}
      </div>
    </div>
  );
}
