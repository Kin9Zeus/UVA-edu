"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { calcularVidasRestantes, calificarEmparejarParcial, calificarPregunta } from "@/lib/examenes/calificar";
import { congelarPreguntas } from "@/lib/examenes/congelar";
import { calcularDisponibilidad } from "@/lib/examen";
import {
  parsearProgreso,
  respuestaEstudianteSchema,
  TOLERANCIA_TIEMPO_SEGUNDOS,
  type PreguntaCongelada,
  type ProgresoIntento,
  type RespuestaEstudiante,
} from "@/lib/examenes/tipos";

type AdminClient = ReturnType<typeof createAdminClient>;

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
async function requireEstudiante(): Promise<
  { error: string } | { supabase: Awaited<ReturnType<typeof createClient>>; usuarioId: string }
> {
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
 * abierto, que le queden intentos y que haya pasado el tiempo de espera desde
 * el último fallido.
 *
 * A propósito NO exige haber terminado las lecciones del curso: el examen se
 * puede intentar desde que el curso lo publica (decisión de producto). Esto
 * es solo el gate de ACCESO/escritura de un intento — el gate de
 * CERTIFICACIÓN sigue exigiendo 100% de lecciones + examen aprobado, sin
 * cambios, vía `private.curso_esta_completo` (supabase/sql/068).
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
      // La cola arranca en el orden congelado que le tocó a ESTE estudiante:
      // es el orden en que verá las preguntas, y al que vuelven las que
      // falle (al final, ver `ProgresoIntento`).
      respuestas: {
        resueltas: {},
        fallos: 0,
        cola: preguntas.map((pregunta) => pregunta.id),
      } satisfies ProgresoIntento,
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
 * Porcentaje informativo de un intento: qué proporción de las preguntas del
 * examen quedaron resueltas correctamente, redondeado a dos decimales (la
 * columna es DECIMAL(5,2), con CHECK de rango 0-100).
 *
 * Ya NO decide nada —aprobar es terminar la cola, reprobar es quedarse sin
 * vidas— pero `puntaje_pct` es NOT NULL y hay que llenarla en cada cierre.
 * En un cierre APROBADO siempre da 100 por construcción: no se aprueba hasta
 * que `cola` está vacía, o sea con todas las preguntas en `resueltas`.
 */
function puntajeInformativo(resueltas: number, totalPreguntas: number): number {
  if (totalPreguntas <= 0) return 0;
  return Math.round((resueltas / totalPreguntas) * 10000) / 100;
}

/**
 * Cierra un intento, en el mismo UPDATE que exige el CHECK
 * `intentos_examen_cerrado_tiene_puntaje` (estado + puntaje_pct +
 * finalizado_en juntos). Compartido por `responderPregunta` (vidas agotadas o
 * cola vacía) y `enviarIntento` (tiempo agotado).
 *
 * Recibe el veredicto YA decidido en vez de calcularlo: quien llama es el
 * único que sabe cómo quedó la cola de reintentos, que es lo que define
 * aprobado/reprobado (docs/functional-spec.md Módulo 9). Acá no hay ninguna
 * regla de negocio, solo la escritura.
 */
async function cerrarIntento(
  admin: AdminClient,
  intentoId: string,
  usuarioId: string,
  estado: "APROBADO" | "REPROBADO",
  puntajePct: number,
  progresoFinal: ProgresoIntento,
): Promise<{ ok: boolean; fallo: boolean }> {
  // Mismo guard de carrera que ya existía: si dos disparadores llegan a la
  // vez (ej. el cronómetro y una última respuesta), el segundo UPDATE no
  // reescribe el cierre del primero — afecta 0 filas, sin `error`. Se
  // distingue de un `error` de verdad (fallo transitorio de la base) porque
  // en ese caso la respuesta que se estaba confirmando NUNCA se persistió
  // en ninguna otra escritura (esta es la única del camino de cierre) — si
  // se le dijera al estudiante "ya fue enviado" en vez de "reintenta", al
  // recargar volvería a ver la misma pregunta con la misma vida de más.
  const { error, count } = await admin
    .from("intentos_examen")
    .update(
      {
        estado,
        puntaje_pct: puntajePct,
        respuestas: progresoFinal,
        finalizado_en: new Date().toISOString(),
      },
      { count: "exact" },
    )
    .eq("id", intentoId)
    .eq("id_usuario", usuarioId)
    .eq("estado", "EN_CURSO");

  return { ok: !error && (count ?? 0) > 0, fallo: Boolean(error) };
}

/** Mensaje de error para un cierre que no se confirmó — distingue un fallo
 * real de escritura (reintentable) de un cierre concurrente legítimo (otra
 * vía ya cerró el intento primero). */
function mensajeCierreFallido(cierre: { fallo: boolean }): string {
  return cierre.fallo ? "No pudimos guardar tu respuesta. Intenta de nuevo." : "Este intento ya fue enviado.";
}

/** Revalida las rutas donde puede aparecer el resultado de un intento
 * cerrado (certificado, progreso, ficha del curso). Compartido por
 * `responderPregunta` y `enviarIntento` para no duplicar la consulta del
 * slug del curso. */
async function revalidarTrasCierre(admin: AdminClient, cursoId: string | undefined) {
  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/certificados");
  revalidatePath("/dashboard/progreso");
  if (!cursoId) return;
  const { data: curso } = await admin.from("cursos").select("slug").eq("id", cursoId).maybeSingle();
  if (curso?.slug) {
    revalidatePath(`/cursos/${curso.slug}`);
    revalidatePath(`/cursos/${curso.slug}/examen`);
  }
}

type IntentoParaResponder = {
  id: string;
  id_usuario: string;
  estado: string;
  preguntas_congeladas: unknown;
  respuestas: unknown;
  expira_en: string | null;
  examen: { id_curso: string } | { id_curso: string }[] | null;
};

function idCursoDe(intento: IntentoParaResponder): string | undefined {
  const examen = Array.isArray(intento.examen) ? intento.examen[0] : intento.examen;
  return examen?.id_curso;
}

export type RespuestaPreguntaResultado =
  | { error: string }
  /**
   * Solo EMPAREJAR calificado por par (ver `calificarEmparejarParcial` y el
   * bloque de abajo en `responderPregunta`): este par salió correcto pero la
   * pregunta TODAVÍA NO se resolvió, quedan pares por armar. Ninguno de los
   * campos de la otra rama aplica — no se gastó vida, no se tocó la cola, la
   * pregunta actual sigue siendo la misma y el cliente no debe pintar ningún
   * veredicto ni ofrecer "Siguiente".
   */
  | { success: true; enProgreso: true }
  | {
      success: true;
      enProgreso: false;
      acierto: boolean;
      vidasRestantes: number;
      /** true si esta respuesta cerró el intento (no quedaban pendientes,
       * vidas agotadas, o el tiempo ya se había vencido). El cliente debe
       * navegar al resultado en vez de mostrar "Siguiente". */
      cerrado: boolean;
      /**
       * Qué pregunta toca ahora. Solo cuando `cerrado` es false.
       *
       * Lo manda el servidor porque el cliente ya no puede deducirlo: con la
       * cola de reintentos, la siguiente no es "la del índice de al lado" —
       * una pregunta fallada vuelve al final de la fila, así que el orden
       * real solo lo conoce `ProgresoIntento.cola`.
       */
      siguientePreguntaId?: string;
      /** Solo si `cerrado` fue por tiempo ya vencido: la respuesta que se
       * mandó en esta llamada NUNCA se calificó (ni entró al puntaje ni
       * pudo restar vida) — el cliente no debe decir "Fallaste" de esto. */
      porTiempo?: boolean;
      aprobado?: boolean;
      puntajePct?: number;
    };

/**
 * Responde UNA pregunta del intento en curso: la califica, actualiza la cola
 * de pendientes y, si corresponde (agotó las vidas o vació la cola), cierra
 * el intento en el mismo paso.
 *
 * EXCEPCIÓN: EMPAREJAR puede llamar acá varias veces por pregunta, una por
 * cada par que se arma, y la mayoría de esas llamadas no califican nada
 * todavía — devuelven `{ enProgreso: true }` y salen antes de tocar la cola
 * o las vidas (ver el bloque de `calificarEmparejarParcial` más abajo). Todo
 * lo que sigue de esta función, sobre la cola/vidas/cierre, es exactamente
 * lo mismo para EMPAREJAR que para el resto de tipos: solo corre en la
 * llamada que de verdad resuelve la pregunta (falló un par, o se completó
 * correcta).
 *
 * Cola de reintentos (docs/functional-spec.md Módulo 9): acertar saca la
 * pregunta de la cola; fallar la manda al FINAL, así que vuelve a aparecer
 * después de las demás pendientes —nunca dos veces seguidas— y cuesta una
 * vida. El intento solo termina al quedarse sin vidas (REPROBADO) o al
 * responder bien TODAS las preguntas, reintentos incluidos (APROBADO).
 *
 * Con la respuesta fija al elegir (no se puede volver atrás, decisión de
 * producto), cada respuesta se persiste atómicamente en el momento en que se
 * confirma, así que no hace falta autoguardado de borrador.
 */
export async function responderPregunta(
  intentoId: string,
  preguntaId: string,
  respuesta: RespuestaEstudiante,
): Promise<RespuestaPreguntaResultado> {
  const sesion = await requireEstudiante();
  if ("error" in sesion) return { error: sesion.error };
  const { usuarioId } = sesion;

  const parseo = respuestaEstudianteSchema.safeParse(respuesta);
  if (!parseo.success) return { error: "Respuesta inválida." };

  const admin = createAdminClient();
  const { data: intento } = await admin
    .from("intentos_examen")
    .select(
      "id, id_usuario, estado, preguntas_congeladas, respuestas, expira_en, examen:examenes(id_curso)",
    )
    .eq("id", intentoId)
    .maybeSingle<IntentoParaResponder>();

  if (!intento || intento.id_usuario !== usuarioId) return { error: "No encontramos ese intento." };
  if (intento.estado !== "EN_CURSO") return { error: "Este intento ya fue enviado." };

  const preguntas = (intento.preguntas_congeladas ?? []) as PreguntaCongelada[];
  const progreso = parsearProgreso(intento.respuestas, preguntas);
  const cursoId = idCursoDe(intento);

  // Tiempo ya vencido: esta respuesta no cuenta, se cierra con lo que ya
  // había antes de que llegara — mismo criterio que el `enviarIntento`
  // anterior, solo que ahora no hay "envío tardío del cliente" que
  // descartar porque cada respuesta ya se persistió al confirmarla.
  const vencido =
    intento.expira_en !== null &&
    Date.now() > new Date(intento.expira_en).getTime() + TOLERANCIA_TIEMPO_SEGUNDOS * 1000;

  if (vencido) {
    // Siempre REPROBADO: la única forma de aprobar es terminar TODAS las
    // preguntas correctamente, y quien se quedó sin tiempo con la cola a
    // medias no lo hizo.
    const puntajePct = puntajeInformativo(Object.keys(progreso.resueltas).length, preguntas.length);
    const cierre = await cerrarIntento(admin, intentoId, usuarioId, "REPROBADO", puntajePct, progreso);
    if (!cierre.ok) return { error: mensajeCierreFallido(cierre) };
    await revalidarTrasCierre(admin, cursoId);
    return {
      success: true,
      enProgreso: false,
      acierto: false,
      vidasRestantes: calcularVidasRestantes(progreso.fallos),
      cerrado: true,
      porTiempo: true,
      aprobado: false,
      puntajePct,
    };
  }

  const pregunta = preguntas.find((p) => p.id === preguntaId);
  if (!pregunta) return { error: "Esa pregunta no existe en este intento." };

  // Idempotente: repetir una pregunta YA RESUELTA (reintento de red) no resta
  // vida de nuevo ni reordena la cola. Solo se llega a `resueltas` acertando,
  // así que el acierto es true por construcción.
  if (Object.hasOwn(progreso.resueltas, preguntaId)) {
    return {
      success: true,
      enProgreso: false,
      acierto: true,
      vidasRestantes: calcularVidasRestantes(progreso.fallos),
      cerrado: false,
      siguientePreguntaId: progreso.cola[0],
    };
  }

  // Orden: solo se responde la pregunta que está al frente de la cola.
  // Defensa contra un cliente que llame a la action saltándose preguntas, no
  // algo que la UI normal pueda producir.
  if (progreso.cola[0] !== preguntaId) return { error: "Responde las preguntas en orden." };

  // EMPAREJAR se califica POR PAR, no de una sola vez al completar el mapa:
  // cada toque en la columna derecha llama acá con el mapa acumulado hasta
  // ese momento. Si todos los pares presentes son correctos pero todavía
  // falta alguno, la pregunta sigue abierta — no se gasta vida, no se toca
  // la cola, y el cliente lo interpreta como "sigue emparejando". Solo se
  // sigue de largo hacia `calificarPregunta` cuando ya hay un par mal (falla
  // YA, sin esperar a que arme el resto) o cuando el mapa quedó completo.
  if (pregunta.tipo === "EMPAREJAR") {
    const mapa =
      typeof parseo.data === "object" && parseo.data !== null && !Array.isArray(parseo.data)
        ? (parseo.data as Record<string, string>)
        : {};
    if (calificarEmparejarParcial(pregunta.paresDerecha ?? [], mapa) === "sigue") {
      return { success: true, enProgreso: true };
    }
  }

  const acierto = calificarPregunta(pregunta, parseo.data);
  // Acertar saca la pregunta de la cola; fallar la manda al final (vuelve
  // después de las demás pendientes) y cuesta una vida. Una respuesta
  // incorrecta NO se guarda: `resueltas` es solo lo que quedó bien.
  const progresoNuevo: ProgresoIntento = acierto
    ? {
        resueltas: { ...progreso.resueltas, [preguntaId]: parseo.data },
        fallos: progreso.fallos,
        cola: progreso.cola.slice(1),
      }
    : {
        resueltas: progreso.resueltas,
        fallos: progreso.fallos + 1,
        cola: [...progreso.cola.slice(1), preguntaId],
      };

  const vidasRestantes = calcularVidasRestantes(progresoNuevo.fallos);
  const puntajePct = puntajeInformativo(
    Object.keys(progresoNuevo.resueltas).length,
    preguntas.length,
  );

  // Sin vidas: se cierra YA como REPROBADO, sin importar cuánto quede en la
  // cola. Es una regla explícita, no una consecuencia de ningún puntaje.
  if (vidasRestantes === 0) {
    const cierre = await cerrarIntento(admin, intentoId, usuarioId, "REPROBADO", puntajePct, progresoNuevo);
    if (!cierre.ok) return { error: mensajeCierreFallido(cierre) };
    await revalidarTrasCierre(admin, cursoId);
    return {
      success: true,
      enProgreso: false,
      acierto,
      vidasRestantes: 0,
      cerrado: true,
      aprobado: false,
      puntajePct,
    };
  }

  // Cola vacía con vidas de sobra: respondió bien todas las preguntas del
  // examen (los reintentos incluidos). Única forma de aprobar.
  if (progresoNuevo.cola.length === 0) {
    const cierre = await cerrarIntento(admin, intentoId, usuarioId, "APROBADO", puntajePct, progresoNuevo);
    if (!cierre.ok) return { error: mensajeCierreFallido(cierre) };
    await revalidarTrasCierre(admin, cursoId);
    return {
      success: true,
      enProgreso: false,
      acierto,
      vidasRestantes,
      cerrado: true,
      aprobado: true,
      puntajePct,
    };
  }

  // No se cierra: solo se persiste el progreso, sigue EN_CURSO. Mismo
  // filtro de dueño+estado que el resto de las escrituras de este módulo.
  const { error, count } = await admin
    .from("intentos_examen")
    .update({ respuestas: progresoNuevo }, { count: "exact" })
    .eq("id", intentoId)
    .eq("id_usuario", usuarioId)
    .eq("estado", "EN_CURSO");

  if (error) return { error: "No pudimos guardar tu respuesta. Intenta de nuevo." };
  if ((count ?? 0) === 0) return { error: "Este intento ya fue enviado." };

  return {
    success: true,
    enProgreso: false,
    acierto,
    vidasRestantes,
    cerrado: false,
    siguientePreguntaId: progresoNuevo.cola[0],
  };
}

export type EnvioResultado = { error?: string; success?: boolean; aprobado?: boolean; puntajePct?: number };

/**
 * Cierra el intento por vencimiento del cronómetro (único disparador que
 * queda: ya no hay botón "Enviar examen" — el examen termina solo al vaciar
 * la cola de preguntas, agotar las vidas, o agotarse el tiempo). Cierra con
 * lo que ya está persistido en `respuestas`: cada respuesta se guardó
 * atómicamente al confirmarla, así que no hay nada que el cliente deba (ni
 * pueda) mandar en este llamado.
 *
 * Valida `expira_en` en el servidor, igual que hace `responderPregunta` para
 * su propia rama de "se acabó el tiempo" — nunca contra el reloj del
 * cliente. Sin esto, cualquier llamada autenticada (el `tick()` del
 * cronómetro dispara la primera con el reloj del NAVEGADOR, sin garantía de
 * que esté bien puesto) cerraba el intento aunque todavía quedara tiempo de
 * verdad.
 */
export async function enviarIntento(intentoId: string): Promise<EnvioResultado> {
  const sesion = await requireEstudiante();
  if ("error" in sesion) return { error: sesion.error };
  const { usuarioId } = sesion;

  const admin = createAdminClient();
  const { data: intento } = await admin
    .from("intentos_examen")
    .select("id, id_usuario, estado, preguntas_congeladas, respuestas, expira_en, examen:examenes(id_curso)")
    .eq("id", intentoId)
    .maybeSingle<IntentoParaResponder>();

  if (!intento || intento.id_usuario !== usuarioId) return { error: "No encontramos ese intento." };
  if (intento.estado !== "EN_CURSO") return { error: "Este intento ya fue enviado." };

  // Sin tolerancia de gracia acá a propósito: a diferencia de
  // `responderPregunta` (que la usa para decidir si una respuesta que llegó
  // justo después del corte todavía cuenta), esta comprobación solo decide
  // si YA se puede cerrar — sumarle 30s de gracia solo demoraría el cierre
  // real sin ganar nada, porque no hay ninguna respuesta en vuelo que
  // proteger.
  const vencido = intento.expira_en !== null && Date.now() >= new Date(intento.expira_en).getTime();

  if (!vencido) return { error: "El tiempo del examen todavía no se agotó." };

  const preguntas = (intento.preguntas_congeladas ?? []) as PreguntaCongelada[];
  const progreso = parsearProgreso(intento.respuestas, preguntas);

  // Siempre REPROBADO: aprobar exige haber respondido bien TODAS las
  // preguntas, y ese caso cierra solo en `responderPregunta` (cola vacía)
  // antes de que el cronómetro llegue acá. Quien llega por tiempo agotado,
  // por definición, dejó la cola a medias.
  const puntajePct = puntajeInformativo(Object.keys(progreso.resueltas).length, preguntas.length);
  const cierre = await cerrarIntento(admin, intentoId, usuarioId, "REPROBADO", puntajePct, progreso);
  if (!cierre.ok) return { error: mensajeCierreFallido(cierre) };

  // El trigger `intento_examen_emite_certificado` (supabase/sql/068) solo
  // emite si el intento cerró APROBADO; se revalidan igual las rutas del
  // resultado, que sí cambian.
  await revalidarTrasCierre(admin, idCursoDe(intento));

  return { success: true, aprobado: false, puntajePct };
}
