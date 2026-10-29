import { createClient } from "@/lib/supabase/server";
import { lanzarSiFalla } from "@/lib/supabase/errores";
import { diaEnColombia, inicioDelDia, sumarDias } from "@/lib/admin/bitacora";
import { lunesDe, semanasRecientes } from "@/lib/admin/semanas";
import type { SemanaGrafica } from "@/lib/admin/grafica";
import { CATEGORIAS_COMUNIDAD, type CategoriaComunidad } from "@/lib/comunidad-tipos";

const DIAS_CIFRAS = 30;

/**
 * `porSerie` lleva "publicaciones" y "respuestas"; `porCategoria` suma las dos:
 * es el detalle de la semana, no una serie.
 */
export type SemanaActividad = SemanaGrafica & { porCategoria: Record<CategoriaComunidad, number> };

export type ResumenComunidad = {
  semanas: SemanaActividad[];
  publicaciones30: number;
  respuestas30: number;
  /** Personas distintas que publicaron o respondieron en 30 días. */
  personas30: number;
  eliminados30: number;
  dejados30: number;
};

export type Mensaje = { idUsuario: string; categoria: CategoriaComunidad | null; creadoEn: string };

/** Agrupa publicaciones y respuestas en semanas y cifras. Pura para poder probarla sin base. */
export function resumirActividadComunidad(
  publicaciones: Mensaje[],
  respuestas: Mensaje[],
  ahora: Date = new Date(),
): Omit<ResumenComunidad, "eliminados30" | "dejados30"> {
  const { semanas: vacias, primerLunes } = semanasRecientes(ahora);
  const desdeCifras = sumarDias(diaEnColombia(ahora), -(DIAS_CIFRAS - 1));
  const semanas: SemanaActividad[] = vacias.map((semana) => ({
    ...semana,
    porCategoria: Object.fromEntries(CATEGORIAS_COMUNIDAD.map((c) => [c, 0])) as Record<CategoriaComunidad, number>,
  }));
  const indice = new Map(semanas.map((s, i) => [s.inicio, i]));
  const personas = new Set<string>();
  const cuenta = { publicaciones: 0, respuestas: 0 };

  for (const [serie, mensajes] of [["publicaciones", publicaciones], ["respuestas", respuestas]] as const) {
    for (const mensaje of mensajes) {
      const dia = diaEnColombia(mensaje.creadoEn);
      if (dia >= desdeCifras) {
        cuenta[serie] += 1;
        personas.add(mensaje.idUsuario);
      }
      if (dia < primerLunes) continue;
      const semana = semanas[indice.get(lunesDe(dia)) ?? -1];
      if (!semana) continue;
      semana.porSerie[serie] = (semana.porSerie[serie] ?? 0) + 1;
      semana.total += 1;
      if (mensaje.categoria) semana.porCategoria[mensaje.categoria] += 1;
    }
  }

  return { semanas, publicaciones30: cuenta.publicaciones, respuestas30: cuenta.respuestas, personas30: personas.size };
}

/**
 * Actividad de 12 semanas y las decisiones de moderación de 30 días. Cuenta
 * también lo que después se eliminó: ese día sí hubo actividad.
 */
export async function getResumenComunidad(): Promise<ResumenComunidad> {
  const supabase = await createClient();
  const ahora = new Date();
  const { primerLunes } = semanasRecientes(ahora);
  const desde = inicioDelDia(primerLunes);
  const desdeModeracion = inicioDelDia(sumarDias(diaEnColombia(ahora), -(DIAS_CIFRAS - 1)));

  // ponytail: trae cada publicación y respuesta de 12 semanas; con miles por
  // semana, agrupar en una vista o RPC.
  // Las decisiones salen de la bitácora: eliminar y descartar ya la escriben,
  // y los reportes no guardan cuándo se cerraron.
  const contarModeracion = (verbo: string) =>
    supabase
      .from("bitacora_administrativa")
      .select("id", { count: "exact", head: true })
      .in("entidad_afectada", ["comunidad_posts", "comunidad_reportes"])
      .like("accion", `${verbo}%Comunidad%`)
      .gte("creado_en", desdeModeracion);
  const [posts, respuestas, eliminados, dejados] = await Promise.all([
    supabase.from("comunidad_posts").select("id_usuario, categoria, creado_en").gte("creado_en", desde),
    supabase.from("comunidad_respuestas").select("id_usuario, creado_en, post:comunidad_posts(categoria)").gte("creado_en", desde),
    contarModeracion("Eliminó"),
    contarModeracion("Descartó"),
  ]);
  lanzarSiFalla(posts.error, "comunidad:actividad_posts");
  lanzarSiFalla(respuestas.error, "comunidad:actividad_respuestas");
  lanzarSiFalla(eliminados.error ?? dejados.error, "comunidad:moderacion_30_dias");

  const actividad = resumirActividadComunidad(
    (posts.data ?? []).map((p) => ({ idUsuario: p.id_usuario, categoria: p.categoria, creadoEn: p.creado_en })),
    (respuestas.data ?? []).map((r) => {
      // PostgREST tipa el embebido como arreglo aunque sea muchos-a-uno.
      const post = (Array.isArray(r.post) ? r.post[0] : r.post) as { categoria: CategoriaComunidad } | null;
      return { idUsuario: r.id_usuario, categoria: post?.categoria ?? null, creadoEn: r.creado_en };
    }),
    ahora,
  );
  return { ...actividad, eliminados30: eliminados.count ?? 0, dejados30: dejados.count ?? 0 };
}
