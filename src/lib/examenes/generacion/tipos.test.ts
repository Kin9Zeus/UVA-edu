import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CAMPOS_PREGUNTA_GENERADA,
  DISPARADORES_GENERACION,
  ESQUEMAS_POR_TIPO,
  ESQUEMA_RESPUESTA_GEMINI,
  MAXIMO_PARES_EMPAREJAR_GENERADOS,
  MINIMO_PARES_EMPAREJAR_GENERADOS,
  OPCIONES_POR_PREGUNTA,
  TIPOS_GENERABLES,
  TranscripcionesFaltantesError,
  preguntaEmparejarSchema,
  preguntaGeneradaSchema,
  preguntaOpcionUnicaSchema,
  preguntaVerdaderoFalsoSchema,
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
  const opcionUnica = {
    tipo: "OPCION_UNICA" as const,
    videoId: "9f1c3b2a-0000-4000-8000-000000000001",
    question: "¿Qué controla la subdivisión de la luz?",
    options: ["El ruido", "El color", "La cámara", "El formato"],
    correctAnswerIndex: 0,
    sourceFragment: "controla el ruido de la imagen final",
  };

  it("acepta una pregunta OPCION_UNICA bien formada", () => {
    expect(preguntaGeneradaSchema.parse(opcionUnica)).toMatchObject({ correctAnswerIndex: 0 });
  });

  it("rechaza un número de opciones distinto del pactado", () => {
    expect(
      preguntaGeneradaSchema.safeParse({ ...opcionUnica, options: ["Solo", "Dos"] }).success,
    ).toBe(false);
  });

  // `correctAnswerIndex` fuera de rango apuntaría a una opción inexistente:
  // la pregunta se guardaría sin ninguna marcada como correcta y sería
  // imposible de aprobar.
  it("rechaza un índice de respuesta fuera de rango", () => {
    expect(
      preguntaGeneradaSchema.safeParse({ ...opcionUnica, correctAnswerIndex: OPCIONES_POR_PREGUNTA })
        .success,
    ).toBe(false);
    expect(preguntaGeneradaSchema.safeParse({ ...opcionUnica, correctAnswerIndex: -1 }).success).toBe(
      false,
    );
  });

  it("rechaza una pregunta sin fragmento de origen", () => {
    expect(preguntaGeneradaSchema.safeParse({ ...opcionUnica, sourceFragment: "   " }).success).toBe(
      false,
    );
  });

  it("rechaza un tipo que no existe", () => {
    expect(preguntaGeneradaSchema.safeParse({ ...opcionUnica, tipo: "RELLENO" }).success).toBe(false);
  });

  describe("VERDADERO_FALSO", () => {
    it("acepta una afirmación con su valor de verdad", () => {
      const resultado = preguntaVerdaderoFalsoSchema.safeParse({
        tipo: "VERDADERO_FALSO",
        videoId: "v1",
        question: "El concreto se mide en metros cúbicos.",
        correctAnswer: true,
        sourceFragment: "el concreto se mide en metros cúbicos",
      });
      expect(resultado.success).toBe(true);
    });
  });

  describe("EMPAREJAR", () => {
    const pares = Array.from({ length: MINIMO_PARES_EMPAREJAR_GENERADOS }, (_, i) => ({
      left: `Término ${i}`,
      right: `Definición ${i}`,
    }));

    it("acepta el mínimo de pares", () => {
      const resultado = preguntaEmparejarSchema.safeParse({
        tipo: "EMPAREJAR",
        videoId: "v1",
        question: "Relaciona cada término con su definición.",
        pairs: pares,
        sourceFragment: "da igual",
      });
      expect(resultado.success).toBe(true);
    });

    it("rechaza menos pares que el mínimo: con dos se responde por descarte", () => {
      const resultado = preguntaEmparejarSchema.safeParse({
        tipo: "EMPAREJAR",
        videoId: "v1",
        question: "Relaciona.",
        pairs: pares.slice(0, MINIMO_PARES_EMPAREJAR_GENERADOS - 1),
        sourceFragment: "da igual",
      });
      expect(resultado.success).toBe(false);
    });

    it("rechaza texto repetido en la misma columna", () => {
      const resultado = preguntaEmparejarSchema.safeParse({
        tipo: "EMPAREJAR",
        videoId: "v1",
        question: "Relaciona.",
        pairs: [...pares, { left: pares[0].left, right: "Otra definición" }],
        sourceFragment: "da igual",
      });
      expect(resultado.success).toBe(false);
    });

    it("rechaza más pares que el máximo", () => {
      const demasiados = Array.from({ length: MAXIMO_PARES_EMPAREJAR_GENERADOS + 1 }, (_, i) => ({
        left: `Término ${i}`,
        right: `Definición ${i}`,
      }));
      const resultado = preguntaEmparejarSchema.safeParse({
        tipo: "EMPAREJAR",
        videoId: "v1",
        question: "Relaciona.",
        pairs: demasiados,
        sourceFragment: "da igual",
      });
      expect(resultado.success).toBe(false);
    });
  });
});

describe("ESQUEMA_RESPUESTA_GEMINI", () => {
  /**
   * El schema de Zod y el de Gemini son el mismo contrato escrito dos veces
   * (no se puede derivar uno del otro: el dialecto de Gemini no admite
   * `minLength`/`maxLength`). Este test es lo que impide que se separen, rama
   * por rama.
   *
   * Sin él, agregar un campo a una rama de Zod y olvidarlo en su rama de
   * Gemini produce el peor fallo posible: el modelo nunca emite ese campo,
   * Zod lo rechaza, y TODAS las preguntas de ese tipo se descartan en
   * silencio salvo por un log.
   */
  const schemasPorTipo = {
    OPCION_UNICA: preguntaOpcionUnicaSchema,
    VERDADERO_FALSO: preguntaVerdaderoFalsoSchema,
    EMPAREJAR: preguntaEmparejarSchema,
  } as const;

  it("tiene una rama de Gemini por cada tipo generable, ni una de más ni de menos", () => {
    expect(Object.keys(ESQUEMAS_POR_TIPO).sort()).toEqual([...TIPOS_GENERABLES].sort());
  });

  for (const tipo of TIPOS_GENERABLES) {
    it(`${tipo}: enumera exactamente los mismos campos que su schema de Zod`, () => {
      const enZod = Object.keys(schemasPorTipo[tipo].shape).sort();
      const enGemini = Object.keys(ESQUEMAS_POR_TIPO[tipo].properties).sort();

      expect(enGemini).toEqual(enZod);
    });

    it(`${tipo}: exige todos sus campos, uno opcional dejaría pasar preguntas a medias`, () => {
      const enZod = Object.keys(schemasPorTipo[tipo].shape).sort();
      expect([...ESQUEMAS_POR_TIPO[tipo].required].sort()).toEqual(enZod);
    });
  }

  it("todas las ramas comparten los campos universales de CAMPOS_PREGUNTA_GENERADA", () => {
    for (const tipo of TIPOS_GENERABLES) {
      const enGemini = Object.keys(ESQUEMAS_POR_TIPO[tipo].properties);
      for (const campo of CAMPOS_PREGUNTA_GENERADA) {
        expect(enGemini).toContain(campo);
      }
    }
  });

  // Si estos límites se separan de OPCIONES_POR_PREGUNTA, el servidor deja
  // pasar un número de opciones que `aOpcionesPregunta()` no sabe mapear.
  it("fija el número de opciones al mismo valor que la constante", () => {
    expect(ESQUEMAS_POR_TIPO.OPCION_UNICA.properties.options.minItems).toBe(OPCIONES_POR_PREGUNTA);
    expect(ESQUEMAS_POR_TIPO.OPCION_UNICA.properties.options.maxItems).toBe(OPCIONES_POR_PREGUNTA);
    expect(ESQUEMAS_POR_TIPO.OPCION_UNICA.properties.correctAnswerIndex.maximum).toBe(
      OPCIONES_POR_PREGUNTA - 1,
    );
  });

  it("fija el rango de pares de EMPAREJAR a las mismas constantes", () => {
    expect(ESQUEMAS_POR_TIPO.EMPAREJAR.properties.pairs.minItems).toBe(
      MINIMO_PARES_EMPAREJAR_GENERADOS,
    );
    expect(ESQUEMAS_POR_TIPO.EMPAREJAR.properties.pairs.maxItems).toBe(
      MAXIMO_PARES_EMPAREJAR_GENERADOS,
    );
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
