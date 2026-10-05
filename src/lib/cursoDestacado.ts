import { unstable_cache } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";
import { logError } from "@/lib/log";
import { lanzarSiFalla } from "@/lib/supabase/errores";
import { REVALIDAR_SEGUNDOS, TAG_CATALOGO } from "@/lib/cache-catalogo";

export type CursoDestacado = {
  id: string;
  slug: string;
  titulo: string;
  descripcion: string;
  imagenPortada: string;
  nivel: "BASICO" | "INTERMEDIO" | "AVANZADO";
  totalClases: number;
  duracionTotalSegundos: number;
};

/**
 * El curso que el admin marcó `destacado` (ConfiguracionTab.tsx) y que sigue
 * `mostrado`. El switch no es exclusivo — nada impide marcar dos a la vez —
 * así que ante varios se toma el de menor `orden_visualizacion`, el mismo
 * criterio de desempate que ya usa `buscar_catalogo`
 * (supabase/sql/034_busqueda_catalogo.sql). Sin ninguno marcado, `null`: la
 * landing y el dashboard ocultan la sección en vez de mostrar algo vacío.
 *
 * `totalClases` cuenta TODAS las lecciones del curso, sin filtrar por
 * `estado_procesamiento`, a propósito: es el mismo criterio que ya usa
 * `buscar_catalogo` para `total_clases` (034) — si filtráramos acá por
 * "LISTO" el número mostrado en esta sección no coincidiría con el que ya ve
 * el mismo curso en la tarjeta del catálogo.
 *
 * `duracionTotalSegundos`, en cambio, suma solo las lecciones con video
 * LISTO: es la regla de la ficha del curso (lib/curso.ts) y del certificado
 * (actions/certificados/descargar.ts). Sin video listo, `duracion` no sale
 * de ningún video real, y la portada decía "2 h 7 min" para un curso cuya
 * ficha decía "— de contenido".
 *
 * Una sola consulta (curso con sus módulos y lecciones embebidos) y cacheada
 * por la etiqueta del catálogo (lib/cache-catalogo.ts): es idéntica para todo
 * visitante y cambia cuando un administrador marca, publica u ordena un
 * curso — mutaciones que ya invalidan `TAG_CATALOGO`. Una excepción: el
 * webhook de Mux (api/webhooks/mux) NO invalida al dejar un video en LISTO,
 * así que la duración total puede tardar hasta `REVALIDAR_SEGUNDOS` en
 * reflejarlo. Antes eran dos viajes en serie en CADA visita a la portada y al
 * dashboard.
 *
 * Ante un fallo no se cachea nada (lo que lanza `unstable_cache` se descarta)
 * y la sección se oculta, igual que sin curso destacado: no se muestra un
 * dato inventado ni se guarda el vacío cinco minutos.
 */
export async function getCursoDestacado(): Promise<CursoDestacado | null> {
  try {
    return await cursoDestacadoCacheado();
  } catch (error) {
    unstable_rethrow(error);
    logError("home:curso-destacado", "no se pudo cargar el curso destacado", error, { area: "catalogo" });
    return null;
  }
}

const cursoDestacadoCacheado = unstable_cache(
  async (): Promise<CursoDestacado | null> => {
    // P2-4 (AUDIT-2026-09-15): cliente público (Anon Key, sin cookies) en vez
    // del cookie-bound. Esta consulta ya filtra `mostrado = true`, o sea que
    // devuelve exactamente lo mismo para un anónimo que para cualquier rol —
    // leerla con la sesión del que mira no aportaba nada y ataba el render a
    // `cookies()`. Ojo: NO hacer lo mismo en `getCursoPublico()`
    // (src/lib/curso.ts), que sí depende de `auth.uid()` a propósito.
    const supabase = createPublicClient();

    const { data: curso, error } = await supabase
      .from("cursos")
      .select("id, slug, titulo, descripcion, imagen_portada, nivel, modulos(lecciones(duracion, estado_procesamiento))")
      .eq("destacado", true)
      .eq("mostrado", true)
      .order("orden_visualizacion", { ascending: true })
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();
    lanzarSiFalla(error, "curso destacado");

    if (!curso) return null;

    const lecciones = (curso.modulos ?? []).flatMap((modulo) => modulo.lecciones ?? []);

    return {
      id: curso.id as string,
      slug: curso.slug as string,
      titulo: curso.titulo as string,
      descripcion: curso.descripcion as string,
      imagenPortada: curso.imagen_portada as string,
      nivel: curso.nivel as CursoDestacado["nivel"],
      totalClases: lecciones.length,
      duracionTotalSegundos: lecciones
        .filter((leccion) => leccion.estado_procesamiento === "LISTO")
        .reduce((total, leccion) => total + ((leccion.duracion as number | null) ?? 0), 0),
    };
  },
  ["curso-destacado"],
  { tags: [TAG_CATALOGO], revalidate: REVALIDAR_SEGUNDOS },
);
