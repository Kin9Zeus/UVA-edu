import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolverContenidoLeccion, type DocumentoContenido } from "@/lib/editor/tipos";
import {
  COOLDOWN_AGOTADO_HORAS,
  COOLDOWN_REINTENTO_MINUTOS,
  prepararPreguntasParaEstudiante,
  type PreguntaCongelada,
  type PreguntaParaEstudiante,
  type RespuestasIntento,
} from "@/lib/examenes/tipos";

/**
 * Lectura del examen final desde el lado del estudiante.
 *
 * Nunca toca `preguntas_examen` — RLS ni siquiera se la abre (supabase/sql/067).
 * Todo lo que el estudiante ve del examen sale de la fila de `examenes`
 * (metadatos, sin respuestas) y de su propio intento congelado.
 */

export type ExamenPublico = {
  id: string;
  titulo: string;
  instrucciones: DocumentoContenido | null;
  notaAprobatoria: number;
  intentosMaximos: number | null;
  minutosLimite: number | null;
};

export type IntentoPrevio = {
  id: string;
  estado: "EN_CURSO" | "APROBADO" | "REPROBADO" | "EN_REVISION";
  puntajePct: number | null;
  finalizadoEn: string | null;
};

/**
 * En qué punto está este estudiante respecto al examen del curso. Un solo
 * discriminador para que la UI no tenga que recombinar cinco booleanos y
 * pueda quedarse sin estados imposibles ("agotado" y "aprobado" a la vez).
 *
 *   SIN_EXAMEN  el curso no exige examen (o está en borrador). El curso se
 *               completa con el 100% de lecciones, como siempre.
 *   BLOQUEADO   hay examen, pero todavía le faltan lecciones.
 *   DISPONIBLE  puede iniciar un intento ahora (una ronda nueva o en curso).
 *   EN_CURSO    tiene un intento abierto; hay que retomarlo, no crear otro.
 *   EN_ESPERA   tiene que esperar para reintentar. `esperaLarga` distingue
 *               "reprobó una pregunta hace poco" (15 min) de "agotó una
 *               ronda completa de intentos sin aprobar" (5h) — no hay un
 *               estado "AGOTADO" aparte: agotar una ronda nunca es
 *               definitivo, solo alarga la espera. Ver COOLDOWN_AGOTADO_HORAS.
 *   APROBADO    ya pasó; el certificado se emite (o ya se emitió) solo.
 */
export type SituacionExamen =
  | { situacion: "SIN_EXAMEN" }
  | { situacion: "BLOQUEADO"; examen: ExamenPublico; leccionesPendientes: boolean }
  | {
      situacion: "DISPONIBLE";
      examen: ExamenPublico;
      intentosUsados: number;
      /** Intentos disponibles en la ronda que está por empezar o en curso —
       * nunca 0: si se agotaron, la situación es EN_ESPERA, no DISPONIBLE. */
      intentosRestantes: number | null;
      ultimoIntento: IntentoPrevio | null;
    }
  | { situacion: "EN_CURSO"; examen: ExamenPublico; intentoId: string; expiraEn: string | null }
  | {
      situacion: "EN_ESPERA";
      examen: ExamenPublico;
      disponibleDesde: string;
      /** true = agotó una ronda completa (espera de COOLDOWN_AGOTADO_HORAS,
       * y al cumplirse recibe una ronda nueva de intentosMaximos). false =
       * solo reprobó una pregunta dentro de la ronda actual (espera corta). */
      esperaLarga: boolean;
      intentosUsados: number;
      ultimoIntento: IntentoPrevio;
    }
  | { situacion: "APROBADO"; examen: ExamenPublico; intentoAprobado: IntentoPrevio };

function aExamenPublico(fila: Record<string, unknown>): ExamenPublico {
  return {
    id: fila.id as string,
    titulo: fila.titulo as string,
    instrucciones: resolverContenidoLeccion(fila.instrucciones ?? null, null),
    notaAprobatoria: fila.nota_aprobatoria as number,
    intentosMaximos: (fila.intentos_maximos as number | null) ?? null,
    minutosLimite: (fila.minutos_limite as number | null) ?? null,
  };
}

/** `numeric` viaja como string desde PostgREST; en 0-100 con dos decimales el
 * Number es exacto. */
function aPuntaje(valor: unknown): number | null {
  return valor === null || valor === undefined ? null : Number(valor);
}

export type Disponibilidad =
  | { disponible: true }
  | { disponible: false; disponibleDesde: Date; esperaLarga: boolean };

/**
 * ¿Puede este estudiante iniciar un intento AHORA? Única fuente de verdad
 * del cooldown — la usan tanto la Server Action que inicia el intento
 * (`iniciarIntento`) como la lectura que arma la pantalla previa
 * (`getSituacionExamen`); si divergieran, el botón se habilitaría antes (o
 * después) de que el servidor lo aceptara.
 *
 * Regla de negocio: `intentosMaximos` no es un tope de por vida, es el
 * tamaño de una RONDA. Cada intento reprobado dentro de la ronda espera
 * `COOLDOWN_REINTENTO_MINUTOS` (15 min); agotar la ronda completa espera
 * `COOLDOWN_AGOTADO_HORAS` (5h) y al cumplirse habilita una ronda nueva —
 * así indefinidamente, sin que un admin tenga que intervenir (aunque puede
 * saltarse la espera con `otorgarIntentoExtra`, src/actions/admin/examenes.ts).
 *
 * `cerrados` en el mismo orden que entrega la consulta (más reciente
 * primero): solo se usan `cerrados[0]` (el último) y `cerrados.length`.
 */
export function calcularDisponibilidad(
  cerrados: { finalizadoEn: string | null }[],
  intentosMaximos: number | null,
): Disponibilidad {
  const ultimo = cerrados[0];
  if (!ultimo?.finalizadoEn) return { disponible: true };

  // Fin de ronda: el total de intentos cerrados es múltiplo exacto del
  // tamaño de la ronda (y no cero). Sin límite de intentos, nunca hay ronda
  // que agotar — siempre es la espera corta.
  const esFinDeRonda =
    intentosMaximos !== null && cerrados.length > 0 && cerrados.length % intentosMaximos === 0;

  const minutos = esFinDeRonda ? COOLDOWN_AGOTADO_HORAS * 60 : COOLDOWN_REINTENTO_MINUTOS;
  const disponibleDesde = new Date(new Date(ultimo.finalizadoEn).getTime() + minutos * 60_000);

  if (disponibleDesde.getTime() <= Date.now()) return { disponible: true };
  return { disponible: false, disponibleDesde, esperaLarga: esFinDeRonda };
}

/** Intentos disponibles en la ronda que está por empezar o en curso — nunca
 * negativo, y `intentosMaximos` completo si `intentosUsados` cae justo en un
 * borde de ronda (ronda nueva, agotada o recién empezando). `null` sin
 * límite de intentos. */
function restantesEnRonda(intentosUsados: number, intentosMaximos: number | null): number | null {
  if (intentosMaximos === null) return null;
  const enRondaActual = intentosUsados % intentosMaximos;
  return enRondaActual === 0 ? intentosMaximos : intentosMaximos - enRondaActual;
}

export async function getSituacionExamen(
  cursoId: string,
  usuarioId: string | null,
): Promise<SituacionExamen> {
  if (!usuarioId) return { situacion: "SIN_EXAMEN" };

  const supabase = await createClient();

  // RLS ya filtra: solo devuelve la fila si el examen está publicado y el
  // estudiante tiene acceso vigente al curso. Un examen en borrador sale como
  // "no hay examen", que es exactamente lo que debe pasar.
  const { data: examenRow } = await supabase
    .from("examenes")
    .select("id, titulo, instrucciones, nota_aprobatoria, intentos_maximos, minutos_limite")
    .eq("id_curso", cursoId)
    .maybeSingle();

  if (!examenRow) return { situacion: "SIN_EXAMEN" };
  const examen = aExamenPublico(examenRow);

  const { data: intentosRow } = await supabase
    .from("intentos_examen")
    // Proyección explícita, sin `preguntas_congeladas`: esa columna lleva las
    // respuestas correctas y RLS protege filas, no columnas (ver el comentario
    // final de supabase/sql/067). Nada que se renderice necesita esa columna.
    .select("id, estado, puntaje_pct, finalizado_en, expira_en")
    .eq("id_examen", examen.id)
    .eq("id_usuario", usuarioId)
    .order("iniciado_en", { ascending: false });

  const intentos = intentosRow ?? [];

  const aprobado = intentos.find((intento) => intento.estado === "APROBADO");
  if (aprobado) {
    return {
      situacion: "APROBADO",
      examen,
      intentoAprobado: {
        id: aprobado.id,
        estado: "APROBADO",
        puntajePct: aPuntaje(aprobado.puntaje_pct),
        finalizadoEn: aprobado.finalizado_en,
      },
    };
  }

  const enCurso = intentos.find((intento) => intento.estado === "EN_CURSO");
  if (enCurso) {
    return { situacion: "EN_CURSO", examen, intentoId: enCurso.id, expiraEn: enCurso.expira_en };
  }

  // Solo los cerrados consumen intento. Un EN_CURSO no cuenta todavía (y no
  // puede haber más de uno: índice parcial `intentos_examen_uno_en_curso`).
  const cerrados = intentos.filter((intento) => intento.estado !== "EN_CURSO");
  const intentosUsados = cerrados.length;

  // El examen solo se desbloquea con el 100% de lecciones. La regla vive en
  // Postgres (private.lecciones_completas_curso, supabase/sql/068) y se
  // consulta por RPC en vez de recalcularse acá: es la MISMA función que usa
  // el trigger de certificación, así que no pueden separarse.
  const { data: leccionesCompletas } = await supabase.rpc("lecciones_completas_curso", {
    p_id_curso: cursoId,
  });

  if (leccionesCompletas !== true) {
    return { situacion: "BLOQUEADO", examen, leccionesPendientes: true };
  }

  const ultimoCerrado = cerrados[0];
  const ultimoIntento: IntentoPrevio | null = ultimoCerrado
    ? {
        id: ultimoCerrado.id,
        estado: ultimoCerrado.estado,
        puntajePct: aPuntaje(ultimoCerrado.puntaje_pct),
        finalizadoEn: ultimoCerrado.finalizado_en,
      }
    : null;

  const disponibilidad = calcularDisponibilidad(
    cerrados.map((intento) => ({ finalizadoEn: intento.finalizado_en })),
    examen.intentosMaximos,
  );

  if (!disponibilidad.disponible && ultimoIntento) {
    return {
      situacion: "EN_ESPERA",
      examen,
      disponibleDesde: disponibilidad.disponibleDesde.toISOString(),
      esperaLarga: disponibilidad.esperaLarga,
      intentosUsados,
      ultimoIntento,
    };
  }

  return {
    situacion: "DISPONIBLE",
    examen,
    intentosUsados,
    intentosRestantes: restantesEnRonda(intentosUsados, examen.intentosMaximos),
    ultimoIntento,
  };
}

export type IntentoEnCurso = {
  id: string;
  examenTitulo: string;
  notaRequerida: number;
  /** Ya despojadas de respuestas correctas, en el orden que le tocó a este
   * estudiante. */
  preguntas: PreguntaParaEstudiante[];
  respuestas: RespuestasIntento;
  expiraEn: string | null;
  iniciadoEn: string;
};

/**
 * Carga el intento abierto para renderizar el examen.
 *
 * Es el único sitio donde `preguntas_congeladas` sale de la base hacia la app,
 * y sale acotado: se pasa por `prepararPreguntasParaEstudiante()` antes de
 * volver, así que lo que llega al componente —y por tanto al navegador— no
 * contiene `correcta` ni `respuestasAceptadas`.
 *
 * Lee con Service Role, no con el cliente de sesión (P0-1, AUDIT-2026-09-08).
 * Desde `supabase/sql/070` el rol `authenticated` ya no tiene privilegio de
 * SELECT sobre `preguntas_congeladas` —ese GRANT por columna es lo que impide
 * que el estudiante se lea la solución yendo directo a PostgREST—, así que
 * esta consulta fallaría con 42501 si siguiera usando su sesión.
 *
 * El precio es que RLS deja de autorizar aquí, y por eso el chequeo de abajo
 * pasa de ser defensa en profundidad a ser LA autorización. Es el mismo
 * patrón que ya usan `enviarIntento` y el resto del módulo de exámenes:
 * el servidor lee con Service Role y compara contra un `usuarioId` que salió
 * de `auth.getUser()`, nunca del cliente.
 */
export async function getIntentoEnCurso(
  intentoId: string,
  usuarioId: string,
): Promise<IntentoEnCurso | null> {
  const { data: intento } = await createAdminClient()
    .from("intentos_examen")
    .select(
      "id, id_usuario, estado, nota_requerida, preguntas_congeladas, respuestas, expira_en, iniciado_en, examen:examenes(titulo)",
    )
    .eq("id", intentoId)
    .maybeSingle();

  // ÚNICA autorización de esta función: con Service Role no hay RLS detrás.
  // `usuarioId` lo pone el servidor (getPerfilActual() -> auth.getUser() en
  // la página del examen), nunca llega del navegador. Cubre los dos casos:
  // que el intento sea de otra persona, y que un administrador —que sí puede
  // ver los intentos ajenos en el panel— abra la pantalla de RENDIR con el
  // intento de un estudiante por pegar una URL.
  if (!intento || intento.id_usuario !== usuarioId || intento.estado !== "EN_CURSO") {
    return null;
  }

  const examen = Array.isArray(intento.examen) ? intento.examen[0] : intento.examen;
  const congeladas = (intento.preguntas_congeladas ?? []) as PreguntaCongelada[];

  return {
    id: intento.id,
    examenTitulo: examen?.titulo ?? "Examen final",
    notaRequerida: intento.nota_requerida,
    preguntas: prepararPreguntasParaEstudiante(congeladas),
    respuestas: (intento.respuestas ?? {}) as RespuestasIntento,
    expiraEn: intento.expira_en,
    iniciadoEn: intento.iniciado_en,
  };
}

/**
 * Resultado de un intento ya cerrado, para la pantalla de "ya lo enviaste".
 *
 * Devuelve qué preguntas falló (por su enunciado) pero NUNCA cuál era la
 * respuesta correcta: con 3 intentos, mostrarla permitiría reconstruir el
 * examen completo. Decisión de producto, ver docs/functional-spec.md Flujo 14.
 */
export type ResultadoIntentoVista = {
  id: string;
  estado: "APROBADO" | "REPROBADO" | "EN_REVISION";
  puntajePct: number | null;
  notaRequerida: number;
  finalizadoEn: string | null;
  preguntas: { id: string; enunciado: DocumentoContenido; acertada: boolean }[];
};

/**
 * Resultado de un intento ya cerrado, para la pantalla de "ya lo enviaste".
 *
 * Lee con Service Role por lo mismo que `getIntentoEnCurso`: necesita
 * `preguntas_congeladas` para recalcular qué preguntas se acertaron, y desde
 * `supabase/sql/070` esa columna no la puede leer el rol `authenticated`.
 *
 * Ya no recibe un `SupabaseClient` opcional. Lo tenía para poder inyectar uno
 * en pruebas, no lo usaba ningún llamador, y ahora sería una trampa: pasarle
 * un cliente de sesión haría fallar la consulta con 42501 en producción y en
 * ningún otro sitio.
 */
export async function getResultadoIntento(
  intentoId: string,
  usuarioId: string,
): Promise<ResultadoIntentoVista | null> {
  const { data: intento } = await createAdminClient()
    .from("intentos_examen")
    .select("id, id_usuario, estado, puntaje_pct, nota_requerida, preguntas_congeladas, respuestas, finalizado_en")
    .eq("id", intentoId)
    .maybeSingle();

  if (!intento || intento.id_usuario !== usuarioId || intento.estado === "EN_CURSO") {
    return null;
  }

  const congeladas = (intento.preguntas_congeladas ?? []) as PreguntaCongelada[];
  const respuestas = (intento.respuestas ?? {}) as RespuestasIntento;

  // Se recalcula el acierto por pregunta en vez de guardarlo: la calificación
  // es determinista sobre datos ya congelados, así que dar el mismo resultado
  // está garantizado, y evita una columna más que mantener en sincronía.
  const { calificarPregunta } = await import("@/lib/examenes/calificar");

  return {
    id: intento.id,
    estado: intento.estado,
    puntajePct: aPuntaje(intento.puntaje_pct),
    notaRequerida: intento.nota_requerida,
    finalizadoEn: intento.finalizado_en,
    preguntas: congeladas.map((pregunta) => ({
      id: pregunta.id,
      enunciado: pregunta.enunciado,
      acertada: calificarPregunta(pregunta, respuestas[pregunta.id]),
    })),
  };
}
