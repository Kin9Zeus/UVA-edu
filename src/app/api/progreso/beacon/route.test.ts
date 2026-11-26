import { beforeEach, describe, expect, it, vi } from "vitest";
import { servidorFalso } from "@/test/servidor-falso";

vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));
vi.mock("@/lib/log", () => import("@/test/servidor-falso").then((m) => m.moduloLog()));

import { logError } from "@/lib/log";
import { reiniciarUnaVezPorMinuto } from "@/lib/una-vez-por-minuto";
import { POST } from "@/app/api/progreso/beacon/route";

/** P3-1 (AUDIT-2026-11-23): el beacon ya no responde éxito si no guardó. */

const LECCION = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function peticion() {
  return new Request("https://uva.test/api/progreso/beacon", {
    method: "POST",
    headers: { host: "uva.test", origin: "https://uva.test" },
    body: JSON.stringify({ leccionId: LECCION, segundos: 42 }),
  });
}

beforeEach(() => {
  servidorFalso.reiniciar();
  servidorFalso.conUsuario({ id: "estudiante-1", email: "ana@uva.co" });
  reiniciarUnaVezPorMinuto();
  vi.mocked(logError).mockClear();
});

describe("POST /api/progreso/beacon", () => {
  it("guarda y responde 200", async () => {
    const respuesta = await POST(peticion());

    expect(respuesta.status).toBe(200);
    expect(servidorFalso.encadenado("from:progreso", "upsert")[0][0]).toEqual({
      id_usuario: "estudiante-1",
      id_leccion: LECCION,
      segundo_actual: 42,
    });
    expect(logError).not.toHaveBeenCalled();
  });

  it("si la base falla responde 500 y deja un solo aviso por minuto", async () => {
    servidorFalso.responder("from:progreso", { data: null, error: { message: "timeout", code: "57014" } });

    for (let i = 0; i < 5; i++) expect((await POST(peticion())).status).toBe(500);

    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalledWith(
      "progresoBeacon",
      expect.any(String),
      expect.objectContaining({ code: "57014" }),
      expect.objectContaining({ leccionId: LECCION, nivel: "warning" }),
    );
  });
});
