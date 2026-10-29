import { beforeEach, describe, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({
  habilitado: true,
  publicados: ["terminos", "datos-personales"] as string[],
}));

vi.mock("@/lib/features", () => ({
  get LEGAL_HABILITADO() {
    return estado.habilitado;
  },
  PRECIOS_HABILITADOS: false,
}));
vi.mock("@/lib/legal/textos", () => ({
  getSlugsConTextoVigente: vi.fn(async () => estado.publicados),
}));

const { destinoLegalDeTema } = await import("@/lib/legal/redireccion-soporte");

beforeEach(() => {
  estado.habilitado = true;
  estado.publicados = ["terminos", "datos-personales"];
});

describe("destinoLegalDeTema", () => {
  it("lleva 'terminos' a su texto", async () => {
    expect(await destinoLegalDeTema("terminos")).toBe("/legal/terminos");
  });

  it("lleva 'privacidad' a la política de tratamiento de datos personales", async () => {
    expect(await destinoLegalDeTema("privacidad")).toBe("/legal/datos-personales");
  });

  it("con la bandera apagada no redirige: el aviso de 'en preparación' sigue", async () => {
    estado.habilitado = false;
    expect(await destinoLegalDeTema("terminos")).toBeNull();
  });

  it("si el texto todavía no está publicado no redirige (sería mandar a un 404)", async () => {
    estado.publicados = ["cookies"];
    expect(await destinoLegalDeTema("terminos")).toBeNull();
    expect(await destinoLegalDeTema("privacidad")).toBeNull();
  });

  it("los otros temas de soporte no se tocan", async () => {
    expect(await destinoLegalDeTema("contacto")).toBeNull();
    expect(await destinoLegalDeTema("centro-de-ayuda")).toBeNull();
  });

  it("un tema inventado (?tema= viene del cliente) o ausente no redirige", async () => {
    expect(await destinoLegalDeTema("../../admin")).toBeNull();
    expect(await destinoLegalDeTema(undefined)).toBeNull();
  });
});
