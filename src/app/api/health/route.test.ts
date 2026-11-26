import { beforeEach, describe, expect, it, vi } from "vitest";
import { servidorFalso } from "@/test/servidor-falso";

vi.mock("@/lib/supabase/public", () => import("@/test/servidor-falso").then((m) => m.moduloSupabasePublic()));
vi.mock("@/lib/log", () => import("@/test/servidor-falso").then((m) => m.moduloLog()));

import { logError } from "@/lib/log";
import { reiniciarUnaVezPorMinuto } from "@/lib/una-vez-por-minuto";
import { GET } from "@/app/api/health/route";

/** P3-10 (AUDIT-2026-11-23): una caída no agota la cuota de Sentry. */

beforeEach(() => {
  servidorFalso.reiniciar();
  reiniciarUnaVezPorMinuto();
  vi.mocked(logError).mockClear();
  for (const nombre of ["SUPABASE_SERVICE_ROLE_KEY", "MUX_TOKEN_ID", "MUX_TOKEN_SECRET", "RESEND_API_KEY", "RESEND_FROM_EMAIL"]) {
    vi.stubEnv(nombre, "x");
  }
});

describe("GET /api/health", () => {
  it("con la base caída responde 503 cada vez, pero avisa a Sentry una sola vez por minuto", async () => {
    servidorFalso.responder("from:categorias", { data: null, error: { message: "connection refused" } });

    for (let i = 0; i < 5; i++) {
      expect((await GET()).status).toBe(503);
    }
    expect(logError).toHaveBeenCalledTimes(1);
  });

  it("con todo bien responde 200 y no avisa", async () => {
    servidorFalso.responder("from:categorias", { data: [{ id: "c1" }], error: null });

    expect((await GET()).status).toBe(200);
    expect(logError).not.toHaveBeenCalled();
  });
});
