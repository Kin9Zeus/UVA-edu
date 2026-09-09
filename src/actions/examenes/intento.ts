"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { calificarIntento } from "@/lib/examenes/calificar";
import { congelarPreguntas } from "@/lib/examenes/congelar";
import { calcularDisponibilidad } from "@/lib/examen";
import {
  respuestasIntentoSchema,
  TOLERANCIA_TIEMPO_SEGUNDOS,
  type PreguntaCongelada,
  type RespuestasIntento,
} from "@/lib/examenes/tipos";

/**
 * Rendir un examen final (docs/functional-spec.md Flujo 14).
 *
 * Por qué acá se usa el cliente de Service Role y no el de sesión
 * ---------------------------------------------------------------
 * En el resto del proyecto la regla es al revés: `progreso`, `comentarios` y
 * `perfiles` se escriben con el cliente de sesión para que RLS sea quien
 * autoriza. Acá no se puede, y no es una comodidad: el dato que hay que
 * escribir —`estado` y `puntaje_pct` del intento— es exactamente el dato que
 * el estudiante querría falsificar. Cualquier política que le permitiera
 * escribir su propia fila le permitiría también hacer
 * `PATCH /rest/v1/intentos_examen` con {"estado":"APROBADO"} y emitirse el
 * certificado (el trigger de 067 confía en `estado`).
 *
 * Por eso `intentos_examen` no tiene NINGUNA política de escritura
 * (supabase/sql/067) y todas las mutaciones pasan por acá. A cambio, este
 * módulo asume la carga de autorizar a mano, y lo hace en dos capas:
 *
 *   · las lecturas de AUTORIZACIÓN usan el cliente de SESIÓN, para que RLS
 *     siga siendo quien decide si este estudiante puede ver este examen
 *     (publicado + acceso vigente al curso). Si RLS no le devuelve el examen,
 *     acá no hay nada que hacer;
 *   · las ESCRITURAS usan Service Role, y siempre filtrando por el
 *     `id_usuario` que salió de `auth.getUser()` — nunca por uno que venga
 *     del cliente.
 */

export type IntentoActionResult = { error?: string; success?: boolean; intentoId?: string };

/** Sesión válida + id de usuario, o el error listo para devolver. */
async function requireEstudiante() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Tu sesión expiró. Vuelve a iniciar sesión." } as const;
  return { supabase, usuarioId: user.id } as const;
}

/**
 * Inicia un intento del examen final del curso.
 *
 * Verifica, en este orden: que el examen exista y sea visible para este
 * estudiante (RLS), que no lo haya aprobado ya, que no tenga otro intento
 * abierto, que haya terminado todas las lecciones, que le queden intentos y
 * que haya pasado el tiempo de espera desde el último fallido.
 */
export async function iniciarIntento(cursoId: string): Promise<IntentoActionResult> {
  const sesion = await requireEstudiante();
  if ("error" in sesion) return { error: sesion.error };
  const { supabase, usuarioId } = sesion;

  // Cliente de SESIÓN: RLS solo devuelve la fila si el examen está publicado y
  // el estudiante tiene acceso vigente al curso. Es el chequeo de acceso.
  const { data: examen } = await supabase
    .from("examenes")
    .select("id, nota_aprobatoria, intentos_maximos, minutos_limite, aleatorizar_preguntas, aleatorizar_opciones")
    .eq("id_curso", cursoId)
    .maybeSingle();

  if (!examen) return { error: "Este curso no tiene un examen disponible." };

  const { data: intentos } = await supabase
    .from("intentos_examen")
    .select("id, estado, finalizado_en")
    .eq("id_examen", examen.id)
    .eq("id_usuario", usuarioId)
    .order("iniciado_en", { ascending: false });

  const previos = intentos ?? [];

  if (previos.some((intento) => intento.estado === "APROBADO")) {
    return { error: "Ya aprobaste este examen." };
  }

  // Retomar en vez de crear otro: es también lo que impide gastar dos
  // intentos por abrir dos pestañas (el índice parcial
  // `intentos_examen_uno_en_curso` es la red de seguridad si dos peticiones
  // llegan a la vez).
  const abierto = previos.find((intento) => intento.estado === "EN_CURSO");
  if (abierto) return { success: true, intentoId: abierto.id };

  // Misma función que usa el trigger de certificación — la regla de "terminó
  // todas las lecciones" no se reimplementa acá.
  const { data: leccionesCompletas } = await supabase.rpc("lecciones_completas_curso", {
    p_id_curso: cursoId,
  });

  if (leccionesCompletas !== true) {
    return { error: "Termina todas las clases del curso antes de presentar el examen." };
  }

  // `intentos_maximos` no es un tope de por vida: es el tamaño de una ronda.
  // `calcularDisponibilidad` decide si toca esperar los 15 minutos normales
  // entre intentos o las COOLDOWN_AGOTADO_HORAS de agotar la ronda completa
  // — la misma función que usa `getSituacionExamen` para la pantalla previa,
  // así que nunca pueden divergir sobre cuándo se habilita el botón.
  const cerrados = previos.filter((intento) => intento.estado !== "EN_CURSO");
  const disponibilidad = calcularDisponibilidad(
    cerrados.map((intento) => ({ finalizadoEn: intento.finalizado_en })),
    examen.intentos_maximos,
  );

  if (!disponibilidad.disponible) {
    const hora = disponibilidad.disponibleDesde.toLocaleTimeString("es-CO", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Bogota",
    });
    return {
      error: disponibilidad.esperaLarga
        ? `Agotaste tus intentos de esta tanda. Podrás intentarlo de nuevo a partir de las ${hora}.`
        : `Puedes volver a intentarlo a partir de las ${hora}.`,
    };
  }

  const preguntas = await congelarPreguntas(
    examen.id,
    examen.aleatorizar_preguntas,
    examen.aleatorizar_opciones,
  );

  if (preguntas.length === 0) {
    return { error: "El examen todavía no tiene preguntas. Escríbenos si el problema continúa." };
  }

  // `expira_en` se calcula y se guarda ahora: si el admin cambia
  // `minutos_limite` mientras alguien rinde, el intento en curso conserva el
  // plazo con el que empezó.
  const expiraEn =
    examen.minutos_limite === null
      ? null
      : new Date(Date.now() + examen.minutos_limite * 60_000).toISOString();

  const { data: creado, error } = await createAdminClient()
    .from("intentos_examen")
    .insert({
      id_examen: examen.id,
      id_usuario: usuarioId,
      // Congelado igual que las preguntas: subir la exigencia del examen no
      // debe cambiar el resultado de un intento ya empezado.
      nota_requerida: examen.nota_aprobatoria,
      preguntas_congeladas: preguntas,
      respuestas: {},
      expira_en: expiraEn,
    })
    .select("id")
    .single();

  if (error) {
    // 23505 sobre el índice parcial: dos peticiones simultáneas: la otra ya
    // creó el intento, así que no es un error para el estudiante.
    if (error.code === "23505") {
      const { data: existente } = await supabase
        .from("intentos_examen")
        .select("id")
        .eq("id_examen", examen.id)
        .eq("id_usuario", usuarioId)
        .eq("estado", "EN_CURSO")
        .maybeSingle();
      if (existente) return { success: true, intentoId: existente.id };
    }
    return { error: "No pudimos iniciar el examen. Intenta de nuevo." };
  }

  return { success: true, intentoId: creado.id };
}

/**
 * Autoguardado de respuestas. Se llama en cada cambio, así que no revalida
 * ninguna ruta — mismo criterio que `guardarSegundoActual` del reproductor.
 *
 * Solo escribe `respuestas`: nunca toca `estado` ni `puntaje_pct`, que son
 * exclusivos de `enviarIntento`.
 */
export async function guardarRespuestas(
  intentoId: string,
  respuestas: RespuestasIntento,
): Promise<{ ok: boolean }> {
  const sesion = await requireEstudiante();
  if ("error" in sesion) return { ok: false };
  const { usuarioId } = sesion;

  const parseo = respuestasIntentoSchema.safeParse(respuestas);
  if (!parseo.success) return { ok: false };

  // El filtro por `id_usuario` y por `estado` va en el propio UPDATE: con
  // Service Role no hay RLS que lo haga, así que es lo único que impide
  // escribir en el intento de otra persona o reabrir uno ya calificado.
  const { error, count } = await createAdminClient()
    .from("intentos_examen")
    .update({ respuestas: parseo.data }, { count: "exact" })
    .eq("id", intentoId)
    .eq("id_usuario", usuarioId)
    .eq("estado", "EN_CURSO");

  return { ok: !error && (count ?? 0) > 0 };
}

export type EnvioResultado = {
  error?: string;
  success?: boolean;
  aprobado?: boolean;
  puntajePct?: number;
  /** true si el envío lo forzó el vencimiento del tiempo, no el estudiante. */
  porTiempo?: boolean;
};

/**
 * Cierra el intento y lo califica.
 *
 * La calificación corre entera en el servidor sobre `preguntas_congeladas`
 * (que sí tiene las respuestas correctas). Nada de lo que mande el cliente se
 * usa como puntaje: solo sus respuestas.
 */
export async function enviarIntento(
  intentoId: string,
  respuestas: RespuestasIntento,
): Promise<EnvioResultado> {
  const sesion = await requireEstudiante();
  if ("error" in sesion) return { error: sesion.error };
  const { usuarioId } = sesion;

  const parseo = respuestasIntentoSchema.safeParse(respuestas);
  if (!parseo.success) return { error: "Respuestas inválidas." };

  const admin = createAdminClient();

  const { data: intento } = await admin
    .from("intentos_examen")
    .select("id, id_usuario, estado, nota_requerida, preguntas_congeladas, respuestas, expira_en, examen:examenes(id_curso)")
    .eq("id", intentoId)
    .maybeSingle();

  if (!intento || intento.id_usuario !== usuarioId) {
    return { error: "No encontramos ese intento." };
  }
  if (intento.estado !== "EN_CURSO") {
    return { error: "Este intento ya fue enviado." };
  }

  // Tiempo agotado: el intento se cierra igual, calificando lo que alcanzó a
  // responder ANTES del vencimiento (lo ya autoguardado), no lo que llegue en
  // este envío tardío. Sin esa distinción, dejar la pestaña abierta y enviar
  // media hora después equivaldría a no tener límite de tiempo.
  const vencido =
    intento.expira_en !== null &&
    Date.now() > new Date(intento.expira_en).getTime() + TOLERANCIA_TIEMPO_SEGUNDOS * 1000;

  const respuestasFinales = vencido
    ? ((intento.respuestas ?? {}) as RespuestasIntento)
    : parseo.data;

  const preguntas = (intento.preguntas_congeladas ?? []) as PreguntaCongelada[];
  const resultado = calificarIntento(preguntas, respuestasFinales, intento.nota_requerida);

  // El UPDATE repite el filtro por estado: si dos envíos llegan a la vez (el
  // botón y el auto-envío por tiempo), el segundo no reescribe la nota del
  // primero — afecta 0 filas y sale por el camino de abajo.
  const { error, count } = await admin
    .from("intentos_examen")
    .update(
      {
        estado: resultado.aprobado ? "APROBADO" : "REPROBADO",
        puntaje_pct: resultado.puntajePct,
        respuestas: respuestasFinales,
        finalizado_en: new Date().toISOString(),
      },
      { count: "exact" },
    )
    .eq("id", intentoId)
    .eq("id_usuario", usuarioId)
    .eq("estado", "EN_CURSO")
    .select("id");

  if (error) return { error: "No pudimos registrar tus respuestas. Intenta de nuevo." };
  if ((count ?? 0) === 0) return { error: "Este intento ya fue enviado." };

  // Si aprobó, el trigger `intento_examen_emite_certificado` (supabase/sql/068)
  // ya emitió el certificado dentro de este mismo UPDATE — de ahí que se
  // revaliden las rutas donde aparece.
  const examen = Array.isArray(intento.examen) ? intento.examen[0] : intento.examen;
  const cursoId = examen?.id_curso as string | undefined;

  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/certificados");
  revalidatePath("/dashboard/progreso");
  if (cursoId) {
    const { data: curso } = await admin.from("cursos").select("slug").eq("id", cursoId).maybeSingle();
    if (curso?.slug) {
      revalidatePath(`/cursos/${curso.slug}`);
      revalidatePath(`/cursos/${curso.slug}/examen`);
    }
  }

  return {
    success: true,
    aprobado: resultado.aprobado,
    puntajePct: resultado.puntajePct,
    porTiempo: vencido,
  };
}
