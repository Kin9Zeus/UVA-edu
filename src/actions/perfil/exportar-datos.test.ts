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
  ["comentarios", "comentarios"],
  ["comunidad_posts", "comunidad_posts"],
  ["comunidad_respuestas", "comunidad_respuestas"],
  ["curso_calificaciones", "calificaciones_de_curso"],
  ["notificaciones", "notificaciones"],
  ["notas_leccion", "notas"],
  ["actividad_diaria", "dias_de_estudio"],
  ["consentimientos", "consentimientos"],
];

beforeEach(() => {
  servidorFalso.reiniciar();
  vi.mocked(getUsuarioActual).mockResolvedValue({ id: USUARIO } as never);
  vi.mocked(logError).mockClear();
  servidorFalso.responder("from:perfiles", { data: { nombre: "Ana", correo: "ana@x.co" } });
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
    expect(Object.keys(datos).sort()).toEqual(["exportado_en", "perfil", ...SECCIONES.map(([, s]) => s)].sort());
    expect(datos.perfil).toEqual({ nombre: "Ana", correo: "ana@x.co" });
    expect(datos.dias_de_estudio).toEqual(["2026-11-20", "2026-11-21"]);
    expect(datos.consentimientos).toHaveLength(1);
    expect(datos.certificados).toEqual([]);
  });

  it("los comentarios, publicaciones y reseñas borrados no salen", async () => {
    await exportarMisDatos();

    for (const tabla of ["comentarios", "comunidad_posts", "comunidad_respuestas", "curso_calificaciones"]) {
      expect(servidorFalso.encadenado(`from:${tabla}`, "eq"), tabla).toContainEqual(["eliminado", false]);
    }
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
