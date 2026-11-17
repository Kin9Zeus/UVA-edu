import { describe, expect, it } from "vitest";
import { clarityPermitida, esRegistroNuevoConGoogle, validarClarityId, validarGaId } from "@/lib/analitica";

describe("validarGaId / validarClarityId", () => {
  it("acepta los formatos reales", () => {
    expect(validarGaId("G-ABC123XYZ9")).toBe("G-ABC123XYZ9");
    expect(validarClarityId("k3x9a1b2c4")).toBe("k3x9a1b2c4");
  });

  it.each(["", "G-", "UA-12345-1", "G-abc';alert(1)//", "G-ABC/../x"])("GA rechaza %j", (id) => {
    expect(validarGaId(id)).toBeNull();
  });

  it.each(["", "abc", "k3x9a1b2c4/evil", "K3X9A1B2C4\"", "https://x.ms"])("Clarity rechaza %j", (id) => {
    expect(validarClarityId(id)).toBeNull();
  });
});

describe("clarityPermitida — solo páginas públicas sin datos personales", () => {
  it.each([
    "/",
    "/catalogo",
    "/catalogo/estructuras",
    "/cursos/concreto-basico",
    "/legal/cookies",
    "/planes",
    "/soporte",
    "/login",
    "/registro",
    "/canjear",
    "/recuperar",
  ])("graba en %s", (ruta) => {
    expect(clarityPermitida(ruta)).toBe(true);
  });

  it.each([
    "/dashboard",
    "/dashboard/perfil",
    "/admin",
    "/admin/usuarios/ana",
    "/cursos/concreto-basico/clase-1",
    "/cursos/concreto-basico/examen",
    "/verificar-certificado/UVA-1234",
    "/verificar-certificado",
    "/actualizar-password",
    "/verificar-correo",
    "/cuenta-eliminada",
    "/seguridad/verificar",
    "/vista-previa/token/clase",
    "/auth/confirm",
  ])("no graba en %s", (ruta) => {
    expect(clarityPermitida(ruta)).toBe(false);
  });
});


describe("esRegistroNuevoConGoogle", () => {
  const ahora = "2026-11-17T15:00:00.000Z";

  it("cuenta nueva: creada y con sesión iniciada a la vez", () => {
    expect(
      esRegistroNuevoConGoogle({ app_metadata: { provider: "google" }, created_at: ahora, last_sign_in_at: "2026-11-17T15:00:01.200Z" }),
    ).toBe(true);
  });

  it("cuenta que ya existía: no es un registro", () => {
    expect(
      esRegistroNuevoConGoogle({ app_metadata: { provider: "google" }, created_at: "2026-10-01T10:00:00Z", last_sign_in_at: ahora }),
    ).toBe(false);
  });

  it("otro proveedor (el registro con correo ya se mide en el formulario)", () => {
    expect(esRegistroNuevoConGoogle({ app_metadata: { provider: "email" }, created_at: ahora, last_sign_in_at: ahora })).toBe(false);
  });

  it.each([null, undefined, {}, { app_metadata: { provider: "google" } }, { app_metadata: { provider: "google" }, created_at: "x", last_sign_in_at: ahora }])(
    "datos incompletos no cuentan: %j",
    (usuario) => {
      expect(esRegistroNuevoConGoogle(usuario)).toBe(false);
    },
  );
});
