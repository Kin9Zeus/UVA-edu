import { afterEach, describe, expect, it, vi } from "vitest";

const enviar = vi.hoisted(() => vi.fn());
vi.mock("@/lib/resend/client", () => ({ resend: { emails: { send: enviar } } }));
vi.mock("@/lib/log", () => import("@/test/servidor-falso").then((m) => m.moduloLog()));

import { NextRequest } from "next/server";
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
