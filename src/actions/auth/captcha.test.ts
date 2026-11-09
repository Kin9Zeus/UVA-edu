import { beforeEach, describe, expect, it, vi } from "vitest";
import { servidorFalso } from "@/test/servidor-falso";

vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));
vi.mock("@/lib/supabase/admin", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseAdmin()));
vi.mock("next/navigation", () => import("@/test/servidor-falso").then((m) => m.moduloNextNavigation()));
vi.mock("next/headers", () => import("@/test/servidor-falso").then((m) => m.moduloNextHeaders()));
vi.mock("@/lib/log", () => import("@/test/servidor-falso").then((m) => m.moduloLog()));
vi.mock("@/lib/eventos-seguridad", () => ({ registrarEventoDeLaPeticion: vi.fn(async () => {}) }));
vi.mock("@/actions/auth/check-email", () => ({ checkEmail: vi.fn(async () => ({ exists: false })) }));

import { login } from "@/actions/auth/login";
import { registro } from "@/actions/auth/registro";
import { recuperar } from "@/actions/auth/recuperar";
import { reenviarVerificacion } from "@/actions/auth/reenviar-verificacion";
import { registrarEventoDeLaPeticion } from "@/lib/eventos-seguridad";
import { CAMPO_TURNSTILE, MENSAJE_CAPTCHA, esFalloCaptcha, tokenTurnstile } from "@/lib/turnstile";

/**
 * Fase 4: Cloudflare Turnstile. Lo valida Supabase Auth (no la app): aquí se
 * prueba que cada formulario sin sesión le pasa el token, y que un rechazo
 * del captcha se explica bien y no se confunde con otra cosa.
 */

const CORREO = "ana@uva.co";
const TOKEN = "token-de-turnstile";
const RECHAZO_CAPTCHA = {
  data: null,
  error: { code: "captcha_failed", message: "captcha protection: request disallowed (invalid-input-response)", status: 400 },
};

function formulario(campos: Record<string, string>): FormData {
  const datos = new FormData();
  for (const [campo, valor] of Object.entries(campos)) datos.set(campo, valor);
  return datos;
}

const conToken = (campos: Record<string, string>) => formulario({ ...campos, [CAMPO_TURNSTILE]: TOKEN });

beforeEach(() => {
  servidorFalso.reiniciar();
  vi.mocked(registrarEventoDeLaPeticion).mockClear();
  servidorFalso.responder("rpc:verificar_intentos_login", { data: { permitido: true, segundos_espera: 0 } });
  servidorFalso.responder("rpc:registrar_solicitud_recuperacion", { data: true });
  servidorFalso.responder("rpc:registrar_reenvio_verificacion", { data: true });
});

describe("lib/turnstile", () => {
  it("lee el token del campo que agrega Turnstile, sin espacios", () => {
    expect(tokenTurnstile(formulario({ [CAMPO_TURNSTILE]: `  ${TOKEN} ` }))).toBe(TOKEN);
  });

  it("sin recuadro (campo ausente o vacío) no inventa un token", () => {
    expect(tokenTurnstile(formulario({}))).toBeUndefined();
    expect(tokenTurnstile(formulario({ [CAMPO_TURNSTILE]: "  " }))).toBeUndefined();
  });

  it("reconoce el rechazo del captcha por código o por mensaje, y nada más", () => {
    expect(esFalloCaptcha({ code: "captcha_failed" })).toBe(true);
    expect(esFalloCaptcha({ message: "captcha protection: request disallowed (no captcha_token found)" })).toBe(true);
    expect(esFalloCaptcha({ code: "invalid_credentials", message: "Invalid login credentials" })).toBe(false);
    expect(esFalloCaptcha(null)).toBe(false);
  });
});

describe("login: la contraseña al entrar", () => {
  it("le pasa el token a Supabase", async () => {
    servidorFalso.responder("auth:signInWithPassword", RECHAZO_CAPTCHA);
    await login(null, conToken({ email: CORREO, password: "Secreta123!x" }));
    expect(servidorFalso.argumentosDe("auth:signInWithPassword")).toMatchObject({
      email: CORREO,
      options: { captchaToken: TOKEN },
    });
  });

  it("un rechazo del captcha NO es una contraseña equivocada: no suma intento ni evento de login fallido", async () => {
    servidorFalso.responder("auth:signInWithPassword", RECHAZO_CAPTCHA);

    expect(await login(null, conToken({ email: CORREO, password: "Secreta123!x" }))).toEqual({ error: MENSAJE_CAPTCHA });
    expect(servidorFalso.llamadasA("rpc:registrar_login_fallido")).toHaveLength(0);
    expect(registrarEventoDeLaPeticion).not.toHaveBeenCalledWith("login_fallido", expect.anything());
  });
});

describe("registro", () => {
  it("le pasa el token a Supabase y explica el rechazo del captcha", async () => {
    servidorFalso.responder("auth:signUp", RECHAZO_CAPTCHA);

    const estado = await registro(
      null,
      conToken({ email: CORREO, nombre: "Ana", password: "Arquitecta2026!" }),
    );

    expect(servidorFalso.argumentosDe("auth:signUp")).toMatchObject({ options: { captchaToken: TOKEN } });
    expect(estado).toEqual({ error: MENSAJE_CAPTCHA });
  });
});

describe("recuperar y reenviar: sin captcha válido no se dice «listo»", () => {
  it("recuperar le pasa el token y, si el captcha falla, avisa en vez de fingir que salió el correo", async () => {
    servidorFalso.responder("auth:resetPasswordForEmail", RECHAZO_CAPTCHA);

    expect(await recuperar(null, conToken({ email: CORREO }))).toEqual({ error: MENSAJE_CAPTCHA });
    const [llamada] = servidorFalso.llamadasA("auth:resetPasswordForEmail");
    expect(llamada.argumentos[1]).toMatchObject({ captchaToken: TOKEN });
  });

  it("recuperar sigue respondiendo «listo» cuando el captcha pasa (no revela si la cuenta existe)", async () => {
    servidorFalso.responder("auth:resetPasswordForEmail", { data: {}, error: null });
    expect(await recuperar(null, conToken({ email: CORREO }))).toEqual({ success: true });
  });

  it("reenviar la verificación le pasa el token y explica el rechazo del captcha", async () => {
    servidorFalso.responder("auth:resend", RECHAZO_CAPTCHA);

    expect(await reenviarVerificacion(null, conToken({ email: CORREO }))).toEqual({ error: MENSAJE_CAPTCHA });
    expect(servidorFalso.argumentosDe("auth:resend")).toMatchObject({ options: { captchaToken: TOKEN } });
  });
});
