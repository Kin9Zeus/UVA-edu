import { beforeEach, describe, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({
  publicados: ["terminos", "datos-personales"] as string[],
}));

vi.mock("@/lib/legal/textos", () => ({
  obtenerTextoVigente: (slug: string) => (estado.publicados.includes(slug) ? { slug } : null),
}));

const { destinoLegalDeTema } = await import("@/lib/legal/redireccion-soporte");

beforeEach(() => {
  estado.publicados = ["terminos", "datos-personales"];
});

describe("destinoLegalDeTema", () => {
  it("lleva 'terminos' a su texto", () => {
    expect(destinoLegalDeTema("terminos")).toBe("/legal/terminos");
  });

  it("lleva 'privacidad' a la política de tratamiento de datos personales", () => {
    expect(destinoLegalDeTema("privacidad")).toBe("/legal/datos-personales");
  });

  it("si el texto todavía no está publicado no redirige (sería mandar a un 404)", () => {
    estado.publicados = ["cookies"];
    expect(destinoLegalDeTema("terminos")).toBeNull();
    expect(destinoLegalDeTema("privacidad")).toBeNull();
  });

  it("los otros temas de soporte no se tocan", () => {
    expect(destinoLegalDeTema("contacto")).toBeNull();
    expect(destinoLegalDeTema("centro-de-ayuda")).toBeNull();
  });

  it("un tema inventado (?tema= viene del cliente) o ausente no redirige", () => {
    expect(destinoLegalDeTema("../../admin")).toBeNull();
    expect(destinoLegalDeTema(undefined)).toBeNull();
  });
});
