import { beforeEach, describe, expect, it, vi } from "vitest";
import { RedireccionFalsa, servidorFalso } from "@/test/servidor-falso";

vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));
vi.mock("next/navigation", () => import("@/test/servidor-falso").then((m) => m.moduloNextNavigation()));
vi.mock("@/lib/log", () => import("@/test/servidor-falso").then((m) => m.moduloLog()));

import {
  confirmarActivacion,
  iniciarActivacion,
  verificarSegundoFactor,
} from "@/actions/seguridad/segundo-factor";
import { logError } from "@/lib/log";

/**
 * Segundo factor — FASE 8.1 del plan de blindaje. Lo que decide esta capa:
 * qué se le dice a la persona cuando el código falla, que un destino
 * externo no se siga, y que con dos dispositivos registrados se pruebe cada
 * uno. Que el código sea o no válido lo decide Supabase.
 */

const ADMIN = { id: "admin-9", email: "admin@uva.co", aal: "aal1" as const };

const FACTOR_CONFIRMADO = { id: "f-1", factor_type: "totp", status: "verified" };
const FACTOR_SEGUNDO = { id: "f-2", factor_type: "totp", status: "verified" };
const FACTOR_A_MEDIAS = { id: "f-x", factor_type: "totp", status: "unverified" };

const SIN_FACTORES = { data: { all: [], totp: [], phone: [] }, error: null };
const CON_UN_FACTOR = { data: { all: [FACTOR_CONFIRMADO], totp: [FACTOR_CONFIRMADO], phone: [] }, error: null };

const CODIGO_MALO = { data: null, error: { code: "mfa_verification_failed", status: 400, message: "Invalid TOTP code entered" } };
const LIMITE = { data: null, error: { code: "over_request_rate_limit", status: 429, message: "Request rate limit reached" } };

function formulario(campos: Record<string, string>): FormData {
  const datos = new FormData();
  for (const [campo, valor] of Object.entries(campos)) datos.set(campo, valor);
  return datos;
}

async function destinoDe(accion: Promise<unknown>): Promise<string> {
  try {
    await accion;
  } catch (error) {
    if (error instanceof RedireccionFalsa) return error.destino;
    throw error;
  }
  throw new Error("la acción no redirigió");
}

const verificaciones = () => servidorFalso.llamadasA("auth.mfa:challengeAndVerify");

beforeEach(() => {
  servidorFalso.reiniciar();
  servidorFalso.conUsuario(ADMIN);
  vi.mocked(logError).mockClear();
});

describe("iniciarActivacion", () => {
  beforeEach(() => {
    servidorFalso.responder("auth.mfa:enroll", {
      data: { id: "f-nuevo", totp: { qr_code: "data:image/svg+xml;utf-8,<svg/>", secret: "JBSWY3DP", uri: "otpauth://totp/x" } },
      error: null,
    });
  });

  it("sin sesión no toca Supabase", async () => {
    servidorFalso.conUsuario(null);

    expect(await iniciarActivacion()).toEqual({ error: "Tu sesión expiró. Vuelve a iniciar sesión." });
    expect(servidorFalso.llamadasA("auth.mfa:enroll")).toHaveLength(0);
  });

  it("crea el factor y devuelve el QR (ya como data:) y la clave escrita", async () => {
    servidorFalso.responder("auth.mfa:listFactors", SIN_FACTORES);

    const resultado = await iniciarActivacion();

    expect(resultado).toMatchObject({ factorId: "f-nuevo", secreto: "JBSWY3DP" });
    expect(resultado?.qr).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
    expect(resultado?.ladoQr).toBeGreaterThan(0);
    expect(servidorFalso.llamadasA("auth.mfa:enroll")[0].argumentos[0]).toEqual({ factorType: "totp" });
  });

  it("genera el QR con SU dirección corta (emisor U.V.A. y el correo de quien activa), no con el qr_code de Supabase", async () => {
    servidorFalso.responder("auth.mfa:listFactors", SIN_FACTORES);
    servidorFalso.conUsuario({ ...ADMIN, email: "ana@uva.co" });

    const resultado = await iniciarActivacion();
    const svg = decodeURIComponent((resultado?.qr ?? "").split(",")[1] ?? "");

    // El `qr_code` falso de Supabase es `<svg/>`: si se usara, no habría módulos.
    expect(svg).toContain("<path");
    expect(svg).not.toBe("<svg/>");
  });

  it("borra los factores a medio registrar de intentos anteriores antes de crear otro", async () => {
    servidorFalso.responder("auth.mfa:listFactors", { data: { all: [FACTOR_A_MEDIAS], totp: [], phone: [] }, error: null });

    await iniciarActivacion();

    expect(servidorFalso.llamadasA("auth.mfa:unenroll").map((l) => l.argumentos[0])).toEqual([{ factorId: "f-x" }]);
  });

  it("si ya hay un factor confirmado NO crea otro (lo que hace falta es escribir el código)", async () => {
    servidorFalso.responder("auth.mfa:listFactors", CON_UN_FACTOR);

    expect((await iniciarActivacion())?.error).toMatch(/Ya registraste/);
    expect(servidorFalso.llamadasA("auth.mfa:enroll")).toHaveLength(0);
    expect(servidorFalso.llamadasA("auth.mfa:unenroll")).toHaveLength(0);
  });

  it("si Supabase falla al listar o al crear: error genérico y queda registrado", async () => {
    servidorFalso.responder("auth.mfa:listFactors", SIN_FACTORES);
    servidorFalso.responder("auth.mfa:enroll", { data: null, error: { message: "boom", code: "unexpected_failure" } });

    expect(await iniciarActivacion()).toEqual({
      error: "No pudimos preparar la activación. Intenta de nuevo.",
    });
    expect(logError).toHaveBeenCalledWith("segundoFactor:iniciar", "enroll falló", expect.anything(), { area: "auth" });
  });
});

describe("confirmarActivacion", () => {
  beforeEach(() => {
    servidorFalso.responder("auth.mfa:challengeAndVerify", { data: {}, error: null });
  });

  it("código correcto: confirma el factor y manda a /admin por defecto", async () => {
    expect(await destinoDe(confirmarActivacion(null, formulario({ factorId: "f-nuevo", codigo: "123456" })))).toBe("/admin");
    expect(verificaciones()[0].argumentos[0]).toEqual({ factorId: "f-nuevo", code: "123456" });
  });

  it("acepta el código como lo muestran las apps, con espacio («123 456»)", async () => {
    await destinoDe(confirmarActivacion(null, formulario({ factorId: "f-nuevo", codigo: "123 456" })));

    expect(verificaciones()[0].argumentos[0]).toEqual({ factorId: "f-nuevo", code: "123456" });
  });

  it.each([
    ["vacío", ""],
    ["de 5 dígitos", "12345"],
    ["de 7 dígitos", "1234567"],
    ["con letras", "12a456"],
  ])("un código %s se rechaza sin llamar a Supabase", async (_caso, codigo) => {
    expect(await confirmarActivacion(null, formulario({ factorId: "f-nuevo", codigo }))).toEqual({
      error: "Escribe los 6 dígitos que muestra tu app de autenticación.",
    });
    expect(verificaciones()).toHaveLength(0);
  });

  it("sin factor a confirmar pide empezar de nuevo", async () => {
    expect(await confirmarActivacion(null, formulario({ codigo: "123456" }))).toEqual({
      error: "Vuelve a empezar la activación.",
    });
  });

  it("código incorrecto: mensaje en español, sin hablar de TOTP, y no redirige", async () => {
    servidorFalso.responder("auth.mfa:challengeAndVerify", CODIGO_MALO);

    const resultado = await confirmarActivacion(null, formulario({ factorId: "f-nuevo", codigo: "000000" }));

    expect(resultado?.error).toMatch(/El código no es correcto/);
    expect(resultado?.error).not.toMatch(/TOTP/i);
    expect(logError).not.toHaveBeenCalled();
  });

  it("límite de intentos: lo dice con claridad", async () => {
    servidorFalso.responder("auth.mfa:challengeAndVerify", LIMITE);

    expect((await confirmarActivacion(null, formulario({ factorId: "f-nuevo", codigo: "000000" })))?.error).toMatch(
      /Demasiados intentos/,
    );
  });

  it("un fallo que no es del código se reporta genérico y se registra", async () => {
    servidorFalso.responder("auth.mfa:challengeAndVerify", { data: null, error: { code: "unexpected_failure", status: 500, message: "x" } });

    expect(await confirmarActivacion(null, formulario({ factorId: "f-nuevo", codigo: "123456" }))).toEqual({
      error: "No pudimos verificar el código. Intenta de nuevo.",
    });
    expect(logError).toHaveBeenCalledTimes(1);
  });

  it("respeta un destino interno y descarta uno externo", async () => {
    expect(
      await destinoDe(confirmarActivacion(null, formulario({ factorId: "f", codigo: "123456", redirect: "/admin/usuarios" }))),
    ).toBe("/admin/usuarios");
    expect(
      await destinoDe(confirmarActivacion(null, formulario({ factorId: "f", codigo: "123456", redirect: "//otro-sitio.com" }))),
    ).toBe("/admin");
    expect(
      await destinoDe(confirmarActivacion(null, formulario({ factorId: "f", codigo: "123456", redirect: "https://otro-sitio.com" }))),
    ).toBe("/admin");
  });

  it("sin sesión no verifica nada", async () => {
    servidorFalso.conUsuario(null);

    expect(await confirmarActivacion(null, formulario({ factorId: "f", codigo: "123456" }))).toEqual({
      error: "Tu sesión expiró. Vuelve a iniciar sesión.",
    });
    expect(verificaciones()).toHaveLength(0);
  });
});

describe("verificarSegundoFactor", () => {
  it("código correcto con un dispositivo: entra", async () => {
    servidorFalso.responder("auth.mfa:listFactors", CON_UN_FACTOR);
    servidorFalso.responder("auth.mfa:challengeAndVerify", { data: {}, error: null });

    expect(await destinoDe(verificarSegundoFactor(null, formulario({ codigo: "123456", redirect: "/admin" })))).toBe("/admin");
    expect(verificaciones()[0].argumentos[0]).toEqual({ factorId: "f-1", code: "123456" });
  });

  it("sin factor confirmado no hay nada que verificar", async () => {
    servidorFalso.responder("auth.mfa:listFactors", SIN_FACTORES);

    expect(await verificarSegundoFactor(null, formulario({ codigo: "123456" }))).toEqual({
      error: "Aún no registraste una app de autenticación.",
    });
    expect(verificaciones()).toHaveLength(0);
  });

  it("con dos dispositivos, si el código es del segundo lo prueba y entra", async () => {
    servidorFalso.responder("auth.mfa:listFactors", {
      data: { all: [FACTOR_CONFIRMADO, FACTOR_SEGUNDO], totp: [FACTOR_CONFIRMADO, FACTOR_SEGUNDO], phone: [] },
      error: null,
    });
    servidorFalso.responderEnOrden("auth.mfa:challengeAndVerify", [CODIGO_MALO, { data: {}, error: null }]);

    expect(await destinoDe(verificarSegundoFactor(null, formulario({ codigo: "123456" })))).toBe("/admin");
    expect(verificaciones().map((l) => (l.argumentos[0] as { factorId: string }).factorId)).toEqual(["f-1", "f-2"]);
  });

  it("con dos dispositivos y un código malo en ambos: un solo mensaje, sin redirigir", async () => {
    servidorFalso.responder("auth.mfa:listFactors", {
      data: { all: [FACTOR_CONFIRMADO, FACTOR_SEGUNDO], totp: [FACTOR_CONFIRMADO, FACTOR_SEGUNDO], phone: [] },
      error: null,
    });
    servidorFalso.responder("auth.mfa:challengeAndVerify", CODIGO_MALO);

    expect((await verificarSegundoFactor(null, formulario({ codigo: "000000" })))?.error).toMatch(/El código no es correcto/);
    expect(verificaciones()).toHaveLength(2);
  });

  it("si Supabase pone el límite de intentos, NO sigue probando el otro dispositivo", async () => {
    servidorFalso.responder("auth.mfa:listFactors", {
      data: { all: [FACTOR_CONFIRMADO, FACTOR_SEGUNDO], totp: [FACTOR_CONFIRMADO, FACTOR_SEGUNDO], phone: [] },
      error: null,
    });
    servidorFalso.responder("auth.mfa:challengeAndVerify", LIMITE);

    expect((await verificarSegundoFactor(null, formulario({ codigo: "000000" })))?.error).toMatch(/Demasiados intentos/);
    expect(verificaciones()).toHaveLength(1);
  });

  it("un código mal formado se rechaza sin tocar Supabase", async () => {
    expect((await verificarSegundoFactor(null, formulario({ codigo: "abc" })))?.error).toMatch(/6 dígitos/);
    expect(servidorFalso.llamadasA("auth.mfa:listFactors")).toHaveLength(0);
  });

  it("si falla la lectura de factores: error genérico y registrado, no 'sin factores'", async () => {
    servidorFalso.responder("auth.mfa:listFactors", { data: null, error: { message: "boom", code: "unexpected_failure" } });

    expect(await verificarSegundoFactor(null, formulario({ codigo: "123456" }))).toEqual({
      error: "No pudimos verificar el código. Intenta de nuevo.",
    });
    expect(logError).toHaveBeenCalledWith("segundoFactor:verificar", "listFactors falló", expect.anything(), { area: "auth" });
  });
});
