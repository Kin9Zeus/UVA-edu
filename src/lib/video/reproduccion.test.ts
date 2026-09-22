import { beforeEach, describe, expect, it, vi } from "vitest";
import { crearCliente, servidorFalso } from "@/test/servidor-falso";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * El token de reproducción: `{ error }` solo para respuestas definitivas; un
 * fallo de la base LANZA (AUDIT-2026-09-22.md, seguimiento de P2-3).
 *
 * La diferencia importa en VideoPlayer.tsx: un `{ error }` reemplaza el video
 * por el mensaje y no vuelve a preguntar hasta la próxima renovación (~12
 * min); una excepción conserva el token vigente y reintenta pronto. Antes, un
 * fallo al renovar cortaba la clase con "No tienes acceso vigente".
 */
vi.mock("@/lib/mux/client", () => import("@/test/servidor-falso").then((m) => m.moduloMuxCliente()));
vi.mock("@/lib/log", () => import("@/test/servidor-falso").then((m) => m.moduloLog()));

const { resolverTokenReproduccion } = await import("@/lib/video/reproduccion");

const ERROR_PG = { message: "canceling statement due to statement timeout", code: "57014" };
const EN_UN_MES = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

const cliente = () => crearCliente("sesion") as unknown as SupabaseClient;

/** `l2` es la segunda clase: no es la introducción pública, exige acceso. */
function cursoConDosClases() {
  servidorFalso.responder("from:lecciones", {
    data: { id_video_mux: "pb2", estado_procesamiento: "LISTO", modulo: { id_curso: "k1" } },
    error: null,
  });
  servidorFalso.responder("from:modulos", {
    data: [{ id: "m1", orden: 10, lecciones: [{ id: "l1", orden: 10 }, { id: "l2", orden: 20 }] }],
    error: null,
  });
}

beforeEach(() => {
  servidorFalso.reiniciar();
  servidorFalso.conUsuario({ id: "u1" });
});

describe("resolverTokenReproduccion", () => {
  it("con suscripción vigente: firma el token", async () => {
    cursoConDosClases();
    servidorFalso.responder("from:suscripciones", {
      data: { estado: "ACTIVA", fecha_renovacion: EN_UN_MES },
      error: null,
    });

    const resultado = await resolverTokenReproduccion(cliente(), "l2");

    expect(resultado).toMatchObject({ playbackId: "pb2" });
    expect(servidorFalso.efectosExternos).toContain("mux.jwt.signPlaybackId");
  });

  it("sin acceso de verdad: `{ error }` definitivo, sin firmar", async () => {
    cursoConDosClases();

    expect(await resolverTokenReproduccion(cliente(), "l2")).toEqual({
      error: "No tienes acceso vigente a este curso.",
    });
    expect(servidorFalso.efectosExternos).toHaveLength(0);
  });

  it("si falla la verificación de acceso: LANZA, no responde 'No tienes acceso vigente'", async () => {
    cursoConDosClases();
    servidorFalso.responder("from:suscripciones", { data: null, error: ERROR_PG });

    await expect(resolverTokenReproduccion(cliente(), "l2")).rejects.toThrow(/suscripciones falló/);
    expect(servidorFalso.efectosExternos).toHaveLength(0);
  });

  it("si falla la lectura de la lección: LANZA, no responde 'El video todavía no está disponible'", async () => {
    servidorFalso.responder("from:lecciones", { data: null, error: ERROR_PG });

    await expect(resolverTokenReproduccion(cliente(), "l2")).rejects.toThrow(/lecciones falló/);
  });

  it("si falla la consulta de la clase introductoria: LANZA en vez de tratarla como clase paga", async () => {
    // Sin sesión: antes el fallo hacía que la vista previa pública
    // respondiera "Debes iniciar sesión".
    servidorFalso.conUsuario(null);
    servidorFalso.responder("from:lecciones", {
      data: { id_video_mux: "pb1", estado_procesamiento: "LISTO", modulo: { id_curso: "k1" } },
      error: null,
    });
    servidorFalso.responder("from:modulos", { data: null, error: ERROR_PG });

    await expect(resolverTokenReproduccion(cliente(), "l1")).rejects.toThrow(/esLeccionIntroductoria falló/);
  });

  it("la clase introductoria se firma sin sesión (vista previa pública)", async () => {
    servidorFalso.conUsuario(null);
    cursoConDosClases();
    servidorFalso.responder("from:lecciones", {
      data: { id_video_mux: "pb1", estado_procesamiento: "LISTO", modulo: { id_curso: "k1" } },
      error: null,
    });

    expect(await resolverTokenReproduccion(cliente(), "l1")).toMatchObject({ playbackId: "pb1" });
  });
});
