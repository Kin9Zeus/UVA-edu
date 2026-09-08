"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { registrarBitacora } from "@/lib/admin/bitacora";
import { logError } from "@/lib/log";
import { ordenEntre, siguienteOrden } from "@/lib/orden";
import { TAMANO_MAXIMO_CONTENIDO, type DocumentoContenido } from "@/lib/editor/tipos";
import { normalizarRespuestaCorta } from "@/lib/examenes/calificar";
import { congelarPreguntas } from "@/lib/examenes/congelar";
import { motivosParaNoPublicarExamen } from "@/lib/examenes/publicacion";
import { construirRevision, type RevisionPregunta } from "@/lib/examenes/revision";
import {
  examenConfiguracionSchema,
  esTipoImplementado,
  MAXIMO_PREGUNTAS_POR_EXAMEN,
  preguntaEntradaSchema,
  type OpcionPregunta,
  type PreguntaCongelada,
  type RespuestasIntento,
  type TipoPreguntaImplementado,
} from "@/lib/examenes/tipos";
import type { AdminActionResult } from "@/actions/admin/categorias";

/**
 * CMS del examen final de un curso (docs/functional-spec.md Flujo 14).
 *
 * Todas estas acciones escriben con el cliente de sesión de `requireAdmin()`,
 * no con el de Service Role: RLS (supabase/sql/067) ya restringe `examenes` y
 * `preguntas_examen` a administradores, así que la política es la red de
 * seguridad real y `requireAdmin()` solo evita el roundtrip y da un mensaje
 * legible. La única excepción es la RPC de reordenamiento, restringida a
 * `service_role` — mismo criterio que moverModulo/moverLeccion.
 */

const idSchema = z.string().uuid("Identificador inválido.");

function primerError(resultado: { success: false; error: z.ZodError }): string {
  return resultado.error.issues[0]?.message ?? "Datos inválidos.";
}

const ENUNCIADO_VACIO: DocumentoContenido = { type: "doc", content: [{ type: "paragraph" }] };

/** Plantilla inicial por tipo, para que "Agregar pregunta" deje algo editable
 * y no un formulario en blanco que no valida. Verdadero/falso llega con sus
 * dos opciones fijas ya puestas: no tiene sentido escribirlas a mano cada vez. */
function opcionesInicialesPara(tipo: TipoPreguntaImplementado): OpcionPregunta[] | null {
  if (tipo === "RELLENAR_ESPACIO") return null;
  if (tipo === "VERDADERO_FALSO") {
    return [
      { id: randomUUID(), texto: "Verdadero", correcta: true },
      { id: randomUUID(), texto: "Falso", correcta: false },
    ];
  }
  return [
    { id: randomUUID(), texto: "", correcta: true },
    { id: randomUUID(), texto: "", correcta: false },
  ];
}

/** Revalida las rutas donde el examen cambia lo que se ve. */
function revalidarExamen(cursoId: string, cursoSlug?: string | null) {
  revalidatePath(`/admin/cursos/${cursoId}`);
  if (cursoSlug) {
    revalidatePath(`/cursos/${cursoSlug}`);
    revalidatePath(`/cursos/${cursoSlug}/examen`);
  }
  revalidatePath("/dashboard/progreso");
}

async function slugDelCurso(supabase: SupabaseClient, cursoId: string): Promise<string | null> {
  const { data } = await supabase.from("cursos").select("slug").eq("id", cursoId).maybeSingle();
  return (data?.slug as string | undefined) ?? null;
}

// ------------------------------------------------------------
// Examen
// ------------------------------------------------------------

/**
 * Crea el examen del curso SIEMPRE en borrador (`publicado = false`).
 *
 * Mismo criterio que `crearCurso`: un examen recién creado no tiene ninguna
 * pregunta, así que publicarlo de entrada solo podría dejar a los estudiantes
 * que ya terminaron las lecciones frente a un examen vacío que no pueden
 * aprobar — y por tanto sin certificado.
 */
export async function crearExamen(cursoId: string): Promise<AdminActionResult & { id?: string }> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };
  if (!idSchema.safeParse(cursoId).success) return { error: "Curso inválido." };

  const { data: curso } = await admin.supabase
    .from("cursos")
    .select("titulo, slug")
    .eq("id", cursoId)
    .maybeSingle();

  if (!curso) return { error: "El curso ya no existe." };

  const { data, error } = await admin.supabase
    .from("examenes")
    .insert({ id_curso: cursoId, titulo: `Examen final — ${curso.titulo}` })
    .select("id")
    .single();

  // El unique de `id_curso` convierte "ya existía" en un 23505; se traduce a
  // un mensaje útil en vez de "no pudimos crear el examen" (pasa si el admin
  // tenía dos pestañas abiertas).
  if (error) {
    return {
      error: error.code === "23505" ? "Este curso ya tiene un examen." : "No pudimos crear el examen.",
    };
  }

  await registrarBitacora(admin.supabase, {
    idAdmin: admin.adminId,
    accion: "Creó el examen final de un curso",
    entidadAfectada: "examenes",
    idEntidadAfectada: data.id,
    detalles: curso.titulo,
  });

  revalidarExamen(cursoId, curso.slug);
  return { success: true, id: data.id };
}

export async function actualizarConfiguracionExamen(
  examenId: string,
  cursoId: string,
  input: {
    titulo: string;
    instrucciones: DocumentoContenido | null;
    notaAprobatoria: number;
    intentosMaximos: number | null;
    minutosLimite: number | null;
    aleatorizarPreguntas: boolean;
    aleatorizarOpciones: boolean;
  },
): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };
  if (!idSchema.safeParse(examenId).success) return { error: "Examen inválido." };

  if (input.instrucciones && JSON.stringify(input.instrucciones).length > TAMANO_MAXIMO_CONTENIDO) {
    return { error: "Las instrucciones del examen son demasiado largas." };
  }

  const parseo = examenConfiguracionSchema.safeParse(input);
  if (!parseo.success) return { error: primerError(parseo) };
  const config = parseo.data;

  const { error } = await admin.supabase
    .from("examenes")
    .update({
      titulo: config.titulo,
      instrucciones: config.instrucciones,
      nota_aprobatoria: config.notaAprobatoria,
      intentos_maximos: config.intentosMaximos,
      minutos_limite: config.minutosLimite,
      aleatorizar_preguntas: config.aleatorizarPreguntas,
      aleatorizar_opciones: config.aleatorizarOpciones,
    })
    .eq("id", examenId);

  // 23514 = check constraint. La única que puede saltar acá es
  // `examenes_nota_aprobatoria_minima`, y solo si alguien llama la acción
  // directamente saltándose el schema de Zod.
  if (error) {
    return {
      error:
        error.code === "23514"
          ? "La nota para aprobar debe estar entre 75% y 100%."
          : "No pudimos guardar la configuración del examen.",
    };
  }

  revalidarExamen(cursoId, await slugDelCurso(admin.supabase, cursoId));
  return { success: true };
}

/**
 * Publica o despublica el examen.
 *
 * Publicar es la acción que de verdad cambia la regla de certificación del
 * curso (a partir de acá, terminar las lecciones ya no basta), así que se
 * valida contra `motivosParaNoPublicarExamen` en el servidor: la UI también
 * deshabilita el interruptor, pero esa comprobación es cortesía.
 *
 * Despublicar siempre se puede, incluso un examen incompleto — es la vía de
 * escape si algo salió mal en producción, igual que con `cursos.mostrado`.
 * A quien ya lo aprobó no le pasa nada: su certificado ya está emitido y no se
 * revoca (Revf3).
 */
export async function alternarPublicacionExamen(
  examenId: string,
  cursoId: string,
  publicado: boolean,
): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };
  if (!idSchema.safeParse(examenId).success) return { error: "Examen inválido." };
  if (typeof publicado !== "boolean") return { error: "Datos inválidos." };

  if (publicado) {
    const { data: examen } = await admin.supabase
      .from("examenes")
      .select("titulo, nota_aprobatoria, preguntas_examen(tipo, puntos)")
      .eq("id", examenId)
      .maybeSingle();

    if (!examen) return { error: "El examen ya no existe." };

    const motivos = motivosParaNoPublicarExamen({
      titulo: examen.titulo,
      notaAprobatoria: examen.nota_aprobatoria,
      preguntas: (examen.preguntas_examen ?? [])
        .filter((pregunta) => esTipoImplementado(pregunta.tipo))
        .map((pregunta) => ({
          tipo: pregunta.tipo as TipoPreguntaImplementado,
          puntos: pregunta.puntos as number,
        })),
    });

    if (motivos.length > 0) {
      return { error: `No se puede publicar todavía: ${motivos.join(" ")}` };
    }
  }

  const { error } = await admin.supabase.from("examenes").update({ publicado }).eq("id", examenId);
  if (error) return { error: "No pudimos actualizar el examen." };

  const { data: cursoDelExamen } = await admin.supabase
    .from("cursos")
    .select("titulo")
    .eq("id", cursoId)
    .maybeSingle();

  await registrarBitacora(admin.supabase, {
    idAdmin: admin.adminId,
    accion: publicado
      ? "Publicó el examen final de un curso (pasa a ser obligatorio para certificar)"
      : "Despublicó el examen final de un curso (deja de ser obligatorio)",
    entidadAfectada: "examenes",
    idEntidadAfectada: examenId,
    detalles: cursoDelExamen?.titulo ?? null,
  });

  revalidarExamen(cursoId, await slugDelCurso(admin.supabase, cursoId));
  return { success: true };
}

/**
 * Elimina el examen completo (y sus preguntas, por cascade).
 *
 * Bloqueado si ya hay intentos: son la evidencia de que alguien rindió, y
 * `intentos_examen.id_examen` es ON DELETE CASCADE — borrar el examen los
 * borraría en silencio. Mismo criterio que `eliminarCurso` con las
 * inscripciones: se ofrece despublicar en su lugar.
 */
export async function eliminarExamen(examenId: string, cursoId: string): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };
  if (!idSchema.safeParse(examenId).success) return { error: "Examen inválido." };

  const { count, error: errorConteo } = await admin.supabase
    .from("intentos_examen")
    .select("id", { count: "exact", head: true })
    .eq("id_examen", examenId);

  if (errorConteo) return { error: "No pudimos verificar los intentos del examen." };
  if ((count ?? 0) > 0) {
    return {
      error:
        "Este examen ya tiene intentos de estudiantes. No se puede eliminar — despublícalo en vez de borrarlo.",
    };
  }

  const { data: cursoDelExamen } = await admin.supabase
    .from("cursos")
    .select("titulo")
    .eq("id", cursoId)
    .maybeSingle();

  const { error } = await admin.supabase.from("examenes").delete().eq("id", examenId);
  if (error) return { error: "No pudimos eliminar el examen." };

  await registrarBitacora(admin.supabase, {
    idAdmin: admin.adminId,
    accion: "Eliminó el examen final de un curso",
    entidadAfectada: "examenes",
    idEntidadAfectada: examenId,
    detalles: cursoDelExamen?.titulo ?? null,
  });

  revalidarExamen(cursoId, await slugDelCurso(admin.supabase, cursoId));
  return { success: true };
}

// ------------------------------------------------------------
// Preguntas
// ------------------------------------------------------------

export async function crearPregunta(
  examenId: string,
  cursoId: string,
  tipo: TipoPreguntaImplementado,
): Promise<AdminActionResult & { id?: string }> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };
  if (!idSchema.safeParse(examenId).success) return { error: "Examen inválido." };
  if (!esTipoImplementado(tipo)) return { error: "Tipo de pregunta no válido." };

  const { count } = await admin.supabase
    .from("preguntas_examen")
    .select("id", { count: "exact", head: true })
    .eq("id_examen", examenId);

  if ((count ?? 0) >= MAXIMO_PREGUNTAS_POR_EXAMEN) {
    return { error: `Un examen no puede tener más de ${MAXIMO_PREGUNTAS_POR_EXAMEN} preguntas.` };
  }

  const { data: ultima } = await admin.supabase
    .from("preguntas_examen")
    .select("orden")
    .eq("id_examen", examenId)
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await admin.supabase
    .from("preguntas_examen")
    .insert({
      id_examen: examenId,
      tipo,
      enunciado: ENUNCIADO_VACIO,
      orden: siguienteOrden(ultima?.orden ?? null),
      opciones: opcionesInicialesPara(tipo),
      respuestas_aceptadas: [],
    })
    .select("id")
    .single();

  if (error) return { error: "No pudimos crear la pregunta." };

  revalidarExamen(cursoId, await slugDelCurso(admin.supabase, cursoId));
  return { success: true, id: data.id };
}

export async function actualizarPregunta(
  preguntaId: string,
  cursoId: string,
  input: {
    tipo: TipoPreguntaImplementado;
    enunciado: DocumentoContenido;
    puntos: number;
    opciones: OpcionPregunta[] | null;
    respuestasAceptadas: string[];
    explicacion: DocumentoContenido | null;
  },
): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };
  if (!idSchema.safeParse(preguntaId).success) return { error: "Pregunta inválida." };

  if (JSON.stringify(input.enunciado ?? {}).length > TAMANO_MAXIMO_CONTENIDO) {
    return { error: "El enunciado de la pregunta es demasiado largo." };
  }

  const parseo = preguntaEntradaSchema.safeParse(input);
  if (!parseo.success) return { error: primerError(parseo) };
  const pregunta = parseo.data;

  // Dos variantes que normalizan igual ("V-Ray" y "vray") no aportan nada:
  // `calificarPregunta` las compara ya normalizadas, así que la segunda es
  // ruido. Se deduplica conservando el texto tal como lo escribió el admin
  // (es lo que verá en el editor), no la forma normalizada.
  const vistas = new Set<string>();
  const respuestasAceptadas = pregunta.respuestasAceptadas.filter((respuesta) => {
    const clave = normalizarRespuestaCorta(respuesta);
    if (clave === "" || vistas.has(clave)) return false;
    vistas.add(clave);
    return true;
  });

  if (pregunta.tipo === "RELLENAR_ESPACIO" && respuestasAceptadas.length === 0) {
    return { error: "Escribe al menos una respuesta aceptada para la pregunta de respuesta corta." };
  }

  const { error } = await admin.supabase
    .from("preguntas_examen")
    .update({
      tipo: pregunta.tipo,
      enunciado: pregunta.enunciado,
      puntos: pregunta.puntos,
      // Una pregunta de respuesta corta no tiene opciones y viceversa: se
      // limpia el campo del otro tipo al cambiar de tipo, para no dejar datos
      // huérfanos que confundan al siguiente que edite la pregunta.
      opciones: pregunta.tipo === "RELLENAR_ESPACIO" ? null : pregunta.opciones,
      respuestas_aceptadas: pregunta.tipo === "RELLENAR_ESPACIO" ? respuestasAceptadas : [],
      explicacion: pregunta.explicacion,
    })
    .eq("id", preguntaId);

  if (error) return { error: "No pudimos guardar la pregunta." };

  revalidarExamen(cursoId, await slugDelCurso(admin.supabase, cursoId));
  return { success: true };
}

export async function eliminarPregunta(
  preguntaId: string,
  cursoId: string,
): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };
  if (!idSchema.safeParse(preguntaId).success) return { error: "Pregunta inválida." };

  const { error } = await admin.supabase.from("preguntas_examen").delete().eq("id", preguntaId);
  if (error) return { error: "No pudimos eliminar la pregunta." };

  revalidarExamen(cursoId, await slugDelCurso(admin.supabase, cursoId));
  return { success: true };
}

/**
 * Mueve una pregunta entre `idAnterior` e `idSiguiente`. Camino feliz: una
 * sola escritura del `orden` fraccionado. Si no queda hueco, reespacia el
 * examen completo en una sola sentencia transaccional (RPC
 * `reespaciar_orden_preguntas`, supabase/sql/067) — mismo mecanismo que el
 * temario del curso.
 */
export async function moverPregunta(
  examenId: string,
  cursoId: string,
  preguntaId: string,
  idAnterior: string | null,
  idSiguiente: string | null,
): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };
  if (!idSchema.safeParse(examenId).success) return { error: "Examen inválido." };
  if (!idSchema.safeParse(preguntaId).success) return { error: "Pregunta inválida." };
  if (idAnterior !== null && !idSchema.safeParse(idAnterior).success) return { error: "Datos inválidos." };
  if (idSiguiente !== null && !idSchema.safeParse(idSiguiente).success) return { error: "Datos inválidos." };

  const idsVecinos = [idAnterior, idSiguiente].filter((id): id is string => id !== null);
  const { data: vecinos } = idsVecinos.length
    ? await admin.supabase.from("preguntas_examen").select("id, orden").in("id", idsVecinos)
    : { data: [] };

  const ordenDe = (id: string | null) =>
    id ? (vecinos ?? []).find((vecino) => vecino.id === id)?.orden ?? null : null;
  const nuevoOrden = ordenEntre(ordenDe(idAnterior), ordenDe(idSiguiente));

  if (nuevoOrden !== null) {
    const { error } = await admin.supabase
      .from("preguntas_examen")
      .update({ orden: nuevoOrden })
      .eq("id", preguntaId);
    if (error) return { error: "No pudimos guardar el nuevo orden de las preguntas." };
  } else {
    const { data: resto } = await admin.supabase
      .from("preguntas_examen")
      .select("id")
      .eq("id_examen", examenId)
      .neq("id", preguntaId)
      .order("orden");

    const ordenadas = resto ?? [];
    const indiceDestino = idAnterior ? ordenadas.findIndex((p) => p.id === idAnterior) + 1 : 0;
    ordenadas.splice(indiceDestino, 0, { id: preguntaId });

    const { error } = await createAdminClient().rpc("reespaciar_orden_preguntas", {
      p_examen_id: examenId,
      p_ids: ordenadas.map((pregunta) => pregunta.id),
    });
    if (error) return { error: "No pudimos guardar el nuevo orden de las preguntas." };
  }

  revalidarExamen(cursoId, await slugDelCurso(admin.supabase, cursoId));
  return { success: true };
}

// ------------------------------------------------------------
// Intento extra (estudiante que agotó los suyos sin aprobar)
// ------------------------------------------------------------

/**
 * Le crea a un estudiante puntual un intento adicional, por encima de
 * `intentos_maximos`.
 *
 * No existe ningún camino para que el ESTUDIANTE se dé a sí mismo más
 * intentos — eso violaría el límite que el propio admin configuró. Esta
 * acción es la única forma de destrabar a alguien que agotó los suyos sin
 * aprobar (ver `EstudianteAgotado` en lib/admin/examenDetalle.ts), y por eso
 * exige rol ADMINISTRADOR igual que el resto del CMS del examen.
 *
 * Crea el intento con Service Role, exactamente como `iniciarIntento`
 * (src/actions/examenes/intento.ts) — misma congelación de preguntas, mismo
 * cálculo de `expira_en` — pero SIN pasar por el chequeo de
 * `intentos_maximos` de esa función: es justo la regla que este botón existe
 * para saltarse, a propósito y una vez, no una relajación general del límite.
 */
export async function otorgarIntentoExtra(
  examenId: string,
  cursoId: string,
  usuarioId: string,
): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };
  if (!idSchema.safeParse(examenId).success) return { error: "Examen inválido." };
  if (!idSchema.safeParse(usuarioId).success) return { error: "Estudiante inválido." };

  const { data: examen } = await admin.supabase
    .from("examenes")
    .select("nota_aprobatoria, minutos_limite, aleatorizar_preguntas, aleatorizar_opciones")
    .eq("id", examenId)
    .maybeSingle();
  if (!examen) return { error: "El examen ya no existe." };

  const { data: intentosPrevios } = await admin.supabase
    .from("intentos_examen")
    .select("estado")
    .eq("id_examen", examenId)
    .eq("id_usuario", usuarioId);

  if ((intentosPrevios ?? []).some((intento) => intento.estado === "APROBADO")) {
    return { error: "Este estudiante ya aprobó el examen." };
  }
  // El índice parcial `intentos_examen_uno_en_curso` lo rechazaría igual,
  // pero este mensaje es más claro que el 23505 crudo de Postgres.
  if ((intentosPrevios ?? []).some((intento) => intento.estado === "EN_CURSO")) {
    return { error: "Este estudiante ya tiene un intento en curso." };
  }

  const preguntas = await congelarPreguntas(
    examenId,
    examen.aleatorizar_preguntas,
    examen.aleatorizar_opciones,
  );
  if (preguntas.length === 0) {
    return { error: "El examen no tiene preguntas." };
  }

  const expiraEn =
    examen.minutos_limite === null
      ? null
      : new Date(Date.now() + examen.minutos_limite * 60_000).toISOString();

  const { error: errorIntento } = await createAdminClient().from("intentos_examen").insert({
    id_examen: examenId,
    id_usuario: usuarioId,
    nota_requerida: examen.nota_aprobatoria,
    preguntas_congeladas: preguntas,
    respuestas: {},
    expira_en: expiraEn,
  });
  if (errorIntento) return { error: "No pudimos crear el intento extra." };

  const [{ data: estudiante }, { data: cursoDelExamen }] = await Promise.all([
    admin.supabase.from("perfiles").select("nombre").eq("id", usuarioId).maybeSingle(),
    admin.supabase.from("cursos").select("titulo").eq("id", cursoId).maybeSingle(),
  ]);

  await registrarBitacora(admin.supabase, {
    idAdmin: admin.adminId,
    accion: "Otorgó un intento extra de examen final",
    entidadAfectada: "intentos_examen",
    idEntidadAfectada: usuarioId,
    detalles: cursoDelExamen?.titulo
      ? `${estudiante?.nombre ?? usuarioId} — ${cursoDelExamen.titulo}`
      : (estudiante?.nombre ?? usuarioId),
  });

  revalidarExamen(cursoId, await slugDelCurso(admin.supabase, cursoId));
  return { success: true };
}

// ------------------------------------------------------------
// Revisión de un intento (admin ve dónde falló el estudiante)
// ------------------------------------------------------------

export type RevisionIntentoResultado = {
  id: string;
  estudianteNombre: string;
  estado: "EN_CURSO" | "APROBADO" | "REPROBADO" | "EN_REVISION";
  puntajePct: number | null;
  notaRequerida: number;
  iniciadoEn: string;
  finalizadoEn: string | null;
  preguntas: RevisionPregunta[];
};

/**
 * Detalle pregunta por pregunta de un intento — a diferencia de lo que ve el
 * propio estudiante (`getResultadoIntento`, src/lib/examen.ts, que NUNCA
 * revela la respuesta correcta), esta sí la incluye: es la vista que le
 * permite al admin entender en qué se está equivocando el estudiante.
 *
 * Se pide bajo demanda (al expandir un intento en el panel), no precalculada
 * para todos los intentos del examen: `preguntas_congeladas` puede pesar
 * bastante por intento y la mayoría de las veces el admin solo revisa unos
 * pocos, no todos.
 *
 * Por qué la consulta NO usa `admin.supabase` (P0-1, AUDIT-2026-09-08)
 * --------------------------------------------------------------------
 * `requireAdmin()` verifica el rol pero devuelve el cliente de SESIÓN, y una
 * sesión de administrador sigue hablando con Postgres como `authenticated`.
 * El GRANT por columna de `supabase/sql/070` le quitó a ese rol el SELECT
 * sobre `preguntas_congeladas` —es lo que impide que un estudiante se lea la
 * solución yendo directo a PostgREST— y no distingue quién es: sin el
 * cambio a Service Role, esta pantalla se caía con 42501 para el admin
 * también.
 *
 * La autorización no se debilita: `requireAdmin()` de arriba ya la resolvió
 * entera, y era él quien decidía, no la policy. Lo que se pierde al saltarse
 * RLS aquí es una segunda comprobación del MISMO hecho que ya se comprobó
 * tres líneas antes.
 */
export async function getRevisionIntento(
  intentoId: string,
): Promise<RevisionIntentoResultado | { error: string }> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error ?? "No tienes permisos de administrador." };
  if (!idSchema.safeParse(intentoId).success) return { error: "Intento inválido." };

  const { data: intento, error } = await createAdminClient()
    .from("intentos_examen")
    .select(
      "id, estado, puntaje_pct, nota_requerida, preguntas_congeladas, respuestas, iniciado_en, finalizado_en, usuario:perfiles(nombre)",
    )
    .eq("id", intentoId)
    .maybeSingle();

  // Aquí NO se lanza, al revés que en getIntentoEnCurso (src/lib/examen.ts).
  // Esto es un Server Action y `IntentoRevisionDialog` lo consume con
  // `.then()` sin `.catch()`: una excepción no llegaría al boundary de
  // error.tsx —que solo cubre lo que falla al renderizar— sino que acabaría
  // como unhandled rejection en el navegador, que es peor que lo que había.
  //
  // Se registra y se devuelve un mensaje que no miente. "No encontramos ese
  // intento" era falso y caro: el intento existe, lo que falla es la consulta,
  // y ese mensaje manda a buscar un problema de datos en vez de uno de
  // servidor. logError conserva el code/hint/details de Postgres aunque un
  // PostgrestError sea un objeto plano y no un Error.
  if (error) {
    logError("admin/examenes", "getRevisionIntento: la consulta del intento falló", error, {
      area: "examenes",
      intentoId,
    });
    return { error: "No pudimos cargar la revisión. El error quedó registrado." };
  }

  if (!intento) return { error: "No encontramos ese intento." };
  if (intento.estado === "EN_CURSO") {
    return { error: "Este intento todavía está en curso; no hay nada que revisar." };
  }

  const usuario = Array.isArray(intento.usuario) ? intento.usuario[0] : intento.usuario;
  const congeladas = (intento.preguntas_congeladas ?? []) as PreguntaCongelada[];
  const respuestas = (intento.respuestas ?? {}) as RespuestasIntento;

  return {
    id: intento.id,
    estudianteNombre: usuario?.nombre ?? "Usuario eliminado",
    estado: intento.estado,
    puntajePct: intento.puntaje_pct === null ? null : Number(intento.puntaje_pct),
    notaRequerida: intento.nota_requerida,
    iniciadoEn: intento.iniciado_en,
    finalizadoEn: intento.finalizado_en,
    preguntas: construirRevision(congeladas, respuestas),
  };
}
