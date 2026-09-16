import { beforeEach, describe, expect, it, vi } from "vitest";
import { servidorFalso } from "@/test/servidor-falso";

vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));

import { reportarComunidad } from "@/actions/comunidad/reportar";

/**
 * `reportarComunidad` — AUDIT-2026-09-15.md, P2-8 Fase 3.
 *
 * Las dos reglas de negocio (no reportar dos veces, no reportar lo propio)
 * las hace cumplir la base: un UNIQUE y una policy. Lo que vive en
 * TypeScript es la traducción de esos códigos a mensajes, y que el
 * reportante sea SIEMPRE quien tiene la sesión.
 */

const ESTUDIANTE = { id: "estudiante-1", email: "ana@uva.co" };

beforeEach(() => {
  servidorFalso.reiniciar();
  servidorFalso.conUsuario(ESTUDIANTE);
});

it("sin sesión no inserta", async () => {
  servidorFalso.conUsuario(null);

  expect(await reportarComunidad({ idPost: "post-1" }, "spam")).toEqual({ error: "Debes iniciar sesión." });
  expect(servidorFalso.llamadasA("from:comunidad_reportes")).toHaveLength(0);
});

it("un motivo vacío no inserta", async () => {
  expect(await reportarComunidad({ idPost: "post-1" }, "   ")).toEqual({ error: "Escribe el motivo del reporte." });
  expect(servidorFalso.llamadasA("from:comunidad_reportes")).toHaveLength(0);
});

describe("inserta con el reportante de la sesión", () => {
  it("un post", async () => {
    expect(await reportarComunidad({ idPost: "post-1" }, "  Spam  ")).toEqual({ success: true });
    expect(servidorFalso.encadenado("from:comunidad_reportes", "insert")).toEqual([
      [{ id_post: "post-1", id_respuesta: null, id_reportante: ESTUDIANTE.id, motivo: "Spam" }],
    ]);
  });

  it("una respuesta", async () => {
    await reportarComunidad({ idRespuesta: "resp-1" }, "Ofensivo");
    expect(servidorFalso.encadenado("from:comunidad_reportes", "insert")).toEqual([
      [{ id_post: null, id_respuesta: "resp-1", id_reportante: ESTUDIANTE.id, motivo: "Ofensivo" }],
    ]);
  });

  it("un id_reportante colado en el objetivo no llega a la fila", async () => {
    const objetivo = { idPost: "post-1", id_reportante: "otra-persona" } as unknown as { idPost: string };

    await reportarComunidad(objetivo, "Spam");

    expect(servidorFalso.encadenado("from:comunidad_reportes", "insert")[0][0]).toMatchObject({
      id_reportante: ESTUDIANTE.id,
    });
  });
});

describe("errores de la base traducidos", () => {
  it.each([
    ["23505 (UNIQUE: ya lo reportó)", "23505", "Ya reportaste esto."],
    ["42501 (policy: es suyo)", "42501", "No puedes reportar tu propia publicación."],
    ["cualquier otro", "XX000", "No pudimos enviar el reporte."],
  ])("%s", async (_caso, code, mensaje) => {
    servidorFalso.responder("from:comunidad_reportes", { error: { code, message: "x" } });

    expect(await reportarComunidad({ idPost: "post-1" }, "Spam")).toEqual({ error: mensaje });
  });
});
