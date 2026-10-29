import { describe, expect, it } from "vitest";
import {
  anclaDeTitulo,
  aSegmentos,
  corchetesSinResolver,
  indiceDeBloques,
  parsearBloques,
  textoPlano,
  type Bloque,
} from "@/lib/legal/bloques";

const TEXTO_VALIDO: unknown[] = [
  { tipo: "titulo", nivel: 2, texto: "1. Quiénes somos y aceptación" },
  { tipo: "parrafo", contenido: "Estos términos regulan el uso de la plataforma." },
  {
    tipo: "parrafo",
    contenido: [
      { texto: "Alcance. ", negrita: true },
      { texto: "Más en la " },
      { texto: "política", enlace: "/legal/datos-personales" },
    ],
  },
  { tipo: "lista", ordenada: true, items: ["Uno", "Dos"] },
  {
    tipo: "tabla",
    columnas: ["Norma", "Qué nos exige"],
    filas: [["Ley 1581 de 2012", "Autorización previa, expresa e informada"]],
  },
  { tipo: "nota", contenido: "Decisión de diseño: el estándar más exigente." },
];

describe("parsearBloques", () => {
  it("acepta un texto con todos los tipos de bloque", () => {
    expect(parsearBloques(TEXTO_VALIDO)).toHaveLength(6);
  });

  it("rechaza lo que no es una lista", () => {
    expect(() => parsearBloques({ tipo: "parrafo", contenido: "x" })).toThrow(/no es válido/);
  });

  it("rechaza una lista vacía: un texto legal sin contenido no se publica", () => {
    expect(() => parsearBloques([])).toThrow(/no es válido/);
  });

  it("rechaza un tipo de bloque desconocido (no hay dónde meter HTML ni scripts)", () => {
    expect(() => parsearBloques([{ tipo: "html", contenido: "<script>alert(1)</script>" }])).toThrow();
  });

  it("rechaza enlaces javascript:, data: y http plano", () => {
    for (const enlace of ["javascript:alert(1)", "data:text/html,x", "http://uva.com", "//otro-dominio.com"]) {
      expect(() =>
        parsearBloques([{ tipo: "parrafo", contenido: [{ texto: "x", enlace }] }]),
        enlace,
      ).toThrow();
    }
  });

  it("acepta https, rutas del propio sitio y mailto", () => {
    for (const enlace of ["https://www.sic.gov.co", "/legal/terminos", "mailto:datos@uva.com"]) {
      expect(() =>
        parsearBloques([{ tipo: "parrafo", contenido: [{ texto: "x", enlace }] }]),
        enlace,
      ).not.toThrow();
    }
  });

  it("rechaza una tabla cuya fila no tiene tantas celdas como columnas", () => {
    expect(() =>
      parsearBloques([
        { tipo: "tabla", columnas: ["A", "B", "C"], filas: [["1", "2"]] },
      ]),
    ).toThrow(/celdas/);
  });

  it("rechaza un título de nivel distinto de 2 o 3", () => {
    expect(() => parsearBloques([{ tipo: "titulo", nivel: 1, texto: "x" }])).toThrow();
  });

  it("rechaza colecciones desmedidas sin colgarse", () => {
    const muchos = Array.from({ length: 1_001 }, () => ({ tipo: "parrafo", contenido: "x" }));
    expect(() => parsearBloques(muchos)).toThrow();
  });
});

describe("anclaDeTitulo", () => {
  it("quita tildes, signos y espacios", () => {
    expect(anclaDeTitulo("1. Quiénes somos y aceptación")).toBe("1-quienes-somos-y-aceptacion");
    expect(anclaDeTitulo("  ¿Qué datos tratamos?  ")).toBe("que-datos-tratamos");
  });

  it("nunca devuelve una ancla vacía", () => {
    expect(anclaDeTitulo("¿¡?!")).toBe("seccion");
  });
});

describe("indiceDeBloques", () => {
  it("lista los títulos en orden, con su nivel", () => {
    const bloques = parsearBloques([
      { tipo: "titulo", nivel: 2, texto: "Uno" },
      { tipo: "parrafo", contenido: "x" },
      { tipo: "titulo", nivel: 3, texto: "Uno punto uno" },
    ]);
    expect(indiceDeBloques(bloques)).toEqual([
      { id: "uno", texto: "Uno", nivel: 2 },
      { id: "uno-punto-uno", texto: "Uno punto uno", nivel: 3 },
    ]);
  });

  it("no repite anclas: el segundo título igual lleva sufijo", () => {
    const bloques = parsearBloques([
      { tipo: "titulo", nivel: 2, texto: "Cambios" },
      { tipo: "titulo", nivel: 2, texto: "Cambios" },
      { tipo: "titulo", nivel: 2, texto: "Cambios" },
    ]);
    expect(indiceDeBloques(bloques).map((e) => e.id)).toEqual(["cambios", "cambios-2", "cambios-3"]);
  });
});

describe("corchetesSinResolver", () => {
  const con = (contenido: unknown, extra: unknown[] = []): Bloque[] =>
    parsearBloques([{ tipo: "parrafo", contenido }, ...extra]);

  it("no encuentra nada en un texto completo", () => {
    expect(corchetesSinResolver(con("Operada por Arquitectura UVA S.A.S., NIT 900.123.456-7."))).toEqual([]);
  });

  it("encuentra datos pendientes en párrafos, listas, tablas, notas y en el título", () => {
    const bloques = parsearBloques([
      { tipo: "parrafo", contenido: "Sociedad [RAZÓN SOCIAL], NIT [NIT]." },
      { tipo: "lista", ordenada: false, items: ["Correo [datospersonales@DOMINIO]"] },
      { tipo: "tabla", columnas: ["Proveedor", "País"], filas: [["Supabase", "[PAÍS]"]] },
      { tipo: "nota", contenido: "Se conserva [90] días." },
    ]);
    expect(corchetesSinResolver(bloques, "Versión [1.0]").sort()).toEqual(
      ["[1.0]", "[90]", "[NIT]", "[PAÍS]", "[RAZÓN SOCIAL]", "[datospersonales@DOMINIO]"].sort(),
    );
  });

  it("cuenta cada marcador una sola vez aunque se repita", () => {
    expect(corchetesSinResolver(con("[NIT] y otra vez [NIT]"))).toEqual(["[NIT]"]);
  });

  it("lee también el texto con formato (negritas y enlaces)", () => {
    expect(
      corchetesSinResolver(
        con([{ texto: "Dominio " }, { texto: "[DOMINIO]", negrita: true }]),
      ),
    ).toEqual(["[DOMINIO]"]);
  });

  it("una llave o paréntesis no cuentan", () => {
    expect(corchetesSinResolver(con("Ley 1581 (de 2012) y {otro}"))).toEqual([]);
  });
});

describe("aSegmentos / textoPlano", () => {
  it("una cadena simple es un solo tramo", () => {
    expect(aSegmentos("hola")).toEqual([{ texto: "hola" }]);
  });

  it("une los tramos sin formato", () => {
    expect(textoPlano([{ texto: "Hola ", negrita: true }, { texto: "mundo" }])).toBe("Hola mundo");
  });
});
