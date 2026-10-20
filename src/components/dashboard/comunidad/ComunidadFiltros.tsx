"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Mismo criterio que CatalogoCursos (Revf3): no disparar una consulta al
// servidor por cada tecla.
const DEBOUNCE_MS = 300;

const OPCIONES_ORDEN = [
  { valor: "reciente", label: "Más recientes" },
  { valor: "relevancia", label: "Más relevantes" },
] as const;

/**
 * Búsqueda de texto + orden del feed de Comunidad — mismo patrón de "vive
 * en la URL, no en estado perdido al recargar" que el buscador del
 * catálogo (CatalogoCursos): ?q= y ?orden= se leen en getComunidadFeed
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
    // Cambiar la búsqueda o el orden vuelve a la página 1 — mismo criterio
    // que BitacoraTable.actualizarUrl: la página en la que estabas puede no
    // existir en el resultado nuevo.
    params.delete("page");
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
    <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4">
      <div className="relative min-w-0">
        <Search
          className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-uva-text-muted"
          strokeWidth={2}
          aria-hidden="true"
        />
        <input
          type="search"
          value={texto}
          onChange={(event) => alEscribir(event.target.value)}
          placeholder="Buscar publicaciones o personas"
          aria-label="Buscar publicaciones o personas en Comunidad"
          className="h-11 w-full rounded-uva-md border border-uva-line-strong bg-uva-surface py-2 pr-11 pl-11 text-base text-uva-text md:h-9 md:pointer-fine:text-uva-detalle outline-hidden placeholder:text-uva-text-muted hover:border-uva-text focus-visible:border-uva-accent focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-uva-accent"
        />
        {texto && (
          <button
            type="button"
            onClick={limpiarTexto}
            aria-label="Limpiar búsqueda"
            className="absolute top-1/2 right-0.5 grid size-11 -translate-y-1/2 place-items-center text-uva-text-muted hover:text-uva-text"
          >
            <X className="size-3.5" strokeWidth={2} aria-hidden="true" />
          </button>
        )}
      </div>

      <div
        role="group"
        aria-label="Ordenar por"
        className="flex shrink-0 flex-wrap items-center gap-1.5"
      >
        <Select
          value={ordenActual}
          onValueChange={(valor) => actualizarUrl({ orden: valor && valor !== "reciente" ? valor : undefined })}
          items={Object.fromEntries(OPCIONES_ORDEN.map((o) => [o.valor, o.label]))}
        >
          <SelectTrigger
            aria-label="Ordenar publicaciones"
            className="min-h-11.25 w-full gap-2.5 rounded-uva-md border border-uva-line-strong bg-uva-surface px-3.5 text-uva-cuerpo font-semibold text-uva-text md:h-9 md:min-h-9 md:text-uva-detalle md:font-medium sm:w-auto dark:bg-uva-surface dark:hover:bg-uva-surface"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPCIONES_ORDEN.map((opcion) => (
              <SelectItem key={opcion.valor} value={opcion.valor}>
                {opcion.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
