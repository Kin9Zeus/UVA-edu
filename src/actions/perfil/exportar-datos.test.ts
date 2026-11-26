import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { servidorFalso } from "@/test/servidor-falso";

vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));
vi.mock("@/lib/supabase/admin", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseAdmin()));
vi.mock("@/lib/log", () => import("@/test/servidor-falso").then((m) => m.moduloLog()));
vi.mock("@/lib/perfil", () => ({ getUsuarioActual: vi.fn() }));

import { getUsuarioActual } from "@/lib/perfil";
import { logError } from "@/lib/log";
import { exportarMisDatos } from "@/actions/perfil/exportar-datos";

/**
 * «Descargar mis datos» (Habeas Data, Ley 1581 art. 8). P2-12,
 * AUDIT-2026-11-23: una exportación a medias entregada como completa es peor
 * que un error.
 */

const USUARIO = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ERROR_PG = { message: "canceling statement due to statement timeout", code: "57014" };

/** Tablas con datos de la persona, y la sección del JSON en que salen. */
const SECCIONES: [tabla: string, seccion: string][] = [
  ["suscripciones", "suscripciones"],
  ["inscripciones", "inscripciones"],
  ["progreso", "progreso"],
  ["certificados", "certificados"],
  ["intentos_examen", "intentos_examen"],
  ["intentos_pago", "intentos_de_pago"],
  ["notificaciones", "notificaciones"],
  ["notas_leccion", "notas"],
  ["actividad_diaria", "dias_de_estudio"],
  ["consentimientos", "consentimientos"],
];

/**
 * Lo que RLS esconde sin acceso vigente sale de `exportar_mi_actividad`
 * (supabase/sql/141), una sección por clave.
 */
const SECCIONES_ACTIVIDAD = [
  "comentarios",
  "me_gusta_en_comentarios",
  "comunidad_posts",
  "comunidad_respuestas",
  "comunidad_reacciones",
  "comunidad_adjuntos",
  "comunidad_reportes_enviados",
  "calificaciones_de_curso",
  "reacciones_a_calificaciones",
];

beforeEach(() => {
  servidorFalso.reiniciar();
  vi.mocked(getUsuarioActual).mockResolvedValue({ id: USUARIO } as never);
  vi.mocked(logError).mockClear();
  servidorFalso.responder("from:perfiles", { data: { nombre: "Ana", correo: "ana@x.co" } });
  servidorFalso.responder("rpc:exportar_mi_actividad", {
    data: Object.fromEntries(SECCIONES_ACTIVIDAD.map((s) => [s, []])),
  });
});

describe("exportarMisDatos", () => {
  it("sin sesión no consulta nada", async () => {
    vi.mocked(getUsuarioActual).mockResolvedValue(null);

    expect(await exportarMisDatos()).toEqual({ error: "Debes iniciar sesión." });
    expect(servidorFalso.llamadas).toHaveLength(0);
  });

  it("lee todo con la sesión (RLS) y cada consulta filtrada por la propia persona", async () => {
    await exportarMisDatos();

    expect(servidorFalso.clientesCreados.admin ?? 0).toBe(0);
    expect(servidorFalso.encadenado("from:perfiles", "eq")).toEqual([["id", USUARIO]]);
    for (const [tabla] of SECCIONES) {
      expect(servidorFalso.encadenado(`from:${tabla}`, "eq"), tabla).toContainEqual(["id_usuario", USUARIO]);
    }
  });

  it("entrega un JSON con todas las secciones, vacías como [] y los días como fechas", async () => {
    servidorFalso.responder("from:consentimientos", {
      data: [{ tipo: "terminos", version_texto: "2026-11", origen: "registro-correo", aceptado_en: "2026-11-24" }],
    });
    servidorFalso.responder("from:actividad_diaria", { data: [{ fecha: "2026-11-20" }, { fecha: "2026-11-21" }] });

    const resultado = await exportarMisDatos();

    if (!("success" in resultado)) throw new Error(resultado.error);
    expect(resultado.nombreArchivo).toMatch(/^uva-mis-datos-\d{4}-\d{2}-\d{2}\.json$/);
    const datos = JSON.parse(resultado.datos);
    expect(Object.keys(datos).sort()).toEqual(
      ["exportado_en", "perfil", ...SECCIONES.map(([, s]) => s), ...SECCIONES_ACTIVIDAD].sort(),
    );
    expect(datos.perfil).toEqual({ nombre: "Ana", correo: "ana@x.co" });
    expect(datos.dias_de_estudio).toEqual(["2026-11-20", "2026-11-21"]);
    expect(datos.consentimientos).toHaveLength(1);
    expect(datos.certificados).toEqual([]);
  });

  it("si exportar_mi_actividad falla o no devuelve nada, no entrega nada", async () => {
    servidorFalso.responder("rpc:exportar_mi_actividad", { data: null, error: ERROR_PG });
    expect(await exportarMisDatos()).toHaveProperty("error");
    expect(logError).toHaveBeenLastCalledWith(
      "exportarMisDatos",
      expect.any(String),
      ERROR_PG,
      expect.objectContaining({ secciones: ["actividad"] }),
    );

    servidorFalso.responder("rpc:exportar_mi_actividad", { data: null });
    expect(await exportarMisDatos()).toHaveProperty("error");
  });

  it.each(SECCIONES)("si falla %s, no entrega nada y registra qué sección falló", async (tabla, seccion) => {
    servidorFalso.responder(`from:${tabla}`, { data: null, error: ERROR_PG });

    expect(await exportarMisDatos()).toEqual({ error: "No pudimos armar tu exportación. Intenta de nuevo." });
    expect(logError).toHaveBeenCalledWith(
      "exportarMisDatos",
      expect.any(String),
      ERROR_PG,
      expect.objectContaining({ secciones: [seccion] }),
    );
  });

  it("si falla el perfil o no aparece, tampoco entrega nada", async () => {
    servidorFalso.responder("from:perfiles", { data: null, error: ERROR_PG });
    expect(await exportarMisDatos()).toHaveProperty("error");

    servidorFalso.responder("from:perfiles", { data: null, error: { message: "0 filas", code: "PGRST116" } });
    expect(await exportarMisDatos()).toHaveProperty("error");
    expect(logError).toHaveBeenLastCalledWith("exportarMisDatos", "No se encontró el perfil de la sesión actual", undefined, expect.anything());
  });
});

/**
 * Guardia (P3-8): toda tabla del esquema con datos de una persona sale en la
 * exportación (consulta directa o SQL 141) o está aquí con su motivo.
 */
const NO_SE_EXPORTAN: Record<string, string> = {
  perfiles: "Es la sección `perfil` (filtra por `id`, no por `id_usuario`).",
};

describe("cobertura de la exportación", () => {
  it("cada tabla con id_usuario o id_reportante se exporta", () => {
    const esquema = readFileSync("prisma/schema.prisma", "utf8");
    const accion = readFileSync("src/actions/perfil/exportar-datos.ts", "utf8");
    const sql141 = readFileSync("supabase/sql/141_exportar_mi_actividad.sql", "utf8");

    const conPersona = [...esquema.matchAll(/^model \w+ \{([\s\S]*?)^\}/gm)]
      .filter(([, cuerpo]) => /^\s+id_(?:usuario|reportante)\s/m.test(cuerpo))
      .map(([, cuerpo]) => /@@map\("([^"]+)"\)/.exec(cuerpo)![1]);

    expect(conPersona.length).toBeGreaterThan(15);
    const sinExportar = conPersona.filter(
      (tabla) =>
        !NO_SE_EXPORTAN[tabla] &&
        !accion.includes(`.from("${tabla}")`) &&
        !new RegExp(`from public\\.${tabla}\\b`).test(sql141),
    );
    expect(sinExportar).toEqual([]);
  });
});
