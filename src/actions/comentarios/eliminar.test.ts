import { beforeEach, describe, expect, it, vi } from "vitest";
import { servidorFalso } from "@/test/servidor-falso";

vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));
vi.mock("next/cache", () => import("@/test/servidor-falso").then((m) => m.moduloNextCache()));

import { eliminarComentario } from "@/actions/comentarios/eliminar";

/**
 * Eliminar un comentario de una clase. El autor borra lo suyo; un
 * administrador modera lo ajeno guardando antes la evidencia. FASE 8.1: ese
 * poder de moderación exige sesión aal2.
 */

const AUTORA = { id: "autora-1", email: "ana@uva.co" };
const ADMIN = { id: "admin-9", email: "admin@uva.co" };
const COMENTARIO = { id_usuario: AUTORA.id, contenido: "Texto original", eliminado: false };

function escrituras() {
  return servidorFalso.llamadas.filter((l) =>
    l.cadena.some((c) => ["update", "insert", "delete", "upsert"].includes(c.metodo)),
  );
}

beforeEach(() => {
  servidorFalso.reiniciar();
  servidorFalso.responder("from:comentarios", { data: COMENTARIO });
});

describe("eliminarComentario", () => {
  it("la autora borra lo suyo sin consultar el rol", async () => {
    servidorFalso.conUsuario(AUTORA);

    expect(await eliminarComentario("c-1", "/cursos/a/b")).toEqual({ success: true });
    expect(servidorFalso.llamadasA("from:perfiles")).toHaveLength(0);
    expect(servidorFalso.encadenado("from:comentario_moderacion", "insert")).toEqual([]);
  });

  it("un administrador con sesión aal2 modera: guarda la evidencia y vacía el comentario", async () => {
    servidorFalso.conUsuario({ ...ADMIN, aal: "aal2" });
    servidorFalso.responder("from:perfiles", { data: { rol: "ADMINISTRADOR" } });

    expect(await eliminarComentario("c-1", "/cursos/a/b")).toEqual({ success: true });
    expect(servidorFalso.encadenado("from:comentario_moderacion", "insert")).toEqual([
      [{ id_comentario: "c-1", contenido_original: "Texto original", id_eliminado_por: ADMIN.id }],
    ]);
  });

  it("un administrador con sesión aal1 NO modera: se trata como estudiante, sin escribir nada", async () => {
    servidorFalso.conUsuario({ ...ADMIN, aal: "aal1" });
    servidorFalso.responder("from:perfiles", { data: { rol: "ADMINISTRADOR" } });

    expect(await eliminarComentario("c-1", "/cursos/a/b")).toEqual({
      error: "No tienes permiso para eliminar este comentario.",
    });
    expect(escrituras()).toEqual([]);
  });

  it("un estudiante sobre un comentario ajeno: rechazo y ninguna escritura", async () => {
    servidorFalso.conUsuario({ id: "otro-2", email: "beto@uva.co" });
    servidorFalso.responder("from:perfiles", { data: { rol: "ESTUDIANTE" } });

    expect(await eliminarComentario("c-1", "/cursos/a/b")).toEqual({
      error: "No tienes permiso para eliminar este comentario.",
    });
    expect(escrituras()).toEqual([]);
  });
});
