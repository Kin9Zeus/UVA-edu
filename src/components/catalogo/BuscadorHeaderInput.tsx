"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BuscadorInput, type CursoOpcion } from "@/components/catalogo/BuscadorInput";
import { listarCursosParaBuscador } from "@/actions/cursos/buscador";

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

/**
 * Buscador de los headers (marketing y dashboard): mismo dropdown de
 * sugerencias que BuscadorInput usa en la página de catálogo, pero como el
 * header no recibe el catálogo como prop (se usa en páginas que no lo
 * cargan), pide la lista liviana de cursos vía Server Action. Al elegir una
 * opción navega al catálogo con ese título como término de búsqueda.
 */
export function BuscadorHeaderInput({
  placeholder,
  destino,
  className,
}: {
  placeholder: string;
  /** Ruta del catálogo a la que navegar: "/catalogo" o "/dashboard/catalogo". */
  destino: string;
  className?: string;
}) {
  const router = useRouter();
  const [opciones, setOpciones] = useState<CursoOpcion[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;
    obtenerOpcionesCacheadas()
      .then((data) => {
        if (activo) setOpciones(data);
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, []);

  return (
    <BuscadorInput
      placeholder={placeholder}
      opciones={opciones}
      mensajeVacio={cargando ? "Cargando…" : "Sin resultados"}
      onBuscar={(valor) =>
        router.push(valor ? `${destino}?q=${encodeURIComponent(valor)}` : destino)
      }
      className={className}
    />
  );
}
