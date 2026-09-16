import { beforeEach, describe, expect, it, vi } from "vitest";
import { servidorFalso } from "@/test/servidor-falso";

vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));
vi.mock("next/cache", () => import("@/test/servidor-falso").then((m) => m.moduloNextCache()));
vi.mock("@/lib/log", () => import("@/test/servidor-falso").then((m) => m.moduloLog()));
vi.mock("@/lib/admin/bitacora", () => ({ registrarBitacora: vi.fn() }));
vi.mock("@/lib/resend", () => ({ enviarCorreoComunidadModerada: vi.fn() }));
vi.mock("@/lib/comunidad-adjuntos", () => ({ borrarAdjuntoComunidad: vi.fn() }));

import { eliminarPostComunidad, eliminarRespuestaComunidad } from "@/actions/comunidad/eliminar";
import { registrarBitacora } from "@/lib/admin/bitacora";
import { enviarCorreoComunidadModerada } from "@/lib/resend";
import { borrarAdjuntoComunidad } from "@/lib/comunidad-adjuntos";
import { logError } from "@/lib/log";

/**
 * Eliminar en Comunidad — AUDIT-2026-09-15.md, P2-8 Fase 3.
 *
 * Una sola acción con dos caminos muy distintos, decididos en TypeScript:
 *   · el AUTOR borra lo suyo: vaciado silencioso, sin rastro de moderación;
 *   · un ADMIN borra lo ajeno: exige motivo, guarda la evidencia ANTES de
 *     vaciar, deja bitácora, avisa al autor y cierra los reportes.
 * Y un tercero —un estudiante sobre contenido ajeno— no toca nada. RLS
 * también lo frenaría, pero entonces el error sería un fallo silencioso de
 * la query en vez de un mensaje, y el camino de admin nunca se validaría.
 */

const AUTORA = { id: "autora-1", email: "ana@uva.co" };
const OTRO = { id: "otro-2", email: "beto@uva.co" };
const ADMIN = { id: "admin-9", email: "admin@uva.co" };

const POST = { id_usuario: AUTORA.id, titulo: "Cómo modelar losas", contenido: "Texto original", eliminado: false };
const RESPUESTA = { id_usuario: AUTORA.id, id_post: "post-1", contenido: "Respuesta original", eliminado: false };

/** Toda escritura que dejaría huella, para afirmar "no tocó nada". */
function escrituras() {
  return servidorFalso.llamadas.filter((l) =>
    l.cadena.some((c) => ["update", "insert", "delete", "upsert"].includes(c.metodo)),
  );
}

beforeEach(() => {
  servidorFalso.reiniciar();
  vi.mocked(registrarBitacora).mockReset();
  vi.mocked(borrarAdjuntoComunidad).mockReset();
  vi.mocked(logError).mockClear();
  vi.mocked(enviarCorreoComunidadModerada).mockReset().mockResolvedValue({ success: true, id: "c-1" });
});

describe("eliminarPostComunidad", () => {
  beforeEach(() => {
    servidorFalso.responder("from:comunidad_posts", { data: POST });
    servidorFalso.responder("from:comunidad_adjuntos", {
      data: [{ id: "adj-1", ruta_storage: `${AUTORA.id}/post-1/adj-1.png` }],
    });
  });

  it("sin sesión no lee nada", async () => {
    expect(await eliminarPostComunidad("post-1", "/dashboard/comunidad")).toEqual({ error: "Debes iniciar sesión." });
    expect(servidorFalso.operaciones()).toEqual(["auth:getUser"]);
  });

  it("un estudiante sobre un post ajeno: rechazo y ninguna escritura", async () => {
    servidorFalso.conUsuario(OTRO);
    servidorFalso.responder("from:perfiles", { data: { rol: "ESTUDIANTE" } });

    expect(await eliminarPostComunidad("post-1", "/dashboard/comunidad", "spam")).toEqual({
      error: "No tienes permiso para eliminar esta publicación.",
    });
    expect(escrituras()).toEqual([]);
    expect(borrarAdjuntoComunidad).not.toHaveBeenCalled();
    expect(registrarBitacora).not.toHaveBeenCalled();
    expect(servidorFalso.revalidaciones).toEqual([]);
  });

  it("un post ya eliminado responde éxito sin volver a escribir (idempotente)", async () => {
    servidorFalso.conUsuario(AUTORA);
    servidorFalso.responder("from:comunidad_posts", { data: { ...POST, eliminado: true } });

    expect(await eliminarPostComunidad("post-1", "/r")).toEqual({ success: true });
    expect(escrituras()).toEqual([]);
  });

  describe("la autora borra lo suyo", () => {
    beforeEach(() => servidorFalso.conUsuario(AUTORA));

    it("vacía título y contenido, borra adjuntos y NO deja rastro de moderación", async () => {
      expect(await eliminarPostComunidad("post-1", "/dashboard/comunidad")).toEqual({ success: true });

      expect(servidorFalso.encadenado("from:comunidad_posts", "update")).toEqual([
        [{ eliminado: true, titulo: "", contenido: "" }],
      ]);
      expect(servidorFalso.encadenado("from:comunidad_posts", "eq")).toContainEqual(["id", "post-1"]);
      // No consulta su rol: ser autora ya basta.
      expect(servidorFalso.llamadasA("from:perfiles")).toHaveLength(0);
      expect(servidorFalso.llamadasA("from:comunidad_moderacion")).toHaveLength(0);
      expect(servidorFalso.llamadasA("from:comunidad_reportes")).toHaveLength(0);
      expect(borrarAdjuntoComunidad).toHaveBeenCalledWith(expect.anything(), "adj-1", `${AUTORA.id}/post-1/adj-1.png`);
      expect(registrarBitacora).not.toHaveBeenCalled();
      expect(enviarCorreoComunidadModerada).not.toHaveBeenCalled();
      expect(servidorFalso.revalidaciones).toEqual(["/dashboard/comunidad"]);
    });
  });

  describe("un administrador modera", () => {
    beforeEach(() => {
      servidorFalso.conUsuario(ADMIN);
      servidorFalso.responderEnOrden("from:perfiles", [
        { data: { rol: "ADMINISTRADOR" } },
        { data: { correo: "ana@uva.co", nombre: "Ana" } },
      ]);
    });

    it("sin motivo no borra nada", async () => {
      expect(await eliminarPostComunidad("post-1", "/r", "   ")).toEqual({
        error: "Escribe el motivo de la eliminación.",
      });
      expect(escrituras()).toEqual([]);
    });

    it("guarda la evidencia ANTES de vaciar el post, y luego bitácora, aviso y reportes", async () => {
      expect(await eliminarPostComunidad("post-1", "/admin/comunidad", "  Spam comercial ")).toEqual({
        success: true,
      });

      expect(servidorFalso.encadenado("from:comunidad_moderacion", "insert")).toEqual([
        [
          {
            id_post: "post-1",
            contenido_original: "Cómo modelar losas\n\nTexto original",
            id_eliminado_por: ADMIN.id,
            motivo: "Spam comercial",
          },
        ],
      ]);

      const operaciones = servidorFalso.operaciones();
      const evidencia = operaciones.indexOf("from:comunidad_moderacion");
      const vaciado = operaciones.lastIndexOf("from:comunidad_posts");
      expect(evidencia).toBeGreaterThan(-1);
      expect(evidencia).toBeLessThan(vaciado);

      expect(registrarBitacora).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ idAdmin: ADMIN.id, idEntidadAfectada: "post-1" }),
      );
      expect(enviarCorreoComunidadModerada).toHaveBeenCalledWith(
        "ana@uva.co",
        "Ana",
        "publicación",
        "Cómo modelar losas",
        "Spam comercial",
        "http://localhost:3000/dashboard/comunidad",
      );
      // El aviso va a la AUTORA, no a quien modera.
      expect(servidorFalso.encadenado("from:perfiles", "eq")).toEqual([
        ["id", ADMIN.id],
        ["id", AUTORA.id],
      ]);
      expect(servidorFalso.encadenado("from:comunidad_reportes", "update")).toEqual([[{ revisado: true }]]);
      expect(servidorFalso.encadenado("from:comunidad_reportes", "eq")).toEqual([["id_post", "post-1"]]);
    });

    it("si no se pudo guardar la evidencia, el post NO se vacía", async () => {
      // Sin la fila de moderación, el contenido original se perdería sin
      // rastro de quién lo borró ni por qué.
      servidorFalso.responder("from:comunidad_moderacion", { error: { message: "insert falló" } });

      expect(await eliminarPostComunidad("post-1", "/r", "Spam")).toEqual({
        error: "No pudimos eliminar la publicación.",
      });
      expect(servidorFalso.encadenado("from:comunidad_posts", "update")).toEqual([]);
      expect(registrarBitacora).not.toHaveBeenCalled();
    });

    it("si el correo al autor falla, la moderación se mantiene y queda registrado", async () => {
      vi.mocked(enviarCorreoComunidadModerada).mockResolvedValue({ success: false, error: "Resend caído" });

      expect(await eliminarPostComunidad("post-1", "/r", "Spam")).toEqual({ success: true });
      expect(logError).toHaveBeenCalledWith(
        "comunidad:moderacion",
        "enviarCorreoComunidadModerada falló",
        expect.any(Error),
        { area: "email" },
      );
    });
  });
});

describe("eliminarRespuestaComunidad", () => {
  beforeEach(() => {
    servidorFalso.responder("from:comunidad_respuestas", { data: RESPUESTA });
    servidorFalso.responder("from:comunidad_adjuntos", { data: [] });
  });

  it("un estudiante sobre una respuesta ajena: rechazo y ninguna escritura", async () => {
    servidorFalso.conUsuario(OTRO);
    servidorFalso.responder("from:perfiles", { data: { rol: "ESTUDIANTE" } });

    expect(await eliminarRespuestaComunidad("resp-1", "/r")).toEqual({
      error: "No tienes permiso para eliminar esta respuesta.",
    });
    expect(escrituras()).toEqual([]);
  });

  it("la autora la vacía sin moderación", async () => {
    servidorFalso.conUsuario(AUTORA);

    expect(await eliminarRespuestaComunidad("resp-1", "/r")).toEqual({ success: true });
    expect(servidorFalso.encadenado("from:comunidad_respuestas", "update")).toEqual([
      [{ eliminado: true, contenido: "" }],
    ]);
    expect(servidorFalso.llamadasA("from:comunidad_moderacion")).toHaveLength(0);
  });

  it("un admin sin motivo no borra nada", async () => {
    servidorFalso.conUsuario(ADMIN);
    servidorFalso.responder("from:perfiles", { data: { rol: "ADMINISTRADOR" } });

    expect(await eliminarRespuestaComunidad("resp-1", "/r")).toEqual({ error: "Escribe el motivo de la eliminación." });
    expect(escrituras()).toEqual([]);
  });

  it("un admin guarda la evidencia, cierra los reportes de ESA respuesta y avisa con el título del post", async () => {
    servidorFalso.conUsuario(ADMIN);
    servidorFalso.responderEnOrden("from:perfiles", [
      { data: { rol: "ADMINISTRADOR" } },
      { data: { correo: "ana@uva.co", nombre: "Ana" } },
    ]);
    servidorFalso.responder("from:comunidad_posts", { data: { titulo: "Cómo modelar losas" } });

    expect(await eliminarRespuestaComunidad("resp-1", "/r", "Ofensivo")).toEqual({ success: true });

    expect(servidorFalso.encadenado("from:comunidad_moderacion", "insert")).toEqual([
      [{ id_respuesta: "resp-1", contenido_original: "Respuesta original", id_eliminado_por: ADMIN.id, motivo: "Ofensivo" }],
    ]);
    expect(servidorFalso.encadenado("from:comunidad_reportes", "eq")).toEqual([["id_respuesta", "resp-1"]]);
    expect(enviarCorreoComunidadModerada).toHaveBeenCalledWith(
      "ana@uva.co",
      "Ana",
      "respuesta",
      "Cómo modelar losas",
      "Ofensivo",
      expect.any(String),
    );
  });
});
