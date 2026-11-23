import { beforeEach, describe, expect, it, vi } from "vitest";
import { servidorFalso } from "@/test/servidor-falso";

vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));
vi.mock("next/navigation", () => import("@/test/servidor-falso").then((m) => m.moduloNextNavigation()));
vi.mock("next/headers", () => import("@/test/servidor-falso").then((m) => m.moduloNextHeaders()));
vi.mock("@/lib/log", () => import("@/test/servidor-falso").then((m) => m.moduloLog()));
vi.mock("@/lib/resend", () => ({
  enviarCorreoPasswordActualizada: vi.fn(async () => ({ success: true })),
}));

import { actualizarPassword } from "@/actions/auth/actualizar-password";
import { faltaCodigoParaCambiarContrasena } from "@/lib/auth/aal";
import { logError } from "@/lib/log";

/**
 * Nueva contraseña lab 7: al guardar ya no redirige al login; devuelve
 * `guardada` con el correo para que la pantalla muestre "Contraseña guardada"
 * e "Iniciar sesión" con el correo escrito. La sesión del enlace se cierra
 * igual que antes.
 */

function formulario(password: string, password2 = password): FormData {
  const datos = new FormData();
  datos.set("password", password);
  datos.set("password2", password2);
  return datos;
}

beforeEach(() => {
  servidorFalso.reiniciar();
});

describe("actualizarPassword", () => {
  it("al guardar devuelve guardada con el correo y cierra la sesión del enlace", async () => {
    servidorFalso.conUsuario({ id: "u-1", email: "laura@obra.co" });

    const resultado = await actualizarPassword(null, formulario("Obra-2026!x"));

    expect(resultado).toEqual({ guardada: true, email: "laura@obra.co" });
    const operaciones = servidorFalso.operaciones();
    expect(operaciones).toContain("auth:updateUser");
    expect(operaciones.indexOf("auth:signOut")).toBeGreaterThan(operaciones.indexOf("auth:updateUser"));
  });

  it("sin sesión del enlace no guarda y lo dice", async () => {
    servidorFalso.conUsuario(null);

    const resultado = await actualizarPassword(null, formulario("Obra-2026!x"));

    expect(resultado).toEqual({ error: "Tu enlace expiró o no es válido. Solicita uno nuevo." });
    expect(servidorFalso.operaciones()).not.toContain("auth:updateUser");
  });

  it("rechaza una contraseña que no cumple las reglas o que no coincide", async () => {
    servidorFalso.conUsuario({ id: "u-1", email: "laura@obra.co" });

    expect(await actualizarPassword(null, formulario("corta"))).toEqual({
      error: "La contraseña no cumple los requisitos.",
    });
    expect(await actualizarPassword(null, formulario("Obra-2026!x", "Obra-2026!y"))).toEqual({
      error: "Las contraseñas no coinciden.",
    });
  });

  it("con la misma contraseña de antes lo dice claro", async () => {
    servidorFalso.conUsuario({ id: "u-1", email: "laura@obra.co" });
    servidorFalso.responder("auth:updateUser", { data: null, error: { code: "same_password", message: "x" } });

    expect(await actualizarPassword(null, formulario("Obra-2026!x"))).toEqual({
      error: "La contraseña nueva debe ser distinta de la actual.",
    });
  });

  it("con una contraseña débil o filtrada lo dice claro", async () => {
    servidorFalso.conUsuario({ id: "u-1", email: "laura@obra.co" });
    servidorFalso.responder("auth:updateUser", { data: null, error: { code: "weak_password", message: "x" } });

    expect(await actualizarPassword(null, formulario("Obra-2026!x"))).toEqual({
      error: "Esa contraseña es débil o apareció en filtraciones. Elige otra.",
    });
  });

  it("si Supabase pide el segundo factor, manda a escribir el código y vuelve aquí", async () => {
    servidorFalso.conUsuario({ id: "u-1", email: "admin@obra.co", aal: "aal1" });
    servidorFalso.responder("auth:updateUser", { data: null, error: { code: "insufficient_aal", message: "x" } });

    await expect(actualizarPassword(null, formulario("Obra-2026!x"))).rejects.toMatchObject({
      destino: "/seguridad/verificar?redirect=%2Factualizar-password",
    });
  });

  it("cualquier otro fallo queda registrado, no se descarta", async () => {
    servidorFalso.conUsuario({ id: "u-1", email: "laura@obra.co" });
    servidorFalso.responder("auth:updateUser", { data: null, error: { code: "unexpected_failure", message: "x" } });

    expect(await actualizarPassword(null, formulario("Obra-2026!x"))).toEqual({
      error: "No pudimos actualizar tu contraseña. Intenta de nuevo.",
    });
    expect(logError).toHaveBeenCalledWith("actualizarPassword", "updateUser falló", expect.anything(), expect.anything());
  });
});

/**
 * Bug del 2026-11-23: un administrador con segundo factor que recupera su
 * contraseña llega con sesión aal1 (el enlace solo prueba el correo), y
 * Supabase rechaza el cambio con 401 «AAL2 session is required». La página
 * debe mandarlo antes a escribir el código.
 */
describe("faltaCodigoParaCambiarContrasena", () => {
  it("aal1 con factor confirmado: falta el código", async () => {
    servidorFalso.conUsuario({ id: "u-1", email: "admin@obra.co", aal: "aal1" });
    servidorFalso.responder("auth.mfa:listFactors", { data: { totp: [{ id: "f-1" }], all: [] }, error: null });

    expect(await faltaCodigoParaCambiarContrasena()).toBe(true);
  });

  it("aal1 sin factor (estudiante): no falta nada", async () => {
    servidorFalso.conUsuario({ id: "u-1", email: "laura@obra.co", aal: "aal1" });
    servidorFalso.responder("auth.mfa:listFactors", { data: { totp: [], all: [] }, error: null });

    expect(await faltaCodigoParaCambiarContrasena()).toBe(false);
  });

  it("ya en aal2: no pregunta por los factores", async () => {
    servidorFalso.conUsuario({ id: "u-1", email: "admin@obra.co", aal: "aal2" });

    expect(await faltaCodigoParaCambiarContrasena()).toBe(false);
    expect(servidorFalso.operaciones()).not.toContain("auth.mfa:listFactors");
  });

  it("sin sesión: no falta nada (el guardado dirá que el enlace expiró)", async () => {
    servidorFalso.conUsuario(null);

    expect(await faltaCodigoParaCambiarContrasena()).toBe(false);
  });
});
