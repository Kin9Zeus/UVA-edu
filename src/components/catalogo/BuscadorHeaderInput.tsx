"use client";

import { useEffect, useState, type ComponentType, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import type { BuscadorInput as BuscadorInputTipo, CursoOpcion } from "@/components/catalogo/BuscadorInput";
import { listarCursosParaBuscador } from "@/actions/cursos/buscador";
import { CLASE_CAMPO_BUSCADOR, CLASE_ICONO_BUSCADOR } from "@/components/catalogo/campoBuscador";
import { SearchIcon } from "@/components/home/icons";
import { LARGO_MAXIMO_BUSQUEDA } from "@/lib/parametros-url";
import { useModuloDiferido } from "@/lib/useModuloDiferido";

// Cache en memoria del módulo: los headers se montan de nuevo en cada
// página (no comparten un layout persistente), así que sin esto pedirían
// el listado de cursos una y otra vez. Sobrevive mientras dure la sesión
// de navegación (se resetea en un hard reload, no en cada click de <Link>).
let cachePromise: Promise<CursoOpcion[]> | null = null;
function obtenerOpcionesCacheadas() {
  if (!cachePromise) {
    cachePromise = listarCursosParaBuscador().catch((error) => {
      cachePromise = null;
      throw error;
    });
  }
  return cachePromise;
}

type BuscadorInputComponente = ComponentType<ComponentProps<typeof BuscadorInputTipo>>;

// El campo con sugerencias (y la librería del autocompletado que trae) se
// pide aparte, una sola vez por pestaña.
let modulo: Promise<BuscadorInputComponente> | null = null;
function cargarBuscadorInput() {
  modulo ??= import("@/components/catalogo/BuscadorInput")
    .then((m) => m.BuscadorInput)
    .catch((error) => {
      // Sin el chunk (red caída) queda el campo simple, que busca con Enter.
      modulo = null;
      throw error;
    });
  return modulo;
}

/**
 * Buscador de los headers (marketing y dashboard): mismo dropdown de
 * sugerencias que BuscadorInput usa en la página de catálogo, pero como el
 * header no recibe el catálogo como prop (se usa en páginas que no lo
 * cargan), pide la lista liviana de cursos vía Server Action. Al elegir una
 * opción navega al catálogo con ese título como término de búsqueda.
 *
 * Nada de eso entra en la carga de la página: el header sale en todas, y la
 * librería del autocompletado más la Server Action al montar eran lo que más
 * pesaba en el LCP de la portada en Lighthouse móvil (87 → 90 sin el
 * buscador, 2026-10-20). Por eso:
 * - Primero se pinta un campo simple, idéntico, que ya funciona: con Enter
 *   busca lo escrito. El campo con sugerencias se carga al pasar el puntero
 *   o al enfocar (ver useModuloDiferido) y lo reemplaza conservando el texto
 *   y el foco.
 * - La lista de cursos se pide la primera vez que el campo recibe el foco.
 *   Mientras llega, el dropdown dice "Cargando…".
 */
export function BuscadorHeaderInput({
  placeholder,
  destino,
  className,
  onNavegar,
  autoFocus,
}: {
  placeholder: string;
  /** Ruta del catálogo a la que navegar: "/catalogo" o "/dashboard/catalogo". */
  destino: string;
  className?: string;
  /** Se dispara justo después de navegar — para cerrar el overlay móvil que lo contiene. */
  onNavegar?: () => void;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const { modulo: BuscadorInput, pedir: pedirBuscadorInput } = useModuloDiferido(cargarBuscadorInput);
  const [texto, setTexto] = useState("");
  const [enfocado, setEnfocado] = useState(false);
  const [opciones, setOpciones] = useState<CursoOpcion[]>([]);
  const [estadoLista, setEstadoLista] = useState<"cargando" | "lista" | "error">("cargando");
  const [pedida, setPedida] = useState(false);

  useEffect(() => {
    if (!pedida) return;
    let activo = true;
    obtenerOpcionesCacheadas()
      .then((data) => {
        if (!activo) return;
        setOpciones(data);
        setEstadoLista("lista");
      })
      .catch(() => {
        // Un fallo no es "Sin resultados": el estudiante creería que no hay
        // cursos con ese nombre.
        if (activo) setEstadoLista("error");
      });
    return () => {
      activo = false;
    };
  }, [pedida]);

  function buscar(valor: string) {
    router.push(valor ? `${destino}?q=${encodeURIComponent(valor)}` : destino);
    onNavegar?.();
  }

  return (
    <div
      className={className}
      onFocus={() => {
        pedirBuscadorInput();
        setPedida(true);
        setEnfocado(true);
      }}
      onBlur={() => setEnfocado(false)}
      onPointerEnter={pedirBuscadorInput}
    >
      {BuscadorInput ? (
        <BuscadorInput
          placeholder={placeholder}
          etiqueta="Buscar cursos"
          valorInicial={texto}
          opciones={opciones}
          mensajeVacio={
            estadoLista === "cargando"
              ? "Cargando…"
              : estadoLista === "error"
                ? "No se pudieron cargar las sugerencias."
                : "Sin resultados"
          }
          onBuscar={buscar}
          // Si el reemplazo llega con el campo simple enfocado, el foco pasa
          // al nuevo y quien está escribiendo no lo pierde.
          autoFocus={autoFocus || enfocado}
        />
      ) : (
        <div className="relative">
          <span className={CLASE_ICONO_BUSCADOR}>
            <SearchIcon />
          </span>
          <input
            type="text"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") buscar(texto.trim());
            }}
            placeholder={placeholder}
            aria-label="Buscar cursos"
            autoFocus={autoFocus}
            maxLength={LARGO_MAXIMO_BUSQUEDA}
            autoComplete="off"
            className={CLASE_CAMPO_BUSCADOR}
          />
        </div>
      )}
    </div>
  );
}
