import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CAMPOS_PREGUNTA_GENERADA,
  DISPARADORES_GENERACION,
  ESQUEMA_RESPUESTA_GEMINI,
  OPCIONES_POR_PREGUNTA,
  TranscripcionesFaltantesError,
  preguntaGeneradaSchema,
} from "./tipos";

const MIGRACION = join(
  process.cwd(),
  "prisma/migrations/20260909000000_generacion_examenes_ia/migration.sql",
);

describe("DISPARADORES_GENERACION", () => {
  /**
   * La constante de TypeScript y el CHECK de Postgres son la misma verdad
   * escrita dos veces. Este test es lo que impide que se separen — mismo
   * patrón que el test de `ProveedorWebhook` contra el CHECK de
   * `eventos_webhook`.
   *
   * Si se separan, el síntoma en producción es un INSERT que revienta con
   * "violates check constraint" recién cuando alguien usa el disparador nuevo.
   */
  it("coincide con el CHECK de trabajos_generacion_examen en la migración", () => {
    const sql = readFileSync(MIGRACION, "utf8");
    const check = sql.match(/"disparado_por" IN \(([^)]+)\)/);

    expect(check, "no se encontró el CHECK de disparado_por en la migración").not.toBeNull();

    const enLaBase = check![1]
      .split(",")
      .map((valor) => valor.trim().replace(/^'|'$/g, ""))
      .sort();

    expect(enLaBase).toEqual([...DISPARADORES_GENERACION].sort());
  });
});

describe("preguntaGeneradaSchema", () => {
  const valida = {
    videoId: "9f1c3b2a-0000-4000-8000-000000000001",
    question: "¿Qué controla la subdivisión de la luz?",
    options: ["El ruido", "El color", "La cámara", "El formato"],
    correctAnswerIndex: 0,
    sourceFragment: "controla el ruido de la imagen final",
  };

  it("acepta una pregunta bien formada", () => {
    expect(preguntaGeneradaSchema.parse(valida)).toMatchObject({ correctAnswerIndex: 0 });
  });

  it("rechaza un número de opciones distinto del pactado", () => {
    expect(
      preguntaGeneradaSchema.safeParse({ ...valida, options: ["Solo", "Dos"] }).success,
    ).toBe(false);
  });

  // `correctAnswerIndex` fuera de rango apuntaría a una opción inexistente:
  // la pregunta se guardaría sin ninguna marcada como correcta y sería
  // imposible de aprobar.
  it("rechaza un índice de respuesta fuera de rango", () => {
    expect(
      preguntaGeneradaSchema.safeParse({ ...valida, correctAnswerIndex: OPCIONES_POR_PREGUNTA })
        .success,
    ).toBe(false);
    expect(preguntaGeneradaSchema.safeParse({ ...valida, correctAnswerIndex: -1 }).success).toBe(
      false,
    );
  });

  it("rechaza una pregunta sin fragmento de origen", () => {
    expect(preguntaGeneradaSchema.safeParse({ ...valida, sourceFragment: "   " }).success).toBe(
      false,
    );
  });
});

describe("ESQUEMA_RESPUESTA_GEMINI", () => {
  const propsPregunta = ESQUEMA_RESPUESTA_GEMINI.properties.questions.items.properties;

  /**
   * El schema de Zod y el de Gemini son el mismo contrato escrito dos veces (no
   * se puede derivar uno del otro: el dialecto de Gemini no admite
   * `minLength`/`maxLength`). Este test es lo que impide que se separen.
   *
   * Sin él, agregar un campo al schema de Zod y olvidarlo en el de Gemini
   * produce el peor fallo posible: el modelo nunca emite ese campo, Zod lo
   * rechaza, y TODAS las preguntas se descartan en silencio salvo por un log.
   */
  it("enumera exactamente los mismos campos que el schema de Zod", () => {
    const enZod = Object.keys(preguntaGeneradaSchema.shape).sort();
    const enGemini = Object.keys(propsPregunta).sort();

    expect(enGemini).toEqual(enZod);
    expect(enGemini).toEqual([...CAMPOS_PREGUNTA_GENERADA].sort());
  });

  it("exige todos los campos: uno opcional dejaría pasar preguntas a medias", () => {
    expect([...ESQUEMA_RESPUESTA_GEMINI.properties.questions.items.required].sort()).toEqual(
      [...CAMPOS_PREGUNTA_GENERADA].sort(),
    );
  });

  // Si estos límites se separan de OPCIONES_POR_PREGUNTA, el servidor deja
  // pasar un número de opciones que `aOpcionesPregunta()` no sabe mapear.
  it("fija el número de opciones al mismo valor que la constante", () => {
    expect(propsPregunta.options.minItems).toBe(OPCIONES_POR_PREGUNTA);
    expect(propsPregunta.options.maxItems).toBe(OPCIONES_POR_PREGUNTA);
    expect(propsPregunta.correctAnswerIndex.maximum).toBe(OPCIONES_POR_PREGUNTA - 1);
  });

  // El dialecto de Gemini ignora o rechaza las palabras clave fuera de su
  // subconjunto; `minLength`/`maxLength` son las que este schema estaría
  // tentado de heredar de Zod.
  it("no usa palabras clave que el dialecto de Gemini no admite", () => {
    const serializado = JSON.stringify(ESQUEMA_RESPUESTA_GEMINI);
    expect(serializado).not.toContain("minLength");
    expect(serializado).not.toContain("maxLength");
    expect(serializado).not.toContain("additionalProperties");
  });
});

describe("TranscripcionesFaltantesError", () => {
  it("nombra los videos que faltan, que es para lo que existe", () => {
    const error = new TranscripcionesFaltantesError([
      { videoId: "a", title: "Iluminación global" },
      { videoId: "b", title: "Cámara física" },
    ]);

    expect(error.message).toContain("Iluminación global");
    expect(error.message).toContain("Cámara física");
    expect(error.videosFaltantes).toHaveLength(2);
  });

  it("concuerda en singular con un solo video", () => {
    const error = new TranscripcionesFaltantesError([{ videoId: "a", title: "Intro" }]);
    expect(error.message).toContain("video todavía no tiene");
  });
});
