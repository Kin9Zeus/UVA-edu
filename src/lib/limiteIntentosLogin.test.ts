import { beforeEach, describe, expect, it, vi } from "vitest";
import { crearCliente, servidorFalso } from "@/test/servidor-falso";

vi.mock("@/lib/log", () => import("@/test/servidor-falso").then((m) => m.moduloLog()));

import { comprobarLimiteLogin } from "@/lib/limiteIntentosLogin";
import { logError } from "@/lib/log";

/**
 * Límite de intentos de contraseña, compartido por login, cambiar
 * contraseña y eliminar cuenta (P2-6, AUDIT-2026-09-22.md).
 */

beforeEach(() => {
  servidorFalso.reiniciar();
  vi.mocked(logError).mockClear();
});

const comprobar = () => comprobarLimiteLogin(crearCliente("admin") as never, "ana@uva.co", "prueba");

describe("comprobarLimiteLogin", () => {
  it("permitido: deja seguir (null) y consulta por ESE correo", async () => {
    servidorFalso.responder("rpc:verificar_intentos_login", { data: { permitido: true, segundos_espera: 0 } });

    expect(await comprobar()).toBeNull();
    expect(servidorFalso.argumentosDe("rpc:verificar_intentos_login")).toEqual({ p_correo: "ana@uva.co" });
  });

  it.each([
    [30, "Demasiados intentos. Espera 1 minuto e intenta de nuevo."],
    [61, "Demasiados intentos. Espera 2 minutos e intenta de nuevo."],
    [900, "Demasiados intentos. Espera 15 minutos e intenta de nuevo."],
  ])("bloqueado con %i s de espera: '%s'", async (segundos, mensaje) => {
    servidorFalso.responder("rpc:verificar_intentos_login", { data: { permitido: false, segundos_espera: segundos } });

    expect(await comprobar()).toBe(mensaje);
  });

  it("si la consulta falla, BLOQUEA (falla cerrado) y lo registra", async () => {
    // Antes se registraba y se dejaba pasar: con la función caída, el freno
    // contra fuerza bruta desaparecía sin que nadie lo notara.
    servidorFalso.responder("rpc:verificar_intentos_login", { data: null, error: { message: "timeout" } });

    expect(await comprobar()).toMatch(/No pudimos verificar tu acceso/);
    expect(logError).toHaveBeenCalledWith("prueba", expect.stringContaining("se bloquea"), expect.anything(), {
      area: "auth",
    });
  });

  it("una respuesta vacía sin error también bloquea", async () => {
    servidorFalso.responder("rpc:verificar_intentos_login", { data: null, error: null });

    expect(await comprobar()).toMatch(/No pudimos verificar tu acceso/);
  });
});
