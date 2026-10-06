import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/log", () => import("@/test/servidor-falso").then((m) => m.moduloLog()));

const { logError } = await import("@/lib/log");
const { getGuardiaSesion, olvidarGuardiaSesion } = await import("@/lib/supabase/guardia-sesion");

/**
 * La caché de 30 s no puede convertir un fallo de lectura en "cuenta activa":
 * antes, un error de `perfiles` dejaba `suspendido: false` guardado y se
 * repetía a cada petición del usuario sin dejar rastro.
 */

type RespuestaPerfil = { data: { estado: string } | null; error: { code?: string; message?: string } | null };

function clienteFalso(perfil: RespuestaPerfil) {
  const consultasPerfil = vi.fn(async () => perfil);
  const supabase = {
    auth: {
      getUser: async () => ({ data: { user: { email_confirmed_at: "2026-01-01" } }, error: null }),
    },
    from: () => ({ select: () => ({ eq: () => ({ single: consultasPerfil }) }) }),
  } as unknown as SupabaseClient;
  return { supabase, consultasPerfil };
}

const USUARIO = "u-guardia";

beforeEach(() => {
  olvidarGuardiaSesion(USUARIO);
  vi.mocked(logError).mockClear();
});

describe("getGuardiaSesion", () => {
  it("cachea un resultado sano: la segunda llamada no vuelve a consultar", async () => {
    const { supabase, consultasPerfil } = clienteFalso({ data: { estado: "ACTIVO" }, error: null });

    await getGuardiaSesion(supabase, USUARIO);
    await getGuardiaSesion(supabase, USUARIO);

    expect(consultasPerfil).toHaveBeenCalledTimes(1);
  });

  it("detecta una cuenta SUSPENDIDA", async () => {
    const { supabase } = clienteFalso({ data: { estado: "SUSPENDIDO" }, error: null });

    expect(await getGuardiaSesion(supabase, USUARIO)).toEqual({ correoVerificado: true, suspendido: true });
  });

  it("un fallo de `perfiles` NO se cachea y se registra", async () => {
    const { supabase, consultasPerfil } = clienteFalso({
      data: null,
      error: { code: "57014", message: "statement timeout" },
    });

    await getGuardiaSesion(supabase, USUARIO);
    await getGuardiaSesion(supabase, USUARIO);

    expect(consultasPerfil).toHaveBeenCalledTimes(2);
    expect(logError).toHaveBeenCalledTimes(2);
  });

  it("tras un fallo, la siguiente lectura sana ve la suspensión (no quedó 'activa' en caché)", async () => {
    const fallo = clienteFalso({ data: null, error: { code: "57014" } });
    await getGuardiaSesion(fallo.supabase, USUARIO);

    const sano = clienteFalso({ data: { estado: "SUSPENDIDO" }, error: null });
    expect((await getGuardiaSesion(sano.supabase, USUARIO))?.suspendido).toBe(true);
  });

  it("perfil sin crear (PGRST116) no es un fallo: se cachea y no se registra", async () => {
    const { supabase, consultasPerfil } = clienteFalso({ data: null, error: { code: "PGRST116" } });

    await getGuardiaSesion(supabase, USUARIO);
    await getGuardiaSesion(supabase, USUARIO);

    expect(consultasPerfil).toHaveBeenCalledTimes(1);
    expect(logError).not.toHaveBeenCalled();
  });
});
