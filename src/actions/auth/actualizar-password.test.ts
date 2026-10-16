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
});
