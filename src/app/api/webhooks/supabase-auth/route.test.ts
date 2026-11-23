import { afterEach, describe, expect, it, vi } from "vitest";

const enviar = vi.hoisted(() => vi.fn());
vi.mock("@/lib/resend/client", () => ({ resend: { emails: { send: enviar } } }));
vi.mock("@/lib/log", () => import("@/test/servidor-falso").then((m) => m.moduloLog()));
// La plantilla y el marco devuelven sus argumentos: así se lee el enlace que
// recibe el correo sin renderizar React Email.
vi.mock("@/lib/resend/emails/recuperar-password-email", () => ({
  ASUNTO_RECUPERAR_PASSWORD: "Recupera tu contraseña",
  RecuperarPasswordEmail: (props: { actionLink: string }) => props,
}));
vi.mock("@/emails/marco/envio", () => ({ envioTransaccional: async (correo: unknown) => correo }));

import { NextRequest } from "next/server";
import { Webhook } from "standardwebhooks";
import { POST } from "@/app/api/webhooks/supabase-auth/route";
import { logError } from "@/lib/log";

/**
 * Fase 11.1: el secreto del hook se lee en cada petición, no al cargar el
 * módulo, para que `next build` (y la imagen de Docker) no lo necesite.
 * Sin el secreto, la ruta falla cerrado.
 */
function peticion(): NextRequest {
  return new NextRequest("http://localhost/api/webhooks/supabase-auth", {
    method: "POST",
    body: JSON.stringify({ user: {}, email_data: {} }),
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.mocked(logError).mockClear();
  enviar.mockClear();
});

describe("webhook de envío de correo de Supabase Auth", () => {
  it("sin SEND_EMAIL_HOOK_SECRET responde 500 y no manda nada", async () => {
    vi.stubEnv("SEND_EMAIL_HOOK_SECRET", "");

    const respuesta = await POST(peticion());

    expect(respuesta.status).toBe(500);
    expect(enviar).not.toHaveBeenCalled();
    expect(logError).toHaveBeenCalledWith(
      "webhook:supabase-auth",
      "falta SEND_EMAIL_HOOK_SECRET",
      undefined,
      expect.objectContaining({ area: "webhook" }),
    );
  });

  it("con el secreto pero una firma falsa responde 401 y no manda nada", async () => {
    vi.stubEnv("SEND_EMAIL_HOOK_SECRET", `v1,whsec_${Buffer.from("secreto-de-prueba-123456").toString("base64")}`);

    const respuesta = await POST(peticion());

    expect(respuesta.status).toBe(401);
    expect(enviar).not.toHaveBeenCalled();
  });
});

/**
 * P1-3 (AUDIT-2026-11-23.md): el origen del enlace no sale del payload. Con
 * un payload firmado (el secreto se filtró, o se comparte entre entornos),
 * antes se podía mandar un correo auténtico de mail.uvarq.com cuyo botón
 * llevaba a otro dominio.
 */
describe("el enlace del correo siempre apunta al sitio", () => {
  const SECRETO = Buffer.from("secreto-de-prueba-123456").toString("base64");

  function firmada(emailData: Record<string, string>): NextRequest {
    const cuerpo = JSON.stringify({
      user: { email: "persona@ejemplo.co" },
      email_data: {
        token_hash: "hash123",
        email_action_type: "recovery",
        site_url: "https://proyecto.supabase.co/auth/v1",
        ...emailData,
      },
    });
    const id = "msg_1";
    const ahora = new Date();
    const firma = new Webhook(SECRETO).sign(id, ahora, cuerpo);
    return new NextRequest("http://localhost/api/webhooks/supabase-auth", {
      method: "POST",
      body: cuerpo,
      headers: {
        "webhook-id": id,
        "webhook-timestamp": String(Math.floor(ahora.getTime() / 1000)),
        "webhook-signature": firma,
      },
    });
  }

  async function enlaceEnviado(emailData: Record<string, string>): Promise<string> {
    vi.stubEnv("SEND_EMAIL_HOOK_SECRET", `v1,whsec_${SECRETO}`);
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://beta.uvarq.com");
    enviar.mockResolvedValue({ data: { id: "x" }, error: null });

    const respuesta = await POST(firmada(emailData));

    expect(respuesta.status).toBe(200);
    expect(enviar).toHaveBeenCalledTimes(1);
    return enviar.mock.calls[0][0].react.actionLink;
  }

  it("un redirect_to de otro dominio no llega al correo y queda registrado", async () => {
    const enlace = await enlaceEnviado({ redirect_to: "https://evil.tld/auth/confirm?next=/x" });

    expect(new URL(enlace).origin).toBe("https://beta.uvarq.com");
    expect(enlace).not.toContain("evil.tld");
    expect(logError).toHaveBeenCalledWith(
      "webhook:supabase-auth",
      "redirect_to fuera del sitio",
      undefined,
      expect.objectContaining({ area: "webhook" }),
    );
  });

  it("un site_url ajeno con redirect_to relativo tampoco cambia el origen", async () => {
    const enlace = await enlaceEnviado({ redirect_to: "/dashboard", site_url: "https://evil.tld" });

    expect(new URL(enlace).origin).toBe("https://beta.uvarq.com");
    expect(enlace).toContain("next=%2Fdashboard");
  });

  it("el caso legítimo de recuperación sigue igual, sin anidar /auth/confirm", async () => {
    const enlace = await enlaceEnviado({
      redirect_to: "https://beta.uvarq.com/auth/confirm?next=/actualizar-password",
    });

    expect(enlace).toBe(
      "https://beta.uvarq.com/auth/confirm?next=%2Factualizar-password&token_hash=hash123&type=recovery",
    );
    expect(logError).not.toHaveBeenCalled();
  });
});
