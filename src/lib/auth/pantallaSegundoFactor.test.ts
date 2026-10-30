import { beforeEach, describe, expect, it, vi } from "vitest";
import { RedireccionFalsa, servidorFalso } from "@/test/servidor-falso";

vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));
vi.mock("next/navigation", () => import("@/test/servidor-falso").then((m) => m.moduloNextNavigation()));

const { resolverPantallaSegundoFactor } = await import("@/lib/auth/pantallaSegundoFactor");

/**
 * Puerta de /seguridad/activar y /seguridad/verificar — FASE 8.1. Lo que
 * importa: que cada persona caiga en la pantalla que le corresponde, que
 * un destino externo no se siga, y que nadie quede en un bucle de redirects.
 */

const ADMIN_AAL1 = { id: "admin-9", email: "admin@uva.co", aal: "aal1" as const };
const FACTOR = { id: "f-1", factor_type: "totp", status: "verified" };

const CON_FACTOR = { data: { all: [FACTOR], totp: [FACTOR], phone: [] }, error: null };
const SIN_FACTOR = { data: { all: [], totp: [], phone: [] }, error: null };

/** Adónde redirige, o `null` si la pantalla se queda (devuelve normalmente). */
async function redirigeA(accion: Promise<unknown>): Promise<string | null> {
  try {
    await accion;
  } catch (error) {
    if (error instanceof RedireccionFalsa) return error.destino;
    throw error;
  }
  return null;
}

beforeEach(() => {
  servidorFalso.reiniciar();
  servidorFalso.conUsuario(ADMIN_AAL1);
  servidorFalso.responder("from:perfiles", { data: { rol: "ADMINISTRADOR", estado: "ACTIVO" }, error: null });
});

describe("resolverPantallaSegundoFactor", () => {
  it("sin sesión: al login, con esta pantalla como destino para volver", async () => {
    servidorFalso.conUsuario(null);

    expect(await redirigeA(resolverPantallaSegundoFactor("verificar", "/admin"))).toBe(
      `/login?redirect=${encodeURIComponent("/seguridad/verificar?redirect=%2Fadmin")}`,
    );
  });

  it("un estudiante no tiene nada que hacer aquí: a su dashboard", async () => {
    servidorFalso.responder("from:perfiles", { data: { rol: "ESTUDIANTE", estado: "ACTIVO" }, error: null });

    expect(await redirigeA(resolverPantallaSegundoFactor("activar", "/admin"))).toBe("/dashboard");
  });

  it("una sesión que ya es aal2 va directo a su destino", async () => {
    servidorFalso.conUsuario({ ...ADMIN_AAL1, aal: "aal2" });

    expect(await redirigeA(resolverPantallaSegundoFactor("verificar", "/admin/usuarios"))).toBe("/admin/usuarios");
  });

  it("con factor confirmado, la pantalla de activar lo manda a verificar", async () => {
    servidorFalso.responder("auth.mfa:listFactors", CON_FACTOR);

    expect(await redirigeA(resolverPantallaSegundoFactor("activar", "/admin"))).toBe(
      "/seguridad/verificar?redirect=%2Fadmin",
    );
  });

  it("sin factor, la pantalla de verificar lo manda a activar", async () => {
    servidorFalso.responder("auth.mfa:listFactors", SIN_FACTOR);

    expect(await redirigeA(resolverPantallaSegundoFactor("verificar", "/admin"))).toBe(
      "/seguridad/activar?redirect=%2Fadmin",
    );
  });

  it("en la pantalla que le corresponde se queda, y devuelve el destino", async () => {
    servidorFalso.responder("auth.mfa:listFactors", CON_FACTOR);

    const pantalla = resolverPantallaSegundoFactor("verificar", "/admin/cursos");

    expect(await redirigeA(pantalla)).toBeNull();
    expect(await resolverPantallaSegundoFactor("verificar", "/admin/cursos")).toEqual({ destino: "/admin/cursos" });
  });

  it("sin destino, o con uno que sale de la plataforma, vuelve a /admin", async () => {
    servidorFalso.responder("auth.mfa:listFactors", CON_FACTOR);

    expect(await resolverPantallaSegundoFactor("verificar", undefined)).toEqual({ destino: "/admin" });
    expect(await resolverPantallaSegundoFactor("verificar", "//otro-sitio.com")).toEqual({ destino: "/admin" });
    expect(await resolverPantallaSegundoFactor("verificar", "https://otro-sitio.com")).toEqual({ destino: "/admin" });
  });

  it("las dos pantallas no pueden mandarse la una a la otra: solo una corresponde a cada estado", async () => {
    for (const factor of [CON_FACTOR, SIN_FACTOR]) {
      servidorFalso.responder("auth.mfa:listFactors", factor);

      const activar = await redirigeA(resolverPantallaSegundoFactor("activar", "/admin"));
      const verificar = await redirigeA(resolverPantallaSegundoFactor("verificar", "/admin"));

      // Exactamente una se queda (null) y la otra redirige a ella.
      expect([activar, verificar].filter((d) => d === null)).toHaveLength(1);
    }
  });
});
