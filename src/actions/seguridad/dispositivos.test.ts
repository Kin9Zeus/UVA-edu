import { beforeEach, describe, expect, it, vi } from "vitest";
import { servidorFalso } from "@/test/servidor-falso";

vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));
vi.mock("next/cache", () => import("@/test/servidor-falso").then((m) => m.moduloNextCache()));
vi.mock("@/lib/log", () => import("@/test/servidor-falso").then((m) => m.moduloLog()));
vi.mock("@/lib/admin/bitacora", () => ({ registrarBitacora: vi.fn() }));

import {
  confirmarOtroDispositivo,
  iniciarOtroDispositivo,
  quitarDispositivo,
} from "@/actions/seguridad/dispositivos";
import { registrarBitacora } from "@/lib/admin/bitacora";

/**
 * Dispositivos del segundo factor desde Mi perfil — FASE 8.1. Lo que decide
 * esta capa: que solo un administrador en aal2 toque sus dispositivos, que
 * nunca quite el último, y que cada cambio quede en la bitácora.
 */

const ADMIN = { id: "admin-9", email: "admin@uva.co", aal: "aal2" as const };

const FACTOR = (id: string, nombre: string | null = null) => ({
  id,
  friendly_name: nombre,
  factor_type: "totp",
  status: "verified",
});

function formulario(campos: Record<string, string>): FormData {
  const datos = new FormData();
  for (const [campo, valor] of Object.entries(campos)) datos.set(campo, valor);
  return datos;
}

beforeEach(() => {
  servidorFalso.reiniciar();
  servidorFalso.conUsuario(ADMIN);
  servidorFalso.responder("from:perfiles", { data: { rol: "ADMINISTRADOR" }, error: null });
  vi.mocked(registrarBitacora).mockReset();
});

describe("iniciarOtroDispositivo", () => {
  beforeEach(() => {
    servidorFalso.responder("auth.mfa:listFactors", {
      data: { all: [FACTOR("f-1")], totp: [FACTOR("f-1")], phone: [] },
      error: null,
    });
    servidorFalso.responder("auth.mfa:enroll", {
      data: { id: "f-2", totp: { qr_code: "<svg/>", secret: "JBSWY3DPEHPK3PXP", uri: "otpauth://x" } },
      error: null,
    });
  });

  it("crea el factor con el nombre elegido y devuelve el QR propio y la clave", async () => {
    const resultado = await iniciarOtroDispositivo(null, formulario({ nombre: "  Bóveda  " }));

    expect(servidorFalso.llamadasA("auth.mfa:enroll")[0].argumentos[0]).toEqual({
      factorType: "totp",
      friendlyName: "Bóveda",
    });
    expect(resultado).toMatchObject({ factorId: "f-2", secreto: "JBSWY3DPEHPK3PXP" });
    expect(resultado?.qr).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
  });

  it.each([
    ["vacío", "   "],
    ["demasiado largo", "x".repeat(41)],
  ])("un nombre %s se rechaza sin tocar Supabase", async (_caso, nombre) => {
    expect((await iniciarOtroDispositivo(null, formulario({ nombre })))?.error).toMatch(/Ponle un nombre/);
    expect(servidorFalso.llamadasA("auth.mfa:enroll")).toHaveLength(0);
  });

  it("un administrador en aal1 no añade dispositivos: con solo la contraseña registraría el SUYO en la cuenta", async () => {
    servidorFalso.conUsuario({ ...ADMIN, aal: "aal1" });

    expect((await iniciarOtroDispositivo(null, formulario({ nombre: "Otro" })))?.error).toMatch(/verificación en dos pasos/);
    expect(servidorFalso.llamadasA("auth.mfa:enroll")).toHaveLength(0);
  });

  it("un estudiante no añade dispositivos", async () => {
    servidorFalso.responder("from:perfiles", { data: { rol: "ESTUDIANTE" }, error: null });

    expect((await iniciarOtroDispositivo(null, formulario({ nombre: "Otro" })))?.error).toBe(
      "No tienes permisos de administrador.",
    );
    expect(servidorFalso.llamadasA("auth.mfa:enroll")).toHaveLength(0);
  });

  it("un nombre repetido se explica, no se reporta como fallo", async () => {
    servidorFalso.responder("auth.mfa:enroll", {
      data: null,
      error: { code: "mfa_factor_name_conflict", status: 422, message: "x" },
    });

    expect(await iniciarOtroDispositivo(null, formulario({ nombre: "Celular" }))).toEqual({
      error: "Ya tienes un dispositivo con ese nombre.",
    });
  });
});

describe("confirmarOtroDispositivo", () => {
  beforeEach(() => {
    servidorFalso.responder("auth.mfa:challengeAndVerify", { data: {}, error: null });
  });

  it("código correcto: confirma, deja bitácora y revalida Mi perfil", async () => {
    expect(await confirmarOtroDispositivo(null, formulario({ factorId: "f-2", codigo: "123 456" }))).toEqual({
      exito: true,
    });
    expect(servidorFalso.llamadasA("auth.mfa:challengeAndVerify")[0].argumentos[0]).toEqual({
      factorId: "f-2",
      code: "123456",
    });
    expect(registrarBitacora).toHaveBeenCalledWith(expect.anything(), {
      idAdmin: ADMIN.id,
      accion: "Añadió un dispositivo de verificación en dos pasos",
      entidadAfectada: "auth.mfa_factors",
      idEntidadAfectada: "f-2",
    });
    expect(servidorFalso.revalidaciones).toEqual(["/dashboard/perfil"]);
  });

  it("código incorrecto: mensaje claro, sin bitácora", async () => {
    servidorFalso.responder("auth.mfa:challengeAndVerify", {
      data: null,
      error: { code: "mfa_verification_failed", status: 400, message: "x" },
    });

    expect((await confirmarOtroDispositivo(null, formulario({ factorId: "f-2", codigo: "000000" })))?.error).toMatch(
      /El código no es correcto/,
    );
    expect(registrarBitacora).not.toHaveBeenCalled();
  });

  it("un código mal formado se rechaza sin verificar nada en Supabase", async () => {
    expect(await confirmarOtroDispositivo(null, formulario({ factorId: "f-2", codigo: "12" }))).toEqual({
      error: "Escribe los 6 dígitos que muestra tu app de autenticación.",
    });
    expect(servidorFalso.llamadasA("auth.mfa:challengeAndVerify")).toHaveLength(0);
  });
});

describe("quitarDispositivo", () => {
  it("con dos dispositivos quita el indicado y deja bitácora", async () => {
    servidorFalso.responder("auth.mfa:listFactors", {
      data: { all: [FACTOR("f-1"), FACTOR("f-2")], totp: [FACTOR("f-1"), FACTOR("f-2")], phone: [] },
      error: null,
    });
    servidorFalso.responder("auth.mfa:unenroll", { data: {}, error: null });

    expect(await quitarDispositivo("f-2")).toEqual({ exito: true });
    expect(servidorFalso.llamadasA("auth.mfa:unenroll")[0].argumentos[0]).toEqual({ factorId: "f-2" });
    expect(registrarBitacora).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ accion: "Quitó un dispositivo de verificación en dos pasos", idEntidadAfectada: "f-2" }),
    );
  });

  it("NUNCA quita el último: la cuenta quedaría solo con la contraseña", async () => {
    servidorFalso.responder("auth.mfa:listFactors", {
      data: { all: [FACTOR("f-1")], totp: [FACTOR("f-1")], phone: [] },
      error: null,
    });

    expect((await quitarDispositivo("f-1")) as { error: string }).toEqual({
      error: "Es tu único dispositivo. Para cambiarlo, primero añade el nuevo y luego quita este.",
    });
    expect(servidorFalso.llamadasA("auth.mfa:unenroll")).toHaveLength(0);
  });

  it("un id que no es de esta cuenta no se intenta quitar", async () => {
    servidorFalso.responder("auth.mfa:listFactors", {
      data: { all: [FACTOR("f-1"), FACTOR("f-2")], totp: [FACTOR("f-1"), FACTOR("f-2")], phone: [] },
      error: null,
    });

    expect(await quitarDispositivo("f-ajeno")).toEqual({ error: "Ese dispositivo ya no está registrado." });
    expect(servidorFalso.llamadasA("auth.mfa:unenroll")).toHaveLength(0);
  });

  it("un administrador en aal1 no quita dispositivos", async () => {
    servidorFalso.conUsuario({ ...ADMIN, aal: "aal1" });

    expect((await quitarDispositivo("f-1")) as { error: string }).toMatchObject({ error: expect.stringMatching(/dos pasos/) });
    expect(servidorFalso.llamadasA("auth.mfa:unenroll")).toHaveLength(0);
  });
});
