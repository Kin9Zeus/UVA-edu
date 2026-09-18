import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { barajar } from "@/lib/examenes/calificar";
import {
  esTipoImplementado,
  type ParEmparejar,
  type ParEmparejarCongelado,
  type PreguntaCongelada,
} from "@/lib/examenes/tipos";

/**
 * Congela las preguntas de un examen para un intento nuevo.
 *
 * Compartida entre `iniciarIntento` (el estudiante pide su propio intento) y
 * `otorgarIntentoExtra` (un admin le crea uno directamente a un estudiante
 * que agotó los suyos sin aprobar) — la forma del intento tiene que ser
 * idéntica sin importar quién lo originó, así que la congelación vive en un
 * solo sitio en vez de reimplementarse en las dos Server Actions.
 *
 * Lee `preguntas_examen` con Service Role porque RLS no se la abre al
 * estudiante (es el examen resuelto) — pero lo que se guarda en el intento no
 * llega nunca al navegador tal cual: `getIntentoEnCurso` lo pasa por
 * `prepararPreguntasParaEstudiante()` antes de renderizar.
 *
 * La aleatorización se resuelve acá, una sola vez, y queda escrita: si se
 * recalculara en cada carga de la página, refrescar reordenaría el examen a
 * mitad de intento y las respuestas ya dadas apuntarían a otras preguntas.
 */
export async function congelarPreguntas(
  examenId: string,
  aleatorizarPreguntas: boolean,
  aleatorizarOpciones: boolean,
): Promise<PreguntaCongelada[]> {
  const { data } = await createAdminClient()
    .from("preguntas_examen")
    .select("id, tipo, enunciado, puntos, opciones, respuestas_aceptadas")
    .eq("id_examen", examenId)
    .order("orden");

  const preguntas: PreguntaCongelada[] = (data ?? [])
    // Una pregunta de un tipo de Fase 2 no se sabe calificar todavía: se
    // excluye del intento en vez de congelarse y contar como fallada siempre.
    .filter((pregunta) => esTipoImplementado(pregunta.tipo))
    .map((pregunta) => {
      // EMPAREJAR guarda sus pares en la misma columna `opciones`, con otra
      // forma (ParEmparejar en vez de OpcionPregunta) — se congela aparte.
      if (pregunta.tipo === "EMPAREJAR") {
        const pares = (pregunta.opciones ?? []) as ParEmparejar[];
        // `idMostrado` por INTENTO (no por examen): es el id que de verdad
        // ve el estudiante para cada elemento de la derecha, generado acá y
        // nunca antes — así, aunque alguien inspeccione el HTML, el id no
        // delata con cuál elemento de la izquierda va (ver ParEmparejar).
        const paresConIdMostrado: ParEmparejarCongelado[] = pares.map((par) => ({
          ...par,
          idMostrado: randomUUID(),
        }));
        return {
          id: pregunta.id as string,
          tipo: pregunta.tipo,
          enunciado: pregunta.enunciado,
          puntos: pregunta.puntos as number,
          opciones: null,
          respuestasAceptadas: [],
          paresIzquierda: aleatorizarOpciones ? barajar(pares) : pares,
          // SIEMPRE barajada, sin condicionar a `aleatorizarOpciones`: a
          // diferencia de una lista de opciones plana, dejar las dos
          // columnas en el mismo orden relativo ES la respuesta (la fila n
          // de la izquierda sería la pareja de la fila n de la derecha),
          // no una decisión legítima del admin.
          paresDerecha: barajar(paresConIdMostrado),
        };
      }

      const opciones = (pregunta.opciones ?? null) as PreguntaCongelada["opciones"];
      return {
        id: pregunta.id as string,
        tipo: pregunta.tipo,
        enunciado: pregunta.enunciado,
        puntos: pregunta.puntos as number,
        opciones: opciones && aleatorizarOpciones ? barajar(opciones) : opciones,
        respuestasAceptadas: (pregunta.respuestas_aceptadas ?? []) as string[],
        paresIzquierda: null,
        paresDerecha: null,
      };
    });

  return aleatorizarPreguntas ? barajar(preguntas) : preguntas;
}
