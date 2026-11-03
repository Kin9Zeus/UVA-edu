import { describe, expect, it } from "vitest";
import type { ErrorEvent } from "@sentry/nextjs";
import { limpiarEventoSentry, limpiarMigajaSentry, limpiarUrl, opcionesPrivacidadSentry } from "@/lib/sentry-privacidad";

describe("limpiarUrl", () => {
  it("redacta los códigos de los enlaces de confirmación y recuperación", () => {
    expect(limpiarUrl("https://uva.co/auth/callback?code=abc123&next=%2Fdashboard")).toBe(
      "https://uva.co/auth/callback?code=[filtrado]&next=%2Fdashboard",
    );
    expect(limpiarUrl("/auth/confirm?token_hash=xyz&type=recovery")).toBe("/auth/confirm?token_hash=[filtrado]&type=recovery");
  });

  it("redacta un correo como parámetro y uno escrito en la ruta", () => {
    expect(limpiarUrl("/login?email=ana%40uva.co")).toBe("/login?email=[filtrado]");
    expect(limpiarUrl("/buscar/ana@uva.co")).toBe("/buscar/[correo]");
  });

  it("deja intactos los parámetros que no son sensibles", () => {
    expect(limpiarUrl("/catalogo?pagina=2&orden=nuevo#cursos")).toBe("/catalogo?pagina=2&orden=nuevo#cursos");
    expect(limpiarUrl("/dashboard")).toBe("/dashboard");
  });

  it("también limpia un query string suelto, sin el signo de pregunta", () => {
    expect(limpiarUrl("code=abc&type=signup")).toBe("code=[filtrado]&type=signup");
  });
});

describe("limpiarEventoSentry", () => {
  const evento = (): ErrorEvent =>
    ({
      type: undefined,
      message: "No pudimos enviar el correo a ana@uva.co",
      user: { id: "u1", email: "ana@uva.co", ip_address: "1.2.3.4" },
      exception: { values: [{ type: "AuthApiError", value: "User ana@uva.co already registered" }] },
      request: {
        url: "https://uva.co/auth/callback?code=secreto",
        query_string: "code=secreto&next=%2F",
        cookies: { "sb-access-token": "jwt" },
        data: { email: "ana@uva.co", password: "Clave123!" },
        headers: { cookie: "sb=1", authorization: "Bearer x", "user-agent": "Chrome", referer: "https://uva.co/x?token=t" },
      },
      extra: { causaOriginal: { details: "Key (correo)=(ana@uva.co) already exists." }, intentos: 3 },
      breadcrumbs: [{ category: "console", message: "enviando a ana@uva.co" }],
    }) as ErrorEvent;

  it("quita el usuario, las cookies y el cuerpo de la petición", () => {
    const limpio = limpiarEventoSentry(evento());

    expect(limpio.user).toBeUndefined();
    expect(limpio.request?.cookies).toBeUndefined();
    expect(limpio.request?.data).toBeUndefined();
  });

  it("redacta los encabezados de sesión y deja los demás", () => {
    const { headers } = limpiarEventoSentry(evento()).request!;

    expect(headers).toEqual({
      cookie: "[filtrado]",
      authorization: "[filtrado]",
      "user-agent": "Chrome",
      referer: "https://uva.co/x?token=[filtrado]",
    });
  });

  it("quita correos del mensaje, de la excepción, de los extras y de las migajas, sin borrar la pista", () => {
    const limpio = limpiarEventoSentry(evento());

    expect(limpio.message).toBe("No pudimos enviar el correo a [correo]");
    expect(limpio.exception?.values?.[0].value).toBe("User [correo] already registered");
    expect(limpio.extra).toEqual({ causaOriginal: { details: "Key (correo)=([correo]) already exists." }, intentos: 3 });
    expect(limpio.breadcrumbs?.[0].message).toBe("enviando a [correo]");
  });

  it("redacta el código de la URL y del query string", () => {
    const { request } = limpiarEventoSentry(evento());

    expect(request?.url).toBe("https://uva.co/auth/callback?code=[filtrado]");
    expect(request?.query_string).toBe("code=[filtrado]&next=%2F");
  });

  it("un evento sin datos personales sale igual", () => {
    const limpio = limpiarEventoSentry({ type: undefined, message: "Mux no respondió", extra: { intento: 2 } } as ErrorEvent);

    expect(limpio).toEqual({ type: undefined, message: "Mux no respondió", extra: { intento: 2 } });
  });
});

describe("limpiarMigajaSentry", () => {
  it("limpia las URLs de navegación y de fetch", () => {
    expect(limpiarMigajaSentry({ category: "navigation", data: { from: "/login?email=a@b.co", to: "/auth/callback?code=x" } }).data).toEqual({
      from: "/login?email=[filtrado]",
      to: "/auth/callback?code=[filtrado]",
    });
    expect(limpiarMigajaSentry({ category: "fetch", data: { url: "/api/x?token=t", status_code: 200 } }).data).toEqual({
      url: "/api/x?token=[filtrado]",
      status_code: 200,
    });
  });
});

describe("opcionesPrivacidadSentry", () => {
  it("deja sendDefaultPii apagado de forma explícita", () => {
    expect(opcionesPrivacidadSentry.sendDefaultPii).toBe(false);
  });
});
