/**
 * Prueba de humo de la generación de exámenes contra la API real de Gemini.
 *
 * Uso: npm run examenes:probar-generacion
 *
 * Para qué sirve
 * -------------------------------------------------------------------------
 * Todo el pipeline está cubierto por tests unitarios EXCEPTO la llamada al
 * modelo, que ningún test puede ejercitar sin gastar una clave real. Este
 * script cierra ese hueco: con dos transcripciones inventadas y cortas,
 * comprueba de punta a punta que
 *
 *   1. la clave y el modelo configurados funcionan,
 *   2. el servidor ACEPTA `ESQUEMA_RESPUESTA_GEMINI` (un schema mal armado da
 *      un 400 opaco, y es el fallo más probable al cambiar de proveedor o de
 *      versión del SDK),
 *   3. lo que vuelve pasa la validación de Zod,
 *   4. el modelo respeta el reparto por video y no mezcla contenidos,
 *   5. `validateFragment` acepta los fragmentos citados — o sea que el modelo
 *      cita literal y no parafrasea, que es de lo que depende que las
 *      preguntas no se descarten todas.
 *
 * NO toca la base de datos: no lee transcripciones reales, no crea trabajos y
 * no escribe preguntas. Se puede correr sin miedo en cualquier entorno.
 *
 * Gasta una llamada al modelo (dos transcripciones de un párrafo: es la
 * petición más barata posible que sigue probando el camino completo).
 *
 * Sale con código 1 si algo falla, para poder usarse como verificación manual
 * tras configurar GEMINI_API_KEY o tras cambiar de modelo.
 */

// .env.local no existe en CI, donde las variables llegan del entorno
// (mismo patrón que scripts/apply-rls.ts, scripts/rls-test.ts).
try {
  process.loadEnvFile(".env.local");
} catch {
  // Sin archivo: se usan las variables ya presentes en process.env.
}

import type { Schema } from "@google/genai";
import { crearClienteGemini, MODELO_GENERACION_EXAMEN } from "../src/lib/gemini/client";
import { construirMensajeUsuario, construirSystemPrompt } from "../src/lib/examenes/generacion/prompt";
import {
  ESQUEMA_RESPUESTA_GEMINI,
  respuestaGeneracionSchema,
  type VideoConTranscripcion,
} from "../src/lib/examenes/generacion/tipos";
import { validateFragment } from "../src/lib/examenes/generacion/fragmento";

const PREGUNTAS_POR_VIDEO = 2;

// Dos transcripciones cortas y deliberadamente DISTINTAS entre sí: si el
// modelo mezcla conceptos de un video en la pregunta del otro, el fragmento
// citado no validará contra su propia transcripción y el script lo dirá.
const VIDEOS: VideoConTranscripcion[] = [
  {
    videoId: "11111111-1111-4111-8111-111111111111",
    title: "Iluminación global en V-Ray",
    transcript:
      "En esta clase configuramos la iluminación global en V-Ray. El parámetro más " +
      "importante es la subdivisión de la luz, porque controla directamente el ruido de " +
      "la imagen final. Con valores bajos el render sale rápido pero granulado; subirlo a " +
      "dieciséis suele ser suficiente para una imagen de presentación. También revisamos " +
      "el motor de irradiancia, que calcula el rebote de la luz sobre las superficies mates.",
  },
  {
    videoId: "22222222-2222-4222-8222-222222222222",
    title: "La cámara física",
    transcript:
      "La cámara física de V-Ray funciona igual que una cámara réflex real. Tiene tres " +
      "controles que definen la exposición: el ISO, la velocidad de obturación y el " +
      "diafragma. Subir el ISO aclara la imagen pero introduce grano. La distancia focal " +
      "se mide en milímetros y decide cuánto encuadre entra en el plano: un lente de " +
      "veinte milímetros exagera la profundidad de un interior pequeño.",
  },
];

function fallar(mensaje: string): never {
  console.error(`\n❌ ${mensaje}\n`);
  process.exit(1);
}

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    fallar(
      "Falta GEMINI_API_KEY en .env.local. Consíguela en aistudio.google.com → API keys.",
    );
  }

  console.log(`\nModelo: ${MODELO_GENERACION_EXAMEN}`);
  console.log(`Videos de prueba: ${VIDEOS.length}, ${PREGUNTAS_POR_VIDEO} preguntas por video.`);
  console.log("Llamando a la API…\n");

  const cliente = crearClienteGemini();
  const inicio = Date.now();

  const respuesta = await cliente.models.generateContent({
    model: MODELO_GENERACION_EXAMEN,
    contents: construirMensajeUsuario(VIDEOS),
    config: {
      systemInstruction: construirSystemPrompt(PREGUNTAS_POR_VIDEO),
      responseMimeType: "application/json",
      responseSchema: ESQUEMA_RESPUESTA_GEMINI as unknown as Schema,
      maxOutputTokens: 8000,
      thinkingConfig: { thinkingBudget: -1 },
      temperature: 0.3,
    },
  });

  const segundos = ((Date.now() - inicio) / 1000).toFixed(1);
  console.log(`✅ 1/5 — La API respondió en ${segundos}s (clave y modelo válidos).`);

  const motivoCorte = respuesta.candidates?.[0]?.finishReason;
  if (motivoCorte && motivoCorte !== "STOP") {
    fallar(`El modelo no completó la respuesta: finishReason = ${motivoCorte}`);
  }

  const texto = respuesta.text;
  if (!texto) fallar("El modelo no devolvió contenido.");

  console.log("✅ 2/5 — El servidor aceptó ESQUEMA_RESPUESTA_GEMINI (sin 400).");

  let crudo: unknown;
  try {
    crudo = JSON.parse(texto);
  } catch {
    fallar(`No es JSON válido. Primeros 300 caracteres:\n${texto.slice(0, 300)}`);
  }

  const parseado = respuestaGeneracionSchema.safeParse(crudo);
  if (!parseado.success) {
    console.error("\n❌ 3/5 — La respuesta NO pasó la validación de Zod:");
    for (const issue of parseado.error.issues.slice(0, 8)) {
      console.error(`   - ${issue.path.join(".")}: ${issue.message}`);
    }
    console.error(`\nJSON recibido:\n${JSON.stringify(crudo, null, 2).slice(0, 1500)}\n`);
    process.exit(1);
  }

  const preguntas = parseado.data.questions;
  console.log(`✅ 3/5 — Zod validó ${preguntas.length} pregunta(s).`);

  // Reparto por video: el modelo tiene que devolver las preguntas de cada
  // video atribuidas a SU videoId, copiado literal.
  let repartoOk = true;
  for (const video of VIDEOS) {
    const suyas = preguntas.filter((p) => p.videoId === video.videoId);
    const marca = suyas.length === PREGUNTAS_POR_VIDEO ? "  " : "⚠️";
    console.log(
      `   ${marca} «${video.title}»: ${suyas.length}/${PREGUNTAS_POR_VIDEO} preguntas`,
    );
    if (suyas.length !== PREGUNTAS_POR_VIDEO) repartoOk = false;
  }

  const idsConocidos = new Set(VIDEOS.map((v) => v.videoId));
  const huerfanas = preguntas.filter((p) => !idsConocidos.has(p.videoId));
  if (huerfanas.length > 0) {
    console.log(
      `   ⚠️  ${huerfanas.length} pregunta(s) con un videoId inventado: ${[
        ...new Set(huerfanas.map((p) => p.videoId)),
      ].join(", ")}`,
    );
    repartoOk = false;
  }

  console.log(
    repartoOk
      ? "✅ 4/5 — El reparto por video es exacto."
      : "⚠️  4/5 — El reparto no fue exacto (el pipeline lo absorbe y lo registra, no falla).",
  );

  // Lo que de verdad decide si el sistema sirve: ¿el modelo CITA literal o
  // parafrasea? Si parafrasea, validateFragment descarta todo y los exámenes
  // salen vacíos.
  let validos = 0;
  const fallos: string[] = [];
  for (const pregunta of preguntas) {
    const video = VIDEOS.find((v) => v.videoId === pregunta.videoId);
    if (!video) continue;
    const resultado = validateFragment(pregunta.sourceFragment, video.transcript);
    if (resultado.valido) {
      validos += 1;
    } else {
      fallos.push(`[${resultado.motivo}] «${pregunta.sourceFragment}»`);
    }
  }

  const atribuidas = preguntas.length - huerfanas.length;
  console.log(`\n   Fragmentos que validan: ${validos}/${atribuidas}`);
  for (const fallo of fallos) console.log(`   ✗ ${fallo}`);

  if (validos === 0 && atribuidas > 0) {
    fallar(
      "5/5 — NINGÚN fragmento validó. El modelo está parafraseando en vez de citar literal: " +
        "todas las preguntas se descartarían y los exámenes saldrían vacíos. Revisa el prompt " +
        "(construirSystemPrompt) antes de usar esto en serio.",
    );
  }

  console.log(
    validos === atribuidas
      ? "✅ 5/5 — Todos los fragmentos citan literal y validan.\n"
      : `⚠️  5/5 — ${atribuidas - validos} fragmento(s) no validan; esas preguntas se descartarían.\n`,
  );

  console.log("Ejemplo de pregunta generada:");
  console.log(JSON.stringify(preguntas[0], null, 2));
  console.log("\n✅ Prueba de humo superada. No se escribió nada en la base de datos.\n");
}

main().catch((error) => {
  console.error("\n❌ Error inesperado:", error instanceof Error ? error.message : error);
  process.exit(1);
});
