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

import { crearClienteGemini } from "../src/lib/gemini/client";
import { configuracionGemini } from "../src/lib/gemini/configuracion";
import { pedirConCadenaDeModelos } from "../src/lib/examenes/generacion/generar";
import { construirMensajeUsuario, construirSystemPrompt } from "../src/lib/examenes/generacion/prompt";
import {
  respuestaGeneracionSchema,
  type VideoConTranscripcion,
} from "../src/lib/examenes/generacion/tipos";
import { validateFragment } from "../src/lib/examenes/generacion/fragmento";

// Menos preguntas que videos A PROPÓSITO: es el caso que el pipeline tiene que
// soportar desde que el parámetro pasó a ser un total (un curso de 20 lecciones
// con un examen de 5). Con 3 preguntas y 2 videos se comprueba además el
// reparto: el modelo debe cubrir las dos lecciones antes de repetir ninguna.
const TOTAL_PREGUNTAS = 3;

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

  const config = configuracionGemini();
  console.log(`\nCadena de modelos: ${config.modelos.join(" → ")}`);
  console.log(
    `Presupuesto: hasta ${config.modelos.length} modelo(s) × ${config.intentosPorModelo} intento(s) ` +
      `× ${config.tiempoLimiteMs / 1000}s; el barredor corta a los ${config.umbralAtascadaMinutos} min.`,
  );
  console.log(`Videos de prueba: ${VIDEOS.length}, ${TOTAL_PREGUNTAS} preguntas en total.`);
  console.log("Llamando a la API…\n");

  const cliente = crearClienteGemini();
  const inicio = Date.now();

  // El camino real, no una copia: `pedirConCadenaDeModelos` es la misma
  // función que usa `generateCourseExam`, así que esta prueba cubre también el
  // paso de un modelo al siguiente, los motivos de corte y la configuración
  // leída del entorno.
  const texto = await pedirConCadenaDeModelos(
    cliente,
    construirMensajeUsuario(VIDEOS),
    construirSystemPrompt(TOTAL_PREGUNTAS),
    "prueba-de-humo",
  );

  const segundos = ((Date.now() - inicio) / 1000).toFixed(1);
  console.log(`✅ 1/5 — La API respondió en ${segundos}s (clave y modelo válidos).`);

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
    // Con un total, lo que se exige no es una cuota por video sino COBERTURA:
    // habiendo 3 preguntas para 2 lecciones, ninguna puede quedarse vacía.
    const marca = suyas.length > 0 ? "  " : "⚠️";
    console.log(`   ${marca} «${video.title}»: ${suyas.length} pregunta(s)`);
    if (suyas.length === 0) repartoOk = false;
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
      ? `✅ 4/5 — Las ${VIDEOS.length} lecciones quedaron cubiertas.`
      : "⚠️  4/5 — Alguna lección quedó sin preguntas (el pipeline lo absorbe y lo registra, no falla).",
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
